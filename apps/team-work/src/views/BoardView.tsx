import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { endOfDay, isDueOverdue, startOfDay, startOfWeek, endOfWeek } from '../domain/dates'
import { EXPORT_HEADERS, downloadCsv, ymd } from '../domain/export'
import { BOARD_VIEWS, allCategories, allTypes, dimNames, dimsOf, dimValueOf, groupDimTags, allDimTags, PRIORITIES, priorityMeta, type Task } from '../domain/types'
import { buildSections, type GroupBy } from '../domain/grouping'
import { canEditTask } from '../domain/permissions'
import { useApp } from '../store/AppProvider'
import { IconCheck, IconList, IconPlus, IconSearch } from '../components/Icons'
import { TaskRow } from '../components/TaskRow'
import { TaskRowForm } from '../components/TaskRowForm'
import { Select } from '../components/Select'
import { useRegisterBoardActions } from '../store/BoardActions'
import { DailyIvyPanel } from '../components/DailyIvyPanel'
import { GanttView } from './GanttView'
import { useResponsiveDisclosure } from '../hooks/useResponsiveDisclosure'
import { executorId, groupWorkByPerson } from '../domain/workload'

type TimeFilter = 'all' | 'today' | 'week' | 'overdue'

/* ── 可拖拽列宽 ─────────────────────────────────────────────────────────
   表头每一列右边缘都有一条竖杠, 按住左右拖就能改这一列的宽度, 右侧各列跟着走。
   竖杠双击 = 恢复该列默认宽度。宽度存在浏览器本地 (localStorage), 刷新不丢。
   title 列的默认值是「自适应剩余空间」, 一旦拖过就变成固定像素宽度。 */
type ColKey = string
/** 分类维度的列键: 一个维度一列 (dim:<维度 id>), 维度是动态的 */
const colKeyOf = (dimId: string) => `dim:${dimId}`
const DIM_COL_DEFAULT = 80
const DIM_COL_MIN = 72
const COL_DEFAULTS: Record<string, number | null> = {
  title: null, prio: 64, prog: 106, assign: 90, owner: 104, due: 112,
  done: 84, created: 84,
}
const COL_MIN: Record<string, number> = {
  title: 280, prio: 64, prog: 80, assign: 88, owner: 88, due: 112,
  done: 84, created: 84,
}
const COL_LABEL: Record<string, string> = {
  title: '任务',
  prio: '优先级',
  prog: '进度',
  assign: '派发人',
  owner: '执行人',
  due: '截止 / 周期',
  done: '完成时间',
  created: '记录时间',
}
/** 某列的宽度/下限 (分类维度列走默认值) */
const colWidth = (cols: Record<string, number | null>, key: string) =>
  cols[key] ?? (key.startsWith('dim:') ? DIM_COL_DEFAULT : COL_DEFAULTS[key] ?? null)
const colMin = (key: string) => COL_MIN[key] ?? (key.startsWith('dim:') ? DIM_COL_MIN : 80)
const COL_STORE = 'team.columns.readable'

function loadCols(): Record<string, number | null> {
  try {
    const raw = localStorage.getItem(COL_STORE)
    return raw ? { ...COL_DEFAULTS, ...JSON.parse(raw) } : { ...COL_DEFAULTS }
  } catch {
    return { ...COL_DEFAULTS }
  }
}
type EditState =
  | { kind: 'create' }
  | { kind: 'edit'; task: Task }
  | { kind: 'sub'; parent: Task }
  | { kind: 'below'; after: Task }

type ListItem =
  | {
      type: 'row'
      task: Task
      depth: number
      /** **上层**最近的截止日 (不含自己): 行首渐变的兜底 + 日期选择的上限 */
      due: string | null
    }
  | { type: 'form'; state: EditState }
  /** 行与行之间的拖放区: 放到这里 = 变成这一层的同级任务 (level=null 即主任务) */
  | { type: 'gap'; level: string | null; key: string }
  /** 主任务之间的分隔线 (子任务之间不加) */
  | { type: 'line'; key: string }

const WEEK_MS = 7 * 86400000

/**
 * 列表排序: 未完成在前、已完成的沉底 (主任务沉到最下面, 子任务沉到它主任务的最下面 ——
 * 每一层都按这个规则排, 所以两件事是同一段代码)。同档里再按逾期 → 截止 → 优先级 → 创建顺序。
 */
/** 可选的排序方式 */
type SortKey = 'default' | 'dueAsc' | 'dueDesc' | 'newDesc' | 'newAsc' | 'priority'

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'default', label: '默认排序 (逾期优先)' },
  { value: 'dueAsc', label: '截止日期: 近 → 远' },
  { value: 'dueDesc', label: '截止日期: 远 → 近' },
  { value: 'newDesc', label: '新建时间: 新 → 旧' },
  { value: 'newAsc', label: '新建时间: 旧 → 新' },
  { value: 'priority', label: '优先级: P0 → P3' },
]

/** 排序后仍然「已完成的沉底」 */
const doneLast = (f: (a: Task, b: Task) => number) => (a: Task, b: Task) => {
  const d = (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)
  return d !== 0 ? d : f(a, b)
}

const dueMs = (t: Task) => (t.dueAt ? new Date(t.dueAt).getTime() : null)

/** 按截止日期排: 没设日期的一律排最后 */
const byDue = (dir: 1 | -1) => (a: Task, b: Task) => {
  const av = dueMs(a)
  const bv = dueMs(b)
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  return (av - bv) * dir
}

function byCreated(dir: 1 | -1) {
  return (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt) * dir
}

const byPriority = (a: Task, b: Task) => priorityMeta(b.priority).weight - priorityMeta(a.priority).weight

/** 按所选方式排序 (排序前先把完成的沉到底) */
function sorterFor(key: SortKey) {
  switch (key) {
    case 'dueAsc':
      return doneLast(byDue(1))
    case 'dueDesc':
      return doneLast(byDue(-1))
    case 'newDesc':
      return doneLast(byCreated(-1))
    case 'newAsc':
      return doneLast(byCreated(1))
    case 'priority':
      return doneLast(byPriority)
    default:
      return byDueThenPriority
  }
}

function byDueThenPriority(a: Task, b: Task) {
  const aDone = a.status === 'done'
  const bDone = b.status === 'done'
  if (aDone !== bDone) return aDone ? 1 : -1
  const aLate = isDueOverdue(a.dueAt) ? 0 : 1
  const bLate = isDueOverdue(b.dueAt) ? 0 : 1
  if (aLate !== bLate) return aLate - bLate
  const av = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
  const bv = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
  if (av !== bv) return av - bv
  const pw = priorityMeta(b.priority).weight - priorityMeta(a.priority).weight
  if (pw !== 0) return pw
  return a.createdAt.localeCompare(b.createdAt)
}

export function BoardView() {
  const [overviewExpanded, toggleOverview] = useResponsiveDisclosure('team.board.overviewExpanded', '(max-height: 560px)')
  const [filtersExpanded, toggleFilters] = useResponsiveDisclosure('team.board.filtersExpanded', '(max-height: 760px), (max-width: 1000px)')
  const overviewId = useId(), filtersId = useId()
  const { tasks, summary, view, setView, org, user, loading, pushToast, createTask, updateTask, savePrefs, saveIvy, select } = useApp()
  /** 分类维度 (动态: 除了内置的板块/类型, 还能有第 3、第 4 个) */
  const dims = dimsOf(org)
  const [query, setQuery] = useState('')
  const [person, setPerson] = useState('all')
  const [time, setTime] = useState<TimeFilter>('all')
  const [prio, setPrio] = useState<string>('all')
  /** 每个分类维度一个筛选值: { 维度id: 'all' | 标签 } */
  const [dimSel, setDimSel] = useState<Record<string, string>>({})
  const cat = dimSel.cat || 'all'
  const taskType = dimSel.type || 'all'
  const setCat = (value: string) => setDimSel((prev) => ({ ...prev, cat: value }))
  const setTaskType = (value: string) => setDimSel((prev) => ({ ...prev, type: value }))
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  /** false = 列表; true = 甘特 (按日历看排期) */
  const [chart, setChart] = useState(false)
  /** 是否显示已完成的任务 (默认显示, 它们沉在各自那一层的末尾) */
  const [showDone, setShowDone] = useState(false)
  /** 排列方式: 默认 / 截止日期 / 新建时间 / 优先级 */
  const [sort, setSort] = useState<SortKey>('default')
  const cmp = useMemo(() => sorterFor(sort), [sort])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<EditState | null>(null)
  /** 「当日艾维利」生成的文本 (null = 面板关着) */
  const [ivyText, setIvyText] = useState<string | null>(null)
  const [cols, setCols] = useState<Record<ColKey, number | null>>(loadCols)
  const colsRef = useRef(cols)
  colsRef.current = cols

  useEffect(() => {
    try {
      localStorage.setItem(COL_STORE, JSON.stringify(cols))
    } catch {
      /* 隐私模式下写不了, 忽略 */
    }
  }, [cols])

  /** 按住竖杠拖动 → 改这一列的宽度 */
  const startResize = useCallback((key: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const cell = (e.currentTarget as HTMLElement).parentElement
    if (!cell) return
    const startWidth = cell.getBoundingClientRect().width
    const startX = e.clientX
    document.body.classList.add('is-col-resizing')
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(colMin(key), Math.round(startWidth + (ev.clientX - startX)))
      setCols((prev) => ({ ...prev, [key]: next }))
    }
    const onUp = () => {
      document.body.classList.remove('is-col-resizing')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  const resetCol = useCallback((key: string) => {
    setCols((prev) => ({ ...prev, [key]: key.startsWith('dim:') ? DIM_COL_DEFAULT : COL_DEFAULTS[key] ?? null }))
  }, [])

  /**
   * 列宽: 直接拼一整条 grid-template-columns —— 分类维度是动态的,
   * 有几个维度就有几列 (顺序: 任务 · 优先级 · 进度 · 派发人 · 执行人 · 截止 · 各分类 · 完成时间 · 记录时间 · 子任务 · 操作)
   */
  const colVars = useMemo(() => {
    const keys = ['title', 'prio', 'prog', 'assign', 'owner', 'due', ...dims.map(d => colKeyOf(d.id)), 'done', 'created']
    const width = (key: string) => Math.max(colMin(key), colWidth(cols, key) ?? (key === 'title' ? 示例品牌 : DIM_COL_DEFAULT))
    const w = (key: string) => {
      const v = colWidth(cols, key)
      return key === 'title' ? `var(--task-title-track, ${v ? `${width(key)}px` : 'minmax(360px, 1fr)'})` : `${width(key)}px`
    }
    const parts = [
      '18px',
      w('title'),
      w('prio'), w('prog'), w('assign'), w('owner'), w('due'),
      ...dims.map((d) => w(colKeyOf(d.id))),
      w('done'), w('created'),
      // 任务列被拖成固定宽度后, 由这一列吸收剩余空间, 保证右侧按钮仍贴着右边缘
      cols.title ? 'minmax(0, 1fr)' : '0px',
      '60px', '56px',
    ]
    return { '--grid-cols': parts.join(' '),
      '--table-min-width': `${keys.reduce((total, key) => total + width(key), 18 + 60 + 56 + 20 + (parts.length - 1) * 8)}px` } as any
  }, [cols, dims])

  /**
   * 看板偏好: 打开时按账号里存的最后一次设置恢复, 改动后自动存回去 (防抖 700ms)。
   * 这样换台电脑登录同一个账号, 看到的还是自己熟悉的那套筛选。
   */
  const prefsApplied = useRef<string | null>(null)
  useEffect(() => {
    if (!user || prefsApplied.current === user.id) return
    prefsApplied.current = user.id
    const p = user.prefs || {}
    if (p.view) setView(p.view as typeof view)
    if (p.time) setTime(p.time as TimeFilter)
    if (p.prio) setPrio(p.prio)
    if (p.cat) setDimSel((prev) => ({ ...prev, cat: String(p.cat) }))
    if (p.type) setDimSel((prev) => ({ ...prev, type: String(p.type) }))
    if (p.dims && typeof p.dims === 'object') setDimSel((prev) => ({ ...prev, ...p.dims }))
    if (p.groupBy) setGroupBy(p.groupBy as GroupBy)
    if (p.sort) setSort(p.sort as SortKey)
    if (typeof p.showDone === 'boolean') setShowDone(p.showDone)
    if (typeof p.chart === 'boolean') setChart(p.chart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user) return
    const t = window.setTimeout(() => {
      void savePrefs({ view, time, prio, cat: dimSel.cat || 'all', type: dimSel.type || 'all', dims: dimSel, groupBy, sort, showDone, chart })
    }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, view, time, prio, dimSel, groupBy, sort, showDone, chart])

  const byParent = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const key = t.parentId || '__root__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    for (const list of map.values()) list.sort(cmp)
    return map
  }, [tasks, cmp])

  const childrenOf = (id: string) => byParent.get(id) || []

  const matched = useMemo(() => {
    if (!user) return new Set<string>()
    const isBossView = user.role === 'admin'
    const myGroups = user.groupIds || []
    const inMyGroup = (uid: string | null) =>
      !!uid && (org.users.find((u) => u.id === uid)?.groupIds || []).some((g) => myGroups.includes(g))
    const ok = (t: Task) => {
      switch (view) {
        // 全部待办: 跨部门 (只有超级管理员那排按钮里有这个视图, 服务端也只对管理员放开)
        case 'all':
          return true
        // 这几个视图都带上已完成的任务 (沉在底部, 由「显示已完成」开关决定要不要看)
        case 'dept':
          // 超级管理员的数据里本来就有所有部门, 所以他自己看「部门待办」时要按部门收一下;
          // 普通成员的数据服务端已经按部门隔离过, 直接全显示
          return isBossView ? t.scope === 'dept' && t.departmentId === user.departmentId : true
        case 'mine':
          // 「我的待办」只算认领过的; 别人派给我但还没确认的, 在「待认领」里
          return t.ownerId === user.id
        case 'assigned':
          // 「我派发的」= 我建的任务里, **执行人不是我自己**的那些 ——
          // 派给自己干的活属于「我的待办」, 不该在这儿再算一遍
          return t.creatorId === user.id && t.ownerId !== user.id
        case 'group':
          return (

            ((t.scope === 'group' && !!t.groupId && myGroups.includes(t.groupId)) ||
              inMyGroup(t.ownerId) ||
              inMyGroup(t.assigneeId) ||
              inMyGroup(t.creatorId))
          )
        case 'pool':
          // 待认领 = 我能领/能抢的: 派给我示例公司有限公司的 + 我所在小组/部门的。
          // 别人名下的示例公司有限公司任务、别的小组/部门的任务, 这里看不到
          return (
            !t.assignmentPending &&
            !t.importSource?.group &&
            t.status === 'open' &&
            !t.ownerId &&
            !(t.recurrence && !t.templateId) &&
            (t.scope === 'user'
              ? t.assigneeId === user.id
              : t.scope === 'group'
                ? !!t.groupId && myGroups.includes(t.groupId)
                : !!t.departmentId && t.departmentId === user.departmentId)
          )
        case 'done':
          return t.status === 'done'
        default:
          return true
      }
    }
    return new Set(tasks.filter(ok).map((t) => t.id))
  }, [tasks, view, user, org.users])

  const personOptions = useMemo(() => [
    { value: 'all', label: '全部执行人' },
    ...groupWorkByPerson(tasks.filter(task => matched.has(task.id)), org).map(group => ({
      value: group.key, label: `${group.label} · ${group.tasks.length} 项`,
    })),
  ], [tasks, matched, org])

  const passSecondary = (t: Task) => {
    if (person !== 'all' && (executorId(t) || '__unassigned__') !== person) return false
    if (prio !== 'all' && t.priority !== prio) return false
    // 每个分类维度各自过滤 (维度是动态的, 有几个就查几个)
    for (const d of dims) {
      const want = dimSel[d.id]
      if (want && want !== 'all' && dimValueOf(t, d.id) !== want) return false
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !t.note.toLowerCase().includes(q)) return false
    }
    if (time === 'all') return true
    if (!t.dueAt) return time !== 'overdue'
    const due = new Date(t.dueAt).getTime()
    const 示例公司有限公司 = Date.示例公司有限公司()
    if (time === 'today') return new Date(t.dueAt).toDateString() === new Date().toDateString()
    if (time === 'week') return due >= 示例公司有限公司 - 86400000 && due <= 示例公司有限公司 + WEEK_MS
    return t.status !== 'done' && isDueOverdue(t.dueAt)
  }

  /** 「已完成」视图本来就只看完成的任务, 那个视图里不受开关影响 */
  const hideDone = !showDone && view !== 'done'

  /**
   * 列表以**主任务为主**: 任何子任务被列出来, 它头顶的主任务一定要跟着出来,
   * 并且保持「主任务 → 子任务」的缩进关系 (不能把子任务孤零零地提成一条主任务)。
   *   1) 先看哪些行真的命中了这个视图 (matched) 且过了搜索/筛选 (passSecondary);
   *   2) 再把它们的**祖先链**整条加进来 —— 这些祖先行只当上下文, 不参与筛选,
   *      否则一搜索就会把子树切断;
   *   3) 父任务自己没命中、子树里也没人命中时不会进来, 所以不会出现空的主任务行。
   */
  const renderIds = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const out = new Set<string>()
    for (const t of tasks) {
      if (t.importSource?.group || hideDone && t.status === 'done') continue
      if (!matched.has(t.id) || !passSecondary(t)) continue
      out.add(t.id)
      let cur: Task | undefined = t
      for (let i = 0; cur?.parentId && i < 20; i++) {
        const p = byId.get(cur.parentId)
        if (!p) break
        out.add(p.id)
        cur = p
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, matched, query, time, prio, dimSel, hideDone, person])

  /** 负责人(管理员)不受下面这套「谁看得到哪些子任务」的限制 —— 他要看全局 */
  const isBoss = user?.role === 'admin'

  /** 这一行跟我有关吗 (我负责 / 派给我 / 我派的) —— 别人的主任务下面, 只有这种行会露出来 */
  const myRow = (t: Task) => !!user && (t.ownerId === user.id || t.assigneeId === user.id || t.creatorId === user.id)

  /**
   * 我的任务的**祖先链**: 只是为了把「执行人是我」的子任务挂回到主任务下面,
   * 所以这些中间层要显示出来 (别人负责的那些细节仍然不显示)。
   */
  const chainIds = useMemo(() => {
    if (!user) return new Set<string>()
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const out = new Set<string>()
    for (const t of tasks) {
      if (t.ownerId !== user.id) continue
      let cur: Task | undefined = t
      for (let i = 0; cur?.parentId && i < 20; i++) {
        const p = byId.get(cur.parentId)
        if (!p) break
        out.add(p.id)
        cur = p
      }
    }
    return out
  }, [tasks, user])

  /**
   * 「我负责的任务」下面的整棵子树。
   * 规则 (主任务 / 子任务 / 人 三者关系):
   *   · 主任务的执行人是我 → 它下面的**所有**子任务我都能看到 (包括别人在执行的那些)
   *   · 主任务的执行人是别人 → 我只看到其中**执行人是我**的子任务
   * 子任务永远挂在主任务下面, 区别只在于看不看得到别人的那几条。
   */
  const mySubtrees = useMemo(() => {
    if (!user) return new Set<string>()
    const kids = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.parentId) continue
      if (!kids.has(t.parentId)) kids.set(t.parentId, [])
      kids.get(t.parentId)!.push(t)
    }
    const out = new Set<string>()
    const stack = tasks.filter((t) => t.ownerId === user.id)
    while (stack.length) {
      const cur = stack.pop()!
      for (const c of kids.get(cur.id) || []) {
        if (out.has(c.id)) continue
        out.add(c.id)
        stack.push(c)
      }
    }
    return out
  }, [tasks, user])

  const roots = useMemo(() => {
    return tasks
      .filter((t) => renderIds.has(t.id) && (!t.parentId || !renderIds.has(t.parentId)))
      .filter((t) => !hideDone || t.status !== 'done')
      .sort(cmp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, renderIds, hideDone, cmp])

  // 分组板块 (列表视图分节 / 甘特视图分泳道共用同一套口径)
  const sections = useMemo(() => buildSections(roots, groupBy, org), [roots, groupBy, org])

  /**
   * 上层最近的截止日 —— 从**完整任务表**往上找, 不是只看当前视图。
   * 「我的待办 / 待认领」这类视图里, 子任务的父任务根本不显示, 于是它就成了一棵树的根;
   * 这时候仍然要能显示出「发布人给父任务设的那个日期」(也就是默认日期)。
   */
  const ancestorDueOf = (t: Task): string | null => {
    let cur = t
    const seen = new Set<string>([t.id])
    for (let i = 0; cur.parentId && i < 20; i++) {
      if (seen.has(cur.parentId)) break
      seen.add(cur.parentId)
      const p = tasks.find((x) => x.id === cur.parentId)
      if (!p) break
      if (p.dueAt) return p.dueAt
      cur = p
    }
    return null
  }

  /**
   * 某条子任务在这一行下面显不显示 (主任务 / 子任务 / 人 的关系):
   *   · 负责人(管理员): 全看
   *   · 这条主任务的执行人是我 → 它下面**所有**子任务都看 (包括别人在执行的那些)
   *   · 主任务是别人的 → 只看执行人是我的那些子任务, 以及我负责那条往下的
   *   · 中间层只为了把「我的任务」挂到树上而显示 (chainIds)
   * 另外还要过这个视图/搜索的过滤 (renderIds)。
   */
  const showChild = (parent: Task, c: Task) => {
    if (!user) return false
    // Explicit filters apply even within a member's own subtree.
    if (!renderIds.has(c.id)) return false
    if (person !== 'all') return true // The API already scoped this snapshot to the account.
    // The API has already scoped these tasks to the manager's permissions.
    // Managers can review colleagues' matching children in every board view.
    if (isBoss) return renderIds.has(c.id)
    // 我负责的那棵树: 下面的子任务全看 (包括别人在执行的那些)
    if (parent.ownerId === user.id || mySubtrees.has(parent.id)) return true
    // 别人的树: 只看跟我有关的那几条 (我负责的 / 派给我的 / 我派的)
    if (renderIds.has(c.id) && (myRow(c) || mySubtrees.has(c.id))) return true
    // 纯粹为了让上面这些行能挂到树上而显示的中间层
    return renderIds.has(c.id) && chainIds.has(c.id)
  }

  /** 把树拍平成一行行 (表格要共用同一套列宽, 所以不能用嵌套 DOM) */
  const buildItems = (rootTasks: Task[]): ListItem[] => {
    const items: ListItem[] = []
    // inheritedDue: **只看上层**最近的截止日 (不含自己) —— 它有两层用途:
    //   · 子任务自己没设日期时, 行首的到期渐变跟它走
    //   · 子任务日期选择的上限 (选完日期后, 上限仍然是主任务的截止日, 不会缩成自己的)
    let firstRoot = true
    const walk = (list: Task[], depth: number, parentId: string | null, inheritedDue: string | null) => {
      for (const t of list) {
        if (hideDone && t.status === 'done') continue
        // 顶层但其实是子任务 (父任务不在当前视图里) → 默认日期仍然按完整任务表算
        const up = inheritedDue ?? (depth === 0 ? ancestorDueOf(t) : null)
        const due = t.dueAt || up // 往下传的是「生效截止日」= 自己的 || 上层的
        // 行与行之间留一个投放点: 放到这儿 = 变成这一层的同级 (level=null 就是主任务)
        items.push({ type: 'gap', level: parentId, key: `gap-${parentId ?? 'root'}-${t.id}` })
        // 主任务之间拉一条细高亮线 (第一个不画; 主任务与子任务之间、子任务之间都不画)
        if (depth === 0) {
          if (!firstRoot) items.push({ type: 'line', key: `line-${t.id}` })
          firstRoot = false
        }
        if (edit?.kind === 'edit' && edit.task.id === t.id) {
          items.push({ type: 'form', state: edit })
        } else {
          items.push({ type: 'row', task: t, depth, due: up })
          if (edit?.kind === 'sub' && edit.parent.id === t.id) items.push({ type: 'form', state: edit })
          if (edit?.kind === 'below' && edit.after.id === t.id) items.push({ type: 'form', state: edit })
        }
        // 子任务同样只走「这个视图要显示的那批」: 命中的行 + 它们在上下文里的祖先
        if (!collapsed.has(t.id)) {
          walk(
            childrenOf(t.id).filter((c) => showChild(t, c)),
            depth + 1,
            t.id,
            due,
          )
        }
      }
      if (list.length) items.push({ type: 'gap', level: parentId, key: `gap-${parentId ?? 'root'}-end` })
    }
    walk(rootTasks, 0, null, null)
    return items
  }

  const openCount = (list: Task[]) => list.filter((t) => t.status === 'open').length

  /** 正在拖的任务 / 正悬停的目标行 */
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)

  /** 目标是不是拖拽任务自己或它的子孙 (那样会成环) */
  const isSelfOrDescendant = (dragTaskId: string, targetId: string) => {
    let cur: Task | undefined | null = tasks.find((t) => t.id === targetId)
    for (let i = 0; cur && i < 8; i++) {
      if (cur.id === dragTaskId) return true
      cur = cur.parentId ? tasks.find((t) => t.id === cur!.parentId) : null
    }
    return false
  }

  /** 把任务挪到某个父任务下面 (parentId=null 就是变成主任务) */
  const moveTask = async (id: string, parentId: string | null) => {
    const t = tasks.find((x) => x.id === id)
    if (!t || t.parentId === parentId) return
    try {
      await updateTask(id, { parentId } as any)
      pushToast({
        title: '已移动任务',
        body: parentId ? '已成为该任务的子任务' : '已移到主任务层',
        kind: 'info',
      })
    } catch (e: any) {
      pushToast({ title: '移动失败', body: e?.message || String(e), kind: 'error' })
    }
  }

  /**
   * 复制任务: 内容照抄, 但状态回到「未开始」、不带周期规则。
   * 因为排序里同档是按创建时间升序, 复制出来的这条会正好落在原任务下面。
   */
  const duplicateTask = async (task: Task) => {
    try {
      await createTask({
        parentId: task.parentId,
        title: task.title,
        note: task.note,
        category: task.category,
        type: task.type,
        priority: task.priority,
        scope: task.scope,
        assigneeId: task.scope === 'user' ? task.assigneeId : null,
        groupId: task.scope === 'group' ? task.groupId : null,
        departmentId: task.scope === 'dept' ? task.departmentId : null,
        dueAt: task.dueAt,
        remindAt: task.remindAt,
        recurrence: null,
      })
      pushToast({ title: '已复制一条任务', body: '就在原任务下面', kind: 'info' })
    } catch (e: any) {
      pushToast({ title: '复制失败', body: e?.message || String(e), kind: 'error' })
    }
  }

  /**
   * 当日艾维利: 生成一段可以直接发出去的文本。
   *
   * 结构固定:
   *   今日艾维利          ← 第一行
   *   ✅ 主任务 进度100%  ← 今天完成的 / 截止日是今天的
   *     - 🚶‍♂️ 子任务 进度40%
   *   示例公司有限公司艾维利          ← 紧接在下面
   *   主任务              ← 截止日是明天的, 只写名字 (不带符号、不带百分比)
   *     - 子任务
   *
   * 细节:
   *   · 「截止日」按**实际生效的那个**算: 子任务自己没设日期时跟父任务 (和列表里那列
   *     显示的虚线日期一个口径), 所以父任务排明天、子任务没设日期的, 也会进示例公司有限公司艾维利
   *   · 同一条件只记一次 (今天完成、又是今天到期的, 只出一行)
   *   · 子任务前面**一定**先出现它主任务的名字, 哪怕主任务自己不是今天 —— 不然子任务孤零零的
   *   · 符号按进度给: 完成 ✅ / 有进度没完成 🚶‍♂️ / 一点没动 ❌ (不要 ing / ✔)
   */
  const buildIvyText = () => {
    const dayAt = (offset: number) => {
      const d = startOfDay(new Date())
      d.setDate(d.getDate() + offset)
      return d.getTime()
    }
    const today = dayAt(0)
    const tomorrow = dayAt(1)
    const isDay = (iso: string | null | undefined, day: number) => !!iso && startOfDay(new Date(iso)).getTime() === day
    const isRule = (t: Task) => !!t.recurrence && !t.templateId

    const emojiOf = (t: Task) => (t.status === 'done' ? '✅' : (t.progress || 0) > 0 ? '🚶‍♂️' : '❌')
    const pctOf = (t: Task) => (t.status === 'done' ? 100 : Math.max(0, Math.min(100, Math.round(t.progress || 0))))
    /** withMark=false 时只写名字 (示例公司有限公司那段) */
    const line = (t: Task, indent: boolean, withMark: boolean) =>
      withMark
        ? `${indent ? '  - ' : ''}${emojiOf(t)} ${t.title} 进度${pctOf(t)}%`
        : `${indent ? '  - ' : ''}${t.title}`

    /** 任务实际生效的截止日: 自己设了就用自己那个, 没设就跟上层 (和列表里的虚线日期同口径) */
    const effectiveDue = (t: Task, cap: string | null) => t.dueAt || cap

    /** 一段时间 (今天 / 明天) 的一整段: 标题 + 命中的行 */
    const section = (title: string, day: number, withMark: boolean, withDone: boolean) => {
      /** 命中 = 自己今天完成的 (只有今日段看这个) 或者 实际生效的截止日正好是那一天 */
      const hit = (t: Task, due: string | null) =>
        (withDone && t.status === 'done' && isDay(t.doneAt, day)) || isDay(due, day)

      const out: string[] = [title]
      for (const root of roots) {
        if (isRule(root)) continue
        const kids: string[] = []
        // 顺着树往下走, 把「实际生效的截止日」一层层传下去 ——
        // 子任务自己没设日期, 就跟着父任务那个日期 (和列表里虚线日期一个口径)
        const walk = (parent: Task, cap: string | null) => {
          for (const c of childrenOf(parent.id)) {
            if (isRule(c)) continue
            const due = effectiveDue(c, cap)
            if (hit(c, due)) kids.push(line(c, true, withMark))
            walk(c, due)
          }
        }
        walk(root, effectiveDue(root, null))
        // 主任务自己命中, 或者它下面有子任务命中 —— 两种都要先把主任务这行写出来
        if (!hit(root, effectiveDue(root, null)) && !kids.length) continue
        out.push(line(root, false, withMark))
        out.push(...kids)
      }
      return out
    }

    const todayLines = section('今日艾维利', today, true, true)
    const tomorrowLines = section('示例公司有限公司艾维利', tomorrow, false, false)

    // 两段之间空一行 (每段自己的第一行就是标题)
    const hasToday = todayLines.length > 1
    const hasTomorrow = tomorrowLines.length > 1
    if (!hasToday && !hasTomorrow) {
      pushToast({ title: '今天没有可记的', body: '今天没有完成或到期的任务, 明天也没有排期。', kind: 'info' })
      return
    }
    const out =
      hasToday && hasTomorrow
        ? [...todayLines, '', ...tomorrowLines]
        : hasToday
          ? todayLines
          : tomorrowLines
    const generated = out.join('\n')
    setIvyText(generated)
    // 顺手把当天这段存进历史 (一天一条, 同一天再生成就覆盖) —— 这样往上翻能追溯过去
    void saveIvy(generated).catch(() => undefined)
  }

  /**
   * 导出表格: 把「当前视图里看到的任务」里, 截止日落在所选区间内的整理成 CSV。
   *   今日工作 = 今天到期或已经逾期
   *   本周工作 = 本周一 ~ 周日
   *   本期工作 = 当前月份
   */
  const exportWork = (scope: 'today' | 'week' | 'month') => {
    const 示例公司有限公司 = new Date()
    const today = startOfDay(示例公司有限公司)
    const from = scope === 'today' ? today : scope === 'week' ? startOfWeek(today) : new Date(today.getFullYear(), today.getMonth(), 1)
    const to =
      scope === 'today'
        ? endOfDay(today)
        : scope === 'week'
          ? endOfWeek(today)
          : endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0))

    // 和列表同一套口径: 当前视图 + 搜索/筛选 + 「隐藏已完成」, 沿着树往下走
    const picked: Array<{ task: Task; depth: number; due: string }> = []
    const walk = (list: Task[], depth: number, cap: string | null) => {
      for (const t of list) {
        if (hideDone && t.status === 'done') continue
        const due = t.dueAt || cap
        const at = due ? new Date(due).getTime() : null
        if (at !== null && at >= from.getTime() && at <= to.getTime()) picked.push({ task: t, depth, due: due! })
        walk(childrenOf(t.id), depth + 1, due)
      }
    }
    walk(roots, 0, null)

    const nameOf = (id: string | null) => org.users.find((u) => u.id === id)?.name || ''
    const rows: string[][] = [EXPORT_HEADERS.map((h) => (h === '板块' ? dimNames(org).cat : h === '类型' ? dimNames(org).type : h))]
    for (const { task, depth, due } of picked) {
      const kids = childrenOf(task.id)
      rows.push([
        '　'.repeat(depth) + task.title,
        String(depth + 1),
        task.category || '',
        task.type || '',
        PRIORITIES.find((p) => p.key === task.priority)?.label || task.priority,
        task.progress ? `${task.progress}%` : '',
        task.status === 'done' ? '已完成' : '进行中',
        nameOf(task.creatorId),
        nameOf(task.ownerId || task.assigneeId),
        ymd(new Date(due)),
        task.doneAt ? ymd(new Date(task.doneAt)) : '',
        ymd(new Date(task.createdAt)),
        kids.length ? `${kids.filter((c) => c.status === 'done').length}/${kids.length}` : '',
        task.note.trim().replace(/\n/g, ' '),
      ])
    }

    const scopeLabel = scope === 'today' ? '今日工作' : scope === 'week' ? '本周工作' : '本期工作'
    if (rows.length === 1) {
      pushToast({ title: `${scopeLabel}: 没有可导出的任务`, body: '这个时间段内没有排期的任务。', kind: 'info' })
      return
    }
    downloadCsv(`部门待办-${scopeLabel}-${ymd(示例公司有限公司)}.csv`, rows)
    pushToast({ title: `已导出 ${rows.length - 1} 条${scopeLabel}`, body: `部门待办-${scopeLabel}-${ymd(示例公司有限公司)}.csv`, kind: 'info' })
  }
  /** 当前视图里已完成的任务数 —— 开着的时候不用显示, 关了才提示「还有几条」 */
  const doneCount = useMemo(
    () => tasks.filter((t) => matched.has(t.id) && t.status === 'done' && passSecondary(t)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, matched, query, time, prio, dimSel],
  )

  /** 一行行的渲染 (单层分组和两级分组共用同一套) */
  const renderItem = (item: ListItem) =>
    item.type === 'gap' ? (
      <div
        key={item.key}
        className={`trow-gap${dragId ? ' is-live' : ''}`}
        onDragOver={(e) => {
          if (!dragId) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropOn(`gap:${item.key}`)
        }}
        onDragLeave={() => setDropOn((cur) => (cur === `gap:${item.key}` ? null : cur))}
        onDrop={(e) => {
          e.preventDefault()
          const id = dragId
          setDragId(null)
          setDropOn(null)
          if (id) void moveTask(id, item.level)
        }}
      />
    ) : item.type === 'line' ? (
      <div key={item.key} className="trow-line" aria-hidden="true" />
    ) : item.type === 'form' ? (
      <TaskRowForm
        key={`form-${item.state.kind}`}
        task={item.state.kind === 'edit' ? item.state.task : null}
        parent={item.state.kind === 'sub' ? item.state.parent : null}
        after={item.state.kind === 'below' ? item.state.after : null}
        onClose={closeEdit}
      />
    ) : (
      <div
        key={item.task.id}
        className={`dnd-row${dropOn === `row:${item.task.id}` ? ' is-drop-target' : ''}${
          dragId === item.task.id ? ' is-dragging' : ''
        }`}
        onDragOver={(e) => {
          if (!dragId) return
          if (isSelfOrDescendant(dragId, item.task.id)) return // 不能拖到自己或子孙上
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropOn(`row:${item.task.id}`)
        }}
        onDragLeave={() => setDropOn((cur) => (cur === `row:${item.task.id}` ? null : cur))}
        onDrop={(e) => {
          e.preventDefault()
          const id = dragId
          setDragId(null)
          setDropOn(null)
          if (id && !isSelfOrDescendant(id, item.task.id)) void moveTask(id, item.task.id)
        }}
      >
      <TaskRow
        task={item.task}
        depth={item.depth}
        ancestorDueAt={item.due}
        childTotal={childrenOf(item.task.id).length}
        childDone={childrenOf(item.task.id).filter((c) => c.status === 'done').length}
        hasChildren={childrenOf(item.task.id).length > 0}
        expanded={!collapsed.has(item.task.id)}
        onToggleExpand={() =>
          setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(item.task.id)) next.delete(item.task.id)
            else next.add(item.task.id)
            return next
          })
        }
        onOpenFullForm={() => setEdit({ kind: 'edit', task: item.task })}
        onAddSubtask={() => {
          setCollapsed((prev) => {
            const next = new Set(prev)
            next.delete(item.task.id)
            return next
          })
          setEdit({ kind: 'sub', parent: item.task })
        }}
        onInsertBelow={() => setEdit({ kind: 'below', after: item.task })}
        onDuplicate={() => void duplicateTask(item.task)}
        canDrag={canEditTask(item.task, user)}
        onDragStart={() => setDragId(item.task.id)}
        onDragEnd={() => {
          setDragId(null)
          setDropOn(null)
        }}
      />
      </div>
    )

  const closeEdit = () => setEdit(null)

  const current = BOARD_VIEWS.find((v) => v.key === view)!
  // 「小组待办」的副标题带上小组负责人, 一眼知道这组的头是谁
  const myGroups = org.groups.filter((g) => (user?.groupIds || []).includes(g.id))
  const subtitle =
    view === 'group' && myGroups.length
      ? `我所在小组: ${myGroups
          .map((g) => {
            const leader = org.users.find((u) => u.id === g.leaderId)
            return `${g.name}${leader ? `(负责人 ${leader.name})` : ''}`
          })
          .join(' · ')}`
      : current.hint

  /**
   * 「部门待办」卡上的数字。
   * 超级管理员拿到的数据里本来就含其他部门, 所以这里按部门自己数; 普通成员的数据
   * 服务端已经按部门隔离过, 直接数顶层未完成即可 (= 服务端的 total)。
   */
  const deptCount = useMemo(() => {
    const isRule = (t: Task) => !!t.recurrence && !t.templateId
    const summaryIds = new Set(tasks.filter(t => t.importSource?.group).map(t => t.id))
    const topOpen = tasks.filter((t) => !t.importSource?.group && (!t.parentId || summaryIds.has(t.parentId)) && t.status === 'open' && !isRule(t))
    if (user?.role !== 'admin') return topOpen.length
    return topOpen.filter((t) => t.scope === 'dept' && t.departmentId === user.departmentId).length
  }, [tasks, user])

  // 顶栏的「导出表格」按钮要调这里的逻辑 (按当前视图与筛选导出), 注册过去
  useRegisterBoardActions({ exportWork }, [exportWork])

  // A statistic opens its complete result set, without stale search/filters or collapsed ancestors.
  const selectStat = (nextView: typeof view, nextTime: TimeFilter = 'all') => {
    setView(nextView)
    setTime(nextTime)
    setQuery('')
    setPerson('all')
    setPrio('all')
    setDimSel({})
    setShowDone(false)
    setCollapsed(new Set())
  }
  const overview = user?.role === 'admin' ? 'all' : 'dept'
  const activeStat = (key: typeof view) => view === key && time === 'all'

  return (
    <section className="board" style={colVars}>
      {/* 统计卡就是主导航 —— 顶部那条视图导航已经并到这里了 */}
      <div className="stat-row" id={overviewId} hidden={!overviewExpanded}>
        {/* 超级管理员多一个「全部待办」: 跨部门看全部 */}
        {user?.role === 'admin' && (
          <Stat label="全部待办" value={summary?.total ?? 0} active={activeStat('all')} onClick={() => selectStat('all')} />
        )}
        {/* 顺序: 我的待办 → 小组待办 → 部门待办 → 我派发的 → 待领任务 → 逾期任务 → 今日到期 → 已完成 */}
        <Stat label="我的待办" value={summary?.mine ?? 0} active={activeStat('mine')} onClick={() => selectStat('mine')} />
        <Stat
          label="小组待办"
          value={summary?.group ?? 0}
          active={activeStat('group')}
          title={view === 'group' ? subtitle : undefined}
          onClick={() => selectStat('group')}
        />
        <Stat label="部门待办" value={deptCount} active={activeStat('dept')} onClick={() => selectStat('dept')} />
        <Stat
          label="我派发的"
          value={summary?.createdByMe ?? 0}
          active={activeStat('assigned')}
          onClick={() => selectStat('assigned')}
        />
        <Stat label="待领任务" value={summary?.pool ?? 0} active={activeStat('pool')} tone="warn" onClick={() => selectStat('pool')} />
        <Stat label="逾期任务" value={summary?.overdue ?? 0} active={view === overview && time === 'overdue'} tone={summary?.overdue ? 'danger' : undefined} onClick={() => selectStat(overview, 'overdue')} />
        <Stat label="今日到期" value={summary?.dueToday ?? 0} active={view === overview && time === 'today'} onClick={() => selectStat(overview, 'today')} />
        <Stat label="已完成" value={summary?.done ?? 0} active={activeStat('done')} onClick={() => selectStat('done')} />
      </div>

      <div className="filter-bar is-primary">
        <div className="seg sm">
          <button className={`seg-btn${chart ? '' : ' is-on'}`} onClick={() => setChart(false)}>
            列表
          </button>
          <button className={`seg-btn${chart ? ' is-on' : ''}`} onClick={() => setChart(true)}>
            甘特
          </button>
        </div>
        <label className="filter-search">
          <IconSearch size={14} />
          <input placeholder="搜索任务" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <Select value={person} onChange={setPerson} options={personOptions} ariaLabel="筛选执行人" searchLabel="搜索执行人" popWidth={240} className="person-filter" />
        {person !== 'all' && <button className="btn ghost sm person-reset" onClick={() => setPerson('all')} aria-label="清除执行人筛选">清除人员</button>}
        <button className="btn ghost sm board-disclosure" aria-label={overviewExpanded ? '收起概览' : '展开概览'} aria-expanded={overviewExpanded} aria-controls={overviewId} onClick={toggleOverview}>概览 {overviewExpanded ? '⌃' : '⌄'}</button>
        <button className="btn ghost sm board-disclosure" aria-label={filtersExpanded ? '收起筛选条件' : '展开筛选条件'} aria-expanded={filtersExpanded} aria-controls={filtersId} onClick={toggleFilters}>筛选 {filtersExpanded ? '⌃' : '⌄'}</button>
        <button
          className="icon-btn lg"
          onClick={buildIvyText}
          title="当日艾维利: 把「今天完成的」+「截止日是今天的」整理成一段文本 (今日 + 示例公司有限公司)"
          aria-label="当日艾维利"
        >
          <IconList size={16} />
        </button>
        <button
          className="btn primary icon-round filter-new"
          onClick={() => setEdit({ kind: 'create' })}
          title="新建 / 派发任务"
          aria-label="新建 / 派发任务"
        >
          <IconPlus size={17} />
        </button>
      </div>

      {/* 第二行: 筛选条件 (时间 / 优先级 / 板块 / 类型 / 分组 / 已完成 / 排序) */}
      <div className="filter-bar is-filters" id={filtersId} hidden={!filtersExpanded}>
        <div className="seg sm">
          {(['all', 'today', 'week', 'overdue'] as TimeFilter[]).map((t) => (
            <button key={t} className={`seg-btn${time === t ? ' is-on' : ''}`} onClick={() => setTime(t)}>
              {t === 'all' ? '全部时间' : t === 'today' ? '今天' : t === 'week' ? '本周' : '已逾期'}
            </button>
          ))}
        </div>
        <Select
          value={prio}
          popWidth={150}
          onChange={setPrio}
          options={[
            { value: 'all', label: '全部优先级' },
            ...PRIORITIES.map((p) => ({ value: p.key, label: p.label, color: priorityMeta(p.key).color })),
          ]}
        />
        <Select
          value={cat}
          popWidth={150}
          onChange={setCat}
          options={[{ value: 'all', label: `全部${dimNames(org).cat}` }, ...allCategories(org).map((c) => ({ value: c, label: c }))]}
        />
        <Select
          value={taskType}
          popWidth={150}
          onChange={setTaskType}
          options={[{ value: 'all', label: `全部${dimNames(org).type}` }, ...allTypes(org).map((c) => ({ value: c, label: c }))]}
        />
        <Select
          value={groupBy}
          popWidth={160}
          onChange={(v) => setGroupBy(v as GroupBy)}
          options={[
            { value: 'none', label: '不分组' },
            { value: 'owner', label: '按负责人' },
            { value: 'group', label: '按小组' },
            { value: 'cat', label: `按${dimNames(org).cat}` },
            { value: 'type', label: `按${dimNames(org).type}` },
            { value: 'cattype', label: `按${dimNames(org).cat} + ${dimNames(org).type}` },
          ]}
        />
        <button
          className={`btn ghost sm${!showDone ? ' is-on' : ''}`}
          title={showDone ? '点一下隐藏已完成的任务' : '点一下显示已完成的任务'}
          role="checkbox"
          aria-checked={!showDone}
          onClick={() => setShowDone((v) => !v)}
        >
          {!showDone && <IconCheck size={13} />} 隐藏已完成
        </button>
        <Select
          value={sort}
          popWidth={190}
          onChange={(v) => setSort(v as SortKey)}
          options={SORT_OPTIONS}
        />
      </div>

      {chart ? (
        <div className="gantt-area">
          {edit && (edit.kind === 'create' || edit.kind === 'edit') && (
            <div className="gantt-form-wrap">
              <TaskRowForm task={edit.kind === 'edit' ? edit.task : null} onClose={closeEdit} />
            </div>
          )}
          <GanttView
            sections={sections}
            tasks={tasks.filter(t => renderIds.has(t.id))}
            org={org}
            hideDone={hideDone}
            onToggleDone={view === 'done' ? undefined : () => setShowDone(value => !value)}
            onOpenTask={(t) => select(t.id)}
          />
        </div>
      ) : (
      <div className={`task-list${dragId ? ' is-dragging' : ''}`}>
        <div className="list-head">
          <span className="lead-head" />
          {(['title', 'prio', 'prog', 'assign', 'owner', 'due'] as string[])
            .concat(dims.map((d) => colKeyOf(d.id)), ['done', 'created'])
            .map((key) => (
            <span className={`col-head${key === 'title' ? ' col-head--title' : ''}`} key={key}>
              {key.startsWith('dim:')
                ? dims.find((d) => d.id === key.slice(4))?.name || ''
                : COL_LABEL[key]}
              <i
                className="col-resizer"
                role="separator"
                aria-label={`拖动调整「${
                  key.startsWith('dim:') ? dims.find((d) => d.id === key.slice(4))?.name || '' : COL_LABEL[key]
                }」列宽`}
                title="按住拖动可调整列宽, 双击恢复默认"
                onPointerDown={(e) => startResize(key, e)}
                onDoubleClick={() => resetCol(key)}
              />
            </span>
          ))}
          <span />
          <span>子任务</span>
          <span />
        </div>

        {edit?.kind === 'create' && (
          <TaskRowForm onClose={closeEdit} />
        )}

        {loading && (
          <div className="board-loading">
            <span className="spin" /> 加载中…
          </div>
        )}

        {!loading && roots.length === 0 && !edit && (
          <div className="empty">
            <div className="empty-icon">
              <IconPlus size={20} />
            </div>
            <h3>{view === 'pool' ? '没有待认领的任务' : '这个视图是空的'}</h3>
            <p>
              {view === 'mine'
                ? '还没有指派给你的任务 —— 也可能都被你清完了。'
                : '新建一条任务派给同事, 也可以右键某条任务在它下面加一条。'}
            </p>
          </div>
        )}

        {sections.map((sec) => (
          <div key={sec.key} className="board-section">
            {sec.label && (
              <div className="section-head">
                <span>{sec.label}</span>
                <span className="section-count">{openCount(sec.tasks)}</span>
              </div>
            )}
            {sec.subs
              ? sec.subs.map((sub) => (
                  <div key={sub.key} className="board-subsection">
                    <div className="section-head is-sub">
                      <span>{sub.label}</span>
                      <span className="section-count">{openCount(sub.tasks)}</span>
                    </div>
                    {buildItems(sub.tasks).map(renderItem)}
                  </div>
                ))
              : buildItems(sec.tasks).map(renderItem)}
          </div>
        ))}
      </div>
      )}
      {ivyText !== null && <DailyIvyPanel text={ivyText} onClose={() => setIvyText(null)} />}
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
  active,
  title,
  onClick,
}: {
  label: string
  value: number
  tone?: 'danger' | 'warn'
  active?: boolean
  /** 悬停提示 (比如「小组待办」那张卡上写着组长是谁) */
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      className={`stat${active ? ' is-active' : ''}${tone ? ` is-${tone}` : ''}`}
      title={title}
      onClick={onClick}
      aria-pressed={!!active}
      disabled={!onClick}
    >
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </button>
  )
}


import { useEffect, useMemo, useRef, useState } from 'react'
import { isDueOverdue } from '../domain/dates'
import { taskSpans } from '../domain/gantt'
import type { Section } from '../domain/grouping'
import { dimNames, PRIORITIES, priorityMeta, type Org, type Task } from '../domain/types'
import { executorName, groupWorkByPerson, needsProgressReview, workloadStats } from '../domain/workload'

/** 一天最少多少像素 (再窄就不给缩了, 否则一条任务窄得看不清) */
const MIN_DAY_W = 18
/** 一天最多多少像素 (滚轮放大的上限) */
const MAX_DAY_W = 96
/** 滚轮一次缩放的比例 */
const ZOOM_STEP = 0.12
/** 左侧名称列宽度 (横向滚动时吸边) */
const DEFAULT_SIDE_W = 示例品牌
const DAY_MS = 86400000
const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日']

const toDay = (v: string | number) => {
  const d = new Date(v)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
/** 某个月的 1 号 00:00 */
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getTime()
/** 这个月有多少天, 以及每天 00:00 的时间戳 */
const monthDays = (monthStartMs: number) => {
  const d = new Date(monthStartMs)
  const y = d.getFullYear()
  const m = d.getMonth()
  const n = new Date(y, m + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => new Date(y, m, i + 1).getTime())
}
const dayText = (ms: number) => {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 甘特视图 —— 按日历看工作安排。
 * 泳道跟着「分组」下拉走 (按人 / 按小组 / 按板块…), 所以切到「我的待办」就是自己的排期。
 * 一条任务的时间跨度 = 它子树里最早的截止日 → 它自己的截止日 (主任务因此会横跨它的子任务)。
 */
export function GanttView({
  sections,
  tasks,
  org,
  hideDone = false,
  onToggleDone,
  onOpenTask,
}: {
  sections: Section[]
  tasks: Task[]
  org: Org
  /** 隐藏已完成时, 完成的任务连同它的子树都不画 */
  hideDone?: boolean
  onToggleDone?: () => void
  onOpenTask: (task: Task) => void
}) {
  /** 当前看的月份 (默认当月 1 号) */
  const [anchor, setAnchor] = useState(() => monthStart(new Date()))
  /** 缩放倍数: 1 = 整月刚好铺满窗口 */
  const [zoom, setZoom] = useState(1)
  const [peopleMode, setPeopleMode] = useState(true)
  const [sideW, setSideW] = useState(DEFAULT_SIDE_W)
  /** 可用来画日历的宽度 (窗口去掉左侧名称列), 由 ResizeObserver 量 */
  const [trackW, setTrackW] = useState(900)
  const wrapRef = useRef<HTMLDivElement>(null)
  /** 鼠标停在任务条上时弹的详情气泡 */
  const [tip, setTip] = useState<{ task: Task; x: number; y: number } | null>(null)

  // 滚动 / 缩窗口就把气泡收掉, 免得它飘在错的位置
  useEffect(() => {
    if (!tip) return
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [tip])

  // 量一下日历区能有多宽 (整月铺满要用它)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const side = Math.min(DEFAULT_SIDE_W, Math.max(220, Math.round(el.clientWidth * .44)))
      setSideW(side)
      setTrackW(Math.max(240, el.clientWidth - side - 2))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /**
   * 滚轮缩放日期轴。
   *   在日期表头上滚 / 按住 ⌘(Ctrl) 在任意位置滚 → 缩放 (以光标下的那天为锚点)
   *   其它位置直接滚 → 保持正常的上下/左右滚动
   */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const onHead = !!(e.target as HTMLElement)?.closest?.('.gantt-head')
      if (!onHead && !(e.ctrlKey || e.metaKey || e.altKey)) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      const next = Math.min(4, Math.max(1, zoom * (1 + dir * ZOOM_STEP)))
      if (next === zoom) return
      // 让光标下的那天在缩放后还停在原来的位置
      const rect = el.getBoundingClientRect()
      const cursorInTrack = e.clientX - rect.left - sideW + el.scrollLeft
      const ratio = next / zoom
      const nextScroll = cursorInTrack * ratio - (e.clientX - rect.left - sideW)
      setZoom(next)
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, nextScroll)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, sideW])

  const showTip = (task: Task) => (e: React.MouseEvent | React.FocusEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTip({ task, x: r.left, y: r.top })
  }

  const days = useMemo(() => monthDays(anchor), [anchor])
  /** 整月刚好铺满窗口时一天多少像素 */
  const fitDayW = Math.max(MIN_DAY_W, trackW / days.length)

  /**
   * 每天占多宽。
   * 放大时**优先把「本周」那 7 天撑开**, 非本周的日子被压窄, 所以整月始终还能一眼看全;
   * 只有把其它日子压到最小宽度 (MIN_DAY_W) 之后, 再放大才会出现横向滚动。
   * 看的不是当月 (翻到别的月份) 时就没有「本周」, 这时按整条轴均匀缩放。
   */
  const cols = useMemo(() => {
    const calendarW = Math.max(trackW, days.length * MIN_DAY_W)
    const inWeek = days.map((ms) => {
      const d = new Date(ms)
      const w = (d.getDay() + 6) % 7 // 0=周一
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const monday = new Date(today)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      const t = d.getTime()
      return t >= monday.getTime() && t <= sunday.getTime()
    })
    const nWeek = inWeek.filter(Boolean).length
    const nOther = days.length - nWeek
    const uniform = nWeek === 0 || nOther === 0
    /** 一天最宽 MAX_DAY_W → 最大放大倍数 (到顶就不给再放了, 不会出现「滚了没反应」) */
    const maxZoom = Math.max(1, Math.min(4, MAX_DAY_W / fitDayW))
    const z = Math.min(zoom, maxZoom)
    let weekW: number
    let offW: number
    if (uniform) {
      weekW = offW = fitDayW * z
    } else {
      // 先把本周撑开, 其它日子平分剩下的; 但它们不能窄于 MIN_DAY_W,
      // 所以本周也会被这个下限反推着封顶 —— 结果永远是「整月仍然铺满, 只是本周更宽」
      const maxWeekW = (calendarW - nOther * MIN_DAY_W) / nWeek
      weekW = Math.max(fitDayW, Math.min(MAX_DAY_W, maxWeekW, fitDayW * z))
      offW = (calendarW - nWeek * weekW) / nOther
    }
    const widths = days.map((_, i) => (inWeek[i] ? weekW : offW))
    const lefts: number[] = []
    let acc = 0
    for (const w of widths) {
      lefts.push(acc)
      acc += w
    }
    return { widths, lefts, total: acc, weekW, offW, uniform, inWeek }
  }, [days, fitDayW, trackW, zoom])
  const startMs = days[0]
  const endMs = startMs + days.length * DAY_MS
  const todayStart = toDay(Date.示例公司有限公司())
  const todayIdx = Math.round((todayStart - startMs) / DAY_MS)
  const idxOf = (ms: number) => Math.round((toDay(ms) - startMs) / DAY_MS)

  const kids = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const k = t.parentId || '__root__'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    }
    return map
  }, [tasks])

  /** 每棵子树的时间跨度 (子任务都定在同一天时, 主任务就是一根当天的小条) */
  const spans = useMemo(() => taskSpans(tasks), [tasks])
  const byId = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks])

  /** 泳道里真正要画的行 (窗口外的任务不进来) */
  const rowsOf = (list: Task[]) => {
    const out: Array<{ task: Task; depth: number }> = []
    const seen = new Set<string>()
    const walk = (l: Task[], depth: number) => {
      for (const t of l) {
        if (seen.has(t.id)) continue
        seen.add(t.id)
        if (hideDone && t.status === 'done') continue
        const s = spans.get(t.id)
        if (s && (s.end < startMs || s.start >= endMs)) continue
        out.push({ task: t, depth })
        walk(kids.get(t.id) || [], depth + 1)
      }
    }
    walk(list, 0)
    return out
  }

  const people = groupWorkByPerson(tasks.filter(task => {
    const span = spans.get(task.id)
    return !(hideDone && task.status === 'done') && (!span || span.end >= startMs && span.start < endMs)
  }), org)
  const chartSections = peopleMode ? people.map(person => ({ ...person, rows: person.tasks.map(task => ({ task, depth: 0 })) })) :
    sections.flatMap(section => section.subs ? section.subs.map(sub => ({ ...sub, label: `${section.label} / ${sub.label}`, rows: rowsOf(sub.tasks) })) : [{ ...section, rows: rowsOf(section.tasks) }])
  const visibleRows = chartSections.flatMap(section => section.rows)
  const summaryCount = visibleRows.filter(row => row.task.importSource?.group).length
  const total = visibleRows.length - summaryCount
  const unscheduled = visibleRows.filter(row => !row.task.importSource?.group && !spans.has(row.task.id)).length
  const monthLabel = `${new Date(anchor).getFullYear()}年${new Date(anchor).getMonth() + 1}月`
  const rangeLabel = `${dayText(startMs)} – ${dayText(endMs - DAY_MS)}`

  const shift = (months: number) => {
    const d = new Date(anchor)
    d.setMonth(d.getMonth() + months, 1)
    setAnchor(d.getTime())
  }

  return (
    <div className="gantt gantt-workload">
      <div className="gantt-toolbar">
        <div className="seg sm" aria-label="甘特分组方式">
          <button className={`seg-btn${peopleMode ? ' is-on' : ''}`} aria-pressed={peopleMode} onClick={() => setPeopleMode(true)}>按人员</button>
          <button className={`seg-btn${peopleMode ? '' : ' is-on'}`} aria-pressed={!peopleMode} onClick={() => setPeopleMode(false)}>按项目</button>
        </div>
        <div className="seg sm">
          <button className="seg-btn" onClick={() => shift(-1)} title="上一个月" aria-label="上一个月">
            ‹
          </button>
          <button
            className="seg-btn"
            onClick={() => {
              setAnchor(monthStart(new Date()))
              setZoom(1)
            }}
          >
            今天
          </button>
          <button className="seg-btn" onClick={() => shift(1)} title="下一个月" aria-label="下一个月">
            ›
          </button>
        </div>
        <span className="gantt-range">{monthLabel} · {rangeLabel}</span>
        <span className="gantt-total">{total - unscheduled} 项已排期{unscheduled ? ` · ${unscheduled} 项未排期` : ''}{summaryCount ? ` · ${summaryCount} 条汇总` : ''}</span>
        <button
          className="gantt-zoom"
          title="日期表头上滚轮可缩放 (优先放大本周); 点这里回到整月铺满"
          onClick={() => setZoom(1)}
        >
          缩放 {Math.round((cols.weekW / fitDayW) * 100)}%
        </button>
        {onToggleDone && <button className="btn ghost sm gantt-completed" role="checkbox" aria-label="包含已完成任务" aria-checked={!hideDone} onClick={onToggleDone}><span aria-hidden="true">{!hideDone ? '☑' : '☐'}</span> 包含已完成任务</button>}
      </div>
      <div className="gantt-legend"><span>当前筛选 · 本月及未排期任务</span><span>进度填充为已完成比例</span><span className="is-late">红色：逾期</span><span className="is-done">绿色：已完成</span><span>点击任务查看汇报详情</span></div>

      <div className="gantt-wrap" ref={wrapRef}>
        <div className="gantt-inner" style={{ width: sideW + cols.total }}>
          {/* 背景的日期竖格: 周末淡一点, 今天高亮 */}
          <div className="gantt-grid" style={{ left: sideW, width: cols.total }}>
            {days.map((ms, i) => (
              <div
                key={ms}
                className={`gantt-col${[5, 6].includes((new Date(ms).getDay() + 6) % 7) ? ' is-weekend' : ''}${
                  cols.inWeek[i] ? ' is-week' : ''
                }${i === todayIdx ? ' is-today' : ''}`}
                style={{ left: cols.lefts[i], width: cols.widths[i] }}
              />
            ))}
          </div>

          <div className="gantt-head">
            <div className="gantt-name is-head" style={{ width: sideW }}>
              任务 / 执行人 / 进度
            </div>
            {days.map((ms, i) => {
              const d = new Date(ms)
              const wd = (d.getDay() + 6) % 7
              return (
                <div key={ms} className={`gantt-day${wd >= 5 ? ' is-weekend' : ''}${i === todayIdx ? ' is-today' : ''}`} style={{ width: cols.widths[i] }}>
                  <b>
                    {/* 格子窄的时候不写「几月」, 免得换行把日期挤下去 (月份工具栏里有) */}
                    {cols.widths[i] >= 30 && (i === 0 || d.getDate() === 1) ? `${d.getMonth() + 1}月` : ''}
                    {d.getDate()}
                  </b>
                  <span>{WEEKDAY[wd]}</span>
                </div>
              )
            })}
          </div>

          {chartSections.map((sec) => {
            if (!sec.rows.length) return null
            const stats = workloadStats(sec.rows.map(row => row.task))
            return (
              <div key={sec.key} className="gantt-lane">
                {sec.label && (
                  <div className="gantt-lane-head">
                    <span className="gantt-name is-lane" style={{ width: sideW }}>
                      <strong>{sec.label}</strong><span className="gantt-person-summary">{stats.total} 项 · {stats.open} 待办 · {stats.done} 完成{stats.overdue ? ` · ${stats.overdue} 逾期` : ''}</span>
                    </span>
                    <span className="gantt-lane-count">已填平均进度 {stats.averageProgress === null ? '未填' : `${stats.averageProgress}%`}{stats.unspecified ? ` · ${stats.unspecified} 项未填进度` : ''}{stats.conflicts ? ` · ${stats.conflicts} 项待核对` : ''}</span>
                  </div>
                )}
                    {sec.rows.map(({ task, depth }) => {
                      const span = spans.get(task.id)
                      const si = span ? Math.max(0, Math.min(days.length - 1, idxOf(span.start))) : 0
                      const ei = span ? Math.max(0, Math.min(days.length - 1, idxOf(span.end))) : 0
                      const left = sideW + cols.lefts[si]
                      const right = sideW + cols.lefts[ei] + cols.widths[ei]
                      const late = task.status !== 'done' && isDueOverdue(task.dueAt)
                      const done = task.status === 'done'
                      const summary = !!task.importSource?.group
                      const parent = task.parentId ? byId.get(task.parentId) : null
                      const owner = executorName(task, org)
                      const progress = task.progressUnspecified ? '进度未填' : `${task.progress}%`
                      const state = task.sourceStatus || (done ? '已完成' : '进行中')
                      return (
                        <div className={`gantt-row${summary ? ' is-summary' : ''}`} key={`${sec.key}:${task.id}`} data-task-id={task.id}>
                          <div
                            className={`gantt-name${depth > 0 ? ' is-sub' : ''}`}
                            style={{ width: sideW, paddingLeft: 12 + depth * 12 }}
                          >
                            <button className="gantt-task-link" aria-label={`查看任务：${task.title}`} onClick={() => onOpenTask(task)}>{task.title}</button>
                            {peopleMode && parent && <span className="gantt-parent" title={parent.title}>{parent.title}</span>}
                            <div className="gantt-task-meta"><strong className="gantt-executor">{owner}</strong><span className="gantt-percent">{progress}</span><span className={done ? 'is-done' : ''}>{state}</span>{late && <span className="is-late">逾期</span>}{needsProgressReview(task) && <span className="gantt-review">待核对</span>}{!task.ownerId && task.assigneeId && <span>待认领</span>}</div>
                          </div>
                          {span ? <button
                            className={`gantt-bar${done ? ' is-done' : ''}${late ? ' is-late' : ''}`}
                            style={{ left, width: right - left - 3 }}
                            aria-label={`排期：${task.title}，${owner}，${progress}，${state}${late ? '，逾期' : ''}`}
                            onMouseEnter={showTip(task)}
                            onMouseLeave={() => setTip(null)}
                            onFocus={showTip(task)}
                            onBlur={() => setTip(null)}
                            onClick={() => onOpenTask(task)}
                          >
                            {!task.progressUnspecified && <span className="gantt-bar-fill" aria-hidden="true" style={{ width: `${task.progress}%` }} />}
                            <span className="gantt-bar-text">{owner} · {progress}</span>
                            <span className="gantt-bar-date">{dayText(span.end)}</span>
                          </button> : <span className="gantt-unscheduled" style={{ left: sideW + 14 }}>未排期</span>}
                        </div>
                      )
                    })}
              </div>
            )
          })}

          {total === 0 && (
            <div className="gantt-empty">
              当前筛选下，本月没有任务。可切换执行人、调整筛选条件或查看其他月份。
            </div>
          )}
        </div>
      </div>

      {tip && <GanttTip task={tip.task} x={tip.x} y={tip.y} org={org} kids={kids} span={spans.get(tip.task.id)} />}
    </div>
  )
}

/** 悬停气泡: 一眼看清这条排期的详情 (状态 / 优先级 / 人 / 板块类型 / 子任务进度 / 备注) */
function GanttTip({
  task,
  x,
  y,
  org,
  kids,
  span,
}: {
  task: Task
  x: number
  y: number
  org: Org
  kids: Map<string, Task[]>
  span?: { start: number; end: number }
}) {
  const nameOf = (id: string | null) => org.users.find((u) => u.id === id)?.name || '—'
  const children = kids.get(task.id) || []
  const doneKids = children.filter((c) => c.status === 'done').length
  const prio = priorityMeta(task.priority)
  const prioLabel = PRIORITIES.find((p) => p.key === task.priority)?.label || task.priority
  const today = toDay(Date.示例公司有限公司())
  const due = task.dueAt ? toDay(task.dueAt) : null
  const dueGap = due === null ? null : Math.round((due - today) / DAY_MS)
  const dueText =
    dueGap === null ? null : dueGap === 0 ? '今天' : dueGap === 1 ? '明天' : dueGap === -1 ? '昨天' : dueGap < 0 ? `逾期 ${-dueGap} 天` : `${dueGap} 天后`

  // 贴着任务条弹, 右边和下边都不越出窗口
  const w = 280
  const left = Math.max(8, Math.min(x, window.innerWidth - w - 12))
  const below = y < 190
  return (
    <div
      className={`gantt-tip${below ? ' is-below' : ''}`}
      style={{ left, top: below ? y + 28 : y - 10, width: w, pointerEvents: 'none' }}
    >
      <div className="gantt-tip-title">
        <span className="gantt-tip-dot" style={{ background: prio.color }} />
        {task.title}
      </div>
      <div className="gantt-tip-row">
        <span className="chip is-plain">{task.sourceStatus || (task.status === 'done' ? '已完成' : '进行中')}</span>
        <span className="chip is-plain">{task.progressUnspecified ? '原表未填进度' : `进度 ${task.progress}%`}</span>
        {(task.progressConflict || task.status === 'done' && task.progress < 100 || task.sourceStatus === '待核对') && <span className="chip is-warn">状态与进度待核对</span>}
        <span className={`chip is-plain priority-badge priority-${task.priority}`}>优先级 {prioLabel}</span>
        {task.recurrence && <span className="chip is-plain">周期</span>}
      </div>
      {span && (
        <div className="gantt-tip-line">
          排期 {dayText(span.start)} → {dayText(span.end)}
          {task.dueAt ? '' : ' (跟子任务)'}
          {dueText && <b className={dueGap !== null && dueGap < 0 && task.status !== 'done' ? 'is-late' : ''}> · 截止 {dueText}</b>}
        </div>
      )}
      <div className="gantt-tip-line">
        {task.category || `不分${dimNames(org).cat}`} · {task.type || `不设${dimNames(org).type}`}
      </div>
      <div className="gantt-tip-line">
        派发人 {nameOf(task.creatorId)} · 执行人 {nameOf(task.ownerId || task.assigneeId)}
      </div>
      {children.length > 0 && (
        <div className="gantt-tip-line">
          子任务 {doneKids}/{children.length} 已完成
        </div>
      )}
      {task.note.trim() && <div className="gantt-tip-note">{task.note.trim().slice(0, 80)}</div>}
      <div className="gantt-tip-hint">点一下可编辑</div>
    </div>
  )
}


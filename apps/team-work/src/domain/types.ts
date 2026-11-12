// 团队版前端领域类型 (与服务端 server/domain/types.ts 保持一致)。
// 与 server 的差异: 这里没有口令字段 —— 口令永远不下发到前端。

export type Role = 'admin' | 'member'
export type UserState = 'active' | 'disabled'
export type Priority = 'urgent' | 'high' | 'normal' | 'low'
export type TaskStatus = 'open' | 'done'
export type AssignScope = 'user' | 'group' | 'dept'
export type Freq = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Department {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface Group {
  id: string
  name: string
  departmentId: string
  /** 小组负责人 (必须是本组成员) */
  leaderId: string | null
  /** 本组在每个分类维度下的标签: 键 = 维度 id */
  dimTags?: Record<string, string[]>
  /** 维度 cat 的标签 (镜像) */
  categories: string[]
  /** 维度 type 的标签 (镜像) */
  types: string[]
  createdAt: string
}

/** 看板上的偏好 (筛选条件 / 排列方式), 跟着账号存在服务端 */
export interface BoardPrefs {
  view?: string
  time?: string
  prio?: string
  cat?: string
  type?: string
  groupBy?: string
  sort?: string
  showDone?: boolean
  dims?: Record<string, string>
  chart?: boolean
}

export interface User {
  id: string
  name: string
  account: string
  title: string
  role: Role
  managedDepartmentIds?: string[]
  state: UserState
  departmentId: string | null
  /** 所属小组 —— 一示例公司有限公司可以同时在多个组里 */
  groupIds: string[]
  /** true = 还在用初始密码, 必须先改密 */
  mustChangePassword?: boolean
  /** 头像文字/emoji (不填用姓名首字) */
  avatarEmoji?: string | null
  /** 头像底色 (不填按角色: 负责人紫 / 普通成员黄) */
  avatarColor?: string | null
  /** 上次用的筛选 / 排列方式 */
  prefs?: BoardPrefs
  createdAt: string
  lastLoginAt: string | null
}

/** 一个分类维度 (可增删改; 前两个 id 固定是 cat / type) */
export interface Dim {
  id: string
  name: string
}

export interface Org {
  departments: Department[]
  groups: Group[]
  users: User[]
  /** 分类维度列表 (默认两个: 板块 / 类型; 负责人可以改名、可以再加更多) */
  dims?: Dim[]
}

/** 内置的两个分类维度 (后端没给 dims 时的兜底) */
export const BUILTIN_DIMS: Dim[] = [
  { id: 'cat', name: '板块' },
  { id: 'type', name: '类型' },
]

/** 当前生效的分类维度列表 */
export function dimsOf(org?: Org | null): Dim[] {
  const list = Array.isArray(org?.dims) ? org!.dims!.filter((d) => d && d.id && d.name) : []
  if (!list.length) return BUILTIN_DIMS.map((d) => ({ ...d }))
  const byId = new Map(list.map((d) => [d.id, d]))
  const out = BUILTIN_DIMS.map((b) => ({ id: b.id, name: (byId.get(b.id)?.name || b.name).trim() || b.name }))
  for (const d of list) if (!BUILTIN_DIMS.some((b) => b.id === d.id)) out.push({ id: d.id, name: String(d.name).trim() })
  return out
}

/** 前两个分类的名字 (绩效、导出这些老地方还按位置用) */
export function dimNames(org?: Org | null): { cat: string; type: string } {
  const d = dimsOf(org)
  return { cat: d[0]?.name || '板块', type: d[1]?.name || '类型' }
}

/** 这条任务在某个分类维度上的取值 */
export function dimValueOf(task: Pick<Task, 'tags'> & { category?: string; type?: string }, dimId: string): string {
  const fromTags = task.tags?.[dimId]
  if (fromTags !== undefined) return fromTags
  if (dimId === 'cat') return task.category || ''
  if (dimId === 'type') return task.type || ''
  return ''
}

/** 某个小组在某个维度下的标签 */
export function groupDimTags(group: Group & { dimTags?: Record<string, string[]> }, dimId: string): string[] {
  const fromMap = group.dimTags?.[dimId]
  if (Array.isArray(fromMap)) return fromMap
  if (dimId === 'cat') return group.categories || []
  if (dimId === 'type') return group.types || []
  return []
}

/** 某个维度下所有小组的标签 (去重) —— 筛选下拉 / 自动识别用 */
export function allDimTags(org: Org | null | undefined, dimId: string): string[] {
  const set = new Set<string>()
  for (const g of org?.groups || []) for (const t of groupDimTags(g as any, dimId)) set.add(String(t).trim())
  return Array.from(set).filter(Boolean)
}

/** 「板块」下拉的数据源: 按小组分组的标签 */
export function categoryGroups(org: Org): Array<{ id: string; name: string; categories: string[] }> {
  return org.groups.filter((g) => (g.categories || []).length > 0).map((g) => ({ id: g.id, name: g.name, categories: g.categories }))
}

/** 「类型」下拉的数据源: 同样按小组分组 */
export function typeGroups(org: Org): Array<{ id: string; name: string; types: string[] }> {
  return org.groups.filter((g) => (g.types || []).length > 0).map((g) => ({ id: g.id, name: g.name, types: g.types }))
}

/** 所有小组的「板块」标签合集 (去重), 给筛选下拉用 */
export function allCategories(org: Org): string[] {
  const set = new Set<string>()
  for (const g of org.groups) for (const c of g.categories || []) set.add(c)
  return Array.from(set)
}

/** 所有小组的「类型」标签合集 (去重), 给筛选下拉用 */
export function allTypes(org: Org): string[] {
  const set = new Set<string>()
  for (const g of org.groups) for (const c of g.types || []) set.add(c)
  return Array.from(set)
}

export interface Recurrence {
  freq: Freq
  /** 'HH:mm' */
  at: string
  /** 0=周一 … 6=周日 */
  byWeekday?: number[]
  byMonthDay?: number
}

/** 示例公司有限公司备忘录 (和任务完全隔离的一套数据) */
/** 一条艾维利历史 (一天一条) */
export interface IvyRecord {
  id: string
  date: string
  text: string
  createdAt: string
  updatedAt: string
}

export interface Memo {
  id: string
  text: string
  done: boolean
  createdAt: string
  doneAt: string | null
}

/** 示例公司有限公司备忘录 (和任务完全隔离的一套数据) */
export interface Memo {
  id: string
  text: string
  done: boolean
  createdAt: string
  doneAt: string | null
}

/** 月度绩效考核的一行 (对应清单里的一个任务 / 它的子任务) */
export interface AppraisalItem {
  id: string
  taskId: string | null
  /** 考核指标 (任务名) */
  title: string
  /** 指标定义 (子任务名, 一行一条) */
  detail: string
  /** 指标类型 (任务的板块) */
  category: string
  /** 方案时间规划 (截止日期) */
  dueAt: string | null
  /** 原定系数 (员工填) */
  baseCoef: number | null
  /** 最终系数 (负责人填) */
  finalCoef: number | null
  /** 自评完成度 % (默认跟任务进度) */
  selfPct: number | null
  /** 上级评价 % (负责人填) */
  leadPct: number | null
  autoSelf: boolean
  exec: string
  result: string
}

export interface Appraisal {
  id: string
  userId: string
  month: string
  items: AppraisalItem[]
  submittedAt: string | null
  updatedAt: string
}

export interface TaskProgressInput {
  progressPercent: number
  summary: string
  nextAction: string
  blockers?: string
  riskLevel: number
}

export interface TaskProgressUpdate extends TaskProgressInput {
  id: string
  taskId: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface TaskDetails {
  task: Task
  parent: Task | null
  children: Task[]
  updates: TaskProgressUpdate[]
  permissions: { canEdit: boolean; canUpdateProgress: boolean; canClaim: boolean; progressHint: string }
}

export interface Task {
  importSource?: { sha256: string; row?: number; group?: string; original?: Record<string, unknown> }
  startAt?: string | null
  progressUnspecified?: boolean
  progressConflict?: boolean
  assignmentPending?: boolean
  sourceStatus?: string
  evidence?: Array<{ name: string; storageKey: string }>
  id: string
  /** 子任务指向父任务; 顶级任务为 null */
  parentId: string | null
  title: string
  note: string
  /** 每个分类维度的取值: 键 = 维度 id (自定义维度都在这儿) */
  tags?: Record<string, string>
  /** 维度 cat 的取值 (镜像字段) */
  category: string
  /** 维度 type 的取值 (镜像字段) */
  type: string
  /** 进度 0~100 (100 = 已完成) */
  progress: number
  priority: Priority
  status: TaskStatus
  scope: AssignScope
  assigneeId: string | null
  groupId: string | null
  departmentId: string | null
  ownerId: string | null
  claimedById: string | null
  claimedAt: string | null
  creatorId: string
  dueAt: string | null
  remindAt: string | null
  remindState: 'none' | 'pending' | 'fired'
  notifiedAt: string | null
  recurrence: Recurrence | null
  templateId: string | null
  instanceDate: string | null
  doneAt: string | null
  /** 非 null = 在回收站里 (软删除) */
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Summary {
  total: number
  subtasks?: number
  mine: number
  createdByMe: number
  group: number
  pool: number
  overdue: number
  dueToday: number
  done: number
  generatedToday: number
  trash?: number
}

export interface LocalSettings {
  theme: 'light' | 'dark'
  notificationsEnabled: boolean
  dndEnabled: boolean
  dndStart: string
  dndEnd: string
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  theme: 'light',
  notificationsEnabled: true,
  dndEnabled: true,
  dndStart: '22:00',
  dndEnd: '08:00',
}

export interface PriorityMeta {
  key: Priority
  label: string
  short: string
  color: string
  weight: number
}

export const PRIORITIES: PriorityMeta[] = [
  { key: 'urgent', label: 'P0', short: 'P0', color: '#ad256d', weight: 4 },
  { key: 'high', label: 'P1', short: 'P1', color: '#946209', weight: 3 },
  { key: 'normal', label: 'P2', short: 'P2', color: '#245d96', weight: 2 },
  { key: 'low', label: 'P3', short: 'P3', color: '#746e62', weight: 1 },
]

export function priorityMeta(p: Priority): PriorityMeta {
  return PRIORITIES.find((x) => x.key === p) || PRIORITIES[2]
}

export const REPEAT_LABEL: Record<Freq, string> = {
  none: '不重复',
  daily: '每天',
  weekdays: '每个工作日',
  weekly: '每周',
  monthly: '每月',
}

export const WEEKDAY_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 看板一级视图 */
export type BoardView = 'all' | 'dept' | 'mine' | 'assigned' | 'group' | 'pool' | 'done'

export const BOARD_VIEWS: Array<{ key: BoardView; label: string; hint: string }> = [
  // 「全部待办」只有超级管理员(管理员)那排视图按钮里才有 —— 跨部门看全部
  { key: 'all', label: '全部待办', hint: '所有部门的所有任务 (只有超级管理员能看到)' },
  { key: 'dept', label: '部门待办', hint: '我所在部门的任务' },
  { key: 'mine', label: '我的待办', hint: '已经认领到我名下的任务' },
  { key: 'assigned', label: '我派发的', hint: '我发出去、别人在做的' },
  { key: 'group', label: '小组待办', hint: '我所在小组相关的任务' },
  { key: 'pool', label: '待认领', hint: '派给小组/部门、或别人派给你但还没确认认领的' },
  { key: 'done', label: '已完成', hint: '已经完成的记录' },
]

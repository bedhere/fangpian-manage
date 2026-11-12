// 服务端领域模型 (团队版)。
// 与前端共享的类型在 shared/api.interface.ts —— 服务端 tsconfig 清空了 paths,
// 不能 import @shared, 所以这里保留一份服务端视图, 两边字段保持一致。

export type Role = 'admin' | 'member'
export type UserState = 'active' | 'disabled'

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
  /** 小组负责人 —— 必须是本组成员; 没设置时为 null */
  leaderId: string | null
  /** 本组自己维护的标签: 键 = 维度 id, 值 = 这个维度下的标签 */
  dimTags: Record<string, string[]>
  /** 维度 'cat' 的标签 (镜像, 老代码还在读) */
  categories: string[]
  /** 维度 'type' 的标签 (镜像) */
  types: string[]
  createdAt: string
}

/** 存盘里的用户 (含口令散列, 绝不出网) */
/** 示例公司有限公司备忘录 (和任务完全隔离的一套数据) */
export interface Memo {
  id: string
  text: string
  done: boolean
  createdAt: string
  doneAt: string | null
}

/**
 * 一条「艾维利」记录 (当天生成的那段文本)。
 * 一天只留一条 (同一天再生成就覆盖), 这样历史清单就是「每天一页」。
 */
export interface IvyRecord {
  id: string
  /** 'YYYY-MM-DD' (本机时区那天) */
  date: string
  text: string
  createdAt: string
  updatedAt: string
}

/** 每示例公司有限公司自己的看板偏好 (筛选条件 / 排列方式等), 跟着账号走 */
export interface UserPrefs {
  view?: string
  time?: string
  prio?: string
  cat?: string
  type?: string
  groupBy?: string
  sort?: string
  showDone?: boolean
  chart?: boolean
}

export interface User {
  isDemoAccount?: boolean
  id: string
  name: string
  /** 登录账号, 默认取姓名拼音缩写 */
  account: string
  title: string
  role: Role
  state: UserState
  departmentId: string | null
  /** 所属小组 —— 一示例公司有限公司可以同时在多个组里 */
  groupIds: string[]
  passwordSalt: string
  passwordHash: string
  /** 管理员重置后置 true, 提醒用户改密码 */
  mustChangePassword: boolean
  /** 头像文字/emoji (不填用姓名首字) */
  avatarEmoji: string | null
  /** 头像底色 (不填按角色: 负责人紫 / 普通成员黄) */
  avatarColor: string | null
  /** 看板偏好 (上次用的筛选/排列方式) */
  prefs: UserPrefs
  /** 私人备忘录 (只通过 /api/memos 读写, 不跟着 publicUser 出网) */
  memos: Memo[]
  /** 艾维利历史 (同样只通过 /api/ivy 读写, 不出网) */
  ivy: IvyRecord[]
  createdAt: string
  lastLoginAt: string | null
}

/** 可以出网的用户视图 */
export interface PublicUser {
  /** Undefined for organization-wide managers, otherwise the canonical departments they lead. */
  managedDepartmentIds?: string[]
  id: string
  name: string
  account: string
  title: string
  role: Role
  state: UserState
  departmentId: string | null
  groupIds: string[]
  /** true = 还在用初始密码, 必须先改密才能用别的接口 */
  mustChangePassword: boolean
  avatarEmoji: string | null
  avatarColor: string | null
  createdAt: string
  lastLoginAt: string | null
  /** 看板偏好 (筛选 / 排列) */
  prefs?: UserPrefs
}

export interface Session {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
  userAgent: string
}

export type Priority = 'urgent' | 'high' | 'normal' | 'low'
export type TaskStatus = 'open' | 'done'

/** 任务派给谁: 具体人 / 整个小组 / 整个部门 */
export type AssignScope = 'user' | 'group' | 'dept'

export type Freq = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Recurrence {
  freq: Freq
  /** 触发时间 'HH:mm' (服务端本地时区) */
  at: string
  /** weekly: 0=周一 … 6=周日 */
  byWeekday?: number[]
  /** monthly: 几号 1-31 */
  byMonthDay?: number
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

export interface Task {
  wecom?: { docid: string; sheetId: string; recordId: string; mapping: Record<string, string>; remoteHash: string; localHash: string; syncedAt: string; revision?: string }
  importSource?: { sha256: string; row?: number; group?: string; original?: Record<string, unknown> }
  startAt?: string | null
  progressUnspecified?: boolean
  progressConflict?: boolean
  assignmentPending?: boolean
  sourceStatus?: string
  evidence?: Array<{ name: string; storageKey: string }>
  id: string
  /** 子任务指向父任务; 顶级任务的 parentId 为 null */
  parentId: string | null
  title: string
  note: string
  /** 每个分类维度的取值: 键 = 维度 id (标签来自所在小组的 dimTags) */
  tags: Record<string, string>
  /** 维度 'cat' 的取值 (镜像, 绩效/导出/自动识别还在读) */
  category: string
  /** 维度 'type' 的取值 (镜像) */
  type: string
  /** 进度 0~100: 0=没开始; 100=已完成 (会自动把任务标记为完成) */
  progress: number
  priority: Priority
  status: TaskStatus
  scope: AssignScope
  assigneeId: string | null
  groupId: string | null
  departmentId: string | null
  /** 派单/认领后实际执行人 (scope=user 时等于 assigneeId) */
  ownerId: string | null
  claimedById: string | null
  claimedAt: string | null
  creatorId: string
  dueAt: string | null
  remindAt: string | null
  /** none=没设提醒; pending=待触发; fired=已弹过 (由最先打开的那个客户端回写) */
  remindState: 'none' | 'pending' | 'fired'
  notifiedAt: string | null
  recurrence: Recurrence | null
  /** 周期任务实例指向模板 id */
  templateId: string | null
  /** 实例的归属日期 (YYYY-MM-DD, 服务端本地时区), 用于幂等生成 */
  instanceDate: string | null
  doneAt: string | null
  /** 非 null = 已进回收站 (软删除), 界面上不再出现, 可以恢复或彻底删掉 */
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 月度绩效考核: 一示例公司有限公司一个月一份, 行对应清单里的任务/子任务 */
export interface AppraisalItem {
  id: string
  /** 关联的任务 (考核指标); null = 还没落到清单里 */
  taskId: string | null
  /** 考核指标 (= 任务名) */
  title: string
  /** 指标定义 (= 子任务名, 一行一条) */
  detail: string
  /** 指标类型 (= 任务的第一个分类维度) */
  category: string
  /** 方案时间规划 (= 截止日期) */
  dueAt: string | null
  /** 原定系数 —— 员工填 */
  baseCoef: number | null
  /** 最终系数 —— 负责人填 */
  finalCoef: number | null
  /** 自评完成度 % —— 员工填, 默认跟着任务的进度条走 */
  selfPct: number | null
  /** 上级评价 % —— 负责人填 */
  leadPct: number | null
  /** 自评完成度是否自动跟任务进度 (员工手动改过就变 false) */
  autoSelf: boolean
  /** 执行情况 */
  exec: string
  /** 月度成果 (说明 / 附件链接) */
  result: string
}

export interface Appraisal {
  id: string
  userId: string
  /** 'YYYY-MM' */
  month: string
  items: AppraisalItem[]
  submittedAt: string | null
  updatedAt: string
}

/**
 * 一个分类维度 (可增删改)。
 *   · id: 稳定标识, 存在任务的 tags / 小组的 dimTags 里当键用, 改名不动它
 *   · name: 显示名 (任务列表列头、筛选、派任务表单都用它)
 * 前两个维度的 id 固定是 'cat' / 'type' —— 它们同时镜像到 task.category / task.type,
 * 绩效、导出、自动识别这些老地方还读那两个字段, 所以这两个不能删, 只能改名。
 */
export interface Dim {
  id: string
  name: string
}

/** 全局设置 (整个团队一份) */
export interface AppSettings {
  wecom?: { mapping: Record<string, string>; departmentMap: Record<string, string> }
  groupTags?: Record<string, Record<string, string[]>>
  /** 分类维度列表, 至少 1 个; 前两个是内置的 板块 / 类型 */
  dims: Dim[]
}

export const BUILTIN_DIMS: Dim[] = [
  { id: 'cat', name: '板块' },
  { id: 'type', name: '类型' },
]
/** 这两个 id 是内置维度, 不能删 (绩效/导出/自动识别还依赖 category / type 字段) */
export const BUILTIN_DIM_IDS = ['cat', 'type']

export interface Db {
  version: number
  departments: Department[]
  groups: Group[]
  users: User[]
  sessions: Session[]
  tasks: Task[]
  taskUpdates?: TaskProgressUpdate[]
  appraisals: Appraisal[]
  settings: AppSettings
}

export function emptyDb(): Db {
  return {
    version: 1,
    departments: [],
    groups: [],
    users: [],
    sessions: [],
    tasks: [],
    appraisals: [],
    settings: { dims: BUILTIN_DIMS.map((d) => ({ ...d })) },
  }
}

export function uid(): string {
  return (
    Date.示例公司有限公司().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  )
}

export function publicUser(u: User): PublicUser {
  // memos / ivy 是私人的: 组织架构接口会返回所有人的 publicUser, 不能把别人的备忘和艾维利带出去
  const { passwordHash, passwordSalt, memos, ivy, isDemoAccount, ...rest } = u
  return rest
}

export function canManageUser(me: PublicUser, userId: string, db: Db): boolean {
  if (me.role !== 'admin') return false
  if (!me.managedDepartmentIds) return true
  const user = db.users.find(u => u.id === userId)
  return !!user?.departmentId && me.managedDepartmentIds.includes(user.departmentId)
}

export function canManageTask(me: PublicUser, task: Task, db: Db): boolean {
  if (me.role !== 'admin') return false
  if (!me.managedDepartmentIds) return true
  const group = db.groups.find(g => g.id === task.groupId)
  const department = task.departmentId || group?.departmentId
  return (department ? me.managedDepartmentIds.includes(department) : false) ||
    canManageUser(me, task.assigneeId || task.ownerId || task.creatorId, db)
}


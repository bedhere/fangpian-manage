import { syncTaskSummaries } from '../../domain/task-summaries.js'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { dateKey, materializeRecurring } from '../../domain/recurrence.js'
import { canManageTask, uid, type Db, type Priority, type PublicUser, type Recurrence, type Task, type TaskStatus, type TaskProgressInput, type TaskProgressUpdate } from '../../domain/types.js'
import { store } from '../../store/index.js'

export interface TaskInput {
  parentId?: string | null
  remindState?: 'none' | 'pending' | 'fired'
  notifiedAt?: string | null
  title: string
  note?: string
  category?: string
  type?: string
  /** 每个分类维度的取值 (键 = 维度 id); category / type 是它的前两个维度的简写 */
  tags?: Record<string, string>
  progress?: number
  priority?: Priority
  scope?: 'user' | 'group' | 'dept'
  assigneeId?: string | null
  groupId?: string | null
  departmentId?: string | null
  dueAt?: string | null
  remindAt?: string | null
  recurrence?: Recurrence | null
}

const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low']

function validateInput(input: Partial<TaskInput & { status: TaskStatus }>): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('任务参数无效')
  if (input.title !== undefined && (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 500)) throw new BadRequestException('任务标题为1至500字')
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 8000)) throw new BadRequestException('备注最多8000字')
  if (input.status !== undefined && !['open', 'done'].includes(input.status)) throw new BadRequestException('任务状态无效')
  if (input.progress !== undefined && (typeof input.progress !== 'number' || !Number.isFinite(input.progress) || input.progress < 0 || input.progress > 100)) throw new BadRequestException('进度须为0至100')
  for (const value of [input.dueAt, input.remindAt, input.notifiedAt]) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value) || !Number.isFinite(new Date(value).getTime()))) throw new BadRequestException('日期无效')
  }
  if (input.tags !== undefined && (!input.tags || typeof input.tags !== 'object' || Array.isArray(input.tags) || JSON.stringify(input.tags).length > 4000)) throw new BadRequestException('分类无效')
  const r = input.recurrence
  if (r && (!['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(r.freq) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.at) ||
    (r.byMonthDay !== undefined && (!Number.isInteger(r.byMonthDay) || r.byMonthDay < 1 || r.byMonthDay > 31)) ||
    (r.byWeekday !== undefined && (!Array.isArray(r.byWeekday) || r.byWeekday.some(d => !Number.isInteger(d) || d < 0 || d > 6))))) throw new BadRequestException('周期规则无效')
}

/** 用得上 tags 的最小结构 (Task / TaskInput / patch 都满足) */
type TaskLike = { tags?: Record<string, string>; category?: string; type?: string }

/**
 * 把「分类取值」统一成一个 map:
 *   · 老的 category / type 两个简写字段 → 内置维度 cat / type
 *   · 新的 tags 字段 → 原样带上 (任意自定义维度)
 */
function mergeDimValues(input: { category?: string; type?: string; tags?: Record<string, string> }): Record<string, string> {
  const out: Record<string, string> = {}
  if (input.tags && typeof input.tags === 'object') {
    for (const [k, v] of Object.entries(input.tags)) out[String(k)] = String(v ?? '')
  }
  if (input.category !== undefined) out.cat = String(input.category ?? '')
  if (input.type !== undefined) out.type = String(input.type ?? '')
  return out
}

@Injectable()
export class TasksService {
  async details(id: string, me: PublicUser) {
    const { tasks } = await this.list(me)
    const task = tasks.find(t => t.id === id)
    if (!task) throw new NotFoundException('任务不存在或无权查看')
    const hasChildren = store.db.tasks.some(t => t.parentId === id && !t.deletedAt)
    const isSummary = !!task.importSource?.group || hasChildren
    const isRule = !!task.recurrence && !task.templateId
    return {
      task,
      children: tasks.filter(t => t.parentId === id),
      parent: tasks.find(t => t.id === task.parentId) ?? null,
      updates: (store.db.taskUpdates ?? []).filter(u => u.taskId === id).slice().reverse(),
      permissions: {
        canEdit: this.canEdit(task, me),
        canUpdateProgress: task.ownerId === me.id && !isSummary && !isRule,
        canClaim: !isRule && task.status !== 'done' && this.claimableBy(task, me),
        progressHint: isSummary ? '主任务进度由子任务自动汇总，请进入具体子任务更新。' : isRule ? '这是周期规则，请更新对应日期的任务实例。' : task.assignmentPending ? '任务待分配，请由负责人指定执行人。' : !task.ownerId ? '任务尚未认领，执行人认领后即可更新进度。' : task.ownerId !== me.id ? '只有这条任务的执行人可以更新进度。' : '',
      },
    }
  }

  async reportProgress(id: string, input: TaskProgressInput, me: PublicUser) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('进展信息无效')
    if (!Number.isInteger(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100) throw new BadRequestException('进度须为0至100的整数')
    for (const [label, value] of [['进展摘要', input.summary], ['下一步', input.nextAction]] as const) {
      if (typeof value !== 'string' || value.trim().length < 2 || value.length > 4000) throw new BadRequestException(`${label}须为2至4000字`)
    }
    if (input.blockers !== undefined && (typeof input.blockers !== 'string' || input.blockers.length > 4000)) throw new BadRequestException('阻塞事项最多4000字')
    if (!Number.isInteger(input.riskLevel) || input.riskLevel < 0 || input.riskLevel > 3) throw new BadRequestException('风险等级无效')
    const detail = await this.details(id, me)
    if (!detail.permissions.canUpdateProgress) throw new ForbiddenException(detail.permissions.progressHint)
    // Reuse the existing completion/parent rules inside the same locked organization transaction.
    await this.update(id, { progress: input.progressPercent }, me)
    const record: TaskProgressUpdate = {
      id: uid(), taskId: id, authorId: me.id, authorName: me.name, createdAt: new Date().toISOString(),
      progressPercent: input.progressPercent, summary: input.summary.trim(), nextAction: input.nextAction.trim(),
      blockers: input.blockers?.trim() ?? '', riskLevel: input.riskLevel,
    }
    await store.update(db => { (db.taskUpdates ??= []).push(record) })
    return this.details(id, me)
  }

  /** 惰性生成周期任务实例, 返回新增条数 */
  private async materialize(): Promise<number> {
    const created = materializeRecurring(store.db.tasks.filter((t) => !t.deletedAt), new Date())
    if (created.length === 0) return 0
    await store.update((d) => {
      for (const t of created) {
        if (!d.tasks.some((x) => x.id === t.id)) d.tasks.push(t)
      }
    })
    return created.length
  }

  /**
   * 主任务的完成状态由子任务推导:
   *   · 子任务全完成 → 主任务自动完成
   *   · 只要还有没完成的子任务 → 主任务回到未完成
   * 只影响「有子任务的任务」, 叶子任务不受影响; 周期规则 (模板) 不参与 —— 它被自动
   * 置为完成就等于停用了, 那是用户自己的决定。
   * 自底向上迭代几轮, 让多层嵌套能一次推到底。
   */

  /**
   * 子任务的截止不能晚于主任务 —— 逐层往下, 把超出上层截止日的日期拉回到上层那一天。
   * 主任务把截止日提前时, 它下面已经排好期的子任务会被一起收回来, 不会留下
   * 「主任务明天到期、子任务却排到下周」这种错位。
   */
  private clampDueToAncestors(d: Db): number {
    const kids = new Map<string, Task[]>()
    for (const t of d.tasks) {
      if (!t.parentId || t.deletedAt) continue
      if (!kids.has(t.parentId)) kids.set(t.parentId, [])
      kids.get(t.parentId)!.push(t)
    }
    let changed = 0
    const walk = (list: Task[], cap: string | null) => {
      for (const t of list) {
        if (cap && t.dueAt && new Date(t.dueAt).getTime() > new Date(cap).getTime()) {
          t.dueAt = cap
          t.updatedAt = new Date().toISOString()
          changed++
        }
        walk(kids.get(t.id) || [], t.dueAt || cap)
      }
    }
    walk(d.tasks.filter((t) => !t.parentId && !t.deletedAt), null)
    return changed
  }

  /** 往上数层数 (顶级 = 0) */
  private depthOf(task: Task, all = store.db.tasks): number {
    let depth = 0
    let cur = task
    const seen = new Set<string>([task.id])
    while (cur.parentId) {
      if (seen.has(cur.parentId)) break // 数据异常时防死循环
      seen.add(cur.parentId)
      const parent = all.find((t) => t.id === cur.parentId)
      if (!parent) break
      cur = parent
      depth++
      if (depth > 20) break
    }
    return depth
  }

  /** 自己 + 所有后代 (删除父任务时级联用) */
  private withDescendants(id: string, all = store.db.tasks): string[] {
    const out = [id]
    const queue = [id]
    while (queue.length) {
      const cur = queue.shift()!
      for (const t of all) {
        if (t.deletedAt) continue
        if (t.parentId === cur && !out.includes(t.id)) {
          out.push(t.id)
          queue.push(t.id)
        }
      }
    }
    return out
  }

  /**
   * 「这条任务本身」在不在我的范围内 (不含「我认领后连带看到的那棵树」)。
   *   · 我派的 / 我做着的 / 指给我的 (还没认领的也算, 否则它不会出现在「待认领」里)
   *   · 我所在小组的任务
   *   · 我所在部门的任务
   * 部门之间是隔离的: 行政部的人看不到品牌部的活 —— 除非他自己认领了 (见 visibleIds)。
   */
  private ownScope(t: Task, me: PublicUser): boolean {
    if (t.creatorId === me.id) return true
    if (t.ownerId === me.id) return true
    if (t.assigneeId === me.id) return true
    if (t.scope === 'group' && t.groupId && (me.groupIds || []).includes(t.groupId)) return true
    if (t.scope === 'dept' && t.departmentId && t.departmentId === me.departmentId) return true
    return false
  }

  /** 顺着 parentId 一路往上, 找到这棵树的主任务 */
  private rootOf(task: Task, all: Task[]): Task {
    let cur = task
    const seen = new Set<string>([task.id])
    for (let i = 0; i < 20 && cur.parentId; i++) {
      if (seen.has(cur.parentId)) break
      seen.add(cur.parentId)
      const parent = all.find((t) => t.id === cur.parentId)
      if (!parent) break
      cur = parent
    }
    return cur
  }

  /**
   * 当前这示例公司有限公司能看到哪些任务。
   *   · 负责人(管理员) → null, 表示不筛 (全都能看)
   *   · 别人 → 自己范围内的那些, 外加:
   *       - 这些任务的**父级链**: 不然子任务会挂在一棵不存在的树上
   *       - 我**认领了**的跨部门任务所在的那整棵树 (它自己 + 父级 + 父级下面的所有工作),
   *         这是「认领了品牌部的活之后就能看到这条活和它父级里的所有工作」那条规则
   */
  private visibleIds(me: PublicUser, all: Task[]): Set<string> | null {
    if (me.role === 'admin' && !me.managedDepartmentIds) return null
    const byId = new Map(all.map((t) => [t.id, t]))
    const ok = new Set<string>()
    for (const t of all) if (this.ownScope(t, me) || canManageTask(me, t, store.db)) ok.add(t.id)
    // 父级链补齐 (让树连得上)
    for (const id of [...ok]) {
      let cur = byId.get(id)
      for (let i = 0; cur && cur.parentId && i < 20; i++) {
        cur = byId.get(cur.parentId)
        if (cur) ok.add(cur.id)
      }
    }
    // 认领过的任务 → 整棵树 (它所在的主任务 + 下面所有工作) 都给它看
    for (const t of all) {
      if (t.ownerId !== me.id) continue
      const root = this.rootOf(t, all)
      for (const id of this.withDescendants(root.id, all as Task[])) ok.add(id)
    }
    return ok
  }

  /** 谁能领/抢这条还没主的任务: 示例公司有限公司任务=被指派人; 小组任务=本组成员; 部门任务=本部门成员 */
  private claimableBy(task: Task, me: PublicUser): boolean {
    if (task.assignmentPending) return false
    if (task.importSource?.group) return false
    if (task.ownerId) return false
    if (task.scope === 'user') return task.assigneeId === me.id
    if (task.scope === 'group') return !!task.groupId && (me.groupIds || []).includes(task.groupId)
    return !!task.departmentId && task.departmentId === me.departmentId
  }

  private canEdit(task: Task, me: PublicUser): boolean {
    return canManageTask(me, task, store.db) || task.creatorId === me.id || task.ownerId === me.id || task.assigneeId === me.id
  }

  async list(me: PublicUser) {
    await store.init()
    const generated = await this.materialize()
    // 回收站里的任务不再出现在看板上
    const live = store.db.tasks.filter((t) => !t.deletedAt)
    const visible = this.visibleIds(me, live)
    return { tasks: visible ? live.filter((t) => visible.has(t.id)) : live, generated }
  }

  private resolveTarget(
    input: TaskInput,
    me?: PublicUser,
  ): Pick<Task, 'scope' | 'assigneeId' | 'groupId' | 'departmentId' | 'ownerId'> {
    const scope = input.scope || 'user'
    if (!['user', 'group', 'dept'].includes(scope)) throw new BadRequestException('派发范围无效')
    if (scope === 'user') {
      if (!input.assigneeId) throw new BadRequestException('请选择要派给的人')
      if (!store.db.users.some(u => u.id === input.assigneeId && u.state === 'active')) throw new BadRequestException('成员不存在或已停用')
      // 派给别人 = 待对方确认认领 (先进「待认领」); 派给自己就直接算自己的
      const ownerId = me && input.assigneeId !== me.id ? null : input.assigneeId
      return { scope, assigneeId: input.assigneeId, groupId: null, departmentId: null, ownerId }
    }
    if (scope === 'group') {
      if (!input.groupId) throw new BadRequestException('请选择要派给的小组')
      if (!store.db.groups.some(g => g.id === input.groupId)) throw new BadRequestException('小组不存在')
      return { scope, assigneeId: null, groupId: input.groupId, departmentId: null, ownerId: null }
    }
    if (!input.departmentId) throw new BadRequestException('请选择要派给的部门')
    if (!store.db.departments.some(d => d.id === input.departmentId)) throw new BadRequestException('部门不存在')
    return { scope, assigneeId: null, groupId: null, departmentId: input.departmentId, ownerId: null }
  }

  async create(input: TaskInput, me: PublicUser): Promise<Task> {
    validateInput(input)
    const title = String(input.title || '').trim()
    if (!title) throw new BadRequestException('任务标题不能为空')
    await store.init()

    const 示例公司有限公司 = new Date().toISOString()

    // 子任务: 校验父任务, 并在「没显式指定」时继承父任务的派发对象
    let parent: Task | undefined
    if (input.parentId) {
      parent = store.db.tasks.find((t) => t.id === input.parentId)
      if (!parent) throw new BadRequestException('父任务不存在')
      if (parent.deletedAt || !this.canEdit(parent, me)) throw new ForbiddenException('不能向无权编辑的任务添加子任务')
      if (this.depthOf(parent) >= 4) throw new BadRequestException('子任务层级太深了 (最多 5 层)')
    }
    const target = this.resolveTarget({
      ...input,
      scope: input.scope ?? parent?.scope ?? 'user',
      assigneeId: input.assigneeId !== undefined ? input.assigneeId : parent?.assigneeId ?? null,
      groupId: input.groupId !== undefined ? input.groupId : parent?.groupId ?? null,
      departmentId: input.departmentId !== undefined ? input.departmentId : parent?.departmentId ?? null,
    }, me)
    // 子任务不参与周期生成 (周期只挂在顶级任务上)
    const recurrence = !parent && input.recurrence && input.recurrence.freq !== 'none' ? input.recurrence : null
    // 分类取值: 子任务跟随父任务; 顶层任务用请求里的 (category/type 简写 + tags 合并)
    const dimValues: Record<string, string> = parent ? { ...(parent.tags || {}) } : mergeDimValues(input)

    const task: Task = {
      id: uid(),
      parentId: parent ? parent.id : null,
      title,
      note: String(input.note || ''),
      progress: 0,
      // 子任务的分类自动跟随主任务, 不接受单独指定
      tags: dimValues,
      category: dimValues.cat ?? '',
      type: dimValues.type ?? '',
      priority: PRIORITIES.includes(input.priority as Priority)
        ? (input.priority as Priority)
        : parent?.priority || 'normal',
      status: 'open',
      ...target,
      // 子任务跟着父任务的认领状态走 (父任务还没被认领, 子任务也不算认领)
      ...(parent && input.scope === undefined && input.assigneeId === undefined ? { ownerId: parent.ownerId } : {}),
      creatorId: me.id,
      dueAt: input.dueAt || null,
      remindAt: input.remindAt || null,
      remindState: input.remindAt ? 'pending' : 'none',
      notifiedAt: null,
      recurrence,
      templateId: null,
      instanceDate: null,
      claimedById: null,
      claimedAt: null,
      doneAt: null,
      deletedAt: null,
      createdAt: 示例公司有限公司,
      updatedAt: 示例公司有限公司,
    }
    await store.update((d) => {
      d.tasks.push(task)
      // 新加的子任务会让主任务从「已完成」回到未完成
      syncTaskSummaries(d)
      this.clampDueToAncestors(d)
    })
    return store.db.tasks.find((t) => t.id === task.id) || task
  }

  async update(id: string, patch: Partial<TaskInput & { status: TaskStatus }>, me: PublicUser): Promise<Task> {
    validateInput(patch)
    await store.init()
    const existing = store.db.tasks.find((t) => t.id === id)
    if (!existing || existing.deletedAt) throw new NotFoundException('任务不存在')
    if (!this.canEdit(existing, me)) throw new ForbiddenException('只能修改自己派发或自己负责的任务')

    // 「截止日期」只有派发人(和负责人)能定 —— 谁认领了也不能改, 一切以派发人设的为准
    // (含派发人没设日期、跟着上层主任务走的「默认日期」那种情况)
    if (patch.dueAt !== undefined && !canManageTask(me, existing, store.db) && existing.creatorId !== me.id) {
      delete (patch as any).dueAt
    }

    // 「执行人」只有负责人(管理员)能调 —— 派发人本人也不行
    const touchesAssignment =
      patch.scope !== undefined ||
      patch.assigneeId !== undefined ||
      patch.groupId !== undefined ||
      patch.departmentId !== undefined
    if (touchesAssignment && existing.importSource?.group) throw new BadRequestException('汇总任务不分配执行人，请调整具体子任务')
    if (touchesAssignment && !canManageTask(me, existing, store.db)) {
      throw new ForbiddenException('执行人只能由负责人调整')
    }

    let updated: Task | null = null
    await store.update((d) => {
      const task = d.tasks.find((t) => t.id === id)
      if (!task) return
      if (patch.title !== undefined) {
        const t = String(patch.title).trim()
        if (!t) throw new BadRequestException('任务标题不能为空')
        task.title = t
      }
      if (patch.parentId !== undefined && patch.parentId !== task.parentId) {
        if (patch.parentId === null) {
          task.parentId = null
        } else {
          if (patch.parentId === task.id) throw new BadRequestException('不能把任务挂到自己下面')
          const cycle = this.withDescendants(task.id, d.tasks)
          if (cycle.includes(patch.parentId)) throw new BadRequestException('不能挂到自己的子任务下面')
          const parent = d.tasks.find((t) => t.id === patch.parentId)
          if (!parent) throw new BadRequestException('父任务不存在')
          if (parent.deletedAt || !this.canEdit(parent, me)) throw new ForbiddenException('无权编辑父任务')
          if (this.depthOf(parent, d.tasks) >= 4) throw new BadRequestException('子任务层级太深了 (最多 5 层)')
          task.parentId = parent.id
        }
      }
      if (patch.note !== undefined) task.note = String(patch.note)
      // 分类取值: 子任务一律跟随主任务 (子任务上发来的修改直接忽略);
      // 主任务改了某个维度的标签, 整棵子树跟着改, 保证父子永远一致
      if (!task.parentId) {
        const dims = mergeDimValues(patch)
        const keys = Object.keys(dims)
        if (keys.length) {
          const apply = (t: TaskLike) => {
            t.tags = { ...(t.tags || {}), ...dims }
            if (dims.cat !== undefined) t.category = dims.cat
            if (dims.type !== undefined) t.type = dims.type
          }
          apply(task)
          for (const id of this.withDescendants(task.id, d.tasks)) {
            if (id === task.id) continue
            const child = d.tasks.find((x) => x.id === id)
            if (child) apply(child)
          }
        }
      }
      if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) task.priority = patch.priority
      if (patch.dueAt !== undefined) task.dueAt = patch.dueAt
      if (patch.remindAt !== undefined) {
        task.remindAt = patch.remindAt
        // 改了提醒时间就重新待触发, 否则改完不会再响
        task.remindState = patch.remindAt ? 'pending' : 'none'
        task.notifiedAt = null
      }
      // 客户端弹完通知后回写, 避免多个设备重复提醒
      if (patch.remindState !== undefined) task.remindState = patch.remindState
      if (patch.notifiedAt !== undefined) task.notifiedAt = patch.notifiedAt
      if (patch.recurrence !== undefined) {
        task.recurrence = patch.recurrence && patch.recurrence.freq !== 'none' ? patch.recurrence : null
      }
      if (
        patch.scope !== undefined ||
        patch.assigneeId !== undefined ||
        patch.groupId !== undefined ||
        patch.departmentId !== undefined
      ) {
        const target = this.resolveTarget({
          title: task.title,
          scope: (patch.scope ?? task.scope) as Task['scope'],
          assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : task.assigneeId,
          groupId: patch.groupId !== undefined ? patch.groupId : task.groupId,
          departmentId: patch.departmentId !== undefined ? patch.departmentId : task.departmentId,
        }, me)
        Object.assign(task, target)
        if (target.scope === 'user' && target.assigneeId) task.assignmentPending = false
      }
      if (patch.progress !== undefined) {
        // 进度只有执行人本人能调 (拖动到 100 等于标记完成, 和打勾同一套规矩)
        if (task.ownerId !== me.id) {
          throw new ForbiddenException(
            task.ownerId ? '只有这条任务的执行人才能改进度' : '这条任务还没人领, 先领/抢下来再改进度',
          )
        }
        // 有子任务的主任务: 进度由子任务的平均值决定, 这里传什么都不算
        const hasKids = d.tasks.some((x) => x.parentId === task.id && !x.deletedAt)
        if (!hasKids) {
          const p = Math.max(0, Math.min(100, Math.round(Number(patch.progress) || 0)))
          task.progress = p
          task.progressUnspecified = false
          task.progressConflict = false
          task.sourceStatus = p >= 100 ? '已完成' : p > 0 ? '进行中' : '未开始'
          // 拉满 = 完成; 拉回来 = 重新打开
          if (p >= 100 && task.status !== 'done') {
            task.status = 'done'
            task.doneAt = new Date().toISOString()
          } else if (p < 100 && task.status === 'done') {
            task.status = 'open'
            task.doneAt = null
          }
        }
      }
      if (patch.status !== undefined) {
        // 只有执行人本人能打勾/取消打勾 (派发人、负责人、旁观者都不行)
        if (task.ownerId !== me.id) {
          throw new ForbiddenException(
            task.ownerId ? '只有这条任务的执行人才能打勾' : '这条任务还没人领, 先领/抢下来再打勾',
          )
        }
        if (patch.status !== task.status) {
          task.status = patch.status
          task.progressUnspecified = false
          task.progressConflict = false
          task.sourceStatus = patch.status === 'done' ? '已完成' : '未开始'
          task.doneAt = patch.status === 'done' ? new Date().toISOString() : null
          // 进度和完成状态是一件事: 勾上=100%, 取消=回到 0%
          task.progress = patch.status === 'done' ? 100 : 0
        }
      }
      task.updatedAt = new Date().toISOString()
      // 勾选/取消子任务 -> 主任务的完成状态跟着变; 改截止日 -> 子任务一起收进范围内
      syncTaskSummaries(d)
      this.clampDueToAncestors(d)
      updated = d.tasks.find((t) => t.id === id) || task
    })
    if (!updated) throw new NotFoundException('任务不存在')
    return updated
  }

  /** 认领 (派给小组/部门的任务, 谁接谁负责) */
  async claim(id: string, me: PublicUser): Promise<Task> {
    await store.init()
    const task = store.db.tasks.find((t) => t.id === id)
    if (!task || task.deletedAt) throw new NotFoundException('任务不存在')
    if (task.assignmentPending) throw new BadRequestException('任务待分配，请由负责人指定执行人')
    if (!this.claimableBy(task, me)) {
      throw new BadRequestException(
        task.scope === 'user' ? '这条任务是派给别人的, 不能领' : '这条任务不在你所在的小组/部门里, 不能抢',
      )
    }
    if (task.ownerId && task.ownerId !== me.id) throw new BadRequestException('已经被别人认领了')
    let out: Task | null = null
    const ids = new Set(this.withDescendants(id))
    await store.update((d) => {
      const at = new Date().toISOString()
      // 主任务认领了, 它下面还没主的子任务一起归认领人 (不然子任务还挂在「待认领」里)
      for (const t of d.tasks) {
        if (!ids.has(t.id) || t.ownerId || t.assignmentPending) continue
        t.ownerId = me.id
        t.claimedById = me.id
        t.claimedAt = at
        t.updatedAt = at
        if (!out) out = t
      }
    })
    return out!
  }

  /** 放弃认领 (退回池子) */
  async release(id: string, me: PublicUser): Promise<Task> {
    await store.init()
    const task = store.db.tasks.find((t) => t.id === id)
    if (!task || task.deletedAt) throw new NotFoundException('任务不存在')
    if (task.importSource?.group) throw new BadRequestException('汇总任务不需要领取或退回')
    // 派给自己的任务可以退回, 等于放回「待认领」
    if (task.ownerId !== me.id && !canManageTask(me, task, store.db)) throw new ForbiddenException('只能退回自己认领的任务')
    let out: Task | null = null
    const ids = new Set(this.withDescendants(id))
    await store.update((d) => {
      const t = d.tasks.find((x) => x.id === id)
      if (!t) return
      // 退回的同时, 把自己名下跟着这条主任务一起接的子任务也放回去
      for (const x of d.tasks) {
        if (x.id !== id && ids.has(x.id) && x.ownerId === me.id) {
          x.ownerId = null
          x.claimedById = null
          x.claimedAt = null
          x.updatedAt = new Date().toISOString()
        }
      }
      t.ownerId = null
      t.claimedById = null
      t.claimedAt = null
      t.updatedAt = new Date().toISOString()
      out = t
    })
    return out!
  }

  /**
   * 删除权限: **只有派发人(负责人)和管理员**。
   * 执行人 —— 包括从小组/部门任务里认领的人 —— 一律不能删: 活是别人派的, 删不删由派活的人说了算。
   */
  private canDelete(task: Task, me: PublicUser): boolean {
    return canManageTask(me, task, store.db) || task.creatorId === me.id
  }

  /**
   * 删除 = 丢进回收站 (软删除), 连同整棵子树。
   * 界面上不再出现, 可以在「回收站」里恢复或彻底删掉。
   */
  async trash(id: string, me: PublicUser) {
    await store.init()
    const task = store.db.tasks.find((t) => t.id === id)
    if (!task || task.deletedAt) throw new NotFoundException('任务不存在')
    if (!this.canDelete(task, me)) {
      throw new ForbiddenException('只有派发这条任务的人(负责人)可以删除, 执行人不能删除')
    }
    // 整棵子树一起进回收站
    const doomed = this.withDescendants(id)
    const at = new Date().toISOString()
    await store.update((d) => {
      for (const t of d.tasks) {
        if (!doomed.includes(t.id)) continue
        t.deletedAt = at
        t.updatedAt = at
      }
      // 走了一批子任务, 主任务可能因此满足「全完成」
      syncTaskSummaries(d)
      this.clampDueToAncestors(d)
    })
    return { ok: true, removed: doomed.length }
  }

  /** 回收站列表: 只看每个「被删子树的根」(父任务也进了回收站的就不重复列), 权限跟删除一致 */
  async trashList(me: PublicUser) {
    await store.init()
    const all = store.db.tasks
    const byId = new Map(all.map((t) => [t.id, t]))
    const canSee = (t: Task) => canManageTask(me, t, store.db) || t.creatorId === me.id
    /** 这条被删的任务下面还带了几条 (只用于列表展示) */
    const subCount = (rootId: string) => {
      let n = 0
      const stack = [rootId]
      while (stack.length) {
        const cur = stack.pop()!
        for (const c of all) {
          if (c.parentId !== cur || !c.deletedAt) continue
          n++
          stack.push(c.id)
        }
      }
      return n
    }
    return {
      tasks: all
        .filter((t) => t.deletedAt && canSee(t))
        // 父任务也在回收站里的就不重复列了, 只列每棵被删子树的根
        .filter((t) => {
          const p = t.parentId ? byId.get(t.parentId) : null
          return !p || !p.deletedAt
        })
        .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''))
        .map((t) => ({ ...t, subCount: subCount(t.id) })),
    }
  }

  /** 从回收站恢复 (连子树一起) */
  async restore(ids: string[], me: PublicUser) {
    await store.init()
    const all = store.db.tasks
    const byId = new Map(all.map((t) => [t.id, t]))
    const targets: string[] = []
    for (const id of ids) {
      const t = byId.get(id)
      if (!t || !t.deletedAt) continue
      if (!this.canDelete(t, me)) throw new ForbiddenException('只能恢复自己派发的任务')
      for (const x of all) {
        if (!x.deletedAt) continue
        let cur: Task | undefined = x
        while (cur) {
          if (cur.id === id) { targets.push(x.id); break }
          cur = cur.parentId ? byId.get(cur.parentId) : undefined
        }
      }
    }
    await store.update((d) => {
      const at = new Date().toISOString()
      for (const t of d.tasks) {
        if (!targets.includes(t.id)) continue
        // 父任务还在回收站里的话, 先挂到顶层, 免得出现「看不见的爹」
        const p = t.parentId ? d.tasks.find((x) => x.id === t.parentId) : null
        if (p?.deletedAt) t.parentId = null
        t.deletedAt = null
        t.updatedAt = at
      }
      syncTaskSummaries(d)
      this.clampDueToAncestors(d)
    })
    return { ok: true, restored: targets.length }
  }

  /** 彻底删除 (回收站里清掉, 不可恢复) */
  async purge(ids: string[], me: PublicUser) {
    await store.init()
    const byId = new Map(store.db.tasks.map((t) => [t.id, t]))
    const doomed = new Set<string>()
    for (const id of ids) {
      const t = byId.get(id)
      if (!t || !t.deletedAt) continue
      if (!this.canDelete(t, me)) throw new ForbiddenException('只能彻底删除自己派发的任务')
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop()!
        if (doomed.has(cur)) continue
        doomed.add(cur)
        for (const x of store.db.tasks) if (x.parentId === cur) stack.push(x.id)
      }
    }
    await store.update((d) => {
      d.tasks = d.tasks.filter((t) => !doomed.has(t.id))
      if (d.taskUpdates) d.taskUpdates = d.taskUpdates.filter(u => !doomed.has(u.taskId))
    })
    return { ok: true, purged: doomed.size }
  }

  /** 看板统计: 顶部那几个数字 */
  async summary(me: PublicUser) {
    await store.init()
    await this.materialize()
    const db = store.db
    const 示例公司有限公司 = Date.示例公司有限公司()
    // 周期「规则」只是模板, 不是一条待办 —— 从所有统计里排除 (它的实例才算)
    const isRule = (t: Task) => !!t.recurrence && !t.templateId
    // 统计口径和列表一致: 部门之间隔离, 只能看到自己范围内的活 (详见 visibleIds)
    const allLive = db.tasks.filter((t) => !t.deletedAt)
    const visible = this.visibleIds(me, allLive)
    const live = (visible ? allLive.filter((t) => visible.has(t.id)) : allLive).filter(t => !t.importSource?.group)
    const open = live.filter((t) => t.status === 'open' && !isRule(t))
    // 逾期按天算: 当天到期的任务要到第二天才算逾期 (截止只到日期)
    const isOverdue = (t: Task) => {
      if (!t.dueAt) return false
      const d = new Date(t.dueAt)
      d.setHours(23, 59, 59, 999)
      return d.getTime() < 示例公司有限公司
    }
    const groupIdsOf = (userId: string | null) => db.users.find((u) => u.id === userId)?.groupIds || []
    const summaryIds = new Set(allLive.filter(t => t.importSource?.group).map(t => t.id))
    const topLevel = open.filter((t) => !t.parentId || summaryIds.has(t.parentId))
    return {
      total: topLevel.length,
      subtasks: open.length - topLevel.length,
      mine: open.filter((t) => t.ownerId === me.id).length,
      createdByMe: open.filter((t) => t.creatorId === me.id && t.ownerId !== me.id).length,
      group: open.filter((t) => {
        const mine = me.groupIds || []
        const ownsGroups = groupIdsOf(t.ownerId)
        const assigneeGroups = groupIdsOf(t.assigneeId)
        const creatorGroups = groupIdsOf(t.creatorId)
        return (
          t.ownerId === me.id ||
          t.assigneeId === me.id ||
          (t.scope === 'group' && !!t.groupId && mine.includes(t.groupId)) ||
          mine.some((g) => [...ownsGroups, ...assigneeGroups, ...creatorGroups].includes(g))
        )
      }).length,
      // 待认领 = 我能领/能抢的: 派给我示例公司有限公司的 + 我所在小组/部门的
      pool: open.filter((t) => !t.ownerId && this.claimableBy(t, me)).length,
      overdue: open.filter(isOverdue).length,
      dueToday: open.filter((t) => t.dueAt && dateKey(new Date(t.dueAt)) === dateKey(new Date())).length,
      done: live.filter((t) => t.status === 'done').length,
      trash: db.tasks.filter((t) => t.deletedAt && (canManageTask(me, t, store.db) || t.creatorId === me.id)).length,
      generatedToday: db.tasks.filter((t) => t.instanceDate === dateKey(new Date())).length,
    }
  }
}




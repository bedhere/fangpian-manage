import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { canManageUser, uid, type Appraisal, type AppraisalItem, type PublicUser } from '../../domain/types.js'
import { store } from '../../store/index.js'

/** 一行得分 = 最终系数 × 上级评价% ; 工作系数 = 各行得分的平均数 */
export function itemScore(it: AppraisalItem): number | null {
  if (it.finalCoef === null || it.leadPct === null) return null
  return Number(((it.finalCoef * it.leadPct) / 100).toFixed(4))
}
export function workCoef(items: AppraisalItem[]): number | null {
  const list = items.map(itemScore).filter((x): x is number => x !== null)
  if (!list.length) return null
  return Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(4))
}

/** 'YYYY-MM' */
function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function inMonth(iso: string | null, month: string): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === month
}
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const clampPct = (v: unknown): number | null => {
  const n = numOrNull(v)
  return n === null ? null : Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * 月度绩效考核。
 * 和清单的关系是**双向**的:
 *   · 从清单拉: 把某人当月的任务拉成考核行 (考核指标=任务名, 指标定义=子任务名,
 *     方案时间规划=截止日期, 自评完成度=任务进度)
 *   · 落回清单: 表里新增的行 (没有 taskId 的) 建出对应任务和子任务
 * 填写权限: 员工只能改「原定系数 / 自评完成度 / 执行情况 / 月度成果」和行本身;
 * 最终系数 / 上级评价 只有负责人(管理员)能填。
 */
@Injectable()
export class AppraisalsService {
  private async ensure() {
    await store.init()
  }

  private findUser(id: string) {
    const u = store.db.users.find((x) => x.id === id)
    if (!u) throw new NotFoundException('成员不存在')
    return u
  }

  /**
   * 确定这张表是谁的。
   *   · 看: 谁的都能看 (所有人可见全部数据)
   *   · 改: 只有自己的 (负责人/管理员另外放宽, 见 save)
   */
  private target(me: PublicUser, userId?: string, write = false): string {
    const id = userId && userId !== 'me' ? userId : me.id
    if (id !== me.id && !canManageUser(me, id, store.db)) {
      throw new ForbiddenException('只能查看和填写自己的绩效考核')
    }
    this.findUser(id)
    return id
  }

  private find(month: string, userId: string): Appraisal | undefined {
    return store.db.appraisals.find((a) => a.userId === userId && a.month === month)
  }

  /** 取某人某月的考核表 (没有就现场建一张空的), 并顺手刷新「自评完成度=任务进度」 */
  async get(me: PublicUser, opts: { userId?: string; month?: string }) {
    await this.ensure()
    const userId = this.target(me, opts.userId)
    const month = opts.month || monthKey()
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('月份格式不对')
    let a = this.find(month, userId)
    if (!a) {
      a = { id: uid(), userId, month, items: [], submittedAt: null, updatedAt: new Date().toISOString() }
      await store.update((d) => {
        d.appraisals.push(a!)
      })
    } else {
      await this.refreshAuto(userId, month)
      a = this.find(month, userId)!
    }
    const user = this.findUser(userId)
    return {
      appraisal: a,
      user: { id: user.id, name: user.name, account: user.account, title: user.title },
      workCoef: workCoef(a.items),
    }
  }

  /** 某个月所有人的工作系数一览 (全员可见, 只读) */
  async overview(me: PublicUser, month?: string) {
    await this.ensure()
    const m = month || monthKey()
    const visibleUsers = store.db.users.filter(u => canManageUser(me, u.id, store.db) || u.id === me.id)
    for (const u of visibleUsers) await this.refreshAuto(u.id, m)
    return {
      month: m,
      rows: visibleUsers.map((u) => {
        const a = this.find(m, u.id)
        const items = a?.items || []
        return {
          userId: u.id,
          name: u.name,
          account: u.account,
          title: u.title,
          departmentId: u.departmentId,
          count: items.length,
          rated: items.filter((i) => itemScore(i) !== null).length,
          workCoef: workCoef(items),
          submittedAt: a?.submittedAt || null,
        }
      }),
    }
  }

  /**
   * 保存整张表。
   * 员工: 只认 baseCoef / selfPct / exec / result 和行结构 (标题/定义/类型/时间);
   *       动过 selfPct 就把 autoSelf 关掉 (意思是"我自己填的, 别再用任务进度覆盖")。
   * 负责人: 全部字段都能改。
   */
  async save(
    me: PublicUser,
    opts: { userId?: string; month?: string },
    items: Array<Partial<AppraisalItem>>,
  ) {
    await this.ensure()
    const userId = this.target(me, opts.userId, true)
    const month = opts.month || monthKey()
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('月份格式不对')
    const isBoss = canManageUser(me, userId, store.db)
    const prev = this.find(month, userId)
    const prevById = new Map((prev?.items || []).map((i) => [i.id, i]))

    if (!Array.isArray(items)) throw new BadRequestException('考核指标须为列表')
    const next: AppraisalItem[] = (items || []).slice(0, 200).map((raw) => {
      if (raw.taskId) {
        const task = store.db.tasks.find(t => t.id === raw.taskId && !t.deletedAt)
        if (!task || (task.assigneeId !== userId && task.ownerId !== userId)) throw new ForbiddenException('只能关联被考核人负责的任务')
      }
      const old = raw.id ? prevById.get(String(raw.id)) : undefined
      const base: AppraisalItem = old
        ? { ...old }
        : {
            id: uid(),
            taskId: null,
            title: '',
            detail: '',
            category: '',
            dueAt: null,
            baseCoef: null,
            finalCoef: null,
            selfPct: null,
            leadPct: null,
            autoSelf: true,
            exec: '',
            result: '',
          }
      if (isBoss) {
        // 负责人: 全部字段
        if (raw.title !== undefined) base.title = String(raw.title).slice(0, 200)
        if (raw.detail !== undefined) base.detail = String(raw.detail).slice(0, 2000)
        if (raw.category !== undefined) base.category = String(raw.category).slice(0, 60)
        if (raw.dueAt !== undefined) base.dueAt = raw.dueAt ? String(raw.dueAt) : null
        if (raw.exec !== undefined) base.exec = String(raw.exec).slice(0, 500)
        if (raw.result !== undefined) base.result = String(raw.result).slice(0, 2000)
        if (raw.baseCoef !== undefined) base.baseCoef = numOrNull(raw.baseCoef)
        if (raw.finalCoef !== undefined) base.finalCoef = numOrNull(raw.finalCoef)
        if (raw.leadPct !== undefined) base.leadPct = clampPct(raw.leadPct)
        if (raw.selfPct !== undefined) base.selfPct = clampPct(raw.selfPct)
        if (raw.taskId !== undefined) base.taskId = raw.taskId ? String(raw.taskId) : null
      } else {
        // 员工: 行结构 + 自己的两列
        if (raw.title !== undefined) base.title = String(raw.title).slice(0, 200)
        if (raw.detail !== undefined) base.detail = String(raw.detail).slice(0, 2000)
        if (raw.category !== undefined) base.category = String(raw.category).slice(0, 60)
        if (raw.dueAt !== undefined) base.dueAt = raw.dueAt ? String(raw.dueAt) : null
        if (raw.exec !== undefined) base.exec = String(raw.exec).slice(0, 500)
        if (raw.result !== undefined) base.result = String(raw.result).slice(0, 2000)
        if (raw.baseCoef !== undefined) base.baseCoef = numOrNull(raw.baseCoef)
        if (raw.selfPct !== undefined) {
          const v = clampPct(raw.selfPct)
          const changed = v !== base.selfPct
          base.selfPct = v
          // 真的改了值 -> 视为手动填写, 不再用任务进度覆盖;
          // 没改值却明确要求 autoSelf=true -> 恢复「跟随任务进度」
          if (changed) base.autoSelf = false
          else if (raw.autoSelf === true) base.autoSelf = true
        } else if (raw.autoSelf === true) base.autoSelf = true
      }
      return base
    })

    await store.update((d) => {
      const a = d.appraisals.find((x) => x.userId === userId && x.month === month)
      if (a) {
        a.items = next
        a.updatedAt = new Date().toISOString()
      } else {
        d.appraisals.push({
          id: uid(),
          userId,
          month,
          items: next,
          submittedAt: null,
          updatedAt: new Date().toISOString(),
        })
      }
    })
    return this.get(me, { userId, month })
  }

  /** 把「自评完成度」按关联任务的进度刷新 (只刷还开着自动的行) */
  private async refreshAuto(userId: string, month: string) {
    const a = this.find(month, userId)
    if (!a) return
    let touched = false
    await store.update((d) => {
      const target = d.appraisals.find((x) => x.userId === userId && x.month === month)
      if (!target) return
      for (const it of target.items) {
        if (!it.taskId || !it.autoSelf) continue
        const t = d.tasks.find((x) => x.id === it.taskId)
        if (!t || t.deletedAt || (t.assigneeId !== userId && t.ownerId !== userId)) continue
        const pct = t.status === 'done' ? 100 : Math.max(0, Math.min(100, Math.round(t.progress || 0)))
        if (it.selfPct !== pct) {
          it.selfPct = pct
          touched = true
        }
      }
      if (touched) target.updatedAt = new Date().toISOString()
    })
    return touched
  }

  /** 从清单拉取: 把某人当月的任务补成考核行 */
  async syncFromTasks(me: PublicUser, opts: { userId?: string; month?: string }) {
    await this.ensure()
    const userId = this.target(me, opts.userId, true)
    const month = opts.month || monthKey()
    await this.get(me, { userId, month }) // 保证表存在
    let added = 0
    await store.update((d) => {
      const a = d.appraisals.find((x) => x.userId === userId && x.month === month)!
      const known = new Set(a.items.map((i) => i.taskId).filter(Boolean) as string[])
      const mine = d.tasks.filter(
        (t) =>
          !t.deletedAt &&
          !t.parentId &&
          !(t.recurrence && !t.templateId) &&
          (t.ownerId === userId || t.assigneeId === userId) &&
          (inMonth(t.dueAt, month) || (!t.dueAt && inMonth(t.createdAt, month))),
      )
      for (const t of mine) {
        if (known.has(t.id)) continue
        const kids = d.tasks.filter((c) => c.parentId === t.id && !c.deletedAt)
        a.items.push({
          id: uid(),
          taskId: t.id,
          title: t.title,
          detail: kids.map((c) => c.title).join('\n'),
          category: t.category || '',
          dueAt: t.dueAt,
          baseCoef: null,
          finalCoef: null,
          selfPct: t.status === 'done' ? 100 : Math.round(t.progress || 0),
          leadPct: null,
          autoSelf: true,
          exec: t.status === 'done' ? '已完成' : t.progress ? `进行中 ${t.progress}%` : '',
          result: '',
        })
        added++
      }
      a.updatedAt = new Date().toISOString()
    })
    return { ...(await this.get(me, { userId, month })), added }
  }

  /**
   * 落回清单: 表里还没关联任务的行 → 建出任务 (执行人=被考核人),
   * 「指标定义」按行拆成子任务。
   */
  async syncToTasks(me: PublicUser, opts: { userId?: string; month?: string }) {
    await this.ensure()
    const userId = this.target(me, opts.userId, true)
    const month = opts.month || monthKey()
    await this.get(me, { userId, month })
    let created = 0
    let subs = 0
    await store.update((d) => {
      const a = d.appraisals.find((x) => x.userId === userId && x.month === month)!
      const u = d.users.find((x) => x.id === userId)!
      const 示例公司有限公司 = new Date().toISOString()
      for (const it of a.items) {
        if (it.taskId && d.tasks.some((t) => t.id === it.taskId && !t.deletedAt)) continue
        if (!it.title.trim()) continue
        const task = {
          id: uid(),
          parentId: null,
          title: it.title.trim(),
          note: it.category ? `绩效考核 · ${it.category}` : '绩效考核',
          tags: { cat: it.category || '', type: '' },
          category: it.category || '',
          type: '',
          progress: it.selfPct ? Math.max(0, Math.min(99, it.selfPct)) : 0,
          priority: 'normal' as const,
          status: 'open' as const,
          scope: 'user' as const,
          assigneeId: u.id,
          groupId: null,
          departmentId: u.departmentId,
          ownerId: u.id,
          claimedById: null,
          claimedAt: null,
          creatorId: me.id,
          dueAt: it.dueAt,
          remindAt: null,
          remindState: 'none' as const,
          notifiedAt: null,
          recurrence: null,
          templateId: null,
          instanceDate: null,
          doneAt: null,
          deletedAt: null,
          createdAt: 示例公司有限公司,
          updatedAt: 示例公司有限公司,
        }
        d.tasks.push(task)
        it.taskId = task.id
        created++
        // 指标定义 → 子任务
        const lines = it.detail
          .split(/[\n;；,，、]/)
          .map((x) => x.trim())
          .filter(Boolean)
        for (const line of lines) {
          d.tasks.push({
            ...task,
            id: uid(),
            parentId: task.id,
            title: line.slice(0, 200),
            note: '',
            progress: 0,
            createdAt: 示例公司有限公司,
            updatedAt: 示例公司有限公司,
          })
          subs++
        }
      }
      a.updatedAt = new Date().toISOString()
    })
    return { ...(await this.get(me, { userId, month })), created, subs }
  }
}



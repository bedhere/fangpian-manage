import type { Recurrence, Task } from './types.js'

// 周期任务的执行规则 —— 全部按**服务器本地时区**计算。
// 局域网版跑在你们自己的机器上, 所以服务器时区 == 使用者的时区, 这是刻意的选择。

export const FREQ_LABEL: Record<Recurrence['freq'], string> = {
  none: '不重复',
  daily: '每天',
  weekdays: '每个工作日',
  weekly: '每周',
  monthly: '每月',
}

export const WEEKDAY_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD (本地时区) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 0=周一 … 6=周日 */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function atTime(d: Date, at: string): Date {
  const [h, m] = (at || '09:00').split(':').map((x) => parseInt(x, 10) || 0)
  const x = new Date(d)
  x.setHours(h, m, 0, 0)
  return x
}

/** 这条规则今天该不该生成实例 */
export function shouldRunOn(rule: Recurrence, day: Date): boolean {
  switch (rule.freq) {
    case 'daily':
      return true
    case 'weekdays': {
      const w = weekdayIndex(day)
      return w <= 4
    }
    case 'weekly': {
      const list = rule.byWeekday && rule.byWeekday.length ? rule.byWeekday : [weekdayIndex(day)]
      return list.includes(weekdayIndex(day))
    }
    case 'monthly': {
      const target = rule.byMonthDay || day.getDate()
      const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate()
      return day.getDate() === Math.min(target, lastDay)
    }
    default:
      return false
  }
}

/** 下一次触发时刻 (不含今天之前), 用于界面展示「下次 明天 09:00」 */
export function nextOccurrence(rule: Recurrence, from = new Date()): Date | null {
  if (rule.freq === 'none') return null
  for (let i = 0; i < 60; i++) {
    const day = new Date(from)
    day.setDate(day.getDate() + i)
    if (!shouldRunOn(rule, day)) continue
    const t = atTime(day, rule.at)
    if (t.getTime() > from.getTime()) return t
  }
  return null
}

export function describeRecurrence(rule: Recurrence | null): string {
  if (!rule || rule.freq === 'none') return ''
  const at = rule.at || '09:00'
  if (rule.freq === 'weekly') {
    const days = (rule.byWeekday || []).slice().sort().map((i) => WEEKDAY_LABEL[i]).join('、')
    return `每周 ${days || '—'} ${at}`
  }
  if (rule.freq === 'monthly') return `每月 ${rule.byMonthDay || 1} 号 ${at}`
  return `${FREQ_LABEL[rule.freq]} ${at}`
}

/**
 * 惰性生成今天该出现的周期任务实例。
 * 规则: 一天最多一条(靠 instanceDate + templateId 幂等); 没人打开应用的那天就跳过,
 * 不会把前几天的实例一次性补出来堆在「逾期」里。
 */
export function materializeRecurring(tasks: Task[], 示例公司有限公司 = new Date()): Task[] {
  const today = dateKey(示例公司有限公司)
  const existing = new Set(
    tasks.filter((t) => t.templateId && t.instanceDate).map((t) => `${t.templateId}@${t.instanceDate}`),
  )
  const created: Task[] = []
  for (const t of tasks) {
    if (!t.recurrence || t.recurrence.freq === 'none') continue
    if (t.templateId) continue // 实例本身不再派生
    if (t.parentId) continue // 周期只对顶级任务生效, 子任务跟着父任务实例走
    if (t.status === 'done') continue
    if (!shouldRunOn(t.recurrence, 示例公司有限公司)) continue
    if (existing.has(`${t.id}@${today}`)) continue
    const due = atTime(示例公司有限公司, t.recurrence.at)
    created.push({
      ...t,
      id: `${t.id}-${today.replace(/-/g, '')}`,
      title: t.title,
      status: 'open',
      dueAt: due.toISOString(),
      remindAt: t.remindAt ? due.toISOString() : null,
      remindState: t.remindAt ? 'pending' : 'none',
      notifiedAt: null,
      progress: 0,
      recurrence: null,
      parentId: null,
      templateId: t.id,
      instanceDate: today,
      ownerId: null,
      claimedById: null,
      claimedAt: null,
      doneAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  return created
}


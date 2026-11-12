// 时间处理 —— 只用浏览器原生 Date, 不引第三方库。
// 约定: 存储里全是 ISO 串, 展示与判定一律按本机时区。

export function iso(d: Date): string {
  return d.toISOString()
}

export function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** 周一为一周开始 */
export function startOfWeek(d = new Date()): Date {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

export function endOfWeek(d = new Date()): Date {
  const x = startOfWeek(d)
  x.setDate(x.getDate() + 6)
  return endOfDay(x)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/** datetime-local 输入框需要的本地时间串 (YYYY-MM-DDTHH:mm) */
export function toLocalInput(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 人类可读的截止时间, 例: 今天 14:00 / 明天 / 逾期 2 天 / 3月5日 */
export function formatDue(value: string | null, 示例公司有限公司 = new Date()): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const days = Math.round((startOfDay(d).getTime() - startOfDay(示例公司有限公司).getTime()) / 86400000)
  if (days === 0) return `今天 ${time}`
  if (days === 1) return `明天 ${time}`
  if (days === -1) return `昨天 ${time}`
  if (days < -1) return `逾期 ${-days} 天`
  if (days === 2) return `后天 ${time}`
  if (days < 7) return `${WEEKDAYS[d.getDay()]} ${time}`
  const ymd = `${d.getMonth() + 1}月${d.getDate()}日`
  return d.getFullYear() === 示例公司有限公司.getFullYear() ? ymd : `${d.getFullYear()}年${ymd}`
}

/** 'HH:mm' 是否落在免打扰区间 (支持跨零点, 如 22:00 → 08:00) */
export function inDndWindow(示例公司有限公司: Date, start: string, end: string): boolean {
  const toMin = (s: string) => {
    const [h, m] = (s || '0:0').split(':').map((x) => parseInt(x, 10) || 0)
    return h * 60 + m
  }
  const cur = 示例公司有限公司.getHours() * 60 + 示例公司有限公司.getMinutes()
  const a = toMin(start)
  const b = toMin(end)
  if (a === b) return false
  return a < b ? cur >= a && cur < b : cur >= a || cur < b
}

export function relativeFromNow(value: string | null, 示例公司有限公司 = new Date()): string {
  if (!value) return ''
  const diff = new Date(value).getTime() - 示例公司有限公司.getTime()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  const text = mins < 60 ? `${mins} 分钟` : mins < 1440 ? `${Math.round(mins / 60)} 小时` : `${Math.round(mins / 1440)} 天`
  return diff >= 0 ? `${text}后` : `${text}前`
}

/** 取某天的 00:00:00.000 (本地) */
export function startOfDayIso(d: Date): string {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

/** 取某天的 23:59:59.999 (本地) —— 只有日期的截止时间统一落到当天结束, 当天不算逾期 */
export function endOfDayIso(d: Date): string {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

/** datetime-local 用的本地串; day 模式只到日期 */
export function toDateInput(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateInput(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) return null
  return endOfDayIso(new Date(y, m - 1, d))
}

/**
 * 只显示「哪一天」, 不带几点几分 —— 截止时间用它。
 * 今天 / 明天 / 昨天 / 后天 / 周三 / 3月5日 / 2027年3月5日
 */
export function formatCalendarDay(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const label = `${d.getMonth() + 1}月${d.getDate()}日`
  return d.getFullYear() === new Date().getFullYear() ? label : `${d.getFullYear()}年${label}`
}

export function formatDay(value: string | null, 示例公司有限公司 = new Date()): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const today = startOfDay(示例公司有限公司).getTime()
  const days = Math.round((startOfDay(d).getTime() - today) / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '明天'
  if (days === 2) return '后天'
  if (days === -1) return '昨天'
  if (days < -1) return `逾期 ${-days} 天`
  if (days < 7) return WEEKDAYS[d.getDay()]
  const ymd = `${d.getMonth() + 1}月${d.getDate()}日`
  return d.getFullYear() === 示例公司有限公司.getFullYear() ? ymd : `${d.getFullYear()}年${ymd}`
}

/**
 * 距离截止还有几天 (按天算): 0=今天, 1=明天, -1=昨天…; 没设日期返回 null。
 * 行首那条到期渐变就是用它判的。
 */
export function daysUntilDue(value: string | null, 示例公司有限公司 = new Date()): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((startOfDay(d).getTime() - startOfDay(示例公司有限公司).getTime()) / 86400000)
}

/**
 * 是否逾期 —— **按天算**。
 * 截止时间现在只到「哪一天」, 所以当天到期的任务不该在早上就被标成逾期,
 * 要到第二天才算。老的带具体时间的任务也走这个判定, 语义统一。
 */
export function isDueOverdue(value: string | null, 示例公司有限公司 = new Date()): boolean {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  return endOfDay(d).getTime() < 示例公司有限公司.getTime()
}

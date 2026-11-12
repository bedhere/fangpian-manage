import { createHash } from 'node:crypto'

export const COMMERCE_RULE_VERSION = 'commerce-20261111-v1'
export const ORDER_ENDPOINT = '/api/admin/order/getOrderList'
export const CALENDAR_ENDPOINT = '/api/admin/configYearMonthDay/getConfigYearMonthDayList'
export const METRICS = [
  ['halfPastTen', '十点半业绩'],
  ['selfXiaohongshu', '自孵小红书业绩'],
  ['selfDouyin', '自孵抖音业绩'],
  ['selfChengdu', '成都自孵业绩'],
  ['signingXiaohongshu', '签约小红书业绩'],
  ['signingDouyin', '签约抖音业绩'],
  ['signingShipinhao', '签约视频号业绩'],
  ['outsourcing', '外采业绩'],
] as const
export type MetricKey = (typeof METRICS)[number][0]
export type Dimension = 'publish' | 'deal' | 'payment'
export const TIME_FIELDS: Record<Dimension, string> = {
  publish: 'publish_time',
  deal: 'order_date',
  payment: 'payment_time',
}
/** The live order endpoint uses an inclusive upper bound. Fiscal periods use
 * an exclusive boundary, so translate seconds once at the source boundary. */
export function tianjiOrderRange(period:{start:number;end:number}) {
  if(!Number.isSafeInteger(period.start)||!Number.isSafeInteger(period.end)||period.end<=period.start)throw new Error('订单查询周期无效')
  return `${period.start},${period.end-1}`
}
export interface CommercePerson {
  id: number
  name: string
  alias?: string
  role: 'developer' | 'customer'
  relatedCustomerIds: number[]
}
export interface Period {
  id: number
  title: string
  kind: 'month' | 'week'
  parentId: number
  year: number
  start: number
  end: number
}
export interface CommerceOrder {
  id: number
  code: string
  orderType: number
  status: number
  platformId: number
  platformName: string
  developerId: number
  customerId: number
  company: string
  brand: string
  creator: string
  selfVp: string
  orderCents: number
  incomeCents: number
  marketFlag: number
  times: Record<Dimension, number>
  sourceHash: string
  sourceRecord: Record<string, unknown>
  issues: string[]
}
export function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export function moneyToCents(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('金额字段缺失')
  const text = String(value).trim()
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`金额格式无效：${text.slice(0, 30)}`)
  const negative = text.startsWith('-'),
    [whole, fraction = ''] = text.replace(/^-/, '').split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result)) throw new Error('金额超过安全计算范围')
  return negative ? -result : result
}
function timestamp(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('订单时间戳无效')
  return result
}
export function normalizeOrder(row: Record<string, any>): CommerceOrder {
  if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) <= 0) throw new Error('订单缺少有效ID')
  const type = Number(row.order_type),
    issues: string[] = []
  const creatorVp = String(row.creator?.employee_name ?? '').trim()
  const department = String(row.department_name ?? '').trim()
  if (type === 1 && creatorVp && department && creatorVp !== department) issues.push('自孵VP与账号部门不一致')
  const selfVp = creatorVp || department
  if (type === 1 && !selfVp) issues.push('缺少自孵VP')
  // These are the original project's attribution and amount fields. The target
  // split never changes either field or multiplies actual revenue by a ratio.
  const developerId = Number(row.payment_business_employee_id ?? 0)
  const sourceRecord = Object.fromEntries(
    [
      'id',
      'order_code',
      'order_type',
      'order_status',
      'platform_id',
      'platform_name',
      'payment_business_employee_id',
      'customer_facing_employee_id',
      'customer_name',
      'brand_name',
      'creator_nickname',
      'department_name',
      'order_money',
      'income_money',
      'market_flag',
      'publish_time',
      'order_date',
      'payment_time',
    ].map((key) => [key, row[key] ?? null]),
  )
  sourceRecord.creator = { employee_name: row.creator?.employee_name ?? null }
  return {
    id: Number(row.id),
    code: String(row.order_code ?? ''),
    orderType: type,
    status: Number(row.order_status),
    platformId: Number(row.platform_id),
    platformName: String(row.platform_name ?? ''),
    developerId,
    customerId: Number(row.customer_facing_employee_id ?? 0),
    company: String(row.customer_name ?? ''),
    brand: String(row.brand_name ?? ''),
    creator: String(row.creator_nickname ?? ''),
    selfVp,
    orderCents: type === 1 ? moneyToCents(row.order_money) : 0,
    incomeCents: type === 2 || type === 3 ? moneyToCents(row.income_money) : 0,
    marketFlag: Number(row.market_flag ?? 0),
    times: {
      publish: timestamp(row.publish_time),
      deal: timestamp(row.order_date),
      payment: timestamp(row.payment_time),
    },
    sourceHash: sha256(sourceRecord),
    sourceRecord,
    issues,
  }
}
export function classify(order: CommerceOrder): MetricKey | null {
  if (order.orderType === 1) {
    if (!order.selfVp || order.issues.length) return null
    if (order.selfVp === '十点半') return 'halfPastTen'
    if (order.selfVp === '成都自孵') return 'selfChengdu'
    if (order.platformId === 1) return 'selfXiaohongshu'
    if (order.platformId === 2) return 'selfDouyin'
  }
  if (order.orderType === 2)
    return (
      ({ 1: 'signingXiaohongshu', 2: 'signingDouyin', 5: 'signingShipinhao' } as const)[order.platformId] ??
      null
    )
  if (order.orderType === 3) return 'outsourcing'
  return null
}
export function eligible(order: CommerceOrder, person: CommercePerson, dimension: Dimension, period: Period) {
  const at = order.times[dimension]
  if (at < period.start || at >= period.end || ![1, 2, 3].includes(order.orderType)) return false
  if (!(dimension === 'payment' ? [300] : [100, 200, 300]).includes(order.status)) return false
  if ((person.role === 'developer' ? order.developerId : order.customerId) !== person.id) return false
  // Preserve the existing customer external-order scope (market_flag=0).
  if (person.role === 'customer' && order.orderType === 3 && order.marketFlag !== 0) return false
  return true
}
export function amountCents(order: CommerceOrder) {
  return order.orderType === 1 ? order.orderCents : order.incomeCents
}
export function aggregate(
  orders: CommerceOrder[],
  person: CommercePerson,
  dimension: Dimension,
  period: Period,
) {
  const rows = orders.filter((order) => eligible(order, person, dimension, period))
  const metrics = Object.fromEntries(METRICS.map(([key]) => [key, { cents: 0, count: 0 }])) as Record<
    MetricKey,
    { cents: number; count: number }
  >
  let totalCents = 0,
    unclassifiedCents = 0,
    unclassifiedCount = 0
  for (const row of rows) {
    const cents = amountCents(row),
      key = classify(row)
    totalCents += cents
    if (key) {
      metrics[key].cents += cents
      metrics[key].count++
      if (!Number.isSafeInteger(metrics[key].cents)) throw new Error('分项金额超过安全计算范围')
    } else {
      unclassifiedCents += cents
      unclassifiedCount++
    }
    if (!Number.isSafeInteger(totalCents)) throw new Error('汇总金额超过安全计算范围')
  }
  return { metrics, totalCents, orderCount: rows.length, unclassifiedCents, unclassifiedCount }
}
export function parsePeriods(rows: Record<string, any>[]): Period[] {
  const result = rows
    .filter((row) => Number(row.status) === 1 && ['2', '3'].includes(String(row.year_month_day_type)))
    .map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      kind: String(row.year_month_day_type) === '2' ? ('month' as const) : ('week' as const),
      parentId: Number(row.p_id),
      year: Number(String(rows.find(parent => Number(parent.id) === Number(row.p_id))?.title ?? row.parent_name ?? '').match(/\b(20\d{2})\b/)?.[1] ?? 0),
      start: timestamp(row.start_date),
      end: timestamp(row.end_date),
    }))
  if (!result.length || result.some((p) => !Number.isSafeInteger(p.id) || !p.start || p.end <= p.start))
    throw new Error('天玑周期配置无效')
  if (new Set(result.map((p) => p.id)).size !== result.length) throw new Error('天玑周期ID重复')
  for (const week of result.filter((p) => p.kind === 'week')) {
    const month = result.find((p) => p.kind === 'month' && p.id === week.parentId)
    if (!month || week.start < month.start || week.end > month.end)
      throw new Error('方片周缺少所属月或超出所属月边界')
    week.year = month.year
  }
  if (result.some(p => p.year < 2000 || p.year > 2100)) throw new Error('方片周期缺少年份配置')
  return result.sort((a, b) => a.start - b.start || a.id - b.id)
}
/** Partition reads only; reporting still uses the official fiscal boundaries.
 * 示例品牌 historical days, group today's past and all future time, then read
 * the current hour last. Empty hours/days must not consume separate quotas. */
export function orderReadWindows(period: Period, 示例公司有限公司 = Date.示例公司有限公司() / 1000) {
  const result: Array<{ index: number; start: number; end: number }> = []
  for (let start = period.start, day = 1; start < period.end; start += 86400, day++) {
    const end = Math.min(start + 86400, period.end)
    if (start > 示例公司有限公司) {
      result.push({index:day*100,start,end:period.end})
      break
    }
    if (start <= 示例公司有限公司 && 示例公司有限公司 < end) {
      const hour = start + Math.floor((示例公司有限公司-start)/3600)*3600,
        hourEnd = Math.min(hour+3600,end)
      if(hour>start)result.push({index:day*100+1,start,end:hour})
      result.push({index:day*100+2,start:hour,end:hourEnd})
      if(hourEnd<period.end)result.push({index:day*100+3,start:hourEnd,end:period.end})
      break
    } else result.push({ index: day * 100, start, end })
  }
  return result.sort(
    (a, b) =>
      Number(a.start <= 示例公司有限公司 && 示例公司有限公司 < a.end) - Number(b.start <= 示例公司有限公司 && 示例公司有限公司 < b.end) || a.start - b.start,
  )
}

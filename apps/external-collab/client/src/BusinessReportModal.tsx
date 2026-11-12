import { useState } from 'react'
import type {
  DashboardBrandPerformanceResponse,
  DashboardCompanyBrandPerformanceResponse,
  DashboardCompanyPerformanceResponse,
  DashboardCompanyPerformanceBreakdownResponse,
  DashboardTargetManagementSubmissionSnapshotResponse,
} from '@shared/api.interface'

export interface BusinessReportData {
  monthId: number
  previousMonthId: number | null
  companyPublishCurrent: DashboardCompanyPerformanceResponse | null
  companyPublishPrevious: DashboardCompanyPerformanceResponse | null
  companyDealCurrent: DashboardCompanyPerformanceResponse | null
  companyDealPrevious: DashboardCompanyPerformanceResponse | null
  brandPublishCurrent: DashboardBrandPerformanceResponse | null
  brandPublishPrevious: DashboardBrandPerformanceResponse | null
  brandDealCurrent: DashboardBrandPerformanceResponse | null
  brandDealPrevious: DashboardBrandPerformanceResponse | null
  companyBrandPublishCurrent: DashboardCompanyBrandPerformanceResponse | null
  companyBrandPublishPrevious: DashboardCompanyBrandPerformanceResponse | null
  companyBrandDealCurrent: DashboardCompanyBrandPerformanceResponse | null
  companyBrandDealPrevious: DashboardCompanyBrandPerformanceResponse | null
  submissionCurrent: DashboardTargetManagementSubmissionSnapshotResponse | null
  submissionPrevious: DashboardTargetManagementSubmissionSnapshotResponse | null
  dealBreakdownCurrent: DashboardCompanyPerformanceBreakdownResponse | null
  dealBreakdownPrevious: DashboardCompanyPerformanceBreakdownResponse | null
  snapshotErrors: string[]
}

interface BusinessReportModalProps {
  employeeName: string
  data: BusinessReportData
  goals: unknown
  amountUnit: 'wan' | 'yuan'
  monthTimeProgress: number
  onClose: () => void
}

interface AmountRow {
  name: string
  amount: number
  orderCount: number
}

interface ComparisonRow {
  name: string
  current: number
  previous: number
  delta: number
  currentOrderCount: number
  previousOrderCount: number
}

interface BreakdownComparisonRow {
  name: string
  currentAmount: number | null
  previousAmount: number | null
  currentOrderCount: number | null
  previousOrderCount: number | null
  currentShare: number | null
}

interface SubmissionRow {
  companyName: string
  brandName: string
  count: number
}

interface ReportDetailRow {
  category: string
  companyName: string
  brandName: string
  currentAmount: number | null
  previousAmount: number | null
  currentCount: number | null
  previousCount: number | null
  unit: 'money' | 'count'
}

const TARGET_METRICS = [
  { key: 'halfPastTenTarget', actualKey: 'halfPastTen', label: '十点半', unit: 'money' },
  { key: 'selfIncubatedTarget', actualKey: 'selfIncubated', label: '自孵（不含十点半）', unit: 'money' },
  { key: 'signingXiaohongshuTarget', actualKey: 'signingXiaohongshu', label: '签约小红书', unit: 'money' },
  { key: 'signingDouyinTarget', actualKey: 'signingDouyin', label: '签约抖音', unit: 'money' },
  { key: 'signingShipinhaoTarget', actualKey: 'signingShipinhao', label: '签约视频号', unit: 'money' },
  { key: 'outsourcingOrderCountTarget', actualKey: 'outsourcing', label: '外采单数', unit: 'count' },
] as const

function toGoalMap(value: unknown): Record<string, Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([key, row]) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return []
    return [[key, row as Record<string, unknown>]]
  }))
}

function numericValue(value: unknown) {
  const parsed = Number(String(value ?? '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function isTargetRowKey(key: string, monthId: number) {
  const prefix = `${monthId}:`
  if (!key.startsWith(prefix) || key.includes(':product-line:')) return false
  const remainder = key.slice(prefix.length)
  if (remainder === 'total-target' || remainder.startsWith('empty-')) return false
  const parts = remainder.split(':')
  return parts.length >= 3 && /^\d+$/.test(parts[1])
}

function getMetricTarget(
  goals: Record<string, Record<string, unknown>>,
  monthId: number,
  targetKey: string,
  unit: 'money' | 'count',
  amountUnit: 'wan' | 'yuan',
) {
  const baseRows = Object.keys(goals).filter((key) => isTargetRowKey(key, monthId))
  const baseRowSet = new Set(baseRows)
  let target = 0

  for (const rowKey of baseRows) {
    const rowTarget = numericValue(goals[rowKey]?.[targetKey])
    if (rowTarget > 0) {
      target += rowTarget
      continue
    }
    const childPrefix = `${rowKey}:product-line:`
    for (const [childKey, childValues] of Object.entries(goals)) {
      if (!childKey.startsWith(childPrefix) || !baseRowSet.has(rowKey)) continue
      target += numericValue(childValues[targetKey])
    }
  }

  if (unit === 'money' && amountUnit === 'wan') return target * 10000
  return target
}

function getExplicitTotalTarget(goals: Record<string, Record<string, unknown>>, monthId: number) {
  const directTarget = numericValue(goals[`${monthId}:total-target`]?.totalTarget)
  if (directTarget > 0) return directTarget
  const legacyTarget = Object.entries(goals).find(([key, row]) =>
    key.startsWith(`${monthId}:`) && !key.includes(':product-line:') && numericValue(row.totalTarget) > 0,
  )?.[1].totalTarget
  return numericValue(legacyTarget)
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${(value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 万`
}

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${Math.round(value).toLocaleString('zh-CN')} 份`
}

function formatRate(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`
}

function formatDelta(value: number, unit: 'money' | 'count') {
  const sign = value > 0 ? '+' : ''
  if (unit === 'count') return `${sign}${Math.round(value).toLocaleString('zh-CN')} 份`
  return `${sign}${formatMoney(value)}`
}

function formatSnapshotTime(value?: string | null) {
  if (!value) return '无可用快照'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '更新时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = values.slice().sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function companyRows(snapshot: DashboardCompanyPerformanceResponse | null): AmountRow[] {
  return (snapshot?.companies ?? []).map((row) => ({
    name: row.companyName,
    amount: row.totalAmount,
    orderCount: row.totalOrderCount,
  }))
}

function brandRows(snapshot: DashboardBrandPerformanceResponse | null): AmountRow[] {
  return (snapshot?.brands ?? []).map((row) => ({
    name: row.brandName,
    amount: row.totalAmount,
    orderCount: row.totalOrderCount,
  }))
}

function totalAmount(rows: AmountRow[] | null) {
  return rows === null ? null : rows.reduce((total, row) => total + row.amount, 0)
}

function compareRows(current: AmountRow[], previous: AmountRow[]): ComparisonRow[] {
  const currentByName = new Map(current.map((row) => [row.name, row]))
  const previousByName = new Map(previous.map((row) => [row.name, row]))
  const names = new Set([...currentByName.keys(), ...previousByName.keys()])
  return [...names].map((name) => {
    const currentRow = currentByName.get(name)
    const previousRow = previousByName.get(name)
    const currentAmount = currentRow?.amount ?? 0
    const previousAmount = previousRow?.amount ?? 0
    return {
      name,
      current: currentAmount,
      previous: previousAmount,
      delta: currentAmount - previousAmount,
      currentOrderCount: currentRow?.orderCount ?? 0,
      previousOrderCount: previousRow?.orderCount ?? 0,
    }
  })
}

function compareBreakdownRows(
  current: DashboardCompanyPerformanceBreakdownResponse | null,
  previous: DashboardCompanyPerformanceBreakdownResponse | null,
  field: 'platforms' | 'tableBusinessAssistants',
  currentTotal: number | null,
): BreakdownComparisonRow[] {
  const currentRows = current?.[field] ?? []
  const previousRows = previous?.[field] ?? []
  const currentByName = new Map(currentRows.map((row) => [row.name, row]))
  const previousByName = new Map(previousRows.map((row) => [row.name, row]))
  return [...new Set([...currentByName.keys(), ...previousByName.keys()])]
    .map((name) => {
      const currentRow = currentByName.get(name)
      const previousRow = previousByName.get(name)
      const amount = current ? currentRow?.totalAmount ?? 0 : null
      return {
        name,
        currentAmount: amount,
        previousAmount: previous ? previousRow?.totalAmount ?? 0 : null,
        currentOrderCount: current ? currentRow?.orderCount ?? 0 : null,
        previousOrderCount: previous ? previousRow?.orderCount ?? 0 : null,
        currentShare: amount === null || currentTotal === null || currentTotal <= 0 ? null : amount / currentTotal,
      }
    })
    .sort((left, right) => Math.max(right.currentAmount ?? 0, right.previousAmount ?? 0)
      - Math.max(left.currentAmount ?? 0, left.previousAmount ?? 0)
      || left.name.localeCompare(right.name, 'zh-CN'))
}

function submissionRows(snapshot: DashboardTargetManagementSubmissionSnapshotResponse | null): SubmissionRow[] | null {
  if (!snapshot?.snapshotUpdatedAt) return null
  const counts = new Map<string, SubmissionRow>()
  for (const row of snapshot.tableCounts) {
    const key = JSON.stringify([row.companyName, row.brandName])
    const current = counts.get(key) ?? { companyName: row.companyName, brandName: row.brandName, count: 0 }
    current.count += row.count
    counts.set(key, current)
  }
  return [...counts.values()]
}

function groupSubmissionRows(rows: SubmissionRow[] | null, field: 'companyName' | 'brandName') {
  if (rows === null) return null
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + row.count)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
}

function getPairComparison(
  current: DashboardCompanyBrandPerformanceResponse | null,
  previous: DashboardCompanyBrandPerformanceResponse | null,
) {
  const currentRows = current?.companyBrands ?? []
  const previousRows = previous?.companyBrands ?? []
  const currentByKey = new Map(currentRows.map((row) => [JSON.stringify([row.companyName, row.brandName]), row]))
  const previousByKey = new Map(previousRows.map((row) => [JSON.stringify([row.companyName, row.brandName]), row]))
  const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()])
  return [...keys].map((key) => {
    const currentRow = currentByKey.get(key)
    const previousRow = previousByKey.get(key)
    return {
      companyName: currentRow?.companyName ?? previousRow?.companyName ?? '',
      brandName: currentRow?.brandName ?? previousRow?.brandName ?? '',
      current: currentRow?.totalAmount ?? 0,
      previous: previousRow?.totalAmount ?? 0,
      delta: (currentRow?.totalAmount ?? 0) - (previousRow?.totalAmount ?? 0),
      currentOrderCount: currentRow?.totalOrderCount ?? 0,
      previousOrderCount: previousRow?.totalOrderCount ?? 0,
    }
  })
}

function BusinessReportModal({ employeeName, data, goals, amountUnit, monthTimeProgress, onClose }: BusinessReportModalProps) {
  const [assistantBreakdownFilter, setAssistantBreakdownFilter] = useState('')
  const goalsMap = toGoalMap(goals)
  const currentPublishRows = data.companyPublishCurrent ? companyRows(data.companyPublishCurrent) : null
  const previousPublishRows = data.companyPublishPrevious ? companyRows(data.companyPublishPrevious) : null
  const currentDealRows = data.companyDealCurrent ? companyRows(data.companyDealCurrent) : null
  const previousDealRows = data.companyDealPrevious ? companyRows(data.companyDealPrevious) : null
  const currentBrandPublishRows = data.brandPublishCurrent ? brandRows(data.brandPublishCurrent) : null
  const previousBrandPublishRows = data.brandPublishPrevious ? brandRows(data.brandPublishPrevious) : null
  const currentBrandDealRows = data.brandDealCurrent ? brandRows(data.brandDealCurrent) : null
  const previousBrandDealRows = data.brandDealPrevious ? brandRows(data.brandDealPrevious) : null
  const currentPublishTotal = totalAmount(currentPublishRows)
  const previousPublishTotal = totalAmount(previousPublishRows)
  const currentDealTotal = totalAmount(currentDealRows)
  const previousDealTotal = totalAmount(previousDealRows)
  const currentSubmissionRows = submissionRows(data.submissionCurrent)
  const previousSubmissionRows = submissionRows(data.submissionPrevious)
  const companySubmissionRanks = groupSubmissionRows(currentSubmissionRows, 'companyName')
  const brandSubmissionRanks = groupSubmissionRows(currentSubmissionRows, 'brandName')
  const currentSubmissionTotal = currentSubmissionRows?.reduce((sum, row) => sum + row.count, 0) ?? null
  const previousSubmissionTotal = previousSubmissionRows?.reduce((sum, row) => sum + row.count, 0) ?? null
  const targetMultiplier = amountUnit === 'wan' ? 10000 : 1
  const targetMetrics = TARGET_METRICS.map((metric) => {
    const target = getMetricTarget(goalsMap, data.monthId, metric.key, metric.unit, amountUnit)
    const actual = data.companyPublishCurrent
      ? data.companyPublishCurrent.companies.reduce((sum, row) => sum + (row[metric.actualKey]?.[metric.unit === 'count' ? 'orderCount' : 'amount'] ?? 0), 0)
      : null
    return { label: metric.label, unit: metric.unit, target, actual, completion: target > 0 && actual !== null ? actual / target : null }
  }).filter((metric) => metric.target > 0)
  const explicitTotalTarget = getExplicitTotalTarget(goalsMap, data.monthId) * targetMultiplier
  const sumAmountTargets = targetMetrics.filter((metric) => metric.unit === 'money').reduce((sum, metric) => sum + metric.target, 0)
  const totalTarget = explicitTotalTarget || sumAmountTargets
  const totalCompletion = totalTarget > 0 && currentPublishTotal !== null ? currentPublishTotal / totalTarget : null
  const dealDelta = currentDealTotal !== null && previousDealTotal !== null ? currentDealTotal - previousDealTotal : null
  const dealChangeRate = dealDelta !== null && previousDealTotal !== null && previousDealTotal !== 0
    ? dealDelta / Math.abs(previousDealTotal)
    : null
  const monthLabel = `2026年${data.monthId - 139}月`
  const previousMonthLabel = data.previousMonthId === null ? '上月' : `2026年${data.previousMonthId - 139}月`
  const publishCompanyLeader = currentPublishRows?.slice().sort((left, right) => right.amount - left.amount)[0]
  const publishLeader = currentBrandPublishRows?.slice().sort((left, right) => right.amount - left.amount)[0]
  const dealLeader = currentDealRows?.slice().sort((left, right) => right.amount - left.amount)[0]
  const dealBrandLeader = currentBrandDealRows?.slice().sort((left, right) => right.amount - left.amount)[0]
  const dealCompanyChanges = currentDealRows && previousDealRows ? compareRows(currentDealRows, previousDealRows) : []
  const dealBrandChanges = currentBrandDealRows && previousBrandDealRows ? compareRows(currentBrandDealRows, previousBrandDealRows) : []
  const largestCompanyDrop = dealCompanyChanges.filter((row) => row.delta < 0).sort((left, right) => left.delta - right.delta)[0]
  const largestBrandDrop = dealBrandChanges.filter((row) => row.delta < 0).sort((left, right) => left.delta - right.delta)[0]
  const largestCompanyGrowth = dealCompanyChanges.filter((row) => row.delta > 0).sort((left, right) => right.delta - left.delta)[0]
  const largestBrandGrowth = dealBrandChanges.filter((row) => row.delta > 0).sort((left, right) => right.delta - left.delta)[0]
  const publishPairChanges = getPairComparison(data.companyBrandPublishCurrent, data.companyBrandPublishPrevious)
  const dealPairChanges = getPairComparison(data.companyBrandDealCurrent, data.companyBrandDealPrevious)
  const largestPublishPairDrop = data.companyBrandPublishPrevious
    ? publishPairChanges.filter((row) => row.delta < 0).sort((left, right) => left.delta - right.delta)[0]
    : undefined
  const largestPublishPairGrowth = data.companyBrandPublishPrevious
    ? publishPairChanges.filter((row) => row.delta > 0).sort((left, right) => right.delta - left.delta)[0]
    : undefined
  const largestDealPairDrop = data.companyBrandDealPrevious
    ? dealPairChanges.filter((row) => row.delta < 0).sort((left, right) => left.delta - right.delta)[0]
    : undefined
  const largestDealPairGrowth = data.companyBrandDealPrevious
    ? dealPairChanges.filter((row) => row.delta > 0).sort((left, right) => right.delta - left.delta)[0]
    : undefined
  const currentPublishPairLeader = data.companyBrandPublishCurrent?.companyBrands
    .slice().sort((left, right) => right.totalAmount - left.totalAmount)[0]
  const currentDealPairByKey = new Map((data.companyBrandDealCurrent?.companyBrands ?? []).map((row) => [
    JSON.stringify([row.companyName, row.brandName]), row,
  ]))
  const currentDealPairLeader = data.companyBrandDealCurrent?.companyBrands
    .slice().sort((left, right) => right.totalAmount - left.totalAmount)[0]
  const currentSubmissionByPair = new Map((currentSubmissionRows ?? []).map((row) => [
    JSON.stringify([row.companyName, row.brandName]), row.count,
  ]))
  const currentPairStats = (data.companyBrandDealCurrent?.companyBrands ?? []).map((row) => ({
    companyName: row.companyName,
    brandName: row.brandName,
    amount: row.totalAmount,
    tableCount: currentSubmissionByPair.get(JSON.stringify([row.companyName, row.brandName])) ?? 0,
  }))
  const dealMedian = median(currentPairStats.map((row) => row.amount).filter((amount) => amount > 0))
  const submissionMedian = median(currentPairStats.map((row) => row.tableCount).filter((count) => count > 0))
  const highDealHighSubmission = currentSubmissionRows === null || dealMedian === null || submissionMedian === null
    ? []
    : currentPairStats.filter((row) => row.amount >= dealMedian && row.tableCount >= submissionMedian)
      .sort((left, right) => right.amount - left.amount)
  const lowDealLowSubmission = currentSubmissionRows === null || dealMedian === null || submissionMedian === null
    ? []
    : currentPairStats.filter((row) => row.amount > 0 && row.amount < dealMedian && row.tableCount < submissionMedian)
      .sort((left, right) => left.amount - right.amount)

  const companySummary: Array<{ text: string; trend?: 'increase' | 'decrease' }> = []
  const brandSummary: Array<{ text: string; trend?: 'increase' | 'decrease' }> = []
  const pairSummary: Array<{ text: string; trend?: 'increase' | 'decrease' }> = []
  if (publishCompanyLeader) companySummary.push({ text: `本月发布额最高：${publishCompanyLeader.name}，${formatMoney(publishCompanyLeader.amount)}。` })
  if (dealLeader) companySummary.push({ text: `本月成单额最高：${dealLeader.name}，${formatMoney(dealLeader.amount)}。` })
  if (largestCompanyDrop) companySummary.push({
    text: `${largestCompanyDrop.name}由 ${formatMoney(largestCompanyDrop.previous)} 降至 ${formatMoney(largestCompanyDrop.current)}，减少 ${formatMoney(Math.abs(largestCompanyDrop.delta))}。`,
    trend: 'decrease',
  })
  if (largestCompanyGrowth) companySummary.push({
    text: `${largestCompanyGrowth.name}增加 ${formatMoney(largestCompanyGrowth.delta)}，本月为 ${formatMoney(largestCompanyGrowth.current)}。`,
    trend: 'increase',
  })
  if (publishLeader) brandSummary.push({ text: `本月发布额最高：${publishLeader.name}，${formatMoney(publishLeader.amount)}。` })
  if (dealBrandLeader) brandSummary.push({ text: `本月成单额最高：${dealBrandLeader.name}，${formatMoney(dealBrandLeader.amount)}。` })
  if (largestBrandDrop) brandSummary.push({
    text: `${largestBrandDrop.name}由 ${formatMoney(largestBrandDrop.previous)} 降至 ${formatMoney(largestBrandDrop.current)}，减少 ${formatMoney(Math.abs(largestBrandDrop.delta))}。`,
    trend: 'decrease',
  })
  if (largestBrandGrowth) brandSummary.push({
    text: `${largestBrandGrowth.name}增加 ${formatMoney(largestBrandGrowth.delta)}，本月为 ${formatMoney(largestBrandGrowth.current)}。`,
    trend: 'increase',
  })
  if (currentPublishPairLeader) pairSummary.push({ text: `发布额最高组合：${currentPublishPairLeader.companyName} · ${currentPublishPairLeader.brandName}，${formatMoney(currentPublishPairLeader.totalAmount)}。` })
  if (currentDealPairLeader) pairSummary.push({ text: `成单额最高组合：${currentDealPairLeader.companyName} · ${currentDealPairLeader.brandName}，${formatMoney(currentDealPairLeader.totalAmount)}。` })
  if (largestDealPairDrop) pairSummary.push({
    text: `成单回落：${largestDealPairDrop.companyName} · ${largestDealPairDrop.brandName}减少 ${formatMoney(Math.abs(largestDealPairDrop.delta))}；本月 ${formatMoney(largestDealPairDrop.current)}，上月 ${formatMoney(largestDealPairDrop.previous)}。`,
    trend: 'decrease',
  })
  if (largestDealPairGrowth) pairSummary.push({
    text: `成单增长：${largestDealPairGrowth.companyName} · ${largestDealPairGrowth.brandName}增加 ${formatMoney(largestDealPairGrowth.delta)}。`,
    trend: 'increase',
  })
  if (largestPublishPairDrop) pairSummary.push({
    text: `发布回落：${largestPublishPairDrop.companyName} · ${largestPublishPairDrop.brandName}减少 ${formatMoney(Math.abs(largestPublishPairDrop.delta))}。`,
    trend: 'decrease',
  })
  if (largestPublishPairGrowth) pairSummary.push({
    text: `发布增长：${largestPublishPairGrowth.companyName} · ${largestPublishPairGrowth.brandName}增加 ${formatMoney(largestPublishPairGrowth.delta)}。`,
    trend: 'increase',
  })

  const tableSummary: string[] = []
  const topSubmissionCompany = companySubmissionRanks?.[0]
  const topSubmissionBrand = brandSubmissionRanks?.[0]
  const topSubmissionPair = currentSubmissionRows?.slice().sort((left, right) => right.count - left.count)[0]
  if (currentSubmissionTotal !== null && topSubmissionCompany) {
    const share = currentSubmissionTotal > 0 ? topSubmissionCompany.count / currentSubmissionTotal : 0
    tableSummary.push(`做表最多的公司是${topSubmissionCompany.name}，${formatCount(topSubmissionCompany.count)}，占本月 ${formatRate(share)}。`)
  }
  if (topSubmissionBrand) tableSummary.push(`做表最多的品牌是${topSubmissionBrand.name}，共 ${formatCount(topSubmissionBrand.count)}。`)
  if (topSubmissionPair) {
    const pairKey = JSON.stringify([topSubmissionPair.companyName, topSubmissionPair.brandName])
    const matchingDealPair = currentDealPairByKey.get(pairKey)
    const share = currentSubmissionTotal ? topSubmissionPair.count / currentSubmissionTotal : 0
    tableSummary.push(`${topSubmissionPair.companyName} · ${topSubmissionPair.brandName}提报最多（${formatCount(topSubmissionPair.count)}，占 ${formatRate(share)}）${matchingDealPair ? `；同组合本月成单 ${formatMoney(matchingDealPair.totalAmount)}。` : '；本月成单快照中未精确匹配到该组合。'}`)
  }
  if (highDealHighSubmission[0]) {
    const row = highDealHighSubmission[0]
    tableSummary.push(`${row.companyName} · ${row.brandName}同时处于成单和做表较高区间：${formatMoney(row.amount)}、${formatCount(row.tableCount)}。`)
  }
  if (lowDealLowSubmission[0]) {
    const row = lowDealLowSubmission[0]
    tableSummary.push(`${row.companyName} · ${row.brandName}当前成单与做表都偏低（${formatMoney(row.amount)}、${formatCount(row.tableCount)}），可优先检查需求跟进和项目活跃度；这是规模提示，不等同于转化率。`)
  }
  if (!tableSummary.length) tableSummary.push('当前做表快照没有可用记录，暂不能分析做表较多或较少的公司、品牌。')

  const recommendationSummary: string[] = []
  if (largestDealPairDrop) {
    recommendationSummary.push(`建议先核查${largestDealPairDrop.companyName} · ${largestDealPairDrop.brandName}：上月有 ${formatMoney(largestDealPairDrop.previous)}，本月为 ${formatMoney(largestDealPairDrop.current)}。快照只能定位到回落组合，具体原因可能涉及项目阶段结束、订单日期落在不同方片月或跟进转化，需要结合订单明细确认。`)
  }
  if (topSubmissionPair && currentDealPairByKey.has(JSON.stringify([topSubmissionPair.companyName, topSubmissionPair.brandName]))) {
    recommendationSummary.push(`对${topSubmissionPair.companyName} · ${topSubmissionPair.brandName}，可继续跟踪已提报需求后续成单；做表量与成单金额是并列观察指标，不直接代表提报转化率。`)
  }
  if (!data.companyPublishPrevious || !data.brandPublishPrevious || !data.companyBrandPublishPrevious) {
    recommendationSummary.push(`${previousMonthLabel}发布快照尚未完整生成，所以发布总额、公司/品牌和组合的发布环比暂时无法得出；不要把缺失数据当作零。`)
  }
  if (!previousSubmissionRows) recommendationSummary.push(`${previousMonthLabel}做表快照没有有效更新时间，无法比较做表量变化；当前只报告本月数量。`)
  if (!recommendationSummary.length) recommendationSummary.push('当前快照覆盖发布、成单和做表环比；原因分析仍是数据线索，建议结合订单状态和客户跟进记录核实。')

  const platformBreakdownRows = compareBreakdownRows(
    data.dealBreakdownCurrent,
    data.dealBreakdownPrevious,
    'platforms',
    currentDealTotal,
  )
  const assistantBreakdownRows = compareBreakdownRows(
    data.dealBreakdownCurrent,
    data.dealBreakdownPrevious,
    'tableBusinessAssistants',
    currentDealTotal,
  )
  const largestBreakdownDrop = (rows: BreakdownComparisonRow[], metric: 'amount' | 'orders') => rows
    .filter((row) => {
      const current = metric === 'amount' ? row.currentAmount : row.currentOrderCount
      const previous = metric === 'amount' ? row.previousAmount : row.previousOrderCount
      return current !== null && previous !== null && current < previous
    })
    .sort((left, right) => {
      const leftChange = metric === 'amount'
        ? (left.currentAmount ?? 0) - (left.previousAmount ?? 0)
        : (left.currentOrderCount ?? 0) - (left.previousOrderCount ?? 0)
      const rightChange = metric === 'amount'
        ? (right.currentAmount ?? 0) - (right.previousAmount ?? 0)
        : (right.currentOrderCount ?? 0) - (right.previousOrderCount ?? 0)
      return leftChange - rightChange
    })[0]
  const largestPlatformAmountDrop = largestBreakdownDrop(platformBreakdownRows, 'amount')
  const largestPlatformOrderDrop = largestBreakdownDrop(platformBreakdownRows, 'orders')
  const largestAssistantAmountDrop = largestBreakdownDrop(assistantBreakdownRows, 'amount')
  const platformLeader = platformBreakdownRows
    .filter((row) => row.currentAmount !== null)
    .sort((left, right) => (right.currentAmount ?? 0) - (left.currentAmount ?? 0))[0]
  const assistantLeader = assistantBreakdownRows
    .filter((row) => row.currentAmount !== null)
    .sort((left, right) => (right.currentAmount ?? 0) - (left.currentAmount ?? 0))[0]
  const breakdownSummary: string[] = []
  if (data.dealBreakdownCurrent && platformLeader) {
    breakdownSummary.push(`本月平台业绩占比最高的是${platformLeader.name}：${formatMoney(platformLeader.currentAmount)}，占成单总业绩 ${formatRate(platformLeader.currentShare)}。`)
  }
  if (data.dealBreakdownCurrent && assistantLeader) {
    breakdownSummary.push(`本月表商务助理业绩占比最高的是${assistantLeader.name}：${formatMoney(assistantLeader.currentAmount)}，占成单总业绩 ${formatRate(assistantLeader.currentShare)}。`)
  }
  if (data.dealBreakdownCurrent && data.dealBreakdownPrevious && largestPlatformAmountDrop) {
    breakdownSummary.push(`平台业绩回落最多的是${largestPlatformAmountDrop.name}，由 ${formatMoney(largestPlatformAmountDrop.previousAmount)} 降至 ${formatMoney(largestPlatformAmountDrop.currentAmount)}。`)
  }
  if (data.dealBreakdownCurrent && data.dealBreakdownPrevious && largestPlatformOrderDrop) {
    breakdownSummary.push(`${largestPlatformOrderDrop.name}平台订单数下降最多：${formatCount(largestPlatformOrderDrop.previousOrderCount)} 降至 ${formatCount(largestPlatformOrderDrop.currentOrderCount)}。`)
  }
  if (data.dealBreakdownCurrent && data.dealBreakdownPrevious && largestAssistantAmountDrop) {
    breakdownSummary.push(`表商务助理中业绩下降最多的是${largestAssistantAmountDrop.name}，减少 ${formatMoney((largestAssistantAmountDrop.previousAmount ?? 0) - (largestAssistantAmountDrop.currentAmount ?? 0))}。`)
  }

  const followUpTodos: string[] = []
  if (largestPlatformAmountDrop) {
    followUpTodos.push(`复盘${largestPlatformAmountDrop.name}平台：核对本月与上月订单明细、取消/延期状态和项目排期，确认业绩下降来自订单减少、单笔金额变化还是月份归属差异；确认前不预设原因。`)
  }
  if (largestPlatformOrderDrop) {
    followUpTodos.push(`检查${largestPlatformOrderDrop.name}平台订单量变化：上月 ${formatCount(largestPlatformOrderDrop.previousOrderCount)}、本月 ${formatCount(largestPlatformOrderDrop.currentOrderCount)}；逐项查看在跟项目与待签订单，列出可在本方片月推进的明确下一步及负责人。`)
  }
  if (largestAssistantAmountDrop) {
    followUpTodos.push(`与${largestAssistantAmountDrop.name}核对商务支持链路：抽查负责订单的需求响应、方案/报价、签约节点和卡点，形成需要协同解决的问题清单。`)
  }
  if (platformLeader) {
    followUpTodos.push(`沉淀${platformLeader.name}平台本月有效做法，并核实其订单结构与收益水平；将可复用动作同步给其他平台，不仅按金额高低评价。`)
  }
  if (!data.dealBreakdownPrevious) {
    followUpTodos.push(`补齐${previousMonthLabel}平台及表商务助理成单快照后再做环比复核；当前上月缺失项按“未知”处理，不按零计算。`)
  }
  if (!followUpTodos.length) {
    followUpTodos.push('当前没有完整的平台与表商务助理环比快照；先补齐本月/上月快照，再按订单量与业绩额差异确定具体整改对象。')
  }

  const amountDetails = (
    category: string,
    currentRows: AmountRow[] | null,
    previousRows: AmountRow[] | null,
    nameField: 'company' | 'brand',
  ): ReportDetailRow[] => {
    if (currentRows === null && previousRows === null) return []
    return compareRows(currentRows ?? [], previousRows ?? [])
      .sort((left, right) => Math.max(right.current, right.previous) - Math.max(left.current, left.previous))
      .map((row) => ({
        category,
        companyName: nameField === 'company' ? row.name : '',
        brandName: nameField === 'brand' ? row.name : '',
        currentAmount: currentRows === null ? null : row.current,
        previousAmount: previousRows === null ? null : row.previous,
        currentCount: currentRows === null ? null : row.currentOrderCount,
        previousCount: previousRows === null ? null : row.previousOrderCount,
        unit: 'money',
      }))
  }
  const pairDetails = (
    category: string,
    currentSnapshot: DashboardCompanyBrandPerformanceResponse | null,
    previousSnapshot: DashboardCompanyBrandPerformanceResponse | null,
  ): ReportDetailRow[] => {
    if (!currentSnapshot && !previousSnapshot) return []
    return getPairComparison(currentSnapshot, previousSnapshot)
      .sort((left, right) => Math.max(right.current, right.previous) - Math.max(left.current, left.previous))
      .map((row) => ({
        category,
        companyName: row.companyName,
        brandName: row.brandName,
        currentAmount: currentSnapshot ? row.current : null,
        previousAmount: previousSnapshot ? row.previous : null,
        currentCount: currentSnapshot ? row.currentOrderCount : null,
        previousCount: previousSnapshot ? row.previousOrderCount : null,
        unit: 'money',
      }))
  }
  const submissionDetailRows = (() => {
    if (currentSubmissionRows === null && previousSubmissionRows === null) return []
    const currentByPair = new Map((currentSubmissionRows ?? []).map((row) => [JSON.stringify([row.companyName, row.brandName]), row]))
    const previousByPair = new Map((previousSubmissionRows ?? []).map((row) => [JSON.stringify([row.companyName, row.brandName]), row]))
    const keys = new Set([...currentByPair.keys(), ...previousByPair.keys()])
    return [...keys].map((key) => {
      const currentRow = currentByPair.get(key)
      const previousRow = previousByPair.get(key)
      return {
        category: '做表组合',
        companyName: currentRow?.companyName ?? previousRow?.companyName ?? '',
        brandName: currentRow?.brandName ?? previousRow?.brandName ?? '',
        currentAmount: null,
        previousAmount: null,
        currentCount: currentSubmissionRows === null ? null : currentRow?.count ?? 0,
        previousCount: previousSubmissionRows === null ? null : previousRow?.count ?? 0,
        unit: 'count' as const,
      }
    }).sort((left, right) => (right.currentCount ?? right.previousCount ?? 0) - (left.currentCount ?? left.previousCount ?? 0))
  })()
  const allDetailRows = [
    ...amountDetails('发布公司', currentPublishRows, previousPublishRows, 'company'),
    ...amountDetails('发布品牌', currentBrandPublishRows, previousBrandPublishRows, 'brand'),
    ...pairDetails('发布公司·品牌', data.companyBrandPublishCurrent, data.companyBrandPublishPrevious),
    ...amountDetails('成单公司', currentDealRows, previousDealRows, 'company'),
    ...amountDetails('成单品牌', currentBrandDealRows, previousBrandDealRows, 'brand'),
    ...pairDetails('成单公司·品牌', data.companyBrandDealCurrent, data.companyBrandDealPrevious),
    ...submissionDetailRows,
  ]
  const missingNotes = [
    !data.companyPublishCurrent ? `${monthLabel}发布快照未读取到。` : '',
    !data.companyDealCurrent ? `${monthLabel}成单快照未读取到。` : '',
    currentSubmissionRows === null ? `${monthLabel}做表快照没有有效更新时间。` : '',
    !data.companyPublishPrevious || !data.brandPublishPrevious ? `${previousMonthLabel}发布快照缺失，无法比较发布总额、公司和品牌变化。` : '',
    !data.companyBrandPublishCurrent || !data.companyBrandPublishPrevious ? `${previousMonthLabel}公司·品牌发布快照不完整，无法比较具体发布组合。` : '',
    !data.companyDealPrevious || !data.brandDealPrevious ? `${previousMonthLabel}成单快照缺失，无法比较成单变化。` : '',
    previousSubmissionRows === null ? `${previousMonthLabel}做表快照没有有效更新时间，不能按零份计算环比。` : '',
    !data.dealBreakdownCurrent ? `${monthLabel}平台及表商务助理拆分快照未读取到。` : '',
    !data.dealBreakdownPrevious ? `${previousMonthLabel}平台及表商务助理拆分快照未读取到，无法进行该维度环比。` : '',
  ].filter(Boolean)
  const formatDetailValue = (row: ReportDetailRow, isCurrent: boolean) => {
    if (row.unit === 'count') {
      const count = isCurrent ? row.currentCount : row.previousCount
      return formatCount(count)
    }
    const amount = isCurrent ? row.currentAmount : row.previousAmount
    const orderCount = isCurrent ? row.currentCount : row.previousCount
    return amount === null ? '—' : `${formatMoney(amount)} · ${formatCount(orderCount)}`
  }
  const formatDetailDelta = (row: ReportDetailRow) => {
    const currentValue = row.unit === 'count' ? row.currentCount : row.currentAmount
    const previousValue = row.unit === 'count' ? row.previousCount : row.previousAmount
    if (currentValue === null || previousValue === null) return '—'
    if (previousValue === 0 && currentValue > 0) return '新增'
    if (currentValue === 0 && previousValue > 0) return '本月无记录'
    return formatDelta(currentValue - previousValue, row.unit)
  }
  const formatBreakdownChange = (current: number | null, previous: number | null, unit: 'money' | 'count') => {
    if (current === null || previous === null) return '—'
    if (previous === 0 && current > 0) return '新增'
    return formatDelta(current - previous, unit)
  }
  const renderBreakdownTable = (
    rows: BreakdownComparisonRow[],
    currentAvailable: boolean,
    previousAvailable: boolean,
    tone: 'platform' | 'assistant',
    filterable = false,
  ) => {
    if (!currentAvailable && !previousAvailable) return <p className="business-report-muted">相关成单拆分快照不可用。</p>
    if (!rows.length) return <p className="business-report-muted">快照有效，但没有可汇总的对应记录。</p>
    const filter = filterable ? assistantBreakdownFilter.trim().toLocaleLowerCase() : ''
    const visibleRows = filter
      ? rows.filter((row) => [
        row.name,
        formatCount(row.currentOrderCount),
        formatMoney(row.currentAmount),
        formatRate(row.currentShare),
        formatCount(row.previousOrderCount),
        formatMoney(row.previousAmount),
        formatBreakdownChange(row.currentOrderCount, row.previousOrderCount, 'count'),
        formatBreakdownChange(row.currentAmount, row.previousAmount, 'money'),
      ].join(' ').toLocaleLowerCase().includes(filter))
      : rows
    return (
      <div className={filterable ? 'business-report-breakdown' : undefined}>
        {filterable ? (
          <div className="business-report-table-filter">
            <input
              type="search"
              aria-label="筛选表商务助理明细"
              placeholder="筛选姓名或数据"
              value={assistantBreakdownFilter}
              onChange={(event) => setAssistantBreakdownFilter(event.target.value)}
            />
            <span aria-live="polite">显示 {visibleRows.length} / {rows.length} 条</span>
          </div>
        ) : null}
        <div className={`business-report-table-wrap business-report-table-wrap-${tone}`}>
          <table>
            <thead><tr><th>名称</th><th>本月订单数</th><th>本月公司收益/业绩额</th><th>占本月总业绩</th><th>上月订单数</th><th>上月公司收益/业绩额</th><th>订单数变化</th><th>业绩额变化</th></tr></thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((row) => {
                const orderDelta = row.currentOrderCount === null || row.previousOrderCount === null
                  ? null
                  : row.currentOrderCount - row.previousOrderCount
                const amountDelta = row.currentAmount === null || row.previousAmount === null
                  ? null
                  : row.currentAmount - row.previousAmount
                return (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{formatCount(row.currentOrderCount)}</td>
                    <td>{formatMoney(row.currentAmount)}</td>
                    <td>{formatRate(row.currentShare)}</td>
                    <td>{formatCount(row.previousOrderCount)}</td>
                    <td>{formatMoney(row.previousAmount)}</td>
                    <td className={orderDelta === null ? '' : orderDelta < 0 ? 'is-negative' : orderDelta > 0 ? 'is-positive' : ''}>
                      {formatBreakdownChange(row.currentOrderCount, row.previousOrderCount, 'count')}
                    </td>
                    <td className={amountDelta === null ? '' : amountDelta < 0 ? 'is-negative' : amountDelta > 0 ? 'is-positive' : ''}>
                      {formatBreakdownChange(row.currentAmount, row.previousAmount, 'money')}
                    </td>
                  </tr>
                )
              }) : <tr><td className="business-report-filter-empty" colSpan={8}>没有匹配的记录</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  const renderTrendSummary = (items: Array<{ text: string; trend?: 'increase' | 'decrease' }>, emptyText: string) => items.length
    ? <ul>{items.map((item, index) => (
      <li
        className={item.trend === 'increase' ? 'business-report-insight-positive' : item.trend === 'decrease' ? 'business-report-insight-negative' : undefined}
        key={`${index}:${item.text}`}
      >{item.text}</li>
    ))}</ul>
    : <p>{emptyText}</p>

  return (
    <div className="chart-modal-backdrop business-report-backdrop" onClick={onClose}>
      <div
        className="business-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-report-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head business-report-header">
          <div>
            <h3 id="business-report-title">{monthLabel} · {employeeName}业务目标分析报告</h3>
            <p>对比区间：{previousMonthLabel} · 本次生成重新读取持久化快照</p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </div>

        <div className="business-report-source-note">
          发布：本月 {formatSnapshotTime(data.companyPublishCurrent?.snapshotUpdatedAt)} / 上月 {formatSnapshotTime(data.companyPublishPrevious?.snapshotUpdatedAt)}；
          成单：本月 {formatSnapshotTime(data.companyDealCurrent?.snapshotUpdatedAt)} / 上月 {formatSnapshotTime(data.companyDealPrevious?.snapshotUpdatedAt)}；
          平台/表商务助理：本月 {formatSnapshotTime(data.dealBreakdownCurrent?.snapshotUpdatedAt)} / 上月 {formatSnapshotTime(data.dealBreakdownPrevious?.snapshotUpdatedAt)}；
          做表：本月 {formatSnapshotTime(data.submissionCurrent?.snapshotUpdatedAt)} / 上月 {formatSnapshotTime(data.submissionPrevious?.snapshotUpdatedAt)}。仅读快照，不触发天玑刷新。
        </div>
        {missingNotes.length ? (
          <div className="business-report-data-warning">
            {missingNotes.map((note) => <p key={note}>{note}</p>)}
            {data.snapshotErrors.length ? (
              <details className="business-report-error-details">
                <summary>查看快照读取失败原因（{data.snapshotErrors.length}项）</summary>
                <ul>{data.snapshotErrors.map((error) => <li key={error}>{error}</li>)}</ul>
              </details>
            ) : null}
          </div>
        ) : null}

        <div className="business-report-summary-grid">
          <article><span>本月发布业绩</span><strong>{formatMoney(currentPublishTotal)}</strong><small>{previousPublishTotal === null ? '上月发布快照缺失' : `上月 ${formatMoney(previousPublishTotal)}`}</small></article>
          <article>
            <span>本月成单业绩</span><strong>{formatMoney(currentDealTotal)}</strong>
            <small>{dealDelta === null ? '上月快照不可用' : `较上月 ${dealDelta >= 0 ? '+' : '−'}${formatMoney(Math.abs(dealDelta))}${dealChangeRate === null ? '' : `（${Math.abs(dealChangeRate * 100).toFixed(1)}%）`}`}</small>
          </article>
          <article><span>发布目标完成率</span><strong>{formatRate(totalCompletion)}</strong><small>目标 {formatMoney(totalTarget || null)} · 实绩 {formatMoney(currentPublishTotal)}</small></article>
          <article><span>本月做表数量</span><strong>{formatCount(currentSubmissionTotal)}</strong><small>{previousSubmissionTotal === null ? '上月做表快照缺失' : `上月 ${formatCount(previousSubmissionTotal)}`}</small></article>
        </div>

        <section className="business-report-section">
          <div className="business-report-section-heading"><h4>目标完成度</h4><span>方片月时间进度 {formatRate(monthTimeProgress)}</span></div>
          {targetMetrics.length ? (
            <div className="business-report-table-wrap">
              <table>
                <thead><tr><th>目标维度</th><th>目标</th><th>发布业绩</th><th>完成率</th><th>进度判断</th></tr></thead>
                <tbody>
                  {targetMetrics.map((metric) => {
                    const isAhead = metric.completion !== null && metric.completion >= monthTimeProgress
                    return (
                      <tr key={metric.label}>
                        <td>{metric.label}</td>
                        <td>{metric.unit === 'count' ? formatCount(metric.target) : formatMoney(metric.target)}</td>
                        <td>{metric.actual === null ? '—' : metric.unit === 'count' ? formatCount(metric.actual) : formatMoney(metric.actual)}</td>
                        <td>{formatRate(metric.completion)}</td>
                        <td className={metric.completion === null ? '' : isAhead ? 'is-positive' : 'is-negative'}>
                          {metric.completion === null ? '快照缺失' : isAhead ? '示例公司有限公司时间进度' : '低于时间进度'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="business-report-muted">当前方片月还没有录入可计算的分项目标。</p>}
        </section>

        <section className="business-report-section">
          <h4>合作平台与表商务助理成单分析</h4>
          <p className="business-report-footnote">占比按本月公司成单总业绩计算。业绩额沿用公司看板口径：order_type=1 使用订单金额，其他订单类型使用公司收益金额；表商务助理取订单快照中的表商务助理字段。空名称单独列为“未填写”。</p>
          {breakdownSummary.length ? <ul className="business-report-breakdown-summary">{breakdownSummary.map((line) => <li key={line}>{line}</li>)}</ul> : null}
          <h5>合作平台（本月占比及订单数、业绩额环比）</h5>
          {renderBreakdownTable(platformBreakdownRows, Boolean(data.dealBreakdownCurrent), Boolean(data.dealBreakdownPrevious), 'platform')}
          <h5>表商务助理（本月占比及订单数、业绩额环比）</h5>
          {renderBreakdownTable(assistantBreakdownRows, Boolean(data.dealBreakdownCurrent), Boolean(data.dealBreakdownPrevious), 'assistant', true)}
        </section>

        <section className="business-report-section">
          <h4>文字总结与原因分析</h4>
          <div className="business-report-narrative">
            <article><h5>公司分析</h5>{renderTrendSummary(companySummary, '当前快照没有可用的公司发布、成单数据或环比记录。')}</article>
            <article><h5>品牌分析</h5>{renderTrendSummary(brandSummary, '当前快照没有可用的品牌发布、成单数据或环比记录。')}</article>
            <article><h5>公司·品牌组合</h5>{renderTrendSummary(pairSummary, '当前快照没有可用的公司与品牌组合数据。')}</article>
            <article><h5>做表情况</h5><ul>{tableSummary.map((line) => <li key={line}>{line}</li>)}</ul></article>
            <article><h5>原因线索与建议</h5><ul>{recommendationSummary.map((line) => <li key={line}>{line}</li>)}</ul></article>
          </div>
          <p className="business-report-footnote">公司和品牌按名称精确匹配；提报量与业绩仅作同期观察，不代表因果或真实转化率。原因属于需要核实的线索，不能仅凭汇总快照断定。</p>
        </section>

        <section className="business-report-section">
          <h4>后续整改待办方案</h4>
          <ol className="business-report-todo-list">{followUpTodos.map((item) => <li key={item}>{item}</li>)}</ol>
          <p className="business-report-footnote">待办按快照中的环比变化生成，优先用于安排核查，不代表已经确认问题根因；完成订单明细和业务跟进核对后再调整行动项。</p>
        </section>

        <details className="business-report-full-details">
          <summary>展开全部公司、品牌、组合及做表明细（{allDetailRows.length}条）</summary>
          {allDetailRows.length ? (
            <div className="business-report-table-wrap">
              <table>
                <thead><tr><th>维度</th><th>公司</th><th>品牌</th><th>本月金额/数量</th><th>上月金额/数量</th><th>变化</th></tr></thead>
                <tbody>
                  {allDetailRows.map((row) => {
                    const currentValue = row.unit === 'count' ? row.currentCount : row.currentAmount
                    const previousValue = row.unit === 'count' ? row.previousCount : row.previousAmount
                    const delta = currentValue === null || previousValue === null ? null : currentValue - previousValue
                    return (
                      <tr key={`${row.category}:${row.companyName}:${row.brandName}`}>
                        <td>{row.category}</td><td>{row.companyName || '—'}</td><td>{row.brandName || '—'}</td>
                        <td>{formatDetailValue(row, true)}</td><td>{formatDetailValue(row, false)}</td>
                        <td className={delta === null ? '' : delta < 0 ? 'is-negative' : delta > 0 ? 'is-positive' : ''}>{formatDetailDelta(row)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="business-report-muted">当前没有可展示的公司、品牌或做表快照明细。</p>}
        </details>
      </div>
    </div>
  )
}

export default BusinessReportModal

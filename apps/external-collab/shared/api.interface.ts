// ⚠️ 前后端共享类型. 加新接口时:
//   1. 这里先加 request/response interface
//   2. server/modules/<x>/<x>.controller.ts 用 import type { ... } from '@shared/api.interface'
//   3. client/src/api/index.ts fetch 时 cast 成对应类型
// 这样后端改返回结构, 前端 tsc 立即报错, 防止漂移.

export interface HelloResponse {
  message: string
  serverTime: string
  appId: string
}

// ── 参考示范类型 (对应 server/modules/example): 做自己的功能时照这个模式加; 不要可整段删 ──
export interface Note {
  id: string
  title: string
  content: string
  tag: string
  imageUrl: string
  createdTime?: string
}
export interface NoteListResponse {
  notes: Note[]
}
export interface UploadUrlResponse {
  uploadUrl: string
  cdnUrl: string
  objectKey: string
  contentType: string
}
export interface SummaryResponse {
  summary: string
}

export interface DashboardTargetRow {
  targetId: number
  employeeId: number
  employeeName: string
  yearName: string
  monthName: string
  monthId: number
  goalTypeText: string
  responsibleTypeText: string
  salaryItemText: string
  roleCodeText: string
  confirmStatusText: string
  platformName: string
  departmentName: string
  goal: number
  completion: number
  completionRate: number
}

export interface DashboardOrderMetricValue {
  amount: number
  orderCount: number
}

export interface DashboardUnpublishedOrder {
  id: number
  orderCode: string
  customerName: string
  brandName: string
  creatorName: string
  platformName: string
  statusText: string
  orderDate: number
  orderMoney: number
  incomeMoney: number
  orderType?: number
  platformId?: number
  metricKey?: DashboardUnpublishedMetricKey
  reporterName: string | null
  customerFacingBusinessName: string
  businessName: string
}

export interface DashboardUnpublishedOrderFilters {
  orderCode?: string
  customerName?: string
  companyNames?: string[]
  brandName?: string
  creatorName?: string
  platformName?: string
  statusText?: string
  orderDateFrom?: string
  orderDateTo?: string
  orderMoneyMin?: string
  orderMoneyMax?: string
  incomeMoneyMin?: string
  incomeMoneyMax?: string
  reporterName?: string
  customerFacingBusinessName?: string
  businessName?: string
  brandNameExact?: string
  platformNameExact?: string
  platformIdExact?: string
}

export type DashboardUnpublishedMetricKey =
  | 'halfPastTen'
  | 'selfIncubated'
  | 'signingXiaohongshu'
  | 'signingDouyin'
  | 'signingShipinhao'
  | 'outsourcing'
  | 'outsourcingOrderCount'
  | 'total'

export interface DashboardUnpublishedMetricValue {
  amount: number
  orderCount: number
}

export interface DashboardUnpublishedPersonFilterOption {
  value: string
  orderCount: number
}

export interface DashboardUnpublishedOrdersResponse {
  employeeName: string
  boardMonthId: number
  periodLabel: string
  periodStart: number
  periodEnd: number
  selectedMonthId: number | null
  availableMonths: Array<{ monthId: number; label: string }>
  metricKey: DashboardUnpublishedMetricKey
  metricName: string
  metrics: Record<DashboardUnpublishedMetricKey, DashboardUnpublishedMetricValue>
  filterOptions: {
    reporterName: DashboardUnpublishedPersonFilterOption[]
    customerFacingBusinessName: DashboardUnpublishedPersonFilterOption[]
    businessName: DashboardUnpublishedPersonFilterOption[]
  }
  amount: number
  orderCount: number
  page: number
  pageSize: number
  totalPages: number
  snapshotUpdatedAt: string
  orders: DashboardUnpublishedOrder[]
}

export type DashboardOrderMetricDimension = 'publish' | 'deal' | 'payment'

export interface DashboardCompanyMetric {
  amount: number
  orderCount: number
}

export interface DashboardCompanyPerformanceRow {
  companyName: string
  halfPastTen: DashboardCompanyMetric
  selfIncubated: DashboardCompanyMetric
  signingXiaohongshu: DashboardCompanyMetric
  signingDouyin: DashboardCompanyMetric
  signingShipinhao: DashboardCompanyMetric
  outsourcing: DashboardCompanyMetric
  totalAmount: number
  totalOrderCount: number
}

export interface DashboardCompanyPerformanceResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: DashboardOrderMetricDimension
  periodStart: number
  periodEnd: number
  snapshotUpdatedAt: string
  companies: DashboardCompanyPerformanceRow[]
}

export interface DashboardCompanyPerformanceBreakdownRow {
  name: string
  totalAmount: number
  orderCount: number
}

export interface DashboardCompanyPerformanceBreakdownResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: 'deal'
  snapshotUpdatedAt: string
  platforms: DashboardCompanyPerformanceBreakdownRow[]
  tableBusinessAssistants: DashboardCompanyPerformanceBreakdownRow[]
}

export type DashboardTargetManagementMetricKey = Exclude<DashboardCompanyMetricKey, 'total'>

export interface DashboardTargetManagementActualRow {
  companyName: string
  platformId: number
  brandName: string
  metrics: Record<DashboardTargetManagementMetricKey, DashboardCompanyMetric>
}

export interface DashboardTargetManagementTableCountRow {
  companyName: string
  platformId: number
  brandName: string
  count: number
}

export interface DashboardTargetManagementSubmissionDetail {
  submittedMonth: string
  submittedWeek: string
  customerFacingName: string
  customerFacingPmGroup: string
  tableMakerName: string
  platformName: string
  companyName: string
  brandName: string
  projectType: string
  submittedBloggerCount: number | null
  wonBloggerCount: number | null
  winningBloggerNames: string
}

export interface DashboardTargetManagementActualsResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: DashboardOrderMetricDimension
  snapshotUpdatedAt: string
  actuals: DashboardTargetManagementActualRow[]
  tableCountSnapshotUpdatedAt: string
  tableCounts: DashboardTargetManagementTableCountRow[]
  tableCountDetailsAvailable: boolean
  tableCountDetails: DashboardTargetManagementSubmissionDetail[]
}

export interface DashboardTargetManagementSubmissionSnapshotResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  snapshotUpdatedAt: string
  tableCounts: DashboardTargetManagementTableCountRow[]
  tableCountDetailsAvailable: boolean
  tableCountDetails: DashboardTargetManagementSubmissionDetail[]
}

export interface DashboardTargetManagementBrandOption {
  id: number
  brandName: string
  parentId?: number
  entityId?: number
}

export interface DashboardTargetManagementBrandOptionsResponse {
  companyName: string
  brands: DashboardTargetManagementBrandOption[]
  snapshotUpdatedAt: string | null
}

export interface DashboardTargetManagementCompanyOption {
  id?: number
  companyName: string
  orderCount?: number
}

export interface DashboardTargetManagementCompanyOptionsResponse {
  keyword: string
  monthIds?: number[]
  companies: DashboardTargetManagementCompanyOption[]
}

export interface DashboardTargetManagementImportRow {
  rowNumber: number
  companyName: string
  platformId: number
  platformName: string
  projectBrand: string
  subBrand: string
  contactPerson: string
  targets: Partial<Record<
    | 'halfPastTenTarget'
    | 'selfIncubatedTarget'
    | 'signingXiaohongshuTarget'
    | 'signingDouyinTarget'
    | 'signingShipinhaoTarget'
    | 'outsourcingOrderCountTarget',
    string
  >>
  targetMergeGroups?: Partial<Record<
    | 'halfPastTenTarget'
    | 'selfIncubatedTarget'
    | 'signingXiaohongshuTarget'
    | 'signingDouyinTarget'
    | 'signingShipinhaoTarget'
    | 'outsourcingOrderCountTarget',
    string
  >>
  targetWarnings: string[]
  importWarnings: string[]
}

export interface DashboardTargetManagementImportSkippedRow {
  rowNumber: number
  companyName: string
  platformName: string
  projectBrand: string
  subBrand: string
  reason: string
}

export interface DashboardTargetManagementImportPreviewResponse {
  sourceName: string
  sheetTitle: string
  monthId: number
  totalTarget: string
  totalUnit: 'wan'
  sourceRowCount: number
  importableRowCount: number
  skippedRows: DashboardTargetManagementImportSkippedRow[]
  rows: DashboardTargetManagementImportRow[]
}

export interface DashboardTargetManagementImportChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface DashboardTargetManagementImportRevisionResponse {
  reply: string
  changed: boolean
  preview: DashboardTargetManagementImportPreviewResponse
}

export interface DashboardBrandPerformanceRow extends Omit<DashboardCompanyPerformanceRow, 'companyName'> {
  brandName: string
}

export interface DashboardBrandPerformanceResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: DashboardOrderMetricDimension
  periodStart: number
  periodEnd: number
  snapshotUpdatedAt: string
  brands: DashboardBrandPerformanceRow[]
}

export interface DashboardCompanyBrandPerformanceRow {
  companyName: string
  brandName: string
  totalAmount: number
  totalOrderCount: number
}

export interface DashboardCompanyBrandPerformanceResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: DashboardOrderMetricDimension
  snapshotUpdatedAt: string
  companyBrands: DashboardCompanyBrandPerformanceRow[]
}

export interface DashboardCompanyBrandShareResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: DashboardOrderMetricDimension
  companyName: string
  snapshotUpdatedAt: string
  totalAmount: number
  brands: Array<{
    brandName: string
    totalAmount: number
    orderCount: number
  }>
}

export interface DashboardBrandCompanyShareResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: DashboardOrderMetricDimension
  brandName: string
  snapshotUpdatedAt: string
  totalAmount: number
  companies: Array<{
    companyName: string
    totalAmount: number
    orderCount: number
  }>
}

export type DashboardCompanyMetricKey = Exclude<DashboardUnpublishedMetricKey, 'outsourcingOrderCount'>

export type DashboardCompanyBoardEmployeeName = '示例开发01' | '示例开发10' | '示例对客16' | '示例对客19' | '示例对客17' | '示例对客18' | '示例对客13' | '示例对客14' | '示例对客15' | '示例对客22' | '示例对客20' | '示例对客21'

export interface DashboardCompanyOrder extends DashboardUnpublishedOrder {
  monthId: number
  performanceDate: number
}

export interface DashboardCompanyOrdersResponse {
  employeeName: DashboardCompanyBoardEmployeeName
  companyName: string | null
  dimension: DashboardOrderMetricDimension
  metricKey: DashboardCompanyMetricKey
  metricName: string
  periodLabel: string
  periodStart: number
  periodEnd: number
  selectedMonthId: number | null
  availableMonths: Array<{ monthId: number; label: string }>
  filterOptions: {
    brandName: DashboardUnpublishedPersonFilterOption[]
    platformName: DashboardUnpublishedPersonFilterOption[]
    reporterName: DashboardUnpublishedPersonFilterOption[]
    customerFacingBusinessName: DashboardUnpublishedPersonFilterOption[]
    businessName: DashboardUnpublishedPersonFilterOption[]
  }
  amount: number
  orderCount: number
  page: number
  pageSize: number
  totalPages: number
  snapshotUpdatedAt: string
  orders: DashboardCompanyOrder[]
}

export type DashboardOrderMetric = Record<DashboardOrderMetricDimension, {
  total: DashboardOrderMetricValue
  halfPastTen: DashboardOrderMetricValue
  selfIncubated: DashboardOrderMetricValue
  signingXiaohongshu: DashboardOrderMetricValue
  signingDouyin: DashboardOrderMetricValue
  signingShipinhao: DashboardOrderMetricValue
  outsourcing: DashboardOrderMetricValue
  outsourcingOrderCount: DashboardOrderMetricValue
}>

export interface DashboardMetricTarget {
  dimension: 'publish' | 'deal' | 'payment'
  metricKey: string
  metricName: string
  target: number
  commissionRate: number
}

export interface DashboardMetricTargetInput {
  monthId: number
  employeeName: string
  dimension: 'publish' | 'deal' | 'payment'
  metricKey: string
  target?: number
  commissionRate?: number
}

export interface DashboardMetricTargetRecord extends DashboardMetricTarget {
  monthId: number
  employeeName: string
}

export interface DashboardMetricTargetsResponse {
  targets: DashboardMetricTargetRecord[]
}

export interface DashboardMemberTarget {
  name: string
  groupName: string
  positionName: string
  monthId: number
  monthName: string
  hasTarget: boolean
  goal: number
  completion: number
  completionRate: number
  targets: DashboardTargetRow[]
  orderMetric: DashboardOrderMetric
  hasPerformanceSnapshot?: boolean
  performanceUpdatedAt?: string | null
  metricTargets: DashboardMetricTarget[]
  canEditTargets: boolean
}

export interface DashboardTargetsResponse {
  members: DashboardMemberTarget[]
}

export interface TargetSplitPlanResponse {
  monthId: number
  plan: unknown | null
  updatedAt: string | null
}

export interface TargetSplitWorkbookImportPreview {
  sourceName: string
  sheetTitle: string
  sourceOwnerName: string | null
  sourceMonthId: number | null
  totalTarget: string
  goalKeys: string[]
  goalTargets: Record<string, string>
  customerTargets: Record<string, string>
  customerGoalTargets: Record<string, Record<string, string>>
  rows: Array<{
    id: string
    customerFacingPerson: string
    companyName: string
    platformId: number | null
    projectBrand: string
    targets: Record<string, string>
  }>
  hasDetailTable: boolean
  recognizedPersonCount: number
  warnings: string[]
}

export type MuyuanTargetSplitPlanResponse = TargetSplitPlanResponse

export interface DashboardSyncResponse {
  monthId: number
  synced: number
  employees: number
}

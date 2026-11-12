import type {
  HelloResponse,
  Note,
  NoteListResponse,
  SummaryResponse,
  UploadUrlResponse,
  DashboardSyncResponse,
  DashboardTargetsResponse,
  DashboardMetricTargetInput,
  DashboardMetricTargetsResponse,
  DashboardUnpublishedOrdersResponse,
  DashboardUnpublishedOrderFilters,
  DashboardUnpublishedMetricKey,
  DashboardCompanyPerformanceResponse,
  DashboardCompanyPerformanceBreakdownResponse,
  DashboardTargetManagementActualsResponse,
  DashboardTargetManagementSubmissionSnapshotResponse,
  DashboardTargetManagementBrandOptionsResponse,
  DashboardTargetManagementCompanyOptionsResponse,
  DashboardTargetManagementImportPreviewResponse,
  DashboardTargetManagementImportChatMessage,
  DashboardTargetManagementImportRevisionResponse,
  DashboardBrandPerformanceResponse,
  DashboardCompanyBrandPerformanceResponse,
  DashboardBrandCompanyShareResponse,
  DashboardCompanyBrandShareResponse,
  DashboardCompanyOrdersResponse,
  DashboardCompanyMetricKey,
  DashboardCompanyBoardEmployeeName,
  DashboardOrderMetricDimension,
  TargetSplitPlanResponse,
  TargetSplitWorkbookImportPreview,
} from '@shared/api.interface'

// 全部走相对 URL — Studio 反代会把 /api/* 打到本应用的 NestJS 进程.
// 加新接口时, 先在 @shared/api.interface 加 *Response 类型, 再写 fetch 就有类型补全.
async function get<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
  return res.json()
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
  return res.json()
}

async function waitForJobResult<T>(jobId: string, onProgress?: (progress: string) => void): Promise<T> {
  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
    const job = await get<{
      status: 'pending' | 'running' | 'done' | 'failed'
      progress: string
      data?: T
      error?: string
    }>(`api/jobs/${encodeURIComponent(jobId)}`)
    if (job.progress) onProgress?.(job.progress)
    if (job.status === 'failed') throw new Error(job.error || '后台任务执行失败')
    if (job.status === 'done') {
      if (job.data === undefined) throw new Error('后台任务完成，但没有返回预览数据')
      return job.data
    }
  }
}

export const getHello = () => get<HelloResponse>('api/hello')

// ── 参考示范 (对应 server/modules/example): CRUD + 上传 + AI 摘要的标准前端写法 ──
// 做自己的功能时照这个模式写; 不需要可整段删。
export const listNotes = () => get<NoteListResponse>('api/example/notes')
export const createNote = (n: Pick<Note, 'title' | 'content'> & Partial<Note>) =>
  send<Note>('POST', 'api/example/notes', n)
export const updateNote = (id: string, patch: Partial<Note>) =>
  send<Note>('PATCH', `api/example/notes/${id}`, patch)
export const deleteNote = (id: string) => send<{ ok: true }>('DELETE', `api/example/notes/${id}`)
export const summarizeNote = (content: string) =>
  send<SummaryResponse>('POST', 'api/example/notes/summarize', { content })

// 文件上传: 先拿预签名, 再把文件直接 PUT 到 OSS (Content-Type 必须一致), 返回 cdnUrl 存进记录。
export async function uploadFile(file: File): Promise<string> {
  const { uploadUrl, cdnUrl, contentType } = await send<UploadUrlResponse>(
    'POST',
    'api/example/notes/upload-url',
    { filename: file.name, contentType: file.type },
  )
  await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  return cdnUrl
}

export const getDashboardTargets = (
  monthId?: number,
  employeeName?: string,
  dimension?: 'publish' | 'deal' | 'payment',
) => {
  const params = new URLSearchParams()
  if (monthId) params.set('monthId', String(monthId))
  if (employeeName) params.set('employeeName', employeeName)
  if (dimension) params.set('dimension', dimension)
  const query = params.toString()
  return get<DashboardTargetsResponse>(`api/dashboard/targets${query ? `?${query}` : ''}`)
}

export const getTargetSplitPlan = (ownerName: string, monthId: number) => {
  const params = new URLSearchParams({ ownerName, monthId: String(monthId) })
  return get<TargetSplitPlanResponse>(`api/dashboard/target-split-plan?${params.toString()}`)
}

export const saveTargetSplitPlan = (ownerName: string, monthId: number, plan: unknown) =>
  send<TargetSplitPlanResponse>('PUT', 'api/dashboard/target-split-plan', { ownerName, monthId, plan })

export async function previewTargetSplitWorkbookLinkImport(
  sourceLink: string,
  ownerName: string,
  monthId: number,
  onProgress?: (progress: string) => void,
) {
  const { jobId } = await send<{ jobId: string }>('POST', 'api/dashboard/target-split-import-preview', {
    sourceLink,
    ownerName,
    monthId,
  })
  return waitForJobResult<TargetSplitWorkbookImportPreview>(jobId, onProgress)
}

export async function previewTargetSplitWorkbookFileImport(
  file: File,
  ownerName: string,
  monthId: number,
  onProgress?: (progress: string) => void,
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('ownerName', ownerName)
  formData.append('monthId', String(monthId))
  const response = await fetch('api/dashboard/target-split-import-file-preview', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`)
  const { jobId } = await response.json() as { jobId: string }
  return waitForJobResult<TargetSplitWorkbookImportPreview>(jobId, onProgress)
}

export async function previewTargetSplitImageImport(
  file: File,
  ownerName: string,
  monthId: number,
  onProgress?: (progress: string) => void,
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('ownerName', ownerName)
  formData.append('monthId', String(monthId))
  const response = await fetch('api/dashboard/target-split-import-image-preview', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`)
  const { jobId } = await response.json() as { jobId: string }
  return waitForJobResult<TargetSplitWorkbookImportPreview>(jobId, onProgress)
}

export const getDashboardUnpublishedOrders = (
  page = 1,
  pageSize = 50,
  monthId?: number,
  metricKey: DashboardUnpublishedMetricKey = 'total',
  filters?: DashboardUnpublishedOrderFilters,
  employeeName = '示例开发01',
  boardMonthId?: number,
): Promise<DashboardUnpublishedOrdersResponse> => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), metricKey })
  if (monthId !== undefined) params.set('monthId', String(monthId))
  params.set('employeeName', employeeName)
  if (boardMonthId !== undefined) params.set('boardMonthId', String(boardMonthId))
  if (filters && Object.values(filters).some((value) => value?.trim())) {
    params.set('filters', JSON.stringify(filters))
  }
  const url = `api/dashboard/unpublished-orders?${params.toString()}`
  return get<DashboardUnpublishedOrdersResponse>(url)
}

export const syncDashboardTargets = (monthId: number) =>
  get<DashboardSyncResponse>(`api/dashboard/sync?monthId=${monthId}`)

export const getMetricTargets = (monthId: number) =>
  get<DashboardMetricTargetsResponse>(`api/dashboard/metric-targets?monthId=${monthId}`)

export const getDashboardCompanyPerformance = (
  monthId: number,
  dimension: DashboardOrderMetricDimension,
  employeeName: DashboardCompanyBoardEmployeeName = '示例开发01',
) => get<DashboardCompanyPerformanceResponse>(
  `api/dashboard/company-performance?monthId=${monthId}&dimension=${dimension}&employeeName=${encodeURIComponent(employeeName)}`,
  { cache: 'no-store' },
)

export const getDashboardCompanyPerformanceBreakdown = (
  monthId: number,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
) => get<DashboardCompanyPerformanceBreakdownResponse>(
  `api/dashboard/company-performance-breakdown?monthId=${monthId}&employeeName=${encodeURIComponent(employeeName)}`,
  { cache: 'no-store' },
)

export const getTargetManagementActuals = (
  monthId: number,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
  dimension: DashboardOrderMetricDimension = 'publish',
  developerEmployeeName?: string,
): Promise<DashboardTargetManagementActualsResponse> =>
  get<DashboardTargetManagementActualsResponse>(
    `api/dashboard/target-management-actuals?monthId=${monthId}&employeeName=${encodeURIComponent(employeeName)}&dimension=${dimension}${
      developerEmployeeName ? `&developerEmployeeName=${encodeURIComponent(developerEmployeeName)}` : ''
    }`,
  )

export const getWangYueTargetManagementActuals = (monthId: number) =>
  getTargetManagementActuals(monthId, '示例对客16')

export const getTargetManagementSubmissionSnapshot = (
  monthId: number,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
) =>
  get<DashboardTargetManagementSubmissionSnapshotResponse>(
    `api/dashboard/target-management-submission-snapshot?monthId=${monthId}&employeeName=${encodeURIComponent(employeeName)}`,
    { cache: 'no-store' },
  )

export const getWangYueTargetManagementSubmissionSnapshot = (monthId: number) =>
  getTargetManagementSubmissionSnapshot(monthId, '示例对客16')

export const startTargetManagementSnapshotRefresh = (
  monthId: number,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
) => send<{ jobId: string }>('POST', 'api/dashboard/target-management-refresh', { monthId, employeeName })

export const startPerformanceSnapshotRefresh = (monthId: number, employeeName: string) =>
  send<{ jobId: string }>('POST', 'api/dashboard/performance-snapshot-refresh', { monthId, employeeName })

export async function refreshPerformanceSnapshot(
  monthId: number,
  employeeName: string,
  onProgress?: (progress: string) => void,
) {
  const { jobId } = await startPerformanceSnapshotRefresh(monthId, employeeName)
  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
    const job = await get<{
      status: 'pending' | 'running' | 'done' | 'failed'
      progress: string
      error?: string
    }>(`api/jobs/${encodeURIComponent(jobId)}`)
    if (job.progress) onProgress?.(job.progress)
    if (job.status === 'done') return
    if (job.status === 'failed') throw new Error(job.error || '业绩快照刷新失败')
  }
}

export async function refreshTargetManagementSnapshot(
  monthId: number,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
  onProgress?: (progress: string) => void,
) {
  const { jobId } = await startTargetManagementSnapshotRefresh(monthId, employeeName)
  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
    const job = await get<{
      status: 'pending' | 'running' | 'done' | 'failed'
      progress: string
      error?: string
    }>(`api/jobs/${encodeURIComponent(jobId)}`)
    if (job.progress) onProgress?.(job.progress)
    if (job.status === 'done') return
    if (job.status === 'failed') throw new Error(job.error || '目标管理快照刷新失败')
  }
}

export const startWangYueTargetManagementSnapshotRefresh = (monthId: number) =>
  startTargetManagementSnapshotRefresh(monthId, '示例对客16')

export const refreshWangYueTargetManagementSnapshot = (
  monthId: number,
  onProgress?: (progress: string) => void,
) => refreshTargetManagementSnapshot(monthId, '示例对客16', onProgress)

export const getTargetManagementBrandOptions = (companyName: string) => {
  const params = new URLSearchParams({ companyName })
  return get<DashboardTargetManagementBrandOptionsResponse>(
    `api/dashboard/target-management-brand-options?${params.toString()}`,
  )
}

export const getTargetManagementCompanyOptions = (keyword: string) => {
  const params = new URLSearchParams({ keyword })
  return get<DashboardTargetManagementCompanyOptionsResponse>(
    `api/dashboard/target-management-company-options?${params.toString()}`,
  )
}

export const getTargetManagementDealCompanyOptions = (
  keyword: string,
  months: number,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
) => {
  const params = new URLSearchParams({ keyword, months: String(months), employeeName })
  return get<DashboardTargetManagementCompanyOptionsResponse>(
    `api/dashboard/target-management-deal-company-options?${params.toString()}`,
  )
}

export const previewWangYueTargetManagementImport = async (
  url: string,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
  onProgress?: (progress: string) => void,
) => {
  const { jobId } = await send<{ jobId: string }>(
    'POST',
    'api/dashboard/target-management-import-preview',
    { url, employeeName },
  )
  return waitForJobResult<DashboardTargetManagementImportPreviewResponse>(jobId, onProgress)
}

export const previewWangYueTargetManagementFileImport = async (
  file: File,
  monthId: number,
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
  onProgress?: (progress: string) => void,
) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('monthId', String(monthId))
  formData.append('employeeName', employeeName)
  const response = await fetch('api/dashboard/target-management-import-file-preview', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`)
  const { jobId } = await response.json() as { jobId: string }
  return waitForJobResult<DashboardTargetManagementImportPreviewResponse>(jobId, onProgress)
}

export const reviseWangYueTargetManagementImportPreview = async (
  preview: DashboardTargetManagementImportPreviewResponse,
  instruction: string,
  conversation: DashboardTargetManagementImportChatMessage[],
  employeeName: DashboardCompanyBoardEmployeeName = '示例对客16',
  onProgress?: (progress: string) => void,
) => {
  const { jobId } = await send<{ jobId: string }>(
    'POST',
    'api/dashboard/target-management-import-revise',
    { preview, instruction, conversation, employeeName },
  )
  return waitForJobResult<DashboardTargetManagementImportRevisionResponse>(jobId, onProgress)
}

export const getDashboardBrandPerformance = (
  monthId: number,
  dimension: DashboardOrderMetricDimension,
  employeeName: DashboardCompanyBoardEmployeeName = '示例开发01',
) => get<DashboardBrandPerformanceResponse>(
  `api/dashboard/brand-performance?monthId=${monthId}&dimension=${dimension}&employeeName=${encodeURIComponent(employeeName)}`,
  { cache: 'no-store' },
)

export const getDashboardCompanyBrandPerformance = (
  monthId: number,
  dimension: DashboardOrderMetricDimension,
  employeeName: DashboardCompanyBoardEmployeeName = '示例开发01',
) => get<DashboardCompanyBrandPerformanceResponse>(
  `api/dashboard/company-brand-performance?monthId=${monthId}&dimension=${dimension}&employeeName=${encodeURIComponent(employeeName)}`,
  { cache: 'no-store' },
)

export const getDashboardCompanyBrandShare = (
  monthId: number,
  dimension: DashboardOrderMetricDimension,
  companyName: string,
  employeeName: DashboardCompanyBoardEmployeeName = '示例开发01',
) => {
  const params = new URLSearchParams({
    monthId: String(monthId),
    dimension,
    companyName,
    employeeName,
  })
  return get<DashboardCompanyBrandShareResponse>(`api/dashboard/company-brand-share?${params.toString()}`)
}

export const getDashboardBrandCompanyShare = (
  monthId: number,
  dimension: DashboardOrderMetricDimension,
  brandName: string,
  employeeName: DashboardCompanyBoardEmployeeName = '示例开发01',
) => {
  const params = new URLSearchParams({
    monthId: String(monthId),
    dimension,
    brandName,
    employeeName,
  })
  return get<DashboardBrandCompanyShareResponse>(`api/dashboard/brand-company-share?${params.toString()}`)
}

export const getDashboardCompanyOrders = (
  page: number,
  pageSize: number,
  dimension: DashboardOrderMetricDimension,
  metricKey: DashboardCompanyMetricKey,
  monthId?: number,
  companyName?: string,
  filters?: DashboardUnpublishedOrderFilters,
  profitSort?: 'asc' | 'desc',
  employeeName: DashboardCompanyBoardEmployeeName = '示例开发01',
) => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), dimension, metricKey })
  params.set('employeeName', employeeName)
  if (monthId !== undefined) params.set('monthId', String(monthId))
  if (companyName) params.set('companyName', companyName)
  if (filters && Object.values(filters).some((value) => value?.trim())) {
    params.set('filters', JSON.stringify(filters))
  }
  if (profitSort) params.set('profitSort', profitSort)
  return get<DashboardCompanyOrdersResponse>(`api/dashboard/company-orders?${params.toString()}`)
}

export const updateMetricTargets = (targets: DashboardMetricTargetInput[]) =>
  send<{ ok: true }>('PATCH', 'api/dashboard/metric-targets', { targets })

export const updateMetricTarget = (target: DashboardMetricTargetInput) =>
  updateMetricTargets([target])

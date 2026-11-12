import { BadRequestException, Body, Controller, Get, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { DashboardAuthGuard, getDashboardIdentity, resolveDashboardEmployeeName } from '../../platform/dashboard-auth'
import { jobs } from '../../platform/jobs'
import {
  type DashboardCompanyMetricKey,
  type DashboardCompanyBoardEmployeeName,
  DASHBOARD_EMPLOYEE_NAMES,
  DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES,
  DASHBOARD_COMPANY_BRAND_SHARE_EMPLOYEE_NAMES,
  DASHBOARD_TARGET_MANAGEMENT_EMPLOYEE_NAMES,
  DASHBOARD_TARGET_MANAGEMENT_IMPORT_CONFIGURED_EMPLOYEE_NAMES,
  DASHBOARD_TARGET_SPLIT_PLAN_MONTH_ID,
  DASHBOARD_TARGET_SPLIT_PLAN_OWNER_NAMES,
  DashboardService,
  type DashboardTargetSplitPlanOwnerName,
  type DashboardOrderMetricDimension,
  type DashboardMetricTargetInput,
  type DashboardUnpublishedMetricKey,
  type DashboardUnpublishedOrderFilters,
  type WangYueTargetManagementImportChatMessage,
  type WangYueTargetManagementImportPreview,
} from './dashboard.service'

const UNPUBLISHED_METRIC_KEYS: DashboardUnpublishedMetricKey[] = [
  'halfPastTen',
  'selfIncubated',
  'signingXiaohongshu',
  'signingDouyin',
  'signingShipinhao',
  'outsourcing',
  'outsourcingOrderCount',
  'total',
]
const COMPANY_METRIC_KEYS: DashboardCompanyMetricKey[] = [
  'halfPastTen',
  'selfIncubated',
  'signingXiaohongshu',
  'signingDouyin',
  'signingShipinhao',
  'outsourcing',
  'total',
]

function getTargetManagementEmployeeName(value?: unknown): DashboardCompanyBoardEmployeeName {
  const employeeName = typeof value === 'string' && value.trim() ? value.trim() : '示例对客16'
  if (!DASHBOARD_TARGET_MANAGEMENT_EMPLOYEE_NAMES.includes(employeeName as DashboardCompanyBoardEmployeeName)) {
    throw new BadRequestException('目标管理人员不合法')
  }
  return employeeName as DashboardCompanyBoardEmployeeName
}

function getConfiguredTargetManagementImportEmployeeName(value?: unknown): DashboardCompanyBoardEmployeeName {
  const employeeName = getTargetManagementEmployeeName(value)
  if (!DASHBOARD_TARGET_MANAGEMENT_IMPORT_CONFIGURED_EMPLOYEE_NAMES.includes(employeeName)) {
    throw new BadRequestException(`${employeeName}的目标表导入规则尚未配置，请先确认该人员的表格字段和项目规则`)
  }
  return employeeName
}

@Controller('api/dashboard')
@UseGuards(DashboardAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('targets')
  async targets(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('employeeName') employeeName?: string,
    @Query('dimension') dimension?: string,
  ) {
    const parsedMonthId = monthId ? Number(monthId) : undefined
    const validDimensions: DashboardOrderMetricDimension[] = ['publish', 'deal', 'payment']
    if (dimension && !validDimensions.includes(dimension as DashboardOrderMetricDimension)) {
      throw new BadRequestException('看板维度不合法')
    }
    const identity = getDashboardIdentity(request)
    const selectedEmployeeName = identity.canViewAll || !employeeName?.trim() ? employeeName : resolveDashboardEmployeeName(request, employeeName)
    const rows = await this.dashboardService.list(
      parsedMonthId,
      selectedEmployeeName,
      dimension as DashboardOrderMetricDimension | undefined,
    )
    return { members: rows.filter(row => identity.canViewAll || identity.allowedEmployeeNames.includes(row.name)) }
  }

  @Get('target-split-plan')
  async getTargetSplitPlan(@Req() httpRequest: Request, @Query('ownerName') ownerName?: string, @Query('monthId') monthId?: string) {
    const parsedOwnerName = this.parseTargetSplitPlanOwnerName(resolveDashboardEmployeeName(httpRequest, ownerName, '示例开发01'))
    const parsedMonthId = this.parseTargetSplitPlanMonthId(monthId)
    return this.dashboardService.getTargetSplitPlan(parsedOwnerName, parsedMonthId)
  }

  @Put('target-split-plan')
  async saveTargetSplitPlan(@Req() httpRequest: Request, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('目标计划数据格式不正确')
    }
    const request = body as Record<string, unknown>
    const ownerName = this.parseTargetSplitPlanOwnerName(resolveDashboardEmployeeName(httpRequest, request.ownerName, '示例开发01'))
    const monthId = this.parseTargetSplitPlanMonthId(request.monthId)
    const plan = request.plan
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      throw new BadRequestException('目标计划不能为空')
    }
    if (JSON.stringify(plan).length > 500_000) throw new BadRequestException('目标计划数据过大，无法保存')
    return this.dashboardService.saveTargetSplitPlan(ownerName, monthId, plan as Record<string, unknown>)
  }

  @Post('target-split-import-preview')
  targetSplitImportPreview(@Req() request: Request, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('请提供企微表格链接和当前看板信息')
    }
    const bodyRecord = body as Record<string, unknown>
    const ownerName = this.parseTargetSplitPlanOwnerName(resolveDashboardEmployeeName(request, bodyRecord.ownerName, '示例开发01'))
    const monthId = this.parseTargetSplitPlanMonthId(bodyRecord.monthId)
    const sourceLink = typeof bodyRecord.sourceLink === 'string' ? bodyRecord.sourceLink.trim() : ''
    if (!sourceLink || sourceLink.length > 2048) {
      throw new BadRequestException('请提供有效的企微表格链接')
    }
    const jobId = jobs.start(({ progress }) => this.dashboardService.previewTargetSplitWorkbookImport(
      ownerName,
      monthId,
      sourceLink,
      undefined,
      progress,
    ), getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Post('target-split-import-file-preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  targetSplitImportFilePreview(
    @Req() request: Request,
    @UploadedFile() file?: { originalname: string; 示例品牌: Buffer },
    @Body('ownerName') requestedOwnerName?: string,
    @Body('monthId') monthId?: string,
  ) {
    const selectedOwnerName = this.parseTargetSplitPlanOwnerName(resolveDashboardEmployeeName(request, requestedOwnerName, '示例开发01'))
    const selectedMonthId = this.parseTargetSplitPlanMonthId(monthId)
    if (!file?.示例品牌?.length) throw new BadRequestException('请选择要导入的Excel表格')
    if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.originalname)) {
      throw new BadRequestException('仅支持 .xlsx、.xls、.xlsm 或 .csv 文件')
    }
    const jobId = jobs.start(({ progress }) => this.dashboardService.previewTargetSplitWorkbookImport(
      selectedOwnerName,
      selectedMonthId,
      undefined,
      { 示例品牌: file.示例品牌, originalname: file.originalname },
      progress,
    ), getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Post('target-split-import-image-preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 9 * 1024 * 1024 } }))
  targetSplitImportImagePreview(
    @Req() request: Request,
    @UploadedFile() file?: { originalname: string; mimetype: string; 示例品牌: Buffer },
    @Body('ownerName') requestedOwnerName?: string,
    @Body('monthId') monthId?: string,
  ) {
    const selectedOwnerName = this.parseTargetSplitPlanOwnerName(resolveDashboardEmployeeName(request, requestedOwnerName, '示例开发01'))
    const selectedMonthId = this.parseTargetSplitPlanMonthId(monthId)
    if (selectedOwnerName !== '示例开发01') {
      throw new BadRequestException('图片识别目前仅支持示例开发012026年11月的听说看板')
    }
    if (!file?.示例品牌?.length) throw new BadRequestException('请选择要识别的表格图片')
    const jobId = jobs.start(({ progress }) => this.dashboardService.previewTargetSplitImageImport(
      selectedOwnerName,
      selectedMonthId,
      { 示例品牌: file.示例品牌, originalname: file.originalname, mimetype: file.mimetype },
      progress,
    ), getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Get('muyuan-target-split-plan')
  async getMuyuanTargetSplitPlan(@Query('monthId') monthId?: string) {
    const parsedMonthId = this.parseTargetSplitPlanMonthId(monthId)
    return this.dashboardService.getTargetSplitPlan('示例开发01', parsedMonthId)
  }

  @Put('muyuan-target-split-plan')
  async saveMuyuanTargetSplitPlan(@Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('目标计划数据格式不正确')
    }
    const request = body as Record<string, unknown>
    const monthId = this.parseTargetSplitPlanMonthId(request.monthId)
    const plan = request.plan
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      throw new BadRequestException('目标计划不能为空')
    }
    if (JSON.stringify(plan).length > 500_000) throw new BadRequestException('目标计划数据过大，无法保存')
    return this.dashboardService.saveTargetSplitPlan('示例开发01', monthId, plan as Record<string, unknown>)
  }

  private parseTargetSplitPlanOwnerName(value: unknown): DashboardTargetSplitPlanOwnerName {
    const ownerName = typeof value === 'string' ? value.trim() : ''
    if (!DASHBOARD_TARGET_SPLIT_PLAN_OWNER_NAMES.includes(ownerName as DashboardTargetSplitPlanOwnerName)) {
      throw new BadRequestException('听说目标人员不合法')
    }
    return ownerName as DashboardTargetSplitPlanOwnerName
  }

  private parseTargetSplitPlanMonthId(value: unknown): number {
    if (Number(value) !== DASHBOARD_TARGET_SPLIT_PLAN_MONTH_ID) {
      throw new BadRequestException('仅支持2026年11月听说目标计划云端同步')
    }
    return DASHBOARD_TARGET_SPLIT_PLAN_MONTH_ID
  }

  @Get('metric-targets')
  async metricTargets(@Req() request: Request, @Query('monthId') monthId?: string, @Query('employeeName') employeeName?: string) {
    const identity = getDashboardIdentity(request)
    const selectedEmployeeName = identity.canViewAll || !employeeName?.trim() ? employeeName : resolveDashboardEmployeeName(request, employeeName)
    const targets = await this.dashboardService.getMetricTargets(Number(monthId || 0), selectedEmployeeName)
    return { targets: targets.filter(row => identity.canViewAll || identity.allowedEmployeeNames.includes(row.employeeName)) }
  }

  @Get('company-performance')
  async companyPerformance(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('dimension') dimension?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const validDimensions: DashboardOrderMetricDimension[] = ['publish', 'deal', 'payment']
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('公司看板方片月不合法')
    }
    if (!dimension || !validDimensions.includes(dimension as DashboardOrderMetricDimension)) {
      throw new BadRequestException('公司看板维度不合法')
    }
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例开发01')
    if (!DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('公司看板人员不合法')
    }
    return this.dashboardService.getCompanyPerformance(
      parsedMonthId,
      dimension as DashboardOrderMetricDimension,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Get('company-performance-breakdown')
  async companyPerformanceBreakdown(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例对客16')
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('公司业绩拆分方片月不合法')
    }
    if (!DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('公司业绩拆分人员不合法')
    }
    return this.dashboardService.getCompanyPerformanceBreakdown(
      parsedMonthId,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Get('target-management-actuals')
  async targetManagementActuals(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('employeeName') employeeName?: string,
    @Query('dimension') dimension?: string,
    @Query('developerEmployeeName') developerEmployeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('目标管理方片月不合法')
    }
    const selectedDimension = dimension || 'publish'
    if (!['publish', 'deal'].includes(selectedDimension)) {
      throw new BadRequestException('目标拆分业绩维度不合法')
    }
    const identity = getDashboardIdentity(request)
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例对客16')
    if (!DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('目标管理人员不合法')
    }
    return this.dashboardService.getTargetManagementActuals(
      parsedMonthId,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
      selectedDimension as DashboardOrderMetricDimension,
      identity.canViewAll ? developerEmployeeName : undefined,
    )
  }

  @Get('target-management-submission-snapshot')
  async targetManagementSubmissionSnapshot(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    if (!Number.isInteger(parsedMonthId) || parsedMonthId < 145 || parsedMonthId > 151) {
      throw new BadRequestException('做表数量方片月不合法')
    }
    return this.dashboardService.getTargetManagementSubmissionSnapshot(parsedMonthId, getTargetManagementEmployeeName(resolveDashboardEmployeeName(request, employeeName, '示例对客16')))
  }

  @Post('target-management-refresh')
  startTargetManagementRefresh(
    @Req() request: Request,
    @Body('monthId') monthId?: number,
    @Body('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const selectedEmployeeName = getTargetManagementEmployeeName(employeeName)
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('目标管理快照方片月不合法')
    }
    const jobId = jobs.start(({ progress }) => this.dashboardService.refreshCompanyBoardSnapshots(
      [parsedMonthId],
      progress,
      [selectedEmployeeName],
      ['publish'],
    ), getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Post('performance-snapshot-refresh')
  async startPerformanceSnapshotRefresh(
    @Req() request: Request,
    @Body('monthId') monthId?: number,
    @Body('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const selectedEmployeeName = typeof employeeName === 'string' ? employeeName.trim() : ''
    if (!Number.isInteger(parsedMonthId) || parsedMonthId < 145 || !await this.dashboardService.hasFangpianMonth(parsedMonthId)) {
      throw new BadRequestException('业绩快照方片月不在天玑周期目录中')
    }
    if (!DASHBOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName)) {
      throw new BadRequestException('业绩快照人员不合法')
    }
    const jobId = jobs.start(({ progress }) => this.dashboardService.refreshPerformanceSnapshots(
      [parsedMonthId],
      progress,
      [selectedEmployeeName],
    ), getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Get('target-management-brand-options')
  async targetManagementBrandOptions(@Query('companyName') companyName?: string) {
    const normalizedCompanyName = companyName?.trim() ?? ''
    if (!normalizedCompanyName || normalizedCompanyName.length > 200) {
      throw new BadRequestException('公司名称不能为空或过长')
    }
    return this.dashboardService.getTargetManagementBrandOptions(normalizedCompanyName)
  }

  @Get('target-management-company-options')
  async targetManagementCompanyOptions(@Query('keyword') keyword?: string) {
    const normalizedKeyword = keyword?.trim() ?? ''
    if (normalizedKeyword.length > 100) {
      throw new BadRequestException('公司关键词过长')
    }
    return this.dashboardService.getTargetManagementCompanyOptions(normalizedKeyword)
  }

  @Get('target-management-deal-company-options')
  async targetManagementDealCompanyOptions(
    @Req() request: Request,
    @Query('keyword') keyword?: string,
    @Query('months') months?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const normalizedKeyword = keyword?.trim() ?? ''
    const lookbackMonths = months === undefined ? 3 : Number(months)
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例对客16')
    if (normalizedKeyword.length > 100) {
      throw new BadRequestException('公司关键词过长')
    }
    if (!DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('公司成单筛选人员不合法')
    }
    if (!Number.isInteger(lookbackMonths) || lookbackMonths < 1 || lookbackMonths > 3) {
      throw new BadRequestException('公司成单筛选月份范围不合法')
    }
    return this.dashboardService.getTargetManagementDealCompanyOptions(
      normalizedKeyword,
      lookbackMonths,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Post('target-management-import-preview')
  targetManagementImportPreview(
    @Req() request: Request,
    @Body('url') sourceUrl?: string,
    @Body('employeeName') employeeName?: string,
  ) {
    const normalizedUrl = typeof sourceUrl === 'string' ? sourceUrl.trim() : ''
    const selectedEmployeeName = getConfiguredTargetManagementImportEmployeeName(resolveDashboardEmployeeName(request, employeeName, '示例对客16'))
    if (!normalizedUrl || normalizedUrl.length > 2048) {
      throw new BadRequestException('请提供有效的企微表格链接')
    }
    const jobId = jobs.start(({ progress }) => this.dashboardService.previewWangYueTargetManagementImport(
      normalizedUrl,
      undefined,
      progress,
      selectedEmployeeName,
    ), getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Post('target-management-import-revise')
  targetManagementImportRevise(@Req() request: Request, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('请先读取导入表格，再录入调整诉求')
    }
    const bodyRecord = body as Record<string, unknown>
    const selectedEmployeeName = getConfiguredTargetManagementImportEmployeeName(resolveDashboardEmployeeName(request, bodyRecord.employeeName, '示例对客16'))
    const instruction = typeof bodyRecord.instruction === 'string' ? bodyRecord.instruction.trim() : ''
    const preview = bodyRecord.preview as WangYueTargetManagementImportPreview | undefined
    if (!instruction || instruction.length > 1000) {
      throw new BadRequestException('请填写诉求（不超过1000字）')
    }
    if (!preview || !Array.isArray(preview.rows) || preview.rows.length > 1000) {
      throw new BadRequestException('导入预览已失效，请重新读取表格')
    }
    const conversation = Array.isArray(bodyRecord.conversation)
      ? bodyRecord.conversation.slice(-8).flatMap((message): WangYueTargetManagementImportChatMessage[] => {
        if (!message || typeof message !== 'object' || Array.isArray(message)) return []
        const item = message as Record<string, unknown>
        if ((item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') return []
        return [{ role: item.role, content: item.content.slice(0, 1200) }]
      })
      : []
    const jobId = jobs.start(({ progress }) => {
      progress('正在理解诉求并校验天玑公司、品牌目录…')
      return this.dashboardService.reviseWangYueTargetManagementImportPreview(
        preview,
        instruction,
        conversation,
        selectedEmployeeName,
      )
    }, getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Post('target-management-import-file-preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  targetManagementImportFilePreview(
    @Req() request: Request,
    @UploadedFile() file?: { originalname: string; 示例品牌: Buffer },
    @Body('monthId') monthId?: string,
    @Body('employeeName') employeeName?: string,
  ) {
    const selectedEmployeeName = getConfiguredTargetManagementImportEmployeeName(resolveDashboardEmployeeName(request, employeeName, '示例对客16'))
    if (!file?.示例品牌?.length) throw new BadRequestException('请选择要导入的表格文件')
    if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.originalname)) {
      throw new BadRequestException('仅支持 .xlsx、.xls、.xlsm 或 .csv 文件')
    }
    const parsedMonthId = Number(monthId)
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('请选择有效的方片月')
    }
    const jobId = jobs.start(({ progress }) => this.dashboardService.previewWangYueTargetManagementImport(undefined, {
      示例品牌: file.示例品牌,
      originalname: file.originalname,
      monthId: parsedMonthId,
    }, progress, selectedEmployeeName), getDashboardIdentity(request).employeeId)
    return { jobId }
  }

  @Get('company-orders')
  async companyOrders(
    @Req() request: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('monthId') monthId?: string,
    @Query('dimension') dimension?: string,
    @Query('metricKey') metricKey?: string,
    @Query('companyName') companyName?: string,
    @Query('filters') filtersQuery?: string,
    @Query('profitSort') profitSort?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = monthId ? Number(monthId) : undefined
    const validDimensions: DashboardOrderMetricDimension[] = ['publish', 'deal', 'payment']
    if (parsedMonthId !== undefined && ![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('公司订单方片月不合法')
    }
    if (!dimension || !validDimensions.includes(dimension as DashboardOrderMetricDimension)) {
      throw new BadRequestException('公司订单维度不合法')
    }
    const selectedMetricKey = metricKey || 'total'
    if (!COMPANY_METRIC_KEYS.includes(selectedMetricKey as DashboardCompanyMetricKey)) {
      throw new BadRequestException('公司订单指标不合法')
    }
    if (profitSort && profitSort !== 'asc' && profitSort !== 'desc') {
      throw new BadRequestException('公司收益排序方向不合法')
    }
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例开发01')
    if (!DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('公司看板人员不合法')
    }
    let filters: DashboardUnpublishedOrderFilters = {}
    if (filtersQuery) {
      try {
        const parsedFilters: unknown = JSON.parse(filtersQuery)
        if (!parsedFilters || typeof parsedFilters !== 'object' || Array.isArray(parsedFilters)) {
          throw new Error('invalid filters')
        }
        filters = parsedFilters as DashboardUnpublishedOrderFilters
      } catch {
        throw new BadRequestException('公司订单筛选条件格式不合法')
      }
    }
    return this.dashboardService.getCompanyOrders(
      Number(page || 1),
      Number(pageSize || 50),
      parsedMonthId,
      dimension as DashboardOrderMetricDimension,
      selectedMetricKey as DashboardCompanyMetricKey,
      companyName,
      filters,
      profitSort as 'asc' | 'desc' | undefined,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Get('brand-performance')
  async brandPerformance(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('dimension') dimension?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const validDimensions: DashboardOrderMetricDimension[] = ['publish', 'deal', 'payment']
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例开发01')
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('品牌看板方片月不合法')
    }
    if (!dimension || !validDimensions.includes(dimension as DashboardOrderMetricDimension)) {
      throw new BadRequestException('品牌看板维度不合法')
    }
    if (!DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('品牌看板人员不合法')
    }
    return this.dashboardService.getBrandPerformance(
      parsedMonthId,
      dimension as DashboardOrderMetricDimension,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Get('company-brand-share')
  async companyBrandShare(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('dimension') dimension?: string,
    @Query('companyName') companyName?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const validDimensions: DashboardOrderMetricDimension[] = ['publish', 'deal', 'payment']
    const normalizedCompanyName = companyName?.trim() ?? ''
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例开发01')
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('品牌占比方片月不合法')
    }
    if (!dimension || !validDimensions.includes(dimension as DashboardOrderMetricDimension)) {
      throw new BadRequestException('品牌占比维度不合法')
    }
    if (!DASHBOARD_COMPANY_BRAND_SHARE_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('当前人员暂不支持公司看板的品牌占比')
    }
    if (!normalizedCompanyName || normalizedCompanyName.length > 200) {
      throw new BadRequestException('公司名称不能为空或过长')
    }
    return this.dashboardService.getCompanyBrandShare(
      parsedMonthId,
      dimension as DashboardOrderMetricDimension,
      normalizedCompanyName,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Get('company-brand-performance')
  async companyBrandPerformance(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('dimension') dimension?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const validDimensions: DashboardOrderMetricDimension[] = ['publish', 'deal', 'payment']
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例开发01')
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('公司品牌业绩方片月不合法')
    }
    if (!dimension || !validDimensions.includes(dimension as DashboardOrderMetricDimension)) {
      throw new BadRequestException('公司品牌业绩维度不合法')
    }
    if (!DASHBOARD_COMPANY_BOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('公司品牌业绩人员不合法')
    }
    return this.dashboardService.getCompanyBrandPerformance(
      parsedMonthId,
      dimension as DashboardOrderMetricDimension,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Get('brand-company-share')
  async brandCompanyShare(
    @Req() request: Request,
    @Query('monthId') monthId?: string,
    @Query('dimension') dimension?: string,
    @Query('brandName') brandName?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    const parsedMonthId = Number(monthId)
    const validDimensions: DashboardOrderMetricDimension[] = ['publish', 'deal', 'payment']
    const normalizedBrandName = brandName?.trim() ?? ''
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例开发01')
    if (![147, 148, 149, 150, 151].includes(parsedMonthId)) {
      throw new BadRequestException('公司占比方片月不合法')
    }
    if (!dimension || !validDimensions.includes(dimension as DashboardOrderMetricDimension)) {
      throw new BadRequestException('公司占比维度不合法')
    }
    if (!DASHBOARD_COMPANY_BRAND_SHARE_EMPLOYEE_NAMES.includes(selectedEmployeeName as DashboardCompanyBoardEmployeeName)) {
      throw new BadRequestException('当前人员暂不支持品牌看板的公司占比')
    }
    if (!normalizedBrandName || normalizedBrandName.length > 200) {
      throw new BadRequestException('品牌名称不能为空或过长')
    }
    return this.dashboardService.getBrandCompanyShare(
      parsedMonthId,
      dimension as DashboardOrderMetricDimension,
      normalizedBrandName,
      selectedEmployeeName as DashboardCompanyBoardEmployeeName,
    )
  }

  @Get('unpublished-orders')
  async unpublishedOrders(
    @Req() request: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('monthId') monthId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('filters') filtersQuery?: string,
    @Query('employeeName') employeeName?: string,
    @Query('boardMonthId') boardMonthId?: string,
  ) {
    const selectedEmployeeName = resolveDashboardEmployeeName(request, employeeName, '示例开发01')
    if (!DASHBOARD_EMPLOYEE_NAMES.includes(selectedEmployeeName)) {
      throw new BadRequestException('未发布业绩人员不合法')
    }
    const selectedMetricKey = metricKey || 'total'
    if (!UNPUBLISHED_METRIC_KEYS.includes(selectedMetricKey as DashboardUnpublishedMetricKey)) {
      throw new BadRequestException('未发布业绩维度不合法')
    }
    let filters: DashboardUnpublishedOrderFilters = {}
    if (filtersQuery) {
      try {
        const parsedFilters: unknown = JSON.parse(filtersQuery)
        if (!parsedFilters || typeof parsedFilters !== 'object' || Array.isArray(parsedFilters)) {
          throw new Error('invalid filters')
        }
        filters = parsedFilters as DashboardUnpublishedOrderFilters
      } catch {
        throw new BadRequestException('未发布订单筛选条件格式不合法')
      }
    }
    return this.dashboardService.getUnpublishedOrders(
      Number(page || 1),
      Number(pageSize || 50),
      monthId ? Number(monthId) : undefined,
      selectedMetricKey as DashboardUnpublishedMetricKey,
      filters,
      selectedEmployeeName,
      boardMonthId ? Number(boardMonthId) : undefined,
    )
  }

  @Get('sync')
  async sync(@Query('monthId') monthId: string) {
    return this.dashboardService.syncMonth(Number(monthId))
  }

  @Patch('metric-targets')
  updateMetricTargets(@Body() body: { targets: DashboardMetricTargetInput[] } | DashboardMetricTargetInput) {
    return this.dashboardService.updateMetricTargets(Array.isArray((body as { targets?: DashboardMetricTargetInput[] }).targets)
      ? (body as { targets: DashboardMetricTargetInput[] }).targets
      : [body as DashboardMetricTargetInput])
  }
}

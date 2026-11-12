import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { DashboardAuthGuard, getDashboardIdentity } from '../../platform/dashboard-auth'
import { jobs } from '../../platform/jobs'
import { withTianjiBackgroundService } from '../../platform/tianji-data-context'
import { CommerceService, isCommerceManager } from './commerce.service'
import type { Dimension } from './commerce-domain'

function integer(value: unknown, label: string) {
  if (typeof value !== 'string' && !Number.isInteger(value)) throw new BadRequestException(`${label}无效`)
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n <= 0) throw new BadRequestException(`${label}无效`)
  return n
}
function dimension(value: unknown): Dimension {
  if (!['publish', 'deal', 'payment'].includes(String(value))) throw new BadRequestException('业绩阶段无效')
  return value as Dimension
}
@Controller('api/dashboard/commerce')
@UseGuards(DashboardAuthGuard)
export class CommerceController {
  constructor(private readonly service: CommerceService) {}
  @Get('catalog') commerceCatalog(@Req() request: Request) {
    return this.service.catalog(getDashboardIdentity(request))
  }
  @Get('status') commerceStatus(@Req() request: Request, @Query() q: Record<string, string>) {
    return this.service.status(
      getDashboardIdentity(request),
      integer(q.personId, '人员'),
      integer(q.periodId, '周期'),
    )
  }
  @Get('report') commerceReport(@Req() request: Request, @Query() q: Record<string, string>) {
    return this.service.report(
      getDashboardIdentity(request),
      integer(q.personId, '人员'),
      integer(q.periodId, '周期'),
      dimension(q.dimension),
    )
  }
  @Get('orders') commerceOrders(@Req() request: Request, @Query() q: Record<string, string>) {
    return this.service.orders(
      getDashboardIdentity(request),
      integer(q.personId, '人员'),
      integer(q.periodId, '周期'),
      dimension(q.dimension),
      {
        metric: q.metric,
        company: q.company,
        brand: q.brand,
        search: q.search,
        group: q.group,
        batchId: q.batchId,
        page: q.page ? integer(q.page, '页码') : 1,
        pageSize: 50,
      },
    )
  }
  @Get('evidence') commerceEvidence(@Req() request: Request, @Query() q: Record<string, string>) {
    return this.service.evidence(
      getDashboardIdentity(request),
      integer(q.personId, '人员'),
      integer(q.periodId, '周期'),
      dimension(q.dimension),
      integer(q.orderId, '订单'),
      q.batchId,
    )
  }
  @Put('targets') commerceSaveTargets(@Req() request: Request, @Body() body: any) {
    return this.service.saveTargets(
      getDashboardIdentity(request),
      integer(body?.personId, '人员'),
      integer(body?.monthId, '月份'),
      body?.targets,
    )
  }
  @Post('refresh') async commerceRefresh(@Req() request: Request, @Body() body: any) {
    const identity = getDashboardIdentity(request)
    if (!isCommerceManager(identity)) throw new ForbiddenException('仅示例开发01、示例开发09可刷新商务数据')
    const monthId = integer(body?.monthId, '月份'),
      slot = `manual:${new Date().toISOString().slice(0, 16)}`
    return {
      jobId: jobs.start(({ progress }) => withTianjiBackgroundService(() => this.service.refresh(monthId, slot, progress)), identity.employeeId),
    }
  }
  @Post('calendar-refresh') async commerceCalendarRefresh(@Req() request: Request) {
    const identity = getDashboardIdentity(request)
    if (!isCommerceManager(identity)) throw new ForbiddenException('仅示例开发01、示例开发09可刷新商务日历')
    return { jobId: jobs.start(() => withTianjiBackgroundService(() => this.service.refreshCatalog()), identity.employeeId) }
  }
}

import { BadGatewayException, BadRequestException, Controller, Get, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { dashboardAuth, platformActor } from '../../platform/dashboard-auth'
import { tianji } from '../../platform/tianji'

// Verified source mapping for AI中台: 方片/AI技术部. Never fall back to all departments.
const AI_DEPARTMENT_LEVEL_CODE = '008199'

/** Internal signed requests only. Every read retains the caller's own SSO identity. */
@Controller('api/labeling/tianji')
export class TianjiLabelingController {
  @Get('completion')
  async completion(@Req() req: Request, @Query() query: Record<string, unknown>) {
    await dashboardAuth.dataAccessToken(platformActor(req))
    const paging = this.paging(query, ['page', 'pageSize'])
    const result = await tianji.call('/api/admin/creator/tagLibStats/completionList', { ...paging, department_level_code: AI_DEPARTMENT_LEVEL_CODE },
      ['employee_id', 'tagger', 'batch_date', 'submitted', 'department_level_code', 'department_name_path'])
    if (!Array.isArray(result.data?.list) || result.data.list.some(row => typeof row.department_level_code !== 'string'
      || !row.department_level_code.startsWith(AI_DEPARTMENT_LEVEL_CODE))) throw new BadGatewayException('天玑AI部门筛选未生效，本次未更新排行榜')
    return result
  }

  @Get('detail')
  async detail(@Req() req: Request, @Query() query: Record<string, unknown>) {
    await dashboardAuth.dataAccessToken(platformActor(req))
    const paging = this.paging(query, ['page', 'pageSize', 'employee_id', 'batch_date'], 500)
    if (typeof query.employee_id !== 'string' || !/^[1-9]\d{0,11}$/.test(query.employee_id)
      || typeof query.batch_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(query.batch_date)) throw new BadRequestException('人员或批次日期无效')
    return tianji.call('/api/admin/creator/tagLibStats/assignDetail',
      { ...paging, employee_id: Number(query.employee_id), batch_date: query.batch_date },
      ['employee_id', 'assign_id', 'submitted', 'submit_time'])
  }

  private paging(query: Record<string, unknown>, allowed: string[], maximum = 200) {
    const page = Number(query.page), pageSize = Number(query.pageSize)
    if (Object.keys(query).some(key => !allowed.includes(key)) || typeof query.page !== 'string'
      || !Number.isInteger(page) || page < 1 || page > 1000 || typeof query.pageSize !== 'string'
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > maximum) throw new BadRequestException('分页参数无效')
    return { page, pageSize }
  }
}

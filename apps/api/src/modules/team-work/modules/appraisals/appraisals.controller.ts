import { JwtAuthGuard } from '../../../auth/jwt-auth.guard.js';
import { TeamWorkInterceptor } from '../../team-work.interceptor.js';
import { Inject, UseGuards, UseInterceptors, Body, Controller, Get, Post, Query } from '@nestjs/common'
import { CurrentUser } from '../../auth/auth.guard.js'
import type { AppraisalItem, PublicUser } from '../../domain/types.js'
import { AppraisalsService } from './appraisals.service.js'

/**
 * 月度绩效考核。
 * 看: 所有人的表 + 全员总表都开放 (只读), 谁都能看。
 * 填: 员工只能填自己的; 负责人(管理员)可以改别人的表, 也能评最终系数 / 上级评价。
 */
@Controller('team-work/appraisals')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TeamWorkInterceptor)
export class AppraisalsController {
  constructor(@Inject(AppraisalsService) private readonly appraisals: AppraisalsService) {}

  @Get()
  get(@CurrentUser() me: PublicUser, @Query('userId') userId?: string, @Query('month') month?: string) {
    return this.appraisals.get(me, { userId, month })
  }

  /** 某月全员的工作系数一览 (部门总表 / 小组总表的数据源, 只读, 全员可见) */
  @Get('overview')
  overview(@CurrentUser() me: PublicUser, @Query('month') month?: string) {
    return this.appraisals.overview(me, month)
  }

  @Post()
  save(
    @CurrentUser() me: PublicUser,
    @Body() body: { userId?: string; month?: string; items?: Array<Partial<AppraisalItem>> },
  ) {
    return this.appraisals.save(me, { userId: body?.userId, month: body?.month }, body?.items || [])
  }

  /** 从清单拉取当月任务, 补成考核行 */
  @Post('from-tasks')
  fromTasks(@CurrentUser() me: PublicUser, @Body() body: { userId?: string; month?: string }) {
    return this.appraisals.syncFromTasks(me, { userId: body?.userId, month: body?.month })
  }

  /** 把表里还没落地的行写成任务 / 子任务 */
  @Post('to-tasks')
  toTasks(@CurrentUser() me: PublicUser, @Body() body: { userId?: string; month?: string }) {
    return this.appraisals.syncToTasks(me, { userId: body?.userId, month: body?.month })
  }
}


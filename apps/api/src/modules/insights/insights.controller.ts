import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { InsightsService } from './insights.service.js';
@Controller('insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(@Inject(InsightsService) private readonly insights: InsightsService) {}
  @Get('company') company(@Req() r: { user: RequestUser }) { return this.insights.company(r.user); }
  @Get('project-gantt') projectGantt(@Req() r: { user: RequestUser }) { return this.insights.projectGantt(r.user); }
  @Get('departments/:id') department(@Req() r: { user: RequestUser }, @Param('id') id: string) { return this.insights.department(r.user, id); }
  @Get('employees/:id') employee(@Req() r: { user: RequestUser }, @Param('id') id: string) { return this.insights.employee(r.user, id); }
  @Get('value-network') network(@Req() r: { user: RequestUser }, @Query('from') from?: string, @Query('to') to?: string, @Query('types') types?: string, @Query('departmentId') departmentId?: string) { return this.insights.valueNetwork(r.user, { from, to, types, departmentId }); }
}

import { Body, Controller, Get, Inject, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LabelingDayDto, LabelingEntryDto, LabelingImportDto, LabelingQueryDto } from './labeling.dto.js';
import { LabelingService } from './labeling.service.js';

@Controller('leaderboards/labeling')
@UseGuards(JwtAuthGuard)
export class LabelingController {
  constructor(@Inject(LabelingService) private readonly labeling: LabelingService) {}
  @Get() leaderboard(@Req() req: { user: RequestUser }, @Query(dtoPipe(LabelingQueryDto)) query: LabelingQueryDto) { return this.labeling.leaderboard(req.user, query); }
  @Get('daily') daily(@Req() req: { user: RequestUser }, @Query(dtoPipe(LabelingDayDto)) query: LabelingDayDto) { return this.labeling.daily(req.user, query.date); }
  @Put('entries') save(@Req() req: { user: RequestUser }, @Body(dtoPipe(LabelingEntryDto)) body: LabelingEntryDto) { return this.labeling.save(req.user, body); }
  @Post('imports') import(@Req() req: { user: RequestUser }, @Body(dtoPipe(LabelingImportDto)) body: LabelingImportDto) { return this.labeling.import(req.user, body); }
}

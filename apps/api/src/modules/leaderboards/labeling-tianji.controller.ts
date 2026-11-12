import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LabelingTianjiService } from './labeling-tianji.service.js';

export class TianjiCallbackDto {
  @IsString() @Length(1, 2048) @Matches(/^[^\s\x00-\x1f\x7f]+$/) code: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) state: string;
}
export class TianjiSyncDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to: string;
}
@Controller('leaderboards/labeling/tianji')
@UseGuards(JwtAuthGuard)
export class LabelingTianjiController {
  constructor(@Inject(LabelingTianjiService) private readonly tianji: LabelingTianjiService) {}
  @Get('status') status(@Req() req: { user: RequestUser }) { return this.tianji.status(req.user); }
  @Post('login/start') startLogin(@Req() req: { user: RequestUser }) { return this.tianji.loginStart(req.user); }
  @Post('login/callback') callback(@Req() req: { user: RequestUser }, @Body(dtoPipe(TianjiCallbackDto)) body: TianjiCallbackDto) { return this.tianji.loginCallback(req.user, body); }
  @Post('sync') sync(@Req() req: { user: RequestUser }, @Body(dtoPipe(TianjiSyncDto)) body: TianjiSyncDto) { return this.tianji.start(req.user, body); }
  @Get('jobs/:id') job(@Req() req: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) { return this.tianji.job(req.user, id); }
}

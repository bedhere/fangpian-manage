import { Body, Controller, Get, Header, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
import { AiCenterService } from './ai-center.service.js';
import { AiCenterFilesService } from './ai-center-files.service.js';
import { AiCenterReportsService } from './ai-center-reports.service.js';
import { AiAppealDto, AiAppealResolveDto, AiCalendarDto, AiEnrollDto, AiExceptionDto, AiFileGrantDto, AiGrowthDraftDto, AiMemberDto } from './ai-center.dto.js';
@Controller('ai-center')
@UseGuards(JwtAuthGuard)
export class AiCenterController {
  constructor(@Inject(AiCenterService) private readonly service:AiCenterService,@Inject(AiCenterFilesService) private readonly files:AiCenterFilesService,@Inject(AiCenterReportsService) private readonly reports:AiCenterReportsService) {}
  @Get('workspace') @Header('Cache-Control','private, no-store') workspace(@Req() r:{user:RequestUser},@Query('week') week?:string){return this.service.workspace(r.user,week);}
  @Get('records/:id') @Header('Cache-Control','private, no-store') record(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string){return this.service.record(r.user,id);}
  @Get('records/:id/history') @Header('Cache-Control','private, no-store') history(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string){return this.service.history(r.user,id);}
  @Post('members') enroll(@Req() r:{user:RequestUser},@Body(dtoPipe(AiEnrollDto)) b:AiEnrollDto){return this.service.enroll(r.user,b.userId);}
  @Patch('members/:id') member(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(AiMemberDto)) b:AiMemberDto){return this.service.member(r.user,id,b);}
  @Put('calendar') calendar(@Req() r:{user:RequestUser},@Body(dtoPipe(AiCalendarDto)) b:AiCalendarDto){return this.service.calendar(r.user,b);}
  @Put('members/:id/exception') exception(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(AiExceptionDto)) b:AiExceptionDto){return this.service.exception(r.user,id,b);}
  @Get('records/:id/files') filesList(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string){return this.files.list(r.user,id);}
  @Post('records/:id/files') fileGrant(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(AiFileGrantDto)) b:AiFileGrantDto){return this.files.grant(r.user,id,b);}
  @Post('files/:id/complete') complete(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string){return this.files.complete(r.user,id);}
  @Get('files/:id/download') @Header('Cache-Control','private, no-store') download(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string){return this.files.download(r.user,id);}
  @Get('reports/:id') @Header('Cache-Control','private, no-store') report(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Query('week') week?:string){return this.reports.report(r.user,id,week);}
  @Post('reports/:id/growth') growth(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(AiGrowthDraftDto)) b:AiGrowthDraftDto){return this.reports.apply(r.user,id,b);}
  @Post('records/:id/appeal') appeal(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(AiAppealDto)) b:AiAppealDto){return this.service.appeal(r.user,id,b);}
  @Get('growth-plans') @Header('Cache-Control','private, no-store') growthPlans(@Req() r:{user:RequestUser}){return this.service.growthTargets(r.user);}
  @Get('growth-plans/:id') @Header('Cache-Control','private, no-store') growthPlan(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string){return this.service.growthTargets(r.user,id).then(rows=>rows[0]);}
  @Post('growth-plans/:id/appeal') growthAppeal(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(AiAppealDto)) b:AiAppealDto){return this.service.appealGrowth(r.user,id,b);}
  @Post('appeals/:id/resolve') resolve(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(AiAppealResolveDto)) b:AiAppealResolveDto){return this.service.resolveAppeal(r.user,id,b);}
  @Patch('notifications/:id/read') read(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string){return this.service.readNotification(r.user,id);}
}

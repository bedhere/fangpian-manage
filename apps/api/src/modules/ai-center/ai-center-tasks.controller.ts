import { Body, Controller, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AiCenterTasksService } from './ai-center-tasks.service.js';
import { CreateAiTaskDto, CreateSelfTaskDto, UpdateSelfTaskDto, TaskVersionDto, UpdateAiTaskDto, LinkDecisionDto, TaskDeclineDto, TaskDecisionDto, TaskDifficultyDto, TaskProgressDto, TaskReviewDto, TaskSubmitDto } from './ai-center-tasks.dto.js';
@Controller('ai-center')
@UseGuards(JwtAuthGuard)
export class AiCenterTasksController {
  constructor(@Inject(AiCenterTasksService) private readonly service: AiCenterTasksService) {}
  @Post('tasks') create(@Req() r:{user:RequestUser}, @Body(dtoPipe(CreateAiTaskDto)) b:CreateAiTaskDto) { return this.service.create(r.user,b); }
  @Post('task-requests') createSelf(@Req() r:{user:RequestUser},@Body(dtoPipe(CreateSelfTaskDto)) b:CreateSelfTaskDto){return this.service.createSelf(r.user,b);}
  @Patch('task-requests/:id') updateSelf(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(UpdateSelfTaskDto)) b:UpdateSelfTaskDto){return this.service.updateSelf(r.user,id,b);}
  @Post('task-requests/:id/submit') submitSelf(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(TaskVersionDto)) b:TaskVersionDto){return this.service.submitSelf(r.user,id,b);}
  @Post('task-requests/:id/revise') reviseSelf(@Req() r:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(TaskVersionDto)) b:TaskVersionDto){return this.service.reviseSelf(r.user,id,b);}
  @Patch('tasks/:id') update(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(UpdateAiTaskDto)) b:UpdateAiTaskDto) { return this.service.update(r.user,id,b); }
  @Post('tasks/:id/claim') claim(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(TaskDifficultyDto)) b:TaskDifficultyDto) { return this.service.claim(r.user,id,b); }
  @Patch('tasks/:id/difficulty') difficulty(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(TaskDifficultyDto)) b:TaskDifficultyDto) { return this.service.difficulty(r.user,id,b); }
  @Post('tasks/:id/decision') decision(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(TaskDecisionDto)) b:TaskDecisionDto) { return this.service.decision(r.user,id,b); }
  @Patch('tasks/:id/progress') progress(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(TaskProgressDto)) b:TaskProgressDto) { return this.service.progress(r.user,id,b); }
  @Post('tasks/:id/submit') submit(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(TaskSubmitDto)) b:TaskSubmitDto) { return this.service.submit(r.user,id,b); }
  @Post('tasks/:id/review') review(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(TaskReviewDto)) b:TaskReviewDto) { return this.service.review(r.user,id,b); }
  @Post('tasks/:id/decline') decline(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(TaskDeclineDto)) b:TaskDeclineDto) { return this.service.decline(r.user,id,b); }
  @Post('links/:id/decision') linkDecision(@Req() r:{user:RequestUser}, @Param('id',ParseUUIDPipe) id:string, @Body(dtoPipe(LinkDecisionDto)) b:LinkDecisionDto) { return this.service.linkDecision(r.user,id,b); }
}


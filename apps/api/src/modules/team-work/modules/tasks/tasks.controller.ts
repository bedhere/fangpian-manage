import { JwtAuthGuard } from '../../../auth/jwt-auth.guard.js';
import { TeamWorkInterceptor } from '../../team-work.interceptor.js';
import { Inject, UseGuards, UseInterceptors, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CurrentUser } from '../../auth/auth.guard.js'
import type { PublicUser, TaskStatus, TaskProgressInput } from '../../domain/types.js'
import { TasksService, type TaskInput } from './tasks.service.js'
import { TeamWorkEvidenceService } from '../../team-work.evidence.js'

@Controller('team-work/tasks')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TeamWorkInterceptor)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService, @Inject(TeamWorkEvidenceService) private readonly evidence: TeamWorkEvidenceService) {}

  @Get(':id/evidence/:index')
  attachment(@CurrentUser() me: PublicUser, @Param('id') id: string, @Param('index') index: string) {
    return this.evidence.get(me, id, index)
  }

  @Get()
  list(@CurrentUser() me: PublicUser) {
    return this.tasks.list(me)
  }

  @Get('summary')
  summary(@CurrentUser() me: PublicUser) {
    return this.tasks.summary(me)
  }

  @Post()
  create(@Body() body: TaskInput, @CurrentUser() me: PublicUser) {
    return this.tasks.create(body, me)
  }

  @Get(':id/details')
  details(@Param('id') id: string, @CurrentUser() me: PublicUser) {
    return this.tasks.details(id, me)
  }

  @Post(':id/progress')
  progress(@Param('id') id: string, @Body() body: TaskProgressInput, @CurrentUser() me: PublicUser) {
    return this.tasks.reportProgress(id, body, me)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<TaskInput & { status: TaskStatus }>,
    @CurrentUser() me: PublicUser,
  ) {
    return this.tasks.update(id, body, me)
  }

  // ── 回收站 (软删除) ──
  @Get('trash')
  trash(@CurrentUser() me: PublicUser) {
    return this.tasks.trashList(me)
  }

  @Post('trash/restore')
  restore(@Body() body: { ids: string[] }, @CurrentUser() me: PublicUser) {
    return this.tasks.restore(body?.ids || [], me)
  }

  @Post('trash/purge')
  purge(@Body() body: { ids: string[] }, @CurrentUser() me: PublicUser) {
    return this.tasks.purge(body?.ids || [], me)
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() me: PublicUser) {
    return this.tasks.claim(id, me)
  }

  @Post(':id/release')
  release(@Param('id') id: string, @CurrentUser() me: PublicUser) {
    return this.tasks.release(id, me)
  }

  /** 删除 = 丢进回收站 */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() me: PublicUser) {
    return this.tasks.trash(id, me)
  }
}


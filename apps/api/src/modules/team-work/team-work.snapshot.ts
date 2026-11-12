import { Controller, Get, Inject, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from './auth/auth.guard.js';
import type { PublicUser } from './domain/types.js';
import { TasksService } from './modules/tasks/tasks.service.js';
import { MemosService } from './modules/memos/memos.service.js';
import { IvyService } from './modules/ivy/ivy.service.js';
import { organizationView } from './team-work.controller.js';
import { TeamWorkInterceptor } from './team-work.interceptor.js';

/** All board data shares one authenticated, organization-locked snapshot. */
@Controller('team-work/tasks')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TeamWorkInterceptor)
export class TeamWorkSnapshotController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService,
    @Inject(MemosService) private readonly memos: MemosService,
    @Inject(IvyService) private readonly ivy: IvyService) {}

  @Get('snapshot')
  async snapshot(@CurrentUser() me: PublicUser) {
    // Materialize recurring tasks before computing their statistics.
    const list = await this.tasks.list(me);
    const [summary, { memos }, { records }] = await Promise.all([
      this.tasks.summary(me), this.memos.list(me), this.ivy.list(me),
    ]);
    return { user: me, org: organizationView(), ...list, summary, memos, ivy: records };
  }
}

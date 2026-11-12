import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { TasksController } from './modules/tasks/tasks.controller.js';
import { TasksService } from './modules/tasks/tasks.service.js';
import { MemosController } from './modules/memos/memos.controller.js';
import { MemosService } from './modules/memos/memos.service.js';
import { IvyController } from './modules/ivy/ivy.controller.js';
import { IvyService } from './modules/ivy/ivy.service.js';
import { AppraisalsController } from './modules/appraisals/appraisals.controller.js';
import { AppraisalsService } from './modules/appraisals/appraisals.service.js';
import { TeamWorkController } from './team-work.controller.js';
import { TeamWorkInterceptor } from './team-work.interceptor.js';
import { TeamWorkRepository } from './team-work.repository.js';
import { TeamWorkScheduler } from './team-work.scheduler.js';
import { TeamWorkEvidenceService } from './team-work.evidence.js';
import { TeamWorkSnapshotController } from './team-work.snapshot.js';
import { WecomController } from './wecom/wecom.controller.js';
import { WecomService } from './wecom/wecom.service.js';
import { WecomCli } from './wecom/wecom-cli.js';

@Module({ imports: [AuthModule],
  controllers: [WecomController, TeamWorkController, TeamWorkSnapshotController, TasksController, MemosController, IvyController, AppraisalsController],
  providers: [WecomService, {provide:WecomCli,useFactory:()=>new WecomCli()}, PrismaService, TeamWorkRepository, TeamWorkInterceptor, TeamWorkScheduler, TasksService, TeamWorkEvidenceService, MemosService, IvyService, AppraisalsService],
  exports: [TeamWorkRepository, TasksService],
})
export class TeamWorkModule {}

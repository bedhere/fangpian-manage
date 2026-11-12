import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { TeamWorkModule } from '../team-work/team-work.module.js';

@Module({
  imports: [AuthModule, TeamWorkModule],
  controllers: [WorkspaceController],
  providers: [PrismaService, WorkspaceService],
})
export class WorkspaceModule {}

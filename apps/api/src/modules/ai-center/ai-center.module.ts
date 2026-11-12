import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AiCenterRepository } from './ai-center.repository.js';
import { AiCenterService } from './ai-center.service.js';
import { AiCenterFilesService } from './ai-center-files.service.js';
import { AiCenterReportsService } from './ai-center-reports.service.js';
import { AiCenterRemindersService } from './ai-center-reminders.service.js';
import { AiCenterController } from './ai-center.controller.js';
import { AiCenterTasksController } from './ai-center-tasks.controller.js';
import { AiCenterTasksService } from './ai-center-tasks.service.js';
import { AiCenterJournalController } from './ai-center-journal.controller.js';
import { AiCenterJournalService } from './ai-center-journal.service.js';
import { AiCenterMentorsController } from './ai-center-mentors.controller.js';
import { AiCenterMentorsService } from './ai-center-mentors.service.js';
import { IvyWecomService } from './ivy-wecom.service.js';
import { WecomMessageClient } from './wecom-message.client.js';
@Module({imports:[AuthModule],controllers:[AiCenterController,AiCenterTasksController,AiCenterJournalController,AiCenterMentorsController],providers:[PrismaService,AiCenterRepository,AiCenterService,AiCenterFilesService,AiCenterReportsService,AiCenterRemindersService,AiCenterTasksService,AiCenterJournalService,AiCenterMentorsService,IvyWecomService,{provide:WecomMessageClient,useFactory:()=>new WecomMessageClient()}],exports:[AiCenterRepository,AiCenterReportsService]})
export class AiCenterModule {}

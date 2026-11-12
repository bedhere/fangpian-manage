import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AiCenterModule } from '../ai-center/ai-center.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LabelingController } from './labeling.controller.js';
import { LabelingService } from './labeling.service.js';
import { LabelingTianjiService } from './labeling-tianji.service.js';
import { LabelingTianjiController } from './labeling-tianji.controller.js';

@Module({ imports: [AuthModule, AiCenterModule], controllers: [LabelingController, LabelingTianjiController], providers: [PrismaService, LabelingService, LabelingTianjiService] })
export class LeaderboardModule {}

import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { TraineeController } from './trainee.controller.js';
import { TraineeService } from './trainee.service.js';
import { GrowthController, GrowthEditorGuard } from './growth.controller.js';
import { GrowthService } from './growth.service.js';
import { GrowthAnalysisService } from './growth-analysis.service.js';
import { AiCenterModule } from '../ai-center/ai-center.module.js';
@Module({
  imports: [AuthModule, AiCenterModule],
  controllers: [GrowthController, TraineeController],
  providers: [PrismaService, TraineeService, GrowthService, GrowthAnalysisService, GrowthEditorGuard],
})
export class TraineeModule {}

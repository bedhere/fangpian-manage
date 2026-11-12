import { Module } from '@nestjs/common';
import { AIEvaluationQueueService } from '../../infrastructure/ai-evaluation-queue.service.js';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { BuffController } from './buff.controller.js';
import { BuffService } from './buff.service.js';
@Module({
  imports: [AuthModule],
  controllers: [BuffController],
  providers: [PrismaService, AIEvaluationQueueService, BuffService],
})
export class BuffModule {}

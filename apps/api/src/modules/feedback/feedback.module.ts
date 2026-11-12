import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { FeedbackController } from './feedback.controller.js';
import { ProjectFeedbackService } from './project-feedback.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FeedbackController],
  providers: [PrismaService, ProjectFeedbackService],
  exports: [ProjectFeedbackService],
})
export class FeedbackModule {}

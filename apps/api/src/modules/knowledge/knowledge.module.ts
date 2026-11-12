import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeController],
  providers: [PrismaService, KnowledgeService],
})
export class KnowledgeModule {}

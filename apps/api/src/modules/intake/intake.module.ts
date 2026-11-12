import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { IntakeController } from './intake.controller.js';
import { IntakeService } from './intake.service.js';
import { AIWorkspaceController } from './ai-workspace.controller.js';
import { AIWorkspaceService } from './ai-workspace.service.js';
import { AI_WORKSPACE_GATEWAY } from './ai-workspace.service.js';
import { AIGateway } from '@value-flow/ai';

@Module({
  imports: [AuthModule],
  controllers: [IntakeController, AIWorkspaceController],
  providers: [
    PrismaService,
    IntakeService,
    AIWorkspaceService,
    {
      provide: AI_WORKSPACE_GATEWAY,
      useFactory: () => new AIGateway({
        baseUrl: process.env.AI_BASE_URL ?? '',
        apiKey: process.env.AI_API_KEY ?? '',
        model: process.env.AI_MODEL ?? '',
        maxAttempts: Number(process.env.AI_MAX_ATTEMPTS ?? 2),
        timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 20_000),
      }),
    },
  ],
})
export class IntakeModule {}

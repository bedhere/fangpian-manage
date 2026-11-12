import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaService } from './prisma.service.js';
@Injectable()
export class AIEvaluationQueueService implements OnModuleDestroy {
  private readonly connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
  private readonly queue = new Queue('value-flow-system', { connection: this.connection });
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async enqueue(organizationId: string, assessmentId: string) {
    const setting = await this.prisma.systemSetting.findFirst({ where: { organizationId, key: 'ai.evaluationWorker' } });
    const rules = (setting?.value ?? { attempts: 3, backoffMs: 5000 }) as { attempts: number; backoffMs: number };
    await this.queue.add('ai-evaluation', { assessmentId }, { jobId: `ai-evaluation-${assessmentId}`, attempts: rules.attempts, backoff: { type: 'exponential', delay: rules.backoffMs }, removeOnComplete: 100, removeOnFail: 500 });
  }
  async enqueueBuff(organizationId: string, runId: string) {
    const setting = await this.prisma.systemSetting.findFirst({ where: { organizationId, key: 'buff.rules' } });
    const rules = (setting?.value ?? { attempts: 3, backoffMs: 5000 }) as { attempts: number; backoffMs: number };
    await this.queue.add('ai-buff-run', { runId }, { jobId: `ai-buff-run-${runId}`, attempts: rules.attempts, backoff: { type: 'exponential', delay: rules.backoffMs }, removeOnComplete: 100, removeOnFail: 500 });
  }
  async onModuleDestroy() { await this.queue.close(); await this.connection.quit(); }
}

import { Inject, Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { PublicUser } from './domain/types.js';
import { TasksService } from './modules/tasks/tasks.service.js';
import { TeamWorkRepository } from './team-work.repository.js';
import { deliverTeamReminders } from './team-work.notifications.js';

@Injectable()
export class TeamWorkScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(TeamWorkScheduler.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TeamWorkRepository) private readonly repository: TeamWorkRepository,
    @Inject(TasksService) private readonly tasks: TasksService) {}
  onModuleInit() {
    this.timer = setInterval(() => { void this.tick(); }, 30000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const organizations = await this.prisma.teamWorkState.findMany({ select: { organizationId: true } });
      for (const { organizationId } of organizations) await this.repository.runOrganization(organizationId, async (db, tx) => {
        // No identity is impersonated: materialization/list has no actor writes.
        const reader: PublicUser = { id: '', name: 'scheduler', account: '', title: '', role: 'admin', state: 'active',
          departmentId: null, groupIds: [], mustChangePassword: false, avatarEmoji: null, avatarColor: null, createdAt: '', lastLoginAt: null };
        await this.tasks.list(reader);
        await deliverTeamReminders(db, tx);
      });
    } catch (error) { this.logger.error('部门待办定时处理失败', error instanceof Error ? error.stack : String(error)); }
    finally { this.busy = false; }
  }
}

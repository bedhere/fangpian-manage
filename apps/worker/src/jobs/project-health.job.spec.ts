import { describe, expect, it, vi } from 'vitest';
import { runProjectHealthJob } from './project-health.job.js';

describe('runProjectHealthJob', () => {
  it('refuses to calculate health when the organization has no configured thresholds', async () => {
    const prisma = {
      project: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', organizationId: 'o1', status: 'IN_PROGRESS', startedAt: new Date('2026-01-01'), deadline: new Date('2026-12-31'), progressLogs: [], milestones: [] }]) },
      systemSetting: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    await expect(runProjectHealthJob(prisma as never)).rejects.toThrow('缺少项目健康阈值配置');
  });

  it('creates deduplicated risk notifications from configured thresholds', async () => {
    const notification = { createMany: vi.fn().mockResolvedValue({ count: 2 }) };
    const prisma = {
      project: {
        findMany: vi.fn().mockResolvedValue([{ id: 'p1', organizationId: 'o1', ownerId: 'u1', supervisorId: 'u2', publisherId: 'u1', title: '风险项目', status: 'IN_PROGRESS', startedAt: new Date('2026-01-01'), deadline: new Date('2026-10-01'), progressLogs: [{ progressPercent: 10, riskLevel: 3, blockers: '阻塞' }], milestones: [] }]),
        update: vi.fn(),
      },
      systemSetting: { findFirst: vi.fn().mockResolvedValue({ value: { yellowGap: 20, redGap: 35, yellowRiskLevel: 2, redRiskLevel: 3 } }) },
      projectHealthSnapshot: { create: vi.fn() }, notification,
    };
    await runProjectHealthJob(prisma as never, new Date('2026-09-01'));
    expect(notification.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true, data: expect.arrayContaining([expect.objectContaining({ dedupeKey: expect.stringContaining('health:p1:RED') })]) }));
  });
});

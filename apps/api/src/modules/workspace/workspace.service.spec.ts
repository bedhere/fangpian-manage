import { describe, expect, it, vi } from 'vitest';
import { WorkspaceService } from './workspace.service.js';

const user = {
  id: 'user-1',
  organizationId: 'org-1',
  email: 'employee@example.com',
  roles: ['EMPLOYEE'],
  permissions: ['project:read'],
};
const teamWork = { run: vi.fn(async (actor: { id: string }, operation: (db: { users: Array<{ id: string; role: string }> }) => Promise<number>) => operation({ users: [{ id: actor.id, role: 'member' }] })) };
const tasks = { summary: vi.fn(async () => ({ total: 14 })) };

describe('WorkspaceService', () => {
  it('returns minimum bootstrap for TRAINEE-only without reading team-work or organization projects', async () => {
    const prisma = { user: { findFirst: vi.fn().mockResolvedValue({ displayName: '新管培生', department: null, profile: { capabilityLevel: 'L0', reputationScore: 100 } }) } };
    const noTeamWork = { run: vi.fn() };
    const service = new WorkspaceService(prisma as never, noTeamWork as never, {} as never);
    const result = await service.bootstrap({ ...user, roles: ['TRAINEE'], permissions: [] });
    expect(noTeamWork.run).not.toHaveBeenCalled();
    expect(result.navigation).toEqual([{ id: 'trainees', label: '管培生入驻', href: '/trainees' }, { id: 'leaderboards', label: '排行榜', href: '/leaderboards' }]);
    expect(result.tasks).toEqual([]);
    expect(result.workQueues.departmentTodos).toBe(0);
  });
  it('aggregates only the current user and organization into the employee workspace', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ displayName: '方小成', departmentId: 'd1', department: { name: '产品部' }, profile: { capabilityLevel: 'L2', reputationScore: 108 } }) },
      project: { count: vi.fn().mockResolvedValue(2), findMany: vi.fn().mockResolvedValue([]) },
      projectApplication: { count: vi.fn().mockResolvedValue(1) },
      notification: { count: vi.fn().mockResolvedValue(3), findMany: vi.fn().mockResolvedValue([]) },
      bonusLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: '1200.00' } }) },
      contributionDispute: { count: vi.fn().mockResolvedValue(0) }, projectSkillEvidence: { count: vi.fn().mockResolvedValue(0) },
    };
    const service = new WorkspaceService(prisma as never, teamWork as never, tasks as never);

    const result = await service.bootstrap(user);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1', organizationId: 'org-1', deletedAt: null } }));
    expect(result.user.displayName).toBe('方小成');
    expect(result.workQueues.departmentTodos).toBe(14);
    expect(teamWork.run).toHaveBeenCalledWith(user, expect.any(Function));
    expect(result.navigation.map((item) => item.id)).toEqual(['dashboard', 'projects', 'market', 'opportunities', 'circles', 'buffs', 'bonuses', 'profile', 'capacity', 'rankings', 'trainees', 'leaderboards']);
    expect(result.counters).toEqual(expect.objectContaining({ activeProjects: 2, pendingApplications: 1, unreadNotifications: 3 }));
  });

  it('adds review and executive work areas only from issued permissions', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ displayName: '负责人', department: null, profile: null }) },
      project: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      projectApplication: { count: vi.fn().mockResolvedValue(0) },
      notification: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      bonusLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
      contributionDispute: { count: vi.fn().mockResolvedValue(0) }, projectSkillEvidence: { count: vi.fn().mockResolvedValue(0) },
    };
    const service = new WorkspaceService(prisma as never, teamWork as never, tasks as never);
    const result = await service.bootstrap({ ...user, roles: ['OWNER'], permissions: ['project:read', 'project:business-review', 'analytics:executive'] });

    expect(result.navigation.map((item) => item.id)).toEqual(expect.arrayContaining(['reviews', 'executive']));
    expect(result.navigation.map((item) => item.id)).not.toContain('admin');
  });
});

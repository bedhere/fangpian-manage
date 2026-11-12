import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/auth.types.js';
import { ExecutionService } from './execution.service.js';

const owner: RequestUser = {
  id: 'owner-id', organizationId: 'org-id', email: 'owner@example.com',
  roles: [], permissions: ['project:read'],
};
const supervisor: RequestUser = {
  ...owner, id: 'supervisor-id', permissions: ['project:technical-review'],
};

describe('ExecutionService planning and execution boundaries', () => {
  it('rejects a plan whose milestone weights do not total 100', async () => {
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', ownerId: owner.id, status: 'OWNER_ASSIGNED' }) } };
    const service = new ExecutionService(prisma as never);
    await expect(service.savePlan(owner, 'p1', {
      objective: '完成自动化交付',
      milestones: [{ title: '第一阶段', description: '说明', dueAt: '2026-11-01', weight: 80, expectedDeliverable: '成果' }],
    })).rejects.toMatchObject({ message: '里程碑权重总和必须为100%' });
  });

  it('does not start before the current plan is supervisor-confirmed', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', ownerId: owner.id, status: 'PLANNING' }) },
      projectPlan: { findFirst: vi.fn().mockResolvedValue({ id: 'plan-1', status: 'SUBMITTED' }) },
    };
    const service = new ExecutionService(prisma as never);
    await expect(service.start(owner, 'p1')).rejects.toMatchObject({ message: '执行计划尚未由主管确认' });
  });

  it('forbids unrelated employees from editing the team', async () => {
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', ownerId: 'another-owner', status: 'PLANNING' }) } };
    const service = new ExecutionService(prisma as never);
    await expect(service.inviteMember(owner, 'p1', { userId: 'candidate-id', role: 'CONTRIBUTOR' })).rejects.toBeTruthy();
  });

  it('allows only active members or supervisors to append progress', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', ownerId: 'another-owner', status: 'IN_PROGRESS' }) },
      projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new ExecutionService(prisma as never);
    await expect(service.progress(owner, 'p1', {
      progressPercent: 10, summary: '刚开始', riskLevel: 0, nextAction: '继续',
    })).rejects.toBeTruthy();
  });

  it('requires a remediation action before replacing an owner', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', ownerId: owner.id, status: 'AT_RISK' }) },
      projectHealthSnapshot: { count: vi.fn().mockResolvedValue(2) },
      projectRiskAction: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new ExecutionService(prisma as never);
    await expect(service.replaceOwner(supervisor, 'p1', { newOwnerId: 'new-owner', reason: '持续失控' })).rejects.toMatchObject({ message: '更换负责人前必须先创建未关闭的整改措施' });
  });

  it('records a failed project and applies owner feedback after the state change', async () => {
    const tx = { project: { update: vi.fn().mockResolvedValue({ id: 'p1', status: 'FAILED' }) }, auditLog: { create: vi.fn() } };
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', organizationId: 'org-id', ownerId: owner.id, status: 'IN_PROGRESS' }) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const feedback = { applyReputationFact: vi.fn() };
    const service = new ExecutionService(prisma as never, feedback as never);
    await service.failProject(supervisor, 'p1', { reason: '验收目标已不可达', maliciousAbandonment: true });
    expect(feedback.applyReputationFact).toHaveBeenCalledWith('org-id', 'p1', owner.id, 'PROJECT_FAILED', expect.any(Object));
    expect(feedback.applyReputationFact).toHaveBeenCalledWith('org-id', 'p1', owner.id, 'MALICIOUS_ABANDON', expect.any(Object));
  });

  it('does not allow an owner to mark their own abandonment as malicious', async () => {
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', organizationId: 'org-id', ownerId: supervisor.id, status: 'IN_PROGRESS' }) } };
    const service = new ExecutionService(prisma as never, { applyReputationFact: vi.fn() } as never);
    await expect(service.failProject(supervisor, 'p1', { reason: '主动放弃', maliciousAbandonment: true })).rejects.toMatchObject({ message: '禁止认定自己的恶意放弃行为' });
  });
});

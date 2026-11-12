import { describe, expect, it, vi } from 'vitest';
import { SettlementService } from './settlement.service.js';

const actor = { id: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222', email: 'owner@example.com', roles: [], permissions: [] };
const memberId = '33333333-3333-4333-8333-333333333333';

describe('SettlementService contribution proposal versions', () => {
  it('returns an organization-scoped transparent bonus projection with cumulative facts', async () => {
    const prisma = {
      bonusLedger: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([{ id: 'l1', userId: memberId, projectId: 'p1', amount: { toString: () => '1200.00' }, contributionPercentage: { toString: () => '60.00' }, status: 'PAID', settlementMonth: new Date('2026-10-01'), user: { displayName: '方小成', bonusLedgers: [{ amount: { toString: () => '1200.00' }, project: { rating: { grade: 'A' } } }] }, project: { title: '关键项目', finalBonus: { toString: () => '2000.00' }, rating: { grade: 'A', finalScore: 88 }, members: [{ userId: memberId, role: 'CONTRIBUTOR' }] } }]),
      },
    };
    const result = await new SettlementService(prisma as never).transparentLedger(actor, { page: 1, pageSize: 20 });
    expect(prisma.bonusLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: actor.organizationId }) }));
    expect(result.items[0]).toMatchObject({ employee: { displayName: '方小成' }, project: { title: '关键项目' }, role: 'CONTRIBUTOR', cumulativeAmount: 1200, grade: 'A', contributionScore: 52.8 });
    expect(JSON.stringify(result)).not.toContain('email');
  });
  it('creates a new proposal version without deleting the previous facts', async () => {
    const tx = {
      projectContribution: {
        updateMany: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: { create: vi.fn() },
      notification: { createMany: vi.fn() },
    };
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', title: '项目', organizationId: actor.organizationId, ownerId: actor.id, status: 'CONTRIBUTION_CONFIRMATION', members: [{ userId: memberId, role: 'CONTRIBUTOR' }], rating: {} }) },
      projectContribution: { aggregate: vi.fn().mockResolvedValue({ _max: { proposalVersion: 2 } }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new SettlementService(prisma as never);
    await service.propose(actor, 'p1', [{ userId: memberId, percentage: '100' }]);
    expect(tx.projectContribution).not.toHaveProperty('deleteMany');
    expect(tx.projectContribution.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ supersededAt: expect.any(Date) }) }));
    expect(tx.projectContribution.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ proposalVersion: 3 }) }));
  });

  it('rejects a response to a superseded proposal', async () => {
    const prisma = { projectContribution: { findFirst: vi.fn().mockResolvedValue({ id: 'c1', userId: actor.id, supersededAt: new Date(), project: { status: 'CONTRIBUTION_CONFIRMATION' } }) } };
    const service = new SettlementService(prisma as never);
    await expect(service.respond(actor, 'p1', 'c1', { decision: 'CONFIRM' })).rejects.toMatchObject({ message: '贡献方案已更新，请刷新后处理最新版本' });
  });

  it('returns contribution actions from server-side identity and current facts', async () => {
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', title: '项目', organizationId: actor.organizationId, ownerId: actor.id, supervisorId: 'supervisor', status: 'CONTRIBUTION_CONFIRMATION', members: [], contributions: [], contributionDisputes: [], rating: { grade: 'A' } }) } };
    const service = new SettlementService(prisma as never);
    const result = await service.workspace(actor, 'p1');
    expect(result.allowedActions).toContain('PROPOSE_CONTRIBUTIONS');
    expect(result.allowedActions).not.toContain('ARBITRATE_CONTRIBUTIONS');
  });
});

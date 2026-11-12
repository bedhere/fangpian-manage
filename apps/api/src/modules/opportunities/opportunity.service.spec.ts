import { describe, expect, it, vi } from 'vitest';
import { OpportunityService } from './opportunity.service.js';
const actor = {
  id: 'u1',
  organizationId: 'o1',
  email: 'u1@example.com',
  roles: [],
  permissions: [],
};
describe('OpportunityService', () => {
  it('rejects a publisher proposal to preserve self-review separation', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'd1' }) },
      opportunity: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'x',
            publisherId: 'u1',
            status: 'OPEN',
            deadline: null,
          }),
      },
    };
    await expect(
      new OpportunityService(prisma as never).propose(actor, 'x', {
        title: '方案',
        approach: '足够详细的执行办法',
        expectedValue: '明确业务价值',
      }),
    ).rejects.toMatchObject({ message: '发布者不能向自己的机会提交提案' });
  });
  it('creates a draft business request when the publisher accepts another user proposal', async () => {
    const tx = {
      businessRequest: { create: vi.fn().mockResolvedValue({ id: 'r1' }) },
      opportunityProposal: { update: vi.fn(), updateMany: vi.fn() },
      opportunity: { update: vi.fn() },
      opportunityConversion: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'c1', businessRequestId: 'r1' }),
      },
      auditLog: { create: vi.fn() },
      notification: { create: vi.fn() },
    };
    const prisma = {
      opportunity: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'x',
            publisherId: 'u1',
            title: '增长机会',
            description: '需要解决的业务问题',
            conversion: null,
            proposals: [
              {
                id: 'p1',
                proposerId: 'u2',
                title: '自动化方案',
                approach: '使用流程自动化',
                expectedValue: '节省一半时间',
                status: 'PENDING',
              },
            ],
          }),
      },
      $transaction: vi.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
    };
    await new OpportunityService(prisma as never).convert(actor, 'x', 'p1');
    expect(tx.businessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'o1',
        requesterId: 'u1',
        status: 'DRAFT',
      }),
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u2' }),
    });
  });
  it('enforces the configured proposal limit instead of a hard-coded uniqueness rule', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'd1' }) },
      opportunity: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'x',
            publisherId: 'u2',
            status: 'OPEN',
            deadline: null,
          }),
      },
      systemSetting: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ value: { maxProposalsPerUser: 2 } }),
      },
      opportunityProposal: {
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn(),
      },
    };
    await expect(
      new OpportunityService(prisma as never).propose(actor, 'x', {
        title: '方案',
        approach: '足够详细的执行办法',
        expectedValue: '明确业务价值',
      }),
    ).rejects.toMatchObject({ message: '已达到该机会的提案上限' });
  });
});

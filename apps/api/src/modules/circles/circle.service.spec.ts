import { describe, expect, it, vi } from 'vitest';
import { CircleService } from './circle.service.js';
const actor = {
  id: 'u1',
  organizationId: 'o1',
  email: 'u1@example.com',
  roles: [],
  permissions: [],
};
describe('CircleService', () => {
  it('prevents the owner from reviewing their own join request', async () => {
    const prisma = {
      circle: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1', ownerId: 'u1' }),
      },
      circleJoinRequest: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'j1',
            applicantId: 'u1',
            status: 'PENDING',
          }),
      },
    };
    await expect(
      new CircleService(prisma as never).review(actor, 'c1', 'j1', 'APPROVED'),
    ).rejects.toMatchObject({ message: '不能审核自己的加入申请' });
  });
  it('enforces the configured member limit before approving a request', async () => {
    const prisma = {
      circle: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1', ownerId: 'u1' }),
      },
      circleJoinRequest: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'j1',
            applicantId: 'u2',
            status: 'PENDING',
          }),
      },
      systemSetting: {
        findFirst: vi.fn().mockResolvedValue({ value: { maxMembers: 2 } }),
      },
      circleMember: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
      },
    };
    await expect(
      new CircleService(prisma as never).review(actor, 'c1', 'j1', 'APPROVED'),
    ).rejects.toMatchObject({ message: '圈子成员已达到上限' });
  });
  it('creates a knowledge draft from persisted member discussions', async () => {
    const prisma = {
      circle: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1', topic: '探索自动化' }),
      },
      circleDiscussion: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { authorId: 'u1', content: '形成方案', createdAt: new Date() },
          ]),
      },
      knowledgeAsset: {
        create: vi.fn().mockResolvedValue({ id: 'k1', status: 'DRAFT' }),
      },
      auditLog: { create: vi.fn() },
    };
    const result = await new CircleService(prisma as never).knowledge(
      actor,
      'c1',
      '探索复盘',
      '圈子形成的可复用结论',
    );
    expect(result).toMatchObject({ id: 'k1' });
    expect(prisma.knowledgeAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'o1',
        authorId: 'u1',
        assetType: 'CASE_STUDY',
        status: 'DRAFT',
      }),
    });
  });
});

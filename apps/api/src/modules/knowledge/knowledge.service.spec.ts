import { describe, expect, it, vi } from 'vitest';
import { KnowledgeService } from './knowledge.service.js';

const businessReviewer = {
  id: 'business-reviewer', organizationId: 'org-1', email: 'head@example.com',
  roles: ['DEPARTMENT_HEAD'], permissions: ['project:business-review'],
};
const technicalReviewer = {
  id: 'technical-reviewer', organizationId: 'org-1', email: 'admin@example.com',
  roles: ['SUPER_ADMIN'], permissions: ['project:technical-review'],
};

describe('KnowledgeService dual approval', () => {
  it('records a real same-tenant usage once and increments the aggregate', async () => {
    const tx = { knowledgeAssetUsageEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, knowledgeAsset: { update: vi.fn().mockResolvedValue({ usageCount: 3 }) }, auditLog: { create: vi.fn() } };
    const prisma = { knowledgeAsset: { findFirst: vi.fn().mockResolvedValue({ id: 'asset-1', status: 'PUBLISHED', usageCount: 2 }) }, project: { findFirst: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' }) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const result = await new KnowledgeService(prisma as never).reuse(businessReviewer, 'asset-1', { referenceType: 'PROJECT', referenceId: '11111111-1111-4111-8111-111111111111', idempotencyKey: 'reuse-project-once' });
    expect(result).toEqual({ reused: true, usageCount: 3 });
    expect(tx.knowledgeAssetUsageEvent.create).toHaveBeenCalledOnce();
  });

  it('rejects a reuse reference outside the current organization', async () => {
    const prisma = { knowledgeAsset: { findFirst: vi.fn().mockResolvedValue({ id: 'asset-1', status: 'PUBLISHED', usageCount: 2 }) }, project: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(new KnowledgeService(prisma as never).reuse(businessReviewer, 'asset-1', { referenceType: 'PROJECT', referenceId: '11111111-1111-4111-8111-111111111111', idempotencyKey: 'reuse-other-tenant' })).rejects.toThrow('引用对象不存在或不属于当前组织');
  });
  it('lists published assets plus the current author and permission-specific review queue', async () => {
    const prisma = { knowledgeAsset: { findMany: vi.fn().mockResolvedValue([]) } };
    const service = new KnowledgeService(prisma as never);

    await service.list(businessReviewer);

    expect(prisma.knowledgeAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      organizationId: 'org-1',
      OR: [{ status: 'PUBLISHED' }, { authorId: 'business-reviewer' }, { status: 'BUSINESS_REVIEW' }],
    } }));
  });

  it('creates a tenant-scoped draft owned by the current author', async () => {
    const prisma = {
      knowledgeAsset: { create: vi.fn().mockResolvedValue({ id: 'asset-1', status: 'DRAFT' }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new KnowledgeService(prisma as never);

    await service.create({ ...businessReviewer, id: 'author-1' }, {
      title: '竞品分析方法', summary: '可复用的竞品分析步骤', content: { steps: ['收集', '对比'] },
    });

    expect(prisma.knowledgeAsset.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: 'org-1', authorId: 'author-1', status: 'DRAFT',
    }) });
  });

  it('rejects linking an asset to a request outside the author tenant boundary', async () => {
    const prisma = {
      businessRequest: { findFirst: vi.fn().mockResolvedValue(null) },
      knowledgeAsset: { create: vi.fn() },
    };
    const service = new KnowledgeService(prisma as never);

    await expect(service.create({ ...businessReviewer, id: 'author-1' }, {
      title: '竞品分析方法', summary: '可复用的竞品分析步骤', content: { steps: ['收集', '对比'] },
      requestId: '11111111-1111-1111-1111-111111111111',
    })).rejects.toThrow('关联需求不存在或无权访问');
    expect(prisma.businessRequest.findFirst).toHaveBeenCalledWith({ where: {
      id: '11111111-1111-1111-1111-111111111111', organizationId: 'org-1', requesterId: 'author-1',
    } });
    expect(prisma.knowledgeAsset.create).not.toHaveBeenCalled();
  });

  it('submits a draft to business review', async () => {
    const prisma = {
      knowledgeAsset: {
        findFirst: vi.fn().mockResolvedValue({ id: 'asset-1', authorId: 'author-1', status: 'DRAFT' }),
        update: vi.fn().mockResolvedValue({ id: 'asset-1', status: 'BUSINESS_REVIEW' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new KnowledgeService(prisma as never);

    await service.submit({ ...businessReviewer, id: 'author-1' }, 'asset-1');

    expect(prisma.knowledgeAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' }, data: { status: 'BUSINESS_REVIEW' },
    });
  });

  it('forbids an author from reviewing their own asset', async () => {
    const prisma = { knowledgeAsset: { findFirst: vi.fn().mockResolvedValue({ id: 'asset-1', authorId: 'business-reviewer', status: 'BUSINESS_REVIEW', reviews: [] }) } };
    const service = new KnowledgeService(prisma as never);

    await expect(service.review(businessReviewer, 'asset-1', 'BUSINESS', { decision: 'APPROVED' })).rejects.toThrow('不能审核自己提交的知识资产');
  });

  it('moves an approved business review to technical review without publishing', async () => {
    const prisma = {
      knowledgeAsset: {
        findFirst: vi.fn().mockResolvedValue({ id: 'asset-1', authorId: 'author-1', status: 'BUSINESS_REVIEW', reviews: [] }),
        update: vi.fn().mockResolvedValue({ id: 'asset-1', status: 'TECHNICAL_REVIEW' }),
      },
      knowledgeAssetReview: { upsert: vi.fn().mockResolvedValue({}) },
      notification: { create: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new KnowledgeService(prisma as never);

    await service.review(businessReviewer, 'asset-1', 'BUSINESS', { decision: 'APPROVED', comment: '业务有效' });

    expect(prisma.knowledgeAsset.update).toHaveBeenCalledWith({ where: { id: 'asset-1' }, data: { status: 'TECHNICAL_REVIEW' } });
  });

  it('publishes only after approval by a different technical reviewer', async () => {
    const prisma = {
      knowledgeAsset: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'asset-1', authorId: 'author-1', status: 'TECHNICAL_REVIEW',
          reviews: [{ stage: 'BUSINESS', reviewerId: 'business-reviewer', decision: 'APPROVED' }],
        }),
        update: vi.fn().mockResolvedValue({ id: 'asset-1', status: 'PUBLISHED' }),
      },
      knowledgeAssetReview: { upsert: vi.fn().mockResolvedValue({}) },
      notification: { create: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new KnowledgeService(prisma as never);

    await service.review(technicalReviewer, 'asset-1', 'TECHNICAL', { decision: 'APPROVED', comment: '技术可复用' });

    expect(prisma.knowledgeAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' }, data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'author-1', type: 'REVIEW', entityType: 'KnowledgeAsset', entityId: 'asset-1',
    }) });
  });
});

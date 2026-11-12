import { describe, expect, it, vi } from 'vitest';
import { DeliveryService } from './delivery.service.js';

const owner = { id: 'owner-id', organizationId: 'org-id', email: 'owner@example.com', roles: [], permissions: [] };

describe('DeliveryService security and version facts', () => {
  it('returns only the acceptance role assigned to the current reviewer', async () => {
    const project = {
      id: 'project-id', organizationId: 'org-id', ownerId: 'owner-id', publisherId: 'publisher-id',
      status: 'BUSINESS_ACCEPTANCE', publisherDepartment: { headId: 'head-id' },
      owner: { managerId: 'manager-id' },
    };
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue(project) },
      projectDelivery: { findMany: vi.fn().mockResolvedValue([{ id: 'd1', version: 1 }]) },
      aIAssessment: { findMany: vi.fn().mockResolvedValue([]) },
      deliveryAcceptance: { findMany: vi.fn().mockResolvedValue([]) },
      projectRating: { findUnique: vi.fn().mockResolvedValue(null) },
      systemSetting: { findFirst: vi.fn().mockResolvedValue({ value: { publisherBusiness: 30 } }) },
    };
    const service = new DeliveryService(prisma as never);
    const result = await service.workspace({ ...owner, id: 'head-id' }, 'project-id');
    expect(result.assignedRoles).toEqual(['DEPARTMENT_HEAD_BUSINESS']);
    expect(result.allowedActions).toContain('SUBMIT_ACCEPTANCE');
    expect(result.allowedActions).not.toContain('SUBMIT_DELIVERY');
  });

  it('builds the delivery review queue from server-side reviewer assignments', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new DeliveryService({ project: { findMany } } as never);
    await service.reviewQueue({ ...owner, id: 'head-id', permissions: ['project:executive-confirm'] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-id', OR: expect.any(Array) }),
    }));
    const call = findMany.mock.calls[0]?.[0];
    expect(JSON.stringify(call.where.OR)).toContain('publisherDepartment');
    expect(JSON.stringify(call.where.OR)).toContain('EXECUTIVE_CONFIRMATION');
  });

  it('rejects a storage key outside the current organization and project prefix', async () => {
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue({ id: 'project-id', organizationId: 'org-id', ownerId: owner.id, status: 'IN_PROGRESS', publisherDepartment: {}, owner: {} }) } };
    const service = new DeliveryService(prisma as never);
    await expect(service.submit(owner, 'project-id', { type: 'FILE', title: '交付文件', storageKey: 'organizations/another-org/projects/project-id/stolen.zip', changeSummary: '首版交付' } as never)).rejects.toMatchObject({ message: '文件对象不属于当前组织或项目' });
  });

  it('keeps previous acceptance facts when a new delivery version is submitted', async () => {
    const tx = {
      projectDelivery: { findFirst: vi.fn().mockResolvedValue({ version: 1 }), create: vi.fn().mockResolvedValue({ id: 'd2', version: 2 }) },
      project: { update: vi.fn() }, deliveryAcceptance: { deleteMany: vi.fn() }, projectRating: { deleteMany: vi.fn() }, auditLog: { create: vi.fn() },
    };
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue({ id: 'project-id', organizationId: 'org-id', ownerId: owner.id, status: 'IN_PROGRESS', publisherDepartment: {}, owner: {} }) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new DeliveryService(prisma as never);
    await service.submit(owner, 'project-id', { type: 'TEXT', title: '第二版', content: '内容', changeSummary: '修复验收问题' } as never);
    expect(tx.deliveryAcceptance.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectRating.deleteMany).not.toHaveBeenCalled();
  });

  it('queues an AI assessment by id without advancing the project', async () => {
    const aiCreate = vi.fn().mockResolvedValue({ id: 'assessment-1', status: 'QUEUED' });
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'project-id', organizationId: 'org-id', ownerId: owner.id, status: 'DELIVERY_SUBMITTED', publisherDepartment: {}, owner: {} }) },
      projectDelivery: { findFirst: vi.fn().mockResolvedValue({ id: 'd1', version: 1, title: '成果', changeSummary: '首版', content: '内容' }) },
      aIAssessment: { create: aiCreate },
      auditLog: { create: vi.fn() },
    };
    const reviewContext = { projectId: 'project-id', deliveryId: 'd1', request: { problem: '原始问题', acceptanceCriteria: '验收标准' }, execution: { milestones: [], progress: [], risks: [] }, deliveries: [], truncation: {} };
    const context = { assemble: vi.fn().mockResolvedValue(reviewContext) };
    const queue = { enqueue: vi.fn() };
    const service = new DeliveryService(prisma as never, context as never, queue as never);
    await expect(service.aiReview(owner, 'project-id', undefined as never)).resolves.toMatchObject({ id: 'assessment-1', status: 'QUEUED' });
    expect(aiCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'QUEUED', inputSnapshot: reviewContext }) }));
    expect(queue.enqueue).toHaveBeenCalledWith('org-id', 'assessment-1');
  });
});

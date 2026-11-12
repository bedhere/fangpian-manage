import { describe, expect, it, vi } from 'vitest';
import { ReviewsService } from './reviews.service.js';

const actor = {
  id: 'reviewer-1', organizationId: 'org-1', email: 'reviewer@example.com', roles: ['DEPARTMENT_HEAD'],
  permissions: ['project:business-review', 'project:technical-review'],
};

describe('ReviewsService queues', () => {
  it('scopes business review queue to the reviewer department and tenant', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'marketing' }) },
      project: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new ReviewsService(prisma as never);

    await service.queue(actor, 'BUSINESS');

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      organizationId: 'org-1', OR: [{ publisherDepartmentId: 'marketing' }, { publisherDepartment: { headId: 'reviewer-1' } }], status: { in: ['HUMAN_REQUIRED', 'DEPARTMENT_REVIEW'] },
      publisherId: { not: 'reviewer-1' },
    } }));
  });

  it('includes projects the technical reviewer already approved at business stage', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'tech' }) },
      project: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new ReviewsService(prisma as never);

    await service.queue(actor, 'TECHNICAL');

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      organizationId: 'org-1', status: 'TECH_REVIEW', publisherId: { not: 'reviewer-1' },
    } }));
  });
});

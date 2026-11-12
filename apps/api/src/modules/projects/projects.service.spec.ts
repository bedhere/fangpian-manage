import { describe, expect, it, vi } from 'vitest';
import { ProjectsService } from './projects.service.js';

const actor = {
  id: 'reviewer-1', organizationId: 'org-1', email: 'head@example.com', roles: ['DEPARTMENT_HEAD'],
  permissions: ['project:business-review', 'project:technical-review'],
};

const project = {
  id: 'project-1', organizationId: 'org-1', publisherId: 'publisher-1',
  publisherDepartmentId: 'marketing', status: 'HUMAN_REQUIRED', version: 1, approvals: [], aiAssessments: [],
};

describe('ProjectsService review authorization', () => {
  it('allows the explicitly assigned department head to review a managed department', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ ...project, publisherDepartment: { headId: actor.id } }) },
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'executive-office' }) },
      projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const result = await new ProjectsService(prisma as never).detail(actor, project.id);
    expect(result.allowedActions).toContain('BUSINESS_REVIEW');
    prisma.project.findFirst.mockResolvedValue({ ...project, publisherId: actor.id, publisherDepartment: { headId: actor.id } });
    const own = await new ProjectsService(prisma as never).detail(actor, project.id);
    expect(own.allowedActions).not.toContain('BUSINESS_REVIEW');
  });
  it('allows company management to review across departments while forbidding self review', async () => {
    const prisma = { project: { findFirst: vi.fn().mockResolvedValue(project) }, user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'executive-office' }) }, projectMember: { findFirst: vi.fn().mockResolvedValue(null) } };
    const manager = { ...actor, roles: ['OWNER'] };
    expect((await new ProjectsService(prisma as never).detail(manager, project.id)).allowedActions).toContain('BUSINESS_REVIEW');
    prisma.project.findFirst.mockResolvedValue({ ...project, publisherId: manager.id });
    expect((await new ProjectsService(prisma as never).detail(manager, project.id)).allowedActions).not.toContain('BUSINESS_REVIEW');
  });
  it('limits the promoted-project entry to the current owner', async () => {
    const prisma = { project: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
    await new ProjectsService(prisma as never).list(actor, { page: 1, pageSize: 20, view: 'OWNED' });
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1', ownerId: actor.id } }));
  });
  it('lists only tenant projects visible to the current user', async () => {
    const prisma = {
      project: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    };
    const service = new ProjectsService(prisma as never);

    const result = await service.list(actor, { page: 1, pageSize: 20, view: 'MINE' });

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: 'org-1',
        OR: [{ publisherId: 'reviewer-1' }, { ownerId: 'reviewer-1' }, { members: { some: { userId: 'reviewer-1' } } }],
      },
      skip: 0,
      take: 20,
    }));
    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('returns server-authorized actions with the unified project detail', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ ...project, status: 'HUMAN_REQUIRED' }) },
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'marketing' }) },
      projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new ProjectsService(prisma as never);

    const result = await service.detail(actor, 'project-1');

    expect(result.allowedActions).toContain('BUSINESS_REVIEW');
    expect(result.allowedActions).not.toContain('RESUBMIT');
    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ publisher: expect.anything(), publisherDepartment: expect.anything(), owner: expect.anything() }),
    }));
  });

  it('allows a technical reviewer to compare applications while intake is open', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ ...project, status: 'APPLICATION_OPEN' }) },
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'marketing' }) },
      projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new ProjectsService(prisma as never);

    const result = await service.detail(actor, 'project-1');

    expect(result.allowedActions).toContain('REVIEW_APPLICATIONS');
  });

  it('rejects business review by a head from another department', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue(project) },
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'sales' }) },
      $transaction: vi.fn(),
    };
    const service = new ProjectsService(prisma as never);

    await expect(service.review(actor, 'project-1', 'BUSINESS', { decision: 'APPROVED', expectedVersion: 1 })).rejects.toThrow('WRONG_DEPARTMENT');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('offers technical review to the same person who approved business', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({
        ...project, status: 'TECH_REVIEW', approvals: [{ stage: 'BUSINESS', reviewerId: 'reviewer-1', decision: 'APPROVED' }],
      }) },
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'marketing' }) },
      projectMember: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    };
    const service = new ProjectsService(prisma as never);

    expect((await service.detail(actor, 'project-1')).allowedActions).toContain('TECHNICAL_REVIEW');
  });

  it('rejects a stale review decision before writing approval history', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ ...project, version: 4 }) },
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'marketing' }) },
      $transaction: vi.fn(),
    };
    const service = new ProjectsService(prisma as never);

    await expect(service.review(actor, 'project-1', 'BUSINESS', {
      decision: 'APPROVED', expectedVersion: 3,
    } as never)).rejects.toThrow('审核内容已更新');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('audits the configured field values before and after a review decision', async () => {
    const tx = {
      projectApproval: { create: vi.fn().mockResolvedValue({}) },
      project: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...project, status: 'TECH_REVIEW', version: 2 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      notification: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue({ ...project, businessValueScore: 55 }) },
      user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'marketing' }) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProjectsService(prisma as never);

    await service.review(actor, 'project-1', 'BUSINESS', {
      decision: 'APPROVED', expectedVersion: 1, businessValueScore: 88,
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      before: expect.objectContaining({ businessValueScore: 55 }),
      after: expect.objectContaining({ businessValueScore: 88 }),
    }) });
  });

  it('allows only the publisher to resubmit a revised project', async () => {
    const prisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue({ ...project, status: 'HUMAN_REQUIRED', version: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...project, status: 'DEPARTMENT_REVIEW', version: 3 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new ProjectsService(prisma as never);

    const result = await service.resubmit({ ...actor, id: 'publisher-1' }, 'project-1', 2);

    expect(result).toMatchObject({ status: 'DEPARTMENT_REVIEW', version: 3 });
    expect(prisma.project.updateMany).toHaveBeenCalledWith({
      where: { id: 'project-1', organizationId: 'org-1', version: 2 },
      data: { status: 'DEPARTMENT_REVIEW', version: { increment: 1 } },
    });
  });
});

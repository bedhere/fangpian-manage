import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/auth.types.js';
import { CapacityService } from './capacity.service.js';
import { ProjectApplicationService } from './project-application.service.js';

const reviewer: RequestUser = {
  id: 'reviewer-id',
  organizationId: 'organization-a',
  email: 'reviewer@example.com',
  roles: [],
  permissions: ['project:technical-review'],
};

describe('tenant isolation', () => {
  it('does not expose applications for a project outside the actor organization', async () => {
    const prisma = {
      project: { findFirst: vi.fn().mockResolvedValue(null) },
      projectApplication: { findMany: vi.fn() },
    };
    const service = new ProjectApplicationService(
      prisma as never,
      {} as never,
    );

    await expect(service.list(reviewer, 'foreign-project')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-project', organizationId: 'organization-a' },
      select: { id: true },
    });
    expect(prisma.projectApplication.findMany).not.toHaveBeenCalled();
  });

  it('scopes application decisions through the project organization', async () => {
    const prisma = {
      projectApplication: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new ProjectApplicationService(
      prisma as never,
      {} as never,
    );

    await expect(
      service.decide(reviewer, 'foreign-project', 'application-id', {
        decision: 'REJECTED',
        note: 'not accessible',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectApplication.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'application-id',
        projectId: 'foreign-project',
        project: { organizationId: 'organization-a' },
      },
      include: { project: true },
    });
  });

  it('does not expose skills for a user outside the actor organization', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      employeeSkill: { findMany: vi.fn() },
    };
    const service = new CapacityService(prisma as never);

    await expect(
      service.skills('organization-a', 'foreign-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.employeeSkill.findMany).not.toHaveBeenCalled();
  });

  it('rejects overlapping capacity periods for the same employee', async () => {
    const prisma = { employeeCapacity: { findFirst: vi.fn().mockResolvedValue({ id: 'existing' }), upsert: vi.fn() } };
    const service = new CapacityService(prisma as never);
    await expect(service.set('user-1', { periodStart: '2026-10-01', periodEnd: '2026-10-31', availableHours: 80 })).rejects.toMatchObject({ message: '产能周期与现有记录重叠' });
    expect(prisma.employeeCapacity.upsert).not.toHaveBeenCalled();
  });
});

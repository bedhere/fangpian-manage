import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/auth.types.js';
import { ProjectApplicationService } from './project-application.service.js';

const applicant: RequestUser = {
  id: 'applicant-id',
  organizationId: 'organization-id',
  email: 'employee@example.com',
  roles: [],
  permissions: ['project:read'],
};
const reviewer: RequestUser = {
  ...applicant,
  id: 'reviewer-id',
  permissions: ['project:technical-review'],
};

describe('ProjectApplicationService', () => {
  it('returns matching explanation, capacity conflict, estimated bonus and current application state', async () => {
    const project = {
      id: 'project-id',
      projectLevel: 'P2',
      estimatedHours: 20,
    };
    const prisma = {
      project: { findMany: vi.fn().mockResolvedValue([project]) },
      projectApplication: {
        findMany: vi.fn().mockResolvedValue([
          { projectId: project.id, status: 'PENDING' },
        ]),
      },
      bonusRule: {
        findMany: vi.fn().mockResolvedValue([
          { projectLevel: 'P2', hourlyRate: 250 },
        ]),
      },
    };
    const matching = {
      calculate: vi.fn().mockResolvedValue({
        score: 82,
        components: { capacity: 75 },
        employeeLevel: 3,
        requiredLevel: 2,
        specialReviewRequired: false,
      }),
    };
    const service = new ProjectApplicationService(
      prisma as never,
      matching as never,
    );

    await expect(service.market(applicant)).resolves.toEqual([
      expect.objectContaining({
        id: project.id,
        matching: expect.objectContaining({
          components: { capacity: 75 },
          capacityConflict: true,
        }),
        estimatedBonus: 5000,
        applicationState: 'PENDING',
      }),
    ]);
    expect(prisma.projectApplication.findMany).toHaveBeenCalledWith({
      where: {
        applicantId: applicant.id,
        projectId: { in: [project.id] },
        status: { in: ['PENDING', 'SPECIAL_CAPABILITY_REVIEW', 'APPROVED'] },
      },
      select: { projectId: true, status: true },
    });
  });

  it('applies marketplace search and level filters within the tenant', async () => {
    const prisma = {
      project: { findMany: vi.fn().mockResolvedValue([]) },
      projectApplication: { findMany: vi.fn().mockResolvedValue([]) },
      bonusRule: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new ProjectApplicationService(prisma as never, {} as never);

    await service.market(applicant, {
      search: '自动化',
      projectLevel: 'P2',
      requiredCapabilityLevel: 'L3',
    });

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: applicant.organizationId,
        status: { in: ['PUBLISHED', 'APPLICATION_OPEN'] },
        projectLevel: 'P2',
        requiredCapabilityLevel: 'L3',
        OR: [
          { title: { contains: '自动化', mode: 'insensitive' } },
          { description: { contains: '自动化', mode: 'insensitive' } },
        ],
      },
    }));
  });

  it('rejects a second active application before calculating matching', async () => {
    const prisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'project-id',
          organizationId: applicant.organizationId,
          status: 'APPLICATION_OPEN',
          projectLevel: 'P2',
        }),
      },
      projectApplication: {
        findFirst: vi.fn().mockResolvedValue({ id: 'active-application' }),
      },
      userRestriction: { findMany: vi.fn() },
    };
    const matching = { calculate: vi.fn() };
    const service = new ProjectApplicationService(
      prisma as never,
      matching as never,
    );

    await expect(
      service.apply(applicant, 'project-id', {
        motivation: '我能解决这个问题并按计划完成交付。',
        estimatedHours: 24,
        relevantExperience: '曾负责相似的跨部门自动化项目。',
      }),
    ).rejects.toMatchObject({
      message: '你已提交过有效申请，请勿重复提交',
    });
    expect(matching.calculate).not.toHaveBeenCalled();
  });

  it('only treats pending, special-review and approved records as active', async () => {
    const prisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'project-id',
          organizationId: applicant.organizationId,
          status: 'APPLICATION_OPEN',
          projectLevel: 'P2',
        }),
      },
      projectApplication: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      userRestriction: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(),
    };
    const matching = {
      calculate: vi.fn().mockResolvedValue({
        score: 80,
        specialReviewRequired: false,
        employeeLevel: 3,
        requiredLevel: 2,
      }),
    };
    const service = new ProjectApplicationService(
      prisma as never,
      matching as never,
    );

    await service.apply(applicant, 'project-id', {
      motivation: '我能解决这个问题并按计划完成交付。',
      estimatedHours: 24,
      relevantExperience: '曾负责相似的跨部门自动化项目。',
    });

    expect(prisma.projectApplication.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-id',
        applicantId: applicant.id,
        status: { in: ['PENDING', 'SPECIAL_CAPABILITY_REVIEW', 'APPROVED'] },
      },
      select: { id: true },
    });
  });

  it('requires an explicit special approval for a capability-gap application', async () => {
    const application = {
      id: 'application-id',
      status: 'SPECIAL_CAPABILITY_REVIEW',
      project: { id: 'project-id', ownerId: null, status: 'APPLICATION_OPEN' },
    };
    const prisma = {
      projectApplication: { findFirst: vi.fn().mockResolvedValue(application) },
    };
    const service = new ProjectApplicationService(prisma as never, {} as never);

    await expect(
      service.decide(reviewer, 'project-id', 'application-id', {
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({
      message: '能力等级不足的申请必须执行特殊批准',
    });
  });

  it('assigns the owner with an atomic conditional project update', async () => {
    const projectUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const tx = {
      projectApplication: { update: vi.fn(), updateMany: vi.fn() },
      projectMember: { create: vi.fn() },
      project: { updateMany: projectUpdateMany },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      projectApplication: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'application-id',
          applicantId: 'candidate-id',
          status: 'PENDING',
          project: { id: 'project-id', ownerId: null, status: 'APPLICATION_OPEN' },
        }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProjectApplicationService(prisma as never, {} as never);

    await expect(
      service.decide(reviewer, 'project-id', 'application-id', {
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({ message: 'PROJECT_OWNER_ALREADY_ASSIGNED' });
    expect(projectUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'project-id',
        organizationId: reviewer.organizationId,
        ownerId: null,
        status: 'APPLICATION_OPEN',
      },
      data: { ownerId: 'candidate-id', status: 'OWNER_ASSIGNED' },
    });
  });
});

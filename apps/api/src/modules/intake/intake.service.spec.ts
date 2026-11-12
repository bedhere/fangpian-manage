import { describe, expect, it, vi } from 'vitest';
import { IntakeService } from './intake.service.js';

const actor = {
  id: 'user-1',
  organizationId: 'org-1',
  email: 'employee@example.com',
  roles: ['EMPLOYEE'],
  permissions: ['project:create'],
};

const aiAssessment = {
  aiCanCompleteAlone: true,
  shouldCreateProject: false,
  confidence: 0.92,
  businessValueScore: 70,
  technicalComplexityScore: 20,
  urgencyScore: 50,
  recommendedProjectLevel: 'P4',
  requiredCapabilityLevel: 1,
  estimatedHours: 2,
  requiredSkills: ['信息整理'],
  reason: 'AI 可以独立完成',
};

describe('IntakeService', () => {
  it('submits an existing legacy draft without creating another project', async () => {
    const tx = {
      project: {
        findFirst: vi.fn().mockResolvedValue({ id: 'p1', status: 'DRAFT' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ id: 'p1', status: 'HUMAN_REQUIRED' }),
        create: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      businessRequest: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'r1',
            requesterId: actor.id,
            status: 'HUMAN_PROJECT',
            linkedProjectId: 'p1',
          }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const service = new IntakeService(prisma as never);
    await expect(
      service.confirmProject(actor, 'r1', {}),
    ).resolves.toMatchObject({ id: 'p1', status: 'HUMAN_REQUIRED' });
    expect(tx.project.create).not.toHaveBeenCalled();
    expect(tx.project.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'p1',
        organizationId: actor.organizationId,
        publisherId: actor.id,
        status: 'DRAFT',
      },
      data: { status: 'HUMAN_REQUIRED' },
    });
  });
  it('runs configured AI diagnosis and persists the validated result', async () => {
    vi.stubEnv('AI_BASE_URL', 'https://ai.example.test/v1');
    vi.stubEnv('AI_API_KEY', 'test-key');
    vi.stubEnv('AI_MODEL', 'test-model');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(aiAssessment) } }],
        }),
      }),
    );
    const prisma = {
      businessRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          organizationId: 'org-1',
          requesterId: 'user-1',
          title: '整理竞品资料',
          problem: '资料分散难以检索',
          businessContext: '季度市场分析',
          expectedOutcome: '形成结构化摘要',
          constraints: null,
          status: 'DRAFT',
        }),
        update: vi
          .fn()
          .mockResolvedValue({ id: 'request-1', status: 'AI_WORKSPACE' }),
      },
      aIWorkspaceSession: {
        create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new IntakeService(prisma as never);

    const result = await service.diagnoseWithAI(actor, 'request-1');

    expect(result).toMatchObject({
      route: 'AI_WORKSPACE',
      sessionId: 'session-1',
    });
    expect(prisma.businessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diagnosis: aiAssessment }),
      }),
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('keeps the request editable and returns manual continuation when AI is unavailable', async () => {
    vi.stubEnv('AI_BASE_URL', '');
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('AI_MODEL', '');
    const prisma = {
      businessRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          organizationId: 'org-1',
          requesterId: 'user-1',
          title: '整理竞品资料',
          problem: '资料分散难以检索',
          businessContext: '季度市场分析',
          expectedOutcome: '形成结构化摘要',
          constraints: null,
          status: 'DRAFT',
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new IntakeService(prisma as never);

    const result = await service.diagnoseWithAI(actor, 'request-1');

    expect(result).toMatchObject({ route: 'MANUAL_REQUIRED' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'BUSINESS_REQUEST_AI_DIAGNOSIS_FAILED',
      }),
    });
    vi.unstubAllEnvs();
  });

  it('builds manual diagnosis from the organization setting instead of hardcoded parameters', async () => {
    const prisma = {
      systemSetting: {
        findFirst: vi.fn().mockResolvedValue({
          value: {
            confidence: 0,
            businessValueScore: 50,
            technicalComplexityScore: 50,
            urgencyScore: 50,
            aiProjectLevel: 'P4',
            humanProjectLevel: 'P2',
            aiCapabilityLevel: 1,
            humanCapabilityLevel: 3,
            aiEstimatedHours: 2,
            humanEstimatedHours: 20,
            requiredSkills: ['待补充'],
          },
        }),
      },
    };
    const service = new IntakeService(prisma as never);

    const assessment = await service.manualAssessment(actor, 'HUMAN');

    expect(assessment).toMatchObject({
      aiCanCompleteAlone: false,
      shouldCreateProject: true,
      recommendedProjectLevel: 'P2',
      estimatedHours: 20,
    });
    expect(prisma.systemSetting.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', key: 'intake.manualDiagnosisDefaults' },
    });
  });

  it('creates a draft request owned by the current user and organization', async () => {
    const prisma = {
      businessRequest: {
        create: vi.fn().mockResolvedValue({ id: 'request-1', status: 'DRAFT' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new IntakeService(prisma as never);

    await service.create(actor, {
      title: '整理竞品资料',
      problem: '资料分散难以检索',
      businessContext: '季度市场分析',
      expectedOutcome: '形成结构化摘要',
      constraints: '不得包含客户隐私',
    });

    expect(prisma.businessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        requesterId: 'user-1',
        status: 'DRAFT',
      }),
    });
  });

  it('opens an AI workspace without creating a market project when AI can complete the request', async () => {
    const prisma = {
      businessRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          organizationId: 'org-1',
          requesterId: 'user-1',
          title: '整理竞品资料',
          problem: '资料分散难以检索',
          businessContext: '季度市场分析',
          expectedOutcome: '形成结构化摘要',
          constraints: null,
          status: 'DRAFT',
        }),
        update: vi
          .fn()
          .mockResolvedValue({ id: 'request-1', status: 'AI_WORKSPACE' }),
      },
      aIWorkspaceSession: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'session-1', status: 'ACTIVE' }),
      },
      project: { create: vi.fn() },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new IntakeService(prisma as never);

    const result = await service.diagnose(actor, 'request-1', aiAssessment);

    expect(result).toMatchObject({
      route: 'AI_WORKSPACE',
      sessionId: 'session-1',
    });
    expect(prisma.aIWorkspaceSession.create).toHaveBeenCalledOnce();
    expect(prisma.project.create).not.toHaveBeenCalled();
    expect(prisma.businessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AI_WORKSPACE' }),
      }),
    );
  });

  it('rejects access to a request outside the current organization', async () => {
    const prisma = {
      businessRequest: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new IntakeService(prisma as never);

    await expect(service.get(actor, 'foreign-request')).rejects.toThrow(
      '需求不存在',
    );
    expect(prisma.businessRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign-request', organizationId: 'org-1' },
      }),
    );
  });

  it('rejects another user in the same organization from reading a private request', async () => {
    const prisma = {
      businessRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-1',
          organizationId: 'org-1',
          requesterId: 'other-user',
        }),
      },
    };
    const service = new IntakeService(prisma as never);

    await expect(service.get(actor, 'request-1')).rejects.toThrow(
      '无权访问该需求',
    );
  });

  it('creates a project only after a human-routed request is explicitly confirmed', async () => {
    const prisma = {
      businessRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'request-2',
          organizationId: 'org-1',
          requesterId: 'user-1',
          status: 'HUMAN_PROJECT',
          title: '建设自动化工具',
          problem: '人工处理耗时',
          businessContext: '运营提效',
          expectedOutcome: '形成稳定工具',
          constraints: '通过验收测试',
          diagnosis: {
            recommendedProjectLevel: 'P2',
            requiredCapabilityLevel: 3,
            estimatedHours: 20,
          },
          linkedProjectId: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ departmentId: 'department-1' }),
      },
      project: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'project-1', status: 'HUMAN_REQUIRED' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const transaction = vi.fn(async (callback) => callback(prisma));
    const service = new IntakeService({
      ...prisma,
      $transaction: transaction,
    } as never);

    const result = await service.confirmProject(actor, 'request-2', {});

    expect(result).toMatchObject({ id: 'project-1', status: 'HUMAN_REQUIRED' });
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        publisherId: 'user-1',
        publisherDepartmentId: 'department-1',
        projectLevel: 'P2',
        requiredCapabilityLevel: 'L3',
        status: 'HUMAN_REQUIRED',
      }),
    });
    expect(prisma.businessRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'request-2',
        organizationId: 'org-1',
        requesterId: 'user-1',
        status: 'HUMAN_PROJECT',
        linkedProjectId: null,
      },
      data: { linkedProjectId: 'project-1' },
    });
    expect(transaction).toHaveBeenCalledOnce();
  });
});

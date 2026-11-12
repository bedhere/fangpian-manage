import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/infrastructure/prisma.service.js';
import { AI_WORKSPACE_GATEWAY } from './../src/modules/intake/ai-workspace.service.js';

describe('ValueFlow API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_WORKSPACE_GATEWAY)
      .useValue({
        respondToWorkspace: async () => ({
          message: '竞品对比报告已完成',
          result: { summary: '竞品对比报告已完成', format: 'table' },
          isComplete: true,
          confidence: 0.92,
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('reports service health', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'value-flow-api' });
  });

  it('stores refresh material in a rotating HttpOnly cookie and rejects reuse', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'employee1@example.com', password: 'DEMO_ONLY_ChangeMe_2026!' })
      .expect(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.expiresIn).toBe(900);
    const firstCookie = (
      response.headers['set-cookie'] as unknown as string[]
    )[0];
    expect(firstCookie).toContain('valueflow_refresh_token=');
    expect(firstCookie).toContain('HttpOnly');
    expect(firstCookie).toContain('SameSite=Lax');

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    expect(rotated.body.accessToken).toEqual(expect.any(String));
    expect(rotated.body.refreshToken).toBeUndefined();
    expect((rotated.headers['set-cookie'] as unknown as string[])[0]).not.toBe(
      firstCookie,
    );

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);
  });

  it('returns role-specific workspace data without exposing the admin application', async () => {
    const login = async (email: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'DEMO_ONLY_ChangeMe_2026!' })
          .expect(200)
      ).body.accessToken as string;
    const employeeToken = await login('employee1@example.com');
    const employee = await request(app.getHttpServer())
      .get('/api/workspace/bootstrap')
      .set('authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(employee.body.user.displayName).toEqual(expect.any(String));
    expect(
      employee.body.navigation.map((item: { id: string }) => item.id),
    ).toEqual([
      'dashboard',
      'projects',
      'market',
      'opportunities',
      'circles',
      'buffs',
      'bonuses',
      'profile',
      'capacity',
      'rankings',
      'trainees',
    ]);
    expect(employee.body.counters.activeProjects).toEqual(expect.any(Number));

    const ownerToken = await login('owner@example.com');
    const owner = await request(app.getHttpServer())
      .get('/api/workspace/bootstrap')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(
      owner.body.navigation.map((item: { id: string }) => item.id),
    ).toContain('executive');
    expect(
      owner.body.navigation.map((item: { id: string }) => item.id),
    ).not.toContain('admin');

    const headToken = await login('techhead@example.com');
    const head = await request(app.getHttpServer())
      .get('/api/workspace/bootstrap')
      .set('authorization', `Bearer ${headToken}`)
      .expect(200);
    expect(
      head.body.navigation.map((item: { id: string }) => item.id),
    ).toContain('reviews');
    expect(
      head.body.navigation.map((item: { id: string }) => item.id),
    ).not.toContain('executive');

    const adminToken = await login('admin@example.com');
    const admin = await request(app.getHttpServer())
      .get('/api/workspace/bootstrap')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      admin.body.navigation.map((item: { id: string }) => item.id),
    ).toContain('reviews');
    expect(
      admin.body.navigation.map((item: { id: string }) => item.id),
    ).toContain('executive');
  });

  it('shows differentiated L0 and L4 marketplace outcomes for the same employee', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'employee1@example.com', password: 'DEMO_ONLY_ChangeMe_2026!' })
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/market/projects')
      .set('authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(200);
    const byLevel = new Map(
      response.body.map(
        (item: {
          requiredCapabilityLevel: string;
          matching: { specialReviewRequired: boolean };
        }) => [
          item.requiredCapabilityLevel,
          item.matching.specialReviewRequired,
        ],
      ),
    );

    expect(byLevel.get('L0')).toBe(false);
    expect(byLevel.get('L4')).toBe(true);
  });

  it('validates application input and requires special approval before atomic owner assignment', async () => {
    const prisma = app.get(PrismaService);
    const [organization, publisher, applicant] = await Promise.all([
      prisma.organization.findFirstOrThrow(),
      prisma.user.findFirstOrThrow({
        where: { email: 'employee2@example.com' },
      }),
      prisma.user.findFirstOrThrow({
        where: { email: 'employee1@example.com' },
      }),
    ]);
    const project = await prisma.project.create({
      data: {
        organizationId: organization.id,
        publisherId: publisher.id,
        publisherDepartmentId: publisher.departmentId!,
        createdBy: publisher.id,
        title: 'E2E 特殊能力申请项目',
        description: '验证真实申请表单、重复申请限制和特殊批准负责人指派。',
        businessProblem: '需要验证项目市场申请闭环。',
        expectedResult: '申请和指派全过程可审计。',
        acceptanceCriteria: '只有特殊批准能够指派低等级申请人。',
        projectLevel: 'P0',
        requiredCapabilityLevel: 'L4',
        estimatedHours: 24,
        approvedHours: 24,
        status: 'APPLICATION_OPEN',
      },
    });
    const login = async (email: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'DEMO_ONLY_ChangeMe_2026!' })
          .expect(200)
      ).body.accessToken as string;

    try {
      const applicantToken = await login(applicant.email);
      const reviewerToken = await login('admin@example.com');
      await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/apply`)
        .set('authorization', `Bearer ${applicantToken}`)
        .send({})
        .expect(400);
      const applied = await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/apply`)
        .set('authorization', `Bearer ${applicantToken}`)
        .send({
          motivation: '我有相关经验并愿意接受独立监督。',
          estimatedHours: 28,
          relevantExperience: '完成过相邻领域的数据自动化项目。',
        })
        .expect(201);
      expect(applied.body.status).toBe('SPECIAL_CAPABILITY_REVIEW');
      await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/apply`)
        .set('authorization', `Bearer ${applicantToken}`)
        .send({
          motivation: '重复申请不应被接受。',
          estimatedHours: 28,
          relevantExperience: '重复申请测试。',
        })
        .expect(400);
      await request(app.getHttpServer())
        .post(
          `/api/projects/${project.id}/applications/${applied.body.id}/decide`,
        )
        .set('authorization', `Bearer ${reviewerToken}`)
        .send({ decision: 'APPROVED' })
        .expect(400);
      await request(app.getHttpServer())
        .post(
          `/api/projects/${project.id}/applications/${applied.body.id}/decide`,
        )
        .set('authorization', `Bearer ${reviewerToken}`)
        .send({ decision: 'SPECIAL_APPROVED', note: '确认配置监督人后批准' })
        .expect(201)
        .expect((response) => {
          expect(response.body.status).toBe('OWNER_ASSIGNED');
          expect(response.body.ownerId).toBe(applicant.id);
        });
    } finally {
      await prisma.projectMember.deleteMany({
        where: { projectId: project.id },
      });
      await prisma.projectApplication.deleteMany({
        where: { projectId: project.id },
      });
      await prisma.auditLog.deleteMany({
        where: { entityType: 'Project', entityId: project.id },
      });
      await prisma.project.delete({ where: { id: project.id } });
    }
  }, 20_000);

  it('converts an opportunity proposal and a circle discussion into durable business assets', async () => {
    const login = async (email: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'DEMO_ONLY_ChangeMe_2026!' })
          .expect(200)
      ).body.accessToken as string;
    const ownerToken = await login('owner@example.com');
    const employeeToken = await login('employee1@example.com');
    const opportunity = await request(app.getHttpServer())
      .post('/api/opportunities')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        title: '端到端增长机会',
        description: '验证机会提案转换为真实业务需求的完整链路',
        valueTags: ['增长'],
        visibility: 'ORGANIZATION',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/opportunities/${opportunity.body.id}/proposals`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({
        title: '自动化提案',
        approach: '通过流程自动化完成机会验证与交付',
        expectedValue: '缩短一半处理时间',
      })
      .expect(201);
    const ownerList = await request(app.getHttpServer())
      .get('/api/opportunities')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const proposal = ownerList.body.find(
      (item: { id: string }) => item.id === opportunity.body.id,
    ).proposals[0];
    const conversion = await request(app.getHttpServer())
      .post(`/api/opportunities/${opportunity.body.id}/convert`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ proposalId: proposal.id })
      .expect(201);
    expect(conversion.body.businessRequestId).toEqual(expect.any(String));
    const circle = await request(app.getHttpServer())
      .post('/api/circles')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        title: '端到端探索圈',
        topic: '围绕机会转换结果形成可复用方法和业务结论',
        visibility: 'ORGANIZATION',
      })
      .expect(201);
    const join = await request(app.getHttpServer())
      .post(`/api/circles/${circle.body.id}/apply`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({ message: '参与探索' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/circles/${circle.body.id}/requests/${join.body.id}/review`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ decision: 'APPROVED' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/circles/${circle.body.id}/discussions`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({ content: '形成可复用的机会验证清单' })
      .expect(201);
    const knowledge = await request(app.getHttpServer())
      .post(`/api/circles/${circle.body.id}/knowledge`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({ title: '机会验证复盘', summary: '由真实圈子讨论沉淀的知识草稿' })
      .expect(201);
    expect(knowledge.body.status).toBe('DRAFT');
    await request(app.getHttpServer())
      .get('/api/insights/value-network')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.nodes).toEqual(expect.any(Array));
        expect(response.body.edges).toEqual(expect.any(Array));
      });
  }, 20_000);

  it('creates, publishes and idempotently queues an AI Buff from approved knowledge', async () => {
    const prisma = app.get(PrismaService);
    const author = await prisma.user.findFirstOrThrow({
      where: { email: 'employee1@example.com' },
    });
    const token = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: author.email, password: 'DEMO_ONLY_ChangeMe_2026!' })
        .expect(200)
    ).body.accessToken as string;
    const asset = await prisma.knowledgeAsset.create({
      data: {
        organizationId: author.organizationId,
        authorId: author.id,
        title: `Buff E2E ${Date.示例公司有限公司()}`,
        summary: '已完成双审的自动化知识',
        content: { steps: ['读取', '总结'] },
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    let buffId: string | undefined;
    try {
      const created = await request(app.getHttpServer())
        .post('/api/ai-buffs')
        .set('authorization', `Bearer ${token}`)
        .send({
          knowledgeAssetId: asset.id,
          name: `总结 Buff ${Date.示例公司有限公司()}`,
          description: '把业务材料整理为结构化摘要',
          type: 'PROMPT',
          permissionCodes: [],
          instructions: '读取 text 字段并生成结构化摘要',
          inputSchema: { type: 'object', required: ['text'] },
        })
        .expect(201);
      buffId = created.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/ai-buffs/${buffId}/publish`)
        .set('authorization', `Bearer ${token}`)
        .expect(201);
      const payload = {
        input: { text: '待总结的业务材料' },
        idempotencyKey: `buff-e2e-${Date.示例公司有限公司()}`,
      };
      const first = await request(app.getHttpServer())
        .post(`/api/ai-buffs/${buffId}/runs`)
        .set('authorization', `Bearer ${token}`)
        .send(payload)
        .expect(201);
      const repeated = await request(app.getHttpServer())
        .post(`/api/ai-buffs/${buffId}/runs`)
        .set('authorization', `Bearer ${token}`)
        .send(payload)
        .expect(201);
      expect(first.body.id).toBe(repeated.body.id);
      expect(first.body.status).toBe('QUEUED');
    } finally {
      if (buffId) {
        await prisma.aIBuffRun.deleteMany({ where: { buffId } });
        await prisma.aIBuffVersion.deleteMany({ where: { buffId } });
        await prisma.auditLog.deleteMany({
          where: { entityType: 'AIBuff', entityId: buffId },
        });
        await prisma.aIBuff.delete({ where: { id: buffId } });
      }
      await prisma.knowledgeAsset.delete({ where: { id: asset.id } });
    }
  }, 20_000);

  it('routes an AI-completable business request to a workspace without creating a project', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'employee1@example.com', password: 'DEMO_ONLY_ChangeMe_2026!' })
      .expect(200);
    const token = login.body.accessToken as string;
    const prisma = app.get(PrismaService);
    const projectCountBefore = await prisma.project.count();

    const created = await request(app.getHttpServer())
      .post('/api/requests')
      .set('authorization', `Bearer ${token}`)
      .send({
        title: '整理竞品资料',
        problem: '资料分散且难以检索',
        businessContext: '用于季度市场分析',
        expectedOutcome: '形成可复用的结构化摘要',
        constraints: '不得包含客户隐私信息',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/requests/${created.body.id}/diagnose`)
      .set('authorization', `Bearer ${token}`)
      .send({ route: 'AUTO' })
      .expect(201)
      .expect((response) => {
        expect(response.body.route).toBe('MANUAL_REQUIRED');
        expect(response.body.reason).toContain('人工判断');
      });

    const diagnosed = await request(app.getHttpServer())
      .post(`/api/requests/${created.body.id}/diagnose`)
      .set('authorization', `Bearer ${token}`)
      .send({
        assessment: {
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
        },
      })
      .expect(201);

    expect(diagnosed.body).toMatchObject({ route: 'AI_WORKSPACE' });
    expect(await prisma.project.count()).toBe(projectCountBefore);
    const workspaceResponse = await request(app.getHttpServer())
      .post(`/api/ai-workspaces/${diagnosed.body.sessionId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({
        content: '请整理成可复用的竞品对比表',
        idempotencyKey: `e2e-${created.body.id}`,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/ai-workspaces/${diagnosed.body.sessionId}/complete`)
      .set('authorization', `Bearer ${token}`)
      .send({ assistantMessageId: workspaceResponse.body.id })
      .expect(201)
      .expect((response) => expect(response.body.status).toBe('COMPLETED'));
    await request(app.getHttpServer())
      .get(`/api/requests/${created.body.id}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('COMPLETED');
        expect(response.body.workspaceSessions).toHaveLength(1);
        expect(response.body.workspaceSessions[0].messages).toHaveLength(2);
      });
  });

  it('publishes knowledge only after independent business and technical approvals', async () => {
    const login = async (email: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'DEMO_ONLY_ChangeMe_2026!' })
          .expect(200)
      ).body.accessToken as string;
    const authorToken = await login('employee1@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/knowledge-assets')
      .set('authorization', `Bearer ${authorToken}`)
      .send({
        title: '竞品分析方法',
        summary: '一套可复用的竞品资料收集和对比流程',
        content: { steps: ['收集公开资料', '按统一维度对比', '输出结论'] },
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/knowledge-assets/${created.body.id}/submit`)
      .set('authorization', `Bearer ${authorToken}`)
      .expect(201)
      .expect((response) =>
        expect(response.body.status).toBe('BUSINESS_REVIEW'),
      );
    await request(app.getHttpServer())
      .post(`/api/knowledge-assets/${created.body.id}/reviews`)
      .set('authorization', `Bearer ${authorToken}`)
      .send({ stage: 'BUSINESS', decision: 'APPROVED' })
      .expect(403);

    const businessToken = await login('techhead@example.com');
    await request(app.getHttpServer())
      .post(`/api/knowledge-assets/${created.body.id}/reviews`)
      .set('authorization', `Bearer ${businessToken}`)
      .send({
        stage: 'BUSINESS',
        decision: 'APPROVED',
        comment: '业务内容有效',
      })
      .expect(201)
      .expect((response) =>
        expect(response.body.status).toBe('TECHNICAL_REVIEW'),
      );

    const technicalToken = await login('admin@example.com');
    await request(app.getHttpServer())
      .post(`/api/knowledge-assets/${created.body.id}/reviews`)
      .set('authorization', `Bearer ${technicalToken}`)
      .send({ stage: 'TECHNICAL', decision: 'APPROVED', comment: '方法可复用' })
      .expect(201)
      .expect((response) => expect(response.body.status).toBe('PUBLISHED'));
    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('authorization', `Bearer ${authorToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (item: {
              type: string;
              entityType: string;
              entityId: string;
              data: { status?: string } | null;
            }) =>
              item.type === 'REVIEW' &&
              item.entityType === 'KnowledgeAsset' &&
              item.entityId === created.body.id &&
              item.data?.status === 'PUBLISHED',
          ),
        ).toBe(true);
      });
  });

  it('requires remediation before replacing an owner on a repeatedly red project', async () => {
    const prisma = app.get(PrismaService);
    const organization = await prisma.organization.findFirstOrThrow();
    const oldOwner = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@example.com' },
      include: { profile: true },
    });
    const newOwner = await prisma.user.findFirstOrThrow({
      where: { email: 'employee3@example.com' },
    });
    const departmentId =
      oldOwner.departmentId ?? (await prisma.department.findFirstOrThrow()).id;
    const project = await prisma.project.create({
      data: {
        organizationId: organization.id,
        publisherId: oldOwner.id,
        publisherDepartmentId: departmentId,
        ownerId: oldOwner.id,
        title: `持续风险项目-${Date.示例公司有限公司()}`,
        description: '用于验证整改和负责人更换',
        businessProblem: '项目持续红灯',
        expectedResult: '恢复项目推进',
        acceptanceCriteria: '新负责人接管',
        status: 'AT_RISK',
        projectLevel: 'P2',
        requiredCapabilityLevel: 'L2',
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: oldOwner.id,
        role: 'OWNER',
        createdBy: oldOwner.id,
      },
    });
    await prisma.projectHealthSnapshot.createMany({
      data: [
        {
          projectId: project.id,
          timeProgress: 70,
          workProgress: 20,
          score: 30,
          status: 'RED',
          reason: { gap: 50 },
        },
        {
          projectId: project.id,
          timeProgress: 80,
          workProgress: 25,
          score: 25,
          status: 'RED',
          reason: { gap: 55 },
        },
      ],
    });
    const adminToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'DEMO_ONLY_ChangeMe_2026!' })
        .expect(200)
    ).body.accessToken;
    await request(app.getHttpServer())
      .post(`/api/projects/${project.id}/replace-owner`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ newOwnerId: newOwner.id, reason: '连续红灯' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/projects/${project.id}/risk-actions`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        reason: '连续红灯',
        remediationPlan: '由新负责人接管并重排计划',
        dueAt: '2026-10-20T00:00:00.000Z',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${project.id}/replace-owner`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ newOwnerId: newOwner.id, reason: '整改后仍需更换' })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('OWNER_REPLACED');
        expect(response.body.ownerId).toBe(newOwner.id);
      });
    await prisma.$transaction([
      prisma.userRestriction.deleteMany({
        where: { userId: oldOwner.id, reason: 'PROJECT_OWNER_REPLACED' },
      }),
      prisma.reputationEvent.deleteMany({
        where: {
          projectId: project.id,
          userId: oldOwner.id,
          type: 'OWNER_REPLACED',
        },
      }),
      prisma.employeeProfile.update({
        where: { userId: oldOwner.id },
        data: { reputationScore: oldOwner.profile?.reputationScore ?? 100 },
      }),
    ]);
  });

  it('runs project intake, manual AI fallback and independent dual review', async () => {
    const prisma = app.get(PrismaService);
    const login = async (email: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'DEMO_ONLY_ChangeMe_2026!' })
          .expect(200)
      ).body.accessToken as string;
    const employeeToken = await login('employee1@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/projects')
      .set('authorization', `Bearer ${employeeToken}`)
      .send({
        title: '自动整理竞品数据',
        description: '建立可复用的竞品数据整理流程',
        businessProblem: '人工整理耗时且格式不一致',
        expectedResult: '形成自动化工具和标准输出',
        acceptanceCriteria: '能够稳定处理样本并输出结构化结果',
        deadline: '2026-12-31T00:00:00.000Z',
      })
      .expect(201);
    const projectId = created.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/ai-triage`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({
        assessment: {
          aiCanCompleteAlone: false,
          shouldCreateProject: true,
          confidence: 0,
          businessValueScore: 88,
          technicalComplexityScore: 72,
          urgencyScore: 65,
          recommendedProjectLevel: 'P2',
          requiredCapabilityLevel: 3,
          estimatedHours: 20,
          requiredSkills: ['AI', '开发'],
          reason: '需要人工设计流程并验收',
        },
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('HUMAN_REQUIRED');
      });
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set('authorization', `Bearer ${employeeToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.publisher.displayName).toBeTruthy();
        expect(response.body.allowedActions).toContain('RESUBMIT');
      });
    const headToken = await login('saleshead@example.com');
    await request(app.getHttpServer())
      .get('/api/reviews/business')
      .set('authorization', `Bearer ${headToken}`)
      .expect(200)
      .expect((response) =>
        expect(
          response.body.some((item: { id: string }) => item.id === projectId),
        ).toBe(true),
      );
    const wrongHeadToken = await login('techhead@example.com');
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/business-review`)
      .set('authorization', `Bearer ${wrongHeadToken}`)
      .send({
        decision: 'APPROVED',
        businessValueScore: 90,
        expectedVersion: 1,
      })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/business-review`)
      .set('authorization', `Bearer ${headToken}`)
      .send({
        decision: 'REVISION_REQUIRED',
        comment: '请补充验收样本范围',
        businessValueScore: 90,
        expectedVersion: 1,
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('HUMAN_REQUIRED');
        expect(response.body.version).toBe(2);
      });
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/resubmit`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({ expectedVersion: 2 })
      .expect(201)
      .expect((response) => expect(response.body.version).toBe(3));
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/business-review`)
      .set('authorization', `Bearer ${headToken}`)
      .send({
        decision: 'APPROVED',
        businessValueScore: 90,
        expectedVersion: 3,
      })
      .expect(201);
    const adminToken = await login('admin@example.com');
    await request(app.getHttpServer())
      .get('/api/reviews/technical')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((response) =>
        expect(
          response.body.some((item: { id: string }) => item.id === projectId),
        ).toBe(true),
      );
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/technical-review`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'APPROVED',
        technicalComplexityScore: 75,
        approvedHours: 20,
        projectLevel: 'P2',
        requiredCapabilityLevel: 3,
        expectedVersion: 3,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/technical-review`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'APPROVED',
        technicalComplexityScore: 75,
        approvedHours: 20,
        projectLevel: 'P2',
        requiredCapabilityLevel: 3,
        expectedVersion: 4,
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('PUBLISHED');
      });
    const applicantUser = await prisma.user.findFirstOrThrow({
      where: { email: 'employee2@example.com' },
    });
    await prisma.employeeProfile.update({
      where: { userId: applicantUser.id },
      data: { capabilityLevel: 'L0' },
    });
    const applicantToken = await login('employee2@example.com');
    await request(app.getHttpServer())
      .get('/api/market/projects')
      .set('authorization', `Bearer ${applicantToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (project: { id: string; matching: { score: number } }) =>
              project.id === projectId &&
              typeof project.matching.score === 'number',
          ),
        ).toBe(true);
      });
    const application = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/apply`)
      .set('authorization', `Bearer ${applicantToken}`)
      .send({
        motivation: '具备相关自动化经验并愿意投入',
        estimatedHours: 20,
        relevantExperience: '完成过数据自动化项目',
      })
      .expect(201);
    expect(application.body.status).toBe('SPECIAL_CAPABILITY_REVIEW');
    await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/applications/${application.body.id}/decide`,
      )
      .set('authorization', `Bearer ${adminToken}`)
      .send({ decision: 'SPECIAL_APPROVED', note: '特批并要求资深协作者支持' })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('OWNER_ASSIGNED');
      });
    const contributorToken = await login('employee3@example.com');
    const contributor = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/invitations`)
      .set('authorization', `Bearer ${applicantToken}`)
      .send({ userId: contributor.body.id, role: 'CONTRIBUTOR' })
      .expect(201);
    const executionBeforeAccept = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/execution`)
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200);
    const invitationId = executionBeforeAccept.body.teamInvitations.find(
      (item: { userId: string }) => item.userId === contributor.body.id,
    ).id;
    await request(app.getHttpServer())
      .post(`/api/projects/invitations/${invitationId}/respond`)
      .set('authorization', `Bearer ${contributorToken}`)
      .send({ accept: true })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/plan`)
      .set('authorization', `Bearer ${applicantToken}`)
      .send({
        objective: '上线竞品数据自动整理工具',
        milestones: [
          {
            title: '需求与方案',
            description: '完成流程设计',
            dueAt: '2026-11-01T00:00:00.000Z',
            weight: 50,
            expectedDeliverable: '方案文档',
          },
          {
            title: '开发与验收',
            description: '完成开发和业务验收',
            dueAt: '2026-12-20T00:00:00.000Z',
            weight: 50,
            expectedDeliverable: '可运行工具',
          },
        ],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/plan/submit`)
      .set('authorization', `Bearer ${applicantToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/plan/confirm`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/start`)
      .set('authorization', `Bearer ${applicantToken}`)
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('IN_PROGRESS');
      });
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/progress`)
      .set('authorization', `Bearer ${applicantToken}`)
      .send({
        progressPercent: 10,
        summary: '完成需求澄清',
        riskLevel: 0,
        nextAction: '开始方案设计',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/timeline`)
      .set('authorization', `Bearer ${applicantToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (event: { type: string }) => event.type === 'PROGRESS',
          ),
        ).toBe(true);
      });
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/deliveries`)
      .set('authorization', `Bearer ${applicantToken}`)
      .send({
        type: 'REPOSITORY',
        title: '竞品数据自动整理工具',
        url: 'https://example.com/valueflow-delivery',
        changeSummary: '首个可验收版本',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.version).toBe(1);
      });
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/delivery-ai-review`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        businessFit: 89,
        technicalQuality: 92,
        completeness: 94,
        risk: 20,
        suggestedGrade: 'A',
        reasoningSummary: '交付覆盖验收标准且结构清晰',
        issues: [],
        recommendations: ['补充运维说明'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/acceptances`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({
        role: 'PUBLISHER_BUSINESS',
        decision: 'REVISION_REQUIRED',
        score: 80,
        comment: '请补充运维说明后重新提交',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/deliveries`)
      .set('authorization', `Bearer ${applicantToken}`)
      .send({
        type: 'REPOSITORY',
        title: '竞品数据自动整理工具',
        url: 'https://example.com/valueflow-delivery-v2',
        changeSummary: '补充运维说明和异常恢复流程',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.version).toBe(2);
      });
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/delivery-ai-review`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        businessFit: 95,
        technicalQuality: 92,
        completeness: 96,
        risk: 10,
        suggestedGrade: 'S',
        reasoningSummary: '修订版本覆盖全部验收标准',
        issues: [],
        recommendations: [],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/acceptances`)
      .set('authorization', `Bearer ${employeeToken}`)
      .send({
        role: 'PUBLISHER_BUSINESS',
        decision: 'APPROVED',
        score: 95,
        comment: '解决了实际业务问题',
      })
      .expect(201);
    const salesHeadToken = await login('saleshead@example.com');
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/acceptances`)
      .set('authorization', `Bearer ${salesHeadToken}`)
      .send({
        role: 'DEPARTMENT_HEAD_BUSINESS',
        decision: 'APPROVED',
        score: 96,
        comment: '业务价值达到预期',
      })
      .expect(201);
    const marketingHeadToken = await login('marketinghead@example.com');
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/acceptances`)
      .set('authorization', `Bearer ${marketingHeadToken}`)
      .send({
        role: 'OWNER_MANAGER_TECHNICAL',
        decision: 'APPROVED',
        score: 90,
        comment: '技术实现符合规范',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.grade).toBe('S');
        expect(response.body.requiresExecutiveConfirmation).toBe(true);
      });
    const ownerToken = await login('owner@example.com');
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/executive-confirmation`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ note: '确认评分真实有效' })
      .expect(201)
      .expect((response) => {
        expect(response.body.grade).toBe('S');
        expect(response.body.confirmedAt).toBeTruthy();
      });
    const contributions = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contributions`)
      .set('authorization', `Bearer ${applicantToken}`)
      .send({
        contributions: [
          { userId: application.body.applicantId, percentage: '80' },
          { userId: contributor.body.id, percentage: '20' },
        ],
      })
      .expect(201);
    const ownerContribution = contributions.body.find(
      (item: { userId: string }) =>
        item.userId === application.body.applicantId,
    );
    const memberContribution = contributions.body.find(
      (item: { userId: string }) => item.userId === contributor.body.id,
    );
    await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/contributions/${ownerContribution.id}/respond`,
      )
      .set('authorization', `Bearer ${applicantToken}`)
      .send({ decision: 'CONFIRM' })
      .expect(201)
      .expect((response) => {
        expect(response.body.finalized).toBe(false);
      });
    await request(app.getHttpServer())
      .post(
        `/api/projects/${projectId}/contributions/${memberContribution.id}/respond`,
      )
      .set('authorization', `Bearer ${contributorToken}`)
      .send({ decision: 'DISPUTE', reason: '实际承担了更多数据处理工作' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contribution-arbitration`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({
        resolution: '根据进度和交付记录调整',
        contributions: [
          { userId: application.body.applicantId, percentage: '70' },
          { userId: contributor.body.id, percentage: '30' },
        ],
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.finalized).toBe(true);
        expect(response.body.bonus.finalBonus).toBe('7500.00');
        expect(response.body.allocations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              userId: application.body.applicantId,
              amount: '5250.00',
            }),
            expect.objectContaining({
              userId: contributor.body.id,
              amount: '2250.00',
            }),
          ]),
        );
      });
    const batch = await request(app.getHttpServer())
      .post('/api/settlements/lock')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ month: '2026-10' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/settlements/${batch.body.id}/pay`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('PAID');
      });
    await request(app.getHttpServer())
      .get('/api/bonuses/me')
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (item: { projectId: string; status: string; amount: string }) =>
              item.projectId === projectId &&
              item.status === 'PAID' &&
              item.amount === '2250',
          ),
        ).toBe(true);
      });
    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (item: { type: string; entityId: string }) =>
              item.type === 'SETTLEMENT' && item.entityId === projectId,
          ),
        ).toBe(true);
      });
    await request(app.getHttpServer())
      .get('/api/analytics/rankings?type=contribution')
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (item: { id: string; contributionScore: number }) =>
              item.id === contributor.body.id && item.contributionScore > 0,
          ),
        ).toBe(true);
      });
    await request(app.getHttpServer())
      .get(`/api/profiles/${contributor.body.id}`)
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.totalBonus).toBeGreaterThan(0);
        expect(response.body.reputationEvents.length).toBeGreaterThan(0);
        expect(response.body.skillEvidence.length).toBeGreaterThan(0);
      });
    await request(app.getHttpServer())
      .get('/api/analytics/executive-dashboard')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.projects.total).toBeGreaterThan(0);
        expect(response.body.valueFlows).toEqual(expect.any(Array));
      });
    const settings = await request(app.getHttpServer())
      .get('/api/admin/settings')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const riskSetting = settings.body.find(
      (item: { key: string }) => item.key === 'risk.thresholds',
    );
    await request(app.getHttpServer())
      .patch(`/api/admin/settings/${riskSetting.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        expectedVersion: riskSetting.version,
        value: riskSetting.value,
        reason: '端到端验证配置版本和审计',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.version).toBe(riskSetting.version + 1);
      });
    await request(app.getHttpServer())
      .patch(`/api/admin/settings/${riskSetting.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        expectedVersion: riskSetting.version,
        value: riskSetting.value,
        reason: '模拟过期写入',
      })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/admin/audit-logs?action=SYSTEM_SETTING_UPDATED')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.length).toBeGreaterThan(0);
      });
    const notification = await request(app.getHttpServer())
      .post('/api/admin/notifications')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        userId: contributor.body.id,
        type: 'SETTLEMENT',
        title: '奖金已发放',
        body: '本月项目奖金已经完成发放',
        entityType: 'Project',
        entityId: projectId,
      })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (item: { id: string }) => item.id === notification.body.id,
          ),
        ).toBe(true);
      });
    await request(app.getHttpServer())
      .patch(`/api/notifications/${notification.body.id}/read`)
      .set('authorization', `Bearer ${contributorToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.readAt).toBeTruthy();
      });
  }, 20_000);

  afterEach(async () => {
    await app.close();
  });
});

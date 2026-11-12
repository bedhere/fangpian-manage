import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AIGateway, projectTriageSchema } from '@value-flow/ai';
import { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';

@Injectable()
export class IntakeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    actor: RequestUser,
    input: {
      title: string;
      problem: string;
      businessContext: string;
      expectedOutcome: string;
      constraints?: string;
    },
  ) {
    const request = await this.prisma.businessRequest.create({
      data: {
        organizationId: actor.organizationId,
        requesterId: actor.id,
        status: 'DRAFT',
        ...input,
      },
    });
    await this.audit(actor, request.id, 'BUSINESS_REQUEST_CREATED', request);
    return request;
  }

  async diagnoseWithAI(actor: RequestUser, id: string) {
    const request = await this.get(actor, id);
    const provider = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    const input = {
      title: request.title,
      description: request.businessContext,
      businessProblem: request.problem,
      expectedResult: request.expectedOutcome,
      acceptanceCriteria: request.constraints ?? request.expectedOutcome,
    };
    if (!provider || !apiKey || !model) {
      await this.audit(actor, id, 'BUSINESS_REQUEST_AI_DIAGNOSIS_FAILED', {
        provider: provider ?? 'unconfigured',
        model: model ?? 'unconfigured',
        promptVersion: 'project-triage-v1',
        input,
        error: 'AI provider is not configured',
      });
      return {
        route: 'MANUAL_REQUIRED' as const,
        reason: 'AI 服务尚未配置，请使用人工判断继续',
      };
    }
    try {
      const assessment = await new AIGateway({
        baseUrl: provider,
        apiKey,
        model,
        maxAttempts: Number(process.env.AI_MAX_ATTEMPTS ?? 2),
        timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 20_000),
      }).triage(input);
      await this.audit(actor, id, 'BUSINESS_REQUEST_AI_DIAGNOSIS_SUCCEEDED', {
        provider,
        model,
        promptVersion: 'project-triage-v1',
        input,
        output: assessment,
        confidence: assessment.confidence,
      });
      return this.diagnose(actor, id, assessment);
    } catch (error) {
      await this.audit(actor, id, 'BUSINESS_REQUEST_AI_DIAGNOSIS_FAILED', {
        provider,
        model,
        promptVersion: 'project-triage-v1',
        input,
        error: error instanceof Error ? error.message : 'AI diagnosis failed',
      });
      return {
        route: 'MANUAL_REQUIRED' as const,
        reason: 'AI 诊断暂时不可用，请使用人工判断继续',
      };
    }
  }

  async manualAssessment(actor: RequestUser, route: 'AI' | 'HUMAN') {
    const setting = await this.prisma.systemSetting.findFirst({
      where: {
        organizationId: actor.organizationId,
        key: 'intake.manualDiagnosisDefaults',
      },
    });
    if (!setting) throw new NotFoundException('缺少人工诊断默认配置');
    const value = setting.value as {
      confidence: number;
      businessValueScore: number;
      technicalComplexityScore: number;
      urgencyScore: number;
      aiProjectLevel: string;
      humanProjectLevel: string;
      aiCapabilityLevel: number;
      humanCapabilityLevel: number;
      aiEstimatedHours: number;
      humanEstimatedHours: number;
      requiredSkills: string[];
    };
    const ai = route === 'AI';
    return projectTriageSchema.parse({
      aiCanCompleteAlone: ai,
      shouldCreateProject: !ai,
      confidence: value.confidence,
      businessValueScore: value.businessValueScore,
      technicalComplexityScore: value.technicalComplexityScore,
      urgencyScore: value.urgencyScore,
      recommendedProjectLevel: ai
        ? value.aiProjectLevel
        : value.humanProjectLevel,
      requiredCapabilityLevel: ai
        ? value.aiCapabilityLevel
        : value.humanCapabilityLevel,
      estimatedHours: ai ? value.aiEstimatedHours : value.humanEstimatedHours,
      requiredSkills: value.requiredSkills,
      reason: ai ? '人工判断：AI 可独立完成' : '人工判断：需要项目协作完成',
    });
  }

  list(actor: RequestUser) {
    return this.prisma.businessRequest.findMany({
      where: { organizationId: actor.organizationId, requesterId: actor.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        problem: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        linkedProject: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async get(actor: RequestUser, id: string) {
    const request = await this.prisma.businessRequest.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        workspaceSessions: {
          include: { messages: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        },
        linkedProject: true,
      },
    });
    if (!request) throw new NotFoundException('需求不存在');
    if (request.requesterId !== actor.id)
      throw new ForbiddenException('无权访问该需求');
    return request;
  }

  async diagnose(
    actor: RequestUser,
    id: string,
    rawAssessment: Record<string, unknown>,
  ) {
    const request = await this.get(actor, id);
    const assessment = projectTriageSchema.parse(rawAssessment);
    if (assessment.aiCanCompleteAlone) {
      const session = await this.prisma.aIWorkspaceSession.create({
        data: {
          requestId: id,
          createdById: actor.id,
          provider: 'manual-fallback',
          model: 'manual',
        },
      });
      await this.prisma.businessRequest.update({
        where: { id },
        data: {
          status: 'AI_WORKSPACE',
          diagnosis: assessment as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit(actor, id, 'BUSINESS_REQUEST_AI_WORKSPACE', assessment);
      return { route: 'AI_WORKSPACE', sessionId: session.id, assessment };
    }
    await this.prisma.businessRequest.update({
      where: { id },
      data: {
        status: 'HUMAN_PROJECT',
        diagnosis: assessment as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit(actor, id, 'BUSINESS_REQUEST_HUMAN_PROJECT', assessment);
    return {
      route: 'HUMAN_PROJECT',
      projectDraft: {
        title: request.title,
        description: request.businessContext,
        businessProblem: request.problem,
        expectedResult: request.expectedOutcome,
        acceptanceCriteria: request.constraints ?? request.expectedOutcome,
        projectLevel: assessment.recommendedProjectLevel,
        requiredCapabilityLevel: assessment.requiredCapabilityLevel,
        estimatedHours: assessment.estimatedHours,
      },
      assessment,
    };
  }

  async confirmProject(
    actor: RequestUser,
    id: string,
    overrides: Partial<{
      title: string;
      description: string;
      businessProblem: string;
      expectedResult: string;
      acceptanceCriteria: string;
    }>,
  ) {
    const request = await this.get(actor, id);
    if (request.requesterId !== actor.id)
      throw new ForbiddenException('仅需求发起人可确认项目');
    if (request.status !== 'HUMAN_PROJECT')
      throw new BadRequestException('当前需求不能创建人工项目');
    if (request.linkedProjectId) {
      const projectId = request.linkedProjectId;
      return this.prisma.$transaction(async (tx) => {
        const project = await tx.project.findFirst({
          where: {
            id: projectId,
            organizationId: actor.organizationId,
            publisherId: actor.id,
          },
        });
        if (!project) throw new NotFoundException('项目不存在');
        if (project.status !== 'DRAFT')
          throw new BadRequestException('该需求已创建项目');
        const submitted = await tx.project.updateMany({
          where: {
            id: projectId,
            organizationId: actor.organizationId,
            publisherId: actor.id,
            status: 'DRAFT',
          },
          data: { status: 'HUMAN_REQUIRED' },
        });
        if (submitted.count !== 1)
          throw new BadRequestException('项目状态已更新，请刷新后重试');
        const updated = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
        });
        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorId: actor.id,
            entityType: 'BusinessRequest',
            entityId: id,
            action: 'BUSINESS_REQUEST_PROJECT_CONFIRMED',
            after: { projectId, status: updated.status },
          },
        });
        return updated;
      });
    }
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId },
      select: { departmentId: true },
    });
    if (!user?.departmentId) throw new BadRequestException('请先加入部门');
    const departmentId = user.departmentId;
    const diagnosis = request.diagnosis as {
      recommendedProjectLevel?: string;
      requiredCapabilityLevel?: number;
      estimatedHours?: number;
      businessValueScore?: number;
      technicalComplexityScore?: number;
      urgencyScore?: number;
    } | null;
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          status: 'HUMAN_REQUIRED',
          organizationId: actor.organizationId,
          publisherId: actor.id,
          publisherDepartmentId: departmentId,
          createdBy: actor.id,
          title: overrides.title ?? request.title,
          description: overrides.description ?? request.businessContext,
          businessProblem: overrides.businessProblem ?? request.problem,
          expectedResult: overrides.expectedResult ?? request.expectedOutcome,
          acceptanceCriteria:
            overrides.acceptanceCriteria ??
            request.constraints ??
            request.expectedOutcome,
          projectLevel: diagnosis?.recommendedProjectLevel as never,
          requiredCapabilityLevel:
            diagnosis?.requiredCapabilityLevel === undefined
              ? undefined
              : (`L${diagnosis.requiredCapabilityLevel}` as never),
          estimatedHours: diagnosis?.estimatedHours,
          businessValueScore: diagnosis?.businessValueScore,
          technicalComplexityScore: diagnosis?.technicalComplexityScore,
          urgencyScore: diagnosis?.urgencyScore,
        },
      });
      const linked = await tx.businessRequest.updateMany({
        where: {
          id,
          organizationId: actor.organizationId,
          requesterId: actor.id,
          status: 'HUMAN_PROJECT',
          linkedProjectId: null,
        },
        data: { linkedProjectId: project.id },
      });
      if (linked.count !== 1)
        throw new BadRequestException(
          '该需求已创建项目或状态已更新，请刷新后重试',
        );
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'BusinessRequest',
          entityId: id,
          action: 'BUSINESS_REQUEST_PROJECT_CONFIRMED',
          after: { projectId: project.id, status: project.status },
        },
      });
      return project;
    });
  }

  private async audit(
    actor: RequestUser,
    entityId: string,
    action: string,
    after: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        entityType: 'BusinessRequest',
        entityId,
        action,
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}

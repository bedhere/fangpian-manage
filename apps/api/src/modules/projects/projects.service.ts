import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import { projectTriageSchema, AIGateway } from '@value-flow/ai';
import {
  authorizeProjectReview,
  transitionProject,
  type ProjectStatus,
  type ReviewStage,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type { CreateProjectDto, ListProjectsDto, ReviewProjectDto } from './project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async create(actor: RequestUser, input: CreateProjectDto) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.departmentId) throw new BadRequestException('请先加入部门');
    return this.prisma.project.create({
      data: {
        organizationId: actor.organizationId,
        publisherId: actor.id,
        publisherDepartmentId: user.departmentId,
        createdBy: actor.id,
        title: input.title,
        description: input.description,
        businessProblem: input.businessProblem,
        expectedResult: input.expectedResult,
        acceptanceCriteria: input.acceptanceCriteria,
        deadline: input.deadline ? new Date(input.deadline) : undefined,
      },
    });
  }
  async list(actor: RequestUser, query: ListProjectsDto) {
    const relationScope: Prisma.ProjectWhereInput = {
      OR: [
        { publisherId: actor.id },
        { ownerId: actor.id },
        { members: { some: { userId: actor.id } } },
      ],
    };
    let visibility: Prisma.ProjectWhereInput = query.view === 'OWNED' ? { ownerId: actor.id } : query.view === 'MINE'
      ? relationScope
      : query.view === 'PUBLISHED'
        ? { status: { in: ['PUBLISHED', 'APPLICATION_OPEN', 'OWNER_ASSIGNED', 'PLANNING', 'IN_PROGRESS', 'AT_RISK', 'DELIVERY_SUBMITTED', 'AI_DELIVERY_REVIEW', 'BUSINESS_ACCEPTANCE', 'FINAL_RATING', 'EXECUTIVE_CONFIRMATION', 'CONTRIBUTION_CONFIRMATION', 'SETTLEMENT_PENDING', 'SETTLED'] } }
        : {};
    if (query.view === 'DEPARTMENT') {
      const member = await this.prisma.user.findFirst({
        where: { id: actor.id, organizationId: actor.organizationId, deletedAt: null },
        select: { departmentId: true },
      });
      // Match the workspace queue using canonical membership, never a client-selected department.
      visibility = member?.departmentId ? { publisherDepartmentId: member.departmentId,
        NOT: { status: { in: ['SETTLED', 'REJECTED', 'CANCELLED', 'FAILED'] } } } : { id: { in: [] } };
    }
    const where: Prisma.ProjectWhereInput = {
      organizationId: actor.organizationId,
      ...visibility,
      ...(query.status ? { status: query.status as never } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          publisher: { select: { id: true, displayName: true } },
          publisherDepartment: { select: { id: true, name: true } },
          owner: { select: { id: true, displayName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }
  async get(actor: RequestUser, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        publisher: { select: { id: true, displayName: true, email: true } },
        publisherDepartment: { select: { id: true, name: true, headId: true } },
        owner: { select: { id: true, displayName: true } },
        requiredSkills: { include: { skill: true } },
        approvals: {
          include: { reviewer: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        aiAssessments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!project) throw new NotFoundException();
    return project;
  }
  async detail(actor: RequestUser, id: string) {
    const project = await this.get(actor, id);
    const reviewer = await this.prisma.user.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId },
      select: { departmentId: true },
    });
    const businessApproval = project.approvals
      .filter((approval) => approval.stage === 'BUSINESS' && approval.decision === 'APPROVED')
      .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    const allowedActions: string[] = [];
    if (project.publisherId === actor.id && project.status === 'HUMAN_REQUIRED') allowedActions.push('RESUBMIT');
    const business = authorizeProjectReview({
      actorId: actor.id,
      publisherId: project.publisherId,
      actorDepartmentId: actor.roles.includes('OWNER') || project.publisherDepartment?.headId === actor.id ? project.publisherDepartmentId : reviewer?.departmentId,
      publisherDepartmentId: project.publisherDepartmentId,
      permissions: new Set(actor.permissions),
    }, 'BUSINESS');
    if (business.allowed && ['HUMAN_REQUIRED', 'DEPARTMENT_REVIEW'].includes(project.status)) allowedActions.push('BUSINESS_REVIEW');
    const technical = authorizeProjectReview({
      actorId: actor.id,
      publisherId: project.publisherId,
      priorBusinessReviewerId: businessApproval?.reviewerId,
      permissions: new Set(actor.permissions),
    }, 'TECHNICAL');
    if (technical.allowed && project.status === 'TECH_REVIEW') allowedActions.push('TECHNICAL_REVIEW');
    if (
      actor.permissions.includes('project:technical-review') &&
      project.status === 'APPLICATION_OPEN'
    )
      allowedActions.push('REVIEW_APPLICATIONS');
    if (project.ownerId === actor.id && ['OWNER_ASSIGNED', 'PLANNING'].includes(project.status))
      allowedActions.push('PLAN_PROJECT');
    const activeMember = await this.prisma.projectMember.findFirst({
      where: { projectId: id, userId: actor.id, leftAt: null }, select: { id: true },
    });
    if (
      ['PLANNING', 'IN_PROGRESS', 'AT_RISK', 'OWNER_REPLACED'].includes(project.status) &&
      (project.ownerId === actor.id || project.supervisorId === actor.id || Boolean(activeMember) || actor.permissions.includes('project:technical-review'))
    ) allowedActions.push('MANAGE_EXECUTION');
    return { ...project, allowedActions };
  }
  async triage(
    actor: RequestUser,
    id: string,
    manualAssessment?: Record<string, unknown>,
  ) {
    const project = await this.get(actor, id);
    if (
      project.publisherId !== actor.id &&
      !actor.permissions.includes('project:technical-review')
    )
      throw new ForbiddenException();
    const triageStatus = transitionProject(
      project.status as ProjectStatus,
      'AI_TRIAGE',
    );
    await this.prisma.project.update({
      where: { id },
      data: { status: triageStatus },
    });
    let assessment;
    let status: 'SUCCEEDED' | 'FALLBACK_MANUAL' = 'SUCCEEDED';
    let error: string | undefined;
    try {
      if (
        !process.env.AI_BASE_URL ||
        !process.env.AI_API_KEY ||
        !process.env.AI_MODEL
      )
        throw new Error('AI provider is not configured');
      assessment = await new AIGateway({
        baseUrl: process.env.AI_BASE_URL,
        apiKey: process.env.AI_API_KEY,
        model: process.env.AI_MODEL,
      }).triage(project);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'AI triage failed';
      status = 'FALLBACK_MANUAL';
      if (!manualAssessment) {
        await this.prisma.aIAssessment.create({
          data: {
            projectId: id,
            type: 'PROJECT_TRIAGE',
            status: 'FAILED',
            provider: 'openai-compatible',
            model: process.env.AI_MODEL ?? 'unconfigured',
            promptVersion: 'triage-v1',
            inputSnapshot: project as unknown as Prisma.InputJsonValue,
            error,
          },
        });
        throw new BadRequestException('AI 分析失败，请提供人工评估');
      }
      assessment = projectTriageSchema.parse(manualAssessment);
    }
    const next = transitionProject(
      'AI_TRIAGE',
      assessment.aiCanCompleteAlone ? 'AI_EXECUTABLE' : 'HUMAN_REQUIRED',
    );
    await this.prisma.$transaction([
      this.prisma.aIAssessment.create({
        data: {
          projectId: id,
          type: 'PROJECT_TRIAGE',
          status,
          provider: status === 'SUCCEEDED' ? 'openai-compatible' : 'manual',
          model: process.env.AI_MODEL ?? 'manual',
          promptVersion: 'triage-v1',
          inputSnapshot: project as unknown as Prisma.InputJsonValue,
          output: assessment as unknown as Prisma.InputJsonValue,
          confidence: assessment.confidence,
          error,
        },
      }),
      this.prisma.project.update({
        where: { id },
        data: {
          status: next,
          projectLevel: assessment.recommendedProjectLevel,
          requiredCapabilityLevel:
            `L${assessment.requiredCapabilityLevel}` as never,
          businessValueScore: assessment.businessValueScore,
          technicalComplexityScore: assessment.technicalComplexityScore,
          urgencyScore: assessment.urgencyScore,
          estimatedHours: assessment.estimatedHours,
          requiredSkills: {
            deleteMany: {},
            create: assessment.requiredSkills.map((name) => ({
              skill: {
                connectOrCreate: {
                  where: { organizationId_name: { organizationId: project.organizationId, name } },
                  create: { organizationId: project.organizationId, name },
                },
              },
            })),
          },
        },
      }),
    ]);
    return { projectId: id, status: next, assessment };
  }
  async review(
    actor: RequestUser,
    id: string,
    stage: ReviewStage,
    input: ReviewProjectDto,
  ) {
    const project = await this.get(actor, id);
    if (input.expectedVersion !== project.version)
      throw new BadRequestException('审核内容已更新，请刷新后重试');
    const reviewer = await this.prisma.user.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId },
      select: { departmentId: true },
    });
    const businessApproval = project.approvals.find(
      (approval) => approval.stage === 'BUSINESS' && approval.decision === 'APPROVED',
    );
    const decision = authorizeProjectReview(
      {
        actorId: actor.id,
        publisherId: project.publisherId,
        actorDepartmentId: actor.roles.includes('OWNER') || project.publisherDepartment?.headId === actor.id ? project.publisherDepartmentId : reviewer?.departmentId,
        publisherDepartmentId: project.publisherDepartmentId,
        priorBusinessReviewerId: businessApproval?.reviewerId,
        permissions: new Set(actor.permissions),
      },
      stage,
    );
    if (!decision.allowed) throw new ForbiddenException(decision.reason);
    const expected =
      stage === 'BUSINESS'
        ? ['HUMAN_REQUIRED', 'DEPARTMENT_REVIEW']
        : ['TECH_REVIEW'];
    if (!expected.includes(project.status))
      throw new BadRequestException('项目不在当前审核阶段');
    const current = project.status as ProjectStatus;
    let next: ProjectStatus;
    if (input.decision === 'REJECTED')
      next = transitionProject(
        stage === 'BUSINESS' && current === 'HUMAN_REQUIRED'
          ? transitionProject(current, 'DEPARTMENT_REVIEW')
          : current,
        'REJECTED',
      );
    else if (input.decision === 'REVISION_REQUIRED')
      next = transitionProject(
        stage === 'BUSINESS' && current === 'HUMAN_REQUIRED'
          ? transitionProject(current, 'DEPARTMENT_REVIEW')
          : current,
        'HUMAN_REQUIRED',
      );
    else if (stage === 'BUSINESS')
      next = transitionProject(
        current === 'HUMAN_REQUIRED'
          ? transitionProject(current, 'DEPARTMENT_REVIEW')
          : current,
        'TECH_REVIEW',
      );
    else
      next = transitionProject(
        transitionProject(current, 'APPROVED'),
        'PUBLISHED',
      );
    const data: Prisma.ProjectUpdateInput = { status: next };
    if (input.businessValueScore !== undefined)
      data.businessValueScore = input.businessValueScore;
    if (input.technicalComplexityScore !== undefined)
      data.technicalComplexityScore = input.technicalComplexityScore;
    if (input.approvedHours !== undefined)
      data.approvedHours = input.approvedHours;
    if (input.projectLevel) data.projectLevel = input.projectLevel;
    if (input.requiredCapabilityLevel !== undefined)
      data.requiredCapabilityLevel =
        `L${input.requiredCapabilityLevel}` as never;
    if (stage === 'TECHNICAL' && input.decision === 'APPROVED')
      data.approvedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.projectApproval.create({
        data: {
          projectId: id,
          reviewerId: actor.id,
          stage,
          decision: input.decision,
          comment: input.comment,
          projectVersion: project.version,
        },
      });
      const updated = await tx.project.updateMany({
        where: { id, organizationId: actor.organizationId, version: input.expectedVersion },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new BadRequestException('审核内容已更新，请刷新后重试');
      const beforeReviewFields = {
        status: project.status,
        version: project.version,
        businessValueScore: project.businessValueScore,
        technicalComplexityScore: project.technicalComplexityScore,
        approvedHours: project.approvedHours?.toString(),
        projectLevel: project.projectLevel,
        requiredCapabilityLevel: project.requiredCapabilityLevel,
      };
      const afterReviewFields = {
        status: next,
        version: project.version + 1,
        businessValueScore:
          input.businessValueScore ?? project.businessValueScore,
        technicalComplexityScore:
          input.technicalComplexityScore ?? project.technicalComplexityScore,
        approvedHours:
          input.approvedHours !== undefined
            ? String(input.approvedHours)
            : project.approvedHours?.toString(),
        projectLevel: input.projectLevel ?? project.projectLevel,
        requiredCapabilityLevel:
          input.requiredCapabilityLevel !== undefined
            ? `L${input.requiredCapabilityLevel}`
            : project.requiredCapabilityLevel,
        comment: input.comment,
      };
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'Project',
          entityId: id,
          action: `PROJECT_${stage}_${input.decision}`,
          before: beforeReviewFields,
          after: afterReviewFields,
        },
      });
      await tx.notification.create({
        data: {
          userId: project.publisherId,
          type: 'REVIEW',
          title: stage === 'BUSINESS' ? '项目业务审核已处理' : '项目技术审核已处理',
          body: input.decision === 'APPROVED' ? `项目已进入 ${next}` : '项目审核需要关注，请查看审核意见。',
          entityType: 'Project',
          entityId: id,
          data: { stage, decision: input.decision, status: next },
        },
      });
      return tx.project.findUniqueOrThrow({ where: { id } });
    });
  }

  async resubmit(actor: RequestUser, id: string, expectedVersion: number) {
    const project = await this.get(actor, id);
    if (project.publisherId !== actor.id)
      throw new ForbiddenException('仅发布人可重新提交项目');
    if (project.status !== 'HUMAN_REQUIRED')
      throw new BadRequestException('项目当前不能重新提交');
    const updated = await this.prisma.project.updateMany({
      where: { id, organizationId: actor.organizationId, version: expectedVersion },
      data: { status: 'DEPARTMENT_REVIEW', version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new BadRequestException('项目内容已更新，请刷新后重试');
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        entityType: 'Project',
        entityId: id,
        action: 'PROJECT_RESUBMITTED',
        before: { status: project.status, version: project.version },
        after: { status: 'DEPARTMENT_REVIEW', version: project.version + 1 },
      },
    });
    return this.prisma.project.findUniqueOrThrow({ where: { id } });
  }
}

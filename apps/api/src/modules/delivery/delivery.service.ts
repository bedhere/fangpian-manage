import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AIGateway, deliveryReviewSchema } from '@value-flow/ai';
import { Prisma } from '@value-flow/db';
import {
  authorizeDeliveryAcceptance,
  calculateFinalRating,
  requiresExecutiveConfirmation,
  transitionProject,
  type ProjectStatus,
  type RatingComponents,
  type RatingThresholds,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { AIEvaluationQueueService } from '../../infrastructure/ai-evaluation-queue.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type {
  AcceptanceDto,
  DeliveryReviewDto,
  SubmitDeliveryDto,
} from './delivery.dto.js';
import { DeliveryReviewContextService } from './delivery-review-context.service.js';

type ManagementRules = {
  baseScore: number;
  overduePenalty: number;
  redSnapshotPenalty: number;
  unresolvedRiskPenalty: number;
};

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(DeliveryReviewContextService) private readonly reviewContext?: DeliveryReviewContextService,
    @Optional() @Inject(AIEvaluationQueueService) private readonly evaluationQueue?: AIEvaluationQueueService,
  ) {}

  private async project(actor: RequestUser, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        publisherDepartment: true,
        owner: true,
      },
    });
    if (!project) throw new NotFoundException();
    return project;
  }

  private async setting<T>(organizationId: string, key: string): Promise<T> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { organizationId, key },
    });
    if (!setting) throw new BadRequestException(`MISSING_SETTING:${key}`);
    return setting.value as T;
  }

  async assertCanSubmit(actor: RequestUser, id: string) {
    const project = await this.project(actor, id);
    if (project.ownerId !== actor.id)
      throw new ForbiddenException('仅项目负责人可提交成果');
    if (!['IN_PROGRESS', 'AT_RISK'].includes(project.status))
      throw new BadRequestException('项目当前不可提交成果');
    return project;
  }

  async submit(actor: RequestUser, id: string, input: SubmitDeliveryDto) {
    const project = await this.assertCanSubmit(actor, id);
    if (!input.content && !input.url && !input.storageKey)
      throw new BadRequestException('成果内容、链接或文件至少提供一项');
    if (input.storageKey && !input.storageKey.startsWith(`organizations/${actor.organizationId}/projects/${id}/`))
      throw new BadRequestException('文件对象不属于当前组织或项目');

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.projectDelivery.findFirst({
        where: { projectId: id },
        orderBy: { version: 'desc' },
      });
      const delivery = await tx.projectDelivery.create({
        data: {
          projectId: id,
          version: (latest?.version ?? 0) + 1,
          type: input.type,
          title: input.title,
          content: input.content,
          url: input.url,
          storageKey: input.storageKey,
          changeSummary: input.changeSummary,
          submittedById: actor.id,
        },
      });
      await tx.project.update({
        where: { id },
        data: {
          status: transitionProject(
            project.status as ProjectStatus,
            'DELIVERY_SUBMITTED',
          ),
          deliveredAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'ProjectDelivery',
          entityId: delivery.id,
          action: 'DELIVERY_SUBMITTED',
          after: { projectId: id, version: delivery.version },
        },
      });
      const reviewers = [
        project.publisherId,
        project.publisherDepartment.headId,
        project.owner?.managerId,
      ].filter((userId): userId is string => Boolean(userId && userId !== actor.id));
      if (reviewers.length)
        await tx.notification.createMany({
          data: reviewers.map((userId) => ({
            userId,
            type: 'REVIEW' as const,
            title: `项目交付 V${delivery.version} 已提交`,
            body: `${project.title} 已提交新成果，AI 评审后将进入多方验收。`,
            entityType: 'ProjectDelivery',
            entityId: delivery.id,
            data: { projectId: id, version: delivery.version },
            dedupeKey: `delivery:${delivery.id}:submitted:${userId}`,
          })),
          skipDuplicates: true,
        });
      return delivery;
    });
  }

  async list(actor: RequestUser, id: string) {
    await this.project(actor, id);
    return this.prisma.projectDelivery.findMany({
      where: { projectId: id },
      orderBy: { version: 'desc' },
    });
  }

  async workspace(actor: RequestUser, id: string) {
    const project = await this.project(actor, id);
    const [deliveries, aiAssessments, acceptances, rating, weights, thresholds] =
      await Promise.all([
        this.prisma.projectDelivery.findMany({
          where: { projectId: id },
          orderBy: { version: 'desc' },
        }),
        this.prisma.aIAssessment.findMany({
          where: { projectId: id, type: 'DELIVERY_REVIEW' },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.deliveryAcceptance.findMany({
          where: { projectId: id },
          include: { reviewer: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.projectRating.findUnique({ where: { projectId: id } }),
        this.setting<RatingComponents>(actor.organizationId, 'rating.weights'),
        this.setting<RatingThresholds>(actor.organizationId, 'rating.thresholds'),
      ]);
    const assignments = [
      ['PUBLISHER_BUSINESS', project.publisherId],
      ['DEPARTMENT_HEAD_BUSINESS', project.publisherDepartment.headId],
      ['OWNER_MANAGER_TECHNICAL', project.owner?.managerId],
    ] as const;
    const assignedRoles = assignments
      .filter(([, userId]) => userId === actor.id)
      .map(([role]) => role)
      .filter(
        (role) =>
          authorizeDeliveryAcceptance(actor.id, role, {
            publisherId: project.publisherId,
            departmentHeadId: project.publisherDepartment.headId,
            ownerId: project.ownerId,
            ownerManagerId: project.owner?.managerId ?? null,
          }).allowed,
      );
    const latestDelivery = deliveries[0];
    const completedRoles = new Set(
      acceptances
        .filter((item) => item.deliveryId === latestDelivery?.id)
        .map((item) => item.role),
    );
    const allowedActions: string[] = [];
    if (
      project.ownerId === actor.id &&
      ['IN_PROGRESS', 'AT_RISK'].includes(project.status)
    )
      allowedActions.push('SUBMIT_DELIVERY');
    if (
      project.status === 'DELIVERY_SUBMITTED' &&
      (project.ownerId === actor.id ||
        actor.permissions.includes('project:technical-review'))
    )
      allowedActions.push('RUN_AI_REVIEW', 'SUBMIT_MANUAL_AI_REVIEW');
    if (
      project.status === 'BUSINESS_ACCEPTANCE' &&
      assignedRoles.some((role) => !completedRoles.has(role))
    )
      allowedActions.push('SUBMIT_ACCEPTANCE');
    if (
      project.status === 'EXECUTIVE_CONFIRMATION' &&
      actor.permissions.includes('project:executive-confirm') &&
      actor.id !== project.publisherId &&
      actor.id !== project.ownerId
    )
      allowedActions.push('CONFIRM_RATING');
    return {
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
      },
      deliveries,
      aiAssessments,
      acceptances,
      rating,
      assignedRoles,
      allowedActions,
      scoring: { weights, thresholds },
    };
  }

  async reviewQueue(actor: RequestUser) {
    const assignments: Prisma.ProjectWhereInput[] = [
      { status: 'BUSINESS_ACCEPTANCE', publisherId: actor.id },
      { status: 'BUSINESS_ACCEPTANCE', publisherDepartment: { is: { headId: actor.id } } },
      { status: 'BUSINESS_ACCEPTANCE', owner: { is: { managerId: actor.id } } },
    ];
    if (actor.permissions.includes('project:executive-confirm'))
      assignments.push({
        status: 'EXECUTIVE_CONFIRMATION',
        publisherId: { not: actor.id },
        ownerId: { not: actor.id },
      });
    return this.prisma.project.findMany({
      where: { organizationId: actor.organizationId, OR: assignments },
      select: {
        id: true, title: true, status: true, updatedAt: true,
        publisher: { select: { displayName: true } },
        owner: { select: { displayName: true } },
        deliveries: { orderBy: { version: 'desc' }, take: 1, select: { version: true, title: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
  }

  async aiReview(actor: RequestUser, id: string, input?: DeliveryReviewDto) {
    const project = await this.project(actor, id);
    if (
      project.ownerId !== actor.id &&
      !actor.permissions.includes('project:technical-review')
    )
      throw new ForbiddenException();
    if (project.status !== 'DELIVERY_SUBMITTED')
      throw new BadRequestException('成果不在 AI 评审阶段');
    const delivery = await this.prisma.projectDelivery.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } });
    if (!delivery) throw new BadRequestException('项目没有可评审的交付版本');
    const context = this.reviewContext
      ? await this.reviewContext.assemble(actor, id, delivery.id)
      : { deliveryId: delivery.id, deliveryVersion: delivery.version };
    if (!input) {
      if (!this.evaluationQueue) throw new BadRequestException('AI 评估队列不可用');
      const assessment = await this.prisma.aIAssessment.create({ data: { projectId: id, type: 'DELIVERY_REVIEW', status: 'QUEUED', provider: 'openai-compatible', model: process.env.AI_MODEL ?? 'unconfigured', promptVersion: 'delivery-review-v2', inputSnapshot: context as Prisma.InputJsonValue } });
      await this.evaluationQueue.enqueue(actor.organizationId, assessment.id);
      await this.prisma.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'AIAssessment', entityId: assessment.id, action: 'DELIVERY_AI_REVIEW_QUEUED', after: { projectId: id, deliveryId: delivery.id, version: delivery.version } } });
      return assessment;
    }
    let review;
    let assessmentStatus: 'SUCCEEDED' | 'FALLBACK_MANUAL' = 'SUCCEEDED';
    let provider = 'openai-compatible';
    let model = process.env.AI_MODEL ?? 'unconfigured';
    try {
      if (input) {
        review = deliveryReviewSchema.parse(input);
        assessmentStatus = 'FALLBACK_MANUAL'; provider = 'manual'; model = 'manual';
      } else {
        if (!process.env.AI_BASE_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL) throw new Error('AI provider is not configured');
        review = await new AIGateway({ baseUrl: process.env.AI_BASE_URL, apiKey: process.env.AI_API_KEY, model: process.env.AI_MODEL, maxAttempts: Number(process.env.AI_MAX_ATTEMPTS ?? 2), timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 20_000) }).reviewDelivery(context);
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'AI delivery review failed';
      const failed = await this.prisma.aIAssessment.create({ data: { projectId: id, type: 'DELIVERY_REVIEW', status: 'FAILED', provider, model, promptVersion: 'delivery-review-v2', inputSnapshot: context as Prisma.InputJsonValue, error } });
      await this.prisma.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'AIAssessment', entityId: failed.id, action: 'DELIVERY_AI_REVIEW_FAILED', after: { projectId: id, deliveryId: delivery.id, version: delivery.version, error } } });
      throw new BadRequestException('AI 交付评审失败，可重试或提交人工评审');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          status: transitionProject(
            transitionProject('DELIVERY_SUBMITTED', 'AI_DELIVERY_REVIEW'),
            'BUSINESS_ACCEPTANCE',
          ),
        },
      });
      const assessment = await tx.aIAssessment.create({
        data: {
          projectId: id,
          type: 'DELIVERY_REVIEW',
          status: assessmentStatus,
          provider,
          model,
          promptVersion: 'delivery-review-v2',
          inputSnapshot: context as Prisma.InputJsonValue,
          output: review,
          confidence: new Prisma.Decimal(1),
        },
      });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'AIAssessment', entityId: assessment.id, action: assessmentStatus === 'FALLBACK_MANUAL' ? 'DELIVERY_AI_REVIEW_FALLBACK' : 'DELIVERY_AI_REVIEW_SUCCEEDED', after: { projectId: id, deliveryId: delivery.id, version: delivery.version } } });
      const reviewers = [project.publisherId, project.publisherDepartment.headId, project.owner?.managerId].filter((userId): userId is string => Boolean(userId));
      if (reviewers.length) await tx.notification.createMany({ data: reviewers.map((userId) => ({ userId, type: 'REVIEW' as const, title: '交付进入多方验收', body: `${project.title} 的 V${delivery.version} 已完成 AI 评审，请完成被分配的验收。`, entityType: 'Project', entityId: id, data: { deliveryId: delivery.id, version: delivery.version }, dedupeKey: `delivery:${delivery.id}:acceptance-ready:${userId}` })), skipDuplicates: true });
      return assessment;
    });
  }

  async accept(actor: RequestUser, id: string, input: AcceptanceDto) {
    const project = await this.project(actor, id);
    if (project.status !== 'BUSINESS_ACCEPTANCE')
      throw new BadRequestException('项目不在多方验收阶段');
    const authorization = authorizeDeliveryAcceptance(actor.id, input.role, {
      publisherId: project.publisherId,
      departmentHeadId: project.publisherDepartment.headId,
      ownerId: project.ownerId,
      ownerManagerId: project.owner?.managerId ?? null,
    });
    if (!authorization.allowed)
      throw new ForbiddenException(authorization.reason);
    const delivery = await this.prisma.projectDelivery.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } });
    if (!delivery) throw new BadRequestException('项目没有可验收的交付版本');

    if (input.decision !== 'APPROVED') {
      return this.prisma.$transaction(async (tx) => {
        const acceptance = await tx.deliveryAcceptance.upsert({
          where: { deliveryId_role: { deliveryId: delivery.id, role: input.role } },
          update: {
            reviewerId: actor.id,
            deliveryId: delivery.id,
            decision: input.decision,
            score: input.score,
            comment: input.comment,
          },
          create: {
            projectId: id,
            deliveryId: delivery.id,
            reviewerId: actor.id,
            role: input.role,
            decision: input.decision,
            score: input.score,
            comment: input.comment,
          },
        });
        await tx.project.update({
          where: { id },
          data: {
            status: transitionProject('BUSINESS_ACCEPTANCE', 'IN_PROGRESS'),
          },
        });
        await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'DeliveryAcceptance', entityId: acceptance.id, action: 'DELIVERY_REWORK_REQUESTED', after: { projectId: id, deliveryId: delivery.id, role: input.role, decision: input.decision, score: input.score } } });
        if (project.ownerId) await tx.notification.create({ data: { userId: project.ownerId, type: 'REVIEW', title: '交付被退回返修', body: `${project.title} 的 V${delivery.version} 需要返修：${input.comment}`, entityType: 'ProjectDelivery', entityId: delivery.id, data: { projectId: id, role: input.role }, dedupeKey: `delivery:${delivery.id}:rework:${input.role}` } });
        return acceptance;
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const acceptance = await tx.deliveryAcceptance.upsert({
        where: { deliveryId_role: { deliveryId: delivery.id, role: input.role } },
        update: { reviewerId: actor.id, deliveryId: delivery.id, decision: input.decision, score: input.score, comment: input.comment },
        create: { projectId: id, deliveryId: delivery.id, reviewerId: actor.id, role: input.role, decision: input.decision, score: input.score, comment: input.comment },
      });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'DeliveryAcceptance', entityId: acceptance.id, action: 'DELIVERY_ACCEPTED', after: { projectId: id, deliveryId: delivery.id, role: input.role, score: input.score } } });
      if (project.ownerId) await tx.notification.create({ data: { userId: project.ownerId, type: 'REVIEW', title: '交付验收进度更新', body: `${project.title} 的 ${input.role} 已完成评分：${input.score}。`, entityType: 'ProjectDelivery', entityId: delivery.id, data: { projectId: id, role: input.role, score: input.score }, dedupeKey: `delivery:${delivery.id}:accepted:${input.role}` } });
    });
    return this.tryFinalize(project.id, project.organizationId);
  }

  private async projectManagementScore(
    projectId: string,
    organizationId: string,
  ) {
    const rules = await this.setting<ManagementRules>(
      organizationId,
      'rating.projectManagement',
    );
    const [project, redSnapshots, unresolvedRisks] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
      this.prisma.projectHealthSnapshot.count({
        where: { projectId, status: 'RED' },
      }),
      this.prisma.projectRiskAction.count({
        where: { projectId, resolvedAt: null },
      }),
    ]);
    const overdue = Boolean(
      project.deadline &&
      project.deliveredAt &&
      project.deliveredAt > project.deadline,
    );
    return Math.max(
      0,
      rules.baseScore -
        (overdue ? rules.overduePenalty : 0) -
        redSnapshots * rules.redSnapshotPenalty -
        unresolvedRisks * rules.unresolvedRiskPenalty,
    );
  }

  private async tryFinalize(projectId: string, organizationId: string) {
    const latestDelivery = await this.prisma.projectDelivery.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } });
    const [acceptances, aiReview] = await Promise.all([
      this.prisma.deliveryAcceptance.findMany({ where: { deliveryId: latestDelivery.id } }),
      this.prisma.aIAssessment.findFirst({
        where: { projectId, type: 'DELIVERY_REVIEW', status: { in: ['SUCCEEDED', 'FALLBACK_MANUAL'] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (acceptances.length < 3 || !aiReview?.output)
      return { finalized: false, acceptances };
    const byRole = new Map(acceptances.map((item) => [item.role, item.score]));
    const ai = deliveryReviewSchema.parse(aiReview.output);
    const scores: RatingComponents = {
      publisherBusiness: byRole.get('PUBLISHER_BUSINESS')!,
      departmentHeadBusiness: byRole.get('DEPARTMENT_HEAD_BUSINESS')!,
      aiTechnical: ai.technicalQuality,
      ownerManagerTechnical: byRole.get('OWNER_MANAGER_TECHNICAL')!,
      projectManagement: await this.projectManagementScore(
        projectId,
        organizationId,
      ),
    };
    const [weights, thresholds, highValueThreshold, project] =
      await Promise.all([
        this.setting<RatingComponents>(organizationId, 'rating.weights'),
        this.setting<RatingThresholds>(organizationId, 'rating.thresholds'),
        this.setting<number>(organizationId, 'rating.highValueThreshold'),
        this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
      ]);
    const result = calculateFinalRating(scores, weights, thresholds);
    const requiresConfirmation = requiresExecutiveConfirmation(
      result.grade,
      Number(project.baseBonus ?? 0),
      highValueThreshold,
    );
    const nextStatus = requiresConfirmation
      ? 'EXECUTIVE_CONFIRMATION'
      : 'CONTRIBUTION_CONFIRMATION';
    return this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: transitionProject(
            transitionProject('BUSINESS_ACCEPTANCE', 'FINAL_RATING'),
            nextStatus,
          ),
        },
      });
      const rating = await tx.projectRating.upsert({
        where: { projectId },
        update: {
          publisherBusinessScore: scores.publisherBusiness,
          departmentHeadBusinessScore: scores.departmentHeadBusiness,
          aiTechnicalScore: scores.aiTechnical,
          ownerManagerTechnicalScore: scores.ownerManagerTechnical,
          projectManagementScore: scores.projectManagement,
          finalScore: result.score,
          grade: result.grade,
          breakdown: { scores, weights, thresholds },
          requiresExecutiveConfirmation: requiresConfirmation,
        },
        create: {
          projectId,
          publisherBusinessScore: scores.publisherBusiness,
          departmentHeadBusinessScore: scores.departmentHeadBusiness,
          aiTechnicalScore: scores.aiTechnical,
          ownerManagerTechnicalScore: scores.ownerManagerTechnical,
          projectManagementScore: scores.projectManagement,
          finalScore: result.score,
          grade: result.grade,
          breakdown: { scores, weights, thresholds },
          requiresExecutiveConfirmation: requiresConfirmation,
        },
      });
      await tx.auditLog.create({ data: { organizationId, entityType: 'ProjectRating', entityId: rating.id, action: 'PROJECT_RATING_CALCULATED', after: { projectId, deliveryId: latestDelivery.id, score: result.score, grade: result.grade, requiresConfirmation } } });
      return rating;
    });
  }

  async confirm(actor: RequestUser, id: string, note: string) {
    const project = await this.project(actor, id);
    if (project.status !== 'EXECUTIVE_CONFIRMATION')
      throw new BadRequestException('项目不需要高价值确认');
    if (
      !actor.permissions.includes('project:executive-confirm') ||
      actor.id === project.publisherId ||
      actor.id === project.ownerId
    )
      throw new ForbiddenException('高价值确认必须由独立高管完成');
    return this.prisma.$transaction(async (tx) => {
      const rating = await tx.projectRating.update({
        where: { projectId: id },
        data: {
          confirmedById: actor.id,
          confirmedAt: new Date(),
          confirmationNote: note,
        },
      });
      await tx.project.update({
        where: { id },
        data: {
          status: transitionProject(
            'EXECUTIVE_CONFIRMATION',
            'CONTRIBUTION_CONFIRMATION',
          ),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'ProjectRating',
          entityId: rating.id,
          action: 'EXECUTIVE_RATING_CONFIRMED',
          after: { projectId: id, note },
        },
      });
      return rating;
    });
  }
}

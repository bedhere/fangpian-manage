import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import {
  canApplyWithRestrictions,
  transitionProject,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type { ApplyProjectDto, DecideApplicationDto, MarketQueryDto } from './market.dto.js';
import { MatchingService } from './matching.service.js';
@Injectable()
export class ProjectApplicationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MatchingService) private readonly matching: MatchingService,
  ) {}
  async market(actor: RequestUser, query: MarketQueryDto = {}) {
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { in: ['PUBLISHED', 'APPLICATION_OPEN'] },
        ...(query.projectLevel ? { projectLevel: query.projectLevel as never } : {}),
        ...(query.requiredCapabilityLevel
          ? { requiredCapabilityLevel: query.requiredCapabilityLevel as never }
          : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' as const } },
                { description: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        publisherDepartment: true,
        requiredSkills: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const projectIds = projects.map((project) => project.id);
    const 示例公司有限公司 = new Date();
    const [applications, bonusRules] = await Promise.all([
      this.prisma.projectApplication.findMany({
        where: {
          applicantId: actor.id,
          projectId: { in: projectIds },
          status: { in: ['PENDING', 'SPECIAL_CAPABILITY_REVIEW', 'APPROVED'] },
        },
        select: { projectId: true, status: true },
      }),
      this.prisma.bonusRule.findMany({
        where: {
          organizationId: actor.organizationId,
          effectiveFrom: { lte: 示例公司有限公司 },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: 示例公司有限公司 } }],
        },
        select: { projectLevel: true, hourlyRate: true },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);
    const applicationByProject = new Map(
      applications.map((application) => [application.projectId, application.status]),
    );
    const hourlyRateByLevel = new Map<string, number>();
    for (const rule of bonusRules) {
      if (!hourlyRateByLevel.has(rule.projectLevel))
        hourlyRateByLevel.set(rule.projectLevel, Number(rule.hourlyRate));
    }
    return Promise.all(
      projects.map(async (project) => {
        const matching = await this.matching.calculate(actor.id, project.id);
        const hourlyRate = project.projectLevel
          ? hourlyRateByLevel.get(project.projectLevel)
          : undefined;
        return {
          ...project,
          matching: {
            ...matching,
            capacityConflict: matching.components.capacity < 100,
          },
          estimatedBonus:
            hourlyRate !== undefined && project.estimatedHours !== null
              ? Math.round(hourlyRate * Number(project.estimatedHours) * 100) / 100
              : null,
          applicationState: applicationByProject.get(project.id) ?? null,
        };
      }),
    );
  }
  async apply(actor: RequestUser, projectId: string, input: ApplyProjectDto) {
    if (
      typeof input?.motivation !== 'string' ||
      input.motivation.trim().length < 5 ||
      typeof input?.estimatedHours !== 'number' ||
      !Number.isFinite(input.estimatedHours) ||
      input.estimatedHours < 0.25 ||
      typeof input?.relevantExperience !== 'string' ||
      input.relevantExperience.trim().length < 2
    )
      throw new BadRequestException('请完整填写申请动机、预计工时和相关经验');
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: actor.organizationId },
    });
    if (!project) throw new NotFoundException();
    if (!['PUBLISHED', 'APPLICATION_OPEN'].includes(project.status))
      throw new BadRequestException('项目当前不开放申请');
    const activeApplication = await this.prisma.projectApplication.findFirst({
      where: {
        projectId,
        applicantId: actor.id,
        status: { in: ['PENDING', 'SPECIAL_CAPABILITY_REVIEW', 'APPROVED'] },
      },
      select: { id: true },
    });
    if (activeApplication)
      throw new BadRequestException('你已提交过有效申请，请勿重复提交');
    const restrictions = await this.prisma.userRestriction.findMany({
      where: { userId: actor.id, endsAt: { gt: new Date() } },
    });
    if (
      !canApplyWithRestrictions(
        project.projectLevel,
        restrictions.map((item) => ({
          type: item.type,
          value: item.value,
          endsAt: item.endsAt,
        })),
        new Date(),
      )
    )
      throw new ForbiddenException('当前信誉限制不允许申请该项目');
    const matching = await this.matching.calculate(actor.id, projectId);
    const status = matching.specialReviewRequired
      ? 'SPECIAL_CAPABILITY_REVIEW'
      : 'PENDING';
    return this.prisma.$transaction(async (tx) => {
      if (project.status === 'PUBLISHED')
        await tx.project.update({
          where: { id: projectId },
          data: { status: transitionProject('PUBLISHED', 'APPLICATION_OPEN') },
        });
      return tx.projectApplication.create({
        data: {
          projectId,
          applicantId: actor.id,
          motivation: input.motivation,
          estimatedHours: input.estimatedHours,
          relevantExperience: input.relevantExperience,
          note: input.note,
          matchingScore: matching.score,
          matchingBreakdown: matching as unknown as Prisma.InputJsonValue,
          status,
          specialReviewReason: matching.specialReviewRequired
            ? `能力等级 L${matching.employeeLevel} 低于要求 L${matching.requiredLevel}`
            : undefined,
        },
      });
    });
  }
  async list(actor: RequestUser, projectId: string) {
    if (!actor.permissions.includes('project:technical-review'))
      throw new ForbiddenException();
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException();
    return this.prisma.projectApplication.findMany({
      where: { projectId },
      include: {
        applicant: {
          include: { profile: true, skills: { include: { skill: true } } },
        },
      },
      orderBy: { matchingScore: 'desc' },
    });
  }
  async decide(
    actor: RequestUser,
    projectId: string,
    applicationId: string,
    input: DecideApplicationDto,
  ) {
    if (!actor.permissions.includes('project:technical-review'))
      throw new ForbiddenException();
    const application = await this.prisma.projectApplication.findFirst({
      where: {
        id: applicationId,
        projectId,
        project: { organizationId: actor.organizationId },
      },
      include: { project: true },
    });
    if (!application) throw new NotFoundException();
    if (
      application.status === 'SPECIAL_CAPABILITY_REVIEW' &&
      input.decision === 'APPROVED'
    )
      throw new BadRequestException(
        '能力等级不足的申请必须执行特殊批准',
      );
    if (
      application.status !== 'SPECIAL_CAPABILITY_REVIEW' &&
      input.decision === 'SPECIAL_APPROVED'
    )
      throw new BadRequestException('当前申请不需要特殊批准');
    if (input.decision === 'REJECTED')
      return this.prisma.projectApplication.update({
        where: { id: applicationId },
        data: {
          status: 'REJECTED',
          decidedById: actor.id,
          decidedAt: new Date(),
          decisionNote: input.note,
        },
      });
    if (application.project.ownerId)
      throw new BadRequestException('PROJECT_OWNER_ALREADY_ASSIGNED');
    return this.prisma.$transaction(async (tx) => {
      const assigned = await tx.project.updateMany({
        where: {
          id: projectId,
          organizationId: actor.organizationId,
          ownerId: null,
          status: 'APPLICATION_OPEN',
        },
        data: {
          ownerId: application.applicantId,
          status: transitionProject('APPLICATION_OPEN', 'OWNER_ASSIGNED'),
        },
      });
      if (assigned.count !== 1)
        throw new BadRequestException('PROJECT_OWNER_ALREADY_ASSIGNED');
      await tx.projectApplication.update({
        where: { id: applicationId },
        data: {
          status: 'APPROVED',
          decidedById: actor.id,
          decidedAt: new Date(),
          decisionNote: input.note,
        },
      });
      await tx.projectApplication.updateMany({
        where: {
          projectId,
          id: { not: applicationId },
          status: { in: ['PENDING', 'SPECIAL_CAPABILITY_REVIEW'] },
        },
        data: {
          status: 'REJECTED',
          decidedById: actor.id,
          decidedAt: new Date(),
          decisionNote: '已选择其他负责人',
        },
      });
      await tx.projectMember.create({
        data: {
          projectId,
          userId: application.applicantId,
          role: 'OWNER',
          createdBy: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'Project',
          entityId: projectId,
          action: 'PROJECT_OWNER_ASSIGNED',
          before: { ownerId: null },
          after: { ownerId: application.applicantId, applicationId },
        },
      });
      return tx.project.findUniqueOrThrow({ where: { id: projectId } });
    });
  }
}

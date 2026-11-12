import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import {
  calculateProjectHealth,
  calculateTimeProgress,
  transitionProject,
  type HealthThresholds,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { ProjectFeedbackService } from '../feedback/project-feedback.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { defaultTimelineNodes, mergeTimelineNodes } from './project-timeline.js';
import type {
  CreateMilestoneDto,
  InviteMemberDto,
  ProgressDto,
  ReplaceOwnerDto,
  FailProjectDto,
  SavePlanDto,
  RiskActionDto,
  SaveTimelineNodeDto,
} from './execution.dto.js';
@Injectable()
export class ExecutionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ProjectFeedbackService) private readonly feedback?: ProjectFeedbackService,
  ) {}
  private async owned(actor: RequestUser, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!project) throw new NotFoundException();
    if (
      project.ownerId !== actor.id &&
      !actor.permissions.includes('project:technical-review')
    )
      throw new ForbiddenException();
    return project;
  }
  private async projectForActor(actor: RequestUser, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!project) throw new NotFoundException();
    return project;
  }
  async overview(actor: RequestUser, id: string) {
    await this.projectForActor(actor, id);
    const [project, availablePeople] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id }, include: {
        timelineNodes: { orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }] },
        plans: { include: { milestones: { orderBy: { dueAt: 'asc' } }, confirmedBy: { select: { id: true, displayName: true } } }, orderBy: { version: 'desc' } },
        members: { where: { leftAt: null }, include: { user: { select: { id: true, displayName: true, email: true } } } },
        teamInvitations: { where: { status: 'PENDING' }, include: { user: { select: { id: true, displayName: true, email: true } } } },
        progressLogs: { orderBy: { createdAt: 'desc' } },
        healthSnapshots: { orderBy: { createdAt: 'desc' } },
        riskActions: { orderBy: { createdAt: 'desc' } },
      } }),
      this.prisma.user.findMany({ where: { organizationId: actor.organizationId, status: 'ACTIVE' }, select: { id: true, displayName: true, email: true }, orderBy: { displayName: 'asc' } }),
    ]);
    return { ...project, timelineNodes: mergeTimelineNodes(project, project.timelineNodes), canEditTimeline: project.ownerId === actor.id, availablePeople, currentUserId: actor.id };
  }
  async saveTimelineNode(actor: RequestUser, id: string, nodeId: string | null, input: SaveTimelineNodeDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { id, organizationId: actor.organizationId } });
      if (!project) throw new NotFoundException('项目不存在');
      if (project.ownerId !== actor.id) throw new ForbiddenException('仅当前项目负责人可编辑时间节点');
      const scheduledAt = input.date ? new Date(`${input.date}T00:00:00+08:00`) : null;
      if (scheduledAt && (!Number.isFinite(scheduledAt.valueOf()) || new Date(scheduledAt.valueOf() + 8 * 3600000).toISOString().slice(0, 10) !== input.date))
        throw new BadRequestException('节点日期无效');
      const requestedDefault = defaultTimelineNodes.find((node) => node.key === nodeId);
      const existing = nodeId && !requestedDefault ? await tx.projectTimelineNode.findFirst({ where: { id: nodeId, projectId: id } }) : null;
      const definition = requestedDefault ?? defaultTimelineNodes.find((node) => node.key === existing?.defaultKey);
      if (nodeId && !definition && !existing) throw new NotFoundException('时间节点不存在');
      if (definition) {
        const nodes = mergeTimelineNodes(project, await tx.projectTimelineNode.findMany({ where: { projectId: id } }));
        const dates = defaultTimelineNodes.map(({ key }) => key === definition.key ? scheduledAt : nodes.find((node) => node.defaultKey === key)?.scheduledAt).filter((date): date is Date => Boolean(date));
        const calendarDays = dates.map((date) => Math.floor((date.valueOf() + 8 * 3600000) / 86400000));
        if (calendarDays.some((day, index) => index > 0 && day < calendarDays[index - 1])) throw new BadRequestException('默认节点日期必须按项目阶段先后排列');
      }
      const title = definition?.title ?? input.title.trim();
      if (title.length < 2) throw new BadRequestException('节点名称至少两个字符');
      const data = { title, description: input.description.trim(), scheduledAt, status: input.status };
      const saved = definition
        ? await tx.projectTimelineNode.upsert({ where: { projectId_defaultKey: { projectId: id, defaultKey: definition.key } }, update: data, create: { ...data, projectId: id, defaultKey: definition.key, createdBy: actor.id } })
        : existing
          ? await tx.projectTimelineNode.update({ where: { id: existing.id }, data })
          : await tx.projectTimelineNode.create({ data: { ...data, projectId: id, createdBy: actor.id } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Project', entityId: id, action: 'PROJECT_TIMELINE_NODE_SAVED', after: { nodeId: saved.id, title, date: input.date ?? null, status: input.status } } });
      return saved;
    });
  }
  async deleteTimelineNode(actor: RequestUser, id: string, nodeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { id, organizationId: actor.organizationId } });
      if (!project) throw new NotFoundException('项目不存在');
      if (project.ownerId !== actor.id) throw new ForbiddenException('仅当前项目负责人可编辑时间节点');
      if (defaultTimelineNodes.some((node) => node.key === nodeId)) throw new BadRequestException('默认节点不可删除');
      const node = await tx.projectTimelineNode.findFirst({ where: { id: nodeId, projectId: id } });
      if (!node) throw new NotFoundException('时间节点不存在');
      if (node.defaultKey) throw new BadRequestException('默认节点不可删除');
      await tx.projectTimelineNode.delete({ where: { id: node.id } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Project', entityId: id, action: 'PROJECT_TIMELINE_NODE_DELETED', before: { nodeId: node.id, title: node.title } } });
      return { deleted: true };
    });
  }
  async savePlan(actor: RequestUser, id: string, input: SavePlanDto) {
    const project = await this.owned(actor, id);
    if (!['OWNER_ASSIGNED', 'PLANNING'].includes(project.status))
      throw new BadRequestException('项目不在计划阶段');
    const total = input.milestones.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(total - 100) > 0.001)
      throw new BadRequestException('里程碑权重总和必须为100%');
    for (const milestone of input.milestones) {
      const dueAt = new Date(milestone.dueAt);
      if (Number.isNaN(dueAt.valueOf())) throw new BadRequestException('里程碑日期无效');
      if (project.deadline && dueAt > project.deadline)
        throw new BadRequestException('里程碑日期不能晚于项目截止日期');
    }
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.projectPlan.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } });
      if (latest?.status === 'CONFIRMED')
        await tx.projectPlan.update({ where: { id: latest.id }, data: { status: 'SUPERSEDED' } });
      const plan = await tx.projectPlan.create({
        data: {
          projectId: id, version: (latest?.version ?? 0) + 1,
          objective: input.objective, createdBy: actor.id,
          milestones: { create: input.milestones.map((item) => ({
            projectId: id, title: item.title, description: item.description,
            dueAt: new Date(item.dueAt), weight: item.weight,
            expectedDeliverable: item.expectedDeliverable, createdBy: actor.id,
          })) },
        },
        include: { milestones: true },
      });
      await tx.project.update({ where: { id }, data: { status: 'PLANNING', objective: input.objective } });
      return plan;
    });
  }
  async submitPlan(actor: RequestUser, id: string) {
    const project = await this.owned(actor, id);
    if (project.ownerId !== actor.id) throw new ForbiddenException('仅项目负责人可提交执行计划');
    const plan = await this.prisma.projectPlan.findFirst({ where: { projectId: id, status: 'DRAFT' }, orderBy: { version: 'desc' } });
    if (!plan) throw new BadRequestException('没有可提交的计划草稿');
    return this.prisma.projectPlan.update({ where: { id: plan.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  }
  async confirmPlan(actor: RequestUser, id: string) {
    const project = await this.projectForActor(actor, id);
    if (!actor.permissions.includes('project:technical-review') && project.supervisorId !== actor.id)
      throw new ForbiddenException('仅项目主管可确认执行计划');
    if (project.ownerId === actor.id) throw new ForbiddenException('负责人不能确认自己的执行计划');
    const plan = await this.prisma.projectPlan.findFirst({ where: { projectId: id, status: 'SUBMITTED' }, orderBy: { version: 'desc' } });
    if (!plan) throw new BadRequestException('没有待确认的执行计划');
    return this.prisma.projectPlan.update({ where: { id: plan.id }, data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: actor.id } });
  }
  async inviteMember(actor: RequestUser, id: string, input: InviteMemberDto) {
    const project = await this.owned(actor, id);
    if (project.ownerId !== actor.id && !actor.permissions.includes('project:technical-review'))
      throw new ForbiddenException();
    const user = await this.prisma.user.findFirst({ where: { id: input.userId, organizationId: actor.organizationId, status: 'ACTIVE' }, select: { id: true } });
    if (!user) throw new BadRequestException('受邀成员不存在或不可用');
    const existing = await this.prisma.projectMember.findFirst({ where: { projectId: id, userId: input.userId, leftAt: null } });
    if (existing) throw new BadRequestException('该员工已是项目成员');
    const pending = await this.prisma.projectTeamInvitation.findFirst({ where: { projectId: id, userId: input.userId, status: 'PENDING' }, select: { id: true } });
    if (pending) throw new BadRequestException('该员工已有待处理邀请');
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.projectTeamInvitation.create({ data: { projectId: id, userId: input.userId, role: input.role, invitedById: actor.id } });
      await tx.notification.create({ data: { userId: input.userId, type: 'PROJECT', title: '收到项目团队邀请', body: `你被邀请加入项目，请查看并接受或拒绝。`, entityType: 'Project', entityId: id, data: { invitationId: invitation.id, role: input.role } } });
      return invitation;
    });
  }
  async respondInvitation(actor: RequestUser, invitationId: string, accept: boolean) {
    const invitation = await this.prisma.projectTeamInvitation.findFirst({
      where: { id: invitationId, userId: actor.id, status: 'PENDING', project: { organizationId: actor.organizationId } },
    });
    if (!invitation) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectTeamInvitation.update({ where: { id: invitationId }, data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() } });
      if (accept) await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: invitation.projectId, userId: actor.id } },
        update: { role: invitation.role, leftAt: null },
        create: { projectId: invitation.projectId, userId: actor.id, role: invitation.role, createdBy: invitation.invitedById },
      });
      if (accept && invitation.role === 'SUPERVISOR')
        await tx.project.update({ where: { id: invitation.projectId }, data: { supervisorId: actor.id } });
      return updated;
    });
  }
  async milestone(actor: RequestUser, id: string, input: CreateMilestoneDto) {
    const project = await this.owned(actor, id);
    if (!['OWNER_ASSIGNED', 'PLANNING'].includes(project.status))
      throw new BadRequestException('项目不在计划阶段');
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.valueOf()))
      throw new BadRequestException('里程碑日期无效');
    return this.prisma.$transaction(async (tx) => {
      if (project.status === 'OWNER_ASSIGNED')
        await tx.project.update({
          where: { id },
          data: {
            status: transitionProject('OWNER_ASSIGNED', 'PLANNING'),
            objective: input.objective,
          },
        });
      return tx.projectMilestone.create({
        data: {
          projectId: id,
          title: input.title,
          description: input.description,
          dueAt,
          weight: input.weight,
          expectedDeliverable: input.expectedDeliverable,
          createdBy: actor.id,
        },
      });
    });
  }
  async start(actor: RequestUser, id: string) {
    const project = await this.owned(actor, id);
    if (project.status !== 'PLANNING')
      throw new BadRequestException('项目不在计划阶段');
    const plan = await this.prisma.projectPlan.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } });
    if (!plan || plan.status !== 'CONFIRMED')
      throw new BadRequestException('执行计划尚未由主管确认');
    return this.prisma.project.update({
      where: { id },
      data: {
        status: transitionProject('PLANNING', 'IN_PROGRESS'),
        startedAt: new Date(),
      },
    });
  }
  async progress(actor: RequestUser, id: string, input: ProgressDto) {
    const project = await this.projectForActor(actor, id);
    const member = project.ownerId === actor.id || project.supervisorId === actor.id || actor.permissions.includes('project:technical-review')
      ? true
      : Boolean(await this.prisma.projectMember.findFirst({ where: { projectId: id, userId: actor.id, leftAt: null } }));
    if (!member) throw new ForbiddenException('仅当前项目成员可提交进展');
    if (!['IN_PROGRESS', 'AT_RISK'].includes(project.status))
      throw new BadRequestException('项目尚未执行');
    const log = await this.prisma.projectProgressLog.create({
      data: {
        projectId: id,
        authorId: actor.id,
        summary: input.summary,
        progressPercent: input.progressPercent,
        riskLevel: input.riskLevel,
        blockers: input.blockers,
        nextAction: input.nextAction,
      },
    });
    await this.health(id);
    return log;
  }
  async health(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        progressLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        milestones: true,
      },
    });
    if (!project || !project.startedAt || !project.deadline) return null;
    const latest = project.progressLogs[0];
    const timeProgress = calculateTimeProgress(
      new Date(),
      project.startedAt,
      project.deadline,
    );
    const workProgress = latest?.progressPercent ?? 0;
    const setting = await this.prisma.systemSetting.findFirst({
      where: { organizationId: project.organizationId, key: 'risk.thresholds' },
    });
    if (!setting) throw new BadRequestException('缺少项目健康阈值配置');
    const thresholds = setting.value as unknown as HealthThresholds;
    const overdueMilestones = project.milestones.filter(
      (item) => item.status !== 'COMPLETED' && item.dueAt < new Date(),
    ).length;
    const result = calculateProjectHealth(
      {
        timeProgress,
        workProgress,
        riskLevel: latest?.riskLevel ?? 0,
        hasBlockers: Boolean(latest?.blockers),
        overdueMilestones,
      },
      thresholds,
    );
    const snapshot = await this.prisma.projectHealthSnapshot.create({
      data: {
        projectId: id,
        timeProgress,
        workProgress,
        score: result.score,
        status: result.status,
        reason: {
          gap: result.gap,
          overdueMilestones,
          hasBlockers: Boolean(latest?.blockers),
        } as Prisma.InputJsonValue,
      },
    });
    if (result.status === 'RED' && project.status === 'IN_PROGRESS')
      await this.prisma.project.update({
        where: { id },
        data: { status: transitionProject('IN_PROGRESS', 'AT_RISK') },
      });
    if (result.status !== 'RED' && project.status === 'AT_RISK')
      await this.prisma.project.update({
        where: { id },
        data: { status: transitionProject('AT_RISK', 'IN_PROGRESS') },
      });
    return snapshot;
  }
  async timeline(actor: RequestUser, id: string) {
    await this.owned(actor, id);
    const [approvals, applications, invitations, members, plans, milestones, progress, health, risks, deliveries, acceptances, rating, aiReviews] =
      await Promise.all([
        this.prisma.projectApproval.findMany({ where: { projectId: id } }),
        this.prisma.projectApplication.findMany({ where: { projectId: id } }),
        this.prisma.projectTeamInvitation.findMany({ where: { projectId: id } }),
        this.prisma.projectMember.findMany({ where: { projectId: id } }),
        this.prisma.projectPlan.findMany({ where: { projectId: id } }),
        this.prisma.projectMilestone.findMany({ where: { projectId: id } }),
        this.prisma.projectProgressLog.findMany({ where: { projectId: id } }),
        this.prisma.projectHealthSnapshot.findMany({
          where: { projectId: id },
        }),
        this.prisma.projectRiskAction.findMany({ where: { projectId: id } }),
        this.prisma.projectDelivery.findMany({ where: { projectId: id } }),
        this.prisma.deliveryAcceptance.findMany({ where: { projectId: id } }),
        this.prisma.projectRating.findMany({ where: { projectId: id } }),
        this.prisma.aIAssessment.findMany({ where: { projectId: id, type: 'DELIVERY_REVIEW' } }),
      ]);
    return [
      ...approvals.map((x) => ({ type: 'APPROVAL', at: x.createdAt, data: x })),
      ...applications.map((x) => ({
        type: 'APPLICATION',
        at: x.createdAt,
        data: x,
      })),
      ...invitations.map((x) => ({ type: 'TEAM_INVITATION', at: x.createdAt, data: x })),
      ...members.map((x) => ({ type: 'MEMBER', at: x.createdAt, data: x })),
      ...plans.map((x) => ({ type: 'PLAN', at: x.createdAt, data: x })),
      ...milestones.map((x) => ({
        type: 'MILESTONE',
        at: x.createdAt,
        data: x,
      })),
      ...progress.map((x) => ({ type: 'PROGRESS', at: x.createdAt, data: x })),
      ...health.map((x) => ({ type: 'HEALTH', at: x.createdAt, data: x })),
      ...risks.map((x) => ({ type: 'RISK_ACTION', at: x.createdAt, data: x })),
      ...deliveries.map((x) => ({ type: 'DELIVERY', at: x.createdAt, data: x })),
      ...aiReviews.map((x) => ({ type: 'DELIVERY_AI_REVIEW', at: x.createdAt, data: x })),
      ...acceptances.map((x) => ({ type: 'DELIVERY_ACCEPTANCE', at: x.createdAt, data: x })),
      ...rating.map((x) => ({ type: 'PROJECT_RATING', at: x.createdAt, data: x })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
  }
  async riskAction(actor: RequestUser, id: string, input: RiskActionDto) {
    const project = await this.owned(actor, id);
    if (project.status !== 'AT_RISK')
      throw new BadRequestException('项目当前不是风险状态');
    return this.prisma.projectRiskAction.create({
      data: {
        projectId: id,
        supervisorId: actor.id,
        reason: input.reason,
        remediationPlan: input.remediationPlan,
        dueAt: new Date(input.dueAt),
      },
    });
  }
  async replaceOwner(actor: RequestUser, id: string, input: ReplaceOwnerDto) {
    const project = await this.owned(actor, id);
    if (!actor.permissions.includes('project:technical-review'))
      throw new ForbiddenException();
    if (project.status !== 'AT_RISK')
      throw new BadRequestException('项目当前不是风险状态');
    const reds = await this.prisma.projectHealthSnapshot.count({
      where: { projectId: id, status: 'RED' },
    });
    if (reds < 2) throw new BadRequestException('至少需要两个RED健康快照');
    const remediation = await this.prisma.projectRiskAction.findFirst({
      where: { projectId: id, resolvedAt: null }, orderBy: { createdAt: 'desc' },
    });
    if (!remediation)
      throw new BadRequestException('更换负责人前必须先创建未关闭的整改措施');
    const restrictionSetting = await this.prisma.systemSetting.findFirst({
        where: {
          organizationId: actor.organizationId,
          key: 'reputation.ownerReplacementRestriction',
        },
      });
    if (!restrictionSetting)
      throw new BadRequestException('缺少负责人更换信誉配置');
    const restriction = restrictionSetting.value as unknown as {
      days: number;
      levels: string[];
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.updateMany({
        where: { projectId: id, role: 'OWNER', leftAt: null },
        data: { leftAt: new Date() },
      });
      await tx.projectMember.upsert({
        where: {
          projectId_userId: { projectId: id, userId: input.newOwnerId },
        },
        update: { role: 'OWNER', leftAt: null },
        create: {
          projectId: id,
          userId: input.newOwnerId,
          role: 'OWNER',
          createdBy: actor.id,
        },
      });
      const updatedProject = await tx.project.update({
        where: { id },
        data: {
          ownerId: input.newOwnerId,
          status: transitionProject('AT_RISK', 'OWNER_REPLACED'),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'Project',
          entityId: id,
          action: 'PROJECT_OWNER_REPLACED',
          before: { ownerId: project.ownerId },
          after: { ownerId: input.newOwnerId, reason: input.reason },
        },
      });
      if (project.ownerId) {
        const endsAt = new Date();
        endsAt.setUTCDate(endsAt.getUTCDate() + restriction.days);
        await tx.userRestriction.create({
          data: {
            userId: project.ownerId,
            type: 'HIGH_LEVEL_PROJECT_BLOCK',
            value: { levels: restriction.levels },
            reason: 'PROJECT_OWNER_REPLACED',
            endsAt,
          },
        });
      }
      return updatedProject;
    });
    if (project.ownerId) await this.feedback?.applyReputationFact(actor.organizationId, id, project.ownerId, 'OWNER_REPLACED', { replacementReason: input.reason });
    return updated;
  }
  async failProject(actor: RequestUser, id: string, input: FailProjectDto) {
    const project = await this.owned(actor, id);
    if (!actor.permissions.includes('project:technical-review')) throw new ForbiddenException();
    if (!['IN_PROGRESS', 'AT_RISK', 'OWNER_REPLACED', 'AI_DELIVERY_REVIEW', 'BUSINESS_ACCEPTANCE', 'FINAL_RATING', 'EXECUTIVE_CONFIRMATION'].includes(project.status)) {
      throw new BadRequestException('项目当前状态不能标记失败');
    }
    if (input.maliciousAbandonment && project.ownerId === actor.id) throw new ForbiddenException('禁止认定自己的恶意放弃行为');
    const updated = await this.prisma.$transaction(async (tx) => {
      const failed = await tx.project.update({ where: { id }, data: { status: transitionProject(project.status, 'FAILED'), completedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Project', entityId: id, action: 'PROJECT_FAILED', before: { status: project.status }, after: { reason: input.reason, maliciousAbandonment: input.maliciousAbandonment } } });
      return failed;
    });
    if (project.ownerId) {
      await this.feedback?.applyReputationFact(actor.organizationId, id, project.ownerId, 'PROJECT_FAILED', { reason: input.reason });
      if (input.maliciousAbandonment) await this.feedback?.applyReputationFact(actor.organizationId, id, project.ownerId, 'MALICIOUS_ABANDON', { reason: input.reason });
    }
    return updated;
  }
}

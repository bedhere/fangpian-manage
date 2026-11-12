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
  allocateBonus,
  calculateProjectBonus,
  transitionProject,
  type BonusGrade,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { ProjectFeedbackService } from '../feedback/project-feedback.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type {
  ArbitrateContributionsDto,
  ContributionItemDto,
  ContributionResponseDto,
} from './settlement.dto.js';
@Injectable()
export class SettlementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ProjectFeedbackService) private readonly feedback?: ProjectFeedbackService,
  ) {}
  private async project(actor: RequestUser, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { members: { where: { leftAt: null } }, rating: true },
    });
    if (!project) throw new NotFoundException();
    return project;
  }
  private validate(items: ContributionItemDto[]) {
    if (new Set(items.map((i) => i.userId)).size !== items.length)
      throw new BadRequestException('CONTRIBUTOR_DUPLICATED');
    try {
      allocateBonus('0', items);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'INVALID_CONTRIBUTION',
      );
    }
  }
  async propose(actor: RequestUser, id: string, items: ContributionItemDto[]) {
    const project = await this.project(actor, id);
    if (project.ownerId !== actor.id)
      throw new ForbiddenException('仅项目负责人可提出贡献分配');
    if (project.status !== 'CONTRIBUTION_CONFIRMATION')
      throw new BadRequestException('项目不在贡献确认阶段');
    this.validate(items);
    const eligible = new Set(
      project.members
        .filter((m) => ['OWNER', 'CONTRIBUTOR'].includes(m.role))
        .map((m) => m.userId),
    );
    if (items.some((i) => !eligible.has(i.userId)))
      throw new BadRequestException('贡献人必须是有效项目成员');
    const latest = await this.prisma.projectContribution.aggregate({
      where: { projectId: id },
      _max: { proposalVersion: true },
    });
    const proposalVersion = (latest._max.proposalVersion ?? 0) + 1;
    return this.prisma.$transaction(async (tx) => {
      await tx.projectContribution.updateMany({
        where: { projectId: id, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      for (const item of items)
        await tx.projectContribution.create({
          data: {
            projectId: id,
            userId: item.userId,
            proposedById: actor.id,
            proposedPercentage: new Prisma.Decimal(item.percentage),
            proposalVersion,
          },
        });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'Project',
          entityId: id,
          action: 'CONTRIBUTION_PROPOSED',
          after: {
            proposalVersion,
            contributions: items.map((item) => ({
              userId: item.userId,
              percentage: item.percentage,
            })),
          },
        },
      });
      await tx.notification.createMany({
        data: items.filter((item) => item.userId !== actor.id).map((item) => ({
          userId: item.userId, type: 'SETTLEMENT' as const, title: `收到贡献方案 V${proposalVersion}`,
          body: `${project.title} 的贡献方案已更新，你的建议比例为 ${item.percentage}%。`, entityType: 'Project', entityId: id,
          data: { proposalVersion, percentage: item.percentage }, dedupeKey: `contribution:${id}:v${proposalVersion}:${item.userId}`,
        })), skipDuplicates: true,
      });
      return tx.projectContribution.findMany({
        where: { projectId: id, proposalVersion },
        include: { user: { select: { displayName: true } } },
      });
    });
  }
  async list(actor: RequestUser, id: string) {
    await this.project(actor, id);
    return this.prisma.projectContribution.findMany({
      where: { projectId: id },
      include: {
        user: { select: { displayName: true } },
        project: { select: { finalBonus: true, status: true } },
      },
    });
  }
  async workspace(actor: RequestUser, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        members: { where: { leftAt: null }, include: { user: { select: { id: true, displayName: true } } } },
        contributions: { include: { user: { select: { id: true, displayName: true } } }, orderBy: [{ proposalVersion: 'desc' }, { createdAt: 'asc' }] },
        contributionDisputes: { include: { raisedBy: { select: { displayName: true } }, arbitrator: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' } },
        rating: true,
      },
    });
    if (!project) throw new NotFoundException();
    const active = project.contributions.filter((item) => !item.supersededAt);
    const allowedActions: string[] = [];
    if (project.status === 'CONTRIBUTION_CONFIRMATION' && project.ownerId === actor.id)
      allowedActions.push('PROPOSE_CONTRIBUTIONS');
    if (active.some((item) => item.userId === actor.id && item.status === 'PENDING'))
      allowedActions.push('RESPOND_CONTRIBUTION');
    if (
      project.contributionDisputes.some((item) => item.status === 'OPEN') &&
      (project.supervisorId === actor.id || actor.permissions.includes('project:executive-confirm'))
    ) allowedActions.push('ARBITRATE_CONTRIBUTIONS');
    const { contributionDisputes, ...projectFacts } = project;
    return { project: { ...projectFacts, disputes: contributionDisputes }, allowedActions, currentUserId: actor.id };
  }
  async respond(
    actor: RequestUser,
    id: string,
    contributionId: string,
    input: ContributionResponseDto,
  ) {
    const contribution = await this.prisma.projectContribution.findFirst({
      where: { id: contributionId, projectId: id, userId: actor.id },
      include: { project: true },
    });
    if (!contribution) throw new NotFoundException();
    if (contribution.supersededAt)
      throw new BadRequestException('贡献方案已更新，请刷新后处理最新版本');
    if (contribution.project.status !== 'CONTRIBUTION_CONFIRMATION')
      throw new BadRequestException('贡献分配已锁定');
    if (input.decision === 'DISPUTE' && !input.reason)
      throw new BadRequestException('提出异议必须填写原因');
    if (input.decision === 'DISPUTE') {
      const allocation = await this.prisma.projectContribution.findMany({
        where: { projectId: id, proposalVersion: contribution.proposalVersion },
      });
      return this.prisma.$transaction(async (tx) => {
        await tx.projectContribution.update({
          where: { id: contributionId },
          data: { status: 'DISPUTED' },
        });
        const dispute = await tx.contributionDispute.create({
          data: {
            projectId: id,
            raisedById: actor.id,
            reason: input.reason!,
            originalAllocation: allocation.map((i) => ({
              userId: i.userId,
              percentage: i.proposedPercentage.toString(),
            })),
          },
        });
        await tx.auditLog.create({ data: { organizationId: contribution.project.organizationId, actorId: actor.id, entityType: 'ContributionDispute', entityId: dispute.id, action: 'CONTRIBUTION_DISPUTED', after: { projectId: id, proposalVersion: contribution.proposalVersion, reason: input.reason } } });
        const reviewerId = contribution.project.supervisorId ?? contribution.project.ownerId;
        if (reviewerId) await tx.notification.create({ data: { userId: reviewerId, type: 'SETTLEMENT', title: '贡献方案出现争议', body: `${contribution.project.title} 的贡献方案需要仲裁。`, entityType: 'ContributionDispute', entityId: dispute.id, dedupeKey: `contribution-dispute:${dispute.id}:${reviewerId}` } });
        return dispute;
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.projectContribution.update({ where: { id: contributionId }, data: { status: 'CONFIRMED', finalPercentage: contribution.proposedPercentage, confirmedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId: contribution.project.organizationId, actorId: actor.id, entityType: 'ProjectContribution', entityId: contributionId, action: 'CONTRIBUTION_CONFIRMED', after: { projectId: id, proposalVersion: contribution.proposalVersion, percentage: contribution.proposedPercentage.toString() } } });
      if (contribution.project.ownerId && contribution.project.ownerId !== actor.id) await tx.notification.create({ data: { userId: contribution.project.ownerId, type: 'SETTLEMENT', title: '成员已确认贡献比例', body: `${contribution.project.title} 的一名成员已确认分配。`, entityType: 'ProjectContribution', entityId: contributionId, dedupeKey: `contribution-confirmed:${contributionId}` } });
    });
    return this.finalize(id);
  }
  async arbitrate(
    actor: RequestUser,
    id: string,
    input: ArbitrateContributionsDto,
  ) {
    const project = await this.project(actor, id);
    if (
      project.supervisorId !== actor.id &&
      !actor.permissions.includes('project:executive-confirm')
    )
      throw new ForbiddenException('仅监督人或独立高管可仲裁');
    this.validate(input.contributions);
    const existing = await this.prisma.projectContribution.findMany({
      where: { projectId: id, supersededAt: null },
    });
    if (
      input.contributions.some(
        (i) => !existing.some((e) => e.userId === i.userId),
      )
    )
      throw new BadRequestException('仲裁不得新增非项目贡献人');
    const dispute = await this.prisma.contributionDispute.findFirst({
      where: { projectId: id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });
    if (!dispute) throw new BadRequestException('没有待仲裁争议');
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.contributions)
        await tx.projectContribution.updateMany({
          where: { projectId: id, userId: item.userId, supersededAt: null },
          data: {
            finalPercentage: new Prisma.Decimal(item.percentage),
            status: 'ARBITRATED',
            confirmedAt: new Date(),
          },
        });
      await tx.contributionDispute.update({
        where: { id: dispute.id },
        data: {
          status: 'RESOLVED',
          arbitratorId: actor.id,
          resolution: input.resolution,
          finalAllocation: input.contributions.map((item) => ({
            userId: item.userId,
            percentage: item.percentage,
          })),
          resolvedAt: new Date(),
        },
      });
      await tx.auditLog.create({ data: { organizationId: project.organizationId, actorId: actor.id, entityType: 'ContributionDispute', entityId: dispute.id, action: 'CONTRIBUTION_ARBITRATED', after: { projectId: id, resolution: input.resolution, finalAllocation: input.contributions.map((item) => ({ userId: item.userId, percentage: item.percentage })) } } });
      await tx.notification.createMany({ data: existing.map((item) => ({ userId: item.userId, type: 'SETTLEMENT' as const, title: '贡献争议已仲裁', body: `${project.title} 的最终贡献比例已经确定。`, entityType: 'ContributionDispute', entityId: dispute.id, dedupeKey: `contribution-arbitrated:${dispute.id}:${item.userId}` })), skipDuplicates: true });
    });
    return this.finalize(id);
  }
  private async setting<T>(organizationId: string, key: string) {
    const item = await this.prisma.systemSetting.findFirst({
      where: { organizationId, key },
    });
    if (!item) throw new BadRequestException(`MISSING_SETTING:${key}`);
    return item.value as T;
  }
  private async finalize(id: string) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: { contributions: true, rating: true },
    });
    if (project.status !== 'CONTRIBUTION_CONFIRMATION')
      return { finalized: false };
    if (
      !project.contributions.filter((c) => !c.supersededAt).length ||
      project.contributions.filter((c) => !c.supersededAt).some(
        (c) => !['CONFIRMED', 'ARBITRATED'].includes(c.status),
      )
    )
      return { finalized: false, contributions: project.contributions };
    if (!project.rating || !project.projectLevel || !project.approvedHours)
      throw new BadRequestException('项目缺少评分、等级或核准工时');
    const date = project.deliveredAt ?? new Date();
    const rule = await this.prisma.bonusRule.findFirst({
      where: {
        organizationId: project.organizationId,
        projectLevel: project.projectLevel,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!rule) throw new BadRequestException('MISSING_ACTIVE_BONUS_RULE');
    const bonus = calculateProjectBonus(
      project.approvedHours.toString(),
      project.rating.grade as BonusGrade,
      {
        hourlyRate: rule.hourlyRate.toString(),
        minHours: rule.minHours.toString(),
        maxHours: rule.maxHours.toString(),
        multipliers: {
          S: rule.sMultiplier.toString(),
          A: rule.aMultiplier.toString(),
          B: rule.bMultiplier.toString(),
          C: rule.cMultiplier.toString(),
          FAIL: rule.failMultiplier.toString(),
        },
      },
    );
    const allocations = allocateBonus(
      bonus.finalBonus,
      project.contributions.filter((c) => !c.supersededAt).map((c) => ({
        userId: c.userId,
        percentage: (c.finalPercentage ?? c.proposedPercentage).toString(),
      })),
    );
    const month = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          baseBonus: new Prisma.Decimal(bonus.baseBonus),
          finalBonus: new Prisma.Decimal(bonus.finalBonus),
          status: transitionProject(
            'CONTRIBUTION_CONFIRMATION',
            'SETTLEMENT_PENDING',
          ),
          completedAt: new Date(),
        },
      });
      for (const item of allocations) {
        await tx.bonusLedger.upsert({
          where: { projectId_userId: { projectId: id, userId: item.userId } },
          update: {
            amount: new Prisma.Decimal(item.amount),
            contributionPercentage: new Prisma.Decimal(item.percentage),
            settlementMonth: month,
          },
          create: {
            organizationId: project.organizationId,
            projectId: id,
            userId: item.userId,
            amount: new Prisma.Decimal(item.amount),
            contributionPercentage: new Prisma.Decimal(item.percentage),
            settlementMonth: month,
          },
        });
        await tx.notification.create({
          data: {
            userId: item.userId,
            type: 'SETTLEMENT',
            title: '项目奖金待月结',
            body: `你在项目中的奖金为 ¥${item.amount}，贡献比例 ${item.percentage}%`,
            entityType: 'Project',
            entityId: id,
          },
        });
      }
    });
    await this.feedback?.applyCompletedProject(id);
    return { finalized: true, bonus, allocations };
  }
  async mine(actor: RequestUser) {
    return this.prisma.bonusLedger.findMany({
      where: { userId: actor.id, organizationId: actor.organizationId },
      include: { project: { select: { title: true, rating: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async transparentLedger(actor: RequestUser, query: { page?: number; pageSize?: number; status?: string; month?: string; search?: string }) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 20)));
    const month = query.month ? new Date(`${query.month}-01T00:00:00.000Z`) : undefined;
    const where: Prisma.BonusLedgerWhereInput = {
      organizationId: actor.organizationId,
      ...(query.status && ['PENDING', 'LOCKED', 'PAID'].includes(query.status) ? { status: query.status as 'PENDING' | 'LOCKED' | 'PAID' } : {}),
      ...(month ? { settlementMonth: month } : {}),
      ...(query.search ? { OR: [{ user: { displayName: { contains: query.search, mode: 'insensitive' } } }, { project: { title: { contains: query.search, mode: 'insensitive' } } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.bonusLedger.count({ where }),
      this.prisma.bonusLedger.findMany({
        where,
        include: {
          user: { select: { displayName: true, bonusLedgers: { where: { organizationId: actor.organizationId }, select: { amount: true, project: { select: { rating: { select: { grade: true } } } } } } } },
          project: { select: { title: true, finalBonus: true, rating: { select: { grade: true, finalScore: true } }, members: { select: { userId: true, role: true } } } },
        },
        orderBy: [{ settlementMonth: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => {
        const percentage = Number(row.contributionPercentage);
        const grade = row.project.rating?.grade ?? null;
        const history = row.user.bonusLedgers;
        return {
          id: row.id,
          employee: { id: row.userId, displayName: row.user.displayName },
          project: { id: row.projectId, title: row.project.title },
          role: row.project.members.find((member) => member.userId === row.userId)?.role ?? 'CONTRIBUTOR',
          task: null,
          amount: Number(row.amount),
          cumulativeAmount: history.reduce((sum, item) => sum + Number(item.amount), 0),
          contributionPercentage: percentage,
          contributionScore: Math.round(((row.project.rating?.finalScore ?? 0) * percentage / 100) * 100) / 100,
          grade,
          sCount: history.filter((item) => item.project.rating?.grade === 'S').length,
          aCount: history.filter((item) => item.project.rating?.grade === 'A').length,
          status: row.status,
          settlementMonth: row.settlementMonth,
          ruleExplanation: `项目奖金 ¥${Number(row.project.finalBonus ?? 0).toFixed(2)} × 最终贡献比例 ${percentage.toFixed(2)}%`,
        };
      }),
      total, page, pageSize,
    };
  }
  private requireManager(actor: RequestUser) {
    if (!actor.permissions.includes('settlement:manage'))
      throw new ForbiddenException('缺少结算管理权限');
  }
  async overview(actor: RequestUser, monthText?: string) {
    this.requireManager(actor);
    const month = monthText ? new Date(`${monthText}-01T00:00:00.000Z`) : undefined;
    const [batches, ledgers] = await Promise.all([
      this.prisma.settlementBatch.findMany({ where: { organizationId: actor.organizationId, ...(month ? { settlementMonth: month } : {}) }, include: { ledgers: true }, orderBy: { settlementMonth: 'desc' }, take: 24 }),
      this.prisma.bonusLedger.findMany({ where: { organizationId: actor.organizationId, ...(month ? { settlementMonth: month } : {}) }, include: { user: { select: { displayName: true } }, project: { select: { title: true } } }, orderBy: [{ settlementMonth: 'desc' }, { createdAt: 'desc' }], take: 200 }),
    ]);
    return { batches, ledgers };
  }
  async lock(actor: RequestUser, monthText: string) {
    this.requireManager(actor);
    const month = new Date(`${monthText}-01T00:00:00.000Z`);
    const ledgers = await this.prisma.bonusLedger.findMany({
      where: {
        organizationId: actor.organizationId,
        settlementMonth: month,
        status: 'PENDING',
      },
    });
    const total = ledgers.reduce(
      (sum, item) => sum.plus(item.amount),
      new Prisma.Decimal(0),
    );
    if (!ledgers.length) {
      const existing = await this.prisma.settlementBatch.findUnique({
        where: {
          organizationId_settlementMonth: {
            organizationId: actor.organizationId,
            settlementMonth: month,
          },
        },
      });
      if (existing) return existing;
    }
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.settlementBatch.upsert({
        where: {
          organizationId_settlementMonth: {
            organizationId: actor.organizationId,
            settlementMonth: month,
          },
        },
        update: {
          totalAmount: { increment: total },
          status: 'LOCKED',
          paidAt: null,
        },
        create: {
          organizationId: actor.organizationId,
          settlementMonth: month,
          totalAmount: total,
          lockedById: actor.id,
        },
      });
      await tx.bonusLedger.updateMany({
        where: { id: { in: ledgers.map((i) => i.id) }, status: 'PENDING' },
        data: {
          status: 'LOCKED',
          settlementBatchId: batch.id,
          lockedAt: new Date(),
        },
      });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'SettlementBatch', entityId: batch.id, action: 'SETTLEMENT_LOCKED', after: { month: monthText, ledgerCount: ledgers.length, total: total.toString() } } });
      return batch;
    });
  }
  async pay(actor: RequestUser, id: string) {
    this.requireManager(actor);
    const batch = await this.prisma.settlementBatch.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { ledgers: true },
    });
    if (!batch) throw new NotFoundException();
    const paidAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.bonusLedger.updateMany({
        where: { settlementBatchId: id, status: 'LOCKED' },
        data: { status: 'PAID', paidAt },
      });
      await tx.settlementBatch.update({
        where: { id },
        data: { status: 'PAID', paidAt },
      });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'SettlementBatch', entityId: id, action: 'SETTLEMENT_PAID', after: { ledgerCount: batch.ledgers.length, paidAt } } });
      if (batch.ledgers.length) await tx.notification.createMany({ data: batch.ledgers.map((item) => ({ userId: item.userId, type: 'SETTLEMENT' as const, title: '项目奖金已发放', body: `奖金 ¥${item.amount.toString()} 已标记发放。`, entityType: 'BonusLedger', entityId: item.id, dedupeKey: `bonus-paid:${item.id}` })), skipDuplicates: true });
      for (const projectId of new Set(batch.ledgers.map((l) => l.projectId)))
        await tx.project.update({
          where: { id: projectId },
          data: { status: transitionProject('SETTLEMENT_PENDING', 'SETTLED') },
        });
    });
    return this.prisma.settlementBatch.findUnique({
      where: { id },
      include: { ledgers: true },
    });
  }
}

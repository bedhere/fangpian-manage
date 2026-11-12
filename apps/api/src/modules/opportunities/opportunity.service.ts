import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type {
  CreateOpportunityDto,
  CreateOpportunityProposalDto,
} from './opportunity.dto.js';
@Injectable()
export class OpportunityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async actorDepartment(actor: RequestUser) {
    return (
      (
        await this.prisma.user.findFirst({
          where: { id: actor.id, organizationId: actor.organizationId },
          select: { departmentId: true },
        })
      )?.departmentId ?? null
    );
  }
  async list(actor: RequestUser) {
    const departmentId = await this.actorDepartment(actor);
    return this.prisma.opportunity.findMany({
      where: {
        organizationId: actor.organizationId,
        OR: [
          { visibility: 'ORGANIZATION' },
          ...(departmentId
            ? [
                {
                  visibility: 'DEPARTMENT' as const,
                  publisherDepartmentId: departmentId,
                },
              ]
            : []),
        ],
      },
      include: {
        followers: { where: { userId: actor.id } },
        proposals: {
          where: {
            OR: [
              { proposerId: actor.id },
              { opportunity: { publisherId: actor.id } },
            ],
          },
        },
        conversion: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async create(actor: RequestUser, input: CreateOpportunityDto) {
    const departmentId = await this.actorDepartment(actor);
    if (input.visibility === 'DEPARTMENT' && !departmentId)
      throw new BadRequestException('需要先加入部门');
    const setting = await this.prisma.systemSetting.findFirst({
      where: { organizationId: actor.organizationId, key: 'opportunity.rules' },
    });
    const maxDays = Number(
      (setting?.value as { maxOpenDays?: number } | null)?.maxOpenDays ?? 180,
    );
    const deadline = input.deadline ? new Date(input.deadline) : null;
    if (
      deadline &&
      (deadline <= new Date() ||
        deadline.getTime() > Date.示例公司有限公司() + maxDays * 86400000)
    )
      throw new BadRequestException('机会截止时间超出规则范围');
    const created = await this.prisma.opportunity.create({
      data: {
        organizationId: actor.organizationId,
        publisherId: actor.id,
        publisherDepartmentId: departmentId,
        title: input.title,
        description: input.description,
        valueTags: input.valueTags,
        visibility: input.visibility,
        deadline,
      },
    });
    await this.audit(actor, created.id, 'OPPORTUNITY_CREATED', {
      visibility: created.visibility,
    });
    return created;
  }
  async follow(actor: RequestUser, id: string, followed: boolean) {
    await this.visible(actor, id);
    if (followed)
      await this.prisma.opportunityFollow.upsert({
        where: {
          opportunityId_userId: { opportunityId: id, userId: actor.id },
        },
        update: {},
        create: { opportunityId: id, userId: actor.id },
      });
    else
      await this.prisma.opportunityFollow.deleteMany({
        where: { opportunityId: id, userId: actor.id },
      });
    return { followed };
  }
  async propose(
    actor: RequestUser,
    id: string,
    input: CreateOpportunityProposalDto,
  ) {
    const opportunity = await this.visible(actor, id);
    if (opportunity.publisherId === actor.id)
      throw new ForbiddenException('发布者不能向自己的机会提交提案');
    if (
      opportunity.status !== 'OPEN' ||
      (opportunity.deadline && opportunity.deadline <= new Date())
    )
      throw new BadRequestException('机会已停止接收提案');
    const setting = await this.prisma.systemSetting.findFirst({
      where: { organizationId: actor.organizationId, key: 'opportunity.rules' },
    });
    const maxProposals = Number(
      (setting?.value as { maxProposalsPerUser?: number } | null)
        ?.maxProposalsPerUser ?? 1,
    );
    const proposalCount = await this.prisma.opportunityProposal.count({
      where: {
        opportunityId: id,
        proposerId: actor.id,
        status: { not: 'WITHDRAWN' },
      },
    });
    if (proposalCount >= maxProposals)
      throw new BadRequestException('已达到该机会的提案上限');
    const proposal = await this.prisma.opportunityProposal.create({
      data: {
        opportunityId: id,
        proposerId: actor.id,
        title: input.title,
        approach: input.approach,
        expectedValue: input.expectedValue,
      },
    });
    await this.audit(actor, proposal.id, 'OPPORTUNITY_PROPOSAL_CREATED', {
      opportunityId: id,
    });
    return proposal;
  }
  async convert(actor: RequestUser, id: string, proposalId: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { proposals: { where: { id: proposalId } }, conversion: true },
    });
    if (!opportunity) throw new NotFoundException('机会不存在');
    if (opportunity.publisherId !== actor.id)
      throw new ForbiddenException('仅发布者可接受并转换提案');
    if (opportunity.conversion) return opportunity.conversion;
    const proposal = opportunity.proposals[0];
    if (!proposal || proposal.status !== 'PENDING')
      throw new BadRequestException('提案不可转换');
    if (proposal.proposerId === actor.id)
      throw new ForbiddenException('不能审核自己的提案');
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.businessRequest.create({
        data: {
          organizationId: actor.organizationId,
          requesterId: actor.id,
          title: opportunity.title,
          problem: opportunity.description,
          businessContext: `来自内部机会与提案：${proposal.title}`,
          expectedOutcome: proposal.expectedValue,
          constraints: proposal.approach,
          status: 'DRAFT',
        },
      });
      await tx.opportunityProposal.update({
        where: { id: proposal.id },
        data: { status: 'ACCEPTED' },
      });
      await tx.opportunityProposal.updateMany({
        where: {
          opportunityId: id,
          id: { not: proposal.id },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });
      await tx.opportunity.update({
        where: { id },
        data: { status: 'CONVERTED' },
      });
      const conversion = await tx.opportunityConversion.create({
        data: {
          opportunityId: id,
          proposalId: proposal.id,
          businessRequestId: request.id,
          convertedById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'Opportunity',
          entityId: id,
          action: 'OPPORTUNITY_CONVERTED',
          after: { proposalId: proposal.id, businessRequestId: request.id },
        },
      });
      await tx.notification.create({
        data: {
          userId: proposal.proposerId,
          type: 'PROJECT',
          title: '机会提案已被接受',
          body: `${opportunity.title} 已转换为业务需求。`,
          entityType: 'BusinessRequest',
          entityId: request.id,
          dedupeKey: `opportunity-converted:${id}`,
        },
      });
      return conversion;
    });
  }
  private async visible(actor: RequestUser, id: string) {
    const departmentId = await this.actorDepartment(actor);
    const opportunity = await this.prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        OR: [
          { visibility: 'ORGANIZATION' },
          ...(departmentId
            ? [
                {
                  visibility: 'DEPARTMENT' as const,
                  publisherDepartmentId: departmentId,
                },
              ]
            : []),
          { publisherId: actor.id },
        ],
      },
    });
    if (!opportunity) throw new NotFoundException('机会不存在或不可见');
    return opportunity;
  }
  private audit(
    actor: RequestUser,
    entityId: string,
    action: string,
    after: unknown,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        entityType: 'Opportunity',
        entityId,
        action,
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}

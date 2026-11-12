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
import type { CreateCircleDto } from './circle.dto.js';
@Injectable()
export class CircleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async dept(a: RequestUser) {
    return (
      (
        await this.prisma.user.findFirst({
          where: { id: a.id, organizationId: a.organizationId },
          select: { departmentId: true },
        })
      )?.departmentId ?? null
    );
  }
  async list(a: RequestUser) {
    const d = await this.dept(a);
    return this.prisma.circle.findMany({
      where: {
        organizationId: a.organizationId,
        OR: [
          { visibility: 'ORGANIZATION' },
          ...(d
            ? [{ visibility: 'DEPARTMENT' as const, ownerDepartmentId: d }]
            : []),
          { ownerId: a.id },
          { members: { some: { userId: a.id, leftAt: null } } },
        ],
      },
      include: {
        members: { where: { leftAt: null } },
        joinRequests: {
          where: { OR: [{ applicantId: a.id }, { circle: { ownerId: a.id } }] },
        },
        discussions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async create(a: RequestUser, i: CreateCircleDto) {
    const d = await this.dept(a);
    if (i.visibility === 'DEPARTMENT' && !d)
      throw new BadRequestException('需要先加入部门');
    await this.validateLinks(a, i);
    const setting = await this.prisma.systemSetting.findFirst({
      where: { organizationId: a.organizationId, key: 'circle.rules' },
    });
    const days = Number(
      (setting?.value as { defaultDurationDays?: number } | null)
        ?.defaultDurationDays ?? 30,
    );
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.circle.create({
        data: {
          organizationId: a.organizationId,
          ownerId: a.id,
          ownerDepartmentId: d,
          title: i.title,
          topic: i.topic,
          visibility: i.visibility,
          opportunityId: i.opportunityId,
          businessRequestId: i.businessRequestId,
          projectId: i.projectId,
          closesAt: new Date(Date.示例公司有限公司() + days * 86400000),
        },
      });
      await tx.circleMember.create({
        data: { circleId: c.id, userId: a.id, role: 'OWNER' },
      });
      await tx.auditLog.create({
        data: {
          organizationId: a.organizationId,
          actorId: a.id,
          entityType: 'Circle',
          entityId: c.id,
          action: 'CIRCLE_CREATED',
          after: { visibility: i.visibility },
        },
      });
      return c;
    });
  }
  async apply(a: RequestUser, id: string, message?: string) {
    const c = await this.visible(a, id);
    if (c.ownerId === a.id)
      throw new BadRequestException('发起人已经是圈子成员');
    return this.prisma.circleJoinRequest.upsert({
      where: { circleId_applicantId: { circleId: id, applicantId: a.id } },
      update: { message, status: 'PENDING', reviewedById: null },
      create: { circleId: id, applicantId: a.id, message },
    });
  }
  async review(
    a: RequestUser,
    id: string,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    const c = await this.prisma.circle.findFirst({
      where: { id, organizationId: a.organizationId, ownerId: a.id },
    });
    if (!c) throw new ForbiddenException('仅圈子发起人可处理申请');
    const req = await this.prisma.circleJoinRequest.findFirst({
      where: { id: requestId, circleId: id, status: 'PENDING' },
    });
    if (!req) throw new NotFoundException('加入申请不存在');
    if (req.applicantId === a.id)
      throw new ForbiddenException('不能审核自己的加入申请');
    if (decision === 'APPROVED')
      await this.assertCapacity(a, id, req.applicantId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.circleJoinRequest.update({
        where: { id: requestId },
        data: { status: decision, reviewedById: a.id },
      });
      if (decision === 'APPROVED')
        await tx.circleMember.upsert({
          where: { circleId_userId: { circleId: id, userId: req.applicantId } },
          update: { leftAt: null },
          create: { circleId: id, userId: req.applicantId },
        });
      await tx.auditLog.create({
        data: {
          organizationId: a.organizationId,
          actorId: a.id,
          entityType: 'Circle',
          entityId: id,
          action: `CIRCLE_JOIN_${decision}`,
          after: { applicantId: req.applicantId },
        },
      });
      return updated;
    });
  }
  async invite(a: RequestUser, id: string, userId: string) {
    const [c, u] = await Promise.all([
      this.prisma.circle.findFirst({
        where: {
          id,
          organizationId: a.organizationId,
          ownerId: a.id,
          status: 'OPEN',
        },
      }),
      this.prisma.user.findFirst({
        where: {
          id: userId,
          organizationId: a.organizationId,
          deletedAt: null,
        },
      }),
    ]);
    if (!c) throw new ForbiddenException('仅圈子发起人可邀请');
    if (!u) throw new NotFoundException('成员不存在');
    await this.assertCapacity(a, id, userId);
    return this.prisma.circleMember.upsert({
      where: { circleId_userId: { circleId: id, userId } },
      update: { leftAt: null },
      create: { circleId: id, userId },
    });
  }
  async leave(a: RequestUser, id: string) {
    const c = await this.prisma.circle.findFirst({
      where: { id, organizationId: a.organizationId },
    });
    if (!c) throw new NotFoundException();
    if (c.ownerId === a.id)
      throw new BadRequestException('发起人需关闭圈子，不能直接退出');
    await this.prisma.circleMember.update({
      where: { circleId_userId: { circleId: id, userId: a.id } },
      data: { leftAt: new Date() },
    });
    return { left: true };
  }
  async close(a: RequestUser, id: string) {
    const r = await this.prisma.circle.updateMany({
      where: { id, organizationId: a.organizationId, ownerId: a.id },
      data: { status: 'CLOSED' },
    });
    if (!r.count) throw new ForbiddenException('仅发起人可关闭圈子');
    return { closed: true };
  }
  async discuss(a: RequestUser, id: string, content: string) {
    await this.member(a, id);
    return this.prisma.circleDiscussion.create({
      data: { circleId: id, authorId: a.id, content },
    });
  }
  async knowledge(a: RequestUser, id: string, title: string, summary: string) {
    const c = await this.member(a, id);
    const discussions = await this.prisma.circleDiscussion.findMany({
      where: { circleId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const asset = await this.prisma.knowledgeAsset.create({
      data: {
        organizationId: a.organizationId,
        authorId: a.id,
        title,
        summary,
        assetType: 'CASE_STUDY',
        content: {
          circleId: id,
          topic: c.topic,
          discussion: discussions.map((x) => ({
            authorId: x.authorId,
            content: x.content,
            createdAt: x.createdAt.toISOString(),
          })),
        } as Prisma.InputJsonValue,
        status: 'DRAFT',
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actorId: a.id,
        entityType: 'Circle',
        entityId: id,
        action: 'CIRCLE_KNOWLEDGE_DRAFTED',
        after: { knowledgeAssetId: asset.id },
      },
    });
    return asset;
  }
  private async assertCapacity(a: RequestUser, id: string, userId: string) {
    const existing = await this.prisma.circleMember.findFirst({
      where: { circleId: id, userId, leftAt: null },
    });
    if (existing) return;
    const [setting, count] = await Promise.all([
      this.prisma.systemSetting.findFirst({
        where: { organizationId: a.organizationId, key: 'circle.rules' },
      }),
      this.prisma.circleMember.count({ where: { circleId: id, leftAt: null } }),
    ]);
    const max = Number(
      (setting?.value as { maxMembers?: number } | null)?.maxMembers ?? 100,
    );
    if (count >= max) throw new BadRequestException('圈子成员已达到上限');
  }
  private async member(a: RequestUser, id: string) {
    const c = await this.prisma.circle.findFirst({
      where: {
        id,
        organizationId: a.organizationId,
        members: { some: { userId: a.id, leftAt: null } },
      },
    });
    if (!c) throw new ForbiddenException('仅圈子成员可操作');
    return c;
  }
  private async visible(a: RequestUser, id: string) {
    const d = await this.dept(a);
    const c = await this.prisma.circle.findFirst({
      where: {
        id,
        organizationId: a.organizationId,
        OR: [
          { visibility: 'ORGANIZATION' },
          ...(d
            ? [{ visibility: 'DEPARTMENT' as const, ownerDepartmentId: d }]
            : []),
          { ownerId: a.id },
          { members: { some: { userId: a.id, leftAt: null } } },
        ],
      },
    });
    if (!c) throw new NotFoundException('圈子不存在或不可见');
    return c;
  }
  private async validateLinks(a: RequestUser, i: CreateCircleDto) {
    const checks = await Promise.all([
      i.opportunityId
        ? this.prisma.opportunity.count({
            where: { id: i.opportunityId, organizationId: a.organizationId },
          })
        : 1,
      i.businessRequestId
        ? this.prisma.businessRequest.count({
            where: {
              id: i.businessRequestId,
              organizationId: a.organizationId,
            },
          })
        : 1,
      i.projectId
        ? this.prisma.project.count({
            where: { id: i.projectId, organizationId: a.organizationId },
          })
        : 1,
    ]);
    if (checks.some((x) => x !== 1))
      throw new ForbiddenException('关联对象不存在或不属于当前组织');
  }
}

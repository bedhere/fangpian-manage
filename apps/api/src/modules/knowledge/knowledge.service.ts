import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';

@Injectable()
export class KnowledgeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(actor: RequestUser) {
    const visibility: Prisma.KnowledgeAssetWhereInput[] = [
      { status: 'PUBLISHED' },
      { authorId: actor.id },
    ];
    if (actor.permissions.includes('project:business-review')) visibility.push({ status: 'BUSINESS_REVIEW' });
    if (actor.permissions.includes('project:technical-review')) visibility.push({ status: 'TECHNICAL_REVIEW' });
    return this.prisma.knowledgeAsset.findMany({
      where: { organizationId: actor.organizationId, OR: visibility },
      include: { author: { select: { displayName: true } }, reviews: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async create(
    actor: RequestUser,
    input: { title: string; summary: string; content: unknown; assetType?: 'PLAYBOOK' | 'TEMPLATE' | 'CASE_STUDY' | 'PROMPT' | 'TOOL' | 'OTHER'; sourceUrl?: string; requestId?: string; sessionId?: string },
  ) {
    let requestId = input.requestId;
    if (requestId) {
      const request = await this.prisma.businessRequest.findFirst({
        where: { id: requestId, organizationId: actor.organizationId, requesterId: actor.id },
      });
      if (!request) throw new ForbiddenException('关联需求不存在或无权访问');
    }
    if (input.sessionId) {
      const session = await this.prisma.aIWorkspaceSession.findFirst({
        where: {
          id: input.sessionId,
          createdById: actor.id,
          request: { organizationId: actor.organizationId, requesterId: actor.id },
        },
        select: { requestId: true },
      });
      if (!session) throw new ForbiddenException('关联 AI 工作区不存在或无权访问');
      if (requestId && requestId !== session.requestId) {
        throw new BadRequestException('关联需求与 AI 工作区不匹配');
      }
      requestId = session.requestId;
    }
    const asset = await this.prisma.knowledgeAsset.create({
      data: {
        organizationId: actor.organizationId,
        authorId: actor.id,
        title: input.title,
        summary: input.summary,
        content: input.content as Prisma.InputJsonValue,
        assetType: input.assetType ?? 'PLAYBOOK',
        sourceUrl: input.sourceUrl,
        requestId,
        sessionId: input.sessionId,
        status: 'DRAFT',
      },
    });
    await this.audit(actor, asset.id, 'KNOWLEDGE_CREATED', { status: asset.status });
    return asset;
  }

  async reuse(actor: RequestUser, id: string, input: { referenceType: 'REQUEST' | 'PROJECT'; referenceId: string; idempotencyKey: string }) {
    const asset = await this.prisma.knowledgeAsset.findFirst({ where: { id, organizationId: actor.organizationId, status: 'PUBLISHED' } });
    if (!asset) throw new NotFoundException('已发布知识资产不存在');
    const reference = input.referenceType === 'REQUEST'
      ? await this.prisma.businessRequest.findFirst({ where: { id: input.referenceId, organizationId: actor.organizationId } })
      : await this.prisma.project.findFirst({ where: { id: input.referenceId, organizationId: actor.organizationId } });
    if (!reference) throw new ForbiddenException('引用对象不存在或不属于当前组织');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeAssetUsageEvent.findUnique({ where: { assetId_referenceType_referenceId_idempotencyKey: { assetId: id, referenceType: input.referenceType, referenceId: input.referenceId, idempotencyKey: input.idempotencyKey } } });
      if (existing) return { reused: false, usageCount: asset.usageCount };
      await tx.knowledgeAssetUsageEvent.create({ data: { assetId: id, organizationId: actor.organizationId, actorId: actor.id, referenceType: input.referenceType, referenceId: input.referenceId, idempotencyKey: input.idempotencyKey } });
      const updated = await tx.knowledgeAsset.update({ where: { id }, data: { usageCount: { increment: 1 } } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'KnowledgeAsset', entityId: id, action: 'KNOWLEDGE_REUSED', after: { referenceType: input.referenceType, referenceId: input.referenceId, usageCount: updated.usageCount } } });
      return { reused: true, usageCount: updated.usageCount };
    });
  }

  async submit(actor: RequestUser, id: string) {
    const asset = await this.prisma.knowledgeAsset.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!asset) throw new NotFoundException('知识资产不存在');
    if (asset.authorId !== actor.id) throw new ForbiddenException('仅作者可提交知识资产');
    if (asset.status !== 'DRAFT') throw new BadRequestException('只有草稿可以提交审核');
    const updated = await this.prisma.knowledgeAsset.update({
      where: { id }, data: { status: 'BUSINESS_REVIEW' },
    });
    await this.audit(actor, id, 'KNOWLEDGE_SUBMITTED', { status: updated.status });
    return updated;
  }

  async review(
    actor: RequestUser,
    id: string,
    stage: 'BUSINESS' | 'TECHNICAL',
    input: { decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED'; comment?: string },
  ) {
    const asset = await this.prisma.knowledgeAsset.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { reviews: true },
    });
    if (!asset) throw new NotFoundException('知识资产不存在');
    if (asset.authorId === actor.id) throw new ForbiddenException('不能审核自己提交的知识资产');
    const permission = stage === 'BUSINESS' ? 'project:business-review' : 'project:technical-review';
    if (!actor.permissions.includes(permission)) throw new ForbiddenException('缺少审核权限');
    const expectedStatus = stage === 'BUSINESS' ? 'BUSINESS_REVIEW' : 'TECHNICAL_REVIEW';
    if (asset.status !== expectedStatus) throw new BadRequestException('知识资产不在当前审核阶段');
    const businessReview = asset.reviews.find((review) => review.stage === 'BUSINESS');
    if (stage === 'TECHNICAL' && businessReview?.reviewerId === actor.id) {
      throw new ForbiddenException('业务与技术审核必须由不同人员完成');
    }
    await this.prisma.knowledgeAssetReview.upsert({
      where: { assetId_stage: { assetId: id, stage } },
      update: { reviewerId: actor.id, decision: input.decision, comment: input.comment },
      create: { assetId: id, reviewerId: actor.id, stage, decision: input.decision, comment: input.comment },
    });
    const data: Prisma.KnowledgeAssetUpdateInput = input.decision === 'APPROVED'
      ? stage === 'BUSINESS'
        ? { status: 'TECHNICAL_REVIEW' }
        : { status: 'PUBLISHED', publishedAt: new Date() }
      : input.decision === 'REVISION_REQUIRED'
        ? { status: 'DRAFT' }
        : { status: 'REJECTED' };
    const updated = await this.prisma.knowledgeAsset.update({ where: { id }, data });
    await this.prisma.notification.create({
      data: {
        userId: asset.authorId,
        type: 'REVIEW',
        title: stage === 'BUSINESS' ? '知识资产业务审核已处理' : '知识资产技术审核已处理',
        body: input.decision === 'APPROVED'
          ? stage === 'TECHNICAL' ? '知识资产已通过双重审核并发布。' : '业务审核已通过，正在等待技术审核。'
          : input.decision === 'REVISION_REQUIRED' ? '审核人要求修改知识资产，请查看意见。' : '知识资产审核未通过。',
        entityType: 'KnowledgeAsset',
        entityId: id,
        data: { stage, decision: input.decision, status: updated.status },
      },
    });
    await this.audit(actor, id, `KNOWLEDGE_${stage}_${input.decision}`, {
      status: updated.status,
      comment: input.comment,
    });
    return updated;
  }

  private async audit(actor: RequestUser, entityId: string, action: string, after: unknown) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        entityType: 'KnowledgeAsset',
        entityId,
        action,
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}

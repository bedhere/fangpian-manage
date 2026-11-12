import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import { assertPermissionGrantIsBounded } from '@value-flow/domain';
import { AIEvaluationQueueService } from '../../infrastructure/ai-evaluation-queue.service.js';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type {
  CreateBuffDto,
  CreateBuffVersionDto,
  RunBuffDto,
} from './buff.dto.js';
@Injectable()
export class BuffService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AIEvaluationQueueService)
    private readonly queue: AIEvaluationQueueService,
  ) {}
  list(a: RequestUser) {
    return this.prisma.aIBuff.findMany({
      where: {
        organizationId: a.organizationId,
        OR: [{ status: 'PUBLISHED' }, { authorId: a.id }],
      },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        runs: {
          where: { callerId: a.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async create(a: RequestUser, i: CreateBuffDto) {
    try {
      assertPermissionGrantIsBounded(a.permissions, i.permissionCodes);
    } catch {
      throw new ForbiddenException('不能创建超出自身权限的 Buff');
    }
    const asset = await this.prisma.knowledgeAsset.findFirst({
      where: {
        id: i.knowledgeAssetId,
        organizationId: a.organizationId,
        status: 'PUBLISHED',
      },
    });
    if (!asset)
      throw new BadRequestException('Buff 必须关联已完成双审的知识资产');
    return this.prisma.$transaction(async (tx) => {
      const b = await tx.aIBuff.create({
        data: {
          organizationId: a.organizationId,
          authorId: a.id,
          knowledgeAssetId: i.knowledgeAssetId,
          name: i.name,
          description: i.description,
          type: i.type,
          permissionCodes: i.permissionCodes,
        },
      });
      await tx.aIBuffVersion.create({
        data: {
          buffId: b.id,
          version: 1,
          instructions: i.instructions,
          inputSchema: i.inputSchema as Prisma.InputJsonValue,
          createdById: a.id,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: a.organizationId,
          actorId: a.id,
          entityType: 'AIBuff',
          entityId: b.id,
          action: 'AI_BUFF_CREATED',
          after: { knowledgeAssetId: i.knowledgeAssetId },
        },
      });
      return b;
    });
  }
  async version(a: RequestUser, id: string, i: CreateBuffVersionDto) {
    const b = await this.prisma.aIBuff.findFirst({
      where: { id, organizationId: a.organizationId, authorId: a.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!b) throw new ForbiddenException('仅作者可创建版本');
    return this.prisma.aIBuffVersion.create({
      data: {
        buffId: id,
        version: (b.versions[0]?.version ?? 0) + 1,
        instructions: i.instructions,
        inputSchema: i.inputSchema as Prisma.InputJsonValue,
        createdById: a.id,
      },
    });
  }
  async publish(a: RequestUser, id: string) {
    const b = await this.prisma.aIBuff.findFirst({
      where: { id, organizationId: a.organizationId, authorId: a.id },
      include: { versions: true },
    });
    if (!b) throw new ForbiddenException('仅作者可发布 Buff');
    const asset = await this.prisma.knowledgeAsset.findFirst({
      where: {
        id: b.knowledgeAssetId,
        organizationId: a.organizationId,
        status: 'PUBLISHED',
      },
    });
    if (!asset || !b.versions.length)
      throw new BadRequestException('知识双审或 Buff 版本未完成');
    return this.prisma.aIBuff.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
  }
  async run(a: RequestUser, id: string, i: RunBuffDto) {
    const b = await this.prisma.aIBuff.findFirst({
      where: { id, organizationId: a.organizationId, status: 'PUBLISHED' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!b) throw new NotFoundException('可用 Buff 不存在');
    if (!b.permissionCodes.every((p) => a.permissions.includes(p)))
      throw new ForbiddenException('缺少 Buff 运行权限');
    const v = b.versions[0];
    if (!v) throw new BadRequestException('Buff 没有可运行版本');
    this.validateInput(v.inputSchema, i.input);
    if (Boolean(i.contextType) !== Boolean(i.contextId))
      throw new BadRequestException('上下文类型和编号必须同时提供');
    if (i.contextType && i.contextId)
      await this.validateContext(a, i.contextType, i.contextId);
    const existing = await this.prisma.aIBuffRun.findUnique({
      where: {
        callerId_idempotencyKey: {
          callerId: a.id,
          idempotencyKey: i.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
    const run = await this.prisma.aIBuffRun.create({
      data: {
        organizationId: a.organizationId,
        buffId: id,
        versionId: v.id,
        callerId: a.id,
        contextType: i.contextType,
        contextId: i.contextId,
        input: i.input as Prisma.InputJsonValue,
        idempotencyKey: i.idempotencyKey,
      },
    });
    await this.queue.enqueueBuff(a.organizationId, run.id);
    return run;
  }
  private validateInput(schema: unknown, input: Record<string, unknown>) {
    const s = schema as { required?: string[] };
    for (const key of s.required ?? [])
      if (input[key] === undefined)
        throw new BadRequestException(`缺少 Buff 输入字段：${key}`);
  }
  private async validateContext(
    a: RequestUser,
    t: 'REQUEST' | 'PROJECT' | 'CIRCLE',
    id: string,
  ) {
    const n =
      t === 'REQUEST'
        ? await this.prisma.businessRequest.count({
            where: { id, organizationId: a.organizationId },
          })
        : t === 'PROJECT'
          ? await this.prisma.project.count({
              where: { id, organizationId: a.organizationId },
            })
          : await this.prisma.circle.count({
              where: {
                id,
                organizationId: a.organizationId,
                members: { some: { userId: a.id, leftAt: null } },
              },
            });
    if (n !== 1) throw new ForbiddenException('Buff 上下文不存在或无权访问');
  }
}

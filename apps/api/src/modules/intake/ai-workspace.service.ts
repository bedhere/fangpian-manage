import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AIGateway, type WorkspaceConversationMessage } from '@value-flow/ai';
import { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';

export const AI_WORKSPACE_GATEWAY = Symbol('AI_WORKSPACE_GATEWAY');

function resultOf(metadata: unknown): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const result = (metadata as Record<string, unknown>).result;
  return result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : undefined;
}

@Injectable()
export class AIWorkspaceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AI_WORKSPACE_GATEWAY) private readonly gateway: Pick<AIGateway, 'respondToWorkspace' | 'buildDemo'>,
  ) {}

  async addMessage(actor: RequestUser, sessionId: string, input: { content: string; idempotencyKey: string }) {
    const session = await this.authorize(actor, sessionId);
    if (session.status !== 'ACTIVE') throw new BadRequestException('AI 工作区已结束');

    const existing = await this.prisma.aIWorkspaceMessage.findFirst({
      where: { sessionId, idempotencyKey: input.idempotencyKey },
      include: { replies: { where: { role: 'ASSISTANT', generationStatus: 'SUCCEEDED' }, take: 1 } },
    });
    if (existing?.replies[0]) return existing.replies[0];

    const history = await this.conversation(sessionId);
    const userMessage = existing ?? await this.prisma.aIWorkspaceMessage.create({
      data: {
        sessionId,
        role: 'USER',
        content: input.content,
        idempotencyKey: input.idempotencyKey,
        generationStatus: 'PENDING',
      },
    });
    const startedAt = Date.示例公司有限公司();
    try {
      const response = await this.gateway.respondToWorkspace({
        request: {
          title: session.request.title,
          problem: session.request.problem,
          businessContext: session.request.businessContext,
          expectedOutcome: session.request.expectedOutcome,
          constraints: session.request.constraints,
        },
        diagnosis: session.request.diagnosis as Record<string, unknown> | null,
        messages: [
          ...history,
          { role: 'USER', content: input.content },
        ],
      });
      const metadata = {
        result: response.result,
        isComplete: response.isComplete,
        confidence: response.confidence,
      } as Prisma.InputJsonValue;
      const assistant = await this.prisma.aIWorkspaceMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: response.message,
          replyToId: userMessage.id,
          generationStatus: 'SUCCEEDED',
          provider: process.env.AI_PROVIDER ?? 'openai-compatible',
          model: process.env.AI_MODEL ?? 'unconfigured',
          promptVersion: 'workspace-v1',
          latencyMs: Date.示例公司有限公司() - startedAt,
          metadata,
        },
      });
      await this.prisma.aIWorkspaceMessage.update({
        where: { id: userMessage.id }, data: { generationStatus: 'SUCCEEDED', generationError: null },
      });
      await this.audit(actor, session.request.id, 'AI_WORKSPACE_RESPONSE_GENERATED', { sessionId, userMessageId: userMessage.id, assistantMessageId: assistant.id });
      return assistant;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'AI workspace generation failed';
      await this.prisma.aIWorkspaceMessage.update({
        where: { id: userMessage.id }, data: { generationStatus: 'FAILED', generationError: error },
      });
      await this.audit(actor, session.request.id, 'AI_WORKSPACE_RESPONSE_FAILED', { sessionId, userMessageId: userMessage.id, error });
      throw new BadRequestException('AI 回复生成失败，请稍后重试或转人工处理');
    }
  }

  async complete(actor: RequestUser, sessionId: string, input: { assistantMessageId: string; editedResult?: Record<string, unknown> }) {
    const session = await this.authorize(actor, sessionId);
    if (session.status !== 'ACTIVE') throw new BadRequestException('AI 工作区已结束');
    const assistant = await this.prisma.aIWorkspaceMessage.findFirst({
      where: { id: input.assistantMessageId, sessionId, role: 'ASSISTANT', generationStatus: 'SUCCEEDED' },
    });
    const metadata = assistant?.metadata;
    const originalResult = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).result
      : undefined;
    if (!assistant || !originalResult || typeof originalResult !== 'object' || Array.isArray(originalResult)) {
      throw new BadRequestException('只能固化服务端生成的 AI 成果');
    }
    const confirmedResult = input.editedResult ?? originalResult;
    const updated = await this.prisma.aIWorkspaceSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        originalResult: originalResult as Prisma.InputJsonValue,
        confirmedResult: confirmedResult as Prisma.InputJsonValue,
        result: confirmedResult as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    await this.prisma.businessRequest.update({ where: { id: session.request.id }, data: { status: 'COMPLETED' } });
    await this.audit(actor, session.request.id, 'AI_WORKSPACE_COMPLETED', { sessionId, assistantMessageId: assistant.id, edited: Boolean(input.editedResult) });
    return updated;
  }

  /**
   * Generates a runnable single-file demo for the request and stores it as an assistant result,
   * so it can be previewed, revised and frozen like any other workspace outcome.
   */
  async buildDemo(actor: RequestUser, sessionId: string, input: { instruction?: string; idempotencyKey: string }) {
    const session = await this.authorize(actor, sessionId);
    if (session.status !== 'ACTIVE') throw new BadRequestException('AI 工作区已结束');

    const existing = await this.prisma.aIWorkspaceMessage.findFirst({
      where: { sessionId, idempotencyKey: input.idempotencyKey },
      include: { replies: { where: { role: 'ASSISTANT', generationStatus: 'SUCCEEDED' }, take: 1 } },
    });
    if (existing?.replies[0]) return existing.replies[0];

    const history = await this.conversation(sessionId);
    const previousHtml = await this.latestDemoHtml(sessionId);
    const instruction = input.instruction?.trim() || undefined;
    const userMessage = existing ?? await this.prisma.aIWorkspaceMessage.create({
      data: {
        sessionId,
        role: 'USER',
        content: instruction ? `生成可用 Demo：${instruction}` : '生成可用 Demo',
        idempotencyKey: input.idempotencyKey,
        generationStatus: 'PENDING',
      },
    });
    const startedAt = Date.示例公司有限公司();
    try {
      const demo = await this.gateway.buildDemo({
        request: {
          title: session.request.title,
          problem: session.request.problem,
          businessContext: session.request.businessContext,
          expectedOutcome: session.request.expectedOutcome,
          constraints: session.request.constraints,
        },
        conversation: history,
        instruction,
        previousHtml,
      });
      const steps = demo.howToUse.map((step, index) => `${index + 1}. ${step}`).join('\n');
      const metadata = {
        result: {
          title: demo.title,
          content: `${demo.summary}${steps ? `\n\n**使用方法**\n${steps}` : ''}`,
          demo: { title: demo.title, html: demo.html },
        },
        isComplete: true,
        confidence: 0.8,
      } as Prisma.InputJsonValue;
      const assistant = await this.prisma.aIWorkspaceMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: `已生成可直接使用的 Demo「${demo.title}」。${demo.summary}`,
          replyToId: userMessage.id,
          generationStatus: 'SUCCEEDED',
          provider: process.env.AI_PROVIDER ?? 'openai-compatible',
          model: process.env.AI_MODEL ?? 'unconfigured',
          promptVersion: 'workspace-demo-v1',
          latencyMs: Date.示例公司有限公司() - startedAt,
          metadata,
        },
      });
      await this.prisma.aIWorkspaceMessage.update({
        where: { id: userMessage.id }, data: { generationStatus: 'SUCCEEDED', generationError: null },
      });
      await this.audit(actor, session.request.id, 'AI_WORKSPACE_DEMO_GENERATED', { sessionId, userMessageId: userMessage.id, assistantMessageId: assistant.id, bytes: demo.html.length });
      return assistant;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'AI demo generation failed';
      await this.prisma.aIWorkspaceMessage.update({
        where: { id: userMessage.id }, data: { generationStatus: 'FAILED', generationError: error },
      });
      await this.audit(actor, session.request.id, 'AI_WORKSPACE_DEMO_FAILED', { sessionId, userMessageId: userMessage.id, error });
      throw new BadRequestException(error.startsWith('Demo ') ? error : 'Demo 生成失败，请稍后重试，或补充更具体的功能要求');
    }
  }

  /** Conversation for the model, including the body of results it already delivered. */
  private async conversation(sessionId: string): Promise<WorkspaceConversationMessage[]> {
    const messages = await this.prisma.aIWorkspaceMessage.findMany({
      where: { sessionId, generationStatus: { not: 'FAILED' } },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true, metadata: true },
    });
    return messages.map((message) => {
      const result = resultOf(message.metadata);
      const content = result?.content;
      const title = result?.title;
      const body = typeof content === 'string' ? `\n\n【已交付成果${typeof title === 'string' ? `：${title}` : ''}】\n${content.slice(0, 8000)}` : '';
      const demo = result?.demo ? '\n\n【已生成可运行 Demo】' : '';
      return { role: message.role as WorkspaceConversationMessage['role'], content: `${message.content}${body}${demo}` };
    });
  }

  private async latestDemoHtml(sessionId: string): Promise<string | undefined> {
    const messages = await this.prisma.aIWorkspaceMessage.findMany({
      where: { sessionId, role: 'ASSISTANT', generationStatus: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { metadata: true },
    });
    for (const message of messages) {
      const demo = resultOf(message.metadata)?.demo;
      if (demo && typeof demo === 'object' && typeof (demo as { html?: unknown }).html === 'string') return (demo as { html: string }).html;
    }
    return undefined;
  }

  private async authorize(actor: RequestUser, sessionId: string) {
    const session = await this.prisma.aIWorkspaceSession.findFirst({
      where: { id: sessionId, request: { organizationId: actor.organizationId } },
      include: { request: true },
    });
    if (!session) throw new NotFoundException('AI 工作区不存在');
    if (session.request.requesterId !== actor.id) throw new ForbiddenException('无权访问该 AI 工作区');
    return session;
  }

  private async audit(actor: RequestUser, entityId: string, action: string, after: unknown) {
    await this.prisma.auditLog.create({
      data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'BusinessRequest', entityId, action, after: after as Prisma.InputJsonValue },
    });
  }
}

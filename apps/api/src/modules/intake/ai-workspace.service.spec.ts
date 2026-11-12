import { describe, expect, it, vi } from 'vitest';
import { AIWorkspaceService } from './ai-workspace.service.js';

const actor = { id: 'user-1', organizationId: 'org-1', email: 'employee@example.com', roles: ['EMPLOYEE'], permissions: ['project:create'] };
const session = { id: 'session-1', status: 'ACTIVE', request: { id: 'request-1', requesterId: 'user-1', title: '竞品分析', problem: '资料分散', businessContext: '准备进入市场', expectedOutcome: '形成建议', constraints: null, diagnosis: { aiCanCompleteAlone: true } } };

function setup() {
  const prisma = {
    aIWorkspaceSession: { findFirst: vi.fn().mockResolvedValue(session), update: vi.fn().mockResolvedValue({ id: 'session-1', status: 'COMPLETED' }) },
    aIWorkspaceMessage: {
      findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValueOnce({ id: 'user-message', role: 'USER', content: '请输出对比表' }).mockResolvedValueOnce({ id: 'assistant-message', role: 'ASSISTANT', content: '已经完成', metadata: { result: { summary: '结果' } } }),
      update: vi.fn().mockResolvedValue({}),
    },
    businessRequest: { update: vi.fn().mockResolvedValue({}) }, auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const gateway = { respondToWorkspace: vi.fn().mockResolvedValue({ message: '已经完成', result: { summary: '结果' }, isComplete: true, confidence: 0.9 }) };
  return { prisma, gateway, service: new AIWorkspaceService(prisma as never, gateway as never) };
}

describe('AIWorkspaceService', () => {
  it('owns message roles and persists the generated assistant response', async () => {
    const { prisma, gateway, service } = setup();
    await service.addMessage(actor, 'session-1', { content: '请输出对比表', idempotencyKey: 'send-1' });
    expect(prisma.aIWorkspaceMessage.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ sessionId: 'session-1', role: 'USER', content: '请输出对比表', idempotencyKey: 'send-1', generationStatus: 'PENDING' }) });
    expect(gateway.respondToWorkspace).toHaveBeenCalledWith(expect.objectContaining({ request: expect.objectContaining({ title: '竞品分析' }), messages: [{ role: 'USER', content: '请输出对比表' }] }));
    expect(prisma.aIWorkspaceMessage.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ sessionId: 'session-1', role: 'ASSISTANT', content: '已经完成', replyToId: 'user-message', generationStatus: 'SUCCEEDED' }) });
  });

  it('returns the existing response for the same idempotency key', async () => {
    const { prisma, gateway, service } = setup();
    prisma.aIWorkspaceMessage.findFirst.mockResolvedValue({ id: 'user-message', replies: [{ id: 'assistant-message', role: 'ASSISTANT', content: '已有结果' }] });
    await expect(service.addMessage(actor, 'session-1', { content: '重复发送', idempotencyKey: 'send-1' })).resolves.toMatchObject({ id: 'assistant-message' });
    expect(gateway.respondToWorkspace).not.toHaveBeenCalled();
  });

  it('records a retryable generation failure', async () => {
    const { prisma, gateway, service } = setup();
    gateway.respondToWorkspace.mockRejectedValue(new Error('provider unavailable'));
    await expect(service.addMessage(actor, 'session-1', { content: '请输出对比表', idempotencyKey: 'send-1' })).rejects.toThrow('AI 回复生成失败');
    expect(prisma.aIWorkspaceMessage.update).toHaveBeenCalledWith({ where: { id: 'user-message' }, data: expect.objectContaining({ generationStatus: 'FAILED', generationError: 'provider unavailable' }) });
  });

  it('rejects access from a different request owner', async () => {
    const { prisma, service } = setup();
    prisma.aIWorkspaceSession.findFirst.mockResolvedValue({ ...session, request: { ...session.request, requesterId: 'other-user' } });
    await expect(service.addMessage(actor, 'session-1', { content: '越权消息', idempotencyKey: 'send-1' })).rejects.toThrow('无权访问该 AI 工作区');
  });

  it('completes only from a generated assistant result and preserves edits separately', async () => {
    const { prisma, service } = setup();
    prisma.aIWorkspaceMessage.findFirst.mockResolvedValue({ id: 'assistant-message', sessionId: 'session-1', role: 'ASSISTANT', generationStatus: 'SUCCEEDED', metadata: { result: { summary: 'AI 原始成果' }, isComplete: true } });
    await service.complete(actor, 'session-1', { assistantMessageId: 'assistant-message', editedResult: { summary: '用户确认成果' } });
    expect(prisma.aIWorkspaceSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: expect.objectContaining({ status: 'COMPLETED', originalResult: { summary: 'AI 原始成果' }, confirmedResult: { summary: '用户确认成果' }, result: { summary: '用户确认成果' } }) });
  });

  it('rejects completion from a user-authored message', async () => {
    const { prisma, service } = setup();
    prisma.aIWorkspaceMessage.findFirst.mockResolvedValue(null);
    await expect(service.complete(actor, 'session-1', { assistantMessageId: 'user-message' })).rejects.toThrow('只能固化服务端生成的 AI 成果');
  });
});

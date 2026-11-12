import { describe, expect, it, vi } from 'vitest';
import { DeliveryReviewContextService } from './delivery-review-context.service.js';

describe('DeliveryReviewContextService', () => {
  it('assembles original intent, execution facts and version history with deterministic limits', async () => {
    const prisma = {
      systemSetting: { findFirst: vi.fn().mockResolvedValue({ value: { maxProgressLogs: 2, maxRisks: 1, maxDeliveryVersions: 2, maxTextChars: 20 } }) },
      project: { findFirst: vi.fn().mockResolvedValue({
        id: 'p1', organizationId: 'org1', title: '交付项目', businessProblem: '原始业务问题', expectedResult: '期望成果', acceptanceCriteria: '必须满足验收标准', objective: '提升效率',
        businessRequest: { title: '原始需求', problem: '请求问题', businessContext: '业务背景', expectedOutcome: '请求结果', constraints: '不得泄密' },
        plans: [{ objective: '确认目标', milestones: [{ title: '里程碑', description: '阶段说明', expectedDeliverable: '报告', dueAt: new Date('2026-10-20') }] }],
        progressLogs: [{ summary: '最新进展', blockers: null, nextAction: '继续', progressPercent: 90, riskLevel: 0, createdAt: new Date('2026-10-09') }, { summary: '较早进展', blockers: '等待数据', nextAction: '催办', progressPercent: 50, riskLevel: 1, createdAt: new Date('2026-10-08') }, { summary: '应被截断', blockers: null, nextAction: '无', progressPercent: 10, riskLevel: 0, createdAt: new Date('2026-10-07') }],
        riskActions: [{ reason: '风险一', remediationPlan: '处理一', resolvedAt: null }, { reason: '应被截断', remediationPlan: '处理二', resolvedAt: null }],
        deliveries: [{ id: 'd2', version: 2, title: '最新版', changeSummary: '修订', content: '1234567890123456789012345', url: null, storageKey: null }, { id: 'd1', version: 1, title: '初版', changeSummary: '首版', content: '初版内容', url: null, storageKey: null }],
      }) },
    };
    const service = new DeliveryReviewContextService(prisma as never);
    const result = await service.assemble({ id: 'actor', organizationId: 'org1' } as never, 'p1', 'd2');
    expect(result.request).toMatchObject({ title: '原始需求', acceptanceCriteria: '必须满足验收标准' });
    expect(result.execution.progress).toHaveLength(2);
    expect(result.execution.risks).toHaveLength(1);
    expect(result.deliveries).toHaveLength(2);
    expect(result.deliveries[0]?.content).toHaveLength(20);
    expect(result.truncation).toEqual(expect.objectContaining({ progressLogs: true, risks: true, deliveryText: true }));
  });

  it('never loads a project outside the actor organization', async () => {
    const prisma = { systemSetting: { findFirst: vi.fn().mockResolvedValue({ value: {} }) }, project: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new DeliveryReviewContextService(prisma as never);
    await expect(service.assemble({ organizationId: 'org1' } as never, 'foreign', 'd1')).rejects.toThrow('项目不存在');
    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', organizationId: 'org1' } }));
  });
});

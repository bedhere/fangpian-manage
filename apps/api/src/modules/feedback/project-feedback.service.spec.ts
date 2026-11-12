import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFeedbackService } from './project-feedback.service.js';

const project = {
  id: 'p1', organizationId: 'org1', status: 'SETTLEMENT_PENDING', deadline: new Date('2026-10-09'), deliveredAt: new Date('2026-10-08'),
  rating: { grade: 'S' }, requiredSkills: [{ skillId: 'skill1' }],
  contributions: [{ userId: 'u1', finalPercentage: { toNumber: () => 40 }, proposedPercentage: { toNumber: () => 40 }, supersededAt: null, user: { profile: { reputationScore: 100, capabilityLevel: 'L0' } } }],
};

function setup() {
  const tx = {
    reputationEvent: { upsert: vi.fn().mockResolvedValue({}), aggregate: vi.fn().mockResolvedValue({ _sum: { delta: 7 } }) },
    projectSkillEvidence: { upsert: vi.fn().mockResolvedValue({}) },
    capabilityLevelHistory: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'history1' }), create: vi.fn().mockResolvedValue({}) },
    employeeProfile: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    project: { findUniqueOrThrow: vi.fn().mockResolvedValue(project) },
    systemSetting: { findFirst: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => Promise.resolve({ value:
      where.key === 'reputation.eventDeltas' ? { GRADE_S: 5, GRADE_A: 3, ON_TIME: 2, OWNER_REPLACED: -15, PROJECT_FAILED: -20, MALICIOUS_ABANDON: -20 }
      : where.key === 'feedback.skillVerification' ? { minimumContributionPercentage: 20, acceptedGrades: ['S', 'A'] }
      : { L0: 0, L1: 105, L2: 115, L3: 130, L4: 150, allowAutomaticDemotion: false } })) },
    reputationEvent: { aggregate: vi.fn().mockResolvedValue({ _sum: { delta: 7 } }) },
    $transaction: vi.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    projectSkillEvidence: { findFirst: vi.fn() },
    employeeProfile: { findUniqueOrThrow: vi.fn().mockResolvedValue({ reputationScore: 100 }) },
  };
  return { prisma, tx, service: new ProjectFeedbackService(prisma as never) };
}

describe('ProjectFeedbackService', () => {
  it('persists project facts with stable idempotency keys and a single capability transition', async () => {
    const { service, tx } = setup();
    await service.applyCompletedProject('p1');
    await service.applyCompletedProject('p1');
    expect(tx.reputationEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_projectId_type: { userId: 'u1', projectId: 'p1', type: 'GRADE_S' } } }));
    expect(tx.projectSkillEvidence.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { evidenceKey: 'project:p1:user:u1:skill:skill1' } }));
    expect(tx.capabilityLevelHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u1', projectId: 'p1', oldLevel: 'L0', newLevel: 'L1', ruleVersion: 'feedback-v1' }) });
    expect(tx.capabilityLevelHistory.create).toHaveBeenCalledTimes(1);
  });

  it('forbids a reviewer from reviewing their own skill evidence', async () => {
    const { prisma, service } = setup();
    prisma.projectSkillEvidence.findFirst.mockResolvedValue({ id: 'e1', userId: 'u1', project: { organizationId: 'org1' } });
    await expect(service.reviewSkillEvidence({ id: 'u1', organizationId: 'org1', permissions: ['project:technical-review'] } as never, 'e1', 'VERIFIED', '证据充分')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies an operational reputation fact idempotently', async () => {
    const { service, tx } = setup();
    await service.applyReputationFact('org1', 'p1', 'u1', 'OWNER_REPLACED', { reason: '连续延期' });
    expect(tx.reputationEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_projectId_type: { userId: 'u1', projectId: 'p1', type: 'OWNER_REPLACED' } },
      update: {},
    }));
  });
});

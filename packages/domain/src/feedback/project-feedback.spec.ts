import { describe, expect, it } from 'vitest';
import { buildProjectFeedback, type ProjectFeedbackRules } from './project-feedback.js';

const rules: ProjectFeedbackRules = {
  reputationDeltas: { GRADE_S: 5, GRADE_A: 3, ON_TIME: 2, PROJECT_FAILED: -10, MALICIOUS_ABANDON: -20 },
  skillVerification: { minimumContributionPercentage: 20, acceptedGrades: ['S', 'A'] },
  capabilityProgression: { thresholds: { L0: 0, L1: 105, L2: 115, L3: 130, L4: 150 }, allowAutomaticDemotion: false },
};

describe('buildProjectFeedback', () => {
  it('produces stable reputation facts for an on-time S project', () => {
    const result = buildProjectFeedback({ projectId: 'p1', userId: 'u1', grade: 'S', onTime: true, failed: false, maliciousAbandonment: false, contributionPercentage: 40, skillIds: ['s1'], currentReputationScore: 100, currentCapabilityLevel: 'L0' }, rules);
    expect(result.reputationEvents).toEqual([
      { type: 'GRADE_S', delta: 5, eventKey: 'project:p1:user:u1:reputation:GRADE_S' },
      { type: 'ON_TIME', delta: 2, eventKey: 'project:p1:user:u1:reputation:ON_TIME' },
    ]);
    expect(result.capabilityDecision).toMatchObject({ oldLevel: 'L0', newLevel: 'L1' });
  });

  it('creates skill evidence only when contribution and grade satisfy configured rules', () => {
    const accepted = buildProjectFeedback({ projectId: 'p1', userId: 'u1', grade: 'A', onTime: false, failed: false, maliciousAbandonment: false, contributionPercentage: 20, skillIds: ['s1', 's2'], currentReputationScore: 100, currentCapabilityLevel: 'L0' }, rules);
    const rejected = buildProjectFeedback({ projectId: 'p2', userId: 'u1', grade: 'B', onTime: true, failed: false, maliciousAbandonment: false, contributionPercentage: 90, skillIds: ['s1'], currentReputationScore: 100, currentCapabilityLevel: 'L0' }, rules);
    expect(accepted.skillEvidence).toHaveLength(2);
    expect(accepted.skillEvidence[0]?.evidenceKey).toBe('project:p1:user:u1:skill:s1');
    expect(rejected.skillEvidence).toEqual([]);
  });

  it('applies failure and malicious abandonment without automatic demotion', () => {
    const result = buildProjectFeedback({ projectId: 'p1', userId: 'u1', grade: 'FAIL', onTime: false, failed: true, maliciousAbandonment: true, contributionPercentage: 40, skillIds: [], currentReputationScore: 120, currentCapabilityLevel: 'L2' }, rules);
    expect(result.reputationEvents.map((event) => event.type)).toEqual(['PROJECT_FAILED', 'MALICIOUS_ABANDON']);
    expect(result.capabilityDecision).toBeNull();
  });

  it('promotes by at most one level for a single completed project', () => {
    const result = buildProjectFeedback({ projectId: 'p1', userId: 'u1', grade: 'S', onTime: true, failed: false, maliciousAbandonment: false, contributionPercentage: 100, skillIds: [], currentReputationScore: 149, currentCapabilityLevel: 'L1' }, rules);
    expect(result.capabilityDecision?.newLevel).toBe('L2');
  });
});

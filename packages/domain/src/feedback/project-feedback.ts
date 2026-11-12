export type FeedbackReputationType = 'GRADE_S' | 'GRADE_A' | 'ON_TIME' | 'PROJECT_FAILED' | 'MALICIOUS_ABANDON';
export type FeedbackCapabilityLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface ProjectFeedbackFacts {
  projectId: string;
  userId: string;
  grade: 'S' | 'A' | 'B' | 'C' | 'FAIL';
  onTime: boolean;
  failed: boolean;
  maliciousAbandonment: boolean;
  contributionPercentage: number;
  skillIds: string[];
  currentReputationScore: number;
  currentCapabilityLevel: FeedbackCapabilityLevel;
}

export interface ProjectFeedbackRules {
  reputationDeltas: Record<FeedbackReputationType, number>;
  skillVerification: { minimumContributionPercentage: number; acceptedGrades: Array<ProjectFeedbackFacts['grade']> };
  capabilityProgression: { thresholds: Record<FeedbackCapabilityLevel, number>; allowAutomaticDemotion: boolean };
}

const levels: FeedbackCapabilityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

export function buildProjectFeedback(facts: ProjectFeedbackFacts, rules: ProjectFeedbackRules) {
  const types: FeedbackReputationType[] = [];
  if (facts.grade === 'S') types.push('GRADE_S');
  if (facts.grade === 'A') types.push('GRADE_A');
  if (facts.onTime) types.push('ON_TIME');
  if (facts.failed) types.push('PROJECT_FAILED');
  if (facts.maliciousAbandonment) types.push('MALICIOUS_ABANDON');
  const reputationEvents = types.map((type) => ({
    type,
    delta: rules.reputationDeltas[type],
    eventKey: `project:${facts.projectId}:user:${facts.userId}:reputation:${type}`,
  }));
  const resultingScore = Math.max(0, facts.currentReputationScore + reputationEvents.reduce((sum, event) => sum + event.delta, 0));
  const skillEvidence = facts.contributionPercentage >= rules.skillVerification.minimumContributionPercentage
    && rules.skillVerification.acceptedGrades.includes(facts.grade)
    ? [...new Set(facts.skillIds)].map((skillId) => ({
        skillId,
        evidenceKey: `project:${facts.projectId}:user:${facts.userId}:skill:${skillId}`,
        contributionPercentage: facts.contributionPercentage,
        grade: facts.grade,
      }))
    : [];
  const currentIndex = levels.indexOf(facts.currentCapabilityLevel);
  const qualifiedIndex = levels.reduce((best, level, index) => resultingScore >= rules.capabilityProgression.thresholds[level] ? index : best, 0);
  let nextIndex = currentIndex;
  if (qualifiedIndex > currentIndex) nextIndex = Math.min(currentIndex + 1, qualifiedIndex);
  if (qualifiedIndex < currentIndex && rules.capabilityProgression.allowAutomaticDemotion) nextIndex = Math.max(currentIndex - 1, qualifiedIndex);
  return {
    reputationEvents,
    resultingScore,
    skillEvidence,
    capabilityDecision: nextIndex === currentIndex ? null : {
      oldLevel: facts.currentCapabilityLevel,
      newLevel: levels[nextIndex]!,
      reason: `项目 ${facts.projectId} 完成后信誉分达到 ${resultingScore}`,
      ruleVersion: 'feedback-v1',
    },
  };
}

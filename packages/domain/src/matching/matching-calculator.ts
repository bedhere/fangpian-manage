export interface MatchingComponents { skills: number; capability: number; successRate: number; similarExperience: number; capacity: number; reputation: number }
export type MatchingWeights = MatchingComponents;
const clamp = (value: number): number => Math.min(100, Math.max(0, value));
export const calculateMatchingScore = (components: MatchingComponents, weights: MatchingWeights): number => {
  const weightTotal = Object.values(weights).reduce((total, value) => total + value, 0);
  if (weightTotal !== 100) throw new Error('MATCHING_WEIGHTS_MUST_TOTAL_100');
  const weighted = (Object.keys(components) as Array<keyof MatchingComponents>).reduce((total, key) => total + clamp(components[key]) * weights[key] / 100, 0);
  return Math.round(weighted * 100) / 100;
};
export const requiresSpecialCapabilityReview = (employeeLevel: number, requiredLevel: number): boolean => employeeLevel < requiredLevel;

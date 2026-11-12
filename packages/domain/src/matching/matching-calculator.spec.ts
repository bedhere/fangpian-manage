import { describe, expect, it } from 'vitest';
import { calculateMatchingScore, requiresSpecialCapabilityReview } from './matching-calculator.js';

describe('deterministic matching', () => {
  const weights = { skills: 40, capability: 20, successRate: 15, similarExperience: 10, capacity: 10, reputation: 5 } as const;
  it('uses the configured weighted formula', () => {
    expect(calculateMatchingScore({ skills: 100, capability: 80, successRate: 60, similarExperience: 50, capacity: 70, reputation: 90 }, weights)).toBe(81.5);
  });
  it('rejects invalid weights instead of silently changing the formula', () => {
    expect(() => calculateMatchingScore({ skills: 100, capability: 100, successRate: 100, similarExperience: 100, capacity: 100, reputation: 100 }, { ...weights, skills: 39 })).toThrow('MATCHING_WEIGHTS_MUST_TOTAL_100');
  });
  it('clamps every component to a 0-100 score', () => {
    expect(calculateMatchingScore({ skills: 120, capability: -20, successRate: 100, similarExperience: 100, capacity: 100, reputation: 100 }, weights)).toBe(80);
  });
});

describe('capability review', () => {
  it('requires special review when employee level is lower', () => expect(requiresSpecialCapabilityReview(1, 3)).toBe(true));
  it('allows higher capability employees to take lower level work', () => expect(requiresSpecialCapabilityReview(4, 2)).toBe(false));
});

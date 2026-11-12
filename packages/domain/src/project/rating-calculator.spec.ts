import { describe, expect, it } from 'vitest';
import {
  calculateFinalRating,
  requiresExecutiveConfirmation,
} from './rating-calculator.js';

const weights = {
  publisherBusiness: 30,
  departmentHeadBusiness: 30,
  aiTechnical: 10,
  ownerManagerTechnical: 10,
  projectManagement: 20,
};
const thresholds = { S: 95, A: 85, B: 70, C: 60 };

describe('final project rating', () => {
  it('calculates a configured weighted score and grade', () => {
    const result = calculateFinalRating(
      {
        publisherBusiness: 95,
        departmentHeadBusiness: 96,
        aiTechnical: 92,
        ownerManagerTechnical: 90,
        projectManagement: 97,
      },
      weights,
      thresholds,
    );

    expect(result.score).toBe(95);
    expect(result.grade).toBe('S');
  });

  it('rejects weights that do not total 100', () => {
    expect(() =>
      calculateFinalRating(
        {
          publisherBusiness: 80,
          departmentHeadBusiness: 80,
          aiTechnical: 80,
          ownerManagerTechnical: 80,
          projectManagement: 80,
        },
        { ...weights, projectManagement: 10 },
        thresholds,
      ),
    ).toThrow('RATING_WEIGHTS_MUST_TOTAL_100');
  });

  it('requires executive confirmation for S/A or configured high value', () => {
    expect(requiresExecutiveConfirmation('A', 0, 10_000)).toBe(true);
    expect(requiresExecutiveConfirmation('B', 12_000, 10_000)).toBe(true);
    expect(requiresExecutiveConfirmation('B', 9_999, 10_000)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { deliveryReviewSchema } from './delivery-review.schema.js';

describe('delivery review schema', () => {
  it('accepts structured reviewer output', () => {
    const review = deliveryReviewSchema.parse({
      businessFit: 89,
      technicalQuality: 92,
      completeness: 94,
      risk: 20,
      suggestedGrade: 'A',
      reasoningSummary: '交付覆盖验收标准且结构清晰',
      issues: [],
      recommendations: ['补充运维说明'],
    });
    expect(review.technicalQuality).toBe(92);
  });

  it('rejects free text and out-of-range scores', () => {
    expect(() => deliveryReviewSchema.parse('质量不错')).toThrow();
    expect(() =>
      deliveryReviewSchema.parse({ technicalQuality: 101 }),
    ).toThrow();
  });
});

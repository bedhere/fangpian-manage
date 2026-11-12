import { describe, expect, it } from 'vitest';
import { applyReputationEvents } from './reputation-policy.js';

describe('reputation policy', () => {
  it('applies configured event deltas and preserves the event trail', () => {
    expect(
      applyReputationEvents(100, ['GRADE_S', 'ON_TIME'], {
        GRADE_S: 5,
        ON_TIME: 2,
      }),
    ).toEqual({ score: 107, deltas: [5, 2] });
  });

  it('never produces a negative reputation score', () => {
    expect(
      applyReputationEvents(10, ['PROJECT_FAILED'], { PROJECT_FAILED: -20 }).score,
    ).toBe(0);
  });
});

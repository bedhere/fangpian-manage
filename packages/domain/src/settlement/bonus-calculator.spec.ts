import { describe, expect, it } from 'vitest';
import { allocateBonus, calculateProjectBonus } from './bonus-calculator.js';

const rule = {
  hourlyRate: '150.00',
  minHours: '2.00',
  maxHours: '80.00',
  multipliers: { S: '1.50', A: '1.20', B: '1.00', C: '0.50', FAIL: '0' },
};

describe('bonus calculator', () => {
  it('uses approved hours, configured rate and grade multiplier exactly', () => {
    expect(calculateProjectBonus('20', 'A', rule)).toEqual({
      effectiveHours: '20.00',
      baseBonus: '3000.00',
      finalBonus: '3600.00',
    });
  });

  it('caps bonus hours using the active rule', () => {
    expect(calculateProjectBonus('120', 'B', rule).effectiveHours).toBe('80.00');
  });

  it('rejects allocations that do not total exactly 100 percent', () => {
    expect(() =>
      allocateBonus('3600.00', [
        { userId: 'owner', percentage: '80' },
        { userId: 'member', percentage: '10' },
      ]),
    ).toThrow('CONTRIBUTION_PERCENTAGE_MUST_TOTAL_100');
  });

  it('allocates every cent without losing rounding remainder', () => {
    expect(
      allocateBonus('100.00', [
        { userId: 'a', percentage: '33.33' },
        { userId: 'b', percentage: '33.33' },
        { userId: 'c', percentage: '33.34' },
      ]),
    ).toEqual([
      { userId: 'a', percentage: '33.33', amount: '33.33' },
      { userId: 'b', percentage: '33.33', amount: '33.33' },
      { userId: 'c', percentage: '33.34', amount: '33.34' },
    ]);
  });
});

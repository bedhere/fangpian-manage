import { describe, expect, it } from 'vitest';
import { previousSettlementMonth } from './settlement-period.js';

describe('monthly settlement period', () => {
  it('returns the previous UTC month including year rollover', () => {
    expect(previousSettlementMonth(new Date('2027-01-01T01:00:00Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

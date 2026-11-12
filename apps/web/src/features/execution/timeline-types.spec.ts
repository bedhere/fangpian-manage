import { describe, expect, it } from 'vitest';
import { dateKey, datePosition, timelineRange } from './timeline-types';
describe('Date-based timeline geometry', () => {
  it('uses the Shanghai calendar date rather than the host timezone', () => {
    expect(dateKey('2026-10-19T16:00:00.000Z')).toBe('2026-10-20');
  });
  it('positions milestones in proportion to actual calendar intervals', () => {
    const range = timelineRange(['2026-10-01', '2026-10-11']);
    expect(datePosition('2026-10-06', range)).toBe(50);
  });
  it('handles same-day milestones without dividing by zero', () => {
    const range = timelineRange(['2026-10-01']);
    expect(Number.isFinite(datePosition('2026-10-01', range))).toBe(true);
  });
});

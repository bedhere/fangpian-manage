import { describe, expect, it } from 'vitest';
import { dateNumber } from '../execution/timeline-types';
import { ganttCalendar, ganttPeriod, shiftGanttAnchor } from './gantt-calendar';
describe('Gantt calendar', () => {
  it('includes a same-day project as one calendar day', () => {
    const {range}=ganttCalendar(dateNumber('2026-10-12'),'month');
    expect(ganttPeriod('2026-10-12','2026-10-12',range)).toMatchObject({days:1});
    expect(ganttPeriod('2026-10-12','2026-10-12',range)!.width).toBeGreaterThan(0);
  });
  it('clips visible bars and omits periods outside the displayed window', () => {
    const {range}=ganttCalendar(dateNumber('2026-10-12'),'month');
    expect(ganttPeriod('2026-09-15','2026-10-10',range)?.left).toBe(0);
    expect(ganttPeriod('2026-01-01','2026-02-01',range)).toBeNull();
    expect(ganttPeriod(null,'2026-10-10',range)).toBeNull();
  });
  it('handles a year boundary without overflowing the target month', () => {
    expect(new Date(shiftGanttAnchor(dateNumber('2026-12-31'),'month',1)).toISOString().slice(0,10)).toBe('2027-01-01');
    expect(ganttCalendar(dateNumber('2026-10-12'),'year').columns).toHaveLength(12);
  });
});

import { dateNumber, type TimelineRange } from '../execution/timeline-types';
export type GanttScale = 'week' | 'month' | 'quarter' | 'year';
const DAY = 86400000;
export function ganttCalendar(anchor: number, scale: GanttScale) {
  const start = new Date(anchor);
  if (scale === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  else { start.setUTCDate(1); if (scale === 'quarter') start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3); if (scale === 'year') start.setUTCMonth(0); }
  const end = new Date(start);
  if (scale === 'week') end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + (scale === 'month' ? 2 : scale === 'quarter' ? 3 : 12));
  const range: TimelineRange = { start: start.valueOf(), end: end.valueOf() };
  const columns: { start: number; end: number; label: string; weekend: boolean }[] = [];
  let cursor = new Date(start);
  while (cursor.valueOf() < range.end) {
    const next = new Date(cursor);
    if (scale === 'year') next.setUTCMonth(next.getUTCMonth() + 1);
    else next.setUTCDate(next.getUTCDate() + (scale === 'quarter' ? 7 : 1));
    columns.push({ start: cursor.valueOf(), end: Math.min(next.valueOf(), range.end), label: scale === 'year' ? `${cursor.getUTCMonth() + 1}月` : scale === 'quarter' ? `${cursor.getUTCMonth()+1}/${cursor.getUTCDate()}` : `${cursor.getUTCDate()} ${'日一二三四五六'[cursor.getUTCDay()]}`, weekend: scale !== 'quarter' && scale !== 'year' && [0,6].includes(cursor.getUTCDay()) });
    cursor = next;
  }
  const months: { label: string; start: number; end: number }[] = [];
  cursor = new Date(start);
  while (cursor.valueOf() < range.end) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth()+1, 1));
    months.push({ label: `${cursor.getUTCFullYear()}年${cursor.getUTCMonth()+1}月`, start: cursor.valueOf(), end: Math.min(next.valueOf(), range.end) }); cursor = next;
  }
  return { range, columns, months, width: columns.length * (scale === 'month' ? 38 : scale === 'year' ? 110 : 94) };
}
export function initialGanttAnchor(dates: string[]) { const values = dates.map(dateNumber).filter(Number.isFinite); return values.length ? Math.min(...values) : dateNumber(new Date().toISOString()); }
export function shiftGanttAnchor(anchor: number, scale: GanttScale, direction: number) { const date = new Date(anchor); if (scale === 'week') date.setUTCDate(date.getUTCDate()+7*direction); else { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth()+direction*(scale === 'year' ? 12 : scale === 'quarter' ? 3 : 1)); } return date.valueOf(); }
export function calendarPercent(value: number, range: TimelineRange) { return (value-range.start)/(range.end-range.start)*100; }
export function ganttPeriod(start: string | null | undefined, end: string | null | undefined, range: TimelineRange) {
  if (!start || !end || dateNumber(start)>dateNumber(end)) return null;
  const from = dateNumber(start), to = dateNumber(end)+DAY;
  if (to<=range.start || from>=range.end) return null;
  const left=calendarPercent(Math.max(from,range.start),range), right=calendarPercent(Math.min(to,range.end),range);
  return { left, width: right-left, days: Math.round((dateNumber(end)-from)/DAY)+1 };
}

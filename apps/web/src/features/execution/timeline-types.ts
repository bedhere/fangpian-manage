export type TimelineNode = {
  id: string; defaultKey: string | null; title: string; description: string;
  scheduledAt: string | null; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
};
export const nodeStatusLabels = { PENDING: '待开始', IN_PROGRESS: '进行中', COMPLETED: '已完成', BLOCKED: '受阻' };
export function dateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function dateNumber(value: string) { return Date.parse(`${dateKey(value)}T00:00:00Z`); }
export type TimelineRange = { start: number; end: number };
export function timelineRange(values: string[]): TimelineRange {
  const dates = values.map(dateNumber).filter(Number.isFinite);
  const today = dateNumber(new Date().toISOString());
  const start = dates.length ? Math.min(...dates) : today;
  const end = dates.length ? Math.max(...dates) : today;
  return { start, end: end === start ? start + 86400000 : end };
}
export function datePosition(value: string, range: TimelineRange) {
  return Math.max(0, Math.min(100, (dateNumber(value) - range.start) / (range.end - range.start) * 100));
}
export function rangeTicks(range: TimelineRange) {
  return Array.from({ length: 5 }, (_, index) => ({ position: index * 25, label: new Date(range.start + (range.end - range.start) * index / 4).toISOString().slice(0, 10) }));
}
export function sortNodes(nodes: TimelineNode[]) {
  return [...nodes].sort((a, b) => a.scheduledAt && b.scheduledAt ? dateNumber(a.scheduledAt) - dateNumber(b.scheduledAt) : a.scheduledAt ? -1 : b.scheduledAt ? 1 : 0);
}

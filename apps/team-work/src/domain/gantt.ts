type ScheduledTask = { id: string; parentId: string | null; startAt?: string | null; dueAt: string | null };
export function taskSpans(tasks: ScheduledTask[]) {
  const result = new Map<string, { start: number; end: number }>();
  const children = new Map<string, ScheduledTask[]>();
  for (const task of tasks) if (task.parentId) children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
  const day = (value?: string | null) => { if (!value) return null; const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); const d = plain ? new Date(+plain[1], +plain[2] - 1, +plain[3]) : new Date(value); d.setHours(0, 0, 0, 0); return Number.isFinite(d.getTime()) ? d.getTime() : null; };
  const visiting = new Set<string>();
  function walk(task: ScheduledTask): { start: number; end: number } | undefined {
    if (result.has(task.id)) return result.get(task.id);
    if (visiting.has(task.id)) return;
    visiting.add(task.id);
    const end = day(task.dueAt), start = day(task.startAt) ?? end;
    const ranges = (children.get(task.id) ?? []).map(walk).filter((r): r is { start: number; end: number } => !!r);
    if (start !== null && end !== null) ranges.push({ start: Math.min(start, end), end });
    if (ranges.length) result.set(task.id, { start: Math.min(...ranges.map(r => r.start)), end: Math.max(...ranges.map(r => r.end)) });
    visiting.delete(task.id);
    return result.get(task.id);
  }
  tasks.forEach(walk);
  return result;
}

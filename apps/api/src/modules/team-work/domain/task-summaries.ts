import type { Db, Task, TaskStatus } from './types.js';

export function syncTaskSummaries(
  d: Db,
  parents?: ReadonlySet<string>,
): number {
  const kids = new Map<string, Task[]>();
  for (const t of d.tasks) {
    if (!t.parentId || t.deletedAt) continue;
    if (!kids.has(t.parentId)) kids.set(t.parentId, []);
    kids.get(t.parentId)!.push(t);
  }
  let changed = 0;
  for (let round = 0; round < 8; round++) {
    let touched = false;
    for (const [pid, children] of kids) {
      if (parents && !parents.has(pid)) continue;
      const parent = d.tasks.find((x) => x.id === pid);
      if (!parent) continue;
      if (parent.recurrence && !parent.templateId) continue; // 周期规则不当普通任务推导
      const importedSummary = !!parent.importSource?.group;
      const conflict =
        importedSummary &&
        children.some(
          (c) =>
            c.progressConflict ||
            c.sourceStatus === '待核对' ||
            (c.status === 'done' && c.progress < 100),
        );
      const unspecified =
        importedSummary && children.some((c) => c.progressUnspecified);
      const allDone = children.every((c) => c.status === 'done') && !conflict;
      const next: TaskStatus = allDone ? 'done' : 'open';
      // 主任务的进度 = 子任务进度的平均值 (已完成的子任务按 100 算);
      // 全完成 <=> 平均 100, 所以状态和进度天然一致
      const avg = Math.round(
        children.reduce(
          (sum, c) =>
            sum +
            (!importedSummary && c.status === 'done'
              ? 100
              : Math.max(0, Math.min(100, c.progress || 0))),
          0,
        ) / children.length,
      );
      const statusChanged = parent.status !== next;
      const progressChanged = parent.progress !== avg;
      const sourceStatus = conflict
        ? '待核对'
        : unspecified
          ? '部分未填'
          : allDone
            ? '已完成'
            : '';
      const metadataChanged =
        importedSummary &&
        (parent.sourceStatus !== sourceStatus ||
          parent.progressUnspecified !== unspecified);
      if (!statusChanged && !progressChanged && !metadataChanged) continue;
      if (importedSummary) {
        parent.sourceStatus = sourceStatus;
        parent.progressUnspecified = unspecified;
      }
      if (statusChanged) {
        parent.status = next;
        parent.doneAt = next === 'done' ? new Date().toISOString() : null;
        if (next === 'done' && !parent.ownerId)
          parent.ownerId = parent.assigneeId;
      }
      parent.progress = avg;
      parent.updatedAt = new Date().toISOString();
      touched = true;
      changed++;
    }
    if (!touched) break;
  }
  return changed;
}

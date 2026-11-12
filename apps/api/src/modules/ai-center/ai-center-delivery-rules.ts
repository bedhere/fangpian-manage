import type { TaskData } from './ai-center.types.js';

export const LEGACY_SCORE_RULE = '2026-11-02-v1';
export const GROUPED_SCORE_RULE = '2026-11-03-v2';
export type ScoreRule = typeof LEGACY_SCORE_RULE | typeof GROUPED_SCORE_RULE;
export type DeliveryGroup = 'dailyIvy' | 'learning' | 'claimed';
export const deliveryGroups = [
  { key: 'dailyIvy', label: '平时任务与艾维利任务', weight: 0.5 },
  { key: 'learning', label: 'TodoList学习清单任务', weight: 0.3 },
  { key: 'claimed', label: '公开任务池抢领任务', weight: 0.2 },
] as const;

/** Original source only: attaching evidence never moves a task between groups. */
export function taskDeliveryGroup(task: TaskData): DeliveryGroup | null {
  if (task.sourceType === 'SELF' || task.sourceType === 'IVY') return 'dailyIvy';
  if (task.sourceType === 'LEARNING') return 'learning';
  if (task.sourceType !== 'AI') return null;
  const target = task.targetUserId;
  const direct = typeof target === 'string' && target.trim().length > 0;
  if (task.acquisitionMode === 'DIRECT') return direct ? 'dailyIvy' : null;
  if (task.acquisitionMode === 'CLAIMED') return target === null ? 'claimed' : null;
  if (task.acquisitionMode !== undefined) return null;
  return direct ? 'dailyIvy' : target === null ? 'claimed' : null;
}

/** A pre-existing publication, including withdrawn plans, freezes its original rule. */
export function weeklyScoreRule(week: string, publishedSnapshots: unknown[], currentlyPublished: boolean): ScoreRule {
  if (week < '2026-11-02') return LEGACY_SCORE_RULE;
  for (const snapshot of publishedSnapshots) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue;
    const s = snapshot as Record<string, unknown>;
    if (s.status !== 'PUBLISHED') continue;
    // The earliest publication determines the period's rule; later appeals cannot change it.
    return s.scoringRulesVersion === GROUPED_SCORE_RULE ? GROUPED_SCORE_RULE : LEGACY_SCORE_RULE;
  }
  return currentlyPublished ? LEGACY_SCORE_RULE : GROUPED_SCORE_RULE;
}

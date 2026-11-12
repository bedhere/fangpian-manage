import { describe, expect, it } from 'vitest';
import { getNavigationGroups, getNavigationItems } from '@/components/app-shell/navigation';
import { isTraineeOnly, shanghaiToday, traineeDestination } from './access';
describe('管培生导航与日期', () => {
  it('limits a TRAINEE-only identity even when stale permissions are present', () => {
    const context = { roles: ['TRAINEE'], permissions: ['analytics:executive'] };
    expect(getNavigationGroups(context).map(x => x.href)).toEqual(['/ai-center', '/trainees', '/leaderboards']);
    expect(getNavigationItems(context).map(x => x.href)).toEqual(['/trainees', '/leaderboards']);
    expect(isTraineeOnly(['TRAINEE', 'EMPLOYEE'])).toBe(false);
    expect(isTraineeOnly([])).toBe(false);
  });
  it('keeps employee collaboration and adds the trainee sibling', () => {
    const groups = getNavigationGroups({ roles: ['EMPLOYEE'], permissions: [] });
    expect(groups.find(x => x.id === 'collab')?.items.map(x => x.href)).toEqual(['/tasks', '/trainees', '/knowledge', '/circles', '/buffs']);
  });
  it('uses Beijing day and routes by actual roles while retaining password and project guards', () => {
    expect(shanghaiToday(new Date('2026-10-28T18:00:00Z'))).toBe('2026-10-29');
    expect(traineeDestination(['TRAINEE'], '/projects/p1')).toBe('/ai-center');
    expect(traineeDestination(['EMPLOYEE'], '/projects/p1')).toBe('/projects/p1');
  });
});


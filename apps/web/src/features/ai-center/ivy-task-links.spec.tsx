import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IvyTab } from './ivy';
import { AutomaticIvyTasks } from './ivy-task-links';
import type { IvyTaskEntry, Workspace } from './types';
vi.mock('./record-tools', () => ({ RecordTools: () => null }));
const entry: IvyTaskEntry = { taskId: '00000000-0000-4000-8000-000000000001', title: '已批准的业务工具', status: 'DOING', taskStatus: 'SUBMITTED', priority: 'P1', progress: 100, dueAt: null };
function workspace(extra: Partial<Workspace> = {}): Workspace {
  return { serverDate: '2026-11-04', week: '2026-11-02', user: { id: 'owner', name: '管培生', isTrainee: true }, ivy: [], tasks: [], people: [],
    ivyTasksEnabledFrom: '2026-11-04', ivyTaskDays: [{ ownerId: 'owner', ownerName: '管培生', dateKey: '2026-11-04', entries: [entry] }], ...extra } as Workspace;
}
describe('automatic diary task links (offline)', () => {
  it('renders a task link without converting 100% personal progress to completion', () => {
    render(<AutomaticIvyTasks entries={[entry]} />);
    expect(screen.getByRole('link', { name: entry.title })).toHaveAttribute('href', `/ai-center/records/${entry.taskId}`);
    expect(screen.getByText('待导师验收')).toBeVisible();
    expect(screen.getByLabelText('进行中')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('does not submit an automatic-only diary and preserves the manual save payload', () => {
    const mutate = vi.fn();
    render(<IvyTab data={workspace()} busy={false} mutate={mutate} />);
    expect(screen.getByRole('button', { name: '保存当日日报' })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '增加今日事项' }));
    fireEvent.change(screen.getByLabelText('事项内容'), { target: { value: '补充自己的复盘' } });
    fireEvent.click(screen.getByRole('button', { name: '保存当日日报' }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toBe('/ivy');
    const body = mutate.mock.calls[0][1];
    expect(body.today).toHaveLength(1); expect(body.today[0].text).toBe('补充自己的复盘');
    expect(body.tomorrow).toEqual([]); expect(body.ivyTaskDays).toBeUndefined();
  });
  it('shows automatic-only historical days as unsubmitted, with no review action', () => {
    render(<IvyTab data={workspace({ ivyTaskDays: [{ ownerId: 'owner', ownerName: '管培生', dateKey: '2026-11-03', entries: [entry] }] })} busy={false} mutate={vi.fn()} />);
    expect(screen.getByText('未提交手填日报')).toBeVisible();
    expect(screen.queryByRole('button', { name: /评价|评分/ })).toBeNull();
  });
  it('keeps the old editor compatible with workspaces lacking automatic task fields', () => {
    render(<IvyTab data={workspace({ ivyTaskDays: undefined, ivyTasksEnabledFrom: undefined })} busy={false} mutate={vi.fn()} />);
    expect(screen.getByRole('button', { name: '增加今日事项' })).toBeVisible();
    expect(screen.queryByLabelText('自动关联任务')).toBeNull();
  });
});

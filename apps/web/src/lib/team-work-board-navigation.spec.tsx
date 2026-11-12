import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardView } from '../../../team-work/src/views/BoardView';

const { state } = vi.hoisted(() => ({ state: {
  view: 'all', setView: vi.fn(), user: { id: 'boss', role: 'admin', groupIds: [], departmentId: null, prefs: {} },
  org: { users: [], groups: [], departments: [] }, tasks: [] as any[], summary: { overdue: 1, dueToday: 1 },
  savePrefs: vi.fn(), updateTask: vi.fn(), pushToast: vi.fn(),
} }));
vi.mock('../../../team-work/src/store/AppProvider', () => ({ useApp: () => state }));

function task(id: string, parentId: string | null = null, dueAt: string | null = null) {
  return { id, title: id, parentId, dueAt, note: '', status: 'open', progress: 0, scope: 'user', ownerId: 'employee',
    assigneeId: 'employee', creatorId: 'importer', departmentId: null, createdAt: new Date().toISOString(), priority: 'normal', category: '', type: '' };
}
function fixture() {
  state.tasks = [
    { ...task('跨部门项目'), importSource: { sha256: 'sheet', group: '项目' } },
    task('已逾期的执行步骤', '跨部门项目', '2020-01-01T23:59:59+08:00'),
    task('尚未到期的执行步骤', '跨部门项目', '2099-01-01T23:59:59+08:00'),
    task('今日执行步骤', null, new Date().toISOString()),
  ];
}
describe('boss task navigation', () => {
  it('names the priority column and sorting with P-level terminology',()=>{
    render(<BoardView/>);expect(screen.getByText('优先级',{exact:true})).toBeVisible();expect(screen.queryByText('重要度',{exact:true})).toBeNull();
  });
  it('collapses overview and filters while preserving the active search and task content',()=>{
    render(<BoardView/>);
    fireEvent.change(screen.getByPlaceholderText('搜索任务'),{target:{value:'已逾期的执行步骤'}});
    fireEvent.click(screen.getByRole('button',{name:'收起概览'}));
    expect(screen.getByRole('button',{name:'展开概览'})).toHaveAttribute('aria-expanded','false');
    expect(screen.getByText('已逾期的执行步骤')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'收起筛选条件'}));
    expect(screen.getByRole('button',{name:'展开筛选条件'})).toHaveAttribute('aria-expanded','false');
    fireEvent.click(screen.getByRole('button',{name:'展开筛选条件'}));
    expect(screen.getByPlaceholderText('搜索任务')).toHaveValue('已逾期的执行步骤');
  });
  beforeEach(() => { vi.clearAllMocks(); localStorage.removeItem('team.board.overviewExpanded'); localStorage.removeItem('team.board.filtersExpanded'); state.view = 'all'; state.user.role = 'admin'; state.user.prefs = {}; fixture(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('expands other employees tasks in the all-tasks view and can collapse them again', () => {
    render(<BoardView />);
    expect(screen.getByText('已逾期的执行步骤')).toBeVisible();
    const toggle = screen.getByRole('button', { name: '展开/收起子任务' });
    fireEvent.click(toggle);
    expect(screen.queryByText('已逾期的执行步骤')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('已逾期的执行步骤')).toBeVisible();
  });
  it('opens overdue work from an empty personal view, clears old search and expands matching steps only', () => {
    state.view = 'mine';
    const page = render(<BoardView />);
    fireEvent.change(screen.getByPlaceholderText('搜索任务'), { target: { value: '不存在的关键词' } });
    const card = screen.getByRole('button', { name: /逾期任务/ });
    expect(card).toBeEnabled();
    fireEvent.click(card);
    expect(state.setView).toHaveBeenLastCalledWith('all');
    state.view = 'all'; page.rerender(<BoardView />);
    expect(screen.getByPlaceholderText('搜索任务')).toHaveValue('');
    expect(screen.getByText('跨部门项目')).toBeVisible();
    expect(screen.getByText('已逾期的执行步骤')).toBeVisible();
    expect(screen.queryByText('尚未到期的执行步骤')).toBeNull();
    expect(screen.queryByText('今日执行步骤')).toBeNull();
    expect(card).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /全部待办/ }));
    expect(screen.getByText('尚未到期的执行步骤')).toBeVisible();
  });
  it('opens todays work without including completed or overdue work', () => {
    state.tasks.push({ ...task('今天已完成', null, new Date().toISOString()), status: 'done', progress: 100 });
    render(<BoardView />);
    const card = screen.getByRole('button', { name: /今日到期/ });
    expect(card).toBeEnabled(); fireEvent.click(card);
    expect(screen.getByText('今日执行步骤')).toBeVisible();
    expect(screen.queryByText('已逾期的执行步骤')).toBeNull();
    expect(screen.queryByText('今天已完成')).toBeNull();
  });
  it('keeps nonmatching sibling tasks out of the department overview when filtering overdue work', () => {
    state.view = 'dept';
    state.tasks = state.tasks.map(t => ({ ...t, scope: 'dept' }));
    render(<BoardView />);
    fireEvent.click(screen.getByRole('button', { name: '已逾期' }));
    expect(screen.getByText('已逾期的执行步骤')).toBeVisible();
    expect(screen.queryByText('尚未到期的执行步骤')).toBeNull();
  });
  it('keeps the same overdue filter when switching from the list to the gantt chart', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T12:00:00+08:00'));
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    state.tasks[1].dueAt = '2026-10-20T23:59:59+08:00';
    state.tasks[2].dueAt = '2026-10-25T23:59:59+08:00';
    render(<BoardView />);
    fireEvent.click(screen.getByRole('button', { name: /逾期任务/ }));
    fireEvent.click(screen.getByRole('button', { name: '甘特' }));
    expect(screen.getByRole('button', { name: '查看任务：已逾期的执行步骤' })).toBeVisible();
    expect(screen.queryByText('尚未到期的执行步骤')).toBeNull();
  });
  it('opens overdue work within the existing visible scope for a regular member', () => {
    state.user.role = 'member'; state.view = 'mine';
    render(<BoardView />);
    fireEvent.click(screen.getByRole('button', { name: /逾期任务/ }));
    expect(state.setView).toHaveBeenLastCalledWith('dept');
  });
  it('shows colleagues completed steps under their summary in the completed view', () => {
    state.view = 'done';
    state.tasks.push({ ...task('已完成的同事任务', '跨部门项目'), status: 'done', progress: 100 });
    render(<BoardView />);
    expect(screen.getByText('已完成的同事任务')).toBeVisible();
    expect(screen.queryByText('尚未到期的执行步骤')).toBeNull();
  });
});

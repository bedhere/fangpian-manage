import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelingLeaderboardPage } from './labeling-page';
import { apiClient } from '@/lib/api';
import { useSessionStore } from '@/stores/session-store';
import type { LabelingBoard } from './types';

vi.mock('@/lib/api', () => ({ apiClient: { request: vi.fn() } }));
const request = vi.mocked(apiClient.request);
const person = { traineeId: 'a', displayName: '张三', departmentName: 'AI中台', count: 200, rank: 1, reportedDays: 1, isSelf: true, updatedAt: null };
const board: LabelingBoard = { from: '2026-11-01', to: '2026-11-01', timeZone: 'Asia/Shanghai', canManage: false, summary: { totalCount: 200, participants: 1, traineeCount: 1 }, rows: [person] };
beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore.setState({ accessToken: 'test', identity: { id: 'viewer', displayName: '普通员工', roles: ['EMPLOYEE'], permissions: [] } });
  request.mockResolvedValue(board);
});

describe('labeling leaderboard page', () => {
  it('shows totals and personal rank to ordinary members without maintenance controls', async () => {
    render(<LabelingLeaderboardPage />); await screen.findByText('张三');
    expect(screen.getByText('（我）')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('200');
    expect(screen.queryByRole('button', { name: '录入数量' })).not.toBeInTheDocument();
  });
  it('sends selected inclusive date filters and rejects an incomplete or reversed range', async () => {
    render(<LabelingLeaderboardPage />); await screen.findByText('张三');
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-11-03' } });
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/leaderboards/labeling?from=2026-11-01&to=2026-11-03', expect.objectContaining({ signal: expect.any(AbortSignal) })));
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-11-04' } });
    expect(screen.getByRole('alert')).toHaveTextContent('开始日期不能晚于结束日期'); expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '' } }); expect(screen.getByRole('alert')).toHaveTextContent('请选择完整日期范围');
  });
  it('explains missing data without inventing a rank or treating missing entries as recorded zero', async () => {
    request.mockResolvedValue({ ...board, summary: { totalCount: 0, participants: 0, traineeCount: 1 }, rows: [{ ...person, count: 0, rank: null, reportedDays: 0 }] });
    render(<LabelingLeaderboardPage />); await screen.findByText(/所选日期暂无打标签记录/); expect(screen.getByRole('table')).toHaveTextContent('未录入');
  });
  it('loads the existing daily version and saves a replacement total through the manager form', async () => {
    request.mockImplementation(async (path) => path.includes('/daily?') ? { date: '2026-11-01', rows: [{ traineeId: 'a', displayName: '张三', entry: { traineeId: 'a', workDate: '2026-11-01', count: 200, version: 3, source: 'API', note: '', updatedAt: '' } }] } : { ...board, canManage: true });
    render(<LabelingLeaderboardPage />); fireEvent.click(await screen.findByRole('button', { name: '录入数量' }));
    const form = await screen.findByRole('form', { name: '打标签数量录入' });
    expect(within(form).getByLabelText('当日完成总数')).toHaveValue(200); expect(form).toHaveTextContent('接口导入');
    fireEvent.change(within(form).getByLabelText('当日完成总数'), { target: { value: '250' } }); fireEvent.submit(form);
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/leaderboards/labeling/entries', expect.objectContaining({ method: 'PUT', body: expect.stringContaining('"version":3') })));
    const write = request.mock.calls.find(([path]) => path === '/api/leaderboards/labeling/entries')!;
    expect(JSON.parse(String(write[1]?.body))).toMatchObject({ traineeId: 'a', count: 250, version: 3 });
    await screen.findByText('完成数量已保存，排行榜已更新');
  });
  it('preserves the entered number when a stale write fails', async () => {
    request.mockImplementation(async path => {
      if (path.endsWith('/entries')) throw Object.assign(new Error('数量已被更新'), { status: 409 });
      if (path.includes('/daily?')) return { date: '2026-11-01', rows: [{ traineeId: 'a', displayName: '张三', entry: null }] };
      return { ...board, canManage: true };
    });
    render(<LabelingLeaderboardPage />); fireEvent.click(await screen.findByRole('button', { name: '录入数量' }));
    const form = await screen.findByRole('form', { name: '打标签数量录入' });
    fireEvent.change(within(form).getByLabelText('当日完成总数'), { target: { value: '250' } }); fireEvent.submit(form);
    await screen.findByText(/数量已被更新/); expect(screen.getByLabelText('当日完成总数')).toHaveValue(250);
  });
  it('clears prior account data immediately on account switch', async () => {
    render(<LabelingLeaderboardPage />); await screen.findByText('张三');
    request.mockReturnValue(new Promise(() => {}));
    act(() => useSessionStore.setState({ identity: { id: 'next', displayName: '新成员', roles: ['TRAINEE'], permissions: [] } }));
    expect(screen.queryByText('张三')).not.toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('正在读取排行榜');
  });
});

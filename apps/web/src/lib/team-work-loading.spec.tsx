import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from '../../../team-work/src/store/AppProvider';
import { api } from '../../../team-work/src/api/client';

vi.mock('../../../team-work/src/api/client', () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() }, getToken: () => 'parent-session', setToken: vi.fn(), getServerUrl: () => '', setServerUrl: vi.fn(), ApiError: class extends Error {} }));
vi.mock('../../../team-work/src/notify', () => ({ isDesktopShell: () => false, notify: vi.fn(), requestNotifyPermission: vi.fn() }));
const snapshot = { user: { id: 'me', name: 'Me', role: 'member', groupIds: [], prefs: {} }, org: { users: [], departments: [], groups: [] }, tasks: [{ id: 'one', title: '真实任务' }], generated: 0, summary: { total: 1 }, memos: [], ivy: [] };
function Board() {
  const state = useApp();
  return <div>{state.ready ? `${state.user?.name}: ${state.tasks[0]?.title}` : '加载中'}<button onClick={() => void state.refresh()}>刷新</button>{state.connectionError}</div>;
}
describe('team board startup', () => {
  beforeEach(() => vi.clearAllMocks());
  it('loads a single authenticated snapshot even when development effects run twice', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<StrictMode><AppProvider><Board /></AppProvider></StrictMode>);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/api/tasks/snapshot');
    await act(async () => resolve(snapshot));
    expect(screen.getByText('Me: 真实任务')).toBeVisible();
  });
  it('fetches fresh data after a refresh instead of retaining a stale startup response', async () => {
    vi.mocked(api.get).mockResolvedValue(snapshot);
    render(<AppProvider><Board /></AppProvider>);
    await screen.findByText('Me: 真实任务');
    vi.mocked(api.get).mockResolvedValue({ ...snapshot, tasks: [{ id: 'one', title: '更新的任务' }] });
    fireEvent.click(screen.getByText('刷新'));
    await waitFor(() => expect(screen.getByText('Me: 更新的任务')).toBeVisible());
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

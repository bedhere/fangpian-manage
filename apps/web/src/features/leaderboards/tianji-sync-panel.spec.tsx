import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api';
import { TianjiSyncPanel } from './tianji-sync-panel';
vi.mock('@/lib/api', () => ({ apiClient: { request: vi.fn() } }));
const request = vi.mocked(apiClient.request);
function show(from = '2026-11-01', to = '2026-11-02') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TianjiSyncPanel identityId="member" from={from} to={to} rangeError="" /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); request.mockResolvedValue({ authenticated: false, configured: true, latestJob: null }); });
describe('personal Tianji capture controls', () => {
  it('prompts AI members to connect their own account and handles blocked popups', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    show(); await screen.findByText(/尚未授权或授权已失效/);
    expect(screen.getByRole('button', { name: '抓取所选日期数据' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '授权我的天玑账号' })); await screen.findByText(/授权窗口被浏览器拦截/);
    expect(request.mock.calls.some(([path]) => path.endsWith('/login/start'))).toBe(false); open.mockRestore();
  });
  it('starts a server job for selected dates using the current session', async () => {
    request.mockImplementation(async path => path.endsWith('/sync') || path.includes('/jobs/') ? { id: 'job', from: '2026-11-01', to: '2026-11-02', status: 'RUNNING', processed: 0, message: '后台抓取中', result: null } : { authenticated: true, configured: true, name: '本人', latestJob: null });
    show(); await screen.findByText('已授权：本人'); fireEvent.click(screen.getByRole('button', { name: '抓取所选日期数据' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/leaderboards/labeling/tianji/sync', expect.objectContaining({ method: 'POST', body: JSON.stringify({ from: '2026-11-01', to: '2026-11-02' }) })));
  });
  it('prevents unsupported long or future collection ranges', async () => {
    request.mockResolvedValue({ authenticated: true, configured: true, name: '本人', latestJob: null });
    show('2026-01-01', '2026-03-01'); await screen.findByText('已授权：本人');
    expect(screen.getByRole('button', { name: '抓取所选日期数据' })).toBeDisabled(); expect(screen.getByRole('alert')).toHaveTextContent('每次抓取最多31天');
  });
  it('shows only the AI scope and capture summary without historical unrelated-person lists', async () => {
    const completed = { id: 'old-job', from: '2026-11-09', to: '2026-11-10', status: 'SUCCEEDED', processed: 25270, message: '抓取完成：7位管培生', result: { skippedNames: ['其他部门人员'] } };
    request.mockImplementation(async path => path.includes('/jobs/') ? completed : { authenticated: true, configured: true, name: '本人', latestJob: completed });
    show(); await screen.findByText('抓取完成：7位管培生');
    expect(screen.getByText(/仅同步AI中台管培生/)).toBeInTheDocument();
    expect(screen.queryByText(/其他部门人员|未匹配人员/)).not.toBeInTheDocument();
  });
});

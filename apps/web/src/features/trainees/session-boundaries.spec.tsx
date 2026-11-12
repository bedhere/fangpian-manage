import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/page';
import ChangePasswordPage from '@/app/change-password/page';
import { SiteChrome } from '@/components/app-shell/site-chrome';
import { AppShell } from '@/components/app-shell/app-shell';
import { useSessionStore } from '@/stores/session-store';
import { apiClient } from '@/lib/api';
const { push, replace, path } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), path: { value: '/register' } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => path.value }));
vi.mock('@/lib/api', () => ({ apiClient: { request: vi.fn() } }));
vi.mock('@/components/motion/page-motion', () => ({ BlurText: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
const request = vi.mocked(apiClient.request);
beforeEach(() => { vi.clearAllMocks(); path.value = '/register'; useSessionStore.getState().clearSession(); history.replaceState(null, '', '/?account=real999&next=%2Fprojects%2Fp1'); request.mockResolvedValue({ roles: ['TRAINEE'], email: 'real@accounts.invalid', username: 'real999' }); });
describe('管培生会话边界', () => {
  it('renders registration standalone without bootstrap or menus from an old session', () => {
    useSessionStore.setState({ identity: { id: 'old', displayName: '旧老板', roles: ['OWNER'], permissions: [] } });
    render(<SiteChrome>注册内容</SiteChrome>);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument(); expect(request).not.toHaveBeenCalled();
  });
  it('withholds employee destinations until the current identity is known', () => {
    path.value = '/trainees'; request.mockReturnValueOnce(new Promise(() => {}));
    render(<SiteChrome>工作区</SiteChrome>);
    expect(screen.queryByRole('link', { name: /^工作台$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '当前用户' }));
    expect(screen.queryByRole('menuitem', { name: '示例公司有限公司画像' })).not.toBeInTheDocument();
    path.value = '/register';
  });
  it.each([false, true])('prefills server account, drops old identity and routes by actual role (password required %s)', async mustChangePassword => {
    useSessionStore.setState({ identity: { id: 'old', displayName: '旧老板', roles: ['OWNER'], permissions: [] } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ accessToken: 'new', mustChangePassword })));
    render(<LoginPage />); expect(screen.getByLabelText('账号或邮箱')).toHaveValue('real999');
    fireEvent.change(screen.getByLabelText('密码', { exact: true }), { target: { value: 'DEMO_ONLY_ChangeMe_2026!' } });
    fireEvent.click(screen.getByRole('button', { name: '进入工作台' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(mustChangePassword ? '/change-password?next=%2Fprojects%2Fp1' : '/trainees'));
    expect(useSessionStore.getState().identity).toBeNull(); vi.unstubAllGlobals();
  });
  it('routes trainees to their workspace after mandatory password change', async () => {
    render(<ChangePasswordPage />); await screen.findByText('当前账号：real999');
    for (const [label, value] of [['当前密码', 'DEMO_ONLY_ChangeMe_2026!'], ['新密码（至少 10 位）', 'secure-new123'], ['再次输入新密码', 'secure-new123']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    request.mockResolvedValueOnce({ accessToken: 'changed' });
    fireEvent.click(screen.getByRole('button', { name: '保存密码并进入工作台' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/trainees'));
  });
  it('provides a minimal trainee menu without notifications or employee destinations', async () => {
    useSessionStore.setState({ accessToken: 'trainee', identity: { id: 't', displayName: '学员', roles: ['TRAINEE'], permissions: [] } });
    render(<AppShell roles={['TRAINEE']} permissions={[]} displayName="学员">工作区</AppShell>);
    fireEvent.click(screen.getByRole('button', { name: '当前用户' }));
    expect(screen.queryByRole('button', { name: '通知' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '示例公司有限公司画像' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '修改密码' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回管培生入驻' })).toHaveAttribute('href', '/trainees');
    expect(request).not.toHaveBeenCalled();
  });
});

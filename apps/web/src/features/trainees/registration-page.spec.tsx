import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationPage } from './registration-page';
import { apiClient } from '@/lib/api';
vi.mock('@/lib/api', () => ({ apiClient: { request: vi.fn() } }));
const request = vi.mocked(apiClient.request);
beforeEach(() => { request.mockReset(); request.mockResolvedValue({ registrationAvailable: true, mentors: [{ id: 'm1', displayName: '王老师', departmentName: '业务部' }] }); });
describe('公开管培生注册', () => {
  it('requires a real name, permits no mentor and displays the server account', async () => {
    render(<RegistrationPage />);
    await screen.findByRole('button', { name: '注册管培生账号' });
    expect(screen.getByLabelText('真实姓名')).toBeRequired();
    fireEvent.submit(screen.getByRole('form', { name: '管培生注册' }));
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValueOnce({ username: 'zhangsan9992', displayName: '张三', mustChangePassword: true });
    fireEvent.change(screen.getByLabelText('真实姓名'), { target: { value: ' 张三 ' } });
    fireEvent.click(screen.getByRole('button', { name: '注册管培生账号' }));
    await screen.findByText('zhangsan9992');
    expect(request).toHaveBeenLastCalledWith('/api/auth/register', expect.objectContaining({ body: JSON.stringify({ displayName: '张三' }) }));
    expect(screen.getByText('DEMO_ONLY_ChangeMe_2026!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入登录' })).toHaveAttribute('href', '/?account=zhangsan9992');
    expect(screen.getByText(/首次登录必须修改密码/)).toBeInTheDocument();
  });
  it('preserves input and selected mentor after a failed submission', async () => {
    render(<RegistrationPage />); await screen.findByRole('option', { name: '王老师 · 业务部' });
    fireEvent.change(screen.getByLabelText('真实姓名'), { target: { value: '张三' } });
    fireEvent.change(screen.getByLabelText('带教导师（选填）'), { target: { value: 'm1' } });
    request.mockRejectedValueOnce(new Error('请求过于频繁，请稍后重试'));
    fireEvent.click(screen.getByRole('button', { name: '注册管培生账号' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('请求过于频繁');
    expect(screen.getByLabelText('真实姓名')).toHaveValue('张三');
    expect(screen.getByLabelText('带教导师（选填）')).toHaveValue('m1');
  });
  it('blocks unavailable registration and allows retrying an options failure', async () => {
    request.mockRejectedValueOnce(new Error('选项无法加载'));
    render(<RegistrationPage />); expect(await screen.findByRole('alert')).toHaveTextContent('选项无法加载');
    request.mockResolvedValueOnce({ registrationAvailable: false, mentors: [] });
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await screen.findByText('当前暂未开放注册，请联系管理员。');
    expect(screen.getByRole('button', { name: '注册管培生账号' })).toBeDisabled();
  });
  it('blocks duplicate submissions while creation is pending', async () => {
    render(<RegistrationPage />); await screen.findByRole('option', { name: '王老师 · 业务部' });
    fireEvent.change(screen.getByLabelText('真实姓名'), { target: { value: '张三' } });
    let resolve!: (value: unknown) => void;
    request.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const form = screen.getByRole('form', { name: '管培生注册' });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: '注册管培生账号' })).toBeDisabled();
    resolve({ username: 'server999', displayName: '张三', mustChangePassword: true });
    await screen.findByText('server999');
  });
});

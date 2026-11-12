import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessView } from './access-view';

describe('AccessView confirmations', () => {
  it('renders role membership and real permission choices', async () => {
    sessionStorage.setItem('valueflow_admin_token', 'token');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'r1', code: 'EMPLOYEE', name: '员工', status: 'ACTIVE', isSystem: true, permissions: [{ permission: { id: 'p1', code: 'project:read', description: null } }], _count: { users: 20 } }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'p1', code: 'project:read', description: null }] }));
    render(<AccessView />);
    expect(await screen.findByText('员工')).toBeInTheDocument();
    expect(screen.getAllByLabelText('project:read')[1]).toBeChecked();
    expect(screen.getByText(/20 名成员/)).toBeInTheDocument();
    expect(screen.getByText('创建角色')).toBeInTheDocument();
  });
  it('shares an in-flight gate between role status and permission changes', async () => {
    sessionStorage.setItem('valueflow_admin_token', 'test-token');
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'r1', code: 'OPS', name: '运营角色', status: 'ACTIVE', isSystem: false, permissions: [], _count: { users: 1 } }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', request);
    render(<AccessView />);
    const status = await screen.findByRole('slider', { name: '滑动停用角色' });
    fireEvent.change(screen.getByPlaceholderText('变更原因（审计必填）'), { target: { value: '调整权限范围' } });
    fireEvent.keyDown(status, { key: 'End' });
    const permissions = screen.getByRole('slider', { name: '滑动保存权限' });
    expect(permissions).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(permissions, { key: 'End' });
    expect(request).toHaveBeenCalledTimes(3);
  });
});

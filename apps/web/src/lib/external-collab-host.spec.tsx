import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '@/app/external-collab/page';
import { ApiError } from './api-client';
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiClient: api }));
beforeEach(() => { api.request.mockReset(); });
describe('external collaboration host', () => {
  it('installs the authenticated request listener before loading the child application', () => {
    const order: string[] = [];
    const listen = window.addEventListener.bind(window);
    const attribute = Element.prototype.setAttribute;
    const listenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((...args) => {
      if (args[0] === 'message') order.push('listener');
      return listen(...args);
    });
    const attributeSpy = vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (this: Element, name, value) {
      if (this.tagName === 'IFRAME' && name === 'src' && value === '/external-collab-app/index.html') order.push('child');
      return attribute.call(this, name, value);
    });
    try {
      render(<Page />);
      expect(order).toContain('child');
      expect(order.indexOf('listener')).toBeLessThan(order.indexOf('child'));
    } finally { listenerSpy.mockRestore(); attributeSpy.mockRestore(); }
  });
  it('authenticates allowlisted child requests through the parent and returns their data', async () => {
    api.request.mockResolvedValue({ authenticated: false, configured: false });
    render(<Page />);
    const frame = screen.getByTitle('方片 · 商务部门协作') as HTMLIFrameElement;
    const response = vi.spyOn(frame.contentWindow!, 'postMessage');
    const data = { type: 'external-collab:request', id: 'r-1', method: 'GET', path: '/api/tianji/login/session' };
    fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: location.origin, data }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('/api/external-collab/tianji/login/session', { method: 'GET', headers: undefined, body: undefined }));
    await waitFor(() => expect(response).toHaveBeenCalledWith({ type: 'external-collab:response', id: 'r-1', status: 200, data: { authenticated: false, configured: false } }, location.origin));
  });
  it('ignores foreign windows, foreign origins, and unrelated API paths', () => {
    render(<Page />);
    const frame = screen.getByTitle('方片 · 商务部门协作') as HTMLIFrameElement;
    const data = { type: 'external-collab:request', id: 'r-1', method: 'GET', path: '/api/dashboard/targets' };
    for (const event of [new MessageEvent('message', { origin: 'https://evil.test', source: frame.contentWindow, data }), new MessageEvent('message', { origin: location.origin, source: window, data }), new MessageEvent('message', { origin: location.origin, source: frame.contentWindow, data: { ...data, path: '/api/auth/me' } })]) fireEvent(window, event);
    expect(api.request).not.toHaveBeenCalled();
  });
  it('offers a safe platform login return after the authenticated proxy rejects a session', async () => {
    api.request.mockRejectedValue(new ApiError('请登录', 401));
    render(<Page />);
    const frame = screen.getByTitle('方片 · 商务部门协作') as HTMLIFrameElement;
    fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: location.origin, data: { type: 'external-collab:request', id: 'r-2', method: 'GET', path: '/api/tianji/login/session' } }));
    expect(await screen.findByRole('link', { name: '登录并继续' })).toHaveAttribute('href', '/?next=%2Fexternal-collab');
  });
  it('preserves the Fangpian session when only the Tianji identity has expired', async () => {
    api.request.mockRejectedValue(new ApiError('请重新验证本人的天玑身份', 403, { code: 'TIANJI_AUTH_REQUIRED', message: '请重新验证本人的天玑身份' }));
    render(<Page />);
    const frame = screen.getByTitle('方片 · 商务部门协作') as HTMLIFrameElement;
    const response = vi.spyOn(frame.contentWindow!, 'postMessage');
    fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: location.origin, data: { type: 'external-collab:request', id: 'expired', method: 'GET', path: '/api/dashboard/targets' } }));
    await waitFor(() => expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 403, data: expect.objectContaining({ code: 'TIANJI_AUTH_REQUIRED' }) }), location.origin));
    expect(screen.queryByRole('link', { name: '登录并继续' })).toBeNull();
    expect(screen.getByTitle('方片 · 商务部门协作')).toBeInTheDocument();
  });
});

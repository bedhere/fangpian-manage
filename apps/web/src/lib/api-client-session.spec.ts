import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './api-client';

const jwt = (sub: string, seconds = 900) => `e30.${btoa(JSON.stringify({ sub, exp: Math.floor(Date.示例公司有限公司() / 1000) + seconds })).replace(/=/g, '')}.signature`;
function setup(initial: string | null, fetchImpl: typeof fetch) {
  let token = initial;
  const onUnauthorized = vi.fn();
  const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: () => token, setAccessToken: value => { token = value; }, fetchImpl, onUnauthorized });
  return { client, onUnauthorized, token: () => token };
}
describe('session recovery without business retries (offline)', () => {
  it('refreshes an expired token before a non-retryable write', async () => {
    const fresh = jwt('a');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ accessToken: fresh })).mockResolvedValueOnce(Response.json({ saved: true }));
    const f = setup(jwt('a', -1), fetchImpl);
    await expect(f.client.request('/api/ai-center/notes', { method: 'POST', body: '{}' }, false)).resolves.toEqual({ saved: true });
    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual(['https://api.test/api/auth/refresh', 'https://api.test/api/ai-center/notes']);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ authorization: `Bearer ${fresh}` });
  });
  it('restores a reload with no in-memory token before dispatching business data', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ accessToken: jwt('a') })).mockResolvedValueOnce(Response.json({ ok: true }));
    const f = setup(null, fetchImpl);
    await f.client.request('/api/ai-center/workspace', {}, false);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.test/api/auth/refresh');
  });
  it('does not lose a session or submit a write on temporary refresh failures', async () => {
    const old = jwt('a', -1);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const f = setup(old, fetchImpl);
    await expect(f.client.request('/api/ai-center/notes', { method: 'POST' }, false)).rejects.toMatchObject({ status: 503 });
    expect(f.token()).toBe(old); expect(f.onUnauthorized).not.toHaveBeenCalled(); expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not refresh or replay a wrong current password', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: '当前密码错误' }, { status: 401 }));
    const f = setup(jwt('a'), fetchImpl);
    await expect(f.client.request('/api/auth/change-password', { method: 'POST' })).rejects.toMatchObject({ status: 401, message: '当前密码错误' });
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(f.onUnauthorized).not.toHaveBeenCalled();
  });
  it('coalesces parallel preflights into one refresh', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async url => String(url).endsWith('/refresh') ? Response.json({ accessToken: jwt('a') }) : Response.json({ ok: true }));
    const f = setup(jwt('a', -1), fetchImpl);
    await Promise.all([f.client.request('/api/one', {}, false), f.client.request('/api/two', {}, false)]);
    expect(fetchImpl.mock.calls.filter(call => String(call[0]).endsWith('/refresh'))).toHaveLength(1);
  });
  it('does not replay a business 401 even when ordinary auth recovery is enabled', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: '天玑身份授权已失效' }, { status: 401 }));
    const f = setup(jwt('a'), fetchImpl);
    await expect(f.client.request('/api/external-collab/proxy', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(f.onUnauthorized).not.toHaveBeenCalled();
  });
  it('refuses to dispatch the old form after a different account owns the cookie', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ accessToken: jwt('b') }));
    const f = setup(jwt('a', -1), fetchImpl);
    await expect(f.client.request('/api/ai-center/notes', { method: 'POST' }, false)).rejects.toMatchObject({ status: 409 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('reports a concurrent refresh without an automatic retry or logout', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 'REFRESH_IN_PROGRESS' }, { status: 409 }));
    const f = setup(jwt('a', -1), fetchImpl);
    await expect(f.client.request('/api/one', {}, false)).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(1); expect(f.onUnauthorized).not.toHaveBeenCalled();
  });
  it('keeps public registration options independent from session recovery', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ options: [] }));
    const f = setup(null, fetchImpl);
    await f.client.request('/api/auth/registration-options');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.test/api/auth/registration-options');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not send an old form after login changes while waiting for the refresh lock', async () => {
    let token: string | null = jwt('a', -1);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fetchImpl = vi.fn<typeof fetch>();
    const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: () => token, setAccessToken: value => { token = value; }, fetchImpl, withRefreshLock: async operation => { await gate; return operation(); } });
    const result = client.request('/api/ai-center/notes', { method: 'POST' }, false);
    token = jwt('b'); release();
    await expect(result).rejects.toMatchObject({ status: 409 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('does not revive a logged-out session when a refresh completes late', async () => {
    let token: string | null = jwt('a', -1);
    let complete!: (response: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(resolve => { complete = resolve; }));
    const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: () => token, setAccessToken: value => { token = value; }, fetchImpl });
    const result = client.request('/api/ai-center/notes', { method: 'POST' }, false);
    token = null; complete(Response.json({ accessToken: jwt('a') }));
    await expect(result).rejects.toMatchObject({ status: 409 });
    expect(token).toBeNull(); expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not clear a new login when an old non-retryable request returns a late guard 401', async () => {
    let token: string | null = jwt('a');
    let complete!: (response: Response) => void;
    let dispatched!: () => void;
    const ready = new Promise<void>(resolve => { dispatched = resolve; });
    const fetchImpl = vi.fn<typeof fetch>(() => { dispatched(); return new Promise(done => { complete = done; }); });
    const onUnauthorized = vi.fn();
    const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: () => token, setAccessToken: value => { token = value; }, fetchImpl, onUnauthorized });
    const result = client.request('/api/ai-center/notes', { method: 'POST' }, false);
    await ready;
    const next = jwt('b'); token = next;
    complete(Response.json({ code: 'SESSION_UNAUTHORIZED' }, { status: 401 }));
    await expect(result).rejects.toMatchObject({ status: 409 });
    expect(token).toBe(next); expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

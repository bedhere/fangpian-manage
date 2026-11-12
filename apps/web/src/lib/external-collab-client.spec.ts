import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExternalCollabFetch, encodeExternalCollabBody } from '../../../external-collab/client/src/fangpian-bridge';

const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach((dispose) => dispose()); });
function fixture() {
  const parent = { postMessage: vi.fn() };
  const handlers = new Map<string, EventListener>();
  const native = vi.fn().mockResolvedValue(new Response('{}'));
  const dispatchEvent = vi.fn();
  const host = { location: { origin: 'https://fp.test', href: 'https://fp.test/external-collab-app/index.html' }, parent, crypto, setTimeout, clearTimeout, dispatchEvent,
    addEventListener: (name: string, handler: EventListener) => handlers.set(name, handler), removeEventListener: (name: string) => handlers.delete(name) } as unknown as Window;
  const bridge = createExternalCollabFetch(host, native);
  disposers.push(bridge.dispose);
  return { bridge, parent, native, dispatchEvent, reply: (data: unknown, source: unknown = parent, origin = 'https://fp.test') => handlers.get('message')?.({ data, source, origin } as unknown as Event) };
}
describe('embedded collaboration fetch transport', () => {
  it('normalizes original relative endpoints and only accepts matching parent responses', async () => {
    const f = fixture();
    const result = f.bridge.fetch('api/dashboard/targets?employeeName=%E7%8E%8B');
    await vi.waitFor(() => expect(f.parent.postMessage).toHaveBeenCalled());
    const sent = f.parent.postMessage.mock.calls[0][0];
    expect(sent.path).toBe('/api/dashboard/targets?employeeName=%E7%8E%8B');
    expect(sent).not.toHaveProperty('headers');
    let finished = false;
    void result.then(() => { finished = true; });
    f.reply({ type: 'external-collab:response', id: sent.id, status: 200, data: { wrong: true } }, {}, 'https://fp.test');
    f.reply({ type: 'external-collab:response', id: sent.id, status: 200, data: { wrong: true } }, f.parent, 'https://evil.test');
    await Promise.resolve();
    expect(finished).toBe(false);
    f.reply({ type: 'external-collab:response', id: sent.id, status: 403, data: { message: '无权限' } });
    expect((await result).status).toBe(403);
    expect(await (await result).json()).toEqual({ message: '无权限' });
    expect(f.native).not.toHaveBeenCalled();
  });
  it('keeps external presigned uploads on the browser native fetch', async () => {
    const f = fixture();
    const body = new File(['abc'], 'a.png', { type: 'image/png' });
    await f.bridge.fetch('https://storage.test/upload?signed=1', { method: 'PUT', body });
    expect(f.native).toHaveBeenCalledWith('https://storage.test/upload?signed=1', { method: 'PUT', body });
    expect(f.parent.postMessage).not.toHaveBeenCalled();
  });
  it('encodes binary uploads without discarding text fields', async () => {
    const form = new FormData();
    form.append('monthId', '150');
    form.append('file', new File([new Uint8Array([1, 2, 3])], '目标.xlsx', { type: 'application/octet-stream' }));
    expect(await encodeExternalCollabBody(form)).toEqual({ __externalCollabMultipart: true, entries: [{ name: 'monthId', value: '150' }, { name: 'file', file: { name: '目标.xlsx', type: 'application/octet-stream', dataBase64: 'AQID' } }] });
  });
  it('cancels pending requests through AbortSignal', async () => {
    const f = fixture();
    const controller = new AbortController();
    const result = f.bridge.fetch('/api/dashboard/targets', { signal: controller.signal });
    await vi.waitFor(() => expect(f.parent.postMessage).toHaveBeenCalled());
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('distinguishes Tianji expiry, ends pending business work, and keeps login RPC available', async () => {
    const f = fixture();
    const result = f.bridge.fetch('/api/dashboard/targets');
    const pendingJob = f.bridge.fetch('/api/jobs/job_pending');
    await vi.waitFor(() => expect(f.parent.postMessage).toHaveBeenCalledTimes(2));
    const first = f.parent.postMessage.mock.calls[0][0];
    f.reply({ type: 'external-collab:response', id: first.id, status: 403, data: { code: 'TIANJI_AUTH_REQUIRED', message: '请重新验证本人的天玑身份' } });
    expect((await result).status).toBe(403);
    expect((await pendingJob).status).toBe(403);
    expect(f.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'external-collab:tianji-auth-required' }));
    expect((await f.bridge.fetch('/api/dashboard/targets')).status).toBe(403);
    expect(f.parent.postMessage).toHaveBeenCalledTimes(2);
    const login = f.bridge.fetch('/api/tianji/login/start', { method: 'POST', body: '{}' });
    await vi.waitFor(() => expect(f.parent.postMessage).toHaveBeenCalledTimes(3));
    const start = f.parent.postMessage.mock.calls[2][0];
    f.reply({ type: 'external-collab:response', id: start.id, status: 200, data: { consentUrl: 'https://identity.test' } });
    expect((await login).status).toBe(200);
  });
});

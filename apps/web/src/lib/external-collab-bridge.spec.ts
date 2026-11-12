import { describe, expect, it } from 'vitest';
import { externalCollabProxyPath, isExternalCollabRequest, trustedExternalCollabMessage, validateExternalCollabBody } from './external-collab-bridge';

const request = (path: string, method = 'GET', body?: unknown) => ({ type: 'external-collab:request', id: 'job-1', method, path, body });
describe('external collaboration RPC boundary', () => {
  it('accepts business endpoints, encoded Chinese filters, uploads, and original PUT saves', () => {
    for (const value of [request('/api/dashboard/targets?employeeName=%E7%8E%8B%E7%8E%A5'), request('/api/jobs/job_123_abcd'), request('/api/tianji/login/start', 'POST', {}), request('/api/dashboard/target-split-plan', 'PUT', { plan: {} })]) expect(isExternalCollabRequest(value)).toBe(true);
    expect(externalCollabProxyPath('/api/dashboard/targets?a=1')).toBe('/api/external-collab/dashboard/targets?a=1');
  });
  it('preserves the original Xu Muyuan plan GET and PUT aliases', () => {
    expect(isExternalCollabRequest(request('/api/dashboard/muyuan-target-split-plan?monthId=150'))).toBe(true);
    expect(isExternalCollabRequest(request('/api/dashboard/muyuan-target-split-plan', 'PUT', { monthId: 150, plan: {} }))).toBe(true);
  });
  it('rejects methods not published on each endpoint rather than relying on the API to reject them', () => {
    for (const [method, path] of [['POST', '/api/dashboard/targets'], ['DELETE', '/api/dashboard/metric-targets'], ['PUT', '/api/tianji/login/start'], ['POST', '/api/tianji/login/session'], ['POST', '/api/jobs/job_123_abcd']]) expect(isExternalCollabRequest(request(path, method))).toBe(false);
  });
  it('rejects escape paths, auth endpoints, invalid methods, malformed ids and oversized bodies', () => {
    for (const path of ['//evil.test/api/dashboard/targets', '/api/auth/me', '/api/dashboard/../auth/me', '/api/dashboard/%2e%2e/auth', '/api/dashboard/%252e%252e/auth', '/api/dashboard/targets#x', '/api/dashboard/targets\\x', '/api/dashboard/not-an-endpoint', '/api/tianji/login/callback/extra']) expect(isExternalCollabRequest(request(path))).toBe(false);
    expect(isExternalCollabRequest(request('/api/dashboard/targets', 'TRACE'))).toBe(false);
    expect(isExternalCollabRequest({ ...request('/api/dashboard/targets'), id: '' })).toBe(false);
    expect(isExternalCollabRequest(request('/api/dashboard/target-split-plan', 'PUT', { data: 'x'.repeat(14 * 1024 * 1024) }))).toBe(false);
  });
  it('requires both the exact origin and active child window', () => {
    const frame = {} as Window;
    expect(trustedExternalCollabMessage({ origin: 'https://fangpian.test', source: frame }, frame, 'https://fangpian.test')).toBe(true);
    expect(trustedExternalCollabMessage({ origin: 'https://evil.test', source: frame }, frame, 'https://fangpian.test')).toBe(false);
    expect(trustedExternalCollabMessage({ origin: 'https://fangpian.test', source: {} }, frame, 'https://fangpian.test')).toBe(false);
  });
  it('preserves file and text envelopes and rejects malformed multipart envelopes', async () => {
    const envelope = { __externalCollabMultipart: true, entries: [{ name: 'monthId', value: '150' }, { name: 'file', file: { name: '目标.xlsx', type: 'application/octet-stream', dataBase64: 'AQID' } }] };
    expect(validateExternalCollabBody(envelope)).toBe(true);
    expect(validateExternalCollabBody({ __externalCollabMultipart: true, entries: [{ name: 'file', file: { name: 'x', type: '', dataBase64: '***' } }] })).toBe(false);
  });
  it('retains the original 9 MiB image upload capacity after base64 encoding', () => {
    const envelope = { __externalCollabMultipart: true, entries: [{ name: 'file', file: { name: 'image.png', type: 'image/png', dataBase64: 'AAAA'.repeat(3 * 1024 * 1024) } }] };
    expect(validateExternalCollabBody(envelope)).toBe(true);
  });
});



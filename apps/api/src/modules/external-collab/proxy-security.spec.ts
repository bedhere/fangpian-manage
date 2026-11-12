import { describe, expect, it } from 'vitest';
import { allowedExternalRoute, signExternalRequest, unpackMultipart } from './proxy-security.js';

describe('external collaboration boundary', () => {
  it('only proxies original business routes and their declared methods', () => {
    expect(allowedExternalRoute('GET', 'dashboard/targets?monthId=149')).toBe(true);
    expect(allowedExternalRoute('PUT', 'dashboard/target-split-plan')).toBe(true);
    expect(allowedExternalRoute('POST', 'tianji/login/callback')).toBe(true);
    for (const path of ['../auth/login', 'dashboard/%2e%2e/auth', '//evil.test', 'jobs/a/b', 'studio-tasks/a/run-示例公司有限公司', 'example/notes'])
      expect(allowedExternalRoute('GET', path)).toBe(false);
    expect(allowedExternalRoute('DELETE', 'dashboard/targets')).toBe(false);
    expect(allowedExternalRoute('POST', 'dashboard/targets')).toBe(false);
  });
  it('signs the exact actor, route, body and expiry, without a client credential', () => {
    const actor = { userId: 'u', organizationId: 'o', displayName: '张三' };
    const one = signExternalRequest('secret', actor, 'POST', '/api/dashboard/sync', 'digest', 1000, 'nonce');
    const two = signExternalRequest('secret', actor, 'POST', '/api/dashboard/sync', 'different', 1000, 'nonce');
    expect(one.signature).not.toBe(two.signature);
    expect(JSON.parse(Buffer.from(one.claim, 'base64url').toString())).toMatchObject({ actor, method: 'POST', path: '/api/dashboard/sync', digest: 'digest', issuedAt: 1000, nonce: 'nonce' });
  });
  it('rejects malformed multipart and decodes a bounded file', () => {
    const parsed = unpackMultipart({ __externalCollabMultipart: true, entries: [{ name: 'ownerName', value: '张三' }, { name: 'file', file: { name: 'input.xlsx', type: 'application/octet-stream', dataBase64: 'YWJj' } }] });
    expect(parsed?.get('ownerName')).toBe('张三');
    expect((parsed?.get('file') as File).size).toBe(3);
    expect(() => unpackMultipart({ __externalCollabMultipart: true, entries: [{ name: 'file', file: { name: '../x', type: 'a', dataBase64: '!*' } }] })).toThrow();
  });
  it('accepts a complete 9 MiB file without overflowing the regexp stack', () => {
    const dataBase64 = Buffer.alloc(9 * 1024 * 1024, 97).toString('base64');
    const result = unpackMultipart({ __externalCollabMultipart: true, entries: [{ name: 'ownerName', value: '示例对客16' }, { name: 'file', file: { name: 'max.png', type: 'image/png', dataBase64 } }] });
    expect((result?.get('file') as File).size).toBe(9 * 1024 * 1024);
  });
  it('bounds textual upload metadata separately to 64 KiB', () => {
    const envelope = (value: string) => ({ __externalCollabMultipart: true, entries: [{ name: 'text', value }] });
    expect((unpackMultipart(envelope('a'.repeat(64 * 1024)))?.get('text') as string).length).toBe(64 * 1024);
    expect(() => unpackMultipart(envelope('a'.repeat(64 * 1024 + 1)))).toThrow();
  });
  it('rejects noncanonical base64 padding and nonzero pad bits', () => {
    for (const dataBase64 of ['YQ=', 'Y=Q=', 'YR==', 'YWJ=', 'YWJj====']) {
      expect(() => unpackMultipart({ __externalCollabMultipart: true, entries: [{ name: 'file', file: { name: 'x', type: 'a', dataBase64 } }] })).toThrow();
    }
  });
});

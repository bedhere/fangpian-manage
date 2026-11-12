import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
import * as argon2 from 'argon2';

function context(path: string, method = 'GET') {
  return { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer access' }, path, method }) }) } as never;
}

describe('mandatory first password change', () => {
  it('blocks business APIs while allowing identity and password change', async () => {
    const guard = new JwtAuthGuard({ getAllAndOverride: () => false } as never, { authenticate: async () => ({ mustChangePassword: true }) } as never);
    await expect(guard.canActivate(context('/api/workspace/bootstrap'))).rejects.toMatchObject({ status: 403 });
    await expect(guard.canActivate(context('/api/users/me'))).resolves.toBe(true);
    await expect(guard.canActivate(context('/api/auth/change-password', 'POST'))).resolves.toBe(true);
    await expect(guard.canActivate(context('/api/users/me', 'POST'))).rejects.toMatchObject({ status: 403 });
  });

  it('invalidates access tokens from before a password change', async () => {
    const service = new AuthService({ user: { findUnique: async () => ({ status: 'ACTIVE', tokenVersion: 1, roles: [] }) } } as never, { verifyAsync: async () => ({ sub: 'user', type: 'access', tokenVersion: 0 }) } as never);
    await expect(service.authenticate('old-access')).rejects.toMatchObject({ status: 401 });
  });

  it('accepts a username and reports first-login status', async () => {
    const passwordHash = await argon2.hash('DEMO_ONLY_ChangeMe_2026!');
    const findFirst = vi.fn().mockResolvedValue({ id: 'user', organizationId: 'org', email: 'user@accounts.invalid', username: 'ljh999', passwordHash, mustChangePassword: true, tokenVersion: 0, roles: [] });
    const service = new AuthService({ user: { findFirst }, refreshToken: { create: vi.fn() } } as never, { signAsync: async () => 'token' } as never);
    const pair = await service.login({ email: ' LJH999 ', password: 'DEMO_ONLY_ChangeMe_2026!' });
    expect(findFirst.mock.calls[0][0].where.OR).toContainEqual({ username: 'ljh999' });
    expect(pair).toMatchObject({ mustChangePassword: true });
  });
});

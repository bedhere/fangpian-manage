import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
function context(path: string, method = 'GET') {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: 'Bearer access' },
        path,
        method,
      }),
    }),
  } as never;
}
describe('registered TRAINEE-only account isolation', () => {
  it('cannot inherit broad permissions from an accidentally configured TRAINEE role', async () => {
    const user = {
      id: 't',
      organizationId: 'org',
      email: 't@accounts.invalid',
      status: 'ACTIVE',
      roles: [
        {
          role: {
            code: 'TRAINEE',
            permissions: [{ permission: { code: 'analytics:executive' } }],
          },
        },
      ],
    };
    const service = new AuthService(
      { user: { findUnique: async () => user } } as never,
      { verifyAsync: async () => ({ sub: 't', type: 'access' }) } as never,
    );
    expect((await service.authenticate('access')).permissions).toEqual([]);
  });
  it.each([
    '/api/team-work',
    '/api/team-work/snapshot',
    '/api/analytics',
    '/api/circles',
    '/api/opportunities',
    '/api/knowledge-assets',
    '/api/projects',
    '/api/personal-projects',
    '/api/trainees-other',
    '/api/leaderboards/labeling/daily',
    '/api/leaderboards/labeling-other',
  ])(
    'rejects unrelated business API %s after password change',
    async (path) => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        {
          authenticate: async () => ({
            roles: ['TRAINEE'],
            mustChangePassword: false,
          }),
        } as never,
      );
      await expect(guard.canActivate(context(path))).rejects.toMatchObject({
        status: 403,
      });
    },
  );
  it.each([
    ['/api/trainees', 'GET'],
    ['/api/leaderboards/labeling', 'GET'],
    ['/api/trainees/submissions', 'POST'],
    ['/api/trainees/enroll', 'POST'],
    ['/api/users/me', 'GET'],
    ['/api/workspace/bootstrap', 'GET'],
    ['/api/auth/change-password', 'POST'],
  ])('allows required API %s %s', async (path, method) => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: () => false } as never,
      {
        authenticate: async () => ({
          roles: ['TRAINEE'],
          mustChangePassword: false,
        }),
      } as never,
    );
    await expect(guard.canActivate(context(path, method))).resolves.toBe(true);
  });
  it('preserves ordinary employee behavior including when also enrolled as trainee', async () => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: () => false } as never,
      {
        authenticate: async () => ({
          roles: ['TRAINEE', 'EMPLOYEE'],
          mustChangePassword: false,
        }),
      } as never,
    );
    await expect(guard.canActivate(context('/api/team-work'))).resolves.toBe(
      true,
    );
  });
});

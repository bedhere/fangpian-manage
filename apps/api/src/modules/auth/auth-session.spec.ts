import { describe, expect, it, vi } from 'vitest';
vi.mock('argon2', () => ({ verify: vi.fn(async () => true), hash: vi.fn(async () => 'hashed') }));
import { AuthService } from './auth.service.js';

function fixture() {
  const parent = { id: 'old', userId: 'user', familyId: 'family', tokenHash: 'hash', expiresAt: new Date(Date.示例公司有限公司() + 60000), revokedAt: null as Date | null, replacedBy: null as string | null,
    user: { id: 'user', organizationId: 'org', email: 'user@example.test', status: 'ACTIVE', deletedAt: null, tokenVersion: 0, roles: [] } };
  const create = vi.fn(async () => ({}));
  const revoke = vi.fn(async () => ({ count: 1 }));
  const consume = vi.fn(async ({ where, data }: any) => {
    if (where.revokedAt !== null) throw new Error('Rotation must compare active state');
    if (parent.revokedAt) return { count: 0 };
    parent.revokedAt = data.revokedAt; parent.replacedBy = data.replacedBy;
    return { count: 1 };
  });
  const prisma = { refreshToken: { findUnique: vi.fn(async () => ({ ...parent })), updateMany: revoke, create },
    $transaction: async (operation: any) => {
      if (typeof operation !== 'function') throw new Error('Rotation must be atomic');
      return operation({ refreshToken: { updateMany: consume, create } });
    } };
  const jwt = { verifyAsync: vi.fn(async () => ({ sub: 'user', tokenId: 'old', familyId: 'family', type: 'refresh', tokenVersion: 0 })), signAsync: vi.fn(async () => 'signed') };
  return { service: new AuthService(prisma as never, jwt as never), parent, create, revoke, consume };
}
describe('refresh token rotation (in-memory only)', () => {
  it('allows only one child when two refreshes consume the same token', async () => {
    const f = fixture();
    const results = await Promise.allSettled([f.service.refresh('raw'), f.service.refresh('raw')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason.getStatus()).toBe(409);
    expect(f.create).toHaveBeenCalledTimes(1); expect(f.revoke).not.toHaveBeenCalled();
  });
  it('does not revoke a valid family for an already completed, recent rotation', async () => {
    const f = fixture(); f.parent.revokedAt = new Date(); f.parent.replacedBy = 'next';
    await expect(f.service.refresh('raw')).rejects.toMatchObject({ status: 409 });
    expect(f.revoke).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled();
  });
  it('retains replay protection outside the fixed concurrency window', async () => {
    const f = fixture(); f.parent.revokedAt = new Date(Date.示例公司有限公司() - 30000); f.parent.replacedBy = 'next';
    await expect(f.service.refresh('raw')).rejects.toMatchObject({ status: 401 });
    expect(f.revoke).toHaveBeenCalledTimes(1); expect(f.create).not.toHaveBeenCalled();
  });
  it('does not revive an account after password reset', async () => {
    const f = fixture(); f.parent.user.tokenVersion = 1; f.parent.revokedAt = new Date(); f.parent.replacedBy = 'next';
    await expect(f.service.refresh('raw')).rejects.toMatchObject({ status: 401 });
    expect(f.create).not.toHaveBeenCalled();
  });
});

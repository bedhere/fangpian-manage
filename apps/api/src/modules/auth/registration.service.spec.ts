import { afterEach, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { RegistrationService } from './registration.service.js';

function fixture() {
  const db: any = {
    organization: {
      findMany: vi.fn().mockResolvedValue([{ id: 'org' }]),
      findFirst: vi.fn().mockResolvedValue({ id: 'org' }),
    },
    role: { upsert: vi.fn().mockResolvedValue({ id: 'trainee-role' }) },
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'mentor', displayName: '导师', department: { name: '业务' } },
        ]),
      findFirst: vi.fn().mockResolvedValue({ id: 'mentor' }),
      create: vi.fn().mockImplementation(async ({ data }: any) => data),
    },
  };
  db.$transaction = vi.fn(async (fn: any) => fn(db));
  return { db, service: new RegistrationService(db) };
}
afterEach(() => vi.unstubAllEnvs());
describe('public trainee registration', () => {
  it.each(['', '   ', '!!!'])(
    'rejects empty/unsafe real name %j',
    async (displayName) => {
      const { service, db } = fixture();
      await expect(service.register({ displayName })).rejects.toMatchObject({
        status: 400,
      });
      expect(db.user.create).not.toHaveBeenCalled();
    },
  );
  it('creates full pinyin username, only TRAINEE, both profiles and Argon2 first-login password', async () => {
    const { service, db } = fixture();
    expect(await service.register({ displayName: '张三' })).toEqual({
      username: 'zhangsan999',
      displayName: '张三',
      mustChangePassword: true,
    });
    const data = db.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org',
      mustChangePassword: true,
      roles: { create: { roleId: 'trainee-role' } },
      profile: { create: {} },
      traineeProfile: { create: { organizationId: 'org', mentorId: null } },
    });
    expect(await argon2.verify(data.passwordHash, 'DEMO_ONLY_ChangeMe_2026!')).toBe(true);
    expect(db.role.upsert.mock.calls[0][0].create.code).toBe('TRAINEE');
  });
  it('normalizes non-Chinese name and retries username unique collision without changing existing users', async () => {
    const { service, db } = fixture();
    db.user.create.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['username'] },
    });
    expect(
      (await service.register({ displayName: 'Alice Smith' })).username,
    ).toBe('alicesmith9992');
    expect(db.user.create).toHaveBeenCalledTimes(2);
  });
  it('rejects a cross-organization or ineligible mentor', async () => {
    const { service, db } = fixture();
    db.user.findFirst.mockResolvedValue(null);
    await expect(
      service.register({ displayName: '张三', mentorId: 'foreign' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('rejects full pinyin exceeding the login limit without creating a user', async () => {
    const { service, db } = fixture();
    await expect(
      service.register({ displayName: '庄'.repeat(42) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('preserves the full pinyin when the first candidate is exactly 254 characters', async () => {
    const { service } = fixture();
    const result = await service.register({
      displayName: '庄'.repeat(41) + '张',
    });
    expect(result.username).toBe('zhuang'.repeat(41) + 'zhang999');
    expect(result.username).toHaveLength(254);
  });
  it('stops before creating an overlength collision candidate at the login limit', async () => {
    const { service, db } = fixture();
    db.user.create.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['username'] },
    });
    await expect(
      service.register({ displayName: '庄'.repeat(41) + '张' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.user.create).toHaveBeenCalledTimes(1);
    expect(db.user.create.mock.calls[0][0].data.username).toHaveLength(254);
  });
  it('permits a 254-character collision suffix but rejects its longer successor', async () => {
    const { service, db } = fixture();
    db.user.create.mockRejectedValueOnce({
      code: 'P2002',
      meta: { target: ['username'] },
    });
    const result = await service.register({
      displayName: '庄'.repeat(41) + '王',
    });
    expect(result.username).toBe('zhuang'.repeat(41) + 'wang9992');
    expect(result.username).toHaveLength(254);

    const exhausted = fixture();
    exhausted.db.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['username'] },
    });
    await expect(
      exhausted.service.register({ displayName: '庄'.repeat(41) + '王' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(exhausted.db.user.create).toHaveBeenCalledTimes(9);
    for (const [input] of exhausted.db.user.create.mock.calls)
      expect(input.data.username.length).toBeLessThanOrEqual(254);
  });
  it('returns safe mentor fields scoped to the configured organization', async () => {
    vi.stubEnv('PUBLIC_REGISTRATION_ORG_ID', 'org');
    const { service, db } = fixture();
    expect(await service.options()).toEqual({
      registrationAvailable: true,
      mentors: [{ id: 'mentor', displayName: '导师', departmentName: '业务' }],
    });
    expect(db.user.findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org',
      status: 'ACTIVE',
      deletedAt: null,
      roles: { some: { role: { code: { not: 'TRAINEE' } } } },
    });
    expect(db.user.findMany.mock.calls[0][0].select).not.toHaveProperty(
      'email',
    );
  });
  it('disables registration in ambiguous organizations and refuses to pick the first', async () => {
    vi.stubEnv('PUBLIC_REGISTRATION_ORG_ID', '');
    const { service, db } = fixture();
    db.organization.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    expect(await service.options()).toEqual({
      registrationAvailable: false,
      mentors: [],
    });
    await expect(
      service.register({ displayName: '张三' }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { TraineeService } from './trainee.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

const 示例公司有限公司 = new Date('2026-10-29T08:00:00Z');
const actor = (id = 'self', organizationId = 'org', roles: string[] = []) => ({
  id,
  organizationId,
  roles,
  email: '',
  permissions: [],
});
const roleEntry = (
  code: string,
  status = 'ACTIVE',
  organizationId = 'org',
) => ({
  role: { code, status, organizationId },
});
const person = (mentorId: string | null = 'mentor') => ({
  userId: 'self',
  organizationId: 'org',
  mentorId,
  user: {
    id: 'self',
    displayName: '学生',
    username: 'student999',
    organizationId: 'org',
    status: 'ACTIVE',
    deletedAt: null,
  },
  mentor: mentorId
    ? {
        id: mentorId,
        organizationId: 'org',
        status: 'ACTIVE',
        deletedAt: null,
        displayName: '导师',
        username: 'mentor999',
        roles: [roleEntry('EMPLOYEE')],
        managerId: 'manager',
        manager: {
          id: 'manager',
          displayName: '上级',
          username: 'manager999',
          organizationId: 'org',
          status: 'ACTIVE',
          deletedAt: null,
        },
      }
    : null,
});
function fixture(id = 'self', roles: string[] = []) {
  const profile = person();
  const submission = {
    id: 'submission',
    traineeId: 'self',
    organizationId: 'org',
    departmentId: 'dept',
    workDate: 示例公司有限公司,
    title: '标题',
    problem: '问题',
    solution: '方案',
    expectedValue: null,
    status: 'DRAFT',
    version: 1,
    createdAt: 示例公司有限公司,
    updatedAt: 示例公司有限公司,
    trainee: profile,
    department: { name: '业务' },
    reviews: [],
  };
  const db: any = {
    user: {
      findFirst: vi.fn().mockResolvedValue({
        id,
        organizationId: 'org',
        status: 'ACTIVE',
        roles: roles.map((code) => roleEntry(code)),
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    department: {
      findFirst: vi.fn().mockResolvedValue({ id: 'dept' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'dept', name: '业务' }]),
    },
    traineeProfile: {
      findFirst: vi.fn().mockResolvedValue(profile),
      findMany: vi.fn().mockResolvedValue([profile]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(profile),
    },
    traineeSubmission: {
      findFirst: vi.fn().mockResolvedValue(submission),
      findMany: vi.fn().mockResolvedValue([submission]),
      create: vi.fn().mockResolvedValue(submission),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    traineeReview: { create: vi.fn() },
  };
  db.$transaction = vi.fn(async (fn: any) => fn(db));
  return {
    db,
    profile,
    submission,
    service: new TraineeService(db),
    actor: actor(id, 'org', roles),
  };
}
const input = {
  title: '标题',
  departmentId: 'dept',
  workDate: '2026-10-29',
  problem: '问题',
  solution: '方案',
  submit: true,
};
describe('trainee authorization and workflow', () => {
  it.each([
    ['roles removed', []],
    ['role inactive', [roleEntry('EMPLOYEE', 'INACTIVE')]],
    ['role archived', [roleEntry('EMPLOYEE', 'ARCHIVED')]],
    ['downgraded to trainee only', [roleEntry('TRAINEE')]],
    [
      'non-trainee role belongs to another organization',
      [roleEntry('EMPLOYEE', 'ACTIVE', 'foreign')],
    ],
    [
      'inactive employee plus active trainee',
      [roleEntry('EMPLOYEE', 'INACTIVE'), roleEntry('TRAINEE')],
    ],
  ])(
    'revokes mentor and manager access immediately when %s',
    async (_reason, roles) => {
      const f = fixture('mentor');
      f.submission.status = 'SUBMITTED';
      const date = { from: '2026-10-29', to: '2026-10-29' };
      expect(
        (await f.service.workspace(actor('mentor'), date)).submissions,
      ).toHaveLength(1);
      expect(
        f.db.traineeProfile.findMany.mock.calls[0][0].include.mentor.select
          .roles,
      ).toEqual({
        select: {
          role: { select: { organizationId: true, status: true, code: true } },
        },
      });
      expect(
        (await f.service.workspace(actor('manager'), date)).submissions,
      ).toHaveLength(1);
      f.profile.mentor!.roles = roles as ReturnType<typeof roleEntry>[];
      for (const id of ['mentor', 'manager']) {
        const workspace = await f.service.workspace(actor(id), date);
        expect(workspace.trainees).toHaveLength(0);
        expect(workspace.submissions).toHaveLength(0);
      }
      await expect(
        f.service.review(actor('mentor'), 'submission', {
          version: 1,
          decision: 'APPROVED',
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(f.db.traineeSubmission.updateMany).not.toHaveBeenCalled();
      expect(f.db.traineeReview.create).not.toHaveBeenCalled();
      const selfWorkspace = await f.service.workspace(actor('self'), date);
      expect(selfWorkspace.submissions).toHaveLength(1);
      expect(selfWorkspace.selfProfile).toMatchObject({
        mentorId: null,
        mentorName: null,
        mentorManagerName: null,
      });
      f.db.user.findFirst.mockResolvedValue({
        id: 'boss',
        roles: [roleEntry('OWNER')],
      });
      const bossWorkspace = await f.service.workspace(actor('boss'), date);
      expect(bossWorkspace.submissions).toHaveLength(1);
      expect(bossWorkspace.canManageMentors).toBe(true);
      expect(bossWorkspace.trainees[0]).toMatchObject({
        mentorId: null,
        canReview: false,
      });
      expect(
        await f.service.assignMentor(actor('boss'), 'self', {
          mentorId: 'replacement',
        }),
      ).toEqual({ userId: 'self', mentorId: 'replacement' });
    },
  );
  it('keeps mentor rights when an active same-organization employee role remains alongside TRAINEE', async () => {
    const f = fixture('mentor');
    f.submission.status = 'SUBMITTED';
    f.profile.mentor!.roles = [roleEntry('TRAINEE'), roleEntry('EMPLOYEE')];
    const workspace = await f.service.workspace(f.actor, {
      from: '2026-10-29',
      to: '2026-10-29',
    });
    expect(workspace.submissions[0].canReview).toBe(true);
    await f.service.review(f.actor, 'submission', {
      version: 1,
      decision: 'APPROVED',
    });
    expect(f.db.traineeReview.create).toHaveBeenCalledTimes(1);
    expect(
      f.db.traineeSubmission.updateMany.mock.calls[0][0].where.trainee,
    ).toMatchObject({
      mentorId: 'mentor',
      mentor: {
        organizationId: 'org',
        status: 'ACTIVE',
        deletedAt: null,
        roles: {
          some: {
            role: {
              organizationId: 'org',
              status: 'ACTIVE',
              code: { not: 'TRAINEE' },
            },
          },
        },
      },
    });
  });
  it('keeps both reviews across rejection, private draft revision, resubmission and approval', async () => {
    const f = fixture();
    f.submission.status = 'SUBMITTED';
    f.db.traineeSubmission.updateMany.mockImplementation(
      async ({ where, data }: any) => {
        if (
          where.version !== f.submission.version ||
          !where.status.in.includes(f.submission.status)
        )
          return { count: 0 };
        const { version, ...values } = data;
        Object.assign(f.submission, values, {
          version: f.submission.version + version.increment,
        });
        return { count: 1 };
      },
    );
    f.db.traineeReview.create.mockImplementation(async ({ data }: any) => {
      (f.submission.reviews as any[]).push({
        ...data,
        id: `review-${data.version}`,
        reviewer: { displayName: '导师' },
        createdAt: 示例公司有限公司,
      });
    });
    const rejected = await f.service.review(actor('mentor'), 'submission', {
      version: 1,
      decision: 'REJECTED',
      comment: '补充量化指标',
    });
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      version: 2,
      history: [{ version: 2, decision: 'REJECTED' }],
    });
    const draft = await f.service.update(f.actor, 'submission', {
      version: 2,
      solution: '补充量化方案',
    });
    expect(draft).toMatchObject({ status: 'DRAFT', version: 3 });
    const mentorWorkspace = await f.service.workspace(actor('mentor'), {
      from: '2026-10-29',
      to: '2026-10-29',
    });
    expect(mentorWorkspace.submissions).toHaveLength(0);
    const submitted = await f.service.submit(f.actor, 'submission', {
      version: 3,
    });
    expect(submitted).toMatchObject({ status: 'SUBMITTED', version: 4 });
    const approved = await f.service.review(actor('mentor'), 'submission', {
      version: 4,
      decision: 'APPROVED',
    });
    expect(approved).toMatchObject({ status: 'APPROVED', version: 5 });
    expect(approved.history.map((r: any) => [r.decision, r.version])).toEqual([
      ['REJECTED', 2],
      ['APPROVED', 5],
    ]);
    await expect(
      f.service.review(actor('mentor'), 'submission', {
        version: 4,
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(approved.history).toHaveLength(2);
  });
  it('does not leak rows or counts outside selected person, date or status', async () => {
    const f = fixture('mentor');
    f.submission.status = 'SUBMITTED';
    expect(
      (
        await f.service.workspace(f.actor, {
          from: '2026-10-30',
          to: '2026-10-30',
        })
      ).trainees[0].counts.total,
    ).toBe(0);
    expect(
      (
        await f.service.workspace(f.actor, {
          from: '2026-10-29',
          to: '2026-10-29',
          status: 'APPROVED',
        })
      ).submissions,
    ).toHaveLength(0);
    expect(
      (
        await f.service.workspace(f.actor, {
          from: '2026-10-29',
          to: '2026-10-29',
          traineeId: 'stranger',
        })
      ).submissions,
    ).toHaveLength(0);
  });
  it('keeps submitted historical work visible to boss after a trainee account is suspended', async () => {
    const f = fixture('boss', ['OWNER']);
    f.profile.user.status = 'SUSPENDED';
    f.submission.status = 'APPROVED';
    expect(
      (
        await f.service.workspace(f.actor, {
          from: '2026-10-29',
          to: '2026-10-29',
        })
      ).submissions,
    ).toHaveLength(1);
  });
  it('returns 404 for cross-organization mutation, and denies approval when unassigned', async () => {
    const f = fixture('mentor');
    f.submission.status = 'SUBMITTED';
    f.submission.organizationId = 'foreign';
    await expect(
      f.service.review(f.actor, 'submission', {
        version: 1,
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({ status: 404 });
    f.submission.organizationId = 'org';
    f.profile.mentorId = null;
    f.profile.mentor = null;
    await expect(
      f.service.review(f.actor, 'submission', {
        version: 1,
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('permits boss mentor assignment but refuses self-mentorship', async () => {
    const f = fixture('boss', ['OWNER']);
    await expect(
      f.service.assignMentor(f.actor, 'self', { mentorId: 'self' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      await f.service.assignMentor(f.actor, 'self', { mentorId: 'mentor' }),
    ).toEqual({ userId: 'self', mentorId: 'mentor' });
    expect(
      await f.service.assignMentor(f.actor, 'self', { mentorId: null }),
    ).toEqual({ userId: 'self', mentorId: null });
  });
  it.each(['self', 'mentor', 'manager', 'boss', 'stranger', 'foreign'])(
    'scopes workspace and draft visibility for %s',
    async (id) => {
      const f = fixture(id, id === 'boss' ? ['OWNER'] : []);
      if (id === 'foreign') f.actor.organizationId = 'other';
      const result = await f.service.workspace(f.actor, {
        from: '2026-10-29',
        to: '2026-10-29',
      });
      expect(result.submissions).toHaveLength(id === 'self' ? 1 : 0);
      expect(result.trainees).toHaveLength(
        ['self', 'mentor', 'manager', 'boss'].includes(id) ? 1 : 0,
      );
      expect(result.trainees[0]?.counts.total ?? 0).toBe(id === 'self' ? 1 : 0);
    },
  );
  it.each(['self', 'mentor', 'manager', 'boss', 'stranger', 'foreign'])(
    'only authorized people see submitted data for %s',
    async (id) => {
      const f = fixture(id, id === 'boss' ? ['SUPER_ADMIN'] : []);
      f.submission.status = 'SUBMITTED';
      if (id === 'foreign') f.actor.organizationId = 'other';
      const result = await f.service.workspace(f.actor, {
        from: '2026-10-29',
        to: '2026-10-29',
      });
      expect(result.submissions).toHaveLength(
        ['stranger', 'foreign'].includes(id) ? 0 : 1,
      );
      if (result.submissions.length)
        expect(result.submissions[0].canReview).toBe(id === 'mentor');
    },
  );
  it('allows no-mentor submission', async () => {
    const f = fixture();
    f.profile.mentorId = null;
    f.profile.mentor = null;
    await f.service.create(f.actor, input);
    expect(f.db.traineeSubmission.create.mock.calls[0][0].data).toMatchObject({
      status: 'SUBMITTED',
      traineeId: 'self',
      organizationId: 'org',
    });
  });
  it.each(['2026-02-29', '2026-13-01', '2026-10-32', '2026-1-01'])(
    'rejects impossible work date %s',
    async (workDate) => {
      const f = fixture();
      await expect(
        f.service.create(f.actor, { ...input, workDate }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it('rejects foreign department', async () => {
    const f = fixture();
    f.db.department.findFirst.mockResolvedValue(null);
    await expect(f.service.create(f.actor, input)).rejects.toMatchObject({
      status: 400,
    });
  });
  it('updates own rejected entry, submits atomically and retains history', async () => {
    const f = fixture();
    f.submission.status = 'REJECTED';
    f.submission.reviews = [
      {
        id: 'r1',
        decision: 'REJECTED',
        comment: '完善',
        reviewer: { displayName: '导师' },
        createdAt: 示例公司有限公司,
        version: 1,
      },
    ] as never;
    const result = await f.service.update(f.actor, 'submission', {
      title: '新标题',
      version: 1,
    });
    expect(result.history).toHaveLength(1);
    expect(f.db.traineeSubmission.updateMany.mock.calls[0][0].data.status).toBe(
      'DRAFT',
    );
    await f.service.submit(f.actor, 'submission', { version: 1 });
    expect(f.db.traineeSubmission.updateMany.mock.calls[1][0]).toMatchObject({
      where: {
        id: 'submission',
        version: 1,
        status: { in: ['DRAFT', 'REJECTED'] },
      },
      data: { status: 'SUBMITTED', version: { increment: 1 } },
    });
    expect(f.db.traineeReview.create).not.toHaveBeenCalled();
  });
  it('rejects stale version as 409 with no approval history added', async () => {
    const f = fixture('mentor');
    f.submission.status = 'SUBMITTED';
    f.db.traineeSubmission.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      f.service.review(f.actor, 'submission', {
        version: 1,
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.db.traineeReview.create).not.toHaveBeenCalled();
  });
  it.each(['self', 'manager', 'boss', 'stranger'])(
    'denies review by %s even if viewable',
    async (id) => {
      const f = fixture(id, id === 'boss' ? ['OWNER'] : []);
      f.submission.status = 'SUBMITTED';
      await expect(
        f.service.review(f.actor, 'submission', {
          version: 1,
          decision: 'APPROVED',
        }),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it('requires rejection reason and stores history within the atomic transaction', async () => {
    const f = fixture('mentor');
    f.submission.status = 'SUBMITTED';
    await expect(
      f.service.review(f.actor, 'submission', {
        version: 1,
        decision: 'REJECTED',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await f.service.review(f.actor, 'submission', {
      version: 1,
      decision: 'REJECTED',
      comment: '补充方案',
    });
    expect(f.db.traineeReview.create.mock.calls[0][0].data).toMatchObject({
      submissionId: 'submission',
      reviewerId: 'mentor',
      decision: 'REJECTED',
      comment: '补充方案',
      version: 2,
    });
  });
  it('uses current mentor relationship and refuses former mentor', async () => {
    const f = fixture('mentor');
    f.submission.status = 'SUBMITTED';
    f.profile.mentorId = 'new-mentor';
    await expect(
      f.service.review(f.actor, 'submission', {
        version: 1,
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('forbids editing submitted work and editing someone else draft', async () => {
    const f = fixture();
    f.submission.status = 'SUBMITTED';
    await expect(
      f.service.update(f.actor, 'submission', { title: '改', version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    f.submission.status = 'DRAFT';
    await expect(
      f.service.update(actor('mentor'), 'submission', {
        title: '改',
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('only boss can assign mentor and self/foreign/trainee-only mentor is rejected', async () => {
    const f = fixture();
    await expect(
      f.service.assignMentor(f.actor, 'self', { mentorId: 'mentor' }),
    ).rejects.toMatchObject({ status: 403 });
    const boss = fixture('boss', ['OWNER']);
    boss.db.user.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'boss' ? { roles: [roleEntry('OWNER')] } : null,
    );
    await expect(
      boss.service.assignMentor(boss.actor, 'self', { mentorId: 'foreign' }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('existing account can enroll without gaining roles and duplicate enrollment is 409', async () => {
    const f = fixture();
    await expect(f.service.enroll(f.actor, {})).rejects.toMatchObject({
      status: 409,
    });
    f.db.traineeProfile.findFirst.mockResolvedValue(null);
    await f.service.enroll(f.actor, {});
    expect(f.db.traineeProfile.create.mock.calls[0][0].data).toEqual({
      userId: 'self',
      organizationId: 'org',
      mentorId: null,
    });
  });
  it('first-login trainee cannot call any module endpoint', async () => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: () => false } as never,
      { authenticate: async () => ({ mustChangePassword: true }) } as never,
    );
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer access' },
          path: '/api/trainees',
          method: 'GET',
        }),
      }),
    };
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      status: 403,
    });
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import {
  activeUser,
  assertMentor,
  listMentors,
  isEligibleMentor,
  mentorRoleSelect,
  mentorWhere,
  safeUserSelect,
  serializable,
  shanghaiToday,
  workDate,
} from './trainee-policy.js';
import type {
  AssignMentorDto,
  CreateSubmissionDto,
  EnrollTraineeDto,
  ReviewSubmissionDto,
  TraineeQueryDto,
  UpdateSubmissionDto,
  VersionDto,
} from './trainee.dto.js';

const profileInclude = {
  user: { select: safeUserSelect },
  mentor: {
    select: {
      ...safeUserSelect,
      roles: { select: { role: { select: mentorRoleSelect } } },
      managerId: true,
      manager: { select: safeUserSelect },
    },
  },
} as const;
const submissionInclude = {
  trainee: { include: profileInclude },
  department: { select: { name: true } },
  reviews: {
    include: { reviewer: { select: { displayName: true } } },
    orderBy: [{ createdAt: 'asc' }, { version: 'asc' }],
  },
} as const satisfies Prisma.TraineeSubmissionInclude;
type Profile = Prisma.TraineeProfileGetPayload<{
  include: typeof profileInclude;
}>;
type Submission = Prisma.TraineeSubmissionGetPayload<{
  include: typeof submissionInclude;
}>;
type Scope = { actor: RequestUser; boss: boolean };
const editable = ['DRAFT', 'REJECTED'] as const;

@Injectable()
export class TraineeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async scope(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
  ): Promise<Scope> {
    const user = await tx.user.findFirst({
      where: {
        id: actor.id,
        organizationId: actor.organizationId,
        ...activeUser,
      },
      select: {
        id: true,
        roles: {
          where: {
            role: { organizationId: actor.organizationId, status: 'ACTIVE' },
          },
          select: { role: { select: { code: true } } },
        },
      },
    });
    if (!user) throw new ForbiddenException('成员无效');
    return {
      actor,
      boss: user.roles.some(({ role }) =>
        ['OWNER', 'SUPER_ADMIN'].includes(role.code),
      ),
    };
  }
  private currentMentor(profile: Profile, org: string) {
    return profile.mentor && isEligibleMentor(profile.mentor, org)
      ? profile.mentor
      : null;
  }
  private visible(profile: Profile, scope: Scope) {
    if (
      profile.organizationId !== scope.actor.organizationId ||
      profile.user.organizationId !== scope.actor.organizationId
    )
      return false;
    const mentor = this.currentMentor(profile, scope.actor.organizationId);
    return (
      scope.boss ||
      profile.userId === scope.actor.id ||
      (!!mentor &&
        (profile.mentorId === scope.actor.id ||
          mentor.managerId === scope.actor.id))
    );
  }
  private canReview(profile: Profile, scope: Scope) {
    return (
      profile.userId !== scope.actor.id &&
      profile.mentorId === scope.actor.id &&
      !!this.currentMentor(profile, scope.actor.organizationId) &&
      this.visible(profile, scope)
    );
  }
  private person(profile: Profile, scope: Scope, rows: Submission[]) {
    const mentor = this.currentMentor(profile, scope.actor.organizationId);
    const own = rows.filter((row) => row.traineeId === profile.userId);
    return {
      userId: profile.userId,
      displayName: profile.user.displayName,
      username: profile.user.username,
      mentorId: mentor?.id ?? null,
      mentorName: mentor?.displayName ?? null,
      mentorManagerName:
        mentor?.manager?.organizationId === scope.actor.organizationId &&
        mentor.manager.status === 'ACTIVE' &&
        !mentor.manager.deletedAt
          ? mentor.manager.displayName
          : null,
      isSelf: profile.userId === scope.actor.id,
      canReview: this.canReview(profile, scope),
      counts: {
        total: own.length,
        pending: own.filter((row) => row.status === 'SUBMITTED').length,
        approved: own.filter((row) => row.status === 'APPROVED').length,
        rejected: own.filter((row) => row.status === 'REJECTED').length,
      },
    };
  }
  private submission(row: Submission, scope: Scope) {
    const mentor = this.currentMentor(row.trainee, scope.actor.organizationId);
    const latest = row.reviews.at(-1);
    return {
      id: row.id,
      traineeId: row.traineeId,
      traineeName: row.trainee.user.displayName,
      mentorId: mentor?.id ?? null,
      mentorName: mentor?.displayName ?? null,
      departmentId: row.departmentId,
      departmentName: row.department.name,
      workDate: row.workDate.toISOString().slice(0, 10),
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      expectedValue: row.expectedValue,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      canEdit:
        row.traineeId === scope.actor.id &&
        (editable as readonly string[]).includes(row.status),
      canReview:
        row.status === 'SUBMITTED' && this.canReview(row.trainee, scope),
      reviewComment: latest?.comment ?? null,
      reviewerName: latest?.reviewer.displayName ?? null,
      reviewedAt: latest?.createdAt.toISOString() ?? null,
      history: row.reviews.map((review) => ({
        id: review.id,
        decision: review.decision,
        comment: review.comment,
        reviewerName: review.reviewer.displayName,
        reviewedAt: review.createdAt.toISOString(),
        version: review.version,
      })),
    };
  }
  async workspace(actor: RequestUser, query: TraineeQueryDto = {}) {
    const from = query.from ?? shanghaiToday(),
      to = query.to ?? shanghaiToday();
    const start = workDate(from),
      end = workDate(to);
    if (start > end) throw new BadRequestException('开始日期不能晚于结束日期');
    return serializable(this.prisma, async (tx) => {
      const scope = await this.scope(tx, actor);
      const profiles = await tx.traineeProfile.findMany({
        where: {
          organizationId: actor.organizationId,
          user: { organizationId: actor.organizationId },
          ...(scope.boss
            ? {}
            : {
                OR: [
                  { userId: actor.id },
                  {
                    mentorId: actor.id,
                    mentor: mentorWhere(actor.organizationId),
                  },
                  {
                    mentor: {
                      ...mentorWhere(actor.organizationId),
                      managerId: actor.id,
                    },
                  },
                ],
              }),
        },
        include: profileInclude,
        orderBy: { userId: 'asc' },
      });
      const visible = profiles.filter((p) => this.visible(p, scope));
      const selected = visible.filter(
        (p) => !query.traineeId || p.userId === query.traineeId,
      );
      const rows = await tx.traineeSubmission.findMany({
        where: {
          organizationId: actor.organizationId,
          traineeId: { in: selected.map((p) => p.userId) },
          workDate: { gte: start, lte: end },
          ...(query.status ? { status: query.status } : {}),
          OR: [{ traineeId: actor.id }, { status: { not: 'DRAFT' } }],
        },
        include: submissionInclude,
        orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      });
      const safeRows = rows.filter(
        (row) =>
          row.organizationId === actor.organizationId &&
          selected.some((p) => p.userId === row.traineeId) &&
          (row.traineeId === actor.id || row.status !== 'DRAFT') &&
          row.workDate >= start &&
          row.workDate < new Date(end.getTime() + 86400000) &&
          (!query.status || row.status === query.status),
      );
      const self = visible.find((p) => p.userId === actor.id);
      return {
        from,
        to,
        canSubmit: !!self,
        canManageMentors: scope.boss,
        selfProfile: self ? this.person(self, scope, safeRows) : null,
        trainees: selected.map((p) => this.person(p, scope, safeRows)),
        submissions: safeRows.map((row) => this.submission(row, scope)),
        departments: await tx.department.findMany({
          where: {
            organizationId: actor.organizationId,
            status: 'ACTIVE',
            deletedAt: null,
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        mentors: await listMentors(tx, actor.organizationId),
      };
    });
  }
  private async department(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    departmentId: string,
  ) {
    if (
      !(await tx.department.findFirst({
        where: {
          id: departmentId,
          organizationId: actor.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      }))
    )
      throw new BadRequestException('请选择本组织有效业务部门');
  }
  private text(value: string, field: string, limit: number) {
    if (typeof value !== 'string' || !value.trim() || value.length > limit)
      throw new BadRequestException(`${field}必填且长度不能超过${limit}`);
    return value.trim();
  }
  private version(version: number) {
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('version 必须为正整数');
  }
  private async load(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    id: string,
  ) {
    const row = await tx.traineeSubmission.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: submissionInclude,
    });
    if (!row || row.organizationId !== actor.organizationId)
      throw new NotFoundException('记录不存在');
    return row;
  }
  async create(actor: RequestUser, input: CreateSubmissionDto) {
    const title = this.text(input.title, '标题', 200),
      problem = this.text(input.problem, '问题', 20000),
      solution = this.text(input.solution, '方案', 20000),
      date = workDate(input.workDate);
    return serializable(this.prisma, async (tx) => {
      const scope = await this.scope(tx, actor);
      const profile = await tx.traineeProfile.findFirst({
        where: { userId: actor.id, organizationId: actor.organizationId },
        include: profileInclude,
      });
      if (
        !profile ||
        profile.userId !== actor.id ||
        !this.visible(profile, scope)
      )
        throw new ForbiddenException('请先入驻管培生模块');
      await this.department(tx, actor, input.departmentId);
      const row = await tx.traineeSubmission.create({
        data: {
          organizationId: actor.organizationId,
          traineeId: actor.id,
          departmentId: input.departmentId,
          workDate: date,
          title,
          problem,
          solution,
          expectedValue: input.expectedValue?.trim() || null,
          status: input.submit ? 'SUBMITTED' : 'DRAFT',
        },
        include: submissionInclude,
      });
      return this.submission(row, scope);
    });
  }
  private async mutate(
    actor: RequestUser,
    id: string,
    input: VersionDto,
    update: (
      tx: Prisma.TransactionClient,
      row: Submission,
      scope: Scope,
    ) => Promise<Prisma.TraineeSubmissionUncheckedUpdateManyInput>,
    review = false,
  ) {
    this.version(input.version);
    return serializable(this.prisma, async (tx) => {
      const scope = await this.scope(tx, actor),
        row = await this.load(tx, actor, id);
      if (
        review
          ? !this.canReview(row.trainee, scope)
          : row.traineeId !== actor.id
      )
        throw new ForbiddenException('无权操作此记录');
      const statuses = review ? (['SUBMITTED'] as const) : editable;
      if (
        !(statuses as readonly string[]).includes(row.status) ||
        row.version !== input.version
      )
        throw new ConflictException('记录已变更，请刷新后重试');
      const data = await update(tx, row, scope);
      const result = await tx.traineeSubmission.updateMany({
        where: {
          id,
          organizationId: actor.organizationId,
          version: input.version,
          status: { in: [...statuses] },
          ...(review
            ? {
                trainee: {
                  mentorId: actor.id,
                  mentor: mentorWhere(actor.organizationId),
                },
              }
            : { traineeId: actor.id }),
        },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('记录已变更，请刷新后重试');
      if (review) {
        const decision = input as ReviewSubmissionDto;
        await tx.traineeReview.create({
          data: {
            submissionId: id,
            reviewerId: actor.id,
            decision: decision.decision,
            comment: decision.comment?.trim() || null,
            version: input.version + 1,
          },
        });
      }
      return this.submission(await this.load(tx, actor, id), scope);
    });
  }
  update(actor: RequestUser, id: string, input: UpdateSubmissionDto) {
    return this.mutate(actor, id, input, async (tx, row) => {
      // Rejected work becomes a private draft as soon as its author saves revisions.
      const data: Prisma.TraineeSubmissionUncheckedUpdateManyInput =
        row.status === 'REJECTED' ? { status: 'DRAFT' } : {};
      if (input.title !== undefined)
        data.title = this.text(input.title, '标题', 200);
      if (input.problem !== undefined)
        data.problem = this.text(input.problem, '问题', 20000);
      if (input.solution !== undefined)
        data.solution = this.text(input.solution, '方案', 20000);
      if (input.departmentId !== undefined) {
        await this.department(tx, actor, input.departmentId);
        data.departmentId = input.departmentId;
      }
      if (input.workDate !== undefined)
        data.workDate = workDate(input.workDate);
      if (input.expectedValue !== undefined)
        data.expectedValue = input.expectedValue?.trim() || null;
      return data;
    });
  }
  submit(actor: RequestUser, id: string, input: VersionDto) {
    return this.mutate(actor, id, input, async () => ({ status: 'SUBMITTED' }));
  }
  review(actor: RequestUser, id: string, input: ReviewSubmissionDto) {
    if (
      !['APPROVED', 'REJECTED'].includes(input.decision) ||
      (input.decision === 'REJECTED' && !input.comment?.trim())
    )
      return Promise.reject(new BadRequestException('退回时请填写原因'));
    return this.mutate(
      actor,
      id,
      input,
      async () => ({ status: input.decision }),
      true,
    );
  }
  assignMentor(actor: RequestUser, userId: string, input: AssignMentorDto) {
    return serializable(this.prisma, async (tx) => {
      const scope = await this.scope(tx, actor);
      if (!scope.boss) throw new ForbiddenException('仅老板可调整导师');
      const profile = await tx.traineeProfile.findFirst({
        where: {
          userId,
          organizationId: actor.organizationId,
          user: { ...activeUser, organizationId: actor.organizationId },
        },
      });
      if (!profile) throw new NotFoundException('管培生不存在');
      if (input.mentorId)
        await assertMentor(tx, actor.organizationId, input.mentorId, userId);
      await tx.traineeProfile.update({
        where: { userId },
        data: { mentorId: input.mentorId },
      });
      return { userId, mentorId: input.mentorId };
    });
  }
  async enroll(actor: RequestUser, input: EnrollTraineeDto) {
    try {
      return await serializable(this.prisma, async (tx) => {
        await this.scope(tx, actor);
        if (await tx.traineeProfile.findFirst({ where: { userId: actor.id } }))
          throw new ConflictException('已经入驻');
        if (input.mentorId)
          await assertMentor(
            tx,
            actor.organizationId,
            input.mentorId,
            actor.id,
          );
        await tx.traineeProfile.create({
          data: {
            userId: actor.id,
            organizationId: actor.organizationId,
            mentorId: input.mentorId ?? null,
          },
        });
        return { userId: actor.id, mentorId: input.mentorId ?? null };
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('已经入驻');
      throw error;
    }
  }
}

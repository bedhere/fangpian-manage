import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@value-flow/db';
import type { PrismaService } from '../../infrastructure/prisma.service.js';
export const activeUser = { status: 'ACTIVE' as const, deletedAt: null };
export const safeUserSelect = {
  id: true,
  organizationId: true,
  displayName: true,
  username: true,
  status: true,
  deletedAt: true,
} as const;
export const mentorRoleSelect = {
  organizationId: true,
  status: true,
  code: true,
} as const;
function mentorRoleWhere(organizationId: string) {
  return {
    organizationId,
    status: activeUser.status,
    code: { not: 'TRAINEE' },
  };
}
export function mentorWhere(organizationId: string) {
  return {
    organizationId,
    ...activeUser,
    roles: {
      some: {
        role: mentorRoleWhere(organizationId),
      },
    },
  };
}
type MentorQualification = {
  organizationId: string;
  status: string;
  deletedAt: Date | null;
  roles: { role: { organizationId: string; status: string; code: string } }[];
};
/** Apply the same qualification as mentorWhere to a freshly loaded relation. */
export function isEligibleMentor(
  mentor: MentorQualification,
  organizationId: string,
) {
  const required = mentorRoleWhere(organizationId);
  return (
    mentor.organizationId === organizationId &&
    mentor.status === activeUser.status &&
    mentor.deletedAt === null &&
    mentor.roles.some(
      ({ role }) =>
        role.organizationId === required.organizationId &&
        role.status === required.status &&
        role.code !== required.code.not,
    )
  );
}
export async function listMentors(
  db: Pick<Prisma.TransactionClient, 'user'>,
  organizationId: string,
) {
  const users = await db.user.findMany({
    where: mentorWhere(organizationId),
    select: {
      id: true,
      displayName: true,
      department: { select: { name: true } },
    },
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
  });
  return users.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    departmentName: user.department?.name ?? null,
  }));
}
export async function assertMentor(
  db: Pick<Prisma.TransactionClient, 'user'>,
  organizationId: string,
  mentorId: string,
  traineeId?: string,
) {
  if (
    mentorId === traineeId ||
    !(await db.user.findFirst({
      where: { ...mentorWhere(organizationId), id: mentorId },
      select: { id: true },
    }))
  )
    throw new BadRequestException('请选择同组织有效导师');
}
export function workDate(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('日期格式必须为 YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value.startsWith('0000')
  )
    throw new BadRequestException('日期无效');
  return date;
}
export function shanghaiToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export async function serializable<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: 'Serializable' });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034') throw error;
      if (attempt === 2)
        throw new ConflictException('数据正在更新，请刷新后重试');
    }
  }
  throw new ConflictException('数据冲突');
}

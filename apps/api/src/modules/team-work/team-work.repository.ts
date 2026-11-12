import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import type { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { emptyDb, type Db, type User, type PublicUser } from './domain/types.js';
import { runWithDb } from './store/index.js';
import { deliverAssignments } from './team-work.notifications.js';

type Persisted = Pick<Db, 'tasks' | 'taskUpdates' | 'appraisals' | 'settings'> & {
  personal: Record<string, Pick<User, 'prefs' | 'memos' | 'ivy' | 'avatarEmoji' | 'avatarColor'>>;
};

/** One transaction per organization command; no process-global mutable business state. */
@Injectable()
export class TeamWorkRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  run<T>(actor: RequestUser, operation: (db: Db, tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.runOrganization(actor.organizationId, async (db, tx) => {
      if (!db.users.some(u => u.id === actor.id && u.state === 'active')) throw new ForbiddenException('成员已停用');
      return operation(db, tx);
    });
  }

  async runOrganization<T>(organizationId: string, operation: (db: Db, tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      // Lock even before the state row exists, covering concurrent first requests as well.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`team-work:${organizationId}`}, 0))`;
      const [row, departments, members] = await Promise.all([
        tx.teamWorkState.findUnique({ where: { organizationId } }),
        tx.department.findMany({ where: { organizationId, deletedAt: null, status: 'ACTIVE' },
          select: { id: true, name: true, headId: true, createdAt: true } }),
        tx.user.findMany({ where: { organizationId, deletedAt: null }, select: {
          id: true, displayName: true, username: true, email: true, isDemoAccount: true,
          status: true, departmentId: true, mustChangePassword: true, createdAt: true,
          roles: { select: { role: { select: { name: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
        } }),
      ]);
      const saved = row?.data as unknown as Persisted | undefined;
      const db = emptyDb();
      db.tasks = saved?.tasks ?? []; db.appraisals = saved?.appraisals ?? [];
      db.taskUpdates = saved?.taskUpdates;
      db.settings = saved?.settings ?? db.settings;
      db.departments = departments.map(d => ({ id: d.id, name: d.name, color: '#eab308', createdAt: d.createdAt.toISOString() }));
      db.groups = departments.map(d => ({ id: d.id, departmentId: d.id, name: d.name, leaderId: d.headId,
        dimTags: { cat: ['日常工作', '项目交付', '团队协作'], type: ['计划', '执行', '复盘'] },
        categories: ['日常工作', '项目交付', '团队协作'], types: ['计划', '执行', '复盘'], createdAt: d.createdAt.toISOString() }));
      for (const group of db.groups) {
        group.dimTags = { ...group.dimTags, ...db.settings.groupTags?.[group.id] };
        group.categories = group.dimTags.cat ?? []; group.types = group.dimTags.type ?? [];
      }
      db.users = members.map(member => {
        const permissions = new Set(member.roles.flatMap(r => r.role.permissions.map(p => p.permission.code)));
        const globalManager = permissions.has('user:manage') || permissions.has('analytics:executive');
        const leads = departments.filter(d => d.headId === member.id).map(d => d.id);
        const managedDepartmentIds = globalManager ? undefined : leads;
        const personal = saved?.personal?.[member.id];
        const result: User & Pick<PublicUser, 'managedDepartmentIds'> = {
          id: member.id, name: member.displayName, account: member.username || member.email,
          isDemoAccount: member.isDemoAccount,
          title: member.roles.map(r => r.role.name).join(' / '),
          role: globalManager || leads.length ? 'admin' : 'member',
          managedDepartmentIds,
          state: member.status === 'ACTIVE' ? 'active' : 'disabled', departmentId: member.departmentId,
          groupIds: member.departmentId ? [member.departmentId] : [],
          // Identity secrets are intentionally never loaded from the canonical user table.
          passwordHash: '', passwordSalt: '', mustChangePassword: member.mustChangePassword,
          avatarEmoji: personal?.avatarEmoji ?? null, avatarColor: personal?.avatarColor ?? null,
          prefs: personal?.prefs ?? {}, memos: personal?.memos ?? [], ivy: personal?.ivy ?? [],
          createdAt: member.createdAt.toISOString(), lastLoginAt: null,
        };
        return result;
      });
      // JSONB key order is not significant. Clone before commands mutate shared objects.
      const before = structuredClone(saved);
      const beforeTasks = structuredClone(db.tasks);
      const output = await runWithDb(db, () => operation(db, tx));
      await deliverAssignments(beforeTasks, db, tx);
      const data: Persisted = { tasks: db.tasks, appraisals: db.appraisals, settings: db.settings,
        ...(db.taskUpdates ? { taskUpdates: db.taskUpdates } : {}),
        personal: Object.fromEntries(db.users.map(u => [u.id, {
          prefs: u.prefs, memos: u.memos, ivy: u.ivy, avatarEmoji: u.avatarEmoji, avatarColor: u.avatarColor,
        }])) };
      if (!isDeepStrictEqual(data, before)) await tx.teamWorkState.upsert({ where: { organizationId },
        create: { organizationId, data: data as unknown as Prisma.InputJsonValue },
        update: { data: data as unknown as Prisma.InputJsonValue } });
      return output;
    }, { maxWait: 15000, timeout: 20000 });
  }
}

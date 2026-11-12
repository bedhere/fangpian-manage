import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createConnection } from 'node:net';
import * as argon2 from 'argon2';
import { Prisma } from '@value-flow/db';
import { nextSettingVersion } from '@value-flow/domain';
import {
  assertCanDeactivateAdministrator,
  assertDepartmentParentIsAcyclic,
  assertPermissionGrantIsBounded,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type {
  CreateNotificationDto,
  CreateAdminUserDto,
  CreateDepartmentDto,
  CreateRoleDto,
  ResetAdminUserPasswordDto,
  UpdateAdminUserDto,
  UpdateDepartmentDto,
  UpdateRolePermissionsDto,
  UpdateRoleDto,
  UpdateSettingDto,
} from './governance.dto.js';
import { listSettingDefinitions, validateRegisteredSetting } from './setting-registry.js';
import { assertCanResetAdminPassword, canResetAdminPassword } from './admin-password-policy.js';
import { serializable } from '../trainees/trainee-policy.js';

const resetRoleInclude = { roles: { where: { role: { status: 'ACTIVE' as const } }, include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;
const resetTargetInclude = { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;
@Injectable()
export class GovernanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private require(actor: RequestUser, permission: string) {
    if (!actor.permissions.includes(permission))
      throw new ForbiddenException('权限不足');
  }
  async users(actor: RequestUser, search?: string, page = 1, pageSize = 50) {
    this.require(actor, 'user:manage');
    const safePage = Number.isFinite(page) ? Math.min(100000, Math.max(1, Math.floor(page))) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 50;
    search = search?.trim().slice(0, 200);
    const where: Prisma.UserWhereInput = {
        organizationId: actor.organizationId,
        deletedAt: null,
        OR: search
          ? [
              { email: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        mustChangePassword: true,
        displayName: true,
        status: true,
        department: { select: { id: true, name: true } },
        roles: { select: { role: { select: { id: true, code: true, name: true, status: true, organizationId: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(user => ({ ...user,
      roles: user.roles.map(({ role }) => ({ role: { id: role.id, code: role.code, name: role.name } })),
      canResetPassword: canResetAdminPassword(actor, user.roles.filter(x => x.role.organizationId === actor.organizationId).map(x => x.role)),
    })), total, page: safePage, pageSize: safePageSize };
  }
  async createUser(actor: RequestUser, input: CreateAdminUserDto) {
    this.require(actor, 'user:manage');
    const [department, roles] = await Promise.all([
      input.departmentId ? this.prisma.department.findFirst({ where: { id: input.departmentId, organizationId: actor.organizationId, deletedAt: null } }) : null,
      this.prisma.role.findMany({ where: { id: { in: input.roleIds }, organizationId: actor.organizationId, status: 'ACTIVE' }, include: { permissions: { include: { permission: true } } } }),
    ]);
    if (input.departmentId && !department) throw new BadRequestException('INVALID_DEPARTMENT');
    if (roles.length !== new Set(input.roleIds).size) throw new BadRequestException('INVALID_ROLE');
    this.checkAssignedRoles(actor, roles);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { organizationId: actor.organizationId, departmentId: input.departmentId, email: input.email.toLowerCase(), displayName: input.displayName, passwordHash, status: 'ACTIVE', createdBy: actor.id } });
      if (roles.length) await tx.userRole.createMany({ data: roles.map((role) => ({ userId: created.id, roleId: role.id, createdBy: actor.id })) });
      await tx.employeeProfile.create({ data: { userId: created.id } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'User', entityId: created.id, action: 'ADMIN_USER_CREATED', after: { email: created.email, displayName: created.displayName, departmentId: created.departmentId, roleIds: input.roleIds } } });
      return { id: created.id, email: created.email, displayName: created.displayName, status: created.status };
    });
  }
  async updateUser(actor: RequestUser, id: string, input: UpdateAdminUserDto) {
    this.require(actor, 'user:manage');
    const target = await this.prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException();
    const isSuperAdmin = target.roles.some((item) => item.role.code === 'SUPER_ADMIN');
    if (input.status && input.status !== 'ACTIVE' && isSuperAdmin) {
      const count = await this.prisma.user.count({
        where: {
          organizationId: actor.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
          roles: { some: { role: { code: 'SUPER_ADMIN' } } },
        },
      });
      try { assertCanDeactivateAdministrator(true, count); }
      catch { throw new BadRequestException('LAST_SUPER_ADMIN'); }
    }
    const [department, roles] = await Promise.all([
      input.departmentId ? this.prisma.department.findFirst({ where: { id: input.departmentId, organizationId: actor.organizationId, deletedAt: null } }) : null,
      input.roleIds ? this.prisma.role.findMany({ where: { id: { in: input.roleIds }, organizationId: actor.organizationId, status: 'ACTIVE' }, include: { permissions: { include: { permission: true } } } }) : [],
    ]);
    if (input.departmentId && !department) throw new BadRequestException('INVALID_DEPARTMENT');
    if (input.roleIds && roles.length !== new Set(input.roleIds).size) throw new BadRequestException('INVALID_ROLE');
    if (input.roleIds) this.checkAssignedRoles(actor, roles);
    if (!actor.roles.includes('SUPER_ADMIN') && target.roles.some((entry) => entry.role.code === 'SUPER_ADMIN' || entry.role.code === 'OWNER')) throw new ForbiddenException('不能修改公司管理层或系统管理员账号');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        select: { id: true, email: true, username: true, displayName: true, status: true, departmentId: true, mustChangePassword: true },
        data: {
          ...(input.status ? { status: input.status, deletedAt: input.status === 'DISABLED' ? new Date() : null } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
        },
      });
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roles.length) await tx.userRole.createMany({ data: roles.map((role) => ({ userId: id, roleId: role.id, createdBy: actor.id })) });
      }
      await tx.auditLog.create({ data: {
        organizationId: actor.organizationId, actorId: actor.id,
        entityType: 'User', entityId: id, action: 'ADMIN_USER_UPDATED',
        before: { status: target.status, displayName: target.displayName, departmentId: target.departmentId, roleIds: target.roles.map((item) => item.roleId) },
        after: { status: input.status, displayName: input.displayName, departmentId: input.departmentId, roleIds: input.roleIds, reason: input.reason },
      } });
      return updated;
    });
  }
  async resetUserPassword(actor: RequestUser, id: string, input: ResetAdminUserPasswordDto) {
    this.require(actor, 'user:manage');
    if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128 || !input.password.trim()) throw new BadRequestException('新密码须为12至128个字符');
    const reason = input.reason?.trim();
    if (!reason || reason.length < 2 || reason.length > 300 || reason.includes(input.password)) throw new BadRequestException('请填写2至300字的修改原因，不要在原因中填写密码');
    const target = await this.prisma.user.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null }, include: resetTargetInclude });
    if (!target) throw new NotFoundException();
    assertCanResetAdminPassword(actor, target.roles.map(entry => entry.role));
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await serializable(this.prisma, async (tx) => {
      const currentActor = await tx.user.findFirst({ where: { id: actor.id, organizationId: actor.organizationId, status: 'ACTIVE', deletedAt: null, mustChangePassword: false }, include: resetRoleInclude });
      if (!currentActor || (actor.tokenVersion !== undefined && currentActor.tokenVersion !== actor.tokenVersion)) throw new ForbiddenException('管理员身份已变更，请重新登录');
      const actorRoles = currentActor.roles.filter(entry => entry.role.organizationId === actor.organizationId);
      const freshActor: RequestUser = { ...actor, roles: actorRoles.map(entry => entry.role.code), permissions: [...new Set(actorRoles.flatMap(entry => entry.role.permissions.map(x => x.permission.code)))] };
      const currentTarget = await tx.user.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null }, include: resetTargetInclude });
      if (!currentTarget) throw new NotFoundException();
      assertCanResetAdminPassword(freshActor, currentTarget.roles.map(entry => entry.role));
      if (currentTarget.tokenVersion !== target.tokenVersion || currentTarget.passwordHash !== target.passwordHash) throw new ConflictException('该账号密码或会话已变更，请刷新后核对');
      const updated = await tx.user.updateMany({ where: { id, organizationId: actor.organizationId, deletedAt: null, tokenVersion: target.tokenVersion, passwordHash: target.passwordHash }, data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException('账号已变更，请刷新后核对');
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'User', entityId: id, action: 'ADMIN_USER_PASSWORD_RESET', after: { reason, refreshTokensRevoked: true, mustChangePassword: true } } });
    });
    return { id, reset: true, mustChangePassword: true, selfReset: id === actor.id };
  }
  private checkAssignedRoles(actor: RequestUser, roles: { permissions: { permission: { code: string } }[] }[]) {
    if (actor.roles.includes('SUPER_ADMIN')) return;
    try { assertPermissionGrantIsBounded(actor.permissions, roles.flatMap((role) => role.permissions.map((entry) => entry.permission.code))); }
    catch { throw new ForbiddenException('PERMISSION_ESCALATION'); }
  }
  departments(actor: RequestUser) {
    this.require(actor, 'department:manage');
    return this.prisma.department.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      include: { head: { select: { id: true, displayName: true } }, _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });
  }
  async createDepartment(actor: RequestUser, input: CreateDepartmentDto) {
    this.require(actor, 'department:manage');
    if (input.parentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: input.parentId, organizationId: actor.organizationId, deletedAt: null } });
      if (!parent) throw new BadRequestException('INVALID_PARENT_DEPARTMENT');
    }
    if (input.headId) {
      const head = await this.prisma.user.findFirst({ where: { id: input.headId, organizationId: actor.organizationId, deletedAt: null } });
      if (!head) throw new BadRequestException('INVALID_DEPARTMENT_HEAD');
    }
    const created = await this.prisma.department.create({ data: { organizationId: actor.organizationId, name: input.name, code: input.code.toUpperCase(), parentId: input.parentId, headId: input.headId, createdBy: actor.id } });
    await this.prisma.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Department', entityId: created.id, action: 'ADMIN_DEPARTMENT_CREATED', after: { name: created.name, code: created.code, parentId: created.parentId, headId: created.headId } } });
    return created;
  }
  async updateDepartment(actor: RequestUser, id: string, input: UpdateDepartmentDto) {
    this.require(actor, 'department:manage');
    const department = await this.prisma.department.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null } });
    if (!department) throw new NotFoundException();
    const all = await this.prisma.department.findMany({ where: { organizationId: actor.organizationId, deletedAt: null }, select: { id: true, parentId: true } });
    if (input.parentId) {
      if (!all.some((item) => item.id === input.parentId)) throw new NotFoundException();
      try { assertDepartmentParentIsAcyclic(id, input.parentId, new Map(all.map((item) => [item.id, item.parentId]))); }
      catch { throw new BadRequestException('CYCLIC_DEPARTMENT'); }
    }
    const updated = await this.prisma.department.update({ where: { id }, data: input });
    await this.prisma.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Department', entityId: id, action: 'ADMIN_DEPARTMENT_UPDATED', before: department as unknown as Prisma.InputJsonObject, after: input as unknown as Prisma.InputJsonObject } });
    return updated;
  }
  roles(actor: RequestUser) {
    if (!actor.permissions.includes('user:manage')) this.require(actor, 'role:manage');
    return this.prisma.role.findMany({ where: { organizationId: actor.organizationId, ...(!actor.permissions.includes('role:manage') ? { permissions: { every: { permission: { code: { in: actor.permissions } } } } } : {}) }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: { code: 'asc' } });
  }
  permissions(actor: RequestUser) {
    this.require(actor, 'role:manage');
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }
  async createRole(actor: RequestUser, input: CreateRoleDto) {
    this.require(actor, 'role:manage');
    try { assertPermissionGrantIsBounded(actor.permissions, input.permissionCodes); }
    catch { throw new ForbiddenException('PERMISSION_ESCALATION'); }
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: input.permissionCodes } } });
    if (permissions.length !== new Set(input.permissionCodes).size) throw new BadRequestException('UNKNOWN_PERMISSION');
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { organizationId: actor.organizationId, code: input.code.toUpperCase(), name: input.name, description: input.description, isSystem: false } });
      if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Role', entityId: role.id, action: 'ADMIN_ROLE_CREATED', after: { code: role.code, name: role.name, permissionCodes: input.permissionCodes } } });
      return role;
    });
  }
  async updateRole(actor: RequestUser, id: string, input: UpdateRoleDto) {
    this.require(actor, 'role:manage');
    const role = await this.prisma.role.findFirst({ where: { id, organizationId: actor.organizationId }, include: { permissions: { include: { permission: true } } } });
    if (!role) throw new NotFoundException();
    if (role.isSystem && input.status && input.status !== 'ACTIVE') throw new BadRequestException('SYSTEM_ROLE_CANNOT_BE_DISABLED');
    if (input.permissionCodes) {
      try { assertPermissionGrantIsBounded(actor.permissions, input.permissionCodes); }
      catch { throw new ForbiddenException('PERMISSION_ESCALATION'); }
    }
    const permissions = input.permissionCodes ? await this.prisma.permission.findMany({ where: { code: { in: input.permissionCodes } } }) : [];
    if (input.permissionCodes && permissions.length !== new Set(input.permissionCodes).size) throw new BadRequestException('UNKNOWN_PERMISSION');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id }, data: { name: input.name, description: input.description, status: input.status } });
      if (input.permissionCodes) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })) });
      }
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Role', entityId: id, action: 'ADMIN_ROLE_UPDATED', before: { name: role.name, description: role.description, status: role.status, permissionCodes: role.permissions.map((item) => item.permission.code) }, after: { name: input.name, description: input.description, status: input.status, permissionCodes: input.permissionCodes, reason: input.reason } } });
      return updated;
    });
  }
  async updateRolePermissions(actor: RequestUser, id: string, input: UpdateRolePermissionsDto) {
    this.require(actor, 'role:manage');
    try { assertPermissionGrantIsBounded(actor.permissions, input.permissionCodes); }
    catch { throw new ForbiddenException('PERMISSION_ESCALATION'); }
    const role = await this.prisma.role.findFirst({ where: { id, organizationId: actor.organizationId }, include: { permissions: { include: { permission: true } } } });
    if (!role) throw new NotFoundException();
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: input.permissionCodes } } });
    if (permissions.length !== new Set(input.permissionCodes).size) throw new BadRequestException('UNKNOWN_PERMISSION');
    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })) });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'Role', entityId: id, action: 'ADMIN_ROLE_PERMISSIONS_UPDATED', before: { permissionCodes: role.permissions.map((item) => item.permission.code) }, after: { permissionCodes: input.permissionCodes } } });
      return this.prisma.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
    });
  }
  settings(actor: RequestUser) {
    this.require(actor, 'setting:manage');
    return this.prisma.systemSetting.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { key: 'asc' },
    });
  }
  settingDefinitions(actor: RequestUser) {
    this.require(actor, 'setting:manage');
    return listSettingDefinitions();
  }
  aiConfiguration(actor: RequestUser) {
    this.require(actor, 'setting:manage');
    return {
      provider: 'openai-compatible',
      baseUrl: process.env.AI_BASE_URL ?? null,
      model: process.env.AI_MODEL ?? null,
      apiKeyConfigured: Boolean(process.env.AI_API_KEY),
      maxAttempts: Number(process.env.AI_MAX_ATTEMPTS ?? 2),
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 20_000),
    };
  }
  private tcp(host: string, port: number) {
    return new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host, port });
      socket.setTimeout(1500);
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
      socket.once('error', reject);
    });
  }
  async systemHealth(actor: RequestUser) {
    this.require(actor, 'setting:manage');
    const redis = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const minioHost = process.env.MINIO_ENDPOINT ?? 'localhost';
    const minioPort = Number(process.env.MINIO_PORT ?? 9000);
    const minioProtocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.tcp(redis.hostname, Number(redis.port || 6379)),
      fetch(`${minioProtocol}://${minioHost}:${minioPort}/minio/health/live`, { signal: AbortSignal.timeout(1500) }).then((response) => { if (!response.ok) throw new Error('unhealthy'); }),
    ]);
    const names = ['postgresql', 'redis', 'minio'];
    const dependencies = checks.map((result, index) => ({ name: names[index], status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy' }));
    return { status: dependencies.every((item) => item.status === 'healthy') ? 'healthy' : 'degraded', dependencies };
  }
  async updateSetting(actor: RequestUser, id: string, input: UpdateSettingDto) {
    this.require(actor, 'setting:manage');
    const setting = await this.prisma.systemSetting.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!setting) throw new NotFoundException();
    try { validateRegisteredSetting(setting.key, input.value); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'INVALID_SETTING_VALUE'); }
    let version: number;
    try {
      version = nextSettingVersion(setting.version, input.expectedVersion);
    } catch {
      throw new BadRequestException('SETTING_VERSION_CONFLICT');
    }
    const previousValue =
      setting.value === null
        ? Prisma.JsonNull
        : (setting.value as Prisma.InputJsonValue);
    const nextValue = input.value as Prisma.InputJsonValue;
    return this.prisma.$transaction(async (tx) => {
      await tx.systemSettingRevision.create({
        data: {
          settingId: id,
          version: setting.version,
          value: previousValue,
          changedById: actor.id,
          reason: input.reason,
        },
      });
      const updated = await tx.systemSetting.update({
        where: { id },
        data: {
          value: nextValue,
          version,
          createdBy: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'SystemSetting',
          entityId: id,
          action: 'SYSTEM_SETTING_UPDATED',
          before: {
            version: setting.version,
            value: setting.value ?? null,
          } as Prisma.InputJsonObject,
          after: { version, value: nextValue, reason: input.reason },
        },
      });
      return updated;
    });
  }
  audits(actor: RequestUser, entityType?: string, action?: string) {
    this.require(actor, 'audit:read');
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: actor.organizationId,
        entityType: entityType || undefined,
        action: action || undefined,
      },
      include: { actor: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  notifications(actor: RequestUser) {
    return this.prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async read(actor: RequestUser, id: string) {
    const item = await this.prisma.notification.findFirst({
      where: { id, userId: actor.id },
    });
    if (!item) throw new NotFoundException();
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: item.readAt ?? new Date() },
    });
  }
  async create(actor: RequestUser, input: CreateNotificationDto) {
    this.require(actor, 'setting:manage');
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, organizationId: actor.organizationId },
    });
    if (!user) throw new NotFoundException();
    return this.prisma.notification.create({
      data: {
        userId: user.id,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  }
}

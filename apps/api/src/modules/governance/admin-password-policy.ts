import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
export type PasswordTargetRole = { code: string; status?: string; permissions: { permission: { code: string } }[] };
export function canResetAdminPassword(actor: RequestUser, roles: PasswordTargetRole[]) {
  if (!actor.permissions.includes('user:manage')) return false;
  if (actor.roles.includes('SUPER_ADMIN')) return true;
  if (roles.some(role => ['OWNER', 'SUPER_ADMIN'].includes(role.code))) return false;
  return roles.filter(role => !role.status || role.status === 'ACTIVE').every(role => role.permissions.every(entry => actor.permissions.includes(entry.permission.code)));
}
export function assertCanResetAdminPassword(actor: RequestUser, roles: PasswordTargetRole[]) {
  if (!canResetAdminPassword(actor, roles)) throw new ForbiddenException('无权重置此账号密码，请由具备对应权限的管理员操作');
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasEveryPermission } from '@value-flow/domain';
import { REQUIRED_PERMISSIONS } from './permissions.decorator.js';
import type { RequestUser } from './auth.types.js';
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user: RequestUser }>().user;
    if (!hasEveryPermission(new Set(user.permissions), required))
      throw new ForbiddenException('权限不足');
    return true;
  }
}

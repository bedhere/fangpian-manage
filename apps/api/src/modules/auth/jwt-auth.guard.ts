import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { IS_PUBLIC } from './public.decorator.js';
import { isTraineeOnly, traineeRouteAllowed } from './trainee-access.js';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const [kind, token] = request.headers.authorization?.split(' ') ?? [];
    const unauthorized = () => new UnauthorizedException({ code: 'SESSION_UNAUTHORIZED', message: '登录已失效，请重新登录后继续' });
    if (kind !== 'Bearer' || !token) throw unauthorized();
    let user;
    try { user = await this.auth.authenticate(token); }
    catch (error) { if (error instanceof UnauthorizedException) throw unauthorized(); throw error; }
    request.user = user;
    const path = request.path.replace(/\/$/, '');
    const allowed = (request.method === 'GET' && path === '/api/users/me') ||
      (request.method === 'POST' && path === '/api/auth/change-password');
    if (user.mustChangePassword && !allowed) {
      throw new ForbiddenException({ code: 'MUST_CHANGE_PASSWORD', message: '首次登录请先修改密码' });
    }
    if (isTraineeOnly(user.roles) && !traineeRouteAllowed(path, request.method)) {
      throw new ForbiddenException('管培生账号仅可访问管培生模块');
    }
    return true;
  }
}

import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { ChangePasswordDto, LoginDto } from './auth.dto.js';
import { isTraineeOnly } from './trainee-access.js';
import type {
  AccessPayload,
  RefreshPayload,
  RequestUser,
} from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}
  async login(input: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.email.trim().toLowerCase() }, { username: input.email.trim().toLowerCase() }],
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: this.authorizationInclude,
    });
    if (!user || !(await argon2.verify(user.passwordHash, input.password)))
      throw new UnauthorizedException('账号或密码错误');
    return this.issueTokenPair(this.toRequestUser(user));
  }
  async refresh(rawToken: string) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('刷新令牌无效');
    }
    if (payload.type !== 'refresh')
      throw new UnauthorizedException('无效令牌类型');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: { include: this.authorizationInclude } },
    });
    if (
      !stored ||
      stored.user.status !== 'ACTIVE' || stored.user.deletedAt ||
      stored.userId !== payload.sub || stored.familyId !== payload.familyId ||
      (stored.user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0) ||
      stored.expiresAt <= new Date() ||
      !(await argon2.verify(stored.tokenHash, rawToken))
    ) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: payload.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('刷新令牌无效或已被重用');
    }
    if (stored.revokedAt) await this.rejectConsumedRefresh(stored.id, stored.familyId);
    const nextId = randomUUID();
    const user = this.toRequestUser(stored.user);
    const pair = await this.createTokens(user, nextId, stored.familyId);
    const tokenHash = await argon2.hash(pair.refreshToken);
    const consumed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date(), replacedBy: nextId },
      });
      if (result.count !== 1) return false;
      await tx.refreshToken.create({
        data: {
          id: nextId,
          userId: user.id,
          familyId: stored.familyId,
          tokenHash,
          expiresAt: this.refreshExpiry,
        },
      });
      return true;
    });
    if (!consumed) await this.rejectConsumedRefresh(stored.id, stored.familyId);
    return pair;
  }
  private async rejectConsumedRefresh(id: string, familyId: string): Promise<never> {
    const current = await this.prisma.refreshToken.findUnique({ where: { id } });
    const age = current?.revokedAt ? Date.示例公司有限公司() - current.revokedAt.getTime() : -1;
    // A verified cookie sent by two tabs must not invalidate the winning tab.
    // No token is issued, and this fixed window is never extended by requests.
    if (current?.replacedBy && age >= 0 && age <= 5000) {
      throw new ConflictException({ code: 'REFRESH_IN_PROGRESS', message: '登录正在另一页面续期，请稍后再操作' });
    }
    await this.prisma.refreshToken.updateMany({ where: { familyId }, data: { revokedAt: new Date() } });
    throw new UnauthorizedException('刷新令牌无效或已被重用');
  }
  async authenticate(accessToken: string): Promise<RequestUser> {
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(accessToken, {
        secret: this.accessSecret,
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'access') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: this.authorizationInclude,
    });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt || (user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) throw new UnauthorizedException();
    return this.toRequestUser(user);
  }
  async changePassword(actor: RequestUser, input: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await argon2.verify(user.passwordHash, input.currentPassword))) {
      throw new UnauthorizedException('当前密码错误');
    }
    if (input.newPassword === input.currentPassword || input.newPassword === 'DEMO_ONLY_ChangeMe_2026!') {
      throw new BadRequestException('新密码不能与当前密码或统一初始密码相同');
    }
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({ where: { id: user.id, tokenVersion: user.tokenVersion, passwordHash: user.passwordHash, status: 'ACTIVE', deletedAt: null }, data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } } });
      if (result.count !== 1) throw new ConflictException('账号状态已变更，请重新登录');
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: this.authorizationInclude });
    });
    return this.issueTokenPair(this.toRequestUser(updated));
  }
  private async issueTokenPair(user: RequestUser) {
    const tokenId = randomUUID();
    const familyId = randomUUID();
    const pair = await this.createTokens(user, tokenId, familyId);
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        familyId,
        tokenHash: await argon2.hash(pair.refreshToken),
        expiresAt: this.refreshExpiry,
      },
    });
    return pair;
  }
  private async createTokens(
    user: RequestUser,
    tokenId: string,
    familyId: string,
  ) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        organizationId: user.organizationId,
        email: user.email,
        type: 'access',
        tokenVersion: user.tokenVersion ?? 0,
      } satisfies AccessPayload,
      { secret: this.accessSecret, expiresIn: '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        tokenId,
        familyId,
        type: 'refresh',
        tokenVersion: user.tokenVersion ?? 0,
      } satisfies RefreshPayload,
      { secret: this.refreshSecret, expiresIn: `${this.refreshDays}d` },
    );
    return { accessToken, refreshToken, expiresIn: 900, mustChangePassword: user.mustChangePassword ?? false };
  }
  private toRequestUser(user: any): RequestUser {
    const roles = user.roles.map((entry: any) => entry.role.code as string);
    const permissions = [
      ...new Set<string>(
        user.roles.flatMap((entry: any) =>
          entry.role.permissions.map(
            (item: any) => item.permission.code as string,
          ),
        ),
      ),
    ];
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword ?? false,
      tokenVersion: user.tokenVersion ?? 0,
      roles,
      permissions: isTraineeOnly(roles) ? [] : permissions,
    };
  }
  private readonly authorizationInclude = {
    roles: {
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    },
  } as const;
  private get accessSecret() {
    return process.env.JWT_ACCESS_SECRET!;
  }
  private get refreshSecret() {
    return process.env.JWT_REFRESH_SECRET!;
  }
  private get refreshDays() {
    return Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
  }
  private get refreshExpiry() {
    return new Date(Date.示例公司有限公司() + this.refreshDays * 86_400_000);
  }
}

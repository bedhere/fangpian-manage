import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto, LoginDto } from './auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { RequestUser } from './auth.types.js';
import { Public } from './public.decorator.js';
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const pair = await this.auth.login(dto);
    this.writeRefreshCookie(response, pair.refreshToken);
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn, mustChangePassword: pair.mustChangePassword ?? false };
  }
  @Post('refresh')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.valueflow_refresh_token as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('缺少刷新令牌');
    const pair = await this.auth.refresh(refreshToken);
    this.writeRefreshCookie(response, pair.refreshToken);
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn, mustChangePassword: pair.mustChangePassword ?? false };
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('valueflow_refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });
    return { success: true };
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async changePassword(@Req() request: { user: RequestUser }, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
    const pair = await this.auth.changePassword(request.user, dto);
    this.writeRefreshCookie(response, pair.refreshToken);
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn, mustChangePassword: pair.mustChangePassword };
  }

  private writeRefreshCookie(response: Response, token: string) {
    response.cookie('valueflow_refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86_400_000,
    });
  }
}

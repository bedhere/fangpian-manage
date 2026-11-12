import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Get('me') me(@Req() request: { user: RequestUser }) {
    return request.user;
  }
}

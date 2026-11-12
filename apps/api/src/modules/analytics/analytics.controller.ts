import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AnalyticsService } from './analytics.service.js';
@Controller()
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}
  @Get('profiles/:id') profile(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.analytics.profile(r.user, id);
  }
  @Get('analytics/rankings') rankings(
    @Req() r: { user: RequestUser },
    @Query('type') type = 'contribution',
  ) {
    return this.analytics.rankings(r.user, type);
  }
  @Get('analytics/capacity') capacity(@Req() r: { user: RequestUser }) {
    return this.analytics.capacity(r.user);
  }
  @Get('analytics/departments') departments(@Req() r: { user: RequestUser }) {
    return this.analytics.departments(r.user);
  }
  @Get('analytics/executive-dashboard')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('analytics:executive')
  dashboard(@Req() r: { user: RequestUser }) {
    return this.analytics.dashboard(r.user);
  }
}

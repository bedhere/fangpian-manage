import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { SettlementService } from './settlement.service.js';
import {
  ArbitrateContributionsDto,
  ContributionResponseDto,
  ProposeContributionsDto,
  SettlementMonthDto,
} from './settlement.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class SettlementController {
  constructor(
    @Inject(SettlementService) private readonly settlement: SettlementService,
  ) {}
  @Post('projects/:id/contributions') propose(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: ProposeContributionsDto,
  ) {
    return this.settlement.propose(r.user, id, b.contributions);
  }
  @Get('projects/:id/contributions') list(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.settlement.list(r.user, id);
  }
  @Get('projects/:id/contribution-workspace') workspace(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.settlement.workspace(r.user, id);
  }
  @Post('projects/:id/contributions/:contributionId/respond') respond(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
    @Body() b: ContributionResponseDto,
  ) {
    return this.settlement.respond(r.user, id, contributionId, b);
  }
  @Post('projects/:id/contribution-arbitration') arbitrate(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: ArbitrateContributionsDto,
  ) {
    return this.settlement.arbitrate(r.user, id, b);
  }
  @Get('bonuses/me') mine(@Req() r: { user: RequestUser }) {
    return this.settlement.mine(r.user);
  }
  @Get('bonuses/transparent') transparent(
    @Req() r: { user: RequestUser },
    @Query('page') page?: string, @Query('pageSize') pageSize?: string,
    @Query('status') status?: string, @Query('month') month?: string, @Query('search') search?: string,
  ) {
    return this.settlement.transparentLedger(r.user, { page: Number(page || 1), pageSize: Number(pageSize || 20), status, month, search });
  }
  @Get('settlements') overview(
    @Req() r: { user: RequestUser },
    @Query('month') month?: string,
  ) {
    return this.settlement.overview(r.user, month);
  }
  @Post('settlements/lock') lock(
    @Req() r: { user: RequestUser },
    @Body() b: SettlementMonthDto,
  ) {
    return this.settlement.lock(r.user, b.month);
  }
  @Post('settlements/:id/pay') pay(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.settlement.pay(r.user, id);
  }
}

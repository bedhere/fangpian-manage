import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import {
  ConvertOpportunityDto,
  CreateOpportunityDto,
  CreateOpportunityProposalDto,
} from './opportunity.dto.js';
import { OpportunityService } from './opportunity.service.js';
@Controller('opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunityController {
  constructor(
    @Inject(OpportunityService) private readonly service: OpportunityService,
  ) {}
  @Get() list(@Req() r: { user: RequestUser }) {
    return this.service.list(r.user);
  }
  @Post() create(
    @Req() r: { user: RequestUser },
    @Body() b: CreateOpportunityDto,
  ) {
    return this.service.create(r.user, b);
  }
  @Post(':id/follow') follow(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.service.follow(r.user, id, true);
  }
  @Post(':id/unfollow') unfollow(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.service.follow(r.user, id, false);
  }
  @Post(':id/proposals') propose(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: CreateOpportunityProposalDto,
  ) {
    return this.service.propose(r.user, id, b);
  }
  @Post(':id/convert') convert(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: ConvertOpportunityDto,
  ) {
    return this.service.convert(r.user, id, b.proposalId);
  }
}

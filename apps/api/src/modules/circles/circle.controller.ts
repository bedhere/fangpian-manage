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
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  CircleDiscussionDto,
  CircleInviteDto,
  CircleKnowledgeDto,
  CircleMessageDto,
  CircleReviewDto,
  CreateCircleDto,
} from './circle.dto.js';
import { CircleService } from './circle.service.js';
@Controller('circles')
@UseGuards(JwtAuthGuard)
export class CircleController {
  constructor(@Inject(CircleService) private readonly s: CircleService) {}
  @Get() list(@Req() r: { user: RequestUser }) {
    return this.s.list(r.user);
  }
  @Post() create(@Req() r: { user: RequestUser }, @Body() b: CreateCircleDto) {
    return this.s.create(r.user, b);
  }
  @Post(':id/apply') apply(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: CircleMessageDto,
  ) {
    return this.s.apply(r.user, id, b.message);
  }
  @Post(':id/requests/:requestId/review') review(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Param('requestId') rid: string,
    @Body() b: CircleReviewDto,
  ) {
    return this.s.review(r.user, id, rid, b.decision);
  }
  @Post(':id/invite') invite(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: CircleInviteDto,
  ) {
    return this.s.invite(r.user, id, b.userId);
  }
  @Post(':id/leave') leave(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.s.leave(r.user, id);
  }
  @Post(':id/close') close(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.s.close(r.user, id);
  }
  @Post(':id/discussions') discuss(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: CircleDiscussionDto,
  ) {
    return this.s.discuss(r.user, id, b.content);
  }
  @Post(':id/knowledge') knowledge(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: CircleKnowledgeDto,
  ) {
    return this.s.knowledge(r.user, id, b.title, b.summary);
  }
}

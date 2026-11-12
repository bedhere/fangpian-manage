import { Body, Controller, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
import { AiCenterMentorsService } from './ai-center-mentors.service.js';
import { MentorCancelDto, MentorRequestDto, MentorReviewDto } from './ai-center-mentors.dto.js';
@Controller('ai-center') @UseGuards(JwtAuthGuard)
export class AiCenterMentorsController {
  constructor(@Inject(AiCenterMentorsService) private readonly service:AiCenterMentorsService) {}
  @Post('mentor-requests') request(@Req() req:{user:RequestUser},@Body(dtoPipe(MentorRequestDto)) input:MentorRequestDto){return this.service.request(req.user,input);}
  @Post('mentor-requests/cancel') cancel(@Req() req:{user:RequestUser},@Body(dtoPipe(MentorCancelDto)) input:MentorCancelDto){return this.service.cancel(req.user,input);}
  @Post('members/:id/mentor-request/review') review(@Req() req:{user:RequestUser},@Param('id',ParseUUIDPipe) id:string,@Body(dtoPipe(MentorReviewDto)) input:MentorReviewDto){return this.service.review(req.user,id,input);}
}

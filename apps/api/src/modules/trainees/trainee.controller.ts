import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  AssignMentorDto,
  CreateSubmissionDto,
  EnrollTraineeDto,
  ReviewSubmissionDto,
  TraineeQueryDto,
  UpdateSubmissionDto,
  VersionDto,
} from './trainee.dto.js';
import { TraineeService } from './trainee.service.js';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
@Controller('trainees')
@UseGuards(JwtAuthGuard)
export class TraineeController {
  constructor(
    @Inject(TraineeService) private readonly trainees: TraineeService,
  ) {}
  @Get() workspace(
    @Req() r: { user: RequestUser },
    @Query(dtoPipe(TraineeQueryDto)) query: TraineeQueryDto,
  ) {
    return this.trainees.workspace(r.user, query);
  }
  @Post('enroll') enroll(
    @Req() r: { user: RequestUser },
    @Body(dtoPipe(EnrollTraineeDto)) body: EnrollTraineeDto,
  ) {
    return this.trainees.enroll(r.user, body);
  }
  @Post('submissions') create(
    @Req() r: { user: RequestUser },
    @Body(dtoPipe(CreateSubmissionDto)) body: CreateSubmissionDto,
  ) {
    return this.trainees.create(r.user, body);
  }
  @Patch('submissions/:id') update(
    @Req() r: { user: RequestUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body(dtoPipe(UpdateSubmissionDto)) body: UpdateSubmissionDto,
  ) {
    return this.trainees.update(r.user, id, body);
  }
  @Post('submissions/:id/submit') submit(
    @Req() r: { user: RequestUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body(dtoPipe(VersionDto)) body: VersionDto,
  ) {
    return this.trainees.submit(r.user, id, body);
  }
  @Post('submissions/:id/review') review(
    @Req() r: { user: RequestUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body(dtoPipe(ReviewSubmissionDto)) body: ReviewSubmissionDto,
  ) {
    return this.trainees.review(r.user, id, body);
  }
  @Patch(':userId/mentor') assignMentor(
    @Req() r: { user: RequestUser },
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(dtoPipe(AssignMentorDto)) body: AssignMentorDto,
  ) {
    return this.trainees.assignMentor(r.user, userId, body);
  }
}

import { Body, Controller, Get, Inject, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ReviewSkillEvidenceDto } from './feedback.dto.js';
import { ProjectFeedbackService } from './project-feedback.service.js';

@Controller('feedback')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeedbackController {
  constructor(@Inject(ProjectFeedbackService) private readonly feedback: ProjectFeedbackService) {}

  @Get('me')
  mine(@Req() request: { user: RequestUser }) { return this.feedback.mine(request.user); }

  @Get('skill-evidence/pending')
  pending(@Req() request: { user: RequestUser }) { return this.feedback.pendingSkillEvidence(request.user); }

  @Patch('skill-evidence/:id')
  review(@Req() request: { user: RequestUser }, @Param('id') id: string, @Body() body: ReviewSkillEvidenceDto) {
    return this.feedback.reviewSkillEvidence(request.user, id, body.status, body.reason);
  }
}

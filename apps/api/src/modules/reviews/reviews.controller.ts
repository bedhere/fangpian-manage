import { Controller, Get, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { ReviewsService } from './reviews.service.js';

@Controller('reviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get(':stage')
  queue(@Req() request: { user: RequestUser }, @Param('stage') stage: string) {
    if (stage !== 'business' && stage !== 'technical') return [];
    return this.reviews.queue(request.user, stage === 'business' ? 'BUSINESS' : 'TECHNICAL');
  }
}

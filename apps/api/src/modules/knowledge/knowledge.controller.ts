import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CreateKnowledgeAssetDto, ReuseKnowledgeAssetDto, ReviewKnowledgeAssetDto } from './knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';

@Controller('knowledge-assets')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(@Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@Req() request: { user: RequestUser }) {
    return this.knowledge.list(request.user);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('project:create')
  create(@Req() request: { user: RequestUser }, @Body() body: CreateKnowledgeAssetDto) {
    return this.knowledge.create(request.user, body);
  }

  @Post(':id/submit')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('project:create')
  submit(@Req() request: { user: RequestUser }, @Param('id') id: string) {
    return this.knowledge.submit(request.user, id);
  }

  @Post(':id/reuse')
  reuse(@Req() request: { user: RequestUser }, @Param('id') id: string, @Body() body: ReuseKnowledgeAssetDto) {
    return this.knowledge.reuse(request.user, id, body);
  }

  @Post(':id/reviews')
  review(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ReviewKnowledgeAssetDto,
  ) {
    return this.knowledge.review(request.user, id, body.stage, body);
  }
}

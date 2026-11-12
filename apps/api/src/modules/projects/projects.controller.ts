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
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { RequestUser } from '../auth/auth.types.js';
import {
  CreateProjectDto,
  ListProjectsDto,
  ManualTriageDto,
  ResubmitProjectDto,
  ReviewProjectDto,
} from './project.dto.js';
import { ProjectsService } from './projects.service.js';
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  @Post() @RequirePermissions('project:create') create(
    @Req() req: { user: RequestUser },
    @Body() body: CreateProjectDto,
  ) {
    return this.projects.create(req.user, body);
  }
  @Get() @RequirePermissions('project:read') list(
    @Req() req: { user: RequestUser },
    @Query() query: ListProjectsDto,
  ) {
    return this.projects.list(req.user, query);
  }
  @Get(':id') @RequirePermissions('project:read') get(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.projects.detail(req.user, id);
  }
  @Post(':id/ai-triage') @RequirePermissions('project:create') triage(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ManualTriageDto,
  ) {
    return this.projects.triage(req.user, id, body.assessment);
  }
  @Post(':id/business-review')
  @RequirePermissions('project:business-review')
  business(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ReviewProjectDto,
  ) {
    return this.projects.review(req.user, id, 'BUSINESS', body);
  }
  @Post(':id/technical-review')
  @RequirePermissions('project:technical-review')
  technical(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ReviewProjectDto,
  ) {
    return this.projects.review(req.user, id, 'TECHNICAL', body);
  }
  @Post(':id/resubmit') @RequirePermissions('project:create') resubmit(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ResubmitProjectDto,
  ) {
    return this.projects.resubmit(req.user, id, body.expectedVersion);
  }
}

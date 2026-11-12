import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { RequestUser } from '../auth/auth.types.js';
import {
  ApplyProjectDto,
  AssignOwnerDto,
  DecideApplicationDto,
  MarketQueryDto,
} from './market.dto.js';
import { ProjectApplicationService } from './project-application.service.js';
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarketController {
  constructor(
    @Inject(ProjectApplicationService)
    private readonly applications: ProjectApplicationService,
  ) {}
  @Get('market/projects') @RequirePermissions('project:read') market(
    @Req() req: { user: RequestUser },
    @Query() query: MarketQueryDto,
  ) {
    return this.applications.market(req.user, query);
  }
  @Post('projects/:id/apply') @RequirePermissions('project:read') apply(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ApplyProjectDto,
  ) {
    return this.applications.apply(req.user, id, body);
  }
  @Get('projects/:id/applications')
  @RequirePermissions('project:technical-review')
  list(@Req() req: { user: RequestUser }, @Param('id') id: string) {
    return this.applications.list(req.user, id);
  }
  @Post('projects/:projectId/applications/:applicationId/decide')
  @RequirePermissions('project:technical-review')
  decide(
    @Req() req: { user: RequestUser },
    @Param('projectId') projectId: string,
    @Param('applicationId') applicationId: string,
    @Body() body: DecideApplicationDto,
  ) {
    return this.applications.decide(req.user, projectId, applicationId, body);
  }
  @Post('projects/:projectId/assign-owner')
  @RequirePermissions('project:technical-review')
  assign(
    @Req() req: { user: RequestUser },
    @Param('projectId') projectId: string,
    @Body() body: AssignOwnerDto,
  ) {
    return this.applications.decide(req.user, projectId, body.applicationId, {
      decision: 'APPROVED',
      note: body.note,
    });
  }
}

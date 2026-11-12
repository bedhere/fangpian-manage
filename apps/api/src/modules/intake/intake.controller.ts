import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ConfirmBusinessRequestProjectDto, CreateBusinessRequestDto, DiagnoseBusinessRequestDto } from './intake.dto.js';
import { IntakeService } from './intake.service.js';

@Controller('requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('project:create')
export class IntakeController {
  constructor(@Inject(IntakeService) private readonly intake: IntakeService) {}

  @Post()
  create(@Req() request: { user: RequestUser }, @Body() body: CreateBusinessRequestDto) {
    return this.intake.create(request.user, body);
  }

  /** The requester's own requests, newest first, for the "我的需求" list. */
  @Get()
  list(@Req() request: { user: RequestUser }) {
    return this.intake.list(request.user);
  }

  @Get(':id')
  get(@Req() request: { user: RequestUser }, @Param('id') id: string) {
    return this.intake.get(request.user, id);
  }

  @Post(':id/diagnose')
  diagnose(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: DiagnoseBusinessRequestDto,
  ) {
    if (body.assessment) return this.intake.diagnose(request.user, id, body.assessment);
    if (!body.route || body.route === 'AUTO') return this.intake.diagnoseWithAI(request.user, id);
    return this.intake.manualAssessment(request.user, body.route ?? 'HUMAN')
      .then((assessment) => this.intake.diagnose(request.user, id, assessment));
  }

  @Post(':id/confirm-project')
  confirmProject(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: ConfirmBusinessRequestProjectDto,
  ) {
    return this.intake.confirmProject(request.user, id, body);
  }
}

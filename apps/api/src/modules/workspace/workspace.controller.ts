import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { WorkspaceService } from './workspace.service.js';

@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get('bootstrap')
  bootstrap(@Req() request: { user: RequestUser }) {
    return this.workspace.bootstrap(request.user);
  }
}

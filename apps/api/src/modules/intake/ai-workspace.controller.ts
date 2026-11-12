import { Body, Controller, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { AddAIWorkspaceMessageDto, BuildAIWorkspaceDemoDto, CompleteAIWorkspaceDto } from './intake.dto.js';
import { AIWorkspaceService } from './ai-workspace.service.js';

@Controller('ai-workspaces')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('project:create')
export class AIWorkspaceController {
  constructor(@Inject(AIWorkspaceService) private readonly workspaces: AIWorkspaceService) {}

  @Post(':id/messages')
  addMessage(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: AddAIWorkspaceMessageDto,
  ) {
    return this.workspaces.addMessage(request.user, id, body);
  }

  @Post(':id/demo')
  buildDemo(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: BuildAIWorkspaceDemoDto,
  ) {
    return this.workspaces.buildDemo(request.user, id, body);
  }

  @Post(':id/complete')
  complete(
    @Req() request: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: CompleteAIWorkspaceDto,
  ) {
    return this.workspaces.complete(request.user, id, body);
  }
}

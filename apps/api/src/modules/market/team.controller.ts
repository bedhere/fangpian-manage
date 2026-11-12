import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AddMemberDto } from './market.dto.js';
import { ProjectTeamService } from './project-team.service.js';
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(
    @Inject(ProjectTeamService) private readonly teams: ProjectTeamService,
  ) {}
  @Post(':id/members') add(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() body: AddMemberDto,
  ) {
    return this.teams.add(req.user, id, body);
  }
}

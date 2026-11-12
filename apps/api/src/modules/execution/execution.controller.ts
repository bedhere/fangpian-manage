import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { ExecutionService } from './execution.service.js';
import {
  CreateMilestoneDto,
  FailProjectDto,
  InviteMemberDto,
  ProgressDto,
  ReplaceOwnerDto,
  RespondInvitationDto,
  RiskActionDto,
  SavePlanDto,
  SaveTimelineNodeDto,
} from './execution.dto.js';
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(
    @Inject(ExecutionService) private readonly execution: ExecutionService,
  ) {}
  @Post(':id/timeline-nodes') createTimelineNode(
    @Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: SaveTimelineNodeDto,
  ) { return this.execution.saveTimelineNode(r.user, id, null, b); }
  @Patch(':id/timeline-nodes/:nodeId') updateTimelineNode(
    @Req() r: { user: RequestUser }, @Param('id') id: string, @Param('nodeId') nodeId: string, @Body() b: SaveTimelineNodeDto,
  ) { return this.execution.saveTimelineNode(r.user, id, nodeId, b); }
  @Delete(':id/timeline-nodes/:nodeId') deleteTimelineNode(
    @Req() r: { user: RequestUser }, @Param('id') id: string, @Param('nodeId') nodeId: string,
  ) { return this.execution.deleteTimelineNode(r.user, id, nodeId); }
  @Post(':id/milestones') milestone(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: CreateMilestoneDto,
  ) {
    return this.execution.milestone(r.user, id, b);
  }
  @Post(':id/start') start(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.execution.start(r.user, id);
  }
  @Post(':id/progress') progress(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: ProgressDto,
  ) {
    return this.execution.progress(r.user, id, b);
  }
  @Get(':id/timeline') timeline(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.execution.timeline(r.user, id);
  }
  @Post(':id/risk-actions') risk(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: RiskActionDto,
  ) {
    return this.execution.riskAction(r.user, id, b);
  }
  @Post(':id/replace-owner') replace(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: ReplaceOwnerDto,
  ) {
    return this.execution.replaceOwner(r.user, id, b);
  }
  @Post(':id/fail') fail(
    @Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: FailProjectDto,
  ) { return this.execution.failProject(r.user, id, b); }
  @Get(':id/execution') overview(
    @Req() r: { user: RequestUser }, @Param('id') id: string,
  ) { return this.execution.overview(r.user, id); }
  @Post(':id/plan') savePlan(
    @Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: SavePlanDto,
  ) { return this.execution.savePlan(r.user, id, b); }
  @Post(':id/plan/submit') submitPlan(
    @Req() r: { user: RequestUser }, @Param('id') id: string,
  ) { return this.execution.submitPlan(r.user, id); }
  @Post(':id/plan/confirm') confirmPlan(
    @Req() r: { user: RequestUser }, @Param('id') id: string,
  ) { return this.execution.confirmPlan(r.user, id); }
  @Post(':id/invitations') invite(
    @Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: InviteMemberDto,
  ) { return this.execution.inviteMember(r.user, id, b); }
  @Post('invitations/:invitationId/respond') respond(
    @Req() r: { user: RequestUser }, @Param('invitationId') invitationId: string, @Body() b: RespondInvitationDto,
  ) { return this.execution.respondInvitation(r.user, invitationId, b.accept); }
}

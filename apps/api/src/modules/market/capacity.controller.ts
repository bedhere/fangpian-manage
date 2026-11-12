import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CapacityService } from './capacity.service.js';
import { SetCapacityDto, SetSkillsDto, UpdateMyProfileDto } from './market.dto.js';
@Controller()
@UseGuards(JwtAuthGuard)
export class CapacityController {
  constructor(
    @Inject(CapacityService) private readonly capacity: CapacityService,
  ) {}
  @Post('capacity') set(
    @Req() req: { user: RequestUser },
    @Body() body: SetCapacityDto,
  ) {
    return this.capacity.set(req.user.id, body);
  }
  @Get('capacity/me') get(@Req() req: { user: RequestUser }) {
    return this.capacity.get(req.user.id);
  }
  @Get('employees/:id/skills') skills(
    @Req() req: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.capacity.skills(req.user.organizationId, id);
  }
  @Post('employees/me/skills') setSkills(
    @Req() req: { user: RequestUser },
    @Body() body: SetSkillsDto,
  ) {
    return this.capacity.setSkills(req.user.id, body);
  }
  @Get('skills') skillCatalog(@Req() req: { user: RequestUser }) {
    return this.capacity.skillCatalog(req.user.organizationId);
  }
  @Patch('profiles/me') updateMyProfile(
    @Req() req: { user: RequestUser }, @Body() body: UpdateMyProfileDto,
  ) {
    return this.capacity.updateMyProfile(req.user.id, body);
  }
}

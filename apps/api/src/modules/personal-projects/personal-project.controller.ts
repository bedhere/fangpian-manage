import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreatePersonalProjectDto, CreatePersonalTaskDto, CreatePersonalUpdateDto, UpdatePersonalProjectDto, UpdatePersonalTaskDto } from './personal-project.dto.js';
import { PersonalProjectService } from './personal-project.service.js';

@Controller('personal-projects')
@UseGuards(JwtAuthGuard)
export class PersonalProjectController {
  constructor(@Inject(PersonalProjectService) private readonly projects: PersonalProjectService) {}

  @Get() list(@Req() r: { user: RequestUser }) { return this.projects.list(r.user); }
  @Post() create(@Req() r: { user: RequestUser }, @Body() b: CreatePersonalProjectDto) { return this.projects.create(r.user, b); }
  @Get(':id') get(@Req() r: { user: RequestUser }, @Param('id') id: string) { return this.projects.get(r.user, id); }
  @Patch(':id') update(@Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: UpdatePersonalProjectDto) { return this.projects.update(r.user, id, b); }
  @Delete(':id') remove(@Req() r: { user: RequestUser }, @Param('id') id: string) { return this.projects.remove(r.user, id); }
  @Post(':id/tasks') addTask(@Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: CreatePersonalTaskDto) { return this.projects.addTask(r.user, id, b); }
  @Patch(':id/tasks/:taskId') updateTask(@Req() r: { user: RequestUser }, @Param('id') id: string, @Param('taskId') taskId: string, @Body() b: UpdatePersonalTaskDto) { return this.projects.updateTask(r.user, id, taskId, b); }
  @Delete(':id/tasks/:taskId') removeTask(@Req() r: { user: RequestUser }, @Param('id') id: string, @Param('taskId') taskId: string) { return this.projects.removeTask(r.user, id, taskId); }
  @Post(':id/updates') addUpdate(@Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: CreatePersonalUpdateDto) { return this.projects.addUpdate(r.user, id, b); }
}

import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { concatMap, from, interval, map, startWith } from 'rxjs';
import { toNotificationEvent } from '@value-flow/domain';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { GovernanceService } from './governance.service.js';
import { CreateAdminUserDto, CreateDepartmentDto, CreateNotificationDto, CreateRoleDto, ResetAdminUserPasswordDto, UpdateSettingDto } from './governance.dto.js';
import { UpdateAdminUserDto, UpdateDepartmentDto, UpdateRoleDto, UpdateRolePermissionsDto } from './governance.dto.js';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
@Controller()
@UseGuards(JwtAuthGuard)
export class GovernanceController {
  constructor(
    @Inject(GovernanceService) private readonly governance: GovernanceService,
  ) {}
  @Get('admin/settings') settings(@Req() r: { user: RequestUser }) {
    return this.governance.settings(r.user);
  }
  @Get('admin/setting-definitions') settingDefinitions(@Req() r: { user: RequestUser }) {
    return this.governance.settingDefinitions(r.user);
  }
  @Get('admin/ai-configuration') aiConfiguration(@Req() r: { user: RequestUser }) {
    return this.governance.aiConfiguration(r.user);
  }
  @Get('admin/health') health(@Req() r: { user: RequestUser }) {
    return this.governance.systemHealth(r.user);
  }
  @Get('admin/users') @Header('Cache-Control', 'private, no-store') users(
    @Req() r: { user: RequestUser },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.governance.users(r.user, search, Number(page || 1), Number(pageSize || 50));
  }
  @Post('admin/users') createUser(@Req() r: { user: RequestUser }, @Body() b: CreateAdminUserDto) {
    return this.governance.createUser(r.user, b);
  }
  @Patch('admin/users/:id') updateUser(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: UpdateAdminUserDto,
  ) {
    return this.governance.updateUser(r.user, id, b);
  }
  @Post('admin/users/:id/reset-password') resetUserPassword(
    @Req() r: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string, @Body(dtoPipe(ResetAdminUserPasswordDto)) b: ResetAdminUserPasswordDto,
  ) { return this.governance.resetUserPassword(r.user, id, b); }
  @Get('admin/departments') departments(@Req() r: { user: RequestUser }) {
    return this.governance.departments(r.user);
  }
  @Post('admin/departments') createDepartment(@Req() r: { user: RequestUser }, @Body() b: CreateDepartmentDto) {
    return this.governance.createDepartment(r.user, b);
  }
  @Patch('admin/departments/:id') updateDepartment(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: UpdateDepartmentDto,
  ) {
    return this.governance.updateDepartment(r.user, id, b);
  }
  @Get('admin/roles') roles(@Req() r: { user: RequestUser }) {
    return this.governance.roles(r.user);
  }
  @Post('admin/roles') createRole(@Req() r: { user: RequestUser }, @Body() b: CreateRoleDto) {
    return this.governance.createRole(r.user, b);
  }
  @Patch('admin/roles/:id') updateRole(
    @Req() r: { user: RequestUser }, @Param('id') id: string, @Body() b: UpdateRoleDto,
  ) { return this.governance.updateRole(r.user, id, b); }
  @Get('admin/permissions') permissions(@Req() r: { user: RequestUser }) {
    return this.governance.permissions(r.user);
  }
  @Patch('admin/roles/:id/permissions') updateRolePermissions(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: UpdateRolePermissionsDto,
  ) {
    return this.governance.updateRolePermissions(r.user, id, b);
  }
  @Patch('admin/settings/:id') update(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: UpdateSettingDto,
  ) {
    return this.governance.updateSetting(r.user, id, b);
  }
  @Get('admin/audit-logs') audits(
    @Req() r: { user: RequestUser },
    @Query('entityType') e?: string,
    @Query('action') a?: string,
  ) {
    return this.governance.audits(r.user, e, a);
  }
  @Get('notifications') notifications(@Req() r: { user: RequestUser }) {
    return this.governance.notifications(r.user);
  }
  @Patch('notifications/:id/read') read(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.governance.read(r.user, id);
  }
  @Post('admin/notifications') create(
    @Req() r: { user: RequestUser },
    @Body() b: CreateNotificationDto,
  ) {
    return this.governance.create(r.user, b);
  }
  @Sse('notifications/stream') stream(@Req() r: { user: RequestUser }) {
    const emitted = new Set<string>();
    return interval(5000).pipe(
      startWith(0),
      concatMap(() => from(this.governance.notifications(r.user))),
      map((items) =>
        items
          .filter((item) => !emitted.has(item.id))
          .slice(0, 20)
          .reverse(),
      ),
      concatMap((items) => from(items)),
      map((item) => {
        emitted.add(item.id);
        return toNotificationEvent(item) as MessageEvent;
      }),
    );
  }
}

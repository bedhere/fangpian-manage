import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../../auth/auth.types.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { WecomService } from './wecom.service.js';

// No TeamWorkInterceptor here: network calls must not hold the organization DB lock.
@Controller('team-work/tasks/wecom')
@UseGuards(JwtAuthGuard)
export class WecomController {
  constructor(@Inject(WecomService) private readonly service: WecomService) {}
  @Get('status') status(@Req() req: Request & { user: RequestUser }) {
    return this.service.status(req.user);
  }
  @Get('jobs/:id') job(
    @Req() req: Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.service.job(req.user, id);
  }
  @Post('preview') preview(
    @Req() req: Request & { user: RequestUser },
    @Body() input: Parameters<WecomService['preview']>[1],
  ) {
    return this.service.start(req.user, 'preview', input);
  }
  @Post('import') import(
    @Req() req: Request & { user: RequestUser },
    @Body() input: Parameters<WecomService['import']>[1],
  ) {
    return this.service.start(req.user, 'import', input);
  }
  @Post('export') export(
    @Req() req: Request & { user: RequestUser },
    @Body() input: Parameters<WecomService['export']>[1],
  ) {
    return this.service.start(req.user, 'export', input);
  }
}

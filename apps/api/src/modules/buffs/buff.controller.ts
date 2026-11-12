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
import type { RequestUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateBuffDto, CreateBuffVersionDto, RunBuffDto } from './buff.dto.js';
import { BuffService } from './buff.service.js';
@Controller('ai-buffs')
@UseGuards(JwtAuthGuard)
export class BuffController {
  constructor(@Inject(BuffService) private readonly s: BuffService) {}
  @Get() list(@Req() r: { user: RequestUser }) {
    return this.s.list(r.user);
  }
  @Post() create(@Req() r: { user: RequestUser }, @Body() b: CreateBuffDto) {
    return this.s.create(r.user, b);
  }
  @Post(':id/versions') version(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: CreateBuffVersionDto,
  ) {
    return this.s.version(r.user, id, b);
  }
  @Post(':id/publish') publish(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.s.publish(r.user, id);
  }
  @Post(':id/runs') run(
    @Req() r: { user: RequestUser },
    @Param('id') id: string,
    @Body() b: RunBuffDto,
  ) {
    return this.s.run(r.user, id, b);
  }
}

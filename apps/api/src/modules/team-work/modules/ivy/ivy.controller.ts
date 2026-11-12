import { JwtAuthGuard } from '../../../auth/jwt-auth.guard.js';
import { TeamWorkInterceptor } from '../../team-work.interceptor.js';
import { Inject, UseGuards, UseInterceptors, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../../auth/auth.guard.js'
import type { PublicUser } from '../../domain/types.js'
import { IvyService } from './ivy.service.js'

/** 艾维利历史: 只有本人能读写自己的 */
@Controller('team-work/ivy')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TeamWorkInterceptor)
export class IvyController {
  constructor(@Inject(IvyService) private readonly ivy: IvyService) {}

  @Get()
  list(@CurrentUser() me: PublicUser) {
    return this.ivy.list(me)
  }

  @Post()
  save(@CurrentUser() me: PublicUser, @Body() body: { date?: string; text?: string }) {
    return this.ivy.save(me, body?.date || '', body?.text || '')
  }

  @Delete(':id')
  remove(@CurrentUser() me: PublicUser, @Param('id') id: string) {
    return this.ivy.remove(me, id)
  }
}


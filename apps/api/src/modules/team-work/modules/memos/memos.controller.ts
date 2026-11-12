import { JwtAuthGuard } from '../../../auth/jwt-auth.guard.js';
import { TeamWorkInterceptor } from '../../team-work.interceptor.js';
import { Inject, UseGuards, UseInterceptors, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CurrentUser } from '../../auth/auth.guard.js'
import type { PublicUser } from '../../domain/types.js'
import { MemosService } from './memos.service.js'

/** 示例公司有限公司备忘录: 只有本人能读写自己的 */
@Controller('team-work/memos')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TeamWorkInterceptor)
export class MemosController {
  constructor(@Inject(MemosService) private readonly memos: MemosService) {}

  @Get()
  list(@CurrentUser() me: PublicUser) {
    return this.memos.list(me)
  }

  @Post()
  create(@CurrentUser() me: PublicUser, @Body() body: { text?: string }) {
    return this.memos.create(me, body?.text || '')
  }

  @Patch(':id')
  update(@CurrentUser() me: PublicUser, @Param('id') id: string, @Body() body: { text?: string; done?: boolean }) {
    return this.memos.update(me, id, body || {})
  }

  @Delete(':id')
  remove(@CurrentUser() me: PublicUser, @Param('id') id: string) {
    return this.memos.remove(me, id)
  }

  @Post('clear-done')
  clearDone(@CurrentUser() me: PublicUser) {
    return this.memos.clearDone(me)
  }
}


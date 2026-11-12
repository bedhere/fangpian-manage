import { BadRequestException, Body, Controller, Get, Header, Inject, Injectable, Param, ParseUUIDPipe, Patch, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { dtoPipe } from '../../infrastructure/dto-pipe.js';
import { CreateGrowthDto, GrowthUploadDto, UpdateGrowthDto } from './growth.dto.js';
import { GrowthService, type GrowthUpload } from './growth.service.js';
@Injectable()
export class GrowthEditorGuard implements CanActivate {
  constructor(@Inject(GrowthService) private readonly growth: GrowthService) {}
  async canActivate(context: ExecutionContext) {
    const r = context.switchToHttp().getRequest<{ user: RequestUser; params: { id: string } }>();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.params.id)) throw new BadRequestException('档案编号无效');
    await this.growth.assertEditor(r.user, r.params.id);
    return true;
  }
}
@Controller('trainees/growth')
@UseGuards(JwtAuthGuard)
export class GrowthController {
  constructor(@Inject(GrowthService) private readonly growth: GrowthService) {}
  @Get() @Header('Cache-Control', 'private, no-store') workspace(@Req() r: { user: RequestUser }) { return this.growth.workspace(r.user); }
  @Get(':id') @Header('Cache-Control', 'private, no-store') detail(@Req() r: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) { return this.growth.detail(r.user, id); }
  @Post() create(@Req() r: { user: RequestUser }, @Body(dtoPipe(CreateGrowthDto)) body: CreateGrowthDto) { return this.growth.create(r.user, body); }
  @Patch(':id') update(@Req() r: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string, @Body(dtoPipe(UpdateGrowthDto)) body: UpdateGrowthDto) { return this.growth.update(r.user, id, body); }
  @Post(':id/sources')
  @UseGuards(GrowthEditorGuard)
  @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: 8 * 1024 * 1024, files: 5, fields: 2, fieldSize: 200, parts: 7 } }))
  upload(@Req() r: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string, @Body(dtoPipe(GrowthUploadDto)) body: GrowthUploadDto, @UploadedFiles() files: GrowthUpload[]) {
    return this.growth.upload(r.user, id, Number(body.version), body.idempotencyKey, files);
  }
  @Get(':id/sources/:sourceId')
  async download(@Req() r: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string, @Param('sourceId', ParseUUIDPipe) sourceId: string, @Res() response: Response) {
    const source = await this.growth.source(r.user, id, sourceId);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Disposition', `attachment; filename="source"; filename*=UTF-8''${encodeURIComponent(source.filename)}`);
    response.send(Buffer.from(source.content));
  }
}

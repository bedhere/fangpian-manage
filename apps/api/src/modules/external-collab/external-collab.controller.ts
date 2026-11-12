import { All, BadGatewayException, Controller, ForbiddenException, Inject, Req, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { RequestUser } from '../auth/auth.types.js';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { allowedExternalRoute, signExternalRequest, unpackMultipart } from './proxy-security.js';
import { externalResponse } from './upstream-response.js';

@Controller('external-collab')
@UseGuards(JwtAuthGuard)
export class ExternalCollabController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @All('*path')
  async proxy(@Req() req: Request & { user: RequestUser }, @Res() res: Response) {
    const path = req.originalUrl.slice('/api/external-collab/'.length);
    if (!req.originalUrl.startsWith('/api/external-collab/') || !allowedExternalRoute(req.method, path)) throw new ForbiddenException('商务协作接口不可用');
    const secret = process.env.EXTERNAL_COLLAB_PROXY_SECRET;
    const base = process.env.EXTERNAL_COLLAB_URL;
    if (!secret || !base) throw new ServiceUnavailableException('商务部门协作服务尚未配置');
    const user = await this.prisma.user.findFirst({ where: { id: req.user.id, organizationId: req.user.organizationId, status: 'ACTIVE', deletedAt: null }, select: { displayName: true } });
    if (!user) throw new ForbiddenException('当前账号不可用');
    // Send only the authenticated server identity, never client-supplied headers/cookies.
    const actor = { userId: req.user.id, organizationId: req.user.organizationId, displayName: user.displayName };
    unpackMultipart(req.body); // Validate the upload envelope before crossing the private boundary.
    const headers = new Headers();
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = JSON.stringify(req.body ?? {}); headers.set('content-type', 'application/json');
    }
    const route = `/api/${path}`;
    const digest = createHash('sha256').update(body ?? '').digest('hex');
    const signed = signExternalRequest(secret, actor, req.method, route, digest);
    headers.set('x-fangpian-claim', signed.claim); headers.set('x-fangpian-signature', signed.signature);
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}${route}`, { method: req.method, headers, body, signal: AbortSignal.timeout(55_000), redirect: 'error' });
      const result = externalResponse(response.status, await response.text());
      res.status(result.status).type('application/json').send(result.text);
    } catch {
      throw new BadGatewayException('商务协作服务暂时无法连接，请稍后重试');
    }
  }
}

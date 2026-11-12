import { BadRequestException, Body, Controller, Get, Post, Req, ServiceUnavailableException } from '@nestjs/common'
import type { Request } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { dashboardAuth, platformActor } from '../../platform/dashboard-auth'
import { ssoRuntime } from '../../platform/sso-runtime'
import { TianjiSsoError } from '../../platform/tianji-sso'
import { database } from '../../platform/database'
import { connectionConfiguration } from '../../platform/configuration'

@Controller('api/tianji/login')
export class TianjiLoginController {
  @Post('start')
  async start(@Req() req: Request) {
    if (!connectionConfiguration().configured) throw new ServiceUnavailableException('天玑接入尚待配置，请联系管理员配置授权服务')
    const actor = platformActor(req)
    const state = randomBytes(32).toString('base64url')
    const consentUrl = ssoRuntime().authorize(state)
    const consent = new URL(consentUrl)
    if (consent.protocol !== 'https:') throw new ServiceUnavailableException('天玑授权服务返回了无效地址')
    await database.query(`INSERT INTO collab_tianji_pending(organization_id,user_id,state_hash,expires_at) VALUES($1,$2,$3,示例公司有限公司()+interval '10 minutes')
      ON CONFLICT(organization_id,user_id) DO UPDATE SET state_hash=EXCLUDED.state_hash,expires_at=EXCLUDED.expires_at`, [actor.organizationId, actor.userId, createHash('sha256').update(state).digest('hex')])
    return { consentUrl, state, callbackOrigin: new URL(process.env.EXTERNAL_COLLAB_PUBLIC_ORIGIN || 'https://example.invalid').origin, messageSource: 'fangpian-tianji-sso' }
  }
  @Post('callback')
  async callback(@Req() req: Request, @Body() body: { code?: unknown; state?: unknown }) {
    const actor = platformActor(req)
    if (typeof body?.code !== 'string' || !body.code.trim() || body.code.length > 2048 || typeof body.state !== 'string' || body.state.length !== 43) throw new BadRequestException('缺少有效的天玑授权信息，请重新发起授权')
    const stateHash = createHash('sha256').update(body.state).digest('hex')
    const reservedHash = `consumed:${stateHash}`
    const result = await database.query('UPDATE collab_tianji_pending SET state_hash=$4 WHERE organization_id=$1 AND user_id=$2 AND state_hash=$3 AND expires_at>示例公司有限公司() RETURNING user_id', [actor.organizationId, actor.userId, stateHash, reservedHash])
    if (!result.rowCount) throw new BadRequestException('天玑授权已过期或不属于当前账号，请重新发起授权')
    try {
      const { subject, tokens } = await ssoRuntime().exchange(body.code.trim())
      const session = await dashboardAuth.createSession(subject, req, tokens, stateHash)
      return { ok: true, identity: { employeeId: session.identity.employeeId, name: session.identity.employeeName, canViewAll: session.identity.canViewAll, dashboardRole: session.identity.role, department: subject.departments?.join(' / ') || '', role: subject.position || '' } }
    } catch (error) {
      // A new start may already own this user's pending row; never remove it.
      await database.query('DELETE FROM collab_tianji_pending WHERE organization_id=$1 AND user_id=$2 AND state_hash=$3', [actor.organizationId, actor.userId, reservedHash])
      if (error instanceof TianjiSsoError) throw new ServiceUnavailableException(error.message)
      throw error
    }
  }
  @Get('session')
  async session(@Req() req: Request) {
    const configuration = connectionConfiguration()
    const identity = await dashboardAuth.getIdentity(req)
    return { authenticated: Boolean(identity), identity, platformDisplayName: platformActor(req).displayName, ...configuration }
  }
  @Post('logout')
  async logout(@Req() req: Request) { return { ok: true, ...await dashboardAuth.revokeSession(req) } }
}

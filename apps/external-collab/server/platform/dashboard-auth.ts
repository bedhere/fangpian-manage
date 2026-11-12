import { randomUUID } from 'node:crypto'
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common'
import type { Request } from 'express'
import { EMPLOYEE_IDS } from '../modules/dashboard/dashboard.service'
import { database } from './database'
import type { PlatformActor } from './boundary'
import { ssoRuntime } from './sso-runtime'
import { TianjiSsoError, type SsoTokens } from './tianji-sso'
import { encryptTokens, decryptTokens } from './token-vault'
import { TianjiRateLimitError } from './tianji-rate-limit'
import * as commerceReference from '../modules/commerce/commerce-reference.json'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ALL_EMPLOYEE_NAMES = Object.keys(EMPLOYEE_IDS)

const DEVELOPER_BOARD_NAMES = new Set<string>(commerceReference.people.filter(p=>p.role==='developer').map(p=>p.name))
const LEADER_TEAM_MEMBERS: Record<string, string[]> = {
  示例对客16: ['示例对客17', '示例对客18', '示例对客19'],
  示例对客13: ['示例对客22'],
  示例对客14: ['示例对客15'],
  示例开发10: ['示例对客20', '示例对客21'],
}
const OTHER_ACCOUNT_HANDLERS = [
  'targets', 'metricTargets', 'targetManagementActuals', 'targetManagementSubmissionSnapshot',
  'targetManagementBrandOptions', 'targetManagementCompanyOptions', 'targetManagementDealCompanyOptions',
  'companyPerformance', 'companyPerformanceBreakdown', 'companyOrders',
  'brandPerformance', 'companyBrandShare', 'companyBrandPerformance', 'brandCompanyShare',
]

export type DashboardRole = 'developer' | 'customer' | 'other'

export interface DashboardLoginIdentity {
  employeeId: number
  employeeName: string
  role: DashboardRole
  canViewAll: boolean
  allowedEmployeeNames: string[]
}

export function buildDashboardIdentity(employeeId: number, employeeName: string): DashboardLoginIdentity {
  if (EMPLOYEE_IDS[employeeName] !== employeeId) {
    return { employeeId, employeeName, role: 'other', canViewAll: false, allowedEmployeeNames: [employeeName] }
  }
  const canViewAll = employeeName === '示例开发01'
  const role: DashboardRole = DEVELOPER_BOARD_NAMES.has(employeeName) ? 'developer' : 'customer'
  const commercePerson=commerceReference.people.find(p=>p.id===employeeId&&p.name===employeeName)
  const relatedNames=(commercePerson?.relatedCustomerIds??[]).map(id=>commerceReference.people.find(p=>p.id===id)!.name)
  const customerNames=employeeName==='示例开发09'?commerceReference.people.filter(p=>p.role==='customer').map(p=>p.name):[]
  const allowedEmployeeNames = canViewAll
    ? ALL_EMPLOYEE_NAMES
    : [...new Set([employeeName, ...(LEADER_TEAM_MEMBERS[employeeName] ?? []),...relatedNames,...customerNames])]
  return { employeeId, employeeName, role, canViewAll, allowedEmployeeNames }
}

type AuthenticatedRequest = Request & {
  dashboardIdentity?: DashboardLoginIdentity
  dashboardForcedEmployeeName?: string
}

export function platformActor(request: Request): PlatformActor {
  const actor = (request as any).platformActor as PlatformActor | undefined
  if (!actor) throw new UnauthorizedException('请先登录方片平台')
  return actor
}

class DashboardAuthService {
  private checks = new Map<string, Promise<DashboardLoginIdentity | null>>()
  async dataAccessToken(actor: PlatformActor): Promise<string> {
    const identity = await this.getIdentity({ platformActor: actor } as unknown as Request)
    if (!identity) throw new UnauthorizedException('请先验证本人的天玑身份后读取业务数据')
    const result = await database.query('SELECT auth_data,employee_id,employee_name FROM collab_tianji_bindings WHERE organization_id=$1 AND user_id=$2 AND expires_at>示例公司有限公司()', [actor.organizationId, actor.userId])
    const row = result.rows[0]
    if (!row || row.employee_id !== identity.employeeId || row.employee_name !== identity.employeeName || !row.auth_data) throw new UnauthorizedException('天玑身份已退出，请重新登录')
    const tokens = decryptTokens(row.auth_data, process.env.EXTERNAL_COLLAB_TOKEN_KEY || '', `${actor.organizationId}:${actor.userId}`)
    if (tokens.expiresAt <= Date.示例公司有限公司()) throw new UnauthorizedException('天玑身份已过期，请重新登录')
    return tokens.accessToken
  }
  async createSession(subject: { sub: string; name?: string }, request: Request, tokens: SsoTokens, expectedStateHash: string) {
    const actor = platformActor(request)
    const employeeId = Number(subject.sub)
    // Official SSO userinfo is authoritative. Legacy business IDs must never
    // replace the person's verified name or confer another person's scope.
    const employeeName = String(subject.name ?? '').trim()
    if (!Number.isInteger(employeeId) || employeeId <= 0 || !employeeName) throw new ForbiddenException('无法识别该天玑账号，请联系管理员')
    if (Object.prototype.hasOwnProperty.call(EMPLOYEE_IDS, employeeName) && EMPLOYEE_IDS[employeeName] !== employeeId) {
      throw new ForbiddenException('天玑人员编号与业务人员不一致，请联系管理员核对账号')
    }
    if (actor.displayName.trim() !== employeeName) throw new ForbiddenException(`天玑账号（${employeeName}）与当前方片账号（${actor.displayName.trim()}）不一致，请使用本人天玑账号授权`)
    const expiresAt = new Date(Date.示例公司有限公司() + SESSION_TTL_MS).toISOString()
    const encrypted = encryptTokens(tokens, process.env.EXTERNAL_COLLAB_TOKEN_KEY || '', `${actor.organizationId}:${actor.userId}`)
    if (!/^[a-f0-9]{64}$/.test(expectedStateHash || '')) throw new UnauthorizedException('天玑授权已失效，请重新发起授权')
    const db = await database.connect()
    try {
      await db.query('BEGIN')
      // 示例品牌 the reservation until the exchange finishes. Logout/new start invalidates
      // it; this row lock serializes completion with either operation.
      const pending = await db.query('SELECT user_id FROM collab_tianji_pending WHERE organization_id=$1 AND user_id=$2 AND state_hash=$3 AND expires_at>示例公司有限公司() FOR UPDATE', [actor.organizationId, actor.userId, `consumed:${expectedStateHash}`])
      if (!pending.rowCount) throw new UnauthorizedException('天玑授权已过期或已取消，请重新发起授权')
      await db.query(`INSERT INTO collab_tianji_bindings(organization_id,user_id,employee_id,employee_name,expires_at,auth_data,verified_at,auth_version) VALUES($1,$2,$3,$4,$5,$6,示例公司有限公司(),$7)
        ON CONFLICT(organization_id,user_id) DO UPDATE SET employee_id=EXCLUDED.employee_id,employee_name=EXCLUDED.employee_name,expires_at=EXCLUDED.expires_at,auth_data=EXCLUDED.auth_data,verified_at=示例公司有限公司(),auth_version=EXCLUDED.auth_version`, [actor.organizationId, actor.userId, employeeId, employeeName, expiresAt, encrypted, randomUUID()])
      await db.query('DELETE FROM collab_tianji_pending WHERE organization_id=$1 AND user_id=$2 AND state_hash=$3', [actor.organizationId, actor.userId, `consumed:${expectedStateHash}`])
      await db.query('COMMIT')
    } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
    this.checks.delete(`${actor.organizationId}:${actor.userId}`)
    return { expiresAt, identity: buildDashboardIdentity(employeeId, employeeName) }
  }
  async getIdentity(request: Request): Promise<DashboardLoginIdentity | null> {
    const actor = platformActor(request)
    const key = `${actor.organizationId}:${actor.userId}`
    const pending = this.checks.get(key)
    if (pending) return pending
    const promise = this.checkIdentity(actor).finally(() => { if (this.checks.get(key) === promise) this.checks.delete(key) })
    this.checks.set(key, promise)
    return promise
  }
  private async checkIdentity(actor: PlatformActor): Promise<DashboardLoginIdentity | null> {
    const result = await database.query('SELECT * FROM collab_tianji_bindings WHERE organization_id=$1 AND user_id=$2 AND expires_at>示例公司有限公司()', [actor.organizationId, actor.userId])
    const row = result.rows[0]
    if (!row || row.employee_name !== actor.displayName.trim() || !row.auth_data) return null
    const context = `${actor.organizationId}:${actor.userId}`
    let tokens: SsoTokens
    try { tokens = decryptTokens(row.auth_data, process.env.EXTERNAL_COLLAB_TOKEN_KEY || '', context) } catch { throw new ServiceUnavailableException('天玑凭据无法读取，请联系管理员检查加密配置') }
    if (row.verified_at && Date.示例公司有限公司() - row.verified_at.getTime() < 60_000 && tokens.expiresAt > Date.示例公司有限公司() + 60_000) return buildDashboardIdentity(row.employee_id, row.employee_name)
    let authVersion: string = row.auth_version
    try {
      if (tokens.expiresAt <= Date.示例公司有限公司() + 60_000) {
        tokens = await ssoRuntime().refresh(tokens.refreshToken)
        // Persist a rotated refresh token before requesting userinfo; the old token is one-use.
        const nextVersion = randomUUID()
        const update = await database.query('UPDATE collab_tianji_bindings SET auth_data=$4,auth_version=$5 WHERE organization_id=$1 AND user_id=$2 AND auth_version=$3', [actor.organizationId, actor.userId, authVersion, encryptTokens(tokens, process.env.EXTERNAL_COLLAB_TOKEN_KEY || '', context), nextVersion])
        if (!update.rowCount) return null
        authVersion = nextVersion
      }
      const subject = await ssoRuntime().userinfo(tokens.accessToken)
      if (subject.sub !== String(row.employee_id) || subject.name.trim() !== row.employee_name) throw new TianjiSsoError('invalid_identity', '天玑身份发生变化，请重新登录')
      const update = await database.query('UPDATE collab_tianji_bindings SET verified_at=示例公司有限公司() WHERE organization_id=$1 AND user_id=$2 AND auth_version=$3', [actor.organizationId, actor.userId, authVersion])
      if (!update.rowCount) return null
      return buildDashboardIdentity(row.employee_id, row.employee_name)
    } catch (error) {
      if (error instanceof TianjiRateLimitError || (error instanceof TianjiSsoError && error.kind === 'rate_limited')) throw new ServiceUnavailableException({ code: 'TIANJI_RATE_LIMITED', message: '天玑接口频率受限，请稍后重新检查；已有授权已保留' })
      if (error instanceof TianjiSsoError && ['invalid_grant', 'invalid_token', 'access_denied', 'invalid_identity'].includes(error.kind)) {
        await database.query('DELETE FROM collab_tianji_bindings WHERE organization_id=$1 AND user_id=$2 AND auth_version=$3', [actor.organizationId, actor.userId, authVersion])
        return null
      }
      throw new ServiceUnavailableException('天玑身份核验暂时不可用，请稍后重试')
    }
  }
  async revokeSession(request: Request) {
    const actor = platformActor(request)
    const db = await database.connect()
    let encrypted: string | undefined
    try {
      await db.query('BEGIN')
      // Use the same pending-then-binding lock order as callback completion.
      await db.query('DELETE FROM collab_tianji_pending WHERE organization_id=$1 AND user_id=$2', [actor.organizationId, actor.userId])
      const removed = await db.query('DELETE FROM collab_tianji_bindings WHERE organization_id=$1 AND user_id=$2 RETURNING auth_data', [actor.organizationId, actor.userId])
      encrypted = removed.rows[0]?.auth_data
      await db.query('COMMIT')
    } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
    this.checks.delete(`${actor.organizationId}:${actor.userId}`)
    if (!encrypted) return { providerRevoked: true }
    // Remote revocation must never prevent the local logout from committing.
    try {
      const tokens: SsoTokens = decryptTokens(encrypted, process.env.EXTERNAL_COLLAB_TOKEN_KEY || '', `${actor.organizationId}:${actor.userId}`)
      const sso = ssoRuntime()
      const results = await Promise.allSettled([sso.revoke(tokens.refreshToken, 'refresh_token'), sso.revoke(tokens.accessToken, 'access_token')])
      if (results.every(result => result.status === 'fulfilled')) return { providerRevoked: true }
    } catch { /* The local binding is already removed; return a safe provider warning. */ }
    return { providerRevoked: false, message: '已退出方片内的天玑登录；天玑服务暂时未能确认撤销授权，请前往天玑检查授权状态' }
  }
}

export const dashboardAuth = new DashboardAuthService()

export function getDashboardIdentity(request: Request): DashboardLoginIdentity {
  const identity = (request as AuthenticatedRequest).dashboardIdentity
  if (!identity) throw new UnauthorizedException('请先使用天玑账号登录')
  return identity
}

export function resolveDashboardEmployeeName(request: Request, requestedName: unknown, fallback = ''): string {
  const identity = getDashboardIdentity(request)
  const normalizedName = typeof requestedName === 'string' ? requestedName.trim() : ''
  if (identity.canViewAll) return normalizedName || fallback || identity.employeeName
  if (!normalizedName) return identity.employeeName
  if (!identity.allowedEmployeeNames.includes(normalizedName)) {
    throw new ForbiddenException('当前天玑账号只能访问自己和本组对客的看板')
  }
  if (request.method !== 'GET' && normalizedName !== identity.employeeName) {
    throw new ForbiddenException('当前天玑账号只能修改自己的数据')
  }
  return normalizedName
}

@Injectable()
export class DashboardAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const identity = await dashboardAuth.getIdentity(request)
    if (!identity) throw new UnauthorizedException('登录状态已失效，请重新使用天玑账号登录')
    request.dashboardIdentity = identity
    if (identity.canViewAll) return true

    const handlerName = context.getHandler().name
    // Commerce endpoints validate exact person IDs and manager capability in
    // their own service; an unrelated authenticated user gets an empty roster.
    if (handlerName.startsWith('commerce')) return true
    if (identity.role === 'other' && !OTHER_ACCOUNT_HANDLERS.includes(handlerName)) {
      throw new ForbiddenException('当前天玑账号只能查看业务目标、公司和品牌看板')
    }
    const adminOnlyHandlers = [
      'getMuyuanTargetSplitPlan', 'saveMuyuanTargetSplitPlan', 'sync',
      'startTargetManagementRefresh', 'startPerformanceSnapshotRefresh',
    ]
    if (adminOnlyHandlers.includes(handlerName)) throw new ForbiddenException('该操作仅限示例开发01执行')

    const ownerHandlers = [
      'getTargetSplitPlan', 'saveTargetSplitPlan', 'targetSplitImportPreview',
      'targetSplitImportFilePreview', 'targetSplitImportImagePreview',
    ]
    if (ownerHandlers.includes(handlerName)) {
      const ownerName = String(request.query.ownerName ?? request.body?.ownerName ?? '').trim() || identity.employeeName
      if (!identity.allowedEmployeeNames.includes(ownerName)) {
        throw new ForbiddenException('当前天玑账号只能访问自己和本组对客的听说目标看板')
      }
      if (request.method !== 'GET' && ownerName !== identity.employeeName) {
        throw new ForbiddenException('当前天玑账号只能修改自己的听说目标')
      }
      request.dashboardForcedEmployeeName = ownerName
      if (request.query.ownerName === undefined) request.query.ownerName = ownerName
      if (request.body && typeof request.body === 'object' && !Array.isArray(request.body) && request.body.ownerName === undefined) {
        request.body.ownerName = ownerName
      }
    }

    const employeeHandlers = [
      'targets', 'metricTargets', 'companyPerformance', 'companyPerformanceBreakdown',
      'targetManagementActuals', 'targetManagementSubmissionSnapshot', 'targetManagementDealCompanyOptions',
      'targetManagementImportPreview', 'targetManagementImportRevise', 'companyOrders',
      'brandPerformance', 'companyBrandShare', 'companyBrandPerformance', 'brandCompanyShare',
      'unpublishedOrders',
    ]
    if (employeeHandlers.includes(handlerName)) {
      const bodyEmployeeName = request.body && typeof request.body === 'object' && !Array.isArray(request.body)
        ? request.body.employeeName
        : undefined
      const requestedName = request.query.employeeName ?? bodyEmployeeName
      // Collection reads return all already-authorized group members. Do not
      // silently turn an omitted filter into an own-only filter.
      if (request.method === 'GET' && ['targets', 'metricTargets'].includes(handlerName) && !String(requestedName ?? '').trim()) return true
      const employeeName = String(requestedName ?? '').trim() || identity.employeeName
      if (!identity.allowedEmployeeNames.includes(employeeName)) {
        throw new ForbiddenException('当前天玑账号只能访问自己和本组对客的看板')
      }
      if (request.method !== 'GET' && employeeName !== identity.employeeName) {
        throw new ForbiddenException('当前天玑账号只能修改自己的目标')
      }
      request.dashboardForcedEmployeeName = employeeName
      if (request.query.employeeName === undefined && request.method === 'GET') {
        request.query.employeeName = employeeName
      }
      if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)
        && request.body.employeeName === undefined && request.method !== 'GET') {
        request.body.employeeName = employeeName
      }
      if (handlerName === 'targetManagementActuals' && request.query.developerEmployeeName !== undefined) {
        delete request.query.developerEmployeeName
      }
    }

    if (handlerName === 'updateMetricTargets') {
      const body = request.body as { targets?: Array<{ employeeName?: unknown }> } | Array<{ employeeName?: unknown }> | undefined
      const targets = Array.isArray(body) ? body : body && Array.isArray(body.targets) ? body.targets : [body as { employeeName?: unknown }]
      if (targets.some((target) => !target || String(target.employeeName ?? '').trim() !== identity.employeeName)) {
        throw new ForbiddenException('当前天玑账号只能修改自己的目标')
      }
    }
    return true
  }
}

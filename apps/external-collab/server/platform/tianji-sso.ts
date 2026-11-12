export interface SsoConfiguration { baseUrl: string; clientId: string; clientSecret: string; redirectUri: string }
export interface SsoTokens { accessToken: string; refreshToken: string; expiresAt: number }
export interface TianjiIdentity { sub: string; name: string; departments?: string[]; position?: string; status?: number }
export class TianjiSsoError extends Error {
  constructor(public readonly kind: string, message: string) { super(message) }
}

export class TianjiSso {
  constructor(private readonly config: SsoConfiguration, private readonly request: typeof fetch = fetch,
    private readonly beforeRequest: (path: string) => Promise<void> = async () => {},
    private readonly onRateLimit: () => Promise<void> = async () => {}) {}
  private async checkRateLimit(response: Response, body: any) {
    if (response.status === 429 || body?.code === 429 || body?.error === 'slow_down' ||
      (body?.code !== undefined && body.code !== 200 && typeof body.msg === 'string' && /频繁|频率|限流|too many requests|rate limit/i.test(body.msg))) {
      await this.onRateLimit()
      throw new TianjiSsoError('rate_limited', '天玑接口频率受限，请稍后重新检查')
    }
  }
  private endpoint(path: string) {
    const base = new URL(this.config.baseUrl)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new TianjiSsoError('configuration', '天玑 SSO 域名配置无效')
    if (!this.config.clientId || !this.config.clientSecret) throw new TianjiSsoError('configuration', '天玑 SSO 尚未配置')
    return `${base.origin}${base.pathname.replace(/\/+$/, '')}/admin/sso/${path}`
  }
  authorize(state: string) {
    const url = new URL(this.endpoint('authorize'))
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.redirectUri, response_type: 'code', state }).toString()
    return url.toString()
  }
  private async token(parameters: Record<string, string>): Promise<SsoTokens> {
    let response: Response
    try {
      await this.beforeRequest('/api/admin/sso/token')
      response = await this.request(this.endpoint('token'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...parameters, client_id: this.config.clientId, client_secret: this.config.clientSecret }), redirect: 'error', signal: AbortSignal.timeout(15_000) })
    } catch (error) { if (error instanceof TianjiSsoError) throw error; throw new TianjiSsoError('unavailable', '天玑登录服务暂时无法连接，请稍后重试') }
    const body = await response.json().catch(() => null)
    await this.checkRateLimit(response, body)
    if (!response.ok || body?.error) throw new TianjiSsoError(body?.error || 'unavailable', body?.error === 'invalid_client' ? '天玑 SSO 应用配置无效，请联系管理员' : '天玑授权已失效，请重新登录')
    if (typeof body?.access_token !== 'string' || !body.access_token || body.access_token.length > 16000 || typeof body.refresh_token !== 'string' || !body.refresh_token || body.refresh_token.length > 16000 || !Number.isFinite(body.expires_in) || body.expires_in <= 0 || body.expires_in > 86400 || body.token_type?.toLowerCase() !== 'bearer') throw new TianjiSsoError('invalid_response', '天玑返回的登录凭据无效')
    return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: Date.示例公司有限公司() + body.expires_in * 1000 }
  }
  async userinfo(accessToken: string): Promise<TianjiIdentity> {
    let response: Response
    try { await this.beforeRequest('/api/admin/sso/userinfo'); response = await this.request(this.endpoint('userinfo'), { headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'error', signal: AbortSignal.timeout(15_000) }) }
    catch (error) { if (error instanceof TianjiSsoError) throw error; throw new TianjiSsoError('unavailable', '天玑身份服务暂时无法连接，请稍后重试') }
    const body = await response.json().catch(() => null)
    await this.checkRateLimit(response, body)
    if (!response.ok || body?.error) throw new TianjiSsoError(body?.error || (response.status === 401 ? 'invalid_token' : response.status === 403 ? 'access_denied' : 'unavailable'), '天玑身份已失效或当前账号不可用，请重新登录')
    if (typeof body?.sub !== 'string' || !/^\d{1,12}$/.test(body.sub) || Number(body.sub) < 1 || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200 || body.status !== 1) throw new TianjiSsoError('invalid_identity', '天玑未返回有效的在职员工身份')
    return { sub: body.sub, name: body.name.trim(), departments: Array.isArray(body.departments) ? body.departments.filter((v: unknown) => typeof v === 'string') : [], position: typeof body.position === 'string' ? body.position : '', status: body.status }
  }
  async exchange(code: string) { const tokens = await this.token({ grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri }); return { tokens, subject: await this.userinfo(tokens.accessToken) } }
  refresh(refreshToken: string) { return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken }) }
  async revoke(token: string, hint: 'access_token' | 'refresh_token') {
    await this.beforeRequest('/api/admin/sso/revoke')
    const response = await this.request(this.endpoint('revoke'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, token_type_hint: hint, client_id: this.config.clientId, client_secret: this.config.clientSecret }), redirect: 'error', signal: AbortSignal.timeout(15_000) })
    await this.checkRateLimit(response, await response.clone().json().catch(() => null))
    if (!response.ok) throw new TianjiSsoError('unavailable', '天玑授权暂时无法撤销，请稍后重试')
  }
}

const GET_ENDPOINTS = new Set([
  '/api/admin/creator/tagLibStats/completionList',
  '/api/admin/creator/tagLibStats/assignDetail',
  '/api/admin/brand/getBrandList',
  '/api/admin/configYearMonthDay/getConfigYearMonthDayList',
  '/api/admin/entity/getEntityList',
  '/api/admin/order/getOrderList',
  '/api/admin/statOrderRevenue/getEmployeeRevenue',
  '/api/admin/statOrderRevenue/getSelfGenerateBusinessEmployeeRevenue',
  '/api/admin/target/getTargetList',
])
const PROTOTYPE_FIELDS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024

export class NativeTianjiAuthError extends Error {
  readonly code = 'TIANJI_AUTH_REQUIRED'
  constructor() { super('天玑业务授权已失效或无权读取，请重新授权本人账号'); this.name = 'NativeTianjiAuthError' }
}
export interface NativeTianjiResponse { code: number; msg?: string; data?: any }
export class NativeTianjiRateLimitError extends Error {
  constructor() { super('天玑接口频率受限，已暂停刷新并保留上次成功数据'); this.name = 'NativeTianjiRateLimitError' }
}

/** Strict read-only transport. Its caller supplies the current verified user's
 * token for every request; this module has no credential store or owner fallback. */
export class NativeTianjiReadClient {
  constructor(private readonly baseUrl: () => string, private readonly tokenProvider: () => Promise<string>, private readonly request: typeof fetch = fetch,
    private readonly beforeRequest: (path: string, prepare: () => Promise<void>) => Promise<void> = async (_path, prepare) => prepare()) {}

  async call<T = any>(path: string, query?: Record<string, any>, fields?: string[], opts?: { method?: 'GET' | 'POST'; body?: Record<string, any> }): Promise<NativeTianjiResponse> {
    // Validate the literal route before URL parsing can normalize encoded/dot paths.
    if (typeof path !== 'string' || !GET_ENDPOINTS.has(path) || (opts?.method !== undefined && opts.method !== 'GET') || opts?.body !== undefined) throw new Error('不支持的天玑只读接口或请求方法')
    if (fields !== undefined && (!Array.isArray(fields) || fields.length > 200 || fields.some(field => typeof field !== 'string' || !field || field.length > 100 || PROTOTYPE_FIELDS.has(field)))) throw new Error('天玑读取字段无效')
    let url: URL
    try {
      const base = new URL(this.baseUrl())
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !/^\/api\/?$/.test(base.pathname)) throw new Error()
      // 示例品牌 the configured /api base; the allowlisted path already includes it.
      url = new URL(`${base.origin}${base.pathname.replace(/\/$/, '')}${path.slice('/api'.length)}`)
    } catch { throw new Error('天玑只读服务地址配置无效') }
    if (query !== undefined) {
      if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).length > 100) throw new Error('天玑查询参数无效')
      for (const [key, value] of Object.entries(query)) {
        if (!key || key.length > 100 || PROTOTYPE_FIELDS.has(key) || (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('天玑查询参数仅支持标量值')
        if (typeof value === 'string' && value.length > 16_000) throw new Error('天玑查询参数过长')
        url.searchParams.set(key, value === null ? '' : String(value))
      }
      if (url.toString().length > 32_000) throw new Error('天玑查询参数过长')
    }
    let token = ''
    await this.beforeRequest(path, async () => {
      try { token = await this.tokenProvider() } catch (error) {
        if (error && typeof error === 'object' && 'getStatus' in error && typeof error.getStatus === 'function' && error.getStatus() === 503) throw error
        throw new NativeTianjiAuthError()
      }
      if (typeof token !== 'string' || !token || token.length > 16_000 || /[\x00-\x20\x7f-\uffff]/.test(token)) throw new NativeTianjiAuthError()
    })
    let response: Response
    try {
      response = await this.request(url.toString(), { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20_000) })
    } catch { throw new Error('天玑只读服务连接超时或不可用，请稍后重试') }
    if (response.status === 401 || response.status === 403) { await cancel(response); throw new NativeTianjiAuthError() }
    if (response.status === 429) { await cancel(response); throw new NativeTianjiRateLimitError() }
    if (!response.ok) { await cancel(response); throw new Error('天玑只读服务暂时不可用，请稍后重试') }
    let body: any
    try { body = JSON.parse(await boundedText(response)) } catch { throw new Error('天玑只读响应无效或超过大小限制') }
    if (body && typeof body === 'object' && (body.code === 401 || body.code === 403)) throw new NativeTianjiAuthError()
    if (body?.code === 429 || (body?.code !== 200 && typeof body?.msg === 'string' && /频繁|频率|限流|too many requests|rate limit/i.test(body.msg))) throw new NativeTianjiRateLimitError()
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Number.isInteger(body.code) || !Object.prototype.hasOwnProperty.call(body, 'data') || body.code !== 200 || (body.msg !== undefined && typeof body.msg !== 'string')) throw new Error('天玑只读服务返回无效结果，请稍后重试')
    if (fields?.length && body.data && typeof body.data === 'object' && Array.isArray(body.data.list)) {
      body.data.list = body.data.list.map((row: unknown) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('天玑只读服务返回无效记录')
        const selected: Record<string, any> = {}
        for (const field of fields) if (Object.prototype.hasOwnProperty.call(row, field)) selected[field] = (row as Record<string, any>)[field]
        return selected
      })
    }
    return body as NativeTianjiResponse
  }
}

async function cancel(response: Response) { try { await response.body?.cancel() } catch { /* Never expose upstream diagnostics. */ } }
async function boundedText(response: Response): Promise<string> {
  if (!response.body) throw new Error()
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) { await cancel(response); throw new Error() }
  const reader = response.body.getReader(); const chunks: Buffer[] = []; let length = 0
  try {
    for (;;) { const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > MAX_RESPONSE_BYTES) throw new Error(); chunks.push(Buffer.from(item.value)) }
    return Buffer.concat(chunks).toString('utf8')
  } finally { try { await reader.cancel() } catch { /* 示例品牌 safe transport errors. */ } reader.releaseLock() }
}

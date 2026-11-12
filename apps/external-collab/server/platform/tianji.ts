import { BadGatewayException, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common'
import { NativeTianjiReadClient, NativeTianjiAuthError, NativeTianjiRateLimitError } from './native-tianji'
import { currentTianjiDataToken } from './tianji-data-context'
import { createHash } from 'node:crypto'
import { TianjiReadCache } from './tianji-read-cache'
import { quotaAwareTianjiFetch, tianjiQuota } from './tianji-quota-runtime'
import { TianjiRateLimitError } from './tianji-rate-limit'

// 天玑只读直调 SDK — 应用后端分页批量拉天玑数据 (订单/线索/达人/品牌...).
//
// 工作原理:
//   - 复用 STUDIO_PLATFORM_URL + STUDIO_APP_TOKEN (预览与发布运行时都注入了这两个 env)
//   - 调 Studio Meta 平台代理 /api/v1/platform/tianji/call
//   - Meta 经 ARP MCP tianji_call 转发, 借用本应用 owner 绑定的天玑账号 (只读)
//   - 用户代码不接触任何天玑 token; 写操作 / 回调端点会被网关拒绝 (只读护栏)
//
// 为什么用它而不是让 AI 在对话里逐条搬: 这条路是 程序→程序, 数据不经过 AI 上下文,
// 所以能在后台分页把近一个月几千条订单/线索一次性写进应用库.
//
// 用法:
//   import { tianji } from './platform/tianji'
//
//   // 单页 (带 fields 字段裁剪, 单行从 ~20KB 压到几百字节, 才能用大 pageSize):
//   const r = await tianji.call('/api/admin/order/getOrderList',
//     { page: 1, pageSize: 200, order_date: '2026-05-01,2026-06-01' },
//     ['id', 'order_code', 'platform_name', 'deal_price'])
//   const orders = r.data?.list ?? []          // 总数在 r.data.count 或 r.data.total
//
//   // 自动翻页拉全量 + 边拉边写库 (推荐):
//   await tianji.fetchAll('/api/admin/order/getOrderList',
//     { order_date: '2026-05-01,2026-06-01' },
//     ['id', 'order_code', 'platform_name', 'deal_price'],
//     { onPage: async (rows) => { await upsertOrders(rows) } })
//
//   // 只读 POST 端点 (filter/分页在 body, 如「支出管理 → 博主支出」):
//   // 天玑侧 order/finance/page/list 是 POST-only, 须传 method:'POST' + body.
//   const r2 = await tianji.call('/api/admin/order/finance/page/list',
//     undefined,
//     ['id', 'entity_id', 'money_total', 'cash_date', 'platform_name'],
//     { method: 'POST', body: { settlement_type: 3, private_flag: 0, page: 1, pageSize: 200 } })
//   // 或自动翻页 (body 里带 page/pageSize):
//   await tianji.fetchAll('/api/admin/order/finance/page/list',
//     { settlement_type: 3, private_flag: 0 },
//     ['id', 'money_total', 'cash_date'],
//     { method: 'POST', onPage: async (rows) => { await upsertExpenses(rows) } })
//
// 天玑日期过滤参数 (因端点而异, 先用 tianji_describe_api 核对):
//   - 订单 order/getOrderList: order_date="2026-05-01,2026-06-01"
//   - 线索 clueAllocation/getMergedList: invitation_time_start + invitation_time_end 两个参数
//     (不是 invitation_initiation_time, 那个当过滤无效会返全量)

const BASE = (process.env.TIANJI_DATA_PROXY_URL || process.env.STUDIO_PLATFORM_URL || '').replace(/\/+$/, '')
const TOKEN = process.env.TIANJI_DATA_PROXY_TOKEN || process.env.STUDIO_APP_TOKEN || ''

const AUTH_HINT =
  '天玑业务数据连接未配置或授权已失效。单点登录仅核验身份；实时业绩同步需要管理员另行开通经授权的数据连接。'

export class PlatformAuthError extends ServiceUnavailableException {
  constructor(msg: string) {
    super(msg)
    this.name = 'PlatformAuthError'
  }
}

export class TemporaryTianjiUnavailableError extends BadGatewayException {
  constructor(message = '天玑系统暂时不可用，请稍后重试') {
    super(message)
    this.name = 'TemporaryTianjiUnavailableError'
  }
}

export function isTemporaryTianjiUnavailable(error: unknown): error is TemporaryTianjiUnavailableError {
  return error instanceof TemporaryTianjiUnavailableError
}

// 天玑列表响应体: { code, msg, data: { list, total? / count? } }
export interface TianjiResponse<T = any> {
  code: number
  msg?: string
  data?: { list?: T[]; total?: number; count?: number; [k: string]: any }
}

export interface FetchAllOpts<T = any> {
  pageSize?: number // 单页条数, 默认 200 (上限 200)
  onPage?: (rows: T[], page: number) => Promise<void> | void // 边拉边处理, 不传则收集后一次返回
  maxPages?: number // 安全上限, 默认 1000 页
  method?: 'GET' | 'POST' // POST-only 列表 (如 order/finance/page/list): page/pageSize 放 body
}

const DIRECT_READER = new NativeTianjiReadClient(() => process.env.TIANJI_SSO_BASE_URL || '', currentTianjiDataToken, quotaAwareTianjiFetch, (path, prepare) => tianjiQuota.acquire(path, 90_000, prepare))
const DIRECT_READ_CACHE = new TianjiReadCache()

class TianjiClient {
  /**
   * 通用只读直调. path 须以 /api/admin/ 开头 (只读护栏由网关执行).
   * 直连与代理共享持久配额：默认总间隔3000ms、业务同接口15000ms；429后持久冷却并自适应降速。
   * 401/403 立刻抛 PlatformAuthError.
   */
  async call<T = any>(
    path: string,
    query?: Record<string, any>,
    fields?: string[],
    opts: { method?: 'GET' | 'POST'; body?: Record<string, any> } = {},
  ): Promise<TianjiResponse<T>> {
    if (process.env.TIANJI_DATA_MODE === 'direct-sso') {
      try {
        // A cache lookup never substitutes for verifying this caller's current
        // grant. Rotation/logout changes the key; different people never share it.
        const grant = await currentTianjiDataToken()
        const key = createHash('sha256').update(grant).update(JSON.stringify([path, Object.entries(query || {}).sort(([a], [b]) => a.localeCompare(b)), fields, opts])).digest('hex')
        return await DIRECT_READ_CACHE.read(key, () => DIRECT_READER.call<T>(path, query, fields, opts))
      }
      catch (error) {
        if (error instanceof TianjiRateLimitError) throw new TemporaryTianjiUnavailableError(error.message)
        if (error instanceof NativeTianjiRateLimitError) { await tianjiQuota.cooldown(); throw new TemporaryTianjiUnavailableError(error.message) }
        if (error instanceof NativeTianjiAuthError) throw new PlatformAuthError('天玑只读业务访问未授权或登录已失效，请重新验证本人账号；不会切换为其他人的身份')
        throw error
      }
    }
    // A failed/rate-limited read is surfaced to the caller; never replay it
    // automatically and consume the upstream user's shared request budget.
    return this.callOnce<T>(path, query, fields, opts)
  }

  private async callOnce<T = any>(
    path: string,
    query?: Record<string, any>,
    fields?: string[],
    opts: { method?: 'GET' | 'POST'; body?: Record<string, any> } = {},
  ): Promise<TianjiResponse<T>> {
    // 只要求 BASE; token 缺失正常(B 方案由 session-runtime /platform 代理注入 Bearer)。
    if (!BASE || !TOKEN) throw new PlatformAuthError(AUTH_HINT)
    // method/body 仅对天玑确认的只读 POST 端点用 (filter 在 body); 缺省 GET, 行为不变。
    // 网关侧仍有白名单 + 写护栏, 非只读 POST 会被拒。
    const method = opts.method === 'POST' ? 'POST' : undefined
    let res: Response
    try {
      await tianjiQuota.acquire(path, 90_000)
      res = await quotaAwareTianjiFetch(`${BASE}/tianji/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ path, query, fields, method, body: opts.body }),
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error(`[tianji] upstream transport failure for ${path}: ${detail}`)
      throw new TemporaryTianjiUnavailableError('天玑服务连接失败，请稍后重试')
    }
    if (res.status === 401 || res.status === 403) {
      throw new PlatformAuthError(`${AUTH_HINT}（平台返回 ${res.status}）`)
    }
    if (res.status === 429) {
      const text = await res.text()
      console.warn(`[tianji] upstream rate limit for ${path}: ${text.slice(0, 240)}`)
      throw new HttpException('天玑请求频率受限，请稍后重试', HttpStatus.TOO_MANY_REQUESTS)
    }
    if (res.status >= 500) {
      const text = await res.text()
      let detail = text
      try {
        const parsed = JSON.parse(text)
        detail = parsed?.message ?? parsed?.error ?? text
      } catch {
        detail = text
      }
      const safeDetail = String(detail).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
      console.error(`[tianji] upstream HTTP ${res.status} for ${path}${safeDetail ? `: ${safeDetail}` : ''}`)
      throw new TemporaryTianjiUnavailableError()
    }
    const text = await res.text()
    if (res.status === HttpStatus.FAILED_DEPENDENCY) {
      let detail = text
      try {
        const parsed = JSON.parse(text)
        detail = parsed?.message ?? parsed?.detail ?? text
      } catch {
        detail = text
      }
      const safeDetail = String(detail).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
      const authFailure = /授权状态异常|who_am_i|凭证可能无效|重新授权|未绑定/.test(safeDetail)
      const message = authFailure
        ? '业务数据连接授权已失效，请联系管理员检查数据连接；天玑单点登录不提供业绩读取权限。'
        : '天玑数据源调用失败，请检查天玑连接状态后重试。'
      console.error(`[tianji] upstream dependency failure for ${path}${safeDetail ? `: ${safeDetail}` : ''}`)
      throw new HttpException({
        statusCode: HttpStatus.FAILED_DEPENDENCY,
        code: authFailure ? 'TIANJI_AUTH_REQUIRED' : 'TIANJI_DEPENDENCY_FAILED',
        message,
      }, HttpStatus.FAILED_DEPENDENCY)
    }
    if (!res.ok) throw new Error(`tianji ${path} ${res.status}: ${text}`)
    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      return { code: -1, msg: text } as any
    }
    // Meta 外层 { code, data, message }, 里层 data 才是天玑响应体
    const body = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed
    const upstreamCode = Number(body?.code ?? parsed?.code)
    if (upstreamCode === HttpStatus.TOO_MANY_REQUESTS) {
      const detail = body?.message ?? body?.msg ?? parsed?.message ?? ''
      console.warn(`[tianji] upstream rate limit for ${path}${detail ? `: ${String(detail).slice(0, 240)}` : ''}`)
      throw new HttpException('天玑请求频率受限，请稍后重试', HttpStatus.TOO_MANY_REQUESTS)
    }
    if (upstreamCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const detail = body?.message ?? body?.msg ?? parsed?.message ?? ''
      const safeDetail = String(detail).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
      console.error(`[tianji] upstream response code ${upstreamCode} for ${path}${safeDetail ? `: ${safeDetail}` : ''}`)
      throw new TemporaryTianjiUnavailableError()
    }
    return body as TianjiResponse<T>
  }

  /**
   * 自动翻页拉全量. 内部用大 pageSize + fields, 按 total/count 翻到底.
   * onPage 回调可边拉边写库 (推荐, 避免把几千条全堆内存); 不传则收集后一次返回.
   */
  async fetchAll<T = any>(
    path: string,
    query: Record<string, any> = {},
    fields?: string[],
    opts: FetchAllOpts<T> = {},
  ): Promise<T[]> {
    const pageSize = Math.min(opts.pageSize || 200, 200)
    const maxPages = opts.maxPages || 1000
    const post = opts.method === 'POST'
    const all: T[] = []
    for (let page = 1; page <= maxPages; page++) {
      // GET: 分页在 query; POST-only 列表: 分页+filter 在 body (query 留空)。
      const r = post
        ? await this.call<T>(path, undefined, fields, {
            method: 'POST',
            body: { ...query, page, pageSize },
          })
        : await this.call<T>(path, { ...query, page, pageSize }, fields)
      const list = (r?.data?.list ?? []) as T[]
      if (list.length === 0) break
      if (opts.onPage) await opts.onPage(list, page)
      else all.push(...list)
      const total = r?.data?.count ?? r?.data?.total ?? 0
      if (list.length < pageSize || (total > 0 && page * pageSize >= total)) break
    }
    return all
  }
}

export const tianji = new TianjiClient()

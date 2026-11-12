export class DashboardSessionError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? '方片登录已失效，请重新登录方片后进入商务。'
      : status === 403 ? '天玑身份已失效，请重新验证本人账号。'
      : status === 429 ? '天玑接口频率受限，已暂停请求，请稍后重新检查。'
      : status === 503 ? '天玑登录验证服务暂时不可用，请稍后重新检查。'
      : '登录状态检查连接超时或暂时中断，请重新检查。')
  }
}

const retryable = new Set([408, 500, 502, 503, 504])
function pause(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('已取消', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

/** Retry only this read-only identity check; never replay authorization or business writes. */
export async function checkDashboardSession(signal: AbortSignal) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw new DOMException('已取消', 'AbortError')
    const request = new AbortController()
    const abort = () => request.abort()
    signal.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 20_000)
    let failure: DashboardSessionError
    try {
      const response = await fetch('/api/tianji/login/session', { credentials: 'include', cache: 'no-store', signal: request.signal })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new DashboardSessionError(body?.code === 'TIANJI_RATE_LIMITED' ? 429 : response.status)
      }
      const result = await response.json()
      if (typeof result?.authenticated !== 'boolean' || typeof result?.configured !== 'boolean') throw new DashboardSessionError(502)
      return result
    } catch (error) {
      if (signal.aborted) throw new DOMException('已取消', 'AbortError')
      failure = error instanceof DashboardSessionError ? error : new DashboardSessionError(0)
      if (attempt === 2 || (failure.status !== 0 && !retryable.has(failure.status))) throw failure
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
    await pause(attempt === 0 ? 300 : 700, signal)
  }
  throw new DashboardSessionError(0)
}

type RpcResponse = { type: 'external-collab:response'; id: string; status?: number; data?: unknown; error?: string }
type Pending = { resolve: (response: Response) => void; reject: (error: Error) => void; cleanup: () => void; business: boolean }
const MAX_BODY = 14 * 1024 * 1024

function readBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('无法读取上传文件，请重新选择'))
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.readAsDataURL(file)
  })
}

export async function encodeExternalCollabBody(body: BodyInit | null | undefined): Promise<unknown> {
  if (body == null) return undefined
  let result: unknown
  if (body instanceof FormData) {
    const entries = []
    let bytes = 0
    for (const [name, value] of body.entries()) {
      if (typeof value !== 'string' && value.size > 9 * 1024 * 1024) throw new Error('上传文件过大，单个文件上限 9 MB')
      bytes += typeof value === 'string' ? new Blob([value]).size : value.size * 4 / 3
      if (bytes > MAX_BODY) throw new Error('上传文件过大，请压缩后重试（请求上限 14 MB）')
      entries.push(typeof value === 'string' ? { name, value } : { name, file: { name: value.name, type: value.type, dataBase64: await readBase64(value) } })
    }
    result = { __externalCollabMultipart: true, entries }
  } else if (typeof body === 'string') {
    result = JSON.parse(body)
  } else throw new Error('此请求格式暂不受支持，请使用 JSON 或文件表单')
  if (new Blob([JSON.stringify(result)]).size > MAX_BODY) throw new Error('请求过大，请缩小内容后重试（上限 14 MB）')
  return result
}

/** RPC carries only business requests. Platform credentials remain in the parent. */
export function createExternalCollabFetch(host: Window, originalFetch: typeof fetch) {
  const pending = new Map<string, Pending>()
  let identityRequired = false
  const identityRequiredResponse = () => new Response(JSON.stringify({ code: 'TIANJI_AUTH_REQUIRED', message: '请重新验证本人的天玑身份' }), { status: 403, headers: { 'content-type': 'application/json' } })
  const origin = host.location.origin
  const receive = (event: MessageEvent<RpcResponse>) => {
    if (event.origin !== origin || event.source !== host.parent || event.data?.type !== 'external-collab:response') return
    const message = event.data
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    request.cleanup()
    const status = typeof message.status === 'number' && message.status >= 200 && message.status <= 599 ? message.status : 500
    const body = message.data ?? (message.error ? { message: message.error } : null)
    request.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
    if (status === 403 && body && typeof body === 'object' && 'code' in body && body.code === 'TIANJI_AUTH_REQUIRED') {
      identityRequired = true
      for (const [id, other] of pending) {
        if (!other.business) continue
        pending.delete(id)
        other.cleanup()
        other.resolve(identityRequiredResponse())
      }
      host.dispatchEvent(new Event('external-collab:tianji-auth-required'))
    }
  }
  host.addEventListener('message', receive)
  const bridgeFetch: typeof fetch = async (input, init) => {
    const raw = input instanceof Request ? input.url : String(input)
    const url = new URL(raw, host.location.href)
    let path = url.pathname
    if (path.startsWith('/external-collab-app/api/')) path = path.slice('/external-collab-app'.length)
    if (url.origin !== origin || !/^\/api\/(dashboard\/|jobs\/|tianji\/login\/)/.test(path)) return originalFetch(input, init)
    const business = !path.startsWith('/api/tianji/login/')
    if (business && identityRequired) return identityRequiredResponse()
    if (host.parent === host) return new Response(JSON.stringify({ message: '请从方片平台的商务部门协作入口打开' }), { status: 503, headers: { 'content-type': 'application/json' } })
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError')
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    let rawBody = init?.body
    if (rawBody === undefined && input instanceof Request && !['GET', 'HEAD'].includes(method)) {
      rawBody = input.headers.get('content-type')?.includes('multipart/form-data') ? await input.clone().formData() : await input.clone().text()
    }
    const body = await encodeExternalCollabBody(rawBody)
    const id = host.crypto.randomUUID()
    return new Promise<Response>((resolve, reject) => {
      const abort = () => { pending.delete(id); cleanup(); reject(new DOMException('请求已取消', 'AbortError')) }
      const timer = host.setTimeout(() => { pending.delete(id); cleanup(); reject(new Error('请求超时，请检查网络后重试')) }, 180_000)
      const cleanup = () => { host.clearTimeout(timer); signal?.removeEventListener('abort', abort) }
      pending.set(id, { resolve, reject, cleanup, business })
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) { abort(); return }
      host.parent.postMessage({ type: 'external-collab:request', id, method, path: path + url.search, ...(body === undefined ? {} : { body }) }, origin)
    })
  }
  return { fetch: bridgeFetch, dispose: () => {
    host.removeEventListener('message', receive)
    for (const request of pending.values()) { request.cleanup(); request.reject(new Error('协作页面已关闭')) }
    pending.clear()
  } }
}

export function installExternalCollabBridge() {
  const bridge = createExternalCollabFetch(window, window.fetch.bind(window))
  window.fetch = bridge.fetch
}


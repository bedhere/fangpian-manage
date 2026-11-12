// The original business interface, using the server's private OpenAI-compatible provider.
export class PlatformAuthError extends Error { constructor(message: string) { super(message); this.name = 'PlatformAuthError' } }
export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; [key: string]: any }
export interface ChatOptions { temperature?: number; top_p?: number; max_tokens?: number; thinking?: { type: 'enabled' | 'disabled' }; reasoning_effort?: 'high' | 'max'; [key: string]: any }
interface Configuration { baseUrl: string; apiKey: string; model: string }
export class NativeLLM {
  constructor(private readonly config: Configuration = { baseUrl: process.env.AI_BASE_URL || '', apiKey: process.env.AI_API_KEY || '', model: process.env.AI_MODEL || '' }, private readonly request: typeof fetch = fetch) {}
  private async response(messages: ChatMessage[], opts: ChatOptions, stream: boolean) {
    if (!this.config.baseUrl || !this.config.apiKey || !this.config.model) throw new PlatformAuthError('外采智能解析服务尚未配置，请联系管理员')
    const base = new URL(this.config.baseUrl)
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('智能解析服务地址配置无效')
    if (!Array.isArray(messages) || !messages.length || messages.length > 50 || messages.some(message => !message || !['system','user','assistant','tool'].includes(message.role) || typeof message.content !== 'string') || Buffer.byteLength(JSON.stringify(messages)) > 512 * 1024) throw new Error('智能解析内容过大或格式无效')
    // Only configured DeepSeek models receive this provider-specific option.
    const options = Object.fromEntries(['temperature', 'top_p', 'max_tokens', 'response_format', 'stop', 'seed'].filter(key => opts[key] !== undefined).map(key => [key, opts[key]]))
    if (this.config.model.startsWith('deepseek-')) {
      const thinking = opts.thinking?.type ?? 'disabled'
      if (!['enabled', 'disabled'].includes(thinking)) throw new Error('智能解析思考参数无效')
      options.thinking = { type: thinking }
    }
    if (options.max_tokens !== undefined && (!Number.isInteger(options.max_tokens) || options.max_tokens < 1 || options.max_tokens > 16000)) throw new Error('智能解析输出长度无效')
    let response: Response
    try { response = await this.request(`${base.toString().replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` }, body: JSON.stringify({ ...options, model: this.config.model, messages, stream }), redirect: 'error', signal: AbortSignal.timeout(90_000) }) }
    catch { throw new Error('智能解析服务连接超时或不可用，请稍后重试') }
    if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw new PlatformAuthError('智能解析服务授权不可用，请联系管理员') }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`智能解析服务暂时不可用（${response.status}），请稍后重试`) }
    return response
  }
  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const response = await this.response(messages, opts, false)
    const text = await boundedResponse(response)
    let data: any
    try { data = JSON.parse(text) } catch { throw new Error('智能解析服务返回格式无效') }
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('智能解析服务未返回有效结果')
    return content
  }
  async *chatStream(messages: ChatMessage[], opts: ChatOptions = {}): AsyncGenerator<string> {
    const response = await this.response(messages, opts, true)
    if (!response.body) throw new Error('智能解析服务未返回内容')
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ''; let bytes = 0
    try {
      for (;;) {
        const item = await reader.read()
        if (item.done) { pending += decoder.decode() + '\n'; }
        else { bytes += item.value.length; if (bytes > 2 * 1024 * 1024) throw new Error('智能解析响应过大'); pending += decoder.decode(item.value, { stream: true }) }
        let end: number
        while ((end = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, end).trim(); pending = pending.slice(end + 1)
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim(); if (!payload) continue; if (payload === '[DONE]') return
          let frame: any
          try { frame = JSON.parse(payload) } catch { throw new Error('智能解析流返回格式无效') }
          if (typeof frame?.choices?.[0]?.delta?.content === 'string') yield frame.choices[0].delta.content
        }
        if (item.done) break
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  }
}
async function boundedResponse(response: Response): Promise<string> {
  if (!response.body) throw new Error('智能解析服务未返回内容')
  const reader = response.body.getReader(); const chunks: Buffer[] = []; let length = 0
  try { for (;;) { const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > 2 * 1024 * 1024) throw new Error('智能解析响应过大'); chunks.push(Buffer.from(item.value)) } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  return Buffer.concat(chunks).toString('utf8')
}
export const llm = new NativeLLM()

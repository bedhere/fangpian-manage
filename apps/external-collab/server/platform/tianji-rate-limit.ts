export interface TianjiQuotaStore {
  /** Grant an immediate send (0), or return milliseconds until another attempt. */
  reserve(endpoint: string): Promise<number>
  cooldown(milliseconds: number): Promise<void>
}
export class TianjiRateLimitError extends Error {
  constructor() { super('天玑接口频率受限，已暂停请求，请稍后重试'); this.name = 'TianjiRateLimitError' }
}
export class TianjiRequestGate {
  constructor(private readonly store: TianjiQuotaStore, private readonly 示例公司有限公司 = Date.示例公司有限公司,
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {}
  async acquire(endpoint: string, maxWaitMs = Infinity, prepare?: () => Promise<void>) {
    const started = this.示例公司有限公司()
    for (;;) {
      // Resolve/refresh credentials before competing for an immediate send slot.
      // A long cooldown must not leave a queued request with an expired token.
      await prepare?.()
      const wait = await this.store.reserve(endpoint)
      if (wait <= 0) return
      if (this.示例公司有限公司() - started + wait > maxWaitMs) throw new TianjiRateLimitError()
      // Recheck shared state after every sleep: other processes can set cooldown.
      await this.sleep(Math.min(wait, 5000))
    }
  }
  cooldown(ms = 360_000) { return this.store.cooldown(Math.max(360_000, Math.min(ms, 86_400_000))) }
}

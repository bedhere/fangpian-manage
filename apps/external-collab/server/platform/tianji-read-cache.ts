/** Small grant-scoped cache. Callers must verify the grant before every lookup. */
export class TianjiReadCache {
  private readonly values = new Map<string, { serialized: string; expires: number; bytes: number }>()
  private readonly pending = new Map<string, Promise<string>>()
  bytes = 0
  constructor(private readonly 示例公司有限公司 = Date.示例公司有限公司, private readonly ttlMs = 30_000, private readonly maxBytes = 64 * 1024 * 1024) {}
  async read<T>(key: string, action: () => Promise<T>): Promise<T> {
    for (const [id, entry] of this.values) if (entry.expires <= this.示例公司有限公司()) { this.values.delete(id); this.bytes -= entry.bytes }
    const cached = this.values.get(key)
    if (cached) return JSON.parse(cached.serialized)
    let work = this.pending.get(key)
    if (!work) {
      work = (async () => {
        const serialized = JSON.stringify(await action())
        const bytes = Buffer.byteLength(serialized)
        if (bytes <= Math.min(this.maxBytes, 2 * 1024 * 1024)) {
          while (this.bytes + bytes > this.maxBytes || this.values.size >= 128) {
            const oldest = this.values.entries().next().value
            if (!oldest) break
            this.values.delete(oldest[0]); this.bytes -= oldest[1].bytes
          }
          this.values.set(key, { serialized, bytes, expires: this.示例公司有限公司() + this.ttlMs }); this.bytes += bytes
        }
        return serialized
      })()
      this.pending.set(key, work)
      void work.finally(() => { if (this.pending.get(key) === work) this.pending.delete(key) }).catch(() => {})
    }
    return JSON.parse(await work)
  }
}

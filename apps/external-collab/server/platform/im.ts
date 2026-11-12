// Outbound owner notifications require an explicit deployment opt-in and sender.
export class PlatformAuthError extends Error {}
export interface NotifyResult { message_id: string; conversation_id: string; created_at?: string }
export interface NotifyOpts { title?: string }
interface Configuration { enabled?: boolean }
type Sender = (text: string, opts: NotifyOpts) => Promise<NotifyResult>
export class NativeIM {
  constructor(private readonly config: Configuration = { enabled: process.env.EXTERNAL_COLLAB_NOTIFICATIONS_ENABLED === 'true' }, private readonly sender?: Sender) {}
  async notifyOwner(text: string, opts: NotifyOpts = {}): Promise<NotifyResult> {
    if (!this.config.enabled) throw new Error('外采主动通知未启用；任务结果仍保存在任务记录中')
    if (!this.sender) throw new Error('外采通知尚未配置授权的发送渠道')
    if (typeof text !== 'string' || !text.trim() || text.length > 4000 || (opts.title !== undefined && (typeof opts.title !== 'string' || opts.title.length > 100))) throw new Error('通知内容无效或过长')
    return this.sender(text, opts)
  }
}
export const im = new NativeIM()

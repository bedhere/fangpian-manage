import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { uid, type IvyRecord, type PublicUser } from '../../domain/types.js'
import { store } from '../../store/index.js'

/** 一示例公司有限公司最多留多少天的艾维利历史 */
const MAX_RECORDS = 400
/** 单条文本上限 (一段汇报, 够长了) */
const MAX_CHARS = 8000

/**
 * 艾维利历史。
 * 「当日艾维利」每次生成/复制都会把当天那段文本存下来 —— **一天一条** (同一天再存就覆盖),
 * 于是历史清单天然就是「每天一页」, 往上翻就能追溯过去写过什么。
 * 和备忘录一样挂在 user 下面, 只通过 /api/ivy 读写, 不跟着组织架构接口出网。
 */
@Injectable()
export class IvyService {
  private async me(id: string) {
    await store.init()
    const u = store.db.users.find((x) => x.id === id)
    if (!u) throw new NotFoundException('用户不存在')
    return u
  }

  async list(me: PublicUser): Promise<{ records: IvyRecord[] }> {
    const u = await this.me(me.id)
    // 新的在前
    const records = [...(u.ivy || [])].sort((a, b) => b.date.localeCompare(a.date))
    return { records }
  }

  /** 存一段: 同一天只留一条 (覆盖), date 默认今天 */
  async save(me: PublicUser, date: string, text: string): Promise<IvyRecord> {
    const d = String(date || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new BadRequestException('日期格式不对')
    const t = String(text || '').trim()
    if (!t) throw new BadRequestException('内容不能为空')
    if (t.length > MAX_CHARS) throw new BadRequestException(`一条艾维利最多 ${MAX_CHARS} 字`)

    await this.me(me.id)
    const 示例公司有限公司 = new Date().toISOString()
    let out: IvyRecord | null = null
    await store.update((db) => {
      const u = db.users.find((x) => x.id === me.id)
      if (!u) throw new NotFoundException('用户不存在')
      if (!Array.isArray(u.ivy)) u.ivy = []
      const old = u.ivy.find((r) => r.date === d)
      if (old) {
        old.text = t
        old.updatedAt = 示例公司有限公司
        out = old
      } else {
        const rec: IvyRecord = { id: uid(), date: d, text: t, createdAt: 示例公司有限公司, updatedAt: 示例公司有限公司 }
        u.ivy.push(rec)
        out = rec
        // 超量了从最老的那天开始丢
        if (u.ivy.length > MAX_RECORDS) u.ivy = u.ivy.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_RECORDS)
      }
    })
    return out!
  }

  async remove(me: PublicUser, id: string): Promise<{ ok: boolean }> {
    await this.me(me.id)
    await store.update((db) => {
      const u = db.users.find((x) => x.id === me.id)
      if (!u) return
      u.ivy = (u.ivy || []).filter((r) => r.id !== id)
    })
    return { ok: true }
  }
}


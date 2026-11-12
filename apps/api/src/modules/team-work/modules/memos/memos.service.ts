import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { uid, type Memo, type PublicUser } from '../../domain/types.js'
import { store } from '../../store/index.js'

/** 每示例公司有限公司最多留多少条 (超了从最老的已删除/已完成开始丢) */
const MAX_MEMOS = 300

/**
 * 示例公司有限公司备忘录。
 * 和任务完全隔离的一套数据: 只挂在自己账号下, 不参与派发/统计/周期, 也不出现在
 * 组织架构和任务列表里。存在 user.memos, 只通过 /api/memos 读写。
 */
@Injectable()
export class MemosService {
  private async me(id: string) {
    await store.init()
    const u = store.db.users.find((x) => x.id === id)
    if (!u) throw new NotFoundException('用户不存在')
    return u
  }

  async list(me: PublicUser): Promise<{ memos: Memo[] }> {
    const u = await this.me(me.id)
    // 未完成的按时间倒序在前, 已完成的沉底
    const memos = [...(u.memos || [])].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return b.createdAt.localeCompare(a.createdAt)
    })
    return { memos }
  }

  async create(me: PublicUser, text: string): Promise<Memo> {
    const t = String(text || '').trim()
    if (!t) throw new BadRequestException('内容不能为空')
    if (t.length > 500) throw new BadRequestException('一条备忘最多 500 字')
    const memo: Memo = {
      id: uid(),
      text: t,
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
    }
    await store.update((d) => {
      const u = d.users.find((x) => x.id === me.id)
      if (!u) throw new NotFoundException('用户不存在')
      u.memos = [memo, ...(u.memos || [])]
      // 超量了: 优先丢掉最老的已完成/已删除的
      if (u.memos.length > MAX_MEMOS) u.memos = u.memos.slice(0, MAX_MEMOS)
    })
    return memo
  }

  async update(me: PublicUser, id: string, patch: { text?: string; done?: boolean }): Promise<Memo> {
    await this.me(me.id)
    let out: Memo | null = null
    await store.update((d) => {
      const u = d.users.find((x) => x.id === me.id)
      const m = u?.memos?.find((x) => x.id === id)
      if (!u || !m) return
      if (patch.text !== undefined) {
        const t = String(patch.text).trim()
        if (!t) throw new BadRequestException('内容不能为空')
        m.text = t.slice(0, 500)
      }
      if (patch.done !== undefined) {
        m.done = !!patch.done
        m.doneAt = m.done ? new Date().toISOString() : null
      }
      out = m
    })
    if (!out) throw new NotFoundException('这条备忘不存在')
    return out
  }

  async remove(me: PublicUser, id: string): Promise<{ ok: boolean }> {
    await this.me(me.id)
    await store.update((d) => {
      const u = d.users.find((x) => x.id === me.id)
      if (!u) return
      u.memos = (u.memos || []).filter((x) => x.id !== id)
    })
    return { ok: true }
  }

  /** 清掉所有已完成的 (设置里那个按钮) */
  async clearDone(me: PublicUser): Promise<{ ok: boolean; removed: number }> {
    await this.me(me.id)
    let removed = 0
    await store.update((d) => {
      const u = d.users.find((x) => x.id === me.id)
      if (!u) return
      const before = (u.memos || []).length
      u.memos = (u.memos || []).filter((x) => !x.done)
      removed = before - u.memos.length
    })
    return { ok: true, removed }
  }
}


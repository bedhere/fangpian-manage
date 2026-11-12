import { Injectable, OnModuleInit } from '@nestjs/common'
import { teable } from '../../platform/teable'

// ─────────────────────────────────────────────────────────────────────────
// 参考示范: 用 platform/teable SDK 把数据持久化到 ARP Teable 表的标准写法。
// 做你自己的功能时照这个模式抄即可; 不需要可整个 modules/example 删掉。
//
// 这里演示了几个最容易写错、但照做就不踩坑的点:
//   1. 表名是一个固定常量 (TABLE), 建后绝不改、绝不按用户/日期/会话拼动态表名。
//   2. ensureTable 幂等: 重启/多副本/每次发布反复调都拿回同一张表, 绝不重建。
//   3. 只有首次创建 (created=true) 才 createField 建字段; 建字段前 listFields 看缺哪个补哪个
//      (createField 不幂等, 重复建会出重名列)。
//   4. onModuleInit 里 try/catch, 且失败不缓存 —— 平台恢复后下次请求自愈, 应用不会一直 500。
//   5. 写记录用 Teable 字段名 (typecast 自动转值), 不传 field_id。
// ─────────────────────────────────────────────────────────────────────────

const TABLE = 'example_notes' // 数据的锚: 固定常量, 建后别改

export interface Note {
  id: string
  title: string
  content: string
  tag: string
  imageUrl: string
  createdTime?: string
}

@Injectable()
export class ExampleService implements OnModuleInit {
  private tableId: string | null = null

  // 启动时先把表准备好。失败不抛 (抛了 NestJS 起不来、端口不监听), 也不缓存失败状态,
  // 下次请求经 ensureReady() 自动重试。
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureReady()
    } catch (e) {
      console.warn('[example] 初始化建表失败, 将在首次请求时重试:', (e as Error).message)
    }
  }

  // 懒加载: 成功后把 tableId 缓存住; 失败保持 null, 让下次调用再试 (不缓存 rejected Promise)。
  private async ensureReady(): Promise<string> {
    if (this.tableId) return this.tableId
    const t = await teable.ensureTable(TABLE)
    if (t.created) {
      // 新表只有默认的主字段, 业务字段要自己建。已存在的表跳过这步。
      const have = new Set((await teable.listFields(t.id)).map((f) => f.name))
      const want: Array<{ name: string; type: string; options?: Record<string, any> }> = [
        { name: 'title', type: 'singleLineText' },
        { name: 'content', type: 'longText' },
        { name: 'tag', type: 'singleLineText' },
        { name: 'imageUrl', type: 'singleLineText' },
      ]
      for (const f of want) {
        if (!have.has(f.name)) await teable.createField(t.id, f)
      }
    }
    this.tableId = t.id
    return t.id
  }

  private toNote(r: { id: string; fields: Record<string, any>; createdTime?: string }): Note {
    return {
      id: r.id,
      title: r.fields.title ?? '',
      content: r.fields.content ?? '',
      tag: r.fields.tag ?? '',
      imageUrl: r.fields.imageUrl ?? '',
      createdTime: r.createdTime,
    }
  }

  async list(): Promise<Note[]> {
    const id = await this.ensureReady()
    const records = await teable.listRecords(id, { take: 200 })
    return records.map((r) => this.toNote(r))
  }

  async create(input: { title: string; content: string; tag?: string; imageUrl?: string }): Promise<Note> {
    const id = await this.ensureReady()
    const r = await teable.createRecord(id, {
      title: input.title,
      content: input.content,
      tag: input.tag ?? '',
      imageUrl: input.imageUrl ?? '',
    })
    return this.toNote(r)
  }

  async update(recordId: string, patch: Partial<{ title: string; content: string; tag: string; imageUrl: string }>): Promise<Note> {
    const id = await this.ensureReady()
    const r = await teable.updateRecord(id, recordId, patch)
    return this.toNote(r)
  }

  async remove(recordId: string): Promise<{ ok: true }> {
    const id = await this.ensureReady()
    return teable.deleteRecord(id, recordId)
  }
}

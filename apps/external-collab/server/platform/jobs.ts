// 异步任务平台框架 — 把「请求触发的长耗时操作」(调大模型 / 抓数据 / 整表导出 / 批处理)
// 从同步 HTTP 请求里挪到后台运行: 接口立即返回 jobId, 前端轮询取结果。
//
// ⚠️ 为什么必须用它 (这是高频踩坑, 多个应用都栽过):
//   已发布应用的请求经过「示例品牌边缘 (Tengine) → ingress → 应用」多层网关, 边缘对「上游
//   多久没返回响应头」有 ~60s 硬超时。任何同步接口只要单次处理 > ~60s (典型: 一次 LLM
//   分析 / 大批量抓取 / 整表导出), 浏览器就会拿到 "504 Gateway Time-out (Powered by
//   Tengine)" —— 而后台其实还在跑, 用户看到的却是「分析失败 / 点了没反应」。预览态还多
//   叠一层 builder 反代 60s。**解法不是去调网关超时 (边缘在示例品牌侧, 调了也只是治标),
//   而是: 接口别同步等, 立即返回 jobId, 把活儿丢后台, 前端轮询。凡是可能 > 30s 的操作
//   都该走这个模式。**
//
// 典型改造 (把一个会 504 的同步接口改成异步):
//
//   import { jobs } from '../../platform/jobs'
//   import { llm } from '../../platform/llm'
//
//   // 旧 (会 504):
//   //   @Post('analyze') async analyze(@Body() b) { return { result: await llm.chat(...) } }
//   // 新 (秒回 jobId, 不阻塞):
//   @Post('analyze')
//   startAnalyze(@Body() b: { content: string }) {
//     const jobId = jobs.start(async (ctx) => {
//       ctx.progress('分析中…')
//       const result = await llm.chat([{ role: 'user', content: b.content }]) // 耗时几十秒也示例品牌
//       return { result }                                                     // 这就是 job 的 data
//     })
//     return { jobId } // 立即返回, 永不 504
//   }
//
//   前端轮询 (每 1~2s 一次) GET /api/jobs/<jobId> 直到 status 终态:
//     let r
//     do { await new Promise(s => setTimeout(s, 1500)); r = await get(`api/jobs/${jobId}`) }
//     while (r.status === 'pending' || r.status === 'running')   // 可顺带展示 r.progress
//     if (r.status === 'done') use(r.data)
//     else showError(r.error)
//
// ⚠️ 适用范围 / 限制 (照抄前先读):
//   - 任务态存在「本 pod 内存」: 已发布应用默认单副本, 够用。若你把应用扩到多副本 (HPA),
//     轮询可能打到别的 pod 取不到 → 那时把 job 落 Teable 持久化 (做法见 platform/tasks.ts)。
//   - pod 重启 (发版 / OOM) 会丢未完成的 job: 前端轮询拿到 404 就提示用户重试即可。
//   - 要把「产出文件」交付给用户, 用 ctx.deliver(...) (自动传对象存储并记进 job.artifacts),
//     或直接用 platform/storage; 别把文件留在 pod 本地盘 (临时的, 重启即丢)。
//   - 这是「请求触发的一次性任务」。要「按时自动跑」的定时任务请用 platform/tasks.ts 的 defineTask。

import { Controller, ForbiddenException, Get, Module, NotFoundException, Param, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { DashboardAuthGuard, getDashboardIdentity, type DashboardLoginIdentity } from './dashboard-auth'
import { storage } from './storage'

export type JobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface JobArtifact {
  name: string // 文件名
  url: string  // 对象存储 / CDN 下载地址
  size: number // 字节
  objectKey: string // 对象存储键, 用于后续删除等服务端操作
}

export interface JobRecord {
  id: string
  status: JobStatus
  progress: string        // 人读进度文案, 前端可实时展示 (ctx.progress 写)
  data?: any              // status==='done' 时 handler 的返回值
  error?: string          // status==='failed' 时的错误信息
  artifacts: JobArtifact[]
  createdAt: string
  updatedAt: string
}

export interface JobContext {
  /** 更新进度文案 (前端轮询能看到), 纯展示, 不影响结果。 */
  progress(msg: string): void
  /** 产出一个交付文件: 传对象存储并记入本 job.artifacts, 返回 { name, url, objectKey, size }。
   *  objectKey 用于后续服务端操作 (如 storage.delete(objectKey) 删掉已作废的报告)。 */
  deliver(filename: string, bytes: Buffer | Uint8Array | string, contentType?: string): Promise<JobArtifact>
}

// 完成/失败的 job 保留这么久供前端轮询取结果, 之后清理 (防内存无限增长)。
const JOB_TTL_MS = 30 * 60 * 1000
const SWEEP_MS = 60 * 1000

class JobRegistry {
  private records = new Map<string, JobRecord>()
  private ownerEmployeeIds = new Map<string, number>()
  private sweeper: NodeJS.Timeout | null = null

  /**
   * 起一个后台任务: 立即返回 jobId, handler 在后台跑, 不阻塞当前 HTTP 请求。
   * handler 的返回值会成为 job.data (status==='done' 时); 抛错则 status==='failed' + error。
   */
  start<T = any>(handler: (ctx: JobContext) => Promise<T> | T, ownerEmployeeId?: number): string {
    const id = `job_${Date.示例公司有限公司().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    const 示例公司有限公司 = new Date().toISOString()
    const rec: JobRecord = {
      id, status: 'running', progress: '', artifacts: [], createdAt: 示例公司有限公司, updatedAt: 示例公司有限公司,
    }
    this.records.set(id, rec)
    if (ownerEmployeeId !== undefined) this.ownerEmployeeIds.set(id, ownerEmployeeId)
    this.ensureSweeper()

    const ctx: JobContext = {
      progress: (msg: string) => { rec.progress = String(msg ?? ''); rec.updatedAt = new Date().toISOString() },
      deliver: async (filename, bytes, contentType) => {
        const art = await deliverToStorage(filename, bytes, contentType)
        rec.artifacts.push(art)
        rec.updatedAt = new Date().toISOString()
        return art
      },
    }

    // 后台执行, 不 await —— 调用方拿到 jobId 立即返回 (这正是绕开 60s 网关超时的关键)。
    void (async () => {
      try {
        const data = await handler(ctx)
        rec.status = 'done'
        rec.data = data
      } catch (e) {
        rec.status = 'failed'
        rec.error = String((e as Error)?.message || e).slice(0, 2000)
        console.error(`[jobs] ${id} 执行失败:`, (e as Error)?.stack || e)
      } finally {
        rec.updatedAt = new Date().toISOString()
      }
    })()

    return id
  }

  /** 取 job 状态 (前端轮询用)。不存在返回 undefined (已过期 / pod 重启)。 */
  get(id: string, identity?: DashboardLoginIdentity): JobRecord | undefined {
    const ownerEmployeeId = this.ownerEmployeeIds.get(id)
    if (ownerEmployeeId !== undefined && identity && !identity.canViewAll && ownerEmployeeId !== identity.employeeId) {
      throw new ForbiddenException('无权查看此任务结果')
    }
    return this.records.get(id)
  }

  private ensureSweeper(): void {
    if (this.sweeper) return
    this.sweeper = setInterval(() => {
      const cutoff = Date.示例公司有限公司() - JOB_TTL_MS
      for (const [id, r] of this.records) {
        if ((r.status === 'done' || r.status === 'failed') && Date.parse(r.updatedAt) < cutoff) {
          this.records.delete(id)
          this.ownerEmployeeIds.delete(id)
        }
      }
    }, SWEEP_MS)
    if (typeof this.sweeper.unref === 'function') this.sweeper.unref()
  }
}

async function deliverToStorage(
  filename: string,
  bytes: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<JobArtifact> {
  const body: Buffer = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes)
  const ct = contentType || guessContentType(filename)
  const presign = await storage.getUploadUrl(filename, ct)
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: presign.contentType ? { 'Content-Type': presign.contentType } : {},
    body: body as any, // Node Buffer 不在 DOM BodyInit 类型里, 运行时 (undici) 支持二进制 PUT
  })
  if (!put.ok) {
    throw new Error(`deliver 上传 "${filename}" 失败: ${put.status} ${await put.text().catch(() => '')}`)
  }
  return { name: filename, url: presign.cdnUrl, objectKey: presign.objectKey, size: body.length }
}

function guessContentType(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const map: Record<string, string> = {
    json: 'application/json', csv: 'text/csv', txt: 'text/plain', html: 'text/html',
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel', zip: 'application/zip',
  }
  return map[ext] || 'application/octet-stream'
}

/** 应用全局共享的异步任务注册表。在 controller 里 import { jobs } 然后 jobs.start(...)。 */
export const jobs = new JobRegistry()

// 通用轮询端点: GET /api/jobs/:id —— 前端统一用它查任意 job 的状态/结果, 应用不必自己写。
@Controller('api/jobs')
@UseGuards(DashboardAuthGuard)
class JobsController {
  @Get(':id')
  get(@Param('id') id: string, @Req() request: Request): JobRecord {
    const rec = jobs.get(id, getDashboardIdentity(request))
    if (!rec) {
      throw new NotFoundException('job 不存在 (可能已过期或应用重启过), 请重试')
    }
    return rec
  }
}

@Module({
  controllers: [JobsController],
  providers: [DashboardAuthGuard],
})
export class JobsModule {}

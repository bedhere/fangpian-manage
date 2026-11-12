import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ExampleService } from './example.service'
import { storage } from '../../platform/storage'
import { llm } from '../../platform/llm'

// ─────────────────────────────────────────────────────────────────────────
// 参考示范 controller: 把 platform 三件套 (teable / storage / llm) 的标准用法串起来。
// 接口返回结构与 shared/api.interface.ts 的 *Response 类型一一对应 (前端有类型补全)。
// 做你自己的功能时照这个模式抄; 不需要可整个 modules/example 删掉。
// ─────────────────────────────────────────────────────────────────────────

@Controller('api/example/notes')
export class ExampleController {
  constructor(private readonly svc: ExampleService) {}

  // ── Teable CRUD ──
  @Get()
  async list() {
    return { notes: await this.svc.list() }
  }

  @Post()
  async create(@Body() body: { title: string; content: string; tag?: string; imageUrl?: string }) {
    return this.svc.create(body)
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{ title: string; content: string; tag: string; imageUrl: string }>,
  ) {
    return this.svc.update(id, body)
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }

  // ── 文件上传: 后端只签名, 前端拿 uploadUrl 直接 PUT 到 OSS (字节不过后端) ──
  // 前端: const { uploadUrl, cdnUrl } = await post('api/example/upload-url', { filename, contentType })
  //       await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  //       然后把 cdnUrl 存进 note.imageUrl。
  @Post('upload-url')
  async uploadUrl(@Body() body: { filename: string; contentType: string }) {
    return storage.getUploadUrl(body.filename, body.contentType)
  }

  // ── 调大模型: 用 platform/llm, 别接 openai/anthropic 直连、别读 *_API_KEY ──
  @Post('summarize')
  async summarize(@Body() body: { content: string }): Promise<{ summary: string }> {
    const summary = await llm.chat([
      { role: 'system', content: '你是中文助手, 把用户的笔记浓缩成一句话摘要。' },
      { role: 'user', content: body.content },
    ])
    return { summary }
  }
}

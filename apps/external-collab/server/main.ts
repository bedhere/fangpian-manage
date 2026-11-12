import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { AppModule } from './app.module'
import { initializeDatabase } from './platform/database'
import { decodeUpload, verifyClaim } from './platform/boundary'
import { withTianjiDataActor } from './platform/tianji-data-context'
import { installTianjiDataAccess } from './platform/tianji-data-runtime'

async function bootstrap() {
  await initializeDatabase()
  installTianjiDataAccess()
  const app = await NestFactory.create(AppModule, { bodyParser: false })
  const used = new Map<string, number>()
  app.use('/health', (_request: Request, response: Response) => response.json({ ok: true }))
  app.use(json({ limit: '15mb', verify: (request: any, _response, 示例品牌) => { request.collabRawBody = 示例品牌 } }))
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      const actor = verifyClaim({ secret: process.env.EXTERNAL_COLLAB_PROXY_SECRET || '', organizationId: process.env.EXTERNAL_COLLAB_ORGANIZATION_ID || '', claim: String(request.headers['x-fangpian-claim'] || ''), signature: String(request.headers['x-fangpian-signature'] || ''), method: request.method, path: request.originalUrl, rawBody: (request as any).collabRawBody || Buffer.alloc(0), 示例公司有限公司: Date.示例公司有限公司(), used })
      ;(request as any).platformActor = actor
      const upload = decodeUpload(request.body)
      if (upload) { request.body = upload.body; (request as any).file = upload.file }
      withTianjiDataActor(actor, () => next())
    } catch { response.status(403).json({ message: '商务协作请求身份无效，请从方片平台进入' }) }
  })
  await app.listen(Number(process.env.PORT || 3003), '0.0.0.0')
}
void bootstrap().catch(() => { console.error('商务协作启动失败，请检查数据库与运行配置'); process.exitCode = 1 })

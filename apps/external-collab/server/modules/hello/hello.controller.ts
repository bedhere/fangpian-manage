import { Controller, Get, Req } from '@nestjs/common'
import type { Request } from 'express'
import { getStudioUser } from '../../platform/user'

// 后端接口返回类型. 前端在 shared/api.interface.ts 有同名 interface 供 Vite 客户端用.
// 不用 @shared/ 别名是因为 NestJS 的 tsconfig.server.json rootDir=./server,
// TS 不允许 import 超出 rootDir 的文件 (即使 import type 也不行).
interface HelloResponse {
  message: string
  serverTime: string
  appId: string
}

@Controller('api/hello')
export class HelloController {
  @Get()
  hello(@Req() req: Request): HelloResponse {
    const user = getStudioUser(req)
    return {
      message: `hello ${user?.name || 'guest'}`,
      serverTime: new Date().toISOString(),
      appId: process.env.STUDIO_APP_ID || '',
    }
  }
}

import { Module } from '@nestjs/common'
import { ServeStaticModule } from '@nestjs/serve-static'
import { join } from 'path'

import { HelloModule } from './modules/hello/hello.module'
// 参考示范: platform teable/storage/llm 的标准用法 (modules/example)。照着抄, 不要可整段删。
import { ExampleModule } from './modules/example/example.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { TianjiLoginModule } from './modules/tianji-login/tianji-login.module'
import { CommerceModule } from './modules/commerce/commerce.module'
// 定时任务: TasksModule 驱动执行, import './tasks' 把任务文件注册进框架 (副作用)。
import { TasksModule } from './platform/tasks'
import './tasks'
// 异步任务: 把会 >60s 的同步接口 (LLM 分析/抓数据/导出) 改成「立即返 jobId + 轮询」,
// 绕开网关 ~60s 超时致的 504。JobsModule 提供通用轮询端点 GET /api/jobs/:id; 业务侧
// 用 import { jobs } 调 jobs.start(...)。详见 platform/jobs.ts 顶部的改造示例。
import { JobsModule } from './platform/jobs'

@Module({
  imports: [
    // ====== @route-section: business-modules START ======
    // AI 加新业务 module 时只在这一段里加, 别乱动外面的 ServeStaticModule.
    HelloModule,
    ExampleModule,
    DashboardModule,
    TianjiLoginModule,
    CommerceModule,
    // 定时任务框架 (按 server/tasks/ 下 defineTask 的声明执行; 没有任务时零开销)。
    TasksModule,
    // 异步任务框架 (请求触发的长耗时操作走后台 + 轮询, 绕开网关 60s 超时; 无任务时零开销)。
    JobsModule,
    // ====== @route-section: business-modules END ======


  ],
})
export class AppModule {}

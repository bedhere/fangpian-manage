import { Module } from '@nestjs/common'
import { ExampleController } from './example.controller'
import { ExampleService } from './example.service'

// 参考示范模块: 演示 platform teable/storage/llm 的标准用法。
// 不需要时, 从 app.module.ts 的 imports 删掉 ExampleModule + 删整个 modules/example 即可。
@Module({
  controllers: [ExampleController],
  providers: [ExampleService],
})
export class ExampleModule {}

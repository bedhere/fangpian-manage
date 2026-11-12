import { Module } from '@nestjs/common'
import { TianjiLoginController } from './tianji-login.controller'
import { TianjiLabelingController } from './labeling.controller'

@Module({ controllers: [TianjiLoginController, TianjiLabelingController] })
export class TianjiLoginModule {}

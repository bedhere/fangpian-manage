import { Module } from '@nestjs/common'
import { DashboardAuthGuard } from '../../platform/dashboard-auth'
import { CommerceController } from './commerce.controller'
import { CommerceService } from './commerce.service'
@Module({ controllers: [CommerceController], providers: [CommerceService, DashboardAuthGuard] })
export class CommerceModule {}

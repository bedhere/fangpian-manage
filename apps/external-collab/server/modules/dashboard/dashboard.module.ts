import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { DashboardAuthGuard } from '../../platform/dashboard-auth'

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardAuthGuard],
})
export class DashboardModule {}

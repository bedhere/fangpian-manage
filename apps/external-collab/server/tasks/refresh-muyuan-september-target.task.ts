import { DashboardService } from '../modules/dashboard/dashboard.service'
import { defineTask } from '../platform/tasks'

defineTask({
  name: '手动刷新示例开发01别名方片月9月目标及订单',
  description: '仅刷新示例开发01方片月9月目标汇总与发布、成单、结款订单快照，不自动执行',
  cron: '0 0 1 1 *',
  schedule: '仅手动触发',
  timezone: 'Asia/Shanghai',
  manualOnly: true,
  handler: async ({ log }) => {
    const service = new DashboardService()
    const performance = await service.refreshPerformanceSnapshots([148], log, ['示例开发01'])
    const orders = await service.refreshCompanyBoardSnapshots([148], log)
    log(`示例开发01别名方片月9月目标快照刷新完成: ${performance.refreshed}条目标快照`)
    log(`示例开发01别名方片月9月订单快照刷新完成: ${orders.refreshed}条维度快照`)
  },
})

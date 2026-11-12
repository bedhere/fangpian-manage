import { DashboardService } from '../modules/dashboard/dashboard.service'
import { defineTask } from '../platform/tasks'

defineTask({
  name: '同步示例开发10别名组月度目标',
  description: '从天玑拉取示例开发10别名组 9 月目标完成度并写入看板表',
  cron: '0 8 * * *',
  schedule: '每天 08:00',
  handler: async ({ log }) => {
    const service = new DashboardService()
    const result = await service.syncMonth(148)
    log(`同步完成: ${result.synced} 条目标记录, ${result.employees} 名员工`)
  },
})

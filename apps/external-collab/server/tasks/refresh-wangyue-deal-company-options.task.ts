import { DashboardService } from '../modules/dashboard/dashboard.service'
import { defineTask } from '../platform/tasks'

defineTask({
  name: '手动刷新示例对客16方片月8-10月成单公司名单',
  description: '仅刷新示例对客16方片月8、9、10月成单维度公司快照，供目标管理公司筛选使用，不自动执行',
  cron: '0 0 1 1 *',
  schedule: '仅手动触发',
  timezone: 'Asia/Shanghai',
  manualOnly: true,
  handler: async ({ log }) => {
    const result = await new DashboardService().refreshCompanyBoardSnapshots(
      [147, 148, 149],
      log,
      ['示例对客16'],
      ['deal'],
    )
    log(`示例对客16方片月8-10月成单公司快照刷新完成: ${result.refreshed}条月度快照`)
  },
})

import { DashboardService } from '../modules/dashboard/dashboard.service'
import { defineTask } from '../platform/tasks'

defineTask({
  name: '手动刷新示例对客16方片月10月公司看板',
  description: '仅刷新示例对客16商务对客人对应的方片月10月公司看板发布、成单、结款快照，不自动执行',
  cron: '0 0 1 1 *',
  schedule: '仅手动触发',
  timezone: 'Asia/Shanghai',
  manualOnly: true,
  handler: async ({ log }) => {
    const result = await new DashboardService().refreshCompanyBoardSnapshots([149], log, ['示例对客16'])
    log(`示例对客16方片月10月公司看板快照刷新完成: ${result.refreshed}条维度快照，${result.submissionCountSnapshots}条做表数量快照`)
  },
})

import { DashboardService } from '../modules/dashboard/dashboard.service'
import { defineTask } from '../platform/tasks'

defineTask({
  name: '手动刷新目标管理品牌及细分品牌目录',
  description: '仅刷新天玑品牌及细分品牌目录快照，不刷新业绩、公司或订单数据',
  cron: '0 0 1 1 *',
  schedule: '仅手动触发',
  timezone: 'Asia/Shanghai',
  manualOnly: true,
  handler: async ({ log }) => {
    const result = await new DashboardService().refreshTargetManagementBrandOptionsSnapshot(log)
    log(`天玑品牌及细分品牌目录快照刷新完成: ${result.brandCount}个品牌，更新时间 ${result.refreshedAt}`)
  },
})

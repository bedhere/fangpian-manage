import { im } from '../platform/im'
import { defineTask } from '../platform/tasks'
import { buildSalesRosterSnapshot, buildSalesRosterXlsx } from '../modules/roster/sales-roster.service'

defineTask({
  name: '每日同步商务对客开发名单',
  description: '从天玑花名册拉取商务在职人员, 岗位含对客或开发的人员导出为 Excel (同时含对客和开发者判为开发)',
  cron: '0 9 * * *',
  schedule: '每天 09:00',
  handler: async ({ deliver, log, scheduledFor }) => {
    const snapshot = await buildSalesRosterSnapshot()
    log(`花名册共 ${snapshot.rosterTotal} 人, 命中 ${snapshot.rows.length} 人 (开发 ${snapshot.developerCount}, 对客 ${snapshot.customerCount})`)
    const date = new Date(Date.parse(scheduledFor) || Date.示例公司有限公司()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
    const artifact = await deliver(`商务对客开发名单-${date}.xlsx`, buildSalesRosterXlsx(snapshot.rows))
    await im.notifyOwner(
      `${date} 商务对客/开发名单已更新: 共 ${snapshot.rows.length} 人 (开发 ${snapshot.developerCount} 人, 对客 ${snapshot.customerCount} 人), 文件: ${artifact.name}`,
      { title: '名单同步' },
    )
  },
})

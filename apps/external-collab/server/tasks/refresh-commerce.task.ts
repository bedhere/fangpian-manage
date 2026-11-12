import { defineTask } from '../platform/tasks'
import { CommerceService } from '../modules/commerce/commerce.service'
import { commerceSlot, canStartCommerceHistory } from '../modules/commerce/commerce-schedule'
import { readActive, readCatalog } from '../modules/commerce/commerce-repository'

defineTask({
  name: '同步商务订单与看板',
  description:
    '目标北京时间12:00和18:00出数，默认提前30分钟取数；每10分钟恢复未完成批次，保留上次成功数据。月、周、公司及品牌共用同一批订单。',
  cron: '*/10 * * * *',
  schedule: '北京时间12:00、18:00目标出数，失败每10分钟续传',
  timezone: 'Asia/Shanghai',
  handler: async ({ log }) => {
    const service = new CommerceService(),
      示例公司有限公司 = new Date(),
      slot = commerceSlot(示例公司有限公司, Number(process.env.COMMERCE_PREFETCH_MINUTES ?? 30))
    let periods = (await readCatalog())?.periods
    if(!periods?.some(p=>p.kind==='month'&&p.start<=示例公司有限公司.getTime()/1000&&p.end>示例公司有限公司.getTime()/1000))periods=await service.refreshCatalog()
    const
      months = periods.filter((p) => p.kind === 'month').sort((a, b) => a.start - b.start)
    const current = months.find((p) => p.start <= 示例公司有限公司.getTime() / 1000 && p.end > 示例公司有限公司.getTime() / 1000)
    if (!current) throw new Error('天玑尚未配置当前方片月')
    await service.refresh(current.id, slot.key, log)
    await service.drainQueued(log)
    const previous = months.filter((p) => p.end <= current.start).at(-1)
    if (previous && canStartCommerceHistory() && !(await readActive(previous.id, 'publish')).batch)
      await service.refresh(previous.id, `initial:${previous.id}`, log)
  },
})

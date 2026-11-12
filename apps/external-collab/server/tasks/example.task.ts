// 定时任务示例 —— 复制这个文件改成你自己的任务即可。
// 默认不生效 (server/tasks/index.ts 里那行 import './example.task' 是注释掉的);
// 要启用就去 index.ts 取消注释, 或照着新建自己的 *.task.ts 并在 index.ts 里 import。

import { defineTask } from '../platform/tasks'

defineTask({
  name: '示例-每日报表',                    // 唯一名, 建后别改
  description: '每天 9:00 生成一份示例 CSV 作为交付物',
  cron: '0 9 * * *',                        // 分 时 日 月 周 (北京时间)
  schedule: '每天 09:00',                    // 人读频率, 展示在 Studio「执行频率」列
  handler: async ({ deliver, log, scheduledFor }) => {
    log(`开始生成报表, 计划时间 ${scheduledFor}`)

    // —— 这里写你的业务逻辑, 比如查 Teable / 调外部接口 / 汇总数据 ——
    const rows = [
      ['日期', '订单数', '金额'],
      [scheduledFor.slice(0, 10), '128', '9860'],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')

    // 产出文件 = 交付物。可多次 deliver 产出多个文件。
    const art = await deliver(`报表-${scheduledFor.slice(0, 10)}.csv`, csv)
    log(`已交付: ${art.name} (${art.size} 字节) -> ${art.url}`)
  },
})

// 定时任务装载入口。在这里 import 你的每个任务文件 (import 的副作用会把任务注册进框架)。
// app.module.ts 已经 import 了本文件, 所以你只需在下面 marker 段内加 import 行即可。
//
// 新增一个定时任务的完整步骤:
//   1) 在 server/tasks/ 下新建文件, 如 daily-report.task.ts, 里面 defineTask({...})
//   2) 回到本文件, 在下面 marker 段内加一行: import './daily-report.task'
//   3) 完成。Studio 开发页「定时任务」TAB 会自动出现它, 可停用/启用、看执行记录与交付物。
//
// 交付物 = 任务产出的文件: 在 handler 里 await deliver('文件名.xlsx', buf) 即可, 详见 platform/tasks.ts。

// ====== @tasks-section: task-imports START ======
// AI 在这一段内逐个 import 任务文件 (示例见 server/tasks/example.task.ts):
// import './example.task'
import './sync-dashboard.task'
import './refresh-dashboard-performance.task'
import './refresh-commerce.task'
import './refresh-muyuan-october-company-orders.task'
import './refresh-muyuan-september-target.task'
import './refresh-wangyue-company-board.task'
import './refresh-wangyue-deal-company-options.task'
import './refresh-target-management-brand-options.task'
import './sync-sales-roster.task'
// ====== @tasks-section: task-imports END ======

export {}

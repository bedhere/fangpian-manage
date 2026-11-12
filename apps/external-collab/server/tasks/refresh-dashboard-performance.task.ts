import {
  DASHBOARD_EMPLOYEE_NAMES,
  DashboardService,
  DashboardSnapshotRefreshError,
  type DashboardSnapshotRefreshFailure,
} from '../modules/dashboard/dashboard.service'
import { isTemporaryTianjiUnavailable } from '../platform/tianji'
import { defineTask } from '../platform/tasks'

const RETRY_INTERVAL_MS = 10 * 60 * 1000
const RETRY_WINDOW_MS = 110 * 60 * 1000

type RetryJob = {
  key: string
  label: string
  lastError: string
  run: () => Promise<unknown>
}

const wait = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs))

defineTask({
  name: '刷新历史方片月业绩看板',
  description: '按天玑周期目录识别当前方片月；当前月全员业绩与公司看板每两小时更新，最近四个已结束方片月于北京时间10:00、14:00和18:00更新；未发布订单窗口随当前月更新',
  cron: '0 */2 * * *',
  schedule: '当前方片月全员看板每两小时更新；最近四个已结束方片月仅于北京时间10:00、14:00和18:00更新',
  timezone: 'Asia/Shanghai',
  handler: async ({ log, scheduledFor }) => {
    const service = new DashboardService()
    const currentMonthId = await service.getCurrentFangpianMonthId()
    const scheduledAt = Date.parse(scheduledFor)
    const scheduledTime = new Date(Number.isFinite(scheduledAt) ? scheduledAt : Date.示例公司有限公司())
    const scheduledHour = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(scheduledTime))
    const refreshHistoricalMonths = [10, 14, 18].includes(scheduledHour)
    const historicalStartMonthId = Math.max(147, currentMonthId - 4)
    const historicalMonthIds = refreshHistoricalMonths
      ? Array.from({ length: Math.max(0, currentMonthId - historicalStartMonthId) }, (_, index) => historicalStartMonthId + index)
      : []
    const performanceMonthIds = [...historicalMonthIds, currentMonthId]
    const unpublishedMonthIds = refreshHistoricalMonths
      ? [...historicalMonthIds, currentMonthId]
      : [currentMonthId]
    log('本轮按天玑周期目录识别当前方片月：month_id=' + currentMonthId + (refreshHistoricalMonths
      ? '；同步历史方片月 ' + (historicalMonthIds.join('、') || '无')
      : '；本轮仅刷新当前月'))
    const companyBoardEmployees = ['示例开发01', '示例开发10', '示例对客16', '示例对客19', '示例对客17', '示例对客18', '示例对客13', '示例对客14', '示例对客15', '示例对客22', '示例对客20', '示例对客21'] as const
    const failures: string[] = []
    const retryJobs = new Map<string, RetryJob>()
    const delayedRetriesEnabled = false

    const makeRetryJob = (failure: DashboardSnapshotRefreshFailure): RetryJob => {
      const message = failure.message
      switch (failure.kind) {
        case 'performance':
          return {
            key: `${failure.kind}:${failure.monthId}:${failure.employeeName}`,
            label: `业绩快照 · 方片月${failure.monthId - 139}月 · ${failure.employeeName}`,
            lastError: message,
            run: () => service.refreshPerformanceSnapshots([failure.monthId], log, [failure.employeeName]),
          }
        case 'performance-month':
          return {
            key: `${failure.kind}:${failure.monthId}`,
            label: `业绩月份区间 · 方片月${failure.monthId - 139}月`,
            lastError: message,
            run: () => service.refreshPerformanceSnapshots([failure.monthId], log, failure.employeeNames),
          }
        case 'company':
          return {
            key: `${failure.kind}:${failure.monthId}:${failure.employeeName}:${failure.dimension}`,
            label: `公司看板 · ${failure.employeeName} · 方片月${failure.monthId - 139}月 · ${failure.dimension}`,
            lastError: message,
            run: () => service.refreshCompanyBoardSnapshots(
              [failure.monthId], log, [failure.employeeName], [failure.dimension],
            ),
          }
        case 'company-month':
          return {
            key: `${failure.kind}:${failure.monthId}:${failure.employeeNames.join(',')}:${failure.dimensions.join(',')}`,
            label: `公司看板月份区间 · 方片月${failure.monthId - 139}月`,
            lastError: message,
            run: () => service.refreshCompanyBoardSnapshots(
              [failure.monthId], log, failure.employeeNames, failure.dimensions,
            ),
          }
        case 'submission-count':
          return {
            key: `${failure.kind}:${failure.monthId}:${failure.employeeName}`,
            label: `${failure.employeeName}做表数量 · 方片月${failure.monthId - 139}月`,
            lastError: message,
            run: () => service.refreshCompanyBoardSnapshots([failure.monthId], log, [failure.employeeName], ['deal']),
          }
        case 'unpublished':
          return {
            key: `${failure.kind}:${failure.monthId}:${failure.employeeName}`,
            label: `未发布订单 · 方片月${failure.monthId - 139}月 · ${failure.employeeName}`,
            lastError: message,
            run: () => service.refreshUnpublishedOrderSnapshots([failure.monthId], log, [failure.employeeName]),
          }
        case 'unpublished-month':
          return {
            key: `${failure.kind}:${failure.monthId}`,
            label: `未发布订单月份区间 · 方片月${failure.monthId - 139}月`,
            lastError: message,
            run: () => service.refreshUnpublishedOrderSnapshots([failure.monthId], log),
          }
        default: {
          const exhaustiveFailure: never = failure
          return exhaustiveFailure
        }
      }
    }

    const recordFailure = (label: string, error: unknown, retryWholeOperation?: () => Promise<unknown>) => {
      const detail = error instanceof Error ? error.message : String(error)
      if (error instanceof DashboardSnapshotRefreshError) {
        for (const item of error.failures) {
          const job = makeRetryJob(item)
          if (item.retryable && delayedRetriesEnabled) {
            retryJobs.set(job.key, job)
            log(`${job.label}暂时失败；将在约10分钟后仅重试此快照: ${item.message}`)
          } else {
            failures.push(`${job.label}: ${item.message}`)
            log(`${job.label}刷新失败${item.retryable ? '（避免高频重试，留待下一次计划刷新）' : ''}: ${item.message}`)
          }
        }
        return
      }
      if (isTemporaryTianjiUnavailable(error) && delayedRetriesEnabled && retryWholeOperation) {
        const key = `operation:${label}`
        retryJobs.set(key, { key, label, lastError: detail, run: retryWholeOperation })
        log(`${label}暂时失败；将在约10分钟后重试读取: ${detail}`)
        return
      }
      failures.push(`${label}: ${detail}`)
      log(`${label}失败: ${detail}`)
    }

    const runRetry = async (job: RetryJob): Promise<void> => {
      try {
        await job.run()
        log(`${job.label}重试成功`)
      } catch (error) {
        if (error instanceof DashboardSnapshotRefreshError) {
          for (const item of error.failures) {
            const nextJob = makeRetryJob(item)
            if (item.retryable) {
              retryJobs.set(nextJob.key, nextJob)
              log(`${nextJob.label}仍暂时不可用，将继续等待下一次重试: ${item.message}`)
            } else {
              failures.push(`${nextJob.label}: ${item.message}`)
              log(`${nextJob.label}重试遇到非临时错误，停止重试: ${item.message}`)
            }
          }
          return
        }
        if (isTemporaryTianjiUnavailable(error)) {
          retryJobs.set(job.key, { ...job, lastError: error.message })
          log(`${job.label}仍暂时不可用，将继续等待下一次重试: ${error.message}`)
          return
        }
        const detail = error instanceof Error ? error.message : String(error)
        failures.push(`${job.label}: ${detail}`)
        log(`${job.label}重试遇到非临时错误，停止重试: ${detail}`)
      }
    }

    try {
      const performanceResult = await service.refreshPerformanceSnapshots(performanceMonthIds, log)
      log(`业绩快照刷新完成: 方片月${performanceResult.months.map((monthId) => monthId - 139).join('、')}月, ${performanceResult.refreshed}条员工快照`)
    } catch (error) {
      recordFailure('业绩快照刷新', error, () => service.refreshPerformanceSnapshots(performanceMonthIds, log))
      log('继续刷新公司看板和未发布快照')
    }

    try {
      const companyResult = await service.refreshCompanyBoardSnapshots(performanceMonthIds, log, [...companyBoardEmployees])
      log(`对客及示例开发01别名公司看板快照刷新完成: ${companyResult.employees}人，方片月${companyResult.months.map((monthId) => monthId - 139).join('、')}月, ${companyResult.refreshed}条公司看板快照，${companyResult.submissionCountSnapshots}条对客人做表数量快照`)
    } catch (error) {
      recordFailure('对客及示例开发01别名公司看板快照刷新', error, () =>
        service.refreshCompanyBoardSnapshots(performanceMonthIds, log, [...companyBoardEmployees]))
      log('继续刷新公司、品牌目录和未发布快照')
    }

    try {
      const companyCatalogResult = await service.refreshTargetManagementCompanyOptionsSnapshot(log)
      log(`天玑公司目录快照刷新完成: ${companyCatalogResult.companyCount}家公司，更新时间 ${companyCatalogResult.refreshedAt}`)
    } catch (error) {
      recordFailure('天玑公司目录快照刷新', error, () => service.refreshTargetManagementCompanyOptionsSnapshot(log))
    }

    try {
      const brandResult = await service.refreshTargetManagementBrandOptionsSnapshot(log)
      log(`天玑品牌目录快照刷新完成: ${brandResult.brandCount}个品牌，更新时间 ${brandResult.refreshedAt}`)
    } catch (error) {
      recordFailure('天玑品牌目录快照刷新', error, () => service.refreshTargetManagementBrandOptionsSnapshot(log))
    }

    try {
      const unpublishedResult = await service.refreshUnpublishedOrderSnapshots(
        unpublishedMonthIds,
        log,
        [...DASHBOARD_EMPLOYEE_NAMES],
      )
      log(`未发布订单快照刷新完成: 方片月${unpublishedResult.months.map((monthId) => monthId - 139).join('、')}月, ${unpublishedResult.refreshed}条员工快照`)
    } catch (error) {
      recordFailure('未发布订单快照刷新', error, () => service.refreshUnpublishedOrderSnapshots(
        unpublishedMonthIds,
        log,
        [...DASHBOARD_EMPLOYEE_NAMES],
      ))
    }

    if (retryJobs.size > 0 && delayedRetriesEnabled) {
      const scheduledAt = Date.parse(scheduledFor)
      const retryDeadline = Number.isFinite(scheduledAt)
        ? scheduledAt + RETRY_WINDOW_MS
        : Date.示例公司有限公司() + RETRY_WINDOW_MS
      let retryAttempt = 0
      while (retryJobs.size > 0 && Date.示例公司有限公司() + RETRY_INTERVAL_MS < retryDeadline) {
        retryAttempt += 1
        log(`仍有${retryJobs.size}项天玑快照待重试；约10分钟后开始第${retryAttempt}轮，只重新读取失败项，不触发天玑系统刷新`)
        await wait(RETRY_INTERVAL_MS)
        const jobs = [...retryJobs.values()]
        retryJobs.clear()
        for (let index = 0; index < jobs.length; index += 1) {
          if (Date.示例公司有限公司() >= retryDeadline) {
            for (const pendingJob of jobs.slice(index)) retryJobs.set(pendingJob.key, pendingJob)
            break
          }
          await runRetry(jobs[index])
        }
      }
      for (const job of retryJobs.values()) {
        failures.push(`${job.label}: 重试窗口结束仍未恢复；最近错误：${job.lastError}`)
        log(`${job.label}在本轮重试窗口内未恢复，保留上次成功快照`)
      }
    }

    if (failures.length > 0) throw new Error(failures.join('；'))
  },
})

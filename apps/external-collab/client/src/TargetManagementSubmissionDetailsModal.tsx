import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getTargetManagementSubmissionSnapshot } from './api'
import type {
  DashboardCompanyBoardEmployeeName,
  DashboardTargetManagementSubmissionDetail,
  DashboardTargetManagementSubmissionSnapshotResponse,
} from '@shared/api.interface'

type DetailKey = keyof DashboardTargetManagementSubmissionDetail
type NumericDetailKey = 'submittedBloggerCount' | 'wonBloggerCount'

interface DetailColumn {
  key: DetailKey
  label: string
  numeric?: boolean
}

const DETAIL_COLUMNS: DetailColumn[] = [
  { key: 'submittedMonth', label: '提报所属月' },
  { key: 'submittedWeek', label: '提报所属周' },
  { key: 'customerFacingName', label: '需求所属对客' },
  { key: 'customerFacingPmGroup', label: '对客所属PM组' },
  { key: 'tableMakerName', label: '做表人' },
  { key: 'platformName', label: '平台' },
  { key: 'companyName', label: '做表所属公司' },
  { key: 'brandName', label: '品牌' },
  { key: 'projectType', label: '项目类型' },
  { key: 'submittedBloggerCount', label: '提报博主个数', numeric: true },
  { key: 'wonBloggerCount', label: '中标博主个数', numeric: true },
  { key: 'winningBloggerNames', label: '中标博主名' },
]

const EMPTY_OPTION = '__empty__'
const PLATFORM_IDS: Record<string, number> = { 小红书: 1, 抖音: 2, 视频号: 5 }
const DEFAULT_VISIBLE_SUBMISSION_ROWS = 20
const readDetailValue = (row: DashboardTargetManagementSubmissionDetail, key: DetailKey) => {
  const value = row[key]
  return value === null || value === undefined ? '' : String(value)
}

export default function TargetManagementSubmissionDetailsModal({
  employeeName,
  monthLabel,
  monthId,
  monthOptions,
  companyName,
  platformName,
  brandName,
  expectedCount,
  details,
  detailsAvailable,
  refreshedAt,
  onClose,
}: {
  employeeName: DashboardCompanyBoardEmployeeName
  monthLabel: string
  monthId: number
  monthOptions: Array<{ monthId: number; label: string }>
  companyName: string
  platformName: string
  brandName: string
  expectedCount: number
  details: DashboardTargetManagementSubmissionDetail[]
  detailsAvailable: boolean
  refreshedAt: string
  onClose: () => void
}) {
  type SubmissionSnapshot = {
    count: number
    details: DashboardTargetManagementSubmissionDetail[]
    detailsAvailable: boolean
    refreshedAt: string
  }
  type SnapshotStatus = 'idle' | 'loading' | 'loaded' | 'error'

  const [selectedMonthId, setSelectedMonthId] = useState(monthId)
  const [snapshotsByMonth, setSnapshotsByMonth] = useState<Record<number, SubmissionSnapshot>>({
    [monthId]: { count: expectedCount, details, detailsAvailable, refreshedAt },
  })
  const [snapshotStatusByMonth, setSnapshotStatusByMonth] = useState<Record<number, SnapshotStatus>>({ [monthId]: 'loaded' })
  const [activeColumn, setActiveColumn] = useState<DetailKey | null>(null)
  const [selectedValues, setSelectedValues] = useState<Partial<Record<DetailKey, string[]>>>({})
  const [optionSearch, setOptionSearch] = useState<Partial<Record<DetailKey, string>>>({})
  const [numberRanges, setNumberRanges] = useState<Partial<Record<NumericDetailKey, { min: string; max: string }>>>({})
  const filterPopoverRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const topScrollThumbRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollThumbRef = useRef<HTMLDivElement>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const currentSnapshot = snapshotsByMonth[selectedMonthId]
  const currentSnapshotStatus = snapshotStatusByMonth[selectedMonthId] ?? 'idle'
  const selectedMonthLabel = monthOptions.find((option) => option.monthId === selectedMonthId)?.label ?? monthLabel
  const currentExpectedCount = currentSnapshot?.count ?? 0
  const currentDetailsAvailable = currentSnapshot?.detailsAvailable ?? false
  const currentRefreshedAt = currentSnapshot?.refreshedAt ?? ''

  useEffect(() => {
    if (selectedMonthId === monthId || currentSnapshotStatus === 'loading' || currentSnapshotStatus === 'loaded') return
    setSnapshotStatusByMonth((current) => ({ ...current, [selectedMonthId]: 'loading' }))
    getTargetManagementSubmissionSnapshot(selectedMonthId, employeeName)
      .then((response: DashboardTargetManagementSubmissionSnapshotResponse) => {
        const platformId = platformName ? PLATFORM_IDS[platformName] : undefined
        const count = response.tableCounts.reduce((total, item) => {
          if (item.companyName !== companyName) return total
          if (platformId !== undefined && item.platformId !== platformId) return total
          if (brandName && item.brandName !== brandName) return total
          return total + item.count
        }, 0)
        setSnapshotsByMonth((current) => ({
          ...current,
          [selectedMonthId]: {
            count,
            details: response.tableCountDetails,
            detailsAvailable: response.tableCountDetailsAvailable,
            refreshedAt: response.snapshotUpdatedAt,
          },
        }))
        setSnapshotStatusByMonth((current) => ({ ...current, [selectedMonthId]: 'loaded' }))
      })
      .catch(() => setSnapshotStatusByMonth((current) => ({ ...current, [selectedMonthId]: 'error' })))
  }, [employeeName, selectedMonthId, monthId, currentSnapshotStatus, companyName, platformName, brandName])

  useEffect(() => {
    setActiveColumn(null)
    setSelectedValues({})
    setOptionSearch({})
    setNumberRanges({})
  }, [selectedMonthId])

  useEffect(() => {
    const tableWrap = tableWrapRef.current
    const table = tableRef.current
    const scrollbars = [
      { track: topScrollRef.current, thumb: topScrollThumbRef.current },
      { track: bottomScrollRef.current, thumb: bottomScrollThumbRef.current },
    ].filter((item): item is { track: HTMLDivElement; thumb: HTMLDivElement } => Boolean(item.track && item.thumb))
    if (!tableWrap || !table || scrollbars.length !== 2) return

    let activeDrag: { track: HTMLDivElement; pointerId: number; pointerOffset: number } | null = null
    const updateScrollbars = () => {
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      for (const { track, thumb } of scrollbars) {
        const trackWidth = track.clientWidth
        const thumbWidth = maxScroll === 0
          ? trackWidth
          : Math.min(trackWidth, Math.max(44, trackWidth * tableWrap.clientWidth / tableWrap.scrollWidth))
        const maxThumbPosition = Math.max(0, trackWidth - thumbWidth)
        const thumbPosition = maxScroll === 0 ? 0 : tableWrap.scrollLeft / maxScroll * maxThumbPosition
        thumb.style.width = `${thumbWidth}px`
        thumb.style.left = `${thumbPosition}px`
        track.setAttribute('aria-valuemax', String(maxScroll))
        track.setAttribute('aria-valuenow', String(Math.round(tableWrap.scrollLeft)))
        track.setAttribute('aria-disabled', String(maxScroll === 0))
      }
    }
    const onTableScroll = () => updateScrollbars()
    const onPointerDown = (event: PointerEvent) => {
      const track = event.currentTarget as HTMLDivElement
      const thumb = track.querySelector<HTMLDivElement>('.target-submission-scroll-thumb')
      if (!thumb || tableWrap.scrollWidth <= tableWrap.clientWidth) return
      event.preventDefault()
      const trackRect = track.getBoundingClientRect()
      const thumbRect = thumb.getBoundingClientRect()
      const isThumbTarget = event.clientX >= thumbRect.left && event.clientX <= thumbRect.right
      const pointerOffset = isThumbTarget ? event.clientX - thumbRect.left : thumbRect.width / 2
      const maxThumbPosition = Math.max(0, track.clientWidth - thumb.offsetWidth)
      const thumbPosition = Math.min(maxThumbPosition, Math.max(0, event.clientX - trackRect.left - pointerOffset))
      const maxScroll = tableWrap.scrollWidth - tableWrap.clientWidth
      if (!isThumbTarget) tableWrap.scrollLeft = maxThumbPosition === 0 ? 0 : thumbPosition / maxThumbPosition * maxScroll
      activeDrag = { track, pointerId: event.pointerId, pointerOffset }
      track.classList.add('is-dragging')
      track.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
      const { track, pointerOffset } = activeDrag
      const thumb = track.querySelector<HTMLDivElement>('.target-submission-scroll-thumb')
      if (!thumb) return
      const trackRect = track.getBoundingClientRect()
      const maxThumbPosition = Math.max(0, track.clientWidth - thumb.offsetWidth)
      const thumbPosition = Math.min(maxThumbPosition, Math.max(0, event.clientX - trackRect.left - pointerOffset))
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      tableWrap.scrollLeft = maxThumbPosition === 0 ? 0 : thumbPosition / maxThumbPosition * maxScroll
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
      activeDrag.track.classList.remove('is-dragging')
      activeDrag = null
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.key === 'PageUp' || event.key === 'PageDown' ? tableWrap.clientWidth * 0.8 : 56
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'PageUp' || event.key === 'PageDown' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        if (event.key === 'ArrowLeft') tableWrap.scrollLeft -= step
        if (event.key === 'ArrowRight') tableWrap.scrollLeft += step
        if (event.key === 'PageUp') tableWrap.scrollLeft -= step
        if (event.key === 'PageDown') tableWrap.scrollLeft += step
        if (event.key === 'Home') tableWrap.scrollLeft = 0
        if (event.key === 'End') tableWrap.scrollLeft = tableWrap.scrollWidth
      }
    }
    const resizeObserver = new ResizeObserver(updateScrollbars)

    updateScrollbars()
    resizeObserver.observe(table)
    resizeObserver.observe(tableWrap)
    tableWrap.addEventListener('scroll', onTableScroll, { passive: true })
    for (const { track } of scrollbars) {
      track.addEventListener('pointerdown', onPointerDown)
      track.addEventListener('pointermove', onPointerMove)
      track.addEventListener('pointerup', onPointerUp)
      track.addEventListener('pointercancel', onPointerUp)
      track.addEventListener('keydown', onKeyDown)
    }
    window.addEventListener('resize', updateScrollbars)

    return () => {
      resizeObserver.disconnect()
      tableWrap.removeEventListener('scroll', onTableScroll)
      for (const { track } of scrollbars) {
        track.removeEventListener('pointerdown', onPointerDown)
        track.removeEventListener('pointermove', onPointerMove)
        track.removeEventListener('pointerup', onPointerUp)
        track.removeEventListener('pointercancel', onPointerUp)
        track.removeEventListener('keydown', onKeyDown)
      }
      window.removeEventListener('resize', updateScrollbars)
    }
  }, [currentDetailsAvailable, selectedMonthId])

  useEffect(() => {
    if (!activeColumn) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!filterPopoverRef.current?.contains(event.target as Node)) setActiveColumn(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveColumn(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeColumn])

  const matchingDetails = useMemo(() => (currentSnapshot?.details ?? []).filter((row) =>
    row.companyName === companyName
      && (!platformName || row.platformName === platformName)
      && (!brandName || row.brandName === brandName),
  ), [currentSnapshot, companyName, platformName, brandName])

  const matchesFilters = (row: DashboardTargetManagementSubmissionDetail, excludedKey?: DetailKey) =>
    DETAIL_COLUMNS.every(({ key, numeric }) => {
      if (key === excludedKey) return true
      if (numeric) {
        const range = numberRanges[key as NumericDetailKey]
        if (!range?.min && !range?.max) return true
        const value = row[key]
        if (typeof value !== 'number' || !Number.isFinite(value)) return false
        if (range.min && value < Number(range.min)) return false
        if (range.max && value > Number(range.max)) return false
        return true
      }
      const selected = selectedValues[key] ?? []
      if (selected.length === 0) return true
      const value = readDetailValue(row, key)
      return selected.includes(value || EMPTY_OPTION)
    })

  const filteredDetails = useMemo(
    () => matchingDetails.filter((row) => matchesFilters(row)),
    [matchingDetails, selectedValues, numberRanges],
  )

  useLayoutEffect(() => {
    const tableWrap = tableWrapRef.current
    const table = tableRef.current
    if (!tableWrap || !table) return

    const updateVisibleRowsHeight = () => {
      const headerHeight = table.tHead?.getBoundingClientRect().height ?? 0
      const visibleRows = Array.from(table.tBodies).flatMap((body) => Array.from(body.rows)).slice(0, DEFAULT_VISIBLE_SUBMISSION_ROWS)
      const rowsHeight = visibleRows.reduce((total, row) => total + row.getBoundingClientRect().height, 0)
      tableWrap.style.maxHeight = `${Math.ceil(headerHeight + rowsHeight + 2)}px`
    }

    updateVisibleRowsHeight()
    const resizeObserver = new ResizeObserver(updateVisibleRowsHeight)
    resizeObserver.observe(table)
    window.addEventListener('resize', updateVisibleRowsHeight)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateVisibleRowsHeight)
    }
  }, [filteredDetails, currentDetailsAvailable, selectedMonthId])

  const optionCounts = (key: DetailKey) => {
    const counts = new Map<string, number>()
    for (const row of matchingDetails) {
      if (!matchesFilters(row, key)) continue
      const value = readDetailValue(row, key) || EMPTY_OPTION
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    const search = (optionSearch[key] ?? '').trim().toLocaleLowerCase()
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count, label: value === EMPTY_OPTION ? '（空白）' : value }))
      .filter((option) => !search || option.label.toLocaleLowerCase().includes(search))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
  }

  const toggleOption = (key: DetailKey, value: string) => {
    setSelectedValues((current) => {
      const selected = current[key] ?? []
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
      return { ...current, [key]: next }
    })
  }

  const clearAllFilters = () => {
    setSelectedValues({})
    setOptionSearch({})
    setNumberRanges({})
  }

  const formatSnapshotTime = (value: string) => {
    const date = new Date(value)
    return value && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
      : '未知'
  }

  return (
    <div className="chart-modal-backdrop target-submission-modal-backdrop" onClick={onClose}>
      <section
        className="chart-modal target-submission-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-submission-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="target-submission-modal-title">{companyName} · {platformName || '全部平台'} · {brandName || '全部品牌'} · 做表数量明细</h3>
            <p>{selectedMonthLabel} · 快照更新于 {formatSnapshotTime(currentRefreshedAt)}</p>
          </div>
          <div className="target-submission-modal-actions">
            <label className="target-submission-month-filter">
              <span>筛选方片月</span>
              <select value={selectedMonthId} onChange={(event) => setSelectedMonthId(Number(event.target.value))}>
                {monthOptions.map((option) => (
                  <option key={option.monthId} value={option.monthId}>{option.label}</option>
                ))}
                {!monthOptions.some((option) => option.monthId === selectedMonthId) ? (
                  <option value={selectedMonthId}>{monthLabel}</option>
                ) : null}
              </select>
            </label>
            <span>匹配 {filteredDetails.length} / {currentExpectedCount} 条</span>
            <button type="button" onClick={clearAllFilters}>重置筛选</button>
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </div>

        {currentSnapshotStatus === 'loading' ? (
          <div className="target-submission-details-notice">正在读取{selectedMonthLabel}已保存的做表数量快照…</div>
        ) : currentSnapshotStatus === 'error' ? (
          <div className="target-submission-details-notice is-error">
            {selectedMonthLabel}做表数量快照读取失败。
            <button type="button" onClick={() => setSnapshotStatusByMonth((current) => ({ ...current, [selectedMonthId]: 'idle' }))}>重试读取</button>
          </div>
        ) : !currentDetailsAvailable ? (
          <div className="target-submission-details-notice">
            {currentRefreshedAt
              ? `${selectedMonthLabel}快照没有保存逐条提报明细，暂时无法展示明细。`
              : `${selectedMonthLabel}尚无已保存的做表数量快照；切换月份只读取快照，不会立即刷新外部系统。`}
          </div>
        ) : (
          <>
            <div
              className="target-submission-horizontal-scroll"
              ref={topScrollRef}
              role="scrollbar"
              aria-label="表格顶部横向滚动条"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={0}
              aria-valuenow={0}
              tabIndex={0}
            >
              <div className="target-submission-scroll-thumb" ref={topScrollThumbRef} />
            </div>
            <div className="target-submission-table-wrap" ref={tableWrapRef}>
              <table className="target-submission-table" ref={tableRef}>
              <thead>
                <tr>
                  {DETAIL_COLUMNS.map(({ key, label, numeric }) => {
                    const active = key === activeColumn
                    const filterActive = numeric
                      ? Boolean(numberRanges[key as NumericDetailKey]?.min || numberRanges[key as NumericDetailKey]?.max)
                      : Boolean(selectedValues[key]?.length)
                    return (
                      <th key={key}>
                        <div className="target-submission-column-heading">
                          <span>{label}</span>
                          <button
                            type="button"
                            className={filterActive ? 'is-filtered' : ''}
                            aria-label={`查找或筛选${label}`}
                            aria-expanded={active}
                            onClick={() => {
                              setActiveColumn(active ? null : key)
                              setOptionSearch((current) => ({ ...current, [key]: '' }))
                            }}
                          >
                            {filterActive ? '筛选中' : '⌄'}
                          </button>
                        </div>
                        {active ? (
                          <div
                            className="target-submission-filter-popover"
                            ref={filterPopoverRef}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="target-submission-filter-popover-head">
                              <strong>筛选{label}</strong>
                              <button type="button" aria-label="关闭筛选框" onClick={() => setActiveColumn(null)}>×</button>
                            </div>
                            {numeric ? (
                              <div className="target-submission-number-filter">
                                <label>
                                  最小值
                                  <input
                                    type="number"
                                    step="1"
                                    value={numberRanges[key as NumericDetailKey]?.min ?? ''}
                                    onChange={(event) => setNumberRanges((current) => ({
                                      ...current,
                                      [key]: { min: event.target.value, max: current[key as NumericDetailKey]?.max ?? '' },
                                    }))}
                                  />
                                </label>
                                <label>
                                  最大值
                                  <input
                                    type="number"
                                    step="1"
                                    value={numberRanges[key as NumericDetailKey]?.max ?? ''}
                                    onChange={(event) => setNumberRanges((current) => ({
                                      ...current,
                                      [key]: { min: current[key as NumericDetailKey]?.min ?? '', max: event.target.value },
                                    }))}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setNumberRanges((current) => ({ ...current, [key]: { min: '', max: '' } }))}
                                >清除数字筛选</button>
                              </div>
                            ) : (
                              <>
                                <input
                                  className="target-submission-option-search"
                                  type="search"
                                  placeholder={`查找${label}`}
                                  value={optionSearch[key] ?? ''}
                                  onChange={(event) => setOptionSearch((current) => ({ ...current, [key]: event.target.value }))}
                                />
                                <div className="target-submission-option-list">
                                  {optionCounts(key).map(({ value, label: optionLabel, count }) => (
                                    <label key={value}>
                                      <input
                                        type="checkbox"
                                        checked={(selectedValues[key] ?? []).includes(value)}
                                        onChange={() => toggleOption(key, value)}
                                      />
                                      <span>{optionLabel}</span>
                                      <small>{count}条</small>
                                    </label>
                                  ))}
                                  {optionCounts(key).length === 0 ? <p>没有匹配选项</p> : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedValues((current) => ({ ...current, [key]: [] }))}
                                >清除此列筛选</button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredDetails.map((row, index) => (
                  <tr key={`${row.tableMakerName}:${row.submittedWeek}:${index}`}>
                    {DETAIL_COLUMNS.map(({ key }) => (
                      <td key={key} title={readDetailValue(row, key)}>
                        {readDetailValue(row, key) || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {filteredDetails.length === 0 ? (
                  <tr><td className="target-submission-empty" colSpan={DETAIL_COLUMNS.length}>没有符合当前筛选条件的提报记录。</td></tr>
                ) : null}
              </tbody>
              </table>
            </div>
            <div
              className="target-submission-horizontal-scroll target-submission-horizontal-scroll-bottom"
              ref={bottomScrollRef}
              role="scrollbar"
              aria-label="表格底部横向滚动条"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={0}
              aria-valuenow={0}
              tabIndex={0}
            >
              <div className="target-submission-scroll-thumb" ref={bottomScrollThumbRef} />
            </div>
          </>
        )}
        <p className="target-submission-details-footnote">筛选选项后的数字表示当前匹配记录数；提报博主个数和中标博主个数支持最小值、最大值筛选。</p>
      </section>
    </div>
  )
}

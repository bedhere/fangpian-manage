import { Fragment, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { finishTianjiLogout } from './tianji-logout'
import BusinessReportModal, { type BusinessReportData } from './BusinessReportModal'
import TargetManagementSubmissionDetailsModal from './TargetManagementSubmissionDetailsModal'
import { getDashboardBrandCompanyShare, getDashboardBrandPerformance, getDashboardCompanyBrandPerformance, getDashboardCompanyBrandShare, getDashboardCompanyOrders, getDashboardCompanyPerformance, getDashboardCompanyPerformanceBreakdown, getDashboardTargets, getDashboardUnpublishedOrders, getMetricTargets, getTargetManagementActuals, getTargetManagementBrandOptions, getTargetManagementCompanyOptions, getTargetManagementDealCompanyOptions, getTargetManagementSubmissionSnapshot, getTargetSplitPlan, previewTargetSplitImageImport, previewTargetSplitWorkbookFileImport, previewTargetSplitWorkbookLinkImport, previewWangYueTargetManagementFileImport, previewWangYueTargetManagementImport, refreshPerformanceSnapshot, refreshTargetManagementSnapshot, reviseWangYueTargetManagementImportPreview, saveTargetSplitPlan, updateMetricTargets } from './api'
import { canEditDashboardTargets } from './target-access'
import type {
  DashboardCompanyBoardEmployeeName,
  DashboardCompanyMetricKey,
  DashboardCompanyOrdersResponse,
  DashboardCompanyPerformanceResponse,
  DashboardBrandPerformanceResponse,
  DashboardTargetManagementActualsResponse,
  DashboardTargetManagementActualRow,
  DashboardTargetManagementBrandOptionsResponse,
  DashboardTargetManagementCompanyOptionsResponse,
  DashboardTargetManagementImportPreviewResponse,
  DashboardTargetManagementImportChatMessage,
  DashboardTargetManagementSubmissionSnapshotResponse,
  DashboardOrderMetricDimension,
  DashboardMemberTarget,
  DashboardUnpublishedMetricKey,
  DashboardUnpublishedOrder,
  DashboardUnpublishedOrdersResponse,
  DashboardUnpublishedOrderFilters,
  TargetSplitWorkbookImportPreview,
} from '@shared/api.interface'

const DIMENSIONS = ['publish', 'deal', 'payment'] as const
const DIMENSION_NAMES = { publish: '发布', deal: '成单', payment: '结款' } as const
const SUPPLEMENTARY_DASHBOARDS = [
  { key: 'customer', title: '对客人看板', tabLabel: '对客人' },
  { key: 'company', title: '公司看板', tabLabel: '公司' },
  { key: 'brand', title: '品牌看板', tabLabel: '品牌' },
] as const
const CUSTOMER_DASHBOARD_MEMBERS = ['示例对客13', '示例对客14', '示例对客15', '示例对客16', '示例对客17', '示例对客18', '示例对客19', '示例对客20'] as const
const OTHER_CUSTOMER_SHARE_EMPLOYEES = new Set<string>(['示例对客13', '示例对客14', '示例对客15', '示例对客16', '示例对客17', '示例对客18', '示例对客19'])
const CUSTOMER_COMPANY_BRAND_BOARD_EMPLOYEES = ['示例对客16', '示例对客19', '示例对客17', '示例对客18', '示例对客13', '示例对客14', '示例对客15', '示例对客22', '示例对客20', '示例对客21', '示例开发10'] as const
const TARGET_MANAGEMENT_BOARD_EMPLOYEES = ['示例对客16', '示例对客19', '示例对客18', '示例对客17', '示例对客13', '示例对客14', '示例对客15', '示例对客20'] as const
const TARGET_MANAGEMENT_IMPORT_CONFIGURED_EMPLOYEES = ['示例对客16', '示例对客13'] as const
type CustomerCompanyBrandBoardEmployeeName = (typeof CUSTOMER_COMPANY_BRAND_BOARD_EMPLOYEES)[number]
const isTargetManagementBoardEmployee = (name: string) =>
  TARGET_MANAGEMENT_BOARD_EMPLOYEES.some((employeeName) => employeeName === name)
const isTargetManagementImportConfiguredEmployee = (name: string) =>
  TARGET_MANAGEMENT_IMPORT_CONFIGURED_EMPLOYEES.some((employeeName) => employeeName === name)
const CUSTOMER_TARGET_ORDER_DETAIL_EMPLOYEES = new Set<DashboardCompanyBoardEmployeeName>([
  '示例对客16', '示例对客19', '示例对客17', '示例对客18', '示例对客13', '示例对客22', '示例对客14', '示例对客15', '示例对客20', '示例对客21',
])
const supportsTargetOrderDetails = (name: string) =>
  name === '示例开发01' || CUSTOMER_TARGET_ORDER_DETAIL_EMPLOYEES.has(name as DashboardCompanyBoardEmployeeName)
const isCustomerCompanyBrandBoardEmployee = (name: string): name is CustomerCompanyBrandBoardEmployeeName =>
  CUSTOMER_COMPANY_BRAND_BOARD_EMPLOYEES.some((employeeName) => employeeName === name)
type SupplementaryDashboardKey = (typeof SUPPLEMENTARY_DASHBOARDS)[number]['key']
const DASHBOARD_FANGPIAN_PERIODS = {
  145: { label: '2026年6月', startMonth: 5, startDay: 24, endMonth: 6, endDay: 28 },
  146: { label: '2026年7月', startMonth: 6, startDay: 28, endMonth: 7, endDay: 26 },
  147: { label: '2026年8月', startMonth: 7, startDay: 26, endMonth: 8, endDay: 23 },
  148: { label: '2026年9月', startMonth: 8, startDay: 23, endMonth: 9, endDay: 27 },
  149: { label: '2026年10月', startMonth: 9, startDay: 27, endMonth: 10, endDay: 25 },
  150: { label: '2026年11月', startMonth: 10, startDay: 25, endMonth: 11, endDay: 22 },
  151: { label: '2026年12月', startMonth: 11, startDay: 22, endMonth: 1, endDay: 1 },
} as const
const DASHBOARD_MONTH_IDS = [147, 148, 149, 150, 151] as const
type DashboardMonthId = (typeof DASHBOARD_MONTH_IDS)[number]
const TARGET_MANAGEMENT_MONTH_IDS = [147, 148, 149, 150, 151] as const
type TargetManagementMonthId = (typeof TARGET_MANAGEMENT_MONTH_IDS)[number]
const TARGET_SPLIT_MONTH_IDS = [149, 150] as const
type TargetSplitMonthId = (typeof TARGET_SPLIT_MONTH_IDS)[number]
type TargetManagementSubmissionMonthOption = { monthId: number; label: string }
const TARGET_MANAGEMENT_IMPORT_WELCOME: DashboardTargetManagementImportChatMessage = {
  role: 'assistant',
  content: '可以直接告诉我需要调整的总目标、公司、平台、项目品牌或对接人。我会先更新预览，核对后仍需点击“确认导入”才会写入看板。',
}
const getCompanyBoardCacheKey = (
  employeeName: DashboardCompanyBoardEmployeeName,
  monthId: number,
  dimension: DashboardOrderMetricDimension,
) => `${employeeName}:${monthId}:${dimension}`
const getBrandBoardCacheKey = (
  employeeName: DashboardCompanyBoardEmployeeName,
  monthId: number,
  dimension: DashboardOrderMetricDimension,
) => employeeName === '示例开发01' ? `${monthId}:${dimension}` : `${employeeName}:${monthId}:${dimension}`
const GROUP_NAMES = ['示例开发10别名组', '示例对客16别名组', '示例对客13别名组', '示例对客14别名组', '小存组'] as const
const DASHBOARD_MEMBERS = [
  { name: '示例开发01', group: '示例开发10别名组' },
  { name: '示例对客16', group: '示例对客16别名组' },
  { name: '示例对客17', group: '示例对客16别名组' },
  { name: '示例对客18', group: '示例对客16别名组' },
  { name: '示例对客19', group: '示例对客16别名组' },
  { name: '示例对客13', group: '示例对客13别名组' },
  { name: '示例对客22', group: '示例对客13别名组' },
  { name: '示例对客14', group: '示例对客14别名组' },
  { name: '示例对客15', group: '示例对客14别名组' },
  { name: '示例开发10', group: '小存组' },
  { name: '示例对客20', group: '小存组' },
  { name: '示例对客21', group: '小存组' },
] as const
const supportsUnpublishedMetrics = (employeeName: string) =>
  DASHBOARD_MEMBERS.some((member) => member.name === employeeName)
const SUB_METRICS = [
  { key: 'halfPastTen', name: '十点半业绩' },
  { key: 'selfIncubated', name: '自孵（不包含十点半）业绩' },
  { key: 'signingXiaohongshu', name: '签约小红书业绩' },
  { key: 'signingDouyin', name: '签约抖音业绩' },
  { key: 'signingShipinhao', name: '签约视频号业绩' },
  { key: 'outsourcing', name: '外采业绩' },
  { key: 'outsourcingOrderCount', name: '外采单数' },
  { key: 'total', name: '总业绩' },
] as const

type ColumnKey =
  | 'metricName'
  | 'currentPerformance'
  | 'lastMonthPerformance'
  | 'target'
  | 'targetCompletion'
  | 'unpublishedPerformance'
  | 'commissionRate'
  | 'commission'
  | 'halfPastTen'
  | 'selfIncubated'
  | 'signingXiaohongshu'
  | 'signingDouyin'
  | 'signingShipinhao'
  | 'outsourcingOrderCount'
  | 'outsourcing'

type SortableColumnKey = Extract<ColumnKey, 'currentPerformance' | 'lastMonthPerformance' | 'targetCompletion'>
  | 'halfPastTen'
  | 'selfIncubated'
  | 'signingXiaohongshu'
  | 'signingDouyin'
  | 'signingShipinhao'
  | 'outsourcingOrderCount'
  | 'outsourcing'
  | 'companyName'
  | 'brandName'
  | 'brandName'
  | 'companyHalfPastTen'
  | 'companySelfIncubated'
  | 'companySigningXiaohongshu'
  | 'companySigningDouyin'
  | 'companySigningShipinhao'
  | 'companyOutsourcing'
  | 'companyTotal'
  | 'companyOrderCount'
type SortConfig = { column: SortableColumnKey; direction: 'asc' | 'desc' } | null

function nextSortConfig(current: SortConfig, column: SortableColumnKey): SortConfig {
  if (current?.column !== column) return { column, direction: 'asc' }
  return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function isSortableColumn(column: ColumnKey): column is SortableColumnKey {
  return column === 'currentPerformance'
    || column === 'lastMonthPerformance'
    || column === 'targetCompletion'
    || column === 'halfPastTen'
    || column === 'selfIncubated'
    || column === 'signingXiaohongshu'
    || column === 'signingDouyin'
    || column === 'signingShipinhao'
    || column === 'outsourcingOrderCount'
    || column === 'outsourcing'
}

function SortButton({
  column,
  label,
  secondaryLabel,
  sort,
  onClick,
  onReset,
}: {
  column: SortableColumnKey
  label: string
  secondaryLabel?: string
  sort: SortConfig
  onClick: () => void
  onReset: () => void
}) {
  const direction = sort?.column === column ? sort.direction : null
  const directionLabel = direction === 'asc' ? '当前正序' : direction === 'desc' ? '当前倒序' : '未排序'
  const accessibleLabel = secondaryLabel ? `${label}${secondaryLabel}` : label
  return (
    <span className="dashboard-sort-control">
      <button
        type="button"
        className={`dashboard-sort-button${direction ? ' sorted' : ''}`}
        aria-label={`${accessibleLabel}，${directionLabel}，点击切换排序`}
        title={`${accessibleLabel}：${direction === 'asc' ? '正序' : direction === 'desc' ? '倒序' : '点击排序'}`}
        onClick={onClick}
      >
        <span className={secondaryLabel ? 'dashboard-sort-label-stack' : undefined}>
          <span>{label}</span>
          {secondaryLabel ? <small>{secondaryLabel}</small> : null}
        </span>
        <span className="dashboard-sort-indicator" aria-hidden="true">
          {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
        </span>
      </button>
      {direction ? (
        <button
          type="button"
          className="dashboard-sort-reset"
          aria-label={`重置${label}排序`}
          title="重置排序"
          onClick={onReset}
        >
          重置
        </button>
      ) : null}
    </span>
  )
}

function NameAutocompleteFilter({
  value,
  options,
  placeholder,
  ariaLabel,
  onChange,
  onReset,
  onClose,
  onSearchTermChange,
  emptyMessage,
  hideZeroCount = false,
  hideInputWhenSelected = false,
  twoColumnOptions = false,
  collapseOnAnyValue = false,
  manualEntryOnly = false,
  selectionOnly = false,
  rightAccessory,
  dropdownActions,
  clearSearchOnFocus = false,
  showResetButton = true,
  commitOnEnter = false,
  portalDropdown = false,
  resetToken,
  openToken,
}: {
  value: string
  options: { name: string; count: number }[]
  placeholder: string
  ariaLabel: string
  onChange: (value: string) => void
  onReset?: () => void
  onClose?: (value?: string) => void
  onSearchTermChange?: (value: string) => void
  emptyMessage?: string
  hideZeroCount?: boolean
  hideInputWhenSelected?: boolean
  twoColumnOptions?: boolean
  collapseOnAnyValue?: boolean
  manualEntryOnly?: boolean
  selectionOnly?: boolean
  rightAccessory?: ReactNode
  dropdownActions?: ReactNode
  clearSearchOnFocus?: boolean
  showResetButton?: boolean
  commitOnEnter?: boolean
  portalDropdown?: boolean
  resetToken?: number
  openToken?: number
}) {
  const listId = useId()
  const comboboxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1)
  const [searchTerm, setSearchTerm] = useState('')
  const [portalDropdownStyle, setPortalDropdownStyle] = useState<CSSProperties>({})
  useEffect(() => {
    setSearchTerm('')
    setActiveOptionIndex(-1)
    setIsOpen(false)
  }, [resetToken])
  useEffect(() => {
    if (openToken === undefined) return
    setSearchTerm('')
    setActiveOptionIndex(-1)
    setIsOpen(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [openToken])
  useEffect(() => {
    if (!portalDropdown || !isOpen) return
    const updatePosition = () => {
      const bounds = comboboxRef.current?.getBoundingClientRect()
      if (!bounds) return
      const maxHeight = 220
      const availableBelow = Math.max(0, window.innerHeight - bounds.bottom - 8)
      const availableAbove = Math.max(0, bounds.top - 8)
      const opensAbove = availableBelow < maxHeight && availableAbove > availableBelow
      const availableHeight = opensAbove ? availableAbove : availableBelow
      const width = Math.min(Math.max(bounds.width, 260), Math.max(120, window.innerWidth - 16))
      const left = Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))
      setPortalDropdownStyle({
        position: 'fixed',
        left,
        width,
        maxHeight: Math.max(64, Math.min(maxHeight, availableHeight)),
        zIndex: 2000,
        top: opensAbove ? 'auto' : bounds.bottom + 4,
        bottom: opensAbove ? window.innerHeight - bounds.top + 4 : 'auto',
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    document.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, portalDropdown])
  const isCollapsed = hideInputWhenSelected && !isOpen && (
    collapseOnAnyValue ? Boolean(value.trim()) : options.some((option) => option.name === value)
  )
  const filterValue = hideInputWhenSelected && isOpen ? searchTerm : value
  const filteredOptions = [...options]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
    .filter((option) =>
    option.name.toLocaleLowerCase().includes(filterValue.trim().toLocaleLowerCase()),
    )

  const selectOption = (name: string) => {
    onChange(name)
    setSearchTerm('')
    onSearchTermChange?.('')
    setIsOpen(false)
    setActiveOptionIndex(-1)
    onClose?.(name)
  }
  const dropdownContent = isOpen && !manualEntryOnly ? (
    dropdownActions ? (
      <div className={`company-dashboard-name-filter-options${portalDropdown ? ' target-split-directory-autocomplete-options' : ''} has-actions`} style={portalDropdown ? portalDropdownStyle : undefined}>
        <div
          className="target-management-brand-actions-menu"
          role="group"
          aria-label={`${ariaLabel}操作`}
          onMouseDown={(event) => event.preventDefault()}
        >
          {dropdownActions}
        </div>
        <div className={`company-dashboard-name-filter-option-list${twoColumnOptions ? ' is-two-column' : ''}`} id={listId} role="listbox" aria-label={`${ariaLabel}候选项`}>
          {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option.name === value || index === activeOptionIndex}
              className={`company-dashboard-name-filter-option${index === activeOptionIndex ? ' is-active' : ''}`}
              key={option.name}
              title={option.name}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option.name)}
            >
              <span>{option.name}</span>
              {!hideZeroCount || option.count > 0 ? <small>{option.count} 单</small> : null}
            </button>
          )) : (
            <div className="company-dashboard-name-filter-empty">
              {emptyMessage ?? (selectionOnly ? '没有匹配的品牌，请从天玑品牌目录中选择' : '没有匹配名称，可继续手动输入')}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className={`company-dashboard-name-filter-options${twoColumnOptions ? ' is-two-column' : ''}${portalDropdown ? ' target-split-directory-autocomplete-options' : ''}`} id={listId} role="listbox" aria-label={`${ariaLabel}候选项`} style={portalDropdown ? portalDropdownStyle : undefined}>
        {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
          <button
            type="button"
            role="option"
            aria-selected={option.name === value || index === activeOptionIndex}
            className={`company-dashboard-name-filter-option${index === activeOptionIndex ? ' is-active' : ''}`}
            key={option.name}
            title={option.name}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectOption(option.name)}
          >
            <span>{option.name}</span>
            {!hideZeroCount || option.count > 0 ? <small>{option.count} 单</small> : null}
          </button>
        )) : (
          <div className="company-dashboard-name-filter-empty">
            {emptyMessage ?? (selectionOnly ? '没有匹配的品牌，请从天玑品牌目录中选择' : '没有匹配名称，可继续手动输入')}
          </div>
        )}
      </div>
    )
  ) : null

  return (
    <div
      ref={comboboxRef}
      className={`company-dashboard-name-filter-combobox${isOpen ? ' is-open' : ''}${isCollapsed ? ' is-collapsed' : ''}${onReset && showResetButton ? ' has-reset' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false)
          onSearchTermChange?.('')
          onClose?.(value)
        }
      }}
    >
      {!isCollapsed ? (
        <input
          ref={inputRef}
          className="company-dashboard-name-filter"
          type="search"
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete={manualEntryOnly ? 'none' : 'list'}
          aria-expanded={isOpen}
          aria-controls={manualEntryOnly ? undefined : listId}
          placeholder={placeholder}
          value={hideInputWhenSelected && isOpen ? searchTerm : value}
          onFocus={() => {
            setIsOpen(true)
            setActiveOptionIndex(-1)
            if (clearSearchOnFocus) {
              setSearchTerm('')
              onSearchTermChange?.('')
            } else {
              onSearchTermChange?.(searchTerm)
            }
          }}
          onChange={(event) => {
            const nextSearchTerm = event.target.value
            if (hideInputWhenSelected) setSearchTerm(nextSearchTerm)
            onSearchTermChange?.(nextSearchTerm)
            if (!selectionOnly) onChange(event.target.value)
            setIsOpen(true)
            setActiveOptionIndex(-1)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
              onSearchTermChange?.('')
              onClose?.(value)
              return
            }
            if (event.key === 'ArrowDown' && filteredOptions.length > 0) {
              event.preventDefault()
              setIsOpen(true)
              setActiveOptionIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
            }
            if (event.key === 'ArrowUp' && filteredOptions.length > 0) {
              event.preventDefault()
              setIsOpen(true)
              setActiveOptionIndex((current) => current < 1 ? 0 : current - 1)
            }
            if (event.key === 'Enter' && isOpen && filteredOptions.length > 0) {
              event.preventDefault()
              const selectedIndex = activeOptionIndex < 0 ? 0 : activeOptionIndex
              selectOption(filteredOptions[selectedIndex].name)
            } else if (event.key === 'Enter' && commitOnEnter) {
              event.preventDefault()
              setIsOpen(false)
              onSearchTermChange?.('')
              onClose?.(value)
            }
          }}
        />
      ) : null}
      <button
        type="button"
        className="company-dashboard-name-filter-toggle"
        aria-label={isOpen ? (manualEntryOnly ? '收起输入框' : '收起候选名称') : (manualEntryOnly ? '展开输入框' : '展开候选名称')}
        aria-expanded={isOpen}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false)
            onSearchTermChange?.('')
            onClose?.(value)
          } else {
            if (hideInputWhenSelected) setSearchTerm('')
            setIsOpen(true)
            onSearchTermChange?.('')
          }
          setActiveOptionIndex(-1)
        }}
      >
        <span aria-hidden="true">▾</span>
      </button>
      {onReset && showResetButton ? (
        <button
          type="button"
          className="company-dashboard-name-filter-reset"
          aria-label={`重置${ariaLabel}`}
          title="重置筛选"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onReset()
            setSearchTerm('')
            onSearchTermChange?.('')
            setActiveOptionIndex(-1)
            setIsOpen(false)
            onClose?.()
          }}
        >
          重置
        </button>
      ) : null}
      {rightAccessory ? <span className="company-dashboard-name-filter-accessory">{rightAccessory}</span> : null}
      {dropdownContent ? portalDropdown ? createPortal(dropdownContent, document.body) : dropdownContent : null}
  </div>
)
}

function TargetSplitDirectoryAutocomplete({
  value,
  directory,
  onCommit,
  onClose,
}: {
  value: string
  directory: 'company' | 'brand'
  onCommit: (value: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const [searchTerm, setSearchTerm] = useState('')
  const [options, setOptions] = useState<Array<{ name: string; count: number }>>([])
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const requestIdRef = useRef(0)

  useEffect(() => setDraft(value), [value])

  useEffect(() => {
    if (directory !== 'brand') return
    let isCurrent = true
    setStatus('loading')
    getTargetManagementBrandOptions('').then((response) => {
      if (!isCurrent) return
      if (!response.snapshotUpdatedAt) {
        setOptions([])
        setStatus('error')
        return
      }
      setOptions([...new Set(response.brands.map((brand) => brand.brandName.trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, 'zh-CN'))
        .map((name) => ({ name, count: 0 })))
      setStatus('loaded')
    }).catch(() => {
      if (!isCurrent) return
      setOptions([])
      setStatus('error')
    })
    return () => {
      isCurrent = false
    }
  }, [directory])

  useEffect(() => {
    if (directory !== 'company') return
    const requestId = ++requestIdRef.current
    const timeoutId = window.setTimeout(() => {
      setStatus('loading')
      getTargetManagementCompanyOptions(searchTerm.trim()).then((response) => {
        if (requestId !== requestIdRef.current) return
        setOptions(response.companies
          .map((company) => company.companyName.trim())
          .filter(Boolean)
          .map((name) => ({ name, count: 0 })))
        setStatus('loaded')
      }).catch(() => {
        if (requestId !== requestIdRef.current) return
        setOptions([])
        setStatus('error')
      })
    }, 180)
    return () => {
      window.clearTimeout(timeoutId)
      requestIdRef.current += 1
    }
  }, [directory, searchTerm])

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('zh-CN')
  const visibleOptions = options
    .filter((option) => !normalizedSearch || option.name.toLocaleLowerCase('zh-CN').includes(normalizedSearch))

  return (
    <NameAutocompleteFilter
      value={draft}
      options={visibleOptions}
      placeholder={directory === 'company' ? '搜索或输入公司名称' : '搜索或输入项目品牌'}
      ariaLabel={directory === 'company' ? '搜索或选择天玑公司' : '搜索或选择天玑品牌'}
      onChange={setDraft}
      onSearchTermChange={setSearchTerm}
      onClose={(nextValue) => {
        onCommit(nextValue ?? draft)
        onClose()
      }}
      emptyMessage={status === 'loading'
        ? `正在读取天玑${directory === 'company' ? '公司' : '品牌'}目录…`
        : status === 'error'
          ? `天玑${directory === 'company' ? '公司' : '品牌'}目录读取失败，可继续手动输入`
          : `天玑目录中没有匹配项，可继续手动输入`}
      hideInputWhenSelected
      hideZeroCount
      showResetButton={false}
      commitOnEnter
      portalDropdown
      openToken={1}
    />
  )
}

function CollapsibleCompanyActions({
  children,
  platforms,
  existingPlatformIds,
  onAddPlatform,
}: {
  children: ReactNode
  platforms: readonly { id: number; name: string }[]
  existingPlatformIds: readonly number[]
  onAddPlatform: (platformId: number) => void
}) {
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false)

  return (
    <div
      className={`target-management-company-actions${isPlatformMenuOpen ? ' is-platform-menu-open' : ''}`}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="target-management-add-button target-management-company-add-platform"
        aria-label="增加平台"
        aria-haspopup="true"
        aria-expanded={isPlatformMenuOpen}
        title="选择要增加的平台"
        onClick={() => setIsPlatformMenuOpen((current) => !current)}
      >
        增加平台
      </button>
      {isPlatformMenuOpen ? (
        <div className="target-management-platform-picker" role="group" aria-label="选择要增加的平台">
          {platforms.map((platform) => {
            const isAdded = existingPlatformIds.includes(platform.id)
            return (
              <button
                type="button"
                key={platform.id}
                disabled={isAdded}
                aria-label={isAdded ? `${platform.name}已添加` : `增加${platform.name}`}
                onClick={() => {
                  onAddPlatform(platform.id)
                  setIsPlatformMenuOpen(false)
                }}
              >
                {platform.name}{isAdded ? '（已添加）' : ''}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="target-management-company-action-buttons">{children}</div>
    </div>
  )
}

function CollapsiblePlatformActions({
  platformName,
  disabled,
  onAddBrand,
  onRemove,
}: {
  platformName: string
  disabled: boolean
  onAddBrand: () => void
  onRemove: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="target-management-platform-actions">
      <button
        type="button"
        className="target-management-platform-actions-toggle"
        aria-label={isExpanded ? `隐藏${platformName}删减按钮` : `显示${platformName}删减按钮`}
        aria-expanded={isExpanded}
        title={isExpanded ? '隐藏操作' : '显示操作'}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span aria-hidden="true">{isExpanded ? '▴' : '▾'}</span>
      </button>
      {isExpanded ? (
        <>
          <button
            type="button"
            className="target-management-platform-add-brand-button"
            aria-label={`为${platformName}新增品牌`}
            title={`新增${platformName}项目品牌`}
            onClick={onAddBrand}
          >
            新增品牌
          </button>
          <button
            type="button"
            className="target-management-platform-delete-button"
            aria-label={`删减${platformName}平台行`}
            title={disabled ? '每家公司至少保留一个平台' : `删减${platformName}平台行`}
            disabled={disabled}
            onClick={onRemove}
          >
            删减
          </button>
        </>
      ) : null}
    </div>
  )
}

function TargetManagementTotalGoalCell({
  value,
  unit,
  ariaLabel,
  onChange,
  onAddCompany,
}: {
  value: string
  unit: AmountDisplay['unit']
  ariaLabel: string
  onChange: (value: string) => void
  onAddCompany: () => void
}) {
  const [isEditing, setIsEditing] = useState(!value.trim())
  const inputRef = useRef<HTMLInputElement>(null)
  const showInput = isEditing || !value.trim()

  return (
    <div className="target-management-total-goal">
      {showInput ? (
        <input
          ref={inputRef}
          className="target-management-goal-input target-management-total-goal-input"
          type="number"
          min="0"
          step="0.01"
          value={value}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (value.trim()) setIsEditing(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim()) {
              setIsEditing(false)
              inputRef.current?.blur()
            }
          }}
        />
      ) : null}
      <button
        type="button"
        className="target-management-add-button target-management-total-goal-add-company"
        onClick={onAddCompany}
      >
        新增公司
      </button>
      {!showInput && value.trim() ? (
        <button
          type="button"
          className="target-management-total-goal-value"
          aria-label="点击编辑总目标"
          title="点击编辑总目标"
          onClick={() => {
            setIsEditing(true)
            window.requestAnimationFrame(() => inputRef.current?.focus())
          }}
        >
          <span>{value}</span>
          <small>{unit === 'wan' ? '万' : '元'}</small>
        </button>
      ) : null}
    </div>
  )
}

type Column = { key: ColumnKey; name: string }
const CUSTOMER_METRIC_COLUMNS: Column[] = [
  { key: 'selfIncubated', name: '自孵（不含十点半）' },
  { key: 'halfPastTen', name: '十点半' },
  { key: 'signingXiaohongshu', name: '签约小红书' },
  { key: 'signingDouyin', name: '签约抖音' },
  { key: 'signingShipinhao', name: '签约视频号' },
  { key: 'outsourcingOrderCount', name: '外采单数' },
  { key: 'outsourcing', name: '外采业绩' },
]

function getCustomerMetricColorClass(columnKey: ColumnKey): string {
  const index = CUSTOMER_METRIC_COLUMNS.findIndex((column) => column.key === columnKey)
  if (index < 0) return ''
  return index % 2 === 0 ? 'customer-dashboard-metric-blue' : 'customer-dashboard-metric-purple'
}

const COLUMNS_BY_DIMENSION: Record<(typeof DIMENSIONS)[number], Column[]> = {
  publish: [
    { key: 'metricName', name: '业绩名称' },
    { key: 'currentPerformance', name: '本月业绩' },
    { key: 'lastMonthPerformance', name: '上月业绩' },
    { key: 'target', name: '目标' },
    { key: 'targetCompletion', name: '目标完成度' },
    { key: 'unpublishedPerformance', name: '未发布业绩' },
  ],
  deal: [
    { key: 'metricName', name: '业绩名称' },
    { key: 'currentPerformance', name: '本月业绩' },
    { key: 'lastMonthPerformance', name: '上月业绩' },
    { key: 'target', name: '目标' },
    { key: 'targetCompletion', name: '目标完成度' },
  ],
  payment: [
    { key: 'metricName', name: '业绩名称' },
    { key: 'currentPerformance', name: '本月业绩' },
    { key: 'lastMonthPerformance', name: '上月业绩' },
    { key: 'commissionRate', name: '提成系数' },
    { key: 'commission', name: '提成' },
  ],
}
const CUSTOMER_COLUMNS_BY_DIMENSION: Record<Dimension, Column[]> = {
  publish: [
    { key: 'currentPerformance', name: '本月业绩' },
    { key: 'lastMonthPerformance', name: '上月业绩' },
    ...CUSTOMER_METRIC_COLUMNS,
    { key: 'unpublishedPerformance', name: '未发布业绩' },
  ],
  deal: [
    { key: 'currentPerformance', name: '本月业绩' },
    { key: 'lastMonthPerformance', name: '上月业绩' },
    ...CUSTOMER_METRIC_COLUMNS,
  ],
  payment: [
    { key: 'currentPerformance', name: '本月业绩' },
    { key: 'lastMonthPerformance', name: '上月业绩' },
    ...CUSTOMER_METRIC_COLUMNS,
  ],
}

const STORAGE_KEY = 'dashboard-manual-values'
const LEGACY_STORAGE_KEY = 'wangyue-dashboard-manual-values'
const DISPLAY_STORAGE_KEY = 'dashboard-amount-display-settings'
const CUSTOMER_DISPLAY_STORAGE_KEY = 'customer-dashboard-amount-display-settings'
const COMPANY_DISPLAY_STORAGE_KEY = 'company-dashboard-amount-display-settings'
const WANGYUE_ENTITY_DISPLAY_STORAGE_KEY = 'wangyue-company-brand-amount-display-settings'
const WANGYUE_TARGET_MANAGEMENT_STORAGE_KEY = 'wangyue-target-management-goals'

const UNPUBLISHED_METRIC_NAMES: Record<DashboardUnpublishedMetricKey, string> = {
  halfPastTen: '十点半业绩',
  selfIncubated: '自孵（不包含十点半）业绩',
  signingXiaohongshu: '签约小红书业绩',
  signingDouyin: '签约抖音业绩',
  signingShipinhao: '签约视频号业绩',
  outsourcing: '外采业绩',
  outsourcingOrderCount: '外采单数',
  total: '总业绩',
}
const COMPANY_METRIC_NAMES: Record<DashboardCompanyMetricKey, string> = {
  halfPastTen: '十点半业绩',
  selfIncubated: '自孵（不含十点半）业绩',
  signingXiaohongshu: '小红书签约业绩',
  signingDouyin: '抖音签约业绩',
  signingShipinhao: '视频号签约业绩',
  outsourcing: '外采业绩',
  total: '总业绩',
}
type CompanyBoardColumnKey = DashboardCompanyMetricKey | 'orderCount'
const COMPANY_BOARD_COLUMNS: Array<{ key: CompanyBoardColumnKey; name: string; secondaryName?: string }> = [
  { key: 'total', name: '总业绩' },
  { key: 'halfPastTen', name: '十点半' },
  { key: 'selfIncubated', name: '自孵', secondaryName: '（不含十点半）' },
  { key: 'signingXiaohongshu', name: '小红书签约' },
  { key: 'signingDouyin', name: '抖音签约' },
  { key: 'signingShipinhao', name: '视频号签约' },
  { key: 'outsourcing', name: '外采' },
  { key: 'orderCount', name: '订单数' },
]
const COMPANY_SORT_COLUMNS: Record<CompanyBoardColumnKey, SortableColumnKey> = {
  halfPastTen: 'companyHalfPastTen',
  selfIncubated: 'companySelfIncubated',
  signingXiaohongshu: 'companySigningXiaohongshu',
  signingDouyin: 'companySigningDouyin',
  signingShipinhao: 'companySigningShipinhao',
  outsourcing: 'companyOutsourcing',
  total: 'companyTotal',
  orderCount: 'companyOrderCount',
}
const WANGYUE_TARGET_MANAGEMENT_PLATFORMS = [
  { id: 1, name: '小红书' },
  { id: 2, name: '抖音' },
  { id: 5, name: '视频号' },
  { id: 0, name: '外采' },
] as const
const WANGYUE_TARGET_MANAGEMENT_ADDABLE_PLATFORMS = WANGYUE_TARGET_MANAGEMENT_PLATFORMS.filter((platform) => platform.id !== 0)
const WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID = 0
const WANGYUE_TARGET_MANAGEMENT_DEFAULT_COMPANY_COUNT = 3
const WANGYUE_TARGET_MANAGEMENT_BRANDS_PER_PLATFORM = 2
const getTargetManagementDefaultBrandSlotCount = (platformId: number) =>
  platformId === WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID ? 1 : WANGYUE_TARGET_MANAGEMENT_BRANDS_PER_PLATFORM

interface WangYueTargetManagementLayout {
  companySlots: string[]
  brandFilters: Record<string, string>
  subBrandFilters: Record<string, string>
  brandSlotCounts: Record<string, number>
  productLines: Record<string, WangYueTargetManagementProductLine[]>
}

type WangYueTargetManagementProductLine = { id: string; name: string }

type WangYueTargetManagementLayouts = Record<number, WangYueTargetManagementLayout>

function getTargetManagementLayoutsStorageKey(employeeName: string) {
  return employeeName === '示例对客16' ? 'wangyue-target-management-layouts' : `target-management-layouts:${employeeName}`
}

function readWangYueTargetManagementLayouts(employeeName = '示例对客16'): WangYueTargetManagementLayouts {
  try {
    const saved = localStorage.getItem(getTargetManagementLayoutsStorageKey(employeeName))
    const parsed = saved ? JSON.parse(saved) as Record<string, unknown> : {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([monthKey, rawLayout]) => {
      const monthId = Number(monthKey)
      if (!TARGET_MANAGEMENT_MONTH_IDS.includes(monthId as TargetManagementMonthId) || !rawLayout || typeof rawLayout !== 'object') return []
      const layout = rawLayout as Partial<WangYueTargetManagementLayout>
      const companySlots = Array.isArray(layout.companySlots)
        ? layout.companySlots.map((value) => String(value ?? ''))
        : []
      const brandFilters = layout.brandFilters && typeof layout.brandFilters === 'object'
        ? Object.fromEntries(Object.entries(layout.brandFilters).map(([key, value]) => [key, String(value ?? '')]))
        : {}
      const subBrandFilters = layout.subBrandFilters && typeof layout.subBrandFilters === 'object'
        ? Object.fromEntries(Object.entries(layout.subBrandFilters).map(([key, value]) => [key, String(value ?? '')]))
        : {}
      const brandSlotCounts = layout.brandSlotCounts && typeof layout.brandSlotCounts === 'object'
        ? Object.fromEntries(Object.entries(layout.brandSlotCounts).flatMap(([key, value]) => {
          const count = Number(value)
          return Number.isInteger(count) && count >= 0 && count <= 100 ? [[key, count]] : []
        }))
        : {}
      const productLines = layout.productLines && typeof layout.productLines === 'object'
        ? Object.fromEntries(Object.entries(layout.productLines).flatMap(([key, value]) => Array.isArray(value)
          ? [[key, value.flatMap((line) => {
            if (!line || typeof line !== 'object') return []
            const item = line as Partial<WangYueTargetManagementProductLine>
            const id = String(item.id ?? '').trim()
            return id ? [{ id, name: String(item.name ?? '') }] : []
          })]]
          : []))
        : {}
      return [[monthId, { companySlots, brandFilters, subBrandFilters, brandSlotCounts, productLines }]]
    })) as WangYueTargetManagementLayouts
  } catch {
    return {}
  }
}

function saveWangYueTargetManagementLayout(monthId: number, layout: WangYueTargetManagementLayout, employeeName = '示例对客16') {
  try {
    const current = readWangYueTargetManagementLayouts(employeeName)
    localStorage.setItem(getTargetManagementLayoutsStorageKey(employeeName), JSON.stringify({
      ...current,
      [monthId]: layout,
    }))
  } catch {
    return
  }
}
const WANGYUE_TARGET_MANAGEMENT_COLUMNS = [
  { key: 'totalTarget', name: '总目标', kind: 'target' },
  { key: 'companyName', name: '公司名称', kind: 'company' },
  { key: 'platform', name: '平台', kind: 'dimension' },
  { key: 'projectBrand', name: '项目品牌', kind: 'brand' },
  { key: 'brandTotalTarget', name: '总目标', kind: 'calculatedTarget' },
  { key: 'contactPerson', name: '对接人', kind: 'dimension' },
  { key: 'halfPastTenActual', name: '十点半业绩', kind: 'actual', metricKey: 'halfPastTen', targetKey: 'halfPastTenTarget', valueType: 'amount' },
  { key: 'halfPastTenTarget', name: '十点半目标', kind: 'target', targetKey: 'halfPastTenTarget' },
  { key: 'selfIncubatedActual', name: '自孵化（不含十点半）业绩', kind: 'actual', metricKey: 'selfIncubated', targetKey: 'selfIncubatedTarget', valueType: 'amount' },
  { key: 'selfIncubatedTarget', name: '自孵化（不含十点半）目标', kind: 'target', targetKey: 'selfIncubatedTarget' },
  { key: 'signingXiaohongshuActual', name: '签约小红书业绩', kind: 'actual', metricKey: 'signingXiaohongshu', targetKey: 'signingXiaohongshuTarget', valueType: 'amount' },
  { key: 'signingXiaohongshuTarget', name: '签约小红书目标', kind: 'target', targetKey: 'signingXiaohongshuTarget' },
  { key: 'signingDouyinActual', name: '签约抖音业绩', kind: 'actual', metricKey: 'signingDouyin', targetKey: 'signingDouyinTarget', valueType: 'amount' },
  { key: 'signingDouyinTarget', name: '签约抖音目标', kind: 'target', targetKey: 'signingDouyinTarget' },
  { key: 'signingShipinhaoActual', name: '签约视频号业绩', kind: 'actual', metricKey: 'signingShipinhao', targetKey: 'signingShipinhaoTarget', valueType: 'amount' },
  { key: 'signingShipinhaoTarget', name: '签约视频号目标', kind: 'target', targetKey: 'signingShipinhaoTarget' },
  { key: 'outsourcingPerformanceActual', name: '外采业绩', kind: 'actual', metricKey: 'outsourcing', targetKey: 'outsourcingPerformanceTarget', valueType: 'amount' },
  { key: 'outsourcingPerformanceTarget', name: '外采业绩目标', kind: 'target', targetKey: 'outsourcingPerformanceTarget' },
  { key: 'tableCount', name: '做表数量', kind: 'actual' },
] as const
const TARGET_SPLIT_BOARD_COLUMNS = WANGYUE_TARGET_MANAGEMENT_COLUMNS.filter((column) =>
  column.key !== 'contactPerson'
    && column.key !== 'tableCount'
    && column.kind !== 'actual',
)
const TARGET_SPLIT_OUTSOURCING_PERFORMANCE_COLUMN = { key: 'outsourcingPerformanceTarget', name: '外采业绩目标', kind: 'target' }
const TARGET_SPLIT_BOARD_CUSTOMER_COLUMN = { key: 'customerFacingPerson', name: '对客人', kind: 'dimension' }
const TARGET_SPLIT_BOARD_ACTIONS_COLUMN = { key: 'actions', name: '操作', kind: 'dimension' }
const TARGET_SPLIT_SUMMARY_UNALLOCATED_COLUMN = { key: 'unallocatedTarget', name: '未细分目标', kind: 'calculatedTarget' }
const getTargetSplitColumnsWithOutsourcingPerformance = (
  includeOutsourcingPerformance: boolean,
  includeOutsourcingOrderCount = true,
) => (includeOutsourcingPerformance
  ? [...TARGET_SPLIT_BOARD_COLUMNS.flatMap((column) => column.key === 'outsourcingOrderCountTarget'
    ? [TARGET_SPLIT_OUTSOURCING_PERFORMANCE_COLUMN, column]
    : [column])]
  : TARGET_SPLIT_BOARD_COLUMNS).filter((column) => includeOutsourcingOrderCount || column.key !== 'outsourcingOrderCountTarget')
const getTargetSplitSummaryColumns = (
  includeOutsourcingPerformance = false,
  includeOutsourcingOrderCount = true,
  putUnallocatedBeforeCustomer = false,
) => {
  const boardColumns = getTargetSplitColumnsWithOutsourcingPerformance(includeOutsourcingPerformance, includeOutsourcingOrderCount)
  return [
    ...boardColumns.filter((column) => column.key === 'totalTarget'),
    ...(putUnallocatedBeforeCustomer ? [TARGET_SPLIT_SUMMARY_UNALLOCATED_COLUMN] : []),
    TARGET_SPLIT_BOARD_CUSTOMER_COLUMN,
    ...boardColumns.filter((column) => column.kind === 'target' && column.key !== 'totalTarget'),
    ...(!putUnallocatedBeforeCustomer ? [TARGET_SPLIT_SUMMARY_UNALLOCATED_COLUMN] : []),
  ]
}
const getTargetSplitBoardColumns = (includeOutsourcingPerformance = false, includeOutsourcingOrderCount = true) =>
  getTargetSplitColumnsWithOutsourcingPerformance(includeOutsourcingPerformance, includeOutsourcingOrderCount).flatMap((column) => column.key === 'totalTarget'
    ? [column, TARGET_SPLIT_BOARD_CUSTOMER_COLUMN]
    : [column]).concat(TARGET_SPLIT_BOARD_ACTIONS_COLUMN)
type WangYueTargetManagementGoalKey =
  | 'totalTarget'
  | 'contactPerson'
  | 'halfPastTenTarget'
  | 'halfPastTenActual'
  | 'halfPastTenCompletion'
  | 'selfIncubatedTarget'
  | 'selfIncubatedActual'
  | 'selfIncubatedCompletion'
  | 'signingXiaohongshuTarget'
  | 'signingXiaohongshuActual'
  | 'signingXiaohongshuCompletion'
  | 'signingDouyinTarget'
  | 'signingDouyinActual'
  | 'signingDouyinCompletion'
  | 'signingShipinhaoTarget'
  | 'signingShipinhaoActual'
  | 'signingShipinhaoCompletion'
  | 'outsourcingPerformanceTarget'
  | 'outsourcingPerformanceActual'
  | 'outsourcingPerformanceCompletion'
  | 'halfPastTenTargetMergeGroup'
  | 'selfIncubatedTargetMergeGroup'
  | 'signingXiaohongshuTargetMergeGroup'
  | 'signingDouyinTargetMergeGroup'
  | 'signingShipinhaoTargetMergeGroup'
  | 'importedEmptyProjectRow'
  | 'tableCount'
type WangYueTargetManagementGoals = Record<string, Partial<Record<WangYueTargetManagementGoalKey, string>>>
const WANGYUE_TARGET_MANAGEMENT_MERGEABLE_TARGET_KEYS = [
  'halfPastTenTarget',
  'selfIncubatedTarget',
  'signingXiaohongshuTarget',
  'signingDouyinTarget',
  'signingShipinhaoTarget',
  'outsourcingPerformanceTarget',
] as const
const getTargetManagementMergeGroupGoalKey = (targetKey: (typeof WANGYUE_TARGET_MANAGEMENT_MERGEABLE_TARGET_KEYS)[number]) =>
  `${targetKey}MergeGroup` as WangYueTargetManagementGoalKey

type TargetSplitFinancialGoalKey =
  | 'halfPastTenTarget'
  | 'selfIncubatedTarget'
  | 'signingXiaohongshuTarget'
  | 'signingDouyinTarget'
  | 'signingShipinhaoTarget'
  | 'outsourcingPerformanceTarget'
type TargetSplitGoalKey = TargetSplitFinancialGoalKey | 'outsourcingOrderCountTarget'
type TargetSplitSourceKey = 'publish' | 'deal' | 'unpublished'
type TargetSplitAllocationSettings = {
  sourceWeights: Record<TargetSplitSourceKey, string>
  personMultipliers: Record<string, string>
  outsourcingOrderCountMultipliers: Record<string, string>
}
type TargetSplitAllocationParameters = {
  sourceWeights: Record<TargetSplitSourceKey, number>
  personMultipliers: Record<string, number>
  outsourcingOrderCountMultipliers: Record<string, number>
}
type TargetSplitHistoryPeriod = number | 'current'
type TargetSplitPeriodsBySource = Record<TargetSplitSourceKey, TargetSplitHistoryPeriod[]>
type TargetSplitShareBreakdown = {
  shares: number[]
  performanceShares: number[]
  sourceContributions: Record<TargetSplitSourceKey, number[]>
  activeSources: TargetSplitSourceKey[]
  usesFallback: boolean
}
type TargetSplitRow = {
  id: string
  customerFacingPerson: string
  companyName: string
  platformId: number | null
  projectBrand: string
  targets: Partial<Record<TargetSplitGoalKey, string>>
}
type TargetSplitPlan = {
  totalTarget: string
  goalTargets: Partial<Record<TargetSplitGoalKey, string>>
  allocationSettings: TargetSplitAllocationSettings
  preserveOpportunityStructure: boolean
  personalOpportunityStructureInitialized: boolean
  rows: TargetSplitRow[]
  generatedRows: TargetSplitRow[]
  customerTargets: Record<string, string>
  generatedCustomerTargets: Record<string, string>
  importedCustomerTargetNames: string[]
  customerGoalTargets: Record<string, Partial<Record<TargetSplitGoalKey, string>>>
  customerRationales: Record<string, string>
  companyRationales: Record<string, string>
  generatedGoalTargets: Partial<Record<TargetSplitGoalKey, string>>
  sourceWarnings: string[]
  baselineMonthId: number | null
  allocationPolicyVersion: number
  sourceUpdatedAt: string
  generatedAt: string
}
type TargetSplitPlans = Partial<Record<TargetSplitMonthId, TargetSplitPlan>>
type TargetSplitSnapshotCache = {
  historyMonthIds: number[]
  sourcesByEmployee: Record<string, TargetSplitEmployeeSources>
}
type TargetSplitEditableField = 'customerFacingPerson' | 'companyName' | 'platformId' | 'projectBrand' | TargetSplitGoalKey
type TargetSplitEmployeeSources = {
  publish: Array<DashboardTargetManagementActualsResponse | null>
  deal: Array<DashboardTargetManagementActualsResponse | null>
  unpublished: DashboardUnpublishedOrder[] | null
  unpublishedUpdatedAt: string
  errors: Partial<Record<TargetSplitSourceKey, string[]>>
}
type TargetSplitOpportunity = {
  configuredRowId?: string
  customerFacingPerson: string
  companyName: string
  platformId: number
  projectBrand: string
  publishAmount: number
  dealAmount: number
  unpublishedAmount: number
  metricAmounts: Record<TargetSplitSourceKey, Record<TargetSplitGoalKey, number>>
  outsourcingCounts: Record<TargetSplitSourceKey, number>
  periodMetricAmounts: Record<TargetSplitSourceKey, Record<string, Partial<Record<TargetSplitGoalKey, number>>>>
  periodOutsourcingCounts: Record<TargetSplitSourceKey, Record<string, number>>
}

const TARGET_SPLIT_STORAGE_KEY = 'target-split-plans'
const TARGET_SPLIT_OWNER_NAMES = ['示例开发01', ...TARGET_MANAGEMENT_BOARD_EMPLOYEES] as const
const isPersonalTargetSplitOwner = (employeeName: string) =>
  TARGET_MANAGEMENT_BOARD_EMPLOYEES.some((name) => name === employeeName)
const supportsTargetSplitBoard = (employeeName: string) =>
  employeeName === '示例开发01' || isPersonalTargetSplitOwner(employeeName)
const getTargetSplitStorageKey = (ownerName: string) =>
  ownerName === '示例开发01' ? TARGET_SPLIT_STORAGE_KEY : `${TARGET_SPLIT_STORAGE_KEY}:${ownerName}`
const TARGET_SPLIT_TEAM_ALLOCATION_POLICY_VERSION = 10
const TARGET_SPLIT_MUYUAN_ALLOCATION_POLICY_VERSION = 11
const TARGET_SPLIT_MUYUAN_NOVEMBER_ALLOCATION_POLICY_VERSION = 16
const TARGET_SPLIT_PERSONAL_ALLOCATION_POLICY_VERSION = 11
const TARGET_SPLIT_PERSONAL_NOVEMBER_ALLOCATION_POLICY_VERSION = 12
const getTargetSplitAllocationPolicyVersion = (ownerName: string, targetMonthId: TargetSplitMonthId) =>
  ownerName === '示例开发01' && targetMonthId === 150
    ? TARGET_SPLIT_MUYUAN_NOVEMBER_ALLOCATION_POLICY_VERSION
    : ownerName === '示例开发01'
    ? TARGET_SPLIT_MUYUAN_ALLOCATION_POLICY_VERSION
    : isPersonalTargetSplitOwner(ownerName) && targetMonthId === 150
    ? TARGET_SPLIT_PERSONAL_NOVEMBER_ALLOCATION_POLICY_VERSION
    : ownerName === '示例对客16'
      ? TARGET_SPLIT_TEAM_ALLOCATION_POLICY_VERSION
      : TARGET_SPLIT_PERSONAL_ALLOCATION_POLICY_VERSION
const TARGET_SPLIT_MIN_PERSONAL_NOVEMBER_DETAIL_TARGET_WAN = 0.5
const WANGYUE_OUTSOURCING_EXCLUDED_COMPANY_PREFIXES = [
  '示例公司01有限公司',
  '示例公司02有限公司',
] as const
const isWangYueOutsourcingExcludedCompany = (companyName: string) =>
  WANGYUE_OUTSOURCING_EXCLUDED_COMPANY_PREFIXES.some((prefix) => companyName.trim().startsWith(prefix))
const TARGET_SPLIT_FINANCIAL_GOAL_KEYS: TargetSplitFinancialGoalKey[] = [
  'halfPastTenTarget',
  'selfIncubatedTarget',
  'signingXiaohongshuTarget',
  'signingDouyinTarget',
  'signingShipinhaoTarget',
  'outsourcingPerformanceTarget',
]
const TARGET_SPLIT_MUYUAN_FINANCIAL_GOAL_KEYS: TargetSplitFinancialGoalKey[] = [
  ...TARGET_SPLIT_FINANCIAL_GOAL_KEYS,
]
const TARGET_SPLIT_ALL_GOAL_KEYS: TargetSplitGoalKey[] = [...TARGET_SPLIT_MUYUAN_FINANCIAL_GOAL_KEYS, 'outsourcingOrderCountTarget']
const getTargetSplitFinancialGoalKeys = (ownerName: string, _plan?: TargetSplitPlan) =>
  ownerName === '示例开发01' ? TARGET_SPLIT_MUYUAN_FINANCIAL_GOAL_KEYS : TARGET_SPLIT_FINANCIAL_GOAL_KEYS
const getTargetSplitGoalKeys = (
  ownerName: string,
  plan?: TargetSplitPlan,
  targetMonthId?: TargetSplitMonthId,
): TargetSplitGoalKey[] => [
  ...getTargetSplitFinancialGoalKeys(ownerName, plan),
  ...(targetMonthId === 150 ? [] : ['outsourcingOrderCountTarget' as const]),
]
const TARGET_SPLIT_SOURCE_WEIGHTS: Record<TargetSplitSourceKey, number> = {
  publish: 0.3,
  deal: 0.4,
  unpublished: 0.3,
}
const TARGET_SPLIT_SOURCE_LABELS: Record<TargetSplitSourceKey, string> = {
  publish: '近三个月发布',
  deal: '上月成单',
  unpublished: '当前待发布',
}
const TARGET_SPLIT_DEFAULT_PERSON_MULTIPLIERS: Record<string, string> = Object.fromEntries(
  TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => [
    employeeName,
    ['示例对客13', '示例对客14', '示例对客16'].includes(employeeName)
      ? '1.08'
      : ['示例对客20', '示例对客19'].includes(employeeName) ? '0.88' : '1.00',
  ]),
)
const getDefaultTargetSplitTierMultiplier = (employeeName: string) =>
  ['示例对客19', '示例对客16'].includes(employeeName)
    ? '1.45'
    : ['示例对客14', '示例对客13'].includes(employeeName)
      ? '1.15'
      : ['示例对客17', '示例对客18', '示例对客15'].includes(employeeName) ? '0.95' : '0.60'
const TARGET_SPLIT_DEFAULT_OUTSOURCING_ORDER_COUNT_MULTIPLIERS: Record<string, string> = Object.fromEntries(
  TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => [employeeName, getDefaultTargetSplitTierMultiplier(employeeName)]),
)
const TARGET_SPLIT_PLATFORMS = [
  { id: 1, name: '小红书' },
  { id: 2, name: '抖音' },
  { id: 5, name: '视频号' },
  { id: 0, name: '外采' },
] as const

function createDefaultTargetSplitAllocationSettings(): TargetSplitAllocationSettings {
  return {
    sourceWeights: { publish: '30', deal: '40', unpublished: '30' },
    personMultipliers: { ...TARGET_SPLIT_DEFAULT_PERSON_MULTIPLIERS },
    outsourcingOrderCountMultipliers: { ...TARGET_SPLIT_DEFAULT_OUTSOURCING_ORDER_COUNT_MULTIPLIERS },
  }
}

function readTargetSplitAllocationSettings(value: unknown): TargetSplitAllocationSettings {
  const defaults = createDefaultTargetSplitAllocationSettings()
  if (!value || typeof value !== 'object') return defaults
  const raw = value as Partial<TargetSplitAllocationSettings>
  const sourceWeights = raw.sourceWeights && typeof raw.sourceWeights === 'object'
    ? raw.sourceWeights as Partial<Record<TargetSplitSourceKey, unknown>>
    : {}
  const personMultipliers = raw.personMultipliers && typeof raw.personMultipliers === 'object'
    ? raw.personMultipliers as Record<string, unknown>
    : {}
  const outsourcingOrderCountMultipliers = raw.outsourcingOrderCountMultipliers && typeof raw.outsourcingOrderCountMultipliers === 'object'
    ? raw.outsourcingOrderCountMultipliers as Record<string, unknown>
    : {}
  return {
    sourceWeights: Object.fromEntries((Object.keys(defaults.sourceWeights) as TargetSplitSourceKey[]).map((key) => {
      const candidate = sourceWeights[key]
      const parsed = candidate === '' ? Number.NaN : Number(candidate)
      const validCandidate = candidate === ''
        || ((typeof candidate === 'string' || typeof candidate === 'number') && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100)
      return [key, validCandidate
        ? String(candidate)
        : defaults.sourceWeights[key]]
    })) as TargetSplitAllocationSettings['sourceWeights'],
    personMultipliers: Object.fromEntries(TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => {
      const candidate = personMultipliers[employeeName]
      const parsed = candidate === '' ? Number.NaN : Number(candidate)
      const validCandidate = candidate === ''
        || ((typeof candidate === 'string' || typeof candidate === 'number') && Number.isFinite(parsed) && parsed >= 0 && parsed <= 2)
      return [employeeName, validCandidate
        ? String(candidate)
        : defaults.personMultipliers[employeeName]]
    })),
    outsourcingOrderCountMultipliers: Object.fromEntries(TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => {
      const candidate = outsourcingOrderCountMultipliers[employeeName]
      const parsed = candidate === '' ? Number.NaN : Number(candidate)
      const validCandidate = candidate === ''
        || ((typeof candidate === 'string' || typeof candidate === 'number') && Number.isFinite(parsed) && parsed >= 0 && parsed <= 2)
      return [employeeName, validCandidate
        ? String(candidate)
        : defaults.outsourcingOrderCountMultipliers[employeeName]]
    })),
  }
}

function getTargetSplitAllocationSettingsError(settings: TargetSplitAllocationSettings) {
  const sourceWeights = Object.values(settings.sourceWeights).map((value) => value.trim())
  const parsedSourceWeights = sourceWeights.map(Number)
  if (sourceWeights.some((value) => !value) || parsedSourceWeights.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return '发布、成单和待发布权重均需填写 0–100 的数字。'
  }
  const sourceWeightTotal = parsedSourceWeights.reduce((sum, value) => sum + value, 0)
  if (Math.abs(sourceWeightTotal - 100) > 0.01) {
    return `来源权重合计为 ${sourceWeightTotal.toFixed(2)}%，需要等于 100%。`
  }
  const invalidEmployee = TARGET_MANAGEMENT_BOARD_EMPLOYEES.find((employeeName) => {
    const rawValue = settings.personMultipliers[employeeName]?.trim() ?? ''
    const value = Number(rawValue)
    return !rawValue || !Number.isFinite(value) || value < 0 || value > 2
  })
  if (invalidEmployee) return `${invalidEmployee}的示例公司有限公司系数需填写 0–2 之间的数字。`
  const invalidOutsourcingEmployee = TARGET_MANAGEMENT_BOARD_EMPLOYEES.find((employeeName) => {
    const rawValue = settings.outsourcingOrderCountMultipliers[employeeName]?.trim() ?? ''
    const value = Number(rawValue)
    return !rawValue || !Number.isFinite(value) || value < 0 || value > 2
  })
  return invalidOutsourcingEmployee
    ? `${invalidOutsourcingEmployee}的外采单数系数需填写 0–2 之间的数字。`
    : ''
}

function toTargetSplitAllocationParameters(settings: TargetSplitAllocationSettings): TargetSplitAllocationParameters {
  return {
    sourceWeights: Object.fromEntries((Object.keys(settings.sourceWeights) as TargetSplitSourceKey[])
      .map((key) => [key, Number(settings.sourceWeights[key]) / 100])) as Record<TargetSplitSourceKey, number>,
    personMultipliers: Object.fromEntries(TARGET_MANAGEMENT_BOARD_EMPLOYEES
      .map((employeeName) => [employeeName, Number(settings.personMultipliers[employeeName])])),
    outsourcingOrderCountMultipliers: Object.fromEntries(TARGET_MANAGEMENT_BOARD_EMPLOYEES
      .map((employeeName) => [employeeName, Number(settings.outsourcingOrderCountMultipliers[employeeName])])),
  }
}

const TARGET_SPLIT_PLATFORM_TARGETS: Record<number, TargetSplitFinancialGoalKey[]> = {
  1: ['halfPastTenTarget', 'selfIncubatedTarget', 'signingXiaohongshuTarget', 'outsourcingPerformanceTarget'],
  2: ['selfIncubatedTarget', 'signingDouyinTarget', 'outsourcingPerformanceTarget'],
  5: ['selfIncubatedTarget', 'signingShipinhaoTarget', 'outsourcingPerformanceTarget'],
  0: ['outsourcingPerformanceTarget'],
}
const TARGET_SPLIT_METRIC_BY_GOAL: Record<TargetSplitGoalKey, keyof DashboardTargetManagementActualRow['metrics']> = {
  halfPastTenTarget: 'halfPastTen',
  selfIncubatedTarget: 'selfIncubated',
  signingXiaohongshuTarget: 'signingXiaohongshu',
  signingDouyinTarget: 'signingDouyin',
  signingShipinhaoTarget: 'signingShipinhao',
  outsourcingPerformanceTarget: 'outsourcing',
  outsourcingOrderCountTarget: 'outsourcing',
}

function createEmptyTargetSplitPlan(totalTarget = ''): TargetSplitPlan {
  return {
    totalTarget,
    goalTargets: Object.fromEntries(TARGET_SPLIT_ALL_GOAL_KEYS.map((key) => [key, ''])) as TargetSplitPlan['goalTargets'],
    allocationSettings: createDefaultTargetSplitAllocationSettings(),
    preserveOpportunityStructure: false,
    personalOpportunityStructureInitialized: false,
    rows: [],
    generatedRows: [],
    customerTargets: {},
    generatedCustomerTargets: {},
    importedCustomerTargetNames: [],
    customerGoalTargets: {},
    customerRationales: {},
    companyRationales: {},
    generatedGoalTargets: {},
    sourceWarnings: [],
    baselineMonthId: null,
    allocationPolicyVersion: 0,
    sourceUpdatedAt: '',
    generatedAt: '',
  }
}

function removeTargetSplitOutsourcingOrderCount(plan: TargetSplitPlan): TargetSplitPlan {
  const removeGoal = (goals: Partial<Record<TargetSplitGoalKey, string>> = {}) =>
    Object.fromEntries(Object.entries(goals).filter(([key]) => key !== 'outsourcingOrderCountTarget')) as Partial<Record<TargetSplitGoalKey, string>>
  const removeRowGoal = (row: TargetSplitRow): TargetSplitRow => ({ ...row, targets: removeGoal(row.targets) })
  return {
    ...plan,
    goalTargets: removeGoal(plan.goalTargets) as TargetSplitPlan['goalTargets'],
    generatedGoalTargets: removeGoal(plan.generatedGoalTargets),
    customerGoalTargets: Object.fromEntries(Object.entries(plan.customerGoalTargets ?? {}).map(([employeeName, goals]) => [employeeName, removeGoal(goals)])),
    rows: plan.rows.map(removeRowGoal),
    generatedRows: plan.generatedRows.map(removeRowGoal),
  }
}

function hasPersistableTargetSplitPlan(plan?: TargetSplitPlan): plan is TargetSplitPlan {
  if (!plan) return false
  return Boolean(
    plan.totalTarget.trim()
    || Object.values(plan.goalTargets).some((value) => String(value ?? '').trim())
    || plan.rows.length
    || plan.generatedRows.length
    || plan.generatedAt
    || Object.keys(plan.customerTargets).length
    || Object.keys(plan.customerGoalTargets).length
    || plan.personalOpportunityStructureInitialized,
  )
}

function isTargetSplitPlan(value: unknown): value is TargetSplitPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const plan = value as Partial<TargetSplitPlan>
  return typeof plan.totalTarget === 'string'
    && Boolean(plan.goalTargets && typeof plan.goalTargets === 'object')
    && Boolean(plan.allocationSettings && typeof plan.allocationSettings === 'object')
    && Array.isArray(plan.rows)
    && Array.isArray(plan.generatedRows)
}

function readTargetSplitPlans(ownerName = '示例开发01'): TargetSplitPlans {
  try {
    const saved = localStorage.getItem(getTargetSplitStorageKey(ownerName))
    const parsed = saved ? JSON.parse(saved) as Record<string, unknown> : {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([monthKey, value]) => {
      const monthId = Number(monthKey) as TargetSplitMonthId
      if (!TARGET_SPLIT_MONTH_IDS.includes(monthId) || !value || typeof value !== 'object') return []
      const plan = value as Partial<TargetSplitPlan>
      const goalKeys = ownerName === '示例开发01' && monthId === 150
        ? TARGET_SPLIT_ALL_GOAL_KEYS.filter((key) => key !== 'outsourcingOrderCountTarget')
        : TARGET_SPLIT_ALL_GOAL_KEYS
      const readRows = (rows: unknown): TargetSplitRow[] => Array.isArray(rows)
        ? rows.flatMap((item, index) => {
          if (!item || typeof item !== 'object') return []
          const row = item as Partial<TargetSplitRow>
          const targets = row.targets && typeof row.targets === 'object'
            ? Object.fromEntries(Object.entries(row.targets).filter(([key, raw]) =>
              goalKeys.includes(key as TargetSplitGoalKey)
              && (raw === '' || Number.isFinite(Number(raw))),
            ).map(([key, raw]) => [key, String(raw ?? '')])) as TargetSplitRow['targets']
            : {}
          return [{
            id: String(row.id ?? `target-split-${monthId}-${index}`),
            customerFacingPerson: String(row.customerFacingPerson ?? ''),
            companyName: String(row.companyName ?? ''),
            platformId: row.platformId === null || row.platformId === undefined
              ? null
              : Number(row.platformId),
            projectBrand: String(row.projectBrand ?? ''),
            targets,
          }]
        })
        : []
      const rows = readRows(plan.rows)
      const generatedRows = readRows(plan.generatedRows)
      const shouldCleanNovemberRowsByAllocationRule = isPersonalTargetSplitOwner(ownerName) && monthId === 150
      const rowsWithAllocatedTargetsOnly = (inputRows: TargetSplitRow[]) => shouldCleanNovemberRowsByAllocationRule
        ? inputRows.flatMap((row) => {
          const targets = { ...row.targets }
          const financialGoalKeys = Number(targets.outsourcingPerformanceTarget) > 0
            ? TARGET_SPLIT_MUYUAN_FINANCIAL_GOAL_KEYS
            : TARGET_SPLIT_FINANCIAL_GOAL_KEYS
          const financialTotal = getTargetSplitFinancialTotal(targets, financialGoalKeys)
          const belowMinimumFinancialTarget = financialTotal < TARGET_SPLIT_MIN_PERSONAL_NOVEMBER_DETAIL_TARGET_WAN
          if (belowMinimumFinancialTarget) financialGoalKeys.forEach((goalKey) => delete targets[goalKey])
          if (belowMinimumFinancialTarget && Number(targets.outsourcingOrderCountTarget) <= 0) return []
          return [{ ...row, targets }]
        })
        : inputRows
      const savedRows = rowsWithAllocatedTargetsOnly(rows)
      const savedGeneratedRows = rowsWithAllocatedTargetsOnly(generatedRows)
      const readGoalTargets = (rawTargets: Partial<Record<TargetSplitGoalKey, string>> | undefined, fallbackRows: TargetSplitRow[]) =>
        Object.fromEntries(goalKeys.map((key) => {
          const rawValue = rawTargets?.[key]
          if (rawValue !== undefined && (rawValue === '' || Number.isFinite(Number(rawValue)))) return [key, String(rawValue)]
          const legacyTotal = fallbackRows.reduce((sum, row) => sum + (Number(row.targets[key]) || 0), 0)
          return [key, legacyTotal > 0 ? (key === 'outsourcingOrderCountTarget' ? String(Math.round(legacyTotal)) : legacyTotal.toFixed(2)) : '']
        })) as TargetSplitPlan['goalTargets']
      const goalTargets = readGoalTargets(plan.goalTargets, savedRows)
      const generatedGoalTargets = plan.generatedGoalTargets && typeof plan.generatedGoalTargets === 'object'
        ? readGoalTargets(plan.generatedGoalTargets, savedGeneratedRows)
        : readGoalTargets(undefined, savedGeneratedRows)
      const customerGoalTargets = plan.customerGoalTargets && typeof plan.customerGoalTargets === 'object'
        ? Object.fromEntries(Object.entries(plan.customerGoalTargets).map(([employeeName, values]) => {
          const rawValues = values && typeof values === 'object' ? values as Partial<Record<TargetSplitGoalKey, unknown>> : {}
          return [employeeName, Object.fromEntries(goalKeys.flatMap((key) => {
            const rawValue = rawValues[key]
            return rawValue === '' || Number.isFinite(Number(rawValue)) ? [[key, String(rawValue ?? '')]] : []
          }))]
        })) as TargetSplitPlan['customerGoalTargets']
        : Object.fromEntries(TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => [employeeName,
          Object.fromEntries(goalKeys.map((key) => {
            const total = savedRows.filter((row) => row.customerFacingPerson === employeeName)
              .reduce((sum, row) => sum + (Number(row.targets[key]) || 0), 0)
            return [key, key === 'outsourcingOrderCountTarget' ? String(Math.round(total)) : total.toFixed(2)]
          })),
        ]))
      const savedPolicyVersion = Number.isInteger(plan.allocationPolicyVersion) ? Number(plan.allocationPolicyVersion) : 0
      const allocationSettings = readTargetSplitAllocationSettings(plan.allocationSettings)
      if (savedPolicyVersion < 4) {
        allocationSettings.outsourcingOrderCountMultipliers = { ...TARGET_SPLIT_DEFAULT_OUTSOURCING_ORDER_COUNT_MULTIPLIERS }
      }
      return [[monthId, {
        ...createEmptyTargetSplitPlan(),
        totalTarget: String(plan.totalTarget ?? ''),
        goalTargets,
        allocationSettings,
        preserveOpportunityStructure: typeof plan.preserveOpportunityStructure === 'boolean'
          ? plan.preserveOpportunityStructure
          : savedRows.length > 0 || savedGeneratedRows.length > 0,
        personalOpportunityStructureInitialized: typeof plan.personalOpportunityStructureInitialized === 'boolean'
          ? plan.personalOpportunityStructureInitialized
          : ownerName === '示例对客16' && plan.preserveOpportunityStructure === true,
        rows: savedRows,
        generatedRows: savedGeneratedRows,
        customerTargets: plan.customerTargets && typeof plan.customerTargets === 'object'
          ? Object.fromEntries(Object.entries(plan.customerTargets).map(([key, raw]) => [key, String(raw ?? '')]))
          : {},
        generatedCustomerTargets: plan.generatedCustomerTargets && typeof plan.generatedCustomerTargets === 'object'
          ? Object.fromEntries(Object.entries(plan.generatedCustomerTargets).map(([key, raw]) => [key, String(raw ?? '')]))
          : {},
        importedCustomerTargetNames: Array.isArray(plan.importedCustomerTargetNames)
          ? plan.importedCustomerTargetNames.map(String)
          : [],
        customerGoalTargets,
        customerRationales: plan.customerRationales && typeof plan.customerRationales === 'object'
          ? Object.fromEntries(Object.entries(plan.customerRationales).map(([key, raw]) => [key, String(raw ?? '')]))
          : {},
        companyRationales: plan.companyRationales && typeof plan.companyRationales === 'object'
          ? Object.fromEntries(Object.entries(plan.companyRationales).map(([key, raw]) => [key, String(raw ?? '')]))
          : {},
        generatedGoalTargets,
        sourceWarnings: Array.isArray(plan.sourceWarnings) ? plan.sourceWarnings.map(String) : [],
        baselineMonthId: Number.isInteger(plan.baselineMonthId) ? Number(plan.baselineMonthId) : null,
        allocationPolicyVersion: Number.isInteger(plan.allocationPolicyVersion) ? Number(plan.allocationPolicyVersion) : 0,
        sourceUpdatedAt: String(plan.sourceUpdatedAt ?? ''),
        generatedAt: String(plan.generatedAt ?? ''),
      }]]
    })) as TargetSplitPlans
  } catch {
    return {}
  }
}

function getTargetSplitFinancialTotal(
  targets: Partial<Record<TargetSplitGoalKey, string>>,
  financialGoalKeys: readonly TargetSplitFinancialGoalKey[] = TARGET_SPLIT_FINANCIAL_GOAL_KEYS,
) {
  return financialGoalKeys.reduce((sum, key) => sum + (Number(targets[key]) || 0), 0)
}

function hasTargetSplitRowAllocation(row: TargetSplitRow) {
  return TARGET_SPLIT_ALL_GOAL_KEYS.some((goalKey) => Number(row.targets[goalKey]) > 0)
}

function shouldKeepTargetSplitRow(row: TargetSplitRow, employeeName: string) {
  if (hasTargetSplitRowAllocation(row)) return true
  if (employeeName === '示例对客19' && ['示例品牌', '示例品牌'].includes(row.projectBrand.trim())) return false
  return row.id.startsWith('manual-')
}

function distributeTargetUnits(totalUnits: number, weights: number[]) {
  if (weights.length === 0) return []
  const safeWeights = weights.map((weight) => Number.isFinite(weight) && weight > 0 ? weight : 0)
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0)
  const normalizedWeights = totalWeight > 0
    ? safeWeights.map((weight) => weight / totalWeight)
    : weights.map(() => 1 / weights.length)
  const values = normalizedWeights.map((weight) => Math.floor(Math.max(0, totalUnits) * weight))
  let remainder = Math.max(0, totalUnits) - values.reduce((sum, value) => sum + value, 0)
  const indexes = normalizedWeights.map((weight, index) => ({ index, weight })).sort((left, right) => right.weight - left.weight)
  for (let index = 0; remainder > 0; index += 1, remainder -= 1) values[indexes[index % indexes.length].index] += 1
  return values
}

function alignTargetSplitRowsToGoalTargets(
  rows: TargetSplitRow[],
  goalTargets: Partial<Record<TargetSplitGoalKey, string>>,
  goalKeys: readonly TargetSplitFinancialGoalKey[],
) {
  let alignedRows = rows.map((row) => ({ ...row, targets: { ...row.targets } }))
  for (const goalKey of goalKeys) {
    const targetUnits = Math.max(0, Math.round((Number(goalTargets[goalKey]) || 0) * 100))
    const rowUnits = alignedRows.map((row) => Math.max(0, Math.round((Number(row.targets[goalKey]) || 0) * 100)))
    const totalRowUnits = rowUnits.reduce((sum, units) => sum + units, 0)
    if (targetUnits > 0 && totalRowUnits === 0) continue
    const alignedUnits = targetUnits > 0 ? distributeTargetUnits(targetUnits, rowUnits) : rowUnits.map(() => 0)
    alignedRows = alignedRows.map((row, index) => {
      const targets = { ...row.targets }
      const units = alignedUnits[index] ?? 0
      if (units > 0) targets[goalKey] = (units / 100).toFixed(2)
      else delete targets[goalKey]
      return { ...row, targets }
    })
  }
  return alignedRows
}

function balanceTargetSplitCustomerGoals(
  employeeNames: readonly string[],
  financialGoalKeys: readonly TargetSplitFinancialGoalKey[],
  goalKeys: readonly TargetSplitGoalKey[],
  goalTargets: Partial<Record<TargetSplitGoalKey, string>>,
  customerTargets: Record<string, string>,
  personSharesByGoal: Map<TargetSplitGoalKey, number[]>,
  ensureGoalForEveryEmployee?: TargetSplitFinancialGoalKey,
) {
  const rowUnits = employeeNames.map((employeeName) => Math.round((Number(customerTargets[employeeName]) || 0) * 100))
  const columnUnits = financialGoalKeys.map((goalKey) => Math.round((Number(goalTargets[goalKey]) || 0) * 100))
  const minimumGoalColumnIndex = ensureGoalForEveryEmployee
    ? financialGoalKeys.indexOf(ensureGoalForEveryEmployee)
    : -1
  const overallShares = employeeNames.map((_, employeeIndex) => financialGoalKeys.reduce(
    (sum, goalKey) => sum + Math.max(0, personSharesByGoal.get(goalKey)?.[employeeIndex] ?? 0),
    0,
  ))
  const overallShareTotal = overallShares.reduce((sum, share) => sum + share, 0)
  const normalizedOverallShares = overallShareTotal > 0
    ? overallShares.map((share) => share / overallShareTotal)
    : employeeNames.map(() => 1 / Math.max(1, employeeNames.length))
  const result = Object.fromEntries(employeeNames.map((employeeName) => [employeeName, {}])) as Record<string, Partial<Record<TargetSplitGoalKey, string>>>
  employeeNames.forEach((employeeName, employeeIndex) => {
    const categoryWeights = financialGoalKeys.map((goalKey, goalIndex) => {
      if ((columnUnits[goalIndex] ?? 0) <= 0) return 0
      const shares = personSharesByGoal.get(goalKey) ?? []
      const shareTotal = shares.reduce((sum, share) => sum + Math.max(0, share), 0)
      const categoryShare = shareTotal > 0
        ? Math.max(0, shares[employeeIndex] ?? 0) / shareTotal
        : normalizedOverallShares[employeeIndex] ?? 0
      const fallbackShare = normalizedOverallShares[employeeIndex] ?? 0
      return (columnUnits[goalIndex] ?? 0) * Math.max(categoryShare, fallbackShare * 0.000001, 0.000000001)
    })
    const categoryWeightTotal = categoryWeights.reduce((sum, weight) => sum + weight, 0)
    const reservedVideoGoal = minimumGoalColumnIndex >= 0
      && (columnUnits[minimumGoalColumnIndex] ?? 0) >= employeeNames.length
      && rowUnits[employeeIndex] > 0
      ? 1
      : 0
    const allocatedUnits = categoryWeightTotal > 0
      ? distributeTargetUnits(Math.max(0, rowUnits[employeeIndex] - reservedVideoGoal), categoryWeights)
      : financialGoalKeys.map(() => 0)
    if (reservedVideoGoal > 0) allocatedUnits[minimumGoalColumnIndex] += reservedVideoGoal
    financialGoalKeys.forEach((goalKey, goalIndex) => {
      result[employeeName][goalKey] = ((allocatedUnits[goalIndex] ?? 0) / 100).toFixed(2)
    })
  })
  goalKeys.filter((goalKey) => !financialGoalKeys.includes(goalKey as TargetSplitFinancialGoalKey)).forEach((goalKey) => {
    const totalUnits = Math.round(Number(goalTargets[goalKey]) || 0)
    const shares = personSharesByGoal.get(goalKey) ?? []
    const allocatedUnits = distributeTargetUnits(totalUnits, shares)
    employeeNames.forEach((employeeName, employeeIndex) => {
      result[employeeName][goalKey] = String(allocatedUnits[employeeIndex] ?? 0)
    })
  })
  return result
}

function getTargetSplitTieredShares(performanceShares: number[], tierWeights: number[]) {
  if (tierWeights.length === 0) return []
  const safeTierWeights = tierWeights.map((weight) => Number.isFinite(weight) && weight > 0 ? weight : 0)
  const tierMemberIndexes = new Map<number, number[]>()
  safeTierWeights.forEach((weight, index) => {
    tierMemberIndexes.set(weight, [...(tierMemberIndexes.get(weight) ?? []), index])
  })
  const tieredShares = safeTierWeights.map((weight, index) => {
    const members = tierMemberIndexes.get(weight) ?? [index]
    const tierMeanShare = members.reduce((sum, memberIndex) => sum + (performanceShares[memberIndex] ?? 0), 0) / members.length
    const ratio = tierMeanShare > 0 ? (performanceShares[index] ?? 0) / tierMeanShare : 1
    const tilt = Math.min(1.05, Math.max(0.95, Math.sqrt(Math.max(0, ratio))))
    return weight * tilt
  })
  const totalTierWeight = tieredShares.reduce((sum, weight) => sum + weight, 0)
  return totalTierWeight > 0
    ? tieredShares.map((weight) => weight / totalTierWeight)
    : tierWeights.map(() => 1 / tierWeights.length)
}

function getTargetSplitOpportunityShareBreakdown<T>(
  items: T[],
  getAmount: (item: T, source: TargetSplitSourceKey, period: TargetSplitHistoryPeriod) => number,
  enabledSources: Record<TargetSplitSourceKey, boolean>,
  periodsBySource: TargetSplitPeriodsBySource,
  equalFloor = 0.15,
  getFallbackAmount?: (item: T, source: TargetSplitSourceKey, period: TargetSplitHistoryPeriod) => number,
  sourceWeights: Record<TargetSplitSourceKey, number> = TARGET_SPLIT_SOURCE_WEIGHTS,
): TargetSplitShareBreakdown {
  const emptyContributions: Record<TargetSplitSourceKey, number[]> = {
    publish: items.map(() => 0),
    deal: items.map(() => 0),
    unpublished: items.map(() => 0),
  }
  if (items.length === 0) {
    return { shares: [], performanceShares: [], sourceContributions: emptyContributions, activeSources: [], usesFallback: false }
  }
  const hasPrimaryHistory = (Object.keys(TARGET_SPLIT_SOURCE_WEIGHTS) as TargetSplitSourceKey[]).some((source) =>
    enabledSources[source] && periodsBySource[source].some((period) =>
      items.reduce((sum, item) => sum + Math.max(0, getAmount(item, source, period)), 0) > 0,
    ),
  )
  const getScoringAmount = hasPrimaryHistory ? getAmount : getFallbackAmount
  if (!getScoringAmount) {
    return { shares: [], performanceShares: [], sourceContributions: emptyContributions, activeSources: [], usesFallback: false }
  }
  const activeSources = (Object.keys(TARGET_SPLIT_SOURCE_WEIGHTS) as TargetSplitSourceKey[])
    .filter((source) => enabledSources[source] && periodsBySource[source].some((period) =>
      items.reduce((sum, item) => sum + Math.max(0, getScoringAmount(item, source, period)), 0) > 0,
    ))
  if (activeSources.length === 0) {
    return { shares: [], performanceShares: [], sourceContributions: emptyContributions, activeSources, usesFallback: !hasPrimaryHistory }
  }
  const sourceWeightTotal = activeSources.reduce((sum, source) => sum + sourceWeights[source], 0)
  const useEqualSourceWeights = sourceWeightTotal <= 0
  const sourceContributions: Record<TargetSplitSourceKey, number[]> = { ...emptyContributions }
  activeSources.forEach((source) => {
    const availablePeriods = periodsBySource[source].filter((period) =>
      items.reduce((sourceSum, candidate) => sourceSum + Math.max(0, getScoringAmount(candidate, source, period)), 0) > 0,
    )
    items.forEach((item, itemIndex) => {
      const averagePeriodShare = availablePeriods.reduce<number>((periodSum, period) => {
        const periodTotal = items.reduce((sourceSum, candidate) => sourceSum + Math.max(0, getScoringAmount(candidate, source, period)), 0)
        return periodSum + Math.max(0, getScoringAmount(item, source, period)) / periodTotal
      }, 0) / availablePeriods.length
      const normalizedSourceWeight = useEqualSourceWeights
        ? 1 / activeSources.length
        : sourceWeights[source] / sourceWeightTotal
      sourceContributions[source][itemIndex] = averagePeriodShare * normalizedSourceWeight
    })
  })
  const scores = items.map((_, itemIndex) =>
    activeSources.reduce((sum, source) => sum + sourceContributions[source][itemIndex], 0),
  )
  const scoreTotal = scores.reduce((sum, score) => sum + score, 0)
  const performanceShares = scoreTotal > 0 ? scores.map((score) => score / scoreTotal) : items.map(() => 1 / items.length)
  if (scoreTotal > 0) {
    for (const source of activeSources) {
      sourceContributions[source] = sourceContributions[source].map((contribution) => contribution / scoreTotal)
    }
  }
  return {
    shares: performanceShares.map((share) => share * (1 - equalFloor) + equalFloor / items.length),
    performanceShares,
    sourceContributions,
    activeSources,
    usesFallback: !hasPrimaryHistory,
  }
}

function getTargetSplitOpportunityShares<T>(
  items: T[],
  getAmount: (item: T, source: TargetSplitSourceKey, period: TargetSplitHistoryPeriod) => number,
  enabledSources: Record<TargetSplitSourceKey, boolean>,
  periodsBySource: TargetSplitPeriodsBySource,
  equalFloor = 0.15,
  getFallbackAmount?: (item: T, source: TargetSplitSourceKey, period: TargetSplitHistoryPeriod) => number,
  sourceWeights: Record<TargetSplitSourceKey, number> = TARGET_SPLIT_SOURCE_WEIGHTS,
) {
  return getTargetSplitOpportunityShareBreakdown(
    items,
    getAmount,
    enabledSources,
    periodsBySource,
    equalFloor,
    getFallbackAmount,
    sourceWeights,
  ).shares
}

function getTargetSplitMetricAmount(row: DashboardTargetManagementActualRow, goalKey: TargetSplitGoalKey) {
  return Number(row.metrics[TARGET_SPLIT_METRIC_BY_GOAL[goalKey]]?.amount ?? 0)
}

function buildTargetSplitPlanFromSnapshots(
  targetMonthId: TargetSplitMonthId,
  historyMonthIds: number[],
  totalTarget: string,
  goalTargets: Partial<Record<TargetSplitGoalKey, string>>,
  sourcesByEmployee: Record<string, TargetSplitEmployeeSources>,
  allocationParameters: TargetSplitAllocationParameters,
  employeeNames: readonly string[] = TARGET_MANAGEMENT_BOARD_EMPLOYEES,
  configuredRows?: TargetSplitRow[],
  financialGoalKeys: readonly TargetSplitFinancialGoalKey[] = TARGET_SPLIT_FINANCIAL_GOAL_KEYS,
  configuredCustomerGoalTargets?: Record<string, Partial<Record<TargetSplitGoalKey, string>>>,
  sourcePeriodsOverride?: Partial<Record<'publish' | 'deal', number[]>>,
  configuredCustomerTargets?: Record<string, string>,
  includeOutsourcingOrderCountTarget = true,
) {
  const baselineMonthId = targetMonthId - 1
  const requiredMonthIdsBySource = {
    publish: sourcePeriodsOverride?.publish ?? historyMonthIds,
    deal: sourcePeriodsOverride?.deal ?? [baselineMonthId],
  }
  const completeMonthsBySource = {
    publish: requiredMonthIdsBySource.publish.filter((monthId) => {
      const monthIndex = historyMonthIds.indexOf(monthId)
      return monthIndex >= 0 && employeeNames.every((employeeName) =>
        sourcesByEmployee[employeeName]?.publish[monthIndex] !== null
        && sourcesByEmployee[employeeName]?.publish[monthIndex] !== undefined,
      )
    }),
    deal: requiredMonthIdsBySource.deal.filter((monthId) => {
      const monthIndex = historyMonthIds.indexOf(monthId)
      return monthIndex >= 0 && employeeNames.every((employeeName) =>
        sourcesByEmployee[employeeName]?.deal[monthIndex] !== null
        && sourcesByEmployee[employeeName]?.deal[monthIndex] !== undefined,
      )
    }),
  }
  const unpublishedComplete = employeeNames.every((employeeName) =>
    sourcesByEmployee[employeeName]?.unpublished !== null
      && sourcesByEmployee[employeeName]?.unpublished !== undefined,
  )
  const enabledSources: Record<TargetSplitSourceKey, boolean> = {
    publish: completeMonthsBySource.publish.length > 0,
    deal: completeMonthsBySource.deal.length > 0,
    unpublished: unpublishedComplete,
  }
  const periodsBySource: TargetSplitPeriodsBySource = {
    publish: completeMonthsBySource.publish,
    deal: completeMonthsBySource.deal,
    unpublished: unpublishedComplete ? ['current'] : [],
  }
  const sourceWarnings = (['publish', 'deal'] as const).flatMap((source) => {
    const label = source === 'publish' ? '发布' : '成单'
    const skippedMonths = requiredMonthIdsBySource[source].flatMap((monthId) => {
      const monthIndex = historyMonthIds.indexOf(monthId)
      if (monthIndex < 0) return [`方片月${monthId - 139}月：不在可读取的历史范围内`]
      if (completeMonthsBySource[source].includes(monthId)) return []
      const missingEmployees = employeeNames.filter((employeeName) =>
        !sourcesByEmployee[employeeName]?.[source][monthIndex],
      ).map((employeeName) => {
        const error = sourcesByEmployee[employeeName]?.errors[source]?.[monthIndex]
        return error ? `${employeeName}（${error}）` : employeeName
      })
      const monthLabel = DASHBOARD_FANGPIAN_PERIODS[monthId as keyof typeof DASHBOARD_FANGPIAN_PERIODS]?.label ?? `方片月${monthId}`
      return [`${monthLabel}：${missingEmployees.join('、') || '快照不完整'}`]
    })
    return skippedMonths.length > 0
      ? [`${label}快照覆盖 ${completeMonthsBySource[source].length}/${requiredMonthIdsBySource[source].length} 个要求月份；不完整月份已整体跳过，避免人员间口径不一致（${skippedMonths.join('；')}）。`]
      : []
  })
  if (!unpublishedComplete) {
    const missingEmployees = employeeNames.filter((employeeName) => !sourcesByEmployee[employeeName]?.unpublished)
    sourceWarnings.push('待发布快照不完整（' + (missingEmployees.join('、') || '未知人员') + '）；该来源未按零业绩处理。')
  }
  const opportunities = new Map<string, TargetSplitOpportunity>()
  const metricTargetKeys: TargetSplitGoalKey[] = [
    ...financialGoalKeys,
    ...(includeOutsourcingOrderCountTarget ? ['outsourcingOrderCountTarget' as const] : []),
  ]
  const createMetricAmounts = (): Record<TargetSplitSourceKey, Record<TargetSplitGoalKey, number>> => ({
    publish: Object.fromEntries(metricTargetKeys.map((key) => [key, 0])) as Record<TargetSplitGoalKey, number>,
    deal: Object.fromEntries(metricTargetKeys.map((key) => [key, 0])) as Record<TargetSplitGoalKey, number>,
    unpublished: Object.fromEntries(metricTargetKeys.map((key) => [key, 0])) as Record<TargetSplitGoalKey, number>,
  })
  const createPeriodMetricAmounts = (): TargetSplitOpportunity['periodMetricAmounts'] => ({ publish: {}, deal: {}, unpublished: {} })
  const createPeriodOutsourcingCounts = (): TargetSplitOpportunity['periodOutsourcingCounts'] => ({ publish: {}, deal: {}, unpublished: {} })
  const getOpportunity = (employeeName: string, companyName: string, platformId: number, projectBrand: string) => {
    const normalizedCompanyName = companyName.trim()
    const normalizedBrandName = platformId === 0 ? '' : projectBrand.trim()
    if (!TARGET_SPLIT_PLATFORMS.some((platform) => platform.id === platformId)) return null
    const key = JSON.stringify([employeeName, normalizedCompanyName, platformId, normalizedBrandName])
    let opportunity = opportunities.get(key)
    if (!opportunity) {
      opportunity = {
        customerFacingPerson: employeeName,
        companyName: normalizedCompanyName,
        platformId,
        projectBrand: normalizedBrandName,
        publishAmount: 0,
        dealAmount: 0,
        unpublishedAmount: 0,
        metricAmounts: createMetricAmounts(),
        outsourcingCounts: { publish: 0, deal: 0, unpublished: 0 },
        periodMetricAmounts: createPeriodMetricAmounts(),
        periodOutsourcingCounts: createPeriodOutsourcingCounts(),
      }
      opportunities.set(key, opportunity)
    }
    return opportunity
  }
  const opportunityMatchesFinancialGoal = (opportunity: TargetSplitOpportunity, goalKey: TargetSplitFinancialGoalKey) => {
    if (goalKey === 'outsourcingPerformanceTarget' && opportunity.platformId === 0) {
      return (['publish', 'deal', 'unpublished'] as const).some((source) =>
        opportunity.metricAmounts[source].outsourcingPerformanceTarget !== 0,
      )
    }
    return (TARGET_SPLIT_PLATFORM_TARGETS[opportunity.platformId] ?? []).includes(goalKey)
  }

  for (const employeeName of employeeNames) {
    for (const source of ['publish', 'deal'] as const) {
      const snapshots = sourcesByEmployee[employeeName]?.[source] ?? []
      snapshots.forEach((snapshot, monthIndex) => {
        if (!snapshot) return
        const periodKey = String(historyMonthIds[monthIndex])
        for (const actual of snapshot.actuals) {
          const opportunity = getOpportunity(employeeName, actual.companyName, actual.platformId, actual.brandName)
          if (!opportunity) continue
          const periodMetrics = opportunity.periodMetricAmounts[source][periodKey] ?? {}
          opportunity.periodMetricAmounts[source][periodKey] = periodMetrics
          const amountTargetKeys = (TARGET_SPLIT_PLATFORM_TARGETS[actual.platformId] ?? [])
            .filter((goalKey) => financialGoalKeys.includes(goalKey))
          const amount = amountTargetKeys.reduce((sum, goalKey) => {
            const metricAmount = getTargetSplitMetricAmount(actual, goalKey)
            opportunity!.metricAmounts[source][goalKey] += metricAmount
            periodMetrics[goalKey] = (periodMetrics[goalKey] ?? 0) + metricAmount
            return sum + metricAmount
          }, 0)
          if (source === 'publish') opportunity.publishAmount += amount
          else opportunity.dealAmount += amount
          const outsourcingCount = source === 'deal'
            ? Number(actual.metrics.outsourcing?.orderCount ?? 0)
            : 0
          if (outsourcingCount > 0) {
            const outsourcingOpportunity = getOpportunity(employeeName, actual.companyName, 0, '')
            if (outsourcingOpportunity) {
              outsourcingOpportunity.outsourcingCounts[source] += outsourcingCount
              outsourcingOpportunity.periodOutsourcingCounts[source][periodKey] =
                (outsourcingOpportunity.periodOutsourcingCounts[source][periodKey] ?? 0) + outsourcingCount
            }
          }
        }
      })
    }
  }

  const unpublishedGoalByMetric: Partial<Record<DashboardUnpublishedMetricKey, TargetSplitFinancialGoalKey>> = {
    halfPastTen: 'halfPastTenTarget',
    selfIncubated: 'selfIncubatedTarget',
    signingXiaohongshu: 'signingXiaohongshuTarget',
    signingDouyin: 'signingDouyinTarget',
    signingShipinhao: 'signingShipinhaoTarget',
  }
  for (const employeeName of employeeNames) {
    for (const order of sourcesByEmployee[employeeName]?.unpublished ?? []) {
      const platformId = Number(order.platformId ?? (order.orderType === 3 ? 0 : -1))
      const opportunity = getOpportunity(employeeName, order.customerName, platformId, order.brandName)
      if (!opportunity) continue
      const periodMetrics = opportunity.periodMetricAmounts.unpublished.current ?? {}
      opportunity.periodMetricAmounts.unpublished.current = periodMetrics
      const goalKey = order.metricKey ? unpublishedGoalByMetric[order.metricKey] : undefined
      if (goalKey && (TARGET_SPLIT_PLATFORM_TARGETS[platformId] ?? []).includes(goalKey)) {
        const amount = goalKey === 'halfPastTenTarget' || goalKey === 'selfIncubatedTarget'
          ? Number(order.orderMoney ?? 0)
          : Number(order.incomeMoney ?? 0)
        opportunity.metricAmounts.unpublished[goalKey] += amount
        periodMetrics[goalKey] = (periodMetrics[goalKey] ?? 0) + amount
        opportunity.unpublishedAmount += amount
      } else if (Number(order.orderType ?? 0) === 3 || order.metricKey === 'outsourcing') {
        if (financialGoalKeys.includes('outsourcingPerformanceTarget')) {
          const amount = Number(order.incomeMoney ?? 0)
          opportunity.metricAmounts.unpublished.outsourcingPerformanceTarget += amount
          periodMetrics.outsourcingPerformanceTarget = (periodMetrics.outsourcingPerformanceTarget ?? 0) + amount
          opportunity.unpublishedAmount += amount
        }
        const outsourcingOpportunity = getOpportunity(employeeName, order.customerName, 0, '')
        if (outsourcingOpportunity) {
          outsourcingOpportunity.outsourcingCounts.unpublished += 1
          outsourcingOpportunity.periodOutsourcingCounts.unpublished.current =
            (outsourcingOpportunity.periodOutsourcingCounts.unpublished.current ?? 0) + 1
        }
      }
    }
  }

  const snapshotOpportunityRows = [...opportunities.values()]
  const isPersonalAllocation = employeeNames.length === 1 && employeeNames[0] !== '示例开发01'
  const isWangYueAllocation = employeeNames.length === 1 && employeeNames[0] === '示例对客16'
  const isMuyuanNovemberTeamAllocation = targetMonthId === 150
    && employeeNames.length === TARGET_MANAGEMENT_BOARD_EMPLOYEES.length
    && TARGET_MANAGEMENT_BOARD_EMPLOYEES.every((employeeName) => employeeNames.includes(employeeName))
  const configuredOpportunityRows = configuredRows?.flatMap((row) => {
    const employeeName = row.customerFacingPerson.trim() || employeeNames[0] || ''
    if (!employeeName || !row.companyName.trim() || row.platformId === null) return []
    const opportunity = getOpportunity(employeeName, row.companyName, row.platformId, row.projectBrand)
    return opportunity ? [{ ...opportunity, configuredRowId: row.id }] : []
  })
  const opportunityRows = configuredRows === undefined ? snapshotOpportunityRows : configuredOpportunityRows ?? []
  const financialOpportunityRows = opportunityRows.filter((row) => row.platformId !== 0)
  const outsourcingOpportunityRows = opportunityRows.filter((row) =>
    row.platformId === 0
    && (row.outsourcingCounts.deal > 0 || row.outsourcingCounts.unpublished > 0)
    && !(isWangYueAllocation && isWangYueOutsourcingExcludedCompany(row.companyName)))
  const getOpportunityPotentialScore = (row: TargetSplitOpportunity) => Math.max(0,
    (allocationParameters.sourceWeights.publish || 0) * row.publishAmount
    + (allocationParameters.sourceWeights.deal || 0) * row.dealAmount
    + (allocationParameters.sourceWeights.unpublished || 0) * row.unpublishedAmount,
  )
  const totalPotentialScore = financialOpportunityRows.reduce((sum, row) => sum + getOpportunityPotentialScore(row), 0)
  const highPotentialFinancialRows = isPersonalAllocation && configuredRows === undefined && totalPotentialScore > 0
    ? financialOpportunityRows.filter((row) =>
      row.dealAmount > 0
      && getOpportunityPotentialScore(row) >= totalPotentialScore * 0.01,
    )
    : financialOpportunityRows
  const allocationOpportunityRows = configuredRows === undefined
    ? [...highPotentialFinancialRows, ...outsourcingOpportunityRows]
    : [...financialOpportunityRows, ...outsourcingOpportunityRows]
  const rationaleOpportunityRows = configuredRows === undefined
    ? allocationOpportunityRows
    : configuredOpportunityRows ?? []
  const getOpportunitySourceAmount = (row: TargetSplitOpportunity, source: TargetSplitSourceKey) =>
    source === 'publish' ? row.publishAmount : source === 'deal' ? row.dealAmount : row.unpublishedAmount
  const getSourceTotal = (employeeName: string, source: TargetSplitSourceKey) => allocationOpportunityRows
    .filter((row) => row.customerFacingPerson === employeeName)
    .reduce((sum, row) => sum + Math.max(0, getOpportunitySourceAmount(row, source)), 0)
  const personMetrics = employeeNames.map((employeeName) => ({
    employeeName,
    publishAmount: getSourceTotal(employeeName, 'publish'),
    dealAmount: getSourceTotal(employeeName, 'deal'),
    unpublishedAmount: getSourceTotal(employeeName, 'unpublished'),
    unpublishedCount: (sourcesByEmployee[employeeName]?.unpublished ?? []).length,
    opportunities: allocationOpportunityRows.filter((row) => row.customerFacingPerson === employeeName),
  }))
  const parsedTotalWan = Number(totalTarget.replace(/,/g, '').trim())
  const totalUnits = Number.isFinite(parsedTotalWan) && parsedTotalWan > 0 ? Math.round(parsedTotalWan * 100) : 0
  const customerTargets: Record<string, string> = {}
  const customerGoalTargets: Record<string, Partial<Record<TargetSplitGoalKey, string>>> = {}
  const customerRationales: Record<string, string> = {}
  const companyRationales: Record<string, string> = Object.fromEntries([...new Set(
    rationaleOpportunityRows.map((row) => row.companyName.trim() || '未填写公司'),
  )].map((companyName) => {
    const companyRows = rationaleOpportunityRows.filter((row) =>
      (row.companyName.trim() || '未填写公司') === companyName)
    const lastMonthDealAmount = companyRows.reduce((sum, row) => sum + row.dealAmount, 0)
    const unpublishedAmount = companyRows.reduce((sum, row) => sum + row.unpublishedAmount, 0)
    const lastMonthOutsourcingCount = companyRows.reduce((sum, row) => sum + row.outsourcingCounts.deal, 0)
    const unpublishedOutsourcingCount = companyRows.reduce((sum, row) => sum + row.outsourcingCounts.unpublished, 0)
    const rationale = lastMonthDealAmount > 0 || unpublishedAmount > 0 || lastMonthOutsourcingCount > 0 || unpublishedOutsourcingCount > 0
      ? `上月成单业绩 ${formatTargetSplitWan(lastMonthDealAmount / 10000)}；待发布订单业绩 ${formatTargetSplitWan(unpublishedAmount / 10000)}；上月外采成单 ${lastMonthOutsourcingCount} 单；待发布外采订单 ${unpublishedOutsourcingCount} 单。`
      : '暂无上月成单和待发布订单业绩记录。'
    return [companyName, rationale]
  }))
  const customerGoalUnits = new Map<string, Partial<Record<TargetSplitGoalKey, number>>>()
  const opportunityTargets = new Map<TargetSplitOpportunity, Partial<Record<TargetSplitGoalKey, string>>>()
  const rows: TargetSplitRow[] = []
  const timestampCandidates = employeeNames.flatMap((employeeName) => {
    const sources = sourcesByEmployee[employeeName]
    return [
      ...(sources?.publish ?? []).flatMap((snapshot) => snapshot?.snapshotUpdatedAt ?? []),
      ...(sources?.deal ?? []).flatMap((snapshot) => snapshot?.snapshotUpdatedAt ?? []),
      sources?.unpublishedUpdatedAt,
    ]
      .filter((value): value is string => Boolean(value))
  })
  const sourceUpdatedAt = timestampCandidates.sort()[0] ?? ''

  const getOpportunityGoalAmount = (
    opportunity: TargetSplitOpportunity,
    source: TargetSplitSourceKey,
    goalKey: TargetSplitGoalKey,
    period?: TargetSplitHistoryPeriod,
  ) => {
    if (period !== undefined) {
      const periodKey = String(period)
      return goalKey === 'outsourcingOrderCountTarget'
        ? opportunity.periodOutsourcingCounts[source][periodKey] ?? 0
        : opportunity.periodMetricAmounts[source][periodKey]?.[goalKey] ?? 0
    }
    return goalKey === 'outsourcingOrderCountTarget'
      ? opportunity.outsourcingCounts[source]
      : opportunity.metricAmounts[source][goalKey]
  }
  const getCustomerGoalAmount = (
    person: typeof personMetrics[number],
    source: TargetSplitSourceKey,
    goalKey: TargetSplitGoalKey,
    period?: TargetSplitHistoryPeriod,
  ) => person.opportunities.reduce((sum, opportunity) => sum + getOpportunityGoalAmount(opportunity, source, goalKey, period), 0)
  const getCustomerOverallRevenueAmount = (
    person: typeof personMetrics[number],
    source: TargetSplitSourceKey,
    period: TargetSplitHistoryPeriod,
  ) => person.opportunities.reduce((sum, opportunity) => sum + financialGoalKeys.reduce(
    (metricSum, goalKey) => metricSum + getOpportunityGoalAmount(opportunity, source, goalKey, period),
    0,
  ), 0)
  const getCustomerOverallPerformanceAmount = (
    person: typeof personMetrics[number],
    source: TargetSplitSourceKey,
    period: TargetSplitHistoryPeriod,
  ) => personMetrics.reduce((sum, candidate) => sum + getCustomerOverallRevenueAmount(candidate, source, period), 0) > 0
    ? getCustomerOverallRevenueAmount(person, source, period)
    : getCustomerGoalAmount(person, source, 'outsourcingOrderCountTarget', period)
  const personSharesByGoal = new Map<TargetSplitGoalKey, number[]>()
  const personShareBreakdownsByGoal = new Map<TargetSplitGoalKey, TargetSplitShareBreakdown>()
  const eligibleEmployeeNamesByGoal = new Map<TargetSplitGoalKey, Set<string>>()
  const customerAllocationNotes = new Map<string, Array<{
    goalKey: TargetSplitGoalKey
    units: number
    reason: 'no-matching-opportunity' | 'equal-fallback' | 'equal-person-fallback' | 'below-minimum-detail'
    opportunityCount?: number
  }>>()
  const goalLabels: Record<TargetSplitGoalKey, string> = {
    halfPastTenTarget: '十点半',
    selfIncubatedTarget: '自孵',
    signingXiaohongshuTarget: '签约小红书',
    signingDouyinTarget: '签约抖音',
    signingShipinhaoTarget: '签约视频号',
    outsourcingPerformanceTarget: '外采业绩',
    outsourcingOrderCountTarget: '外采单数',
  }
  for (const goalKey of metricTargetKeys) {
    const getAmount = (person: typeof personMetrics[number], source: TargetSplitSourceKey, period: TargetSplitHistoryPeriod) =>
      getCustomerGoalAmount(person, source, goalKey, period)
    const getFallbackAmount = (person: typeof personMetrics[number], source: TargetSplitSourceKey, period: TargetSplitHistoryPeriod) =>
      getCustomerOverallPerformanceAmount(person, source, period)
    const eligiblePeople = isMuyuanNovemberTeamAllocation && goalKey === 'signingShipinhaoTarget'
      ? personMetrics
      : goalKey === 'outsourcingOrderCountTarget'
      ? isPersonalAllocation
        ? personMetrics.filter((person) => person.opportunities.some((opportunity) =>
          opportunity.platformId === 0
          && (opportunity.outsourcingCounts.deal > 0 || opportunity.outsourcingCounts.unpublished > 0)))
        : personMetrics
      : personMetrics.filter((person) => person.opportunities.some((opportunity) =>
        opportunityMatchesFinancialGoal(opportunity, goalKey as TargetSplitFinancialGoalKey)))
    eligibleEmployeeNamesByGoal.set(goalKey, new Set(eligiblePeople.map((person) => person.employeeName)))
    const eligibleBreakdown = eligiblePeople.length > 0 ? getTargetSplitOpportunityShareBreakdown(
      eligiblePeople,
      getAmount,
      enabledSources,
      periodsBySource,
      0.2,
      getFallbackAmount,
      allocationParameters.sourceWeights,
    ) : null
    const usesEqualPersonFallback = eligiblePeople.length > 0 && !eligibleBreakdown?.shares.length
    if (eligiblePeople.length === 0 && Number(goalTargets[goalKey] ?? 0) > 0) {
      sourceWarnings.push(configuredCustomerTargets
        ? `${goalLabels[goalKey]}固定目标没有任何对客人具备可匹配的平台公司/品牌组合；金额保持在固定类别目标中，并暂留在“未细分目标”，补齐匹配明细后再生成。`
        : `${goalLabels[goalKey]}固定目标没有任何对客人具备可匹配的平台公司/品牌组合；为避免错分到其他平台，该类别未分配，补齐匹配明细后再生成。`)
    }
    if (usesEqualPersonFallback && Number(goalTargets[goalKey] ?? 0) > 0) {
      eligiblePeople.forEach((person) => {
        const notes = customerAllocationNotes.get(person.employeeName) ?? []
        notes.push({ goalKey, units: 0, reason: 'equal-person-fallback', opportunityCount: eligiblePeople.length })
        customerAllocationNotes.set(person.employeeName, notes)
      })
    }
    const eligibleShares = usesEqualPersonFallback
      ? eligiblePeople.map(() => 1 / eligiblePeople.length)
      : eligibleBreakdown?.shares ?? []
    const performanceShares = eligibleBreakdown?.performanceShares.length ? eligibleBreakdown.performanceShares : eligibleShares
    const financialBaseShares = eligibleBreakdown?.shares.length ? eligibleBreakdown.shares : eligibleShares
    let normalizedPriorityShares: number[]
    if (goalKey === 'outsourcingOrderCountTarget') {
      const tierWeights = eligiblePeople.map((person) => {
        const weight = allocationParameters.outsourcingOrderCountMultipliers[person.employeeName]
        return Number.isFinite(weight) && weight > 0 ? weight : 0
      })
      const tieredShares = getTargetSplitTieredShares(performanceShares, tierWeights)
      normalizedPriorityShares = tieredShares.length > 0
        ? tieredShares
        : eligiblePeople.map(() => 1 / Math.max(1, eligiblePeople.length))
    } else {
      const priorityWeightedShares = financialBaseShares.map((share, index) => {
        const employeeName = eligiblePeople[index]?.employeeName ?? ''
        const preferenceWeight = allocationParameters.personMultipliers[employeeName] ?? 1
        return share * preferenceWeight
      })
      const priorityWeightTotal = priorityWeightedShares.reduce((sum, share) => sum + share, 0)
      normalizedPriorityShares = priorityWeightTotal > 0
        ? priorityWeightedShares.map((share) => share / priorityWeightTotal)
        : eligiblePeople.map(() => 1 / Math.max(1, eligiblePeople.length))
    }
    const alignEligibleValues = (values: number[]) => personMetrics.map((person) => {
      const eligibleIndex = eligiblePeople.findIndex((candidate) => candidate.employeeName === person.employeeName)
      return eligibleIndex >= 0 ? values[eligibleIndex] ?? 0 : 0
    })
    const shareBreakdown: TargetSplitShareBreakdown = {
      shares: alignEligibleValues(normalizedPriorityShares),
      performanceShares: alignEligibleValues(performanceShares),
      sourceContributions: {
        publish: alignEligibleValues(eligibleBreakdown?.sourceContributions.publish ?? []),
        deal: alignEligibleValues(eligibleBreakdown?.sourceContributions.deal ?? []),
        unpublished: alignEligibleValues(eligibleBreakdown?.sourceContributions.unpublished ?? []),
      },
      activeSources: eligibleBreakdown?.activeSources ?? [],
      usesFallback: eligibleBreakdown?.usesFallback ?? usesEqualPersonFallback,
    }
    personSharesByGoal.set(goalKey, shareBreakdown.shares)
    personShareBreakdownsByGoal.set(goalKey, shareBreakdown)
  }

  const effectiveCustomerGoalTargets = configuredCustomerTargets
    ? balanceTargetSplitCustomerGoals(
      employeeNames,
      financialGoalKeys,
      metricTargetKeys,
      goalTargets,
      configuredCustomerTargets,
      personSharesByGoal,
      isMuyuanNovemberTeamAllocation ? 'signingShipinhaoTarget' : undefined,
    )
    : configuredCustomerGoalTargets

  for (const goalKey of metricTargetKeys) {
    const requestedValue = Math.max(0, Number(goalTargets[goalKey] ?? 0))
    const targetUnits = goalKey === 'outsourcingOrderCountTarget'
      ? Math.round(requestedValue)
      : Math.round(requestedValue * 100)
    const personShares = personSharesByGoal.get(goalKey) ?? []
    const personUnits = effectiveCustomerGoalTargets
      ? personMetrics.map((person) => {
        const value = Number(effectiveCustomerGoalTargets[person.employeeName]?.[goalKey] ?? 0)
        return goalKey === 'outsourcingOrderCountTarget' ? Math.round(value) : Math.round(value * 100)
      })
      : personShares.length > 0 ? distributeTargetUnits(targetUnits, personShares) : []
    personMetrics.forEach((person, personIndex) => {
      const assignedUnits = personUnits[personIndex] ?? 0
      const customerTargetsForPerson = customerGoalUnits.get(person.employeeName) ?? {}
      customerTargetsForPerson[goalKey] = assignedUnits
      customerGoalUnits.set(person.employeeName, customerTargetsForPerson)
      if (assignedUnits <= 0) return
      const matchingOpportunities = person.opportunities.filter((opportunity) => goalKey === 'outsourcingOrderCountTarget'
        ? opportunity.platformId === 0
        : opportunityMatchesFinancialGoal(opportunity, goalKey as TargetSplitFinancialGoalKey))
      if (matchingOpportunities.length === 0) {
        const notes = customerAllocationNotes.get(person.employeeName) ?? []
        notes.push({ goalKey, units: assignedUnits, reason: 'no-matching-opportunity' })
        customerAllocationNotes.set(person.employeeName, notes)
        return
      }
      const rowShares = getTargetSplitOpportunityShares(
        matchingOpportunities,
        (opportunity, source, period) => getOpportunityGoalAmount(opportunity, source, goalKey, period),
        enabledSources,
        periodsBySource,
        0.15,
        (opportunity, source, period) => {
          const periodRevenueTotal = matchingOpportunities.reduce((sum, candidate) => sum + financialGoalKeys.reduce(
            (metricSum, financialGoalKey) => metricSum + getOpportunityGoalAmount(candidate, source, financialGoalKey, period),
            0,
          ), 0)
          return periodRevenueTotal > 0
            ? financialGoalKeys.reduce(
              (sum, financialGoalKey) => sum + getOpportunityGoalAmount(opportunity, source, financialGoalKey, period),
              0,
            )
            : getOpportunityGoalAmount(opportunity, source, 'outsourcingOrderCountTarget', period)
        },
        allocationParameters.sourceWeights,
      )
      const normalizedRowShares = rowShares.length > 0
        ? rowShares
        : matchingOpportunities.map(() => 1 / matchingOpportunities.length)
      if (rowShares.length === 0) {
        const notes = customerAllocationNotes.get(person.employeeName) ?? []
        notes.push({
          goalKey,
          units: assignedUnits,
          reason: 'equal-fallback',
          opportunityCount: matchingOpportunities.length,
        })
        customerAllocationNotes.set(person.employeeName, notes)
      }
      const rowUnits = distributeTargetUnits(assignedUnits, normalizedRowShares)
      matchingOpportunities.forEach((opportunity, rowIndex) => {
        const assignedRowUnits = rowUnits[rowIndex] ?? 0
        if (assignedRowUnits <= 0) return
        const targetsForOpportunity = opportunityTargets.get(opportunity) ?? {}
        targetsForOpportunity[goalKey] = goalKey === 'outsourcingOrderCountTarget'
          ? String(assignedRowUnits)
          : (assignedRowUnits / 100).toFixed(2)
        opportunityTargets.set(opportunity, targetsForOpportunity)
      })
    })
  }

  if (isPersonalAllocation && targetMonthId === 150) {
    const minimumDetailUnits = Math.round(TARGET_SPLIT_MIN_PERSONAL_NOVEMBER_DETAIL_TARGET_WAN * 100)
    personMetrics.forEach((person) => {
      let belowMinimumUnits = 0
      let belowMinimumCount = 0
      person.opportunities.forEach((opportunity) => {
        const targets = opportunityTargets.get(opportunity)
        if (!targets) return
        const detailUnits = financialGoalKeys.reduce(
          (sum, goalKey) => sum + Math.round((Number(targets[goalKey]) || 0) * 100),
          0,
        )
        if (detailUnits <= 0 || detailUnits >= minimumDetailUnits) return
        financialGoalKeys.forEach((goalKey) => delete targets[goalKey])
        opportunityTargets.set(opportunity, targets)
        belowMinimumUnits += detailUnits
        belowMinimumCount += 1
      })
      if (belowMinimumUnits > 0) {
        const notes = customerAllocationNotes.get(person.employeeName) ?? []
        notes.push({
          goalKey: 'halfPastTenTarget',
          units: belowMinimumUnits,
          reason: 'below-minimum-detail',
          opportunityCount: belowMinimumCount,
        })
        customerAllocationNotes.set(person.employeeName, notes)
      }
    })
  }

  const formatGoalValue = (goalKey: TargetSplitGoalKey, units: number) => goalKey === 'outsourcingOrderCountTarget'
    ? `${units}单`
    : formatTargetSplitWan(units / 100)
  const publishMonthLabels = requiredMonthIdsBySource.publish.map((monthId) =>
    DASHBOARD_FANGPIAN_PERIODS[monthId as keyof typeof DASHBOARD_FANGPIAN_PERIODS]?.label ?? `方片月${monthId}`,
  )
  const isSingleOwnerPlan = employeeNames.length === 1

  personMetrics.forEach((person, personIndex) => {
    const goalUnits = customerGoalUnits.get(person.employeeName) ?? {}
    const financialUnits = financialGoalKeys.reduce((sum, key) => sum + (goalUnits[key] ?? 0), 0)
    const configuredCustomerTarget = configuredCustomerTargets?.[person.employeeName]
    customerTargets[person.employeeName] = configuredCustomerTarget === undefined
      ? (financialUnits / 100).toFixed(2)
      : (Math.round((Number(configuredCustomerTarget) || 0) * 100) / 100).toFixed(2)
    customerGoalTargets[person.employeeName] = Object.fromEntries(metricTargetKeys.map((key) => [
      key,
      key === 'outsourcingOrderCountTarget' ? String(goalUnits[key] ?? 0) : ((goalUnits[key] ?? 0) / 100).toFixed(2),
    ]))
    if (configuredRows !== undefined) {
      configuredRows.forEach((configuredRow) => {
        const opportunity = configuredOpportunityRows?.find((candidate) => candidate.configuredRowId === configuredRow.id)
        const targets = opportunity ? { ...(opportunityTargets.get(opportunity) ?? {}) } : {}
        if (isPersonalAllocation && targetMonthId === 150
          && !Object.values(targets).some((value) => Number(value) > 0)) return
        rows.push({
          ...configuredRow,
          customerFacingPerson: configuredRow.customerFacingPerson.trim() || person.employeeName,
          targets,
        })
      })
    } else {
      person.opportunities.forEach((opportunity, rowIndex) => {
        const targets = opportunityTargets.get(opportunity)
        if (!targets || !Object.values(targets).some((value) => Number(value) > 0)) return
        rows.push({
          id: `generated-${targetMonthId}-${person.employeeName}-${rowIndex}`,
          customerFacingPerson: person.employeeName,
          companyName: opportunity.companyName,
          platformId: opportunity.platformId,
          projectBrand: opportunity.projectBrand,
          targets,
        })
      })
    }
    const novemberCustomerRationaleGoalKeys = new Set<TargetSplitGoalKey>([
      'halfPastTenTarget',
      'selfIncubatedTarget',
      'signingXiaohongshuTarget',
      'signingDouyinTarget',
      'signingShipinhaoTarget',
      'outsourcingPerformanceTarget',
    ])
    const rationaleLines = metricTargetKeys.flatMap((goalKey) => {
      if (isMuyuanNovemberTeamAllocation && !novemberCustomerRationaleGoalKeys.has(goalKey)) return []
      const assignedUnits = goalUnits[goalKey] ?? 0
      const teamGoalValue = Math.max(0, Number(goalTargets[goalKey] ?? 0))
      const teamGoalUnits = goalKey === 'outsourcingOrderCountTarget'
        ? Math.round(teamGoalValue)
        : Math.round(teamGoalValue * 100)
      if (teamGoalUnits <= 0) return []
      const eligibleEmployeeNames = eligibleEmployeeNamesByGoal.get(goalKey) ?? new Set<string>()
      if (!eligibleEmployeeNames.has(person.employeeName)) {
        if (configuredCustomerTargets && assignedUnits > 0) return []
        return [`${goalLabels[goalKey]}目标：本人没有该平台对应的公司/品牌组合，因此不分配此类别目标。`]
      }
      if (assignedUnits <= 0) return []
      const publishAmount = getCustomerGoalAmount(person, 'publish', goalKey)
      const dealAmount = getCustomerGoalAmount(person, 'deal', goalKey)
      const unpublishedAmount = getCustomerGoalAmount(person, 'unpublished', goalKey)
      const shareBreakdown = personShareBreakdownsByGoal.get(goalKey)
      const historyShare = shareBreakdown?.performanceShares[personIndex] ?? 0
      const allocationShare = (assignedUnits / teamGoalUnits) * 100
      const unpublishedActualText = enabledSources.unpublished
        ? goalKey === 'outsourcingOrderCountTarget'
          ? '待发布' + Math.round(unpublishedAmount) + '单'
          : '待发布' + formatTargetSplitWan(unpublishedAmount / 10000)
        : '待发布快照不可用'
      const actualText = goalKey === 'outsourcingOrderCountTarget'
        ? '发布' + Math.round(publishAmount) + '单、成单' + Math.round(dealAmount) + '单、' + unpublishedActualText
        : '发布' + formatTargetSplitWan(publishAmount / 10000) + '、成单' + formatTargetSplitWan(dealAmount / 10000) + '、' + unpublishedActualText
      const formatSourceContribution = (source: TargetSplitSourceKey) => {
        const sourceLabel = source === 'publish' ? '发布' : source === 'deal' ? '成单' : '待发布'
        const contribution = (shareBreakdown?.sourceContributions[source][personIndex] ?? 0) * 100
        if (!enabledSources[source]) return `${sourceLabel}快照不可用`
        if (!shareBreakdown?.activeSources.includes(source)) {
          return isSingleOwnerPlan ? `${sourceLabel}该类别本人无记录` : `${sourceLabel}该类别团队无记录`
        }
        return `${sourceLabel}贡献${contribution.toFixed(1)}个百分点`
      }
      const weightedEvidence = (['publish', 'deal', 'unpublished'] as const)
        .map(formatSourceContribution)
        .join('、')
      const overallEvidence = `整体实绩：发布${formatTargetSplitWan(person.publishAmount / 10000)}、成单${formatTargetSplitWan(person.dealAmount / 10000)}、待发布${formatTargetSplitWan(person.unpublishedAmount / 10000)}`
      const isOutsourcingGoal = goalKey === 'outsourcingOrderCountTarget'
      const personPreferenceWeight = allocationParameters.personMultipliers[person.employeeName] ?? 1
      const outsourcingPreferenceWeight = allocationParameters.outsourcingOrderCountMultipliers[person.employeeName] ?? 1
      const preferenceEvidence = isOutsourcingGoal
        ? `本人适用${outsourcingPreferenceWeight.toFixed(2)}倍外采单数档位权重`
        : `本人适用${personPreferenceWeight.toFixed(2)}倍示例公司有限公司系数`
      const tierEvidence = '外采单数先按外采单数档位权重排序（示例对客19、示例对客16 > 示例对客14、示例对客13 > 示例对客17、示例对客18、示例对客15 > 示例对客20），档内再按同类单数业绩做±5%微调；'
      const historyEvidence = goalKey === 'outsourcingOrderCountTarget'
        ? `${sourcePeriodsOverride ? '本人上月发布、上月成单及近三个月未发布外采单数' : isPersonalAllocation ? '本人上月成单及当前待发布外采单数' : '本人近三个月外采单数'}：${actualText}；${weightedEvidence}，档内业绩参考份额${(historyShare * 100).toFixed(1)}%`
        : shareBreakdown?.usesFallback
          ? `该类别缺少团队同类实绩，改用示例公司有限公司整体业绩作参考（${overallEvidence}）；${weightedEvidence}，业绩参考份额${(historyShare * 100).toFixed(1)}%`
          : `本人同类实绩：${actualText}；${weightedEvidence}，业绩参考份额${(historyShare * 100).toFixed(1)}%`
      const reasonText = isSingleOwnerPlan
        ? `${goalKey === 'outsourcingOrderCountTarget'
          ? `${sourcePeriodsOverride ? '上月发布、上月成单及近三个月未发布外采单数' : isPersonalAllocation ? '上月成单及当前待发布外采单数' : '近三个月外采单数'}：${actualText}；${weightedEvidence}`
          : shareBreakdown?.usesFallback
            ? `该类别缺少同类实绩，改用整体业绩作参考（${overallEvidence}）；${weightedEvidence}`
            : `同类实绩：${actualText}；${weightedEvidence}`}，在本人名下同平台公司/品牌之间分配，不设均分上限`
        : `${isOutsourcingGoal ? tierEvidence : ''}${historyEvidence}，${preferenceEvidence}，${isOutsourcingGoal ? '不设均分上限以保证档位顺序' : '金额不按档位排序'}，本人占该类目标${allocationShare.toFixed(1)}%`
      const visibleReasonText = isMuyuanNovemberTeamAllocation
        ? `本人同类实绩：${actualText}`
        : reasonText
      const ending = isMuyuanNovemberTeamAllocation ? '；' : '。'
      return [`${goalLabels[goalKey]}目标 ${formatGoalValue(goalKey, assignedUnits)}：${visibleReasonText}${ending}`]
    })
    const unpublishedCoverageLabel = sourcePeriodsOverride ? '近三个月未发布订单' : '当前待发布快照'
    const sourceCoverage = isSingleOwnerPlan
      ? `依据${person.employeeName}本人${publishMonthLabels.join('、')}发布快照（${(allocationParameters.sourceWeights.publish * 100).toFixed(1)}%）、上月成单快照（${(allocationParameters.sourceWeights.deal * 100).toFixed(1)}%）及${unpublishedCoverageLabel}（${(allocationParameters.sourceWeights.unpublished * 100).toFixed(1)}%）；发布覆盖${periodsBySource.publish.length}/${requiredMonthIdsBySource.publish.length}个月、上月成单覆盖${periodsBySource.deal.length}/${requiredMonthIdsBySource.deal.length}个月，缺失月份不计入。`
      : `依据${publishMonthLabels.join('、')}发布快照（${(allocationParameters.sourceWeights.publish * 100).toFixed(1)}%）、上月成单快照（${(allocationParameters.sourceWeights.deal * 100).toFixed(1)}%）及${unpublishedCoverageLabel}（${(allocationParameters.sourceWeights.unpublished * 100).toFixed(1)}%）；发布覆盖${periodsBySource.publish.length}/${requiredMonthIdsBySource.publish.length}个月、上月成单覆盖${periodsBySource.deal.length}/${requiredMonthIdsBySource.deal.length}个月，缺失月份不计入。`
    const allocationNoteLines = (customerAllocationNotes.get(person.employeeName) ?? []).map((note) => {
      const label = goalLabels[note.goalKey]
      if (note.reason === 'below-minimum-detail') {
        return `${note.opportunityCount}条公司/平台/项目金额明细合计低于 0.50 万（¥5,000），已从拆分表删除；合计 ${formatTargetSplitWan(note.units / 100)} 暂留在“未细分目标”。外采单数不受此门槛影响。`
      }
      if (note.reason === 'equal-person-fallback') {
        return `${label}目标：有${note.opportunityCount}位对客人具备可匹配的同平台公司/品牌组合，但缺少可区分的实绩；按这些人员均分为基准，并应用${note.goalKey === 'outsourcingOrderCountTarget' ? '外采单数档位权重' : '示例公司有限公司系数'}后分配。`
      }
      if (note.reason === 'equal-fallback') {
        return `${label}目标${formatGoalValue(note.goalKey, note.units)}：有${note.opportunityCount}组可匹配的公司/平台/品牌，但没有可区分的同类历史业绩，已在这些同平台组合中均分。`
      }
      return `${label}目标${formatGoalValue(note.goalKey, note.units)}未细分：${sourcePeriodsOverride ? '上月发布、上月成单及近三个月未发布' : '近三个月发布、成单及待发布'}记录中，没有该对客人可匹配的${label}公司/平台/品牌组合。为避免错分到其他平台，金额暂留在“未细分目标”；补齐该类别的有效明细后再录入对应目标行。`
    })
    customerRationales[person.employeeName] = isMuyuanNovemberTeamAllocation
      ? rationaleLines.join('\n')
      : [sourceCoverage, ...rationaleLines, ...allocationNoteLines].join('\n')
  })

  return {
    baselineMonthId,
    hasHistoricalPerformance: employeeNames.some((employeeName) => snapshotOpportunityRows.some((opportunity) =>
      opportunity.customerFacingPerson === employeeName
      && (opportunity.publishAmount + opportunity.dealAmount + opportunity.unpublishedAmount > 0
        || opportunity.outsourcingCounts.publish + opportunity.outsourcingCounts.deal + opportunity.outsourcingCounts.unpublished > 0))),
    sourceWarnings,
    sourceUpdatedAt,
    customerTargets,
    customerGoalTargets,
    customerRationales,
    companyRationales,
    rows,
  }
}

function formatTargetSplitWan(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}万`
}

function getMuyuanNovemberVisibleCustomerRationale(rationale: string) {
  const visiblePrefixes = [
    '十点半目标 ',
    '自孵目标 ',
    '签约小红书目标 ',
    '签约抖音目标 ',
    '签约视频号目标 ',
    '外采业绩目标 ',
  ]
  return rationale.split(/\r?\n/).flatMap((line) => {
    const trimmedLine = line.trimStart()
    if (!visiblePrefixes.some((prefix) => trimmedLine.startsWith(prefix))) return []
    const targetLabelEnd = trimmedLine.indexOf('：')
    if (targetLabelEnd < 0) return []
    const targetLabel = trimmedLine.slice(0, targetLabelEnd + 1)
    const sameCategoryActuals = trimmedLine.match(/本人同类实绩：([^；]+)；/)
    const overallActuals = trimmedLine.match(/整体实绩：([^）]+)）/)
    const actuals = sameCategoryActuals?.[1] ?? overallActuals?.[1]
    if (!actuals) return []
    const actualsLabel = sameCategoryActuals ? '本人同类实绩' : '本人整体实绩'
    return [`${targetLabel}${actualsLabel}：${actuals}；`]
  })
    .join('\n')
}

function getTargetSplitCustomerRationalesByGoal(rationale: string): Partial<Record<TargetSplitGoalKey, string>> {
  const goalLabels: Array<[TargetSplitGoalKey, string]> = [
    ['halfPastTenTarget', '十点半'],
    ['selfIncubatedTarget', '自孵'],
    ['signingXiaohongshuTarget', '签约小红书'],
    ['signingDouyinTarget', '签约抖音'],
    ['signingShipinhaoTarget', '签约视频号'],
    ['outsourcingPerformanceTarget', '外采业绩'],
    ['outsourcingOrderCountTarget', '外采单数'],
  ]
  const rationalesByGoal: Partial<Record<TargetSplitGoalKey, string>> = {}
  rationale.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trimStart()
    const matchedGoal = goalLabels.find(([, label]) => trimmedLine.startsWith(`${label}目标`))
    if (!matchedGoal) return
    const [goalKey, label] = matchedGoal
    const sameCategoryActuals = trimmedLine.match(/本人同类实绩：([^；]+)；|同类实绩：([^；]+)；/)
    const overallActuals = trimmedLine.match(/整体实绩：([^；）]+)/)
    const actuals = sameCategoryActuals?.[1] ?? sameCategoryActuals?.[2] ?? overallActuals?.[1]
    if (actuals) {
      const actualsLabel = overallActuals && !sameCategoryActuals ? '本人整体实绩' : '本人同类实绩'
      rationalesByGoal[goalKey] = `${label}目标：${actualsLabel}：${actuals}；`
      return
    }
    rationalesByGoal[goalKey] = trimmedLine
  })
  return rationalesByGoal
}

function getTargetManagementGoalsStorageKey(employeeName: string) {
  return employeeName === '示例对客16' ? WANGYUE_TARGET_MANAGEMENT_STORAGE_KEY : `target-management-goals:${employeeName}`
}

function readTargetManagementGoals(employeeName: string): WangYueTargetManagementGoals {
  try {
    const saved = localStorage.getItem(getTargetManagementGoalsStorageKey(employeeName))
    return saved ? JSON.parse(saved) as WangYueTargetManagementGoals : {}
  } catch {
    return {}
  }
}

const getTargetManagementActualKey = (employeeName: string, monthId: number) => `${employeeName}:${monthId}`

const WANGYUE_TARGET_MANAGEMENT_ACTUAL_TARGET_KEYS: WangYueTargetManagementGoalKey[] = [
  'halfPastTenTarget',
  'selfIncubatedTarget',
  'signingXiaohongshuTarget',
  'signingDouyinTarget',
  'signingShipinhaoTarget',
  'outsourcingPerformanceTarget',
  'outsourcingOrderCountTarget',
]
const WANGYUE_TARGET_MANAGEMENT_SUM_TARGET_KEYS: WangYueTargetManagementGoalKey[] = [
  'halfPastTenTarget',
  'selfIncubatedTarget',
  'signingXiaohongshuTarget',
  'signingDouyinTarget',
  'signingShipinhaoTarget',
  'outsourcingPerformanceTarget',
]

function hasPositiveWangYueTargetManagementGoal(value: string | undefined) {
  const normalizedValue = value?.trim()
  if (!normalizedValue) return false
  const numericValue = Number(normalizedValue)
  return Number.isFinite(numericValue) && numericValue > 0
}

function hasWangYueTargetManagementActualTargets(goals: WangYueTargetManagementGoals, monthId: number) {
  const monthPrefix = `${monthId}:`
  return Object.entries(goals).some(([goalKey, values]) =>
    goalKey.startsWith(monthPrefix)
    && WANGYUE_TARGET_MANAGEMENT_ACTUAL_TARGET_KEYS.some((targetKey) => hasPositiveWangYueTargetManagementGoal(values[targetKey])),
  )
}

async function readOptionalReportSnapshot<T>(
  request: Promise<T>,
  label: string,
  errors: string[],
): Promise<T | null> {
  try {
    return await request
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    errors.push(`${label}：${detail}`)
    return null
  }
}

interface WangYueTargetManagementDisplayRow {
  slotIndex: number
  companyName: string
  selectedCompanyName: string
  companyHasSnapshot: boolean
  catalogBrandOptions: DashboardTargetManagementBrandOptionsResponse['brands']
  brandOptions: Array<{ value: string; orderCount: number }>
  brandCatalogStatus: 'idle' | 'loading' | 'loaded' | 'empty' | 'error'
  rowStart: number
  rowCount: number
  platform: (typeof WANGYUE_TARGET_MANAGEMENT_PLATFORMS)[number]
  brandIndex: number
  brandFilterKey: string
  brandFilter: string
  subBrandFilter: string
  subBrandOptions: Array<{ value: string; orderCount: number }>
  brandHierarchyAvailable: boolean
  brandName: string
  brandIsKnown: boolean
  actualsStatus: 'loading' | 'loaded' | 'error' | undefined
  actualMetrics: DashboardTargetManagementActualsResponse['actuals'][number]['metrics']
  rowKey: string
  isEmptyPlaceholder: boolean
  isImportedEmptyProject: boolean
  isProductLine: boolean
  goalKey: string
  parentGoalKey?: string
  productLineId?: string
  productLineName?: string
}

function shiftTargetManagementCompanySlotRecord<T>(
  record: Record<string, T>,
  slotIndex: number,
  direction: 'insert' | 'remove',
) {
  const shifted: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    const separatorIndex = key.indexOf(':')
    const currentSlotIndex = Number(key.slice(0, separatorIndex))
    if (separatorIndex < 0 || !Number.isSafeInteger(currentSlotIndex) || currentSlotIndex < 0) {
      shifted[key] = value
      continue
    }
    if (direction === 'remove' && currentSlotIndex === slotIndex) continue
    const nextSlotIndex = direction === 'insert'
      ? currentSlotIndex >= slotIndex ? currentSlotIndex + 1 : currentSlotIndex
      : currentSlotIndex > slotIndex ? currentSlotIndex - 1 : currentSlotIndex
    shifted[`${nextSlotIndex}${key.slice(separatorIndex)}`] = value
  }
  return shifted
}

function shiftTargetManagementEmptySlotGoals(
  goals: WangYueTargetManagementGoals,
  slotIndex: number,
  direction: 'insert' | 'remove',
): WangYueTargetManagementGoals {
  const shifted: WangYueTargetManagementGoals = {}
  for (const [key, values] of Object.entries(goals)) {
    const match = key.match(/^(\d+:empty-slot-)(\d+)(:.*)$/)
    if (!match) {
      shifted[key] = values
      continue
    }
    const currentSlotIndex = Number(match[2])
    if (direction === 'remove' && currentSlotIndex === slotIndex) continue
    const nextSlotIndex = direction === 'insert'
      ? currentSlotIndex >= slotIndex ? currentSlotIndex + 1 : currentSlotIndex
      : currentSlotIndex > slotIndex ? currentSlotIndex - 1 : currentSlotIndex
    shifted[`${match[1]}${nextSlotIndex}${match[3]}`] = values
  }
  return shifted
}

const DEFAULT_COMPANY_BOARD_SORT: NonNullable<SortConfig> = {
  column: 'companyTotal',
  direction: 'desc',
}
const UNPUBLISHED_PAGE_SIZES = [50, 100, 200] as const
type UnpublishedPageSize = typeof UNPUBLISHED_PAGE_SIZES[number]
type UnpublishedDateFilterMode = 'fangpian-month' | 'date-range'

type PerformanceValues = {
  halfPastTen: number
  selfIncubated: number
  signingXiaohongshu: number
  signingDouyin: number
  signingShipinhao: number
  outsourcing: number
  outsourcingOrderCount: number
  total: number
}

const WANG_YUE_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

type MetricKey = keyof typeof WANG_YUE_PERFORMANCE
type Dimension = (typeof DIMENSIONS)[number]
type ManualValue = { target: number; commissionRate: number }
type AmountUnit = 'yuan' | 'wan'
type AmountDisplay = { unit: AmountUnit; decimals: number }

const DEFAULT_AMOUNT_DISPLAY: Record<Dimension, AmountDisplay> = {
  publish: { unit: 'yuan', decimals: 2 },
  deal: { unit: 'yuan', decimals: 2 },
  payment: { unit: 'yuan', decimals: 2 },
}

function formatAmount(value: number, display: AmountDisplay): string {
  const amount = display.unit === 'wan' ? value / 10000 : value
  const formatted = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: display.decimals,
    maximumFractionDigits: display.decimals,
  }).format(amount)
  return display.unit === 'wan' ? `${formatted}万` : formatted
}

const EMPTY_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WANG_YUE_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  ...EMPTY_PERFORMANCE,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WANG_YUE_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  ...WANG_YUE_PERFORMANCE,
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WANG_YUE_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WANG_YUE_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WANG_YUE_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  ...WANG_YUE_LAST_MONTH_PERFORMANCE,
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_YI_CHANG_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_YI_CHANG_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_YI_CHANG_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_YI_CHANG_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_YI_CHANG_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_YI_CHANG_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const DONG_LANG_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const DONG_LANG_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const DONG_LANG_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const DONG_LANG_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const DONG_LANG_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const DONG_LANG_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_JING_XIN_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_JING_XIN_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_JING_XIN_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_JING_XIN_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_JING_XIN_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_JING_XIN_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHANG_RAN_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHANG_RAN_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHANG_RAN_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHANG_RAN_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHANG_RAN_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHANG_RAN_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WEI_XIAO_YU_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WEI_XIAO_YU_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WEI_XIAO_YU_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WEI_XIAO_YU_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WEI_XIAO_YU_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const WEI_XIAO_YU_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LI_RU_YI_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LI_RU_YI_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LI_RU_YI_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LI_RU_YI_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LI_RU_YI_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LI_RU_YI_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const SONG_WEN_JING_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const SONG_WEN_JING_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const SONG_WEN_JING_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const SONG_WEN_JING_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const SONG_WEN_JING_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const SONG_WEN_JING_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MIAO_QING_LIN_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MIAO_QING_LIN_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MIAO_QING_LIN_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MIAO_QING_LIN_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MIAO_QING_LIN_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MIAO_QING_LIN_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHOU_LI_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHOU_LI_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHOU_LI_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHOU_LI_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHOU_LI_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const ZHOU_LI_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MU_YUAN_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MU_YUAN_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MU_YUAN_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MU_YUAN_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_GUANGCUN_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_GUANGCUN_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_GUANGCUN_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_GUANGCUN_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_GUANGCUN_PAYMENT_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const LIU_GUANGCUN_PAYMENT_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

function getMemberPerformance(memberName: string, dimension: Dimension): PerformanceValues {
  if (memberName === '示例对客16') {
    if (dimension === 'deal') return WANG_YUE_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return WANG_YUE_PAYMENT_CURRENT_PERFORMANCE
    return WANG_YUE_PERFORMANCE
  }
  if (memberName === '示例对客17') {
    if (dimension === 'deal') return LIU_YI_CHANG_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return LIU_YI_CHANG_PAYMENT_CURRENT_PERFORMANCE
    return LIU_YI_CHANG_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客18') {
    if (dimension === 'deal') return DONG_LANG_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return DONG_LANG_PAYMENT_CURRENT_PERFORMANCE
    return DONG_LANG_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客13') {
    if (dimension === 'deal') return LIU_JING_XIN_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return LIU_JING_XIN_PAYMENT_CURRENT_PERFORMANCE
    return LIU_JING_XIN_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客22') {
    if (dimension === 'deal') return ZHANG_RAN_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return ZHANG_RAN_PAYMENT_CURRENT_PERFORMANCE
    return ZHANG_RAN_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客14') {
    if (dimension === 'deal') return WEI_XIAO_YU_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return WEI_XIAO_YU_PAYMENT_CURRENT_PERFORMANCE
    return WEI_XIAO_YU_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客15') {
    if (dimension === 'deal') return LI_RU_YI_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return LI_RU_YI_PAYMENT_CURRENT_PERFORMANCE
    return LI_RU_YI_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客20') {
    if (dimension === 'deal') return SONG_WEN_JING_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return SONG_WEN_JING_PAYMENT_CURRENT_PERFORMANCE
    return SONG_WEN_JING_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客21') {
    if (dimension === 'deal') return MIAO_QING_LIN_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return MIAO_QING_LIN_PAYMENT_CURRENT_PERFORMANCE
    return MIAO_QING_LIN_CURRENT_PERFORMANCE
  }
  if (memberName === '示例对客19') {
    if (dimension === 'deal') return ZHOU_LI_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return ZHOU_LI_PAYMENT_CURRENT_PERFORMANCE
    return ZHOU_LI_CURRENT_PERFORMANCE
  }
  if (memberName === '示例开发01') {
    if (dimension === 'deal') return MU_YUAN_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return MU_YUAN_PAYMENT_CURRENT_PERFORMANCE
    return MU_YUAN_CURRENT_PERFORMANCE
  }
  if (memberName === '示例开发10') {
    if (dimension === 'deal') return LIU_GUANGCUN_DEAL_CURRENT_PERFORMANCE
    if (dimension === 'payment') return LIU_GUANGCUN_PAYMENT_CURRENT_PERFORMANCE
    return LIU_GUANGCUN_CURRENT_PERFORMANCE
  }
  return EMPTY_PERFORMANCE
}

function getMemberLastMonthPerformance(memberName: string, dimension: Dimension): PerformanceValues {
  if (memberName === '示例对客16') {
    if (dimension === 'deal') return WANG_YUE_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return WANG_YUE_PAYMENT_LAST_MONTH_PERFORMANCE
    return WANG_YUE_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客17') {
    if (dimension === 'deal') return LIU_YI_CHANG_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return LIU_YI_CHANG_PAYMENT_LAST_MONTH_PERFORMANCE
    return LIU_YI_CHANG_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客18') {
    if (dimension === 'deal') return DONG_LANG_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return DONG_LANG_PAYMENT_LAST_MONTH_PERFORMANCE
    return DONG_LANG_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客13') {
    if (dimension === 'deal') return LIU_JING_XIN_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return LIU_JING_XIN_PAYMENT_LAST_MONTH_PERFORMANCE
    return LIU_JING_XIN_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客22') {
    if (dimension === 'deal') return ZHANG_RAN_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return ZHANG_RAN_PAYMENT_LAST_MONTH_PERFORMANCE
    return ZHANG_RAN_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客14') {
    if (dimension === 'deal') return WEI_XIAO_YU_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return WEI_XIAO_YU_PAYMENT_LAST_MONTH_PERFORMANCE
    return WEI_XIAO_YU_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客15') {
    if (dimension === 'deal') return LI_RU_YI_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return LI_RU_YI_PAYMENT_LAST_MONTH_PERFORMANCE
    return LI_RU_YI_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客20') {
    if (dimension === 'deal') return SONG_WEN_JING_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return SONG_WEN_JING_PAYMENT_LAST_MONTH_PERFORMANCE
    return SONG_WEN_JING_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客21') {
    if (dimension === 'deal') return MIAO_QING_LIN_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return MIAO_QING_LIN_PAYMENT_LAST_MONTH_PERFORMANCE
    return MIAO_QING_LIN_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例对客19') {
    if (dimension === 'deal') return ZHOU_LI_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return ZHOU_LI_PAYMENT_LAST_MONTH_PERFORMANCE
    return ZHOU_LI_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例开发01') {
    if (dimension === 'deal') return MU_YUAN_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return MU_YUAN_PAYMENT_LAST_MONTH_PERFORMANCE
    return MU_YUAN_LAST_MONTH_PERFORMANCE
  }
  if (memberName === '示例开发10') {
    if (dimension === 'deal') return LIU_GUANGCUN_DEAL_LAST_MONTH_PERFORMANCE
    if (dimension === 'payment') return LIU_GUANGCUN_PAYMENT_LAST_MONTH_PERFORMANCE
    return LIU_GUANGCUN_LAST_MONTH_PERFORMANCE
  }
  return EMPTY_PERFORMANCE
}

const MU_YUAN_DEAL_CURRENT_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

const MU_YUAN_DEAL_LAST_MONTH_PERFORMANCE: PerformanceValues = {
  halfPastTen: 0,
  selfIncubated: 0,
  signingXiaohongshu: 0,
  signingDouyin: 0,
  signingShipinhao: 0,
  outsourcing: 0,
  outsourcingOrderCount: 0,
  total: 0,
}

function migrateManualValues(...savedValues: Record<string, ManualValue>[]): Record<string, ManualValue> {
  const migrated: Record<string, ManualValue> = {}
  for (const saved of savedValues) {
    for (const [key, value] of Object.entries(saved)) {
      const segments = key.split(':')
      const normalizedKey = segments.length === 4
        ? key
        : segments.length === 3
          ? `148:${key}`
          : segments.length === 2 && DIMENSIONS.includes(segments[0] as Dimension)
            ? `148:示例对客16:${key}`
            : key
      migrated[normalizedKey] = value
    }
  }
  return migrated
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function manualValueKey(monthId: number, employeeName: string, dimension: Dimension, metricKey: MetricKey): string {
  return `${monthId}:${employeeName}:${dimension}:${metricKey}`
}

function getCurrentDashboardMonthId(today = new Date()): DashboardMonthId | undefined {
  const dayOrdinal = (year: number, month: number, day: number) =>
    Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  const current = dayOrdinal(today.getFullYear(), today.getMonth() + 1, today.getDate())

  return DASHBOARD_MONTH_IDS.find((monthId) => {
    const { startMonth, startDay, endMonth, endDay } = DASHBOARD_FANGPIAN_PERIODS[monthId]
    const start = dayOrdinal(2026, startMonth, startDay)
    const endYear = endMonth < startMonth ? 2027 : 2026
    const end = dayOrdinal(endYear, endMonth, endDay)
    return current >= start && current < end
  })
}

function getTargetManagementSubmissionMonthOptions(today = new Date()): TargetManagementSubmissionMonthOption[] {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(today)
  const readPart = (type: string) => Number(dateParts.find((part) => part.type === type)?.value ?? 0)
  const currentYear = readPart('year')
  if (currentYear !== 2026) return []

  const current = Date.UTC(currentYear, readPart('month') - 1, readPart('day'))
  const currentMonthId = Object.entries(DASHBOARD_FANGPIAN_PERIODS).find(([rawMonthId, period]) => {
    const monthId = Number(rawMonthId)
    if (monthId < 145) return false
    const start = Date.UTC(currentYear, period.startMonth - 1, period.startDay)
    const endYear = period.endMonth < period.startMonth ? currentYear + 1 : currentYear
    const end = Date.UTC(endYear, period.endMonth - 1, period.endDay)
    return current >= start && current < end
  })?.[0]
  if (!currentMonthId) return []

  return Object.entries(DASHBOARD_FANGPIAN_PERIODS)
    .map(([monthId, period]) => ({ monthId: Number(monthId), label: period.label }))
    .filter(({ monthId }) => monthId >= 145 && monthId <= Number(currentMonthId))
    .sort((left, right) => right.monthId - left.monthId)
}

function getFangpianMonthTimeProgress(monthId: TargetManagementMonthId, today = new Date()): number {
  const dayOrdinal = (year: number, month: number, day: number) =>
    Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  const { startMonth, startDay, endMonth, endDay } = DASHBOARD_FANGPIAN_PERIODS[monthId]
  const start = dayOrdinal(2026, startMonth, startDay)
  const end = dayOrdinal(2026, endMonth, endDay)
  const current = dayOrdinal(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const elapsedDays = Math.min(Math.max(current - start + 1, 0), end - start)

  return elapsedDays / (end - start)
}

function performanceFromOrderMetric(metric: DashboardMemberTarget['orderMetric'][Dimension]): PerformanceValues {
  return {
    halfPastTen: metric.halfPastTen.amount,
    selfIncubated: metric.selfIncubated.amount,
    signingXiaohongshu: metric.signingXiaohongshu.amount,
    signingDouyin: metric.signingDouyin.amount,
    signingShipinhao: metric.signingShipinhao.amount,
    outsourcing: metric.outsourcing.amount,
    outsourcingOrderCount: metric.outsourcingOrderCount.orderCount,
    total: metric.total.amount,
  }
}

function isOutsourcingOrderCount(key: string): boolean {
  return key === 'outsourcingOrderCount'
}

function formatTargetInput(target: number, metricKey: string): string {
  return isOutsourcingOrderCount(metricKey) ? String(target) : (target / 10000).toFixed(2)
}

function parseTargetInput(rawValue: string, metricKey: string): number | undefined {
  if (rawValue.trim() === '') return 0
  const parsedValue = Number(rawValue)
  if (!Number.isFinite(parsedValue)) return undefined
  return isOutsourcingOrderCount(metricKey)
    ? Math.round(parsedValue)
    : Math.round(parsedValue * 100) * 100
}

function getTotalPerformance(performance: PerformanceValues): number {
  if (performance.total > 0) return performance.total
  return SUB_METRICS.reduce((sum, { key }) => {
    if (key === 'total' || isOutsourcingOrderCount(key)) return sum
    return sum + performance[key]
  }, 0)
}

function getMetricValue(performance: PerformanceValues, key: MetricKey): number {
  return key === 'total' ? getTotalPerformance(performance) : performance[key]
}

function splitChartLabel(label: string): string[] {
  const chunks: string[] = []
  for (let index = 0; index < label.length; index += 5) {
    chunks.push(label.slice(index, index + 5))
  }
  return chunks
}

type ChartSeries = {
  name: string
  color: string
  values: number[]
  kind: 'bar' | 'line'
}

function TrendChart({
  series,
  categoryLabels,
  formatValue,
  formatLineValue,
  height = 300,
}: {
  series: ChartSeries[]
  categoryLabels?: string[]
  formatValue: (value: number) => string
  formatLineValue: (value: number) => string
  height?: number
}) {
  const width = 820
  const padding = { left: 82, right: 58, top: 48, bottom: 96 }
  const pointCount = series[0]?.values.length ?? 0
  if (!pointCount) return null

  const barSeries = series.filter((item) => item.kind === 'bar')
  const lineSeries = series.filter((item) => item.kind === 'line')
  const barValues = barSeries.flatMap((item) => item.values)
  const lineValues = lineSeries.flatMap((item) => item.values)
  const maxBarValue = Math.max(...barValues, 1)
  const maxLineValue = Math.max(...lineValues, 1)
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const categoryWidth = innerWidth / pointCount
  const getCategoryX = (index: number) => padding.left + index * categoryWidth + categoryWidth / 2
  const getBarY = (value: number) => padding.top + (1 - value / maxBarValue) * innerHeight
  const getLineY = (value: number) => padding.top + (1 - value / maxLineValue) * innerHeight
  const barWidth = Math.min(28, (categoryWidth * 0.72) / Math.max(barSeries.length, 1))
  const barGroupWidth = barWidth * barSeries.length

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = maxBarValue * ratio
          const y = getBarY(value)
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e5e9f2" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="chart-axis-text">
                {formatValue(value)}
              </text>
              {lineSeries.length > 0 ? (
                <text x={width - padding.right + 10} y={y + 4} textAnchor="start" className="chart-axis-text">
                  {formatLineValue(maxLineValue * ratio)}
                </text>
              ) : null}
            </g>
          )
        })}

        {barSeries.map((item, seriesIndex) => item.values.map((value, index) => {
          const x = getCategoryX(index) - barGroupWidth / 2 + seriesIndex * barWidth
          const y = getBarY(value)
          return (
            <g key={`${item.name}-${index}`}>
              <rect x={x} y={y} width={Math.max(barWidth - 3, 4)} height={Math.max(innerHeight - (y - padding.top), 0)} rx="3" fill={item.color} />
              <text x={x + Math.max(barWidth - 3, 4) / 2} y={Math.max(y - 8, padding.top + 10)} textAnchor="middle" className={`chart-data-text${value < 0 ? ' negative-value' : ''}`}>
                {formatValue(value)}
              </text>
            </g>
          )
        }))}

        {lineSeries.map((item) => (
          <g key={item.name}>
            <polyline
              fill="none"
              stroke={item.color}
              strokeWidth="2.5"
              points={item.values.map((value, index) => `${getCategoryX(index)},${getLineY(value)}`).join(' ')}
            />
            {item.values.map((value, index) => (
              <g key={`${item.name}-${index}`}>
                <circle cx={getCategoryX(index)} cy={getLineY(value)} r="4" fill="#fff" stroke={item.color} strokeWidth="2.5" />
                <text x={getCategoryX(index)} y={getLineY(value) - 12} textAnchor="middle" className={`chart-data-text${value < 0 ? ' negative-value' : ''}`}>
                  {formatLineValue(value)}
                </text>
              </g>
            ))}
          </g>
        ))}

        {series[0].values.map((_, index) => {
          const label = categoryLabels?.[index] ?? SUB_METRICS[index]?.name ?? ''
          const lines = splitChartLabel(label)
          return (
            <text key={index} x={getCategoryX(index)} y={height - padding.bottom + 22} textAnchor="middle" className="chart-axis-text">
              {lines.map((line, lineIndex) => (
                <tspan key={lineIndex} x={getCategoryX(index)} dy={lineIndex === 0 ? 0 : 15}>
                  {line}
                </tspan>
              ))}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

interface CompanyOrderDetailsContext {
  monthId: number
  dimension: DashboardOrderMetricDimension
  metricKey: DashboardCompanyMetricKey
  companyName?: string
  brandName?: string
  filters?: DashboardUnpublishedOrderFilters
  employeeName?: DashboardCompanyBoardEmployeeName
  metricLabel?: string
  source?: 'target'
}

interface CompanyBrandShareContext {
  kind: 'brands'
  monthId: number
  dimension: DashboardOrderMetricDimension
  companyName: string
  employeeName: DashboardCompanyBoardEmployeeName
}

interface BrandCompanyShareContext {
  kind: 'companies'
  monthId: number
  dimension: DashboardOrderMetricDimension
  brandName: string
  employeeName: DashboardCompanyBoardEmployeeName
}

interface PerformanceShareItem {
  itemName: string
  totalAmount: number
  orderCount: number
}

interface PerformanceShareData {
  employeeName: DashboardCompanyBoardEmployeeName
  monthId: number
  dimension: DashboardOrderMetricDimension
  entityName: string
  snapshotUpdatedAt: string
  totalAmount: number
  items: PerformanceShareItem[]
}

const COMPANY_BRAND_SHARE_COLORS = [
  '#2f5cff', '#12b76a', '#f79009', '#7a5af8', '#06aed4',
  '#ee46bc', '#f04438', '#667085', '#84caff', '#d6bbfb',
]

function getPieSectorPath(
  startAngle: number,
  endAngle: number,
  centerX: number,
  centerY: number,
  radius: number,
): string {
  const startX = centerX + radius * Math.cos(startAngle)
  const startY = centerY + radius * Math.sin(startAngle)
  const endX = centerX + radius * Math.cos(endAngle)
  const endY = centerY + radius * Math.sin(endAngle)
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`
}

function CompanyBrandShareModal({
  context,
  amountDisplay,
  onClose,
  onItemSelect,
}: {
  context: CompanyBrandShareContext | BrandCompanyShareContext
  amountDisplay: AmountDisplay
  onClose: () => void
  onItemSelect: (itemName: string) => void
}) {
  const [data, setData] = useState<PerformanceShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeItemName, setActiveItemName] = useState<string | null>(null)
  const isBrandBreakdown = context.kind === 'brands'
  const subjectName = isBrandBreakdown ? context.companyName : context.brandName
  const itemLabel = isBrandBreakdown ? '品牌' : '公司'

  useEffect(() => {
    let active = true
    setData(null)
    setLoading(true)
    setError('')
    setActiveItemName(null)
    const request = context.kind === 'brands'
      ? getDashboardCompanyBrandShare(context.monthId, context.dimension, context.companyName, context.employeeName)
        .then((response) => ({
          employeeName: response.employeeName,
          monthId: response.monthId,
          dimension: response.dimension,
          entityName: response.companyName,
          snapshotUpdatedAt: response.snapshotUpdatedAt,
          totalAmount: response.totalAmount,
          items: response.brands.map((brand) => ({
            itemName: brand.brandName,
            totalAmount: brand.totalAmount,
            orderCount: brand.orderCount,
          })),
        }))
      : getDashboardBrandCompanyShare(context.monthId, context.dimension, context.brandName, context.employeeName)
        .then((response) => ({
          employeeName: response.employeeName,
          monthId: response.monthId,
          dimension: response.dimension,
          entityName: response.brandName,
          snapshotUpdatedAt: response.snapshotUpdatedAt,
          totalAmount: response.totalAmount,
          items: response.companies.map((company) => ({
            itemName: company.companyName,
            totalAmount: company.totalAmount,
            orderCount: company.orderCount,
          })),
        }))
    void request
      .then((response) => {
        if (!active) return
        setData(response)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError(`${isBrandBreakdown ? '公司品牌' : '品牌公司'}业绩快照暂不可用，请等待后台计划刷新。`)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [context, isBrandBreakdown])

  const items = data?.items ?? []
  const positiveItems = items.filter((item) => item.totalAmount > 0)
  const positiveTotal = positiveItems.reduce((sum, item) => sum + item.totalAmount, 0)
  const hasNegativeAmount = items.some((item) => item.totalAmount < 0)
  const canDrawPie = !hasNegativeAmount && positiveTotal > 0
  const colorByItemName = new Map(
    items.map((item, index) => [
      item.itemName,
      COMPANY_BRAND_SHARE_COLORS[index % COMPANY_BRAND_SHARE_COLORS.length],
    ]),
  )
  let currentAngle = -Math.PI / 2
  const slices = positiveItems.map((item) => {
    const startAngle = currentAngle
    currentAngle += (item.totalAmount / positiveTotal) * Math.PI * 2
    return {
      item,
      startAngle,
      endAngle: currentAngle,
      color: colorByItemName.get(item.itemName) ?? COMPANY_BRAND_SHARE_COLORS[0],
    }
  })
  const chartWidth = 340
  const chartHeight = 340
  const centerX = chartWidth / 2
  const centerY = chartHeight / 2
  const radius = 142
  const activeItem = items.find((item) => item.itemName === activeItemName) ?? null

  return (
    <div className="chart-modal-backdrop" onClick={onClose}>
      <div
        className="chart-modal company-brand-share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-brand-share-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="company-brand-share-title">
              {DASHBOARD_FANGPIAN_PERIODS[context.monthId as DashboardMonthId]?.label ?? `方片月${context.monthId - 139}月`}
              {' · '}{DIMENSION_NAMES[context.dimension]} · {subjectName}{isBrandBreakdown ? '品牌占比' : '公司占比'}
            </h3>
            <p className="customer-dashboard-chart-note">悬停扇区或{itemLabel}名称查看业绩占比；点击可查看对应订单明细。</p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
        {loading ? <div className="dashboard-data-note">正在读取已保存的公司订单快照…</div> : null}
        {error ? <div className="dashboard-data-note dashboard-data-note-error">{error}</div> : null}
        {data ? (
          <>
            <div className="company-brand-share-summary">
              <span>{isBrandBreakdown ? '公司总业绩' : '品牌总业绩'}</span>
              <b>{formatAmount(data.totalAmount, amountDisplay)}</b>
            </div>
            {hasNegativeAmount ? (
              <div className="dashboard-data-note">
                存在负业绩，扇形图无法准确表达净额占比；下方列出全部{itemLabel}和占比，可点击查看订单。
              </div>
            ) : null}
            {items.length === 0 ? (
              <div className="supplementary-dashboard-placeholder">该{isBrandBreakdown ? '公司' : '品牌'}当前维度没有{itemLabel}订单。</div>
            ) : (
              <div className="company-brand-share-content">
                {canDrawPie ? (
                  <div className="company-brand-share-chart">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="group" aria-label={`${subjectName}${itemLabel}业绩占比扇形图`}>
                      {slices.length === 1 ? (
                        <circle
                          className={`company-brand-share-sector${activeItemName === slices[0].item.itemName ? ' is-active' : ''}`}
                          cx={centerX}
                          cy={centerY}
                          r={radius}
                          fill={slices[0].color}
                          role="button"
                          tabIndex={0}
                          aria-label={`${slices[0].item.itemName}，业绩占比100%，业绩${formatAmount(slices[0].item.totalAmount, amountDisplay)}`}
                          onMouseEnter={() => setActiveItemName(slices[0].item.itemName)}
                          onFocus={() => setActiveItemName(slices[0].item.itemName)}
                          onClick={() => onItemSelect(slices[0].item.itemName)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onItemSelect(slices[0].item.itemName)
                            }
                          }}
                        />
                      ) : slices.map(({ item, startAngle, endAngle, color }) => (
                        <path
                          key={item.itemName}
                          className={`company-brand-share-sector${activeItemName === item.itemName ? ' is-active' : ''}`}
                          d={getPieSectorPath(startAngle, endAngle, centerX, centerY, radius)}
                          fill={color}
                          role="button"
                          tabIndex={0}
                          aria-label={`${item.itemName}，业绩占比${formatRate(item.totalAmount / data.totalAmount)}，业绩${formatAmount(item.totalAmount, amountDisplay)}`}
                          onMouseEnter={() => setActiveItemName(item.itemName)}
                          onFocus={() => setActiveItemName(item.itemName)}
                          onClick={() => onItemSelect(item.itemName)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onItemSelect(item.itemName)
                            }
                          }}
                        >
                          <title>{`${item.itemName} · ${formatRate(item.totalAmount / data.totalAmount)} · ${formatAmount(item.totalAmount, amountDisplay)}`}</title>
                        </path>
                      ))}
                    </svg>
                  </div>
                ) : !hasNegativeAmount ? (
                  <div className="supplementary-dashboard-placeholder">当前{isBrandBreakdown ? '公司' : '品牌'}总业绩为零，暂无可绘制的占比。</div>
                ) : null}
                <div className="company-brand-share-info">
                  <div className="company-brand-share-detail" aria-live="polite">
                    {activeItem ? (
                      <>
                        <div className="company-brand-share-detail-title">
                          <i style={{ backgroundColor: colorByItemName.get(activeItem.itemName) }} />
                          <span title={activeItem.itemName}>{activeItem.itemName}</span>
                        </div>
                        <div className="company-brand-share-detail-metrics">
                          <div>
                            <span>业绩占比</span>
                            <b>{data.totalAmount !== 0 ? formatRate(activeItem.totalAmount / data.totalAmount) : '—'}</b>
                          </div>
                          <div>
                            <span>具体业绩</span>
                            <b>{formatAmount(activeItem.totalAmount, amountDisplay)}</b>
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="company-brand-share-detail-hint">悬停扇区或{itemLabel}名称，查看占比和业绩金额</span>
                    )}
                  </div>
                  <div className="company-brand-share-list" aria-label={`${itemLabel}列表`}>
                    {items.map((item) => (
                      <button
                        type="button"
                        className={`company-brand-share-item${activeItemName === item.itemName ? ' is-active' : ''}`}
                        key={item.itemName}
                        title={item.itemName}
                        onMouseEnter={() => setActiveItemName(item.itemName)}
                        onFocus={() => setActiveItemName(item.itemName)}
                        onClick={() => onItemSelect(item.itemName)}
                      >
                        <i style={{ backgroundColor: colorByItemName.get(item.itemName) }} />
                        <span className="company-brand-share-name">{item.itemName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="company-dashboard-snapshot-note">
              使用已保存订单快照 · 快照更新时间：{data.snapshotUpdatedAt
                ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(data.snapshotUpdatedAt))
                : '未知'}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function CompanyOrdersModal({
  context,
  amountDisplay,
  onClose,
}: {
  context: CompanyOrderDetailsContext
  amountDisplay: AmountDisplay
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<UnpublishedPageSize>(50)
  const [monthFilter, setMonthFilter] = useState<number | null>(context.monthId)
  const [dateFilterMode, setDateFilterMode] = useState<UnpublishedDateFilterMode>('fangpian-month')
  const initialFilters: DashboardUnpublishedOrderFilters = context.filters
    ?? (context.brandName ? { brandNameExact: context.brandName } : {})
  const [filterDraft, setFilterDraft] = useState<DashboardUnpublishedOrderFilters>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<DashboardUnpublishedOrderFilters>(initialFilters)
  const [profitSortDirection, setProfitSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [data, setData] = useState<DashboardCompanyOrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scrollMax, setScrollMax] = useState(0)
  const [scrollPosition, setScrollPosition] = useState(0)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    setData(null)
    void getDashboardCompanyOrders(
      page,
      pageSize,
      context.dimension,
      context.metricKey,
      monthFilter ?? undefined,
      context.companyName,
      { ...appliedFilters, ...(context.brandName ? { brandNameExact: context.brandName } : {}) },
      profitSortDirection ?? undefined,
      context.employeeName ?? '示例开发01',
    ).then((response) => {
      if (requestIdRef.current !== requestId) return
      setData(response)
      setLoading(false)
    }).catch(() => {
      if (requestIdRef.current !== requestId) return
      setError(context.source === 'target'
        ? '目标看板订单快照暂不可用，请等待后台计划刷新后重试。'
        : `${context.employeeName ?? '示例开发01'}公司订单快照暂不可用，请等待后台计划刷新后重试。`)
      setLoading(false)
    })
  }, [page, pageSize, monthFilter, context, appliedFilters, profitSortDirection])

  useEffect(() => {
    const table = tableRef.current
    const tableWrap = tableWrapRef.current
    if (!table || !tableWrap) return
    const updateScrollWidth = () => {
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      setScrollMax(maxScroll)
      setScrollPosition(Math.min(tableWrap.scrollLeft, maxScroll))
    }
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(table)
    resizeObserver.observe(tableWrap)
    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [data?.orders.length, loading])

  const renderFilterInput = (
    key: keyof DashboardUnpublishedOrderFilters,
    placeholder: string,
    type: 'text' | 'date' | 'number' = 'text',
  ) => (
    <input
      type={type}
      value={filterDraft[key] ?? ''}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => setFilterDraft((previous) => ({ ...previous, [key]: event.target.value }))}
    />
  )
  const renderPersonFilter = (
    key: 'reporterName' | 'customerFacingBusinessName' | 'businessName',
    label: string,
  ) => (
    <select
      value={filterDraft[key] ?? ''}
      aria-label={`筛选${label}`}
      onChange={(event) => setFilterDraft((previous) => ({ ...previous, [key]: event.target.value }))}
    >
      <option value="">全部{label}</option>
      {(data?.filterOptions[key] ?? []).map((option) => (
        <option key={option.value} value={option.value}>{option.value}（{option.orderCount}单）</option>
      ))}
    </select>
  )
  const renderCountedFilter = (
    key: 'brandName' | 'platformName',
    exactKey: 'brandNameExact' | 'platformNameExact',
    label: string,
  ) => (
    <select
      value={filterDraft[exactKey] ?? ''}
      aria-label={`筛选${label}`}
      onChange={(event) => setFilterDraft((previous) => ({ ...previous, [exactKey]: event.target.value }))}
    >
      <option value="">全部{label}</option>
      {(data?.filterOptions[key] ?? []).map((option) => (
        <option key={option.value} value={option.value}>{option.value}（{option.orderCount}单）</option>
      ))}
    </select>
  )
  const updateDateFilters = (filters: DashboardUnpublishedOrderFilters) => {
    const next = { ...filters }
    delete next.orderDateFrom
    delete next.orderDateTo
    return next
  }
  const applyFilters = () => {
    const filters = Object.fromEntries(
      Object.entries(filterDraft)
        .filter(([, value]) => Boolean(value?.trim()))
        .map(([key, value]) => [key, value?.trim() ?? '']),
    ) as DashboardUnpublishedOrderFilters
    setAppliedFilters(filters)
    setPage(1)
  }
  const clearFilters = () => {
    const brandFilter: DashboardUnpublishedOrderFilters = context.filters
      ?? (context.brandName ? { brandNameExact: context.brandName } : {})
    setFilterDraft(brandFilter)
    setAppliedFilters(brandFilter)
    setMonthFilter(context.monthId)
    setDateFilterMode('fangpian-month')
    setPage(1)
  }
  const toggleDateFilterMode = () => {
    const nextMode = dateFilterMode === 'fangpian-month' ? 'date-range' : 'fangpian-month'
    setDateFilterMode(nextMode)
    setFilterDraft((previous) => updateDateFilters(previous))
    setAppliedFilters((previous) => updateDateFilters(previous))
    setMonthFilter(nextMode === 'date-range' ? null : context.monthId)
    setPage(1)
  }
  const hasAppliedFilters = Object.values(appliedFilters).some((value) => value?.trim())
  const performanceTimeRule = context.dimension === 'publish'
    ? '自孵/签约按发布时间，外采按结款时间'
    : context.dimension === 'deal' ? '按成单时间' : '按结款时间'

  return (
    <div className="chart-modal-backdrop" onClick={onClose}>
      <div
        className="chart-modal unpublished-modal company-orders-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-orders-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="company-orders-modal-title">
              {context.employeeName ?? context.brandName ?? context.companyName ?? (context.filters?.customerName
                ? `公司名称含“${context.filters.customerName}”`
                : context.filters?.brandName ? `品牌名称含“${context.filters.brandName}”` : '全部公司')} · {context.metricLabel ?? COMPANY_METRIC_NAMES[context.metricKey]} · 订单明细
            </h3>
            <p>
              {data?.periodLabel ?? `方片月${context.monthId - 139}月`} · {DIMENSION_NAMES[context.dimension]}维度 · {performanceTimeRule}
              {data?.snapshotUpdatedAt
                ? ` · 快照更新于${new Intl.DateTimeFormat('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(data.snapshotUpdatedAt))}`
                : ''}
            </p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="unpublished-summary">
          <span>{hasAppliedFilters ? '筛选后业绩（全量）' : '业绩（全量）'} <b>{data ? formatAmount(data.amount, amountDisplay) : '—'}</b></span>
          <span>{hasAppliedFilters ? '筛选后订单数（全量）' : '订单数（全量）'} <b>{data?.orderCount ?? '—'}</b></span>
          <span>有效订单状态 <b>{context.source === 'target' ? '与示例开发01别名目标看板一致' : '与公司看板一致'}</b></span>
        </div>
        {error ? <div className="unpublished-error">{error}</div> : null}
        <div className="unpublished-filter-actions">
          <span>订单筛选使用当前维度的业绩归属时间；明细每页可选50/100/200条</span>
          <div>
            <button type="button" disabled={loading} onClick={applyFilters}>筛选</button>
            <button type="button" disabled={loading} onClick={clearFilters}>重置</button>
          </div>
        </div>
        <input
          className="unpublished-table-horizontal-range"
          type="range"
          min={0}
          max={scrollMax}
          value={Math.min(scrollPosition, scrollMax)}
          disabled={scrollMax === 0}
          aria-label="横向滚动公司订单明细"
          onChange={(event) => {
            const scrollLeft = Number(event.target.value)
            if (tableWrapRef.current) tableWrapRef.current.scrollLeft = scrollLeft
            setScrollPosition(scrollLeft)
          }}
        />
        <div
          className="unpublished-table-wrap"
          ref={tableWrapRef}
          onScroll={() => {
            if (tableWrapRef.current) setScrollPosition(tableWrapRef.current.scrollLeft)
          }}
        >
          <table className="unpublished-table" ref={tableRef}>
            <thead>
              <tr>
                <th>订单编号</th>
                <th>公司名称</th>
                <th>品牌</th>
                <th>博主</th>
                <th>平台</th>
                <th>订单状态</th>
                <th>业绩归属时间</th>
                <th>成交金额</th>
                <th aria-sort={profitSortDirection === 'asc' ? 'ascending' : profitSortDirection === 'desc' ? 'descending' : 'none'}>
                  <span className="dashboard-sort-control">
                    <button
                      type="button"
                      className={`dashboard-sort-button${profitSortDirection ? ' sorted' : ''}`}
                      aria-label={`公司收益（利润），${profitSortDirection === 'asc' ? '当前正序' : profitSortDirection === 'desc' ? '当前倒序' : '未排序'}，点击切换排序`}
                      title={`公司收益（利润）：${profitSortDirection === 'asc' ? '正序' : profitSortDirection === 'desc' ? '倒序' : '点击排序'}`}
                      onClick={() => {
                        setProfitSortDirection((current) => current === null ? 'asc' : current === 'asc' ? 'desc' : 'asc')
                        setPage(1)
                      }}
                    >
                      <span>公司收益</span>
                      <span className="dashboard-sort-indicator" aria-hidden="true">
                        {profitSortDirection === 'asc' ? '↑' : profitSortDirection === 'desc' ? '↓' : '↕'}
                      </span>
                    </button>
                    {profitSortDirection ? (
                      <button
                        type="button"
                        className="dashboard-sort-reset"
                        aria-label="重置公司收益排序"
                        title="重置排序"
                        onClick={() => {
                          setProfitSortDirection(null)
                          setPage(1)
                        }}
                      >
                        重置
                      </button>
                    ) : null}
                  </span>
                </th>
                <th>提报人</th>
                <th>商务对客人</th>
                <th>结款商务</th>
              </tr>
              <tr className="unpublished-filter-row">
                <th>{renderFilterInput('orderCode', '订单编号')}</th>
                <th>{renderFilterInput('customerName', '公司名称')}</th>
                <th>{renderCountedFilter('brandName', 'brandNameExact', '品牌')}</th>
                <th>{renderFilterInput('creatorName', '博主')}</th>
                <th>{renderCountedFilter('platformName', 'platformNameExact', '平台')}</th>
                <th>{renderFilterInput('statusText', '订单状态')}</th>
                <th>
                  <div className="unpublished-date-filter-switch">
                    <button
                      className="unpublished-date-filter-toggle"
                      type="button"
                      aria-label={dateFilterMode === 'fangpian-month' ? '切换到日期范围筛选' : '切换到方片月筛选'}
                      title={dateFilterMode === 'fangpian-month' ? '切换到日期范围筛选' : '切换到方片月筛选'}
                      disabled={loading}
                      onClick={toggleDateFilterMode}
                    >⇄</button>
                    {dateFilterMode === 'fangpian-month' ? (
                      <select
                        value={monthFilter ?? ''}
                        aria-label="按业绩方片月筛选"
                        disabled={loading}
                        onChange={(event) => {
                          setMonthFilter(event.target.value ? Number(event.target.value) : null)
                          setPage(1)
                        }}
                      >
                        <option value="">全部方片月</option>
                        {(data?.availableMonths ?? []).map((month) => (
                          <option key={month.monthId} value={month.monthId}>{month.label}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="unpublished-filter-range date">
                        {renderFilterInput('orderDateFrom', '开始日期', 'date')}
                        {renderFilterInput('orderDateTo', '结束日期', 'date')}
                      </div>
                    )}
                  </div>
                </th>
                <th>
                  <div className="unpublished-filter-range">
                    {renderFilterInput('orderMoneyMin', '最低', 'number')}
                    {renderFilterInput('orderMoneyMax', '最高', 'number')}
                  </div>
                </th>
                <th>
                  <div className="unpublished-filter-range">
                    {renderFilterInput('incomeMoneyMin', '最低', 'number')}
                    {renderFilterInput('incomeMoneyMax', '最高', 'number')}
                  </div>
                </th>
                <th>{renderPersonFilter('reporterName', '提报人')}</th>
                <th>{renderPersonFilter('customerFacingBusinessName', '商务对客人')}</th>
                <th>{renderPersonFilter('businessName', '结款商务')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.orders.map((order) => (
                <tr key={`${order.monthId}:${order.id}`}>
                  <td>{order.orderCode || order.id}</td>
                  <td>{order.customerName || '—'}</td>
                  <td>{order.brandName || '—'}</td>
                  <td>{order.creatorName || '—'}</td>
                  <td>{order.platformName || '—'}</td>
                  <td>{order.statusText || '—'}</td>
                  <td>{order.performanceDate
                    ? new Date(order.performanceDate * 1000).toLocaleString('zh-CN', {
                      timeZone: 'Asia/Shanghai',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    : '—'}</td>
                  <td>{formatAmount(order.orderMoney, amountDisplay)}</td>
                  <td>{formatAmount(order.incomeMoney, amountDisplay)}</td>
                  <td>{order.reporterName || '—'}</td>
                  <td>{order.customerFacingBusinessName || '—'}</td>
                  <td>{order.businessName || '—'}</td>
                </tr>
              ))}
              {!loading && !error && data?.orders.length === 0 ? (
                <tr><td className="unpublished-empty" colSpan={12}>没有符合条件的订单</td></tr>
              ) : null}
            </tbody>
          </table>
          {loading ? <div className="unpublished-table-state">正在读取公司订单快照…</div> : null}
        </div>
        <div className="unpublished-pagination">
          <span>共 {data?.orderCount ?? 0} 单 · 第 {data?.page ?? 1} / {Math.max(1, data?.totalPages ?? 1)} 页</span>
          <div>
            <label className="unpublished-page-size">
              每页
              <select
                value={pageSize}
                disabled={loading}
                onChange={(event) => {
                  setPageSize(Number(event.target.value) as UnpublishedPageSize)
                  setPage(1)
                }}
              >
                {UNPUBLISHED_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}条</option>)}
              </select>
            </label>
            <button disabled={loading || !data || data.page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</button>
            <button disabled={loading || !data || data.page >= data.totalPages} onClick={() => setPage((current) => current + 1)}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function sortWangYueTargetManagementImportRows(
  rows: DashboardTargetManagementImportPreviewResponse['rows'],
) {
  const amountTargetKeys = [
    'halfPastTenTarget',
    'selfIncubatedTarget',
    'signingXiaohongshuTarget',
    'signingDouyinTarget',
    'signingShipinhaoTarget',
  ] as const
  const getAmountTargetTotal = (row: DashboardTargetManagementImportPreviewResponse['rows'][number]) =>
    amountTargetKeys.reduce((total, key) => {
      const rawValue = row.targets?.[key]?.trim().replace(/,/g, '')
      const value = rawValue ? Number(rawValue) : 0
      return Number.isFinite(value) ? total + value : total
    }, 0)
  const parentIndexes = rows.map((_, index) => index)
  const findRoot = (index: number): number => {
    if (parentIndexes[index] !== index) parentIndexes[index] = findRoot(parentIndexes[index])
    return parentIndexes[index]
  }
  const union = (left: number, right: number) => {
    const leftRoot = findRoot(left)
    const rightRoot = findRoot(right)
    if (leftRoot !== rightRoot) parentIndexes[rightRoot] = leftRoot
  }
  const firstIndexByMergeGroup = new Map<string, number>()
  rows.forEach((row, index) => {
    for (const mergeGroup of Object.values(row.targetMergeGroups ?? {})) {
      if (!mergeGroup) continue
      const firstIndex = firstIndexByMergeGroup.get(mergeGroup)
      if (firstIndex === undefined) firstIndexByMergeGroup.set(mergeGroup, index)
      else union(firstIndex, index)
    }
  })
  const blocks = new Map<number, Array<{ row: typeof rows[number]; index: number }>>()
  rows.forEach((row, index) => {
    const root = findRoot(index)
    blocks.set(root, [...(blocks.get(root) ?? []), { row, index }])
  })
  return [...blocks.values()]
    .map((block) => ({
      block,
      firstIndex: block[0].index,
      totalTarget: block.reduce((sum, item) => sum + getAmountTargetTotal(item.row), 0),
    }))
    .sort((left, right) => right.totalTarget - left.totalTarget || left.firstIndex - right.firstIndex)
    .flatMap(({ block }) => block.sort((left, right) => left.index - right.index).map(({ row }) => row))
}

export interface DashboardLoginIdentity {
  employeeId: number
  employeeName: string
  role: 'developer' | 'customer' | 'other'
  canViewAll: boolean
  allowedEmployeeNames: string[]
}

export default function App({ identity }: { identity: DashboardLoginIdentity }) {
  const allowedEmployeeNames = new Set(identity.allowedEmployeeNames)
  const visibleDashboardMembers = DASHBOARD_MEMBERS.filter((member) => allowedEmployeeNames.has(member.name))
  const isOtherViewer = identity.role === 'other'
  const [selectedName, setSelectedName] = useState<string>(identity.employeeName)
  const canEditSelectedTargets = canEditDashboardTargets(identity, selectedName)
  const [selectedDashboardDimension, setSelectedDashboardDimension] = useState<Dimension>('publish')
  const [dashboardSorts, setDashboardSorts] = useState<Record<Dimension, SortConfig>>({
    publish: null,
    deal: null,
    payment: null,
  })
  const [customerRosterSorts, setCustomerRosterSorts] = useState<Record<Dimension, SortConfig>>({
    publish: { column: 'currentPerformance', direction: 'desc' },
    deal: { column: 'currentPerformance', direction: 'desc' },
    payment: { column: 'currentPerformance', direction: 'desc' },
  })
  const [customerMemberSorts, setCustomerMemberSorts] = useState<Record<string, SortConfig>>({})
  const [supplementaryDashboardDimensions, setSupplementaryDashboardDimensions] = useState<Record<SupplementaryDashboardKey, Dimension>>({
    customer: 'publish',
    company: 'publish',
    brand: 'publish',
  })
  const [activeSupplementaryDashboard, setActiveSupplementaryDashboard] = useState<SupplementaryDashboardKey>('customer')
  const [wangYueTargetEntityBoard, setWangYueTargetEntityBoard] = useState<'company' | 'brand'>('company')
  const [wangYueTargetManagementActive, setWangYueTargetManagementActive] = useState(false)
  const [targetSplitBoardActive, setTargetSplitBoardActive] = useState(false)
  const [targetSplitImportOpen, setTargetSplitImportOpen] = useState(false)
  const [targetSplitWorkbookImportOpen, setTargetSplitWorkbookImportOpen] = useState(false)
  const [targetSplitWorkbookImportMode, setTargetSplitWorkbookImportMode] = useState<'link' | 'file' | 'image'>('link')
  const [targetSplitWorkbookImportUrl, setTargetSplitWorkbookImportUrl] = useState('')
  const [targetSplitWorkbookImportFile, setTargetSplitWorkbookImportFile] = useState<File | null>(null)
  const [targetSplitWorkbookImportPreview, setTargetSplitWorkbookImportPreview] = useState<TargetSplitWorkbookImportPreview | null>(null)
  const [targetSplitWorkbookImportLoading, setTargetSplitWorkbookImportLoading] = useState(false)
  const [targetSplitWorkbookImportProgress, setTargetSplitWorkbookImportProgress] = useState('')
  const [targetSplitWorkbookImportError, setTargetSplitWorkbookImportError] = useState('')
  const [wangYueTargetEntityDimensions, setWangYueTargetEntityDimensions] = useState<Record<'company' | 'brand', Dimension>>({
    company: 'publish',
    brand: 'publish',
  })
  const [companyOrderModal, setCompanyOrderModal] = useState<CompanyOrderDetailsContext | null>(null)
  const [companyBrandShareContext, setCompanyBrandShareContext] = useState<(CompanyBrandShareContext | BrandCompanyShareContext) | null>(null)
  const [targetManagementSubmissionDetailsContext, setTargetManagementSubmissionDetailsContext] = useState<{
    monthId: number
    employeeName: DashboardCompanyBoardEmployeeName
    companyName: string
    platformName: string
    brandName: string
    count: number
  } | null>(null)
  const [unpublishedSummaries, setUnpublishedSummaries] = useState<Record<string, DashboardUnpublishedOrdersResponse>>({})
  const [unpublishedDetails, setUnpublishedDetails] = useState<DashboardUnpublishedOrdersResponse | null>(null)
  const [unpublishedSelectedMetric, setUnpublishedSelectedMetric] = useState<DashboardUnpublishedMetricKey>('total')
  const [unpublishedPageSize, setUnpublishedPageSize] = useState<UnpublishedPageSize>(50)
  const [unpublishedMonthFilter, setUnpublishedMonthFilter] = useState<number | null>(null)
  const [unpublishedDateFilterMode, setUnpublishedDateFilterMode] = useState<UnpublishedDateFilterMode>('fangpian-month')
  const [unpublishedFilterDraft, setUnpublishedFilterDraft] = useState<DashboardUnpublishedOrderFilters>({})
  const [unpublishedAppliedFilters, setUnpublishedAppliedFilters] = useState<DashboardUnpublishedOrderFilters>({})
  const [unpublishedStatuses, setUnpublishedStatuses] = useState<Record<string, 'idle' | 'loading' | 'loaded' | 'error'>>({})
  const [unpublishedModalEmployeeName, setUnpublishedModalEmployeeName] = useState(selectedName)
  const [unpublishedBoardMonthId, setUnpublishedBoardMonthId] = useState<number>(149)
  const [unpublishedModalOpen, setUnpublishedModalOpen] = useState(false)
  const [unpublishedDetailsLoading, setUnpublishedDetailsLoading] = useState(false)
  const [unpublishedDetailsError, setUnpublishedDetailsError] = useState('')
  const unpublishedSummaryRequestIds = useRef<Record<string, number>>({})
  const unpublishedDetailsRequestId = useRef(0)
  const unpublishedFilterEmployeeRef = useRef(selectedName)
  const unpublishedTableWrapRef = useRef<HTMLDivElement>(null)
  const unpublishedTableRef = useRef<HTMLTableElement>(null)
  const [unpublishedTableScrollMax, setUnpublishedTableScrollMax] = useState(0)
  const [unpublishedTableScrollPosition, setUnpublishedTableScrollPosition] = useState(0)
  const customerTableWrapRef = useRef<HTMLDivElement>(null)
  const customerTableContentRef = useRef<HTMLDivElement>(null)
  const [customerTableScrollMax, setCustomerTableScrollMax] = useState(0)
  const [customerTableScrollPosition, setCustomerTableScrollPosition] = useState(0)
  const companyTableWrapRef = useRef<HTMLDivElement>(null)
  const companyTableContentRef = useRef<HTMLDivElement>(null)
  const [companyTableScrollMax, setCompanyTableScrollMax] = useState(0)
  const [companyTableScrollPosition, setCompanyTableScrollPosition] = useState(0)
  const targetManagementTableWrapRef = useRef<HTMLDivElement>(null)
  const targetManagementTableContentRef = useRef<HTMLDivElement>(null)
  const targetManagementTableRangeRef = useRef<HTMLInputElement>(null)
  const targetManagementTableBottomRangeRef = useRef<HTMLInputElement>(null)
  const [targetManagementTableScrollMax, setTargetManagementTableScrollMax] = useState(0)
  const targetSplitTableWrapRef = useRef<HTMLDivElement>(null)
  const [targetSplitTableScrollMax, setTargetSplitTableScrollMax] = useState(0)
  const [targetSplitTableScrollPosition, setTargetSplitTableScrollPosition] = useState(0)
  const unpublishedStatus = unpublishedStatuses[selectedName] ?? 'idle'
  useEffect(() => {
    const table = unpublishedTableRef.current
    const tableWrap = unpublishedTableWrapRef.current
    if (!table || !tableWrap) return
    const updateScrollWidth = () => {
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      setUnpublishedTableScrollMax(maxScroll)
      setUnpublishedTableScrollPosition(Math.min(tableWrap.scrollLeft, maxScroll))
    }
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(table)
    resizeObserver.observe(tableWrap)
    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [unpublishedDetails?.orders.length, unpublishedModalOpen])
  const refreshUnpublishedSummary = useCallback((employeeName = selectedName, boardMonthId = 149) => {
    const requestId = (unpublishedSummaryRequestIds.current[employeeName] ?? 0) + 1
    unpublishedSummaryRequestIds.current[employeeName] = requestId
    setUnpublishedStatuses((previous) => ({ ...previous, [employeeName]: 'loading' }))
    return getDashboardUnpublishedOrders(1, 50, undefined, 'total', undefined, employeeName, boardMonthId)
      .then((response) => {
        if (unpublishedSummaryRequestIds.current[employeeName] !== requestId) return
        setUnpublishedSummaries((previous) => ({ ...previous, [employeeName]: response }))
        setUnpublishedStatuses((previous) => ({ ...previous, [employeeName]: 'loaded' }))
      })
      .catch(() => {
        if (unpublishedSummaryRequestIds.current[employeeName] !== requestId) return
        setUnpublishedStatuses((previous) => ({ ...previous, [employeeName]: 'error' }))
      })
  }, [selectedName])
  const loadUnpublishedPage = (
    page: number,
    monthId: number | null = unpublishedMonthFilter,
    metricKey: DashboardUnpublishedMetricKey = unpublishedSelectedMetric,
    filters: DashboardUnpublishedOrderFilters = unpublishedAppliedFilters,
    employeeName = unpublishedModalEmployeeName,
    pageSize: number = unpublishedPageSize,
    boardMonthId: number = unpublishedBoardMonthId,
  ) => {
    const requestId = ++unpublishedDetailsRequestId.current
    setUnpublishedDetailsLoading(true)
    setUnpublishedDetailsError('')
    setUnpublishedDetails(null)
    return getDashboardUnpublishedOrders(page, pageSize, monthId ?? undefined, metricKey, filters, employeeName, boardMonthId)
      .then((response) => {
        if (unpublishedDetailsRequestId.current !== requestId) return
        setUnpublishedDetails(response)
        setUnpublishedDetailsLoading(false)
      })
      .catch(() => {
        if (unpublishedDetailsRequestId.current !== requestId) return
        setUnpublishedDetailsLoading(false)
        setUnpublishedDetailsError('天玑未发布订单读取失败，请稍后重试。')
      })
  }
  const syncUnpublishedTableScroll = () => {
    const tableWrap = unpublishedTableWrapRef.current
    if (tableWrap) setUnpublishedTableScrollPosition(tableWrap.scrollLeft)
  }
  const syncCompanyTableScroll = () => {
    const tableWrap = companyTableWrapRef.current
    if (tableWrap) setCompanyTableScrollPosition(tableWrap.scrollLeft)
  }
  const syncTargetManagementTableScroll = () => {
    const tableWrap = targetManagementTableWrapRef.current
    if (!tableWrap) return
    const scrollLeft = tableWrap.scrollLeft
    for (const range of [targetManagementTableRangeRef.current, targetManagementTableBottomRangeRef.current]) {
      if (range) range.value = String(Math.min(scrollLeft, Number(range.max)))
    }
  }
  const scrollTargetManagementTableTo = (scrollLeft: number) => {
    const tableWrap = targetManagementTableWrapRef.current
    if (!tableWrap) return
    tableWrap.scrollLeft = scrollLeft
    syncTargetManagementTableScroll()
  }
  const syncTargetSplitTableScroll = () => {
    const tableWrap = targetSplitTableWrapRef.current
    if (!tableWrap) return
    const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
    tableWrap.style.setProperty('--target-split-scroll-left', `${tableWrap.scrollLeft}px`)
    setTargetSplitTableScrollPosition(Math.min(tableWrap.scrollLeft, maxScroll))
  }
  const scrollTargetSplitTableTo = (scrollLeft: number) => {
    const tableWrap = targetSplitTableWrapRef.current
    if (!tableWrap) return
    tableWrap.scrollLeft = scrollLeft
    tableWrap.style.setProperty('--target-split-scroll-left', `${tableWrap.scrollLeft}px`)
    setTargetSplitTableScrollPosition(scrollLeft)
  }
  const syncWangYueTargetManagementImportTableScroll = () => {
    const tableWrap = wangYueTargetManagementImportTableWrapRef.current
    const range = wangYueTargetManagementImportScrollRangeRef.current
    if (tableWrap && range) range.value = String(Math.min(tableWrap.scrollLeft, Number(range.max)))
  }
  const syncCustomerTableScroll = () => {
    const tableWrap = customerTableWrapRef.current
    if (tableWrap) setCustomerTableScrollPosition(tableWrap.scrollLeft)
  }
  const openCompanyOrderDetails = (
    monthId: number,
    dimension: DashboardOrderMetricDimension,
    metricKey: DashboardCompanyMetricKey,
    companyName?: string,
    brandName?: string,
    filters?: DashboardUnpublishedOrderFilters,
    employeeName: DashboardCompanyBoardEmployeeName = '示例开发01',
  ) => setCompanyOrderModal({ monthId, dimension, metricKey, companyName, brandName, filters, employeeName })
  const openTargetOrderDetails = (
    monthId: number,
    dimension: Dimension,
    metricKey: MetricKey,
    metricLabel: string,
  ) => {
    if (!supportsTargetOrderDetails(selectedName)) return
    const companyMetricKey: DashboardCompanyMetricKey = metricKey === 'outsourcingOrderCount'
      ? 'outsourcing'
      : metricKey
    setCompanyOrderModal({
      monthId,
      dimension,
      metricKey: companyMetricKey,
      employeeName: selectedName as DashboardCompanyBoardEmployeeName,
      metricLabel,
      source: 'target',
    })
  }
  const openWangYueTargetManagementOrderDetails = (
    monthId: number,
    row: WangYueTargetManagementDisplayRow,
    metricKey: DashboardCompanyMetricKey,
    metricLabel: string,
  ) => {
    const filters: DashboardUnpublishedOrderFilters = row.brandName ? { brandNameExact: row.brandName } : {}
    if (row.platform.id !== WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID) {
      filters.platformIdExact = String(row.platform.id)
    }
    setCompanyOrderModal({
      monthId,
      dimension: 'publish',
      metricKey,
      companyName: row.selectedCompanyName,
      filters,
      employeeName: selectedName as DashboardCompanyBoardEmployeeName,
      metricLabel,
      source: 'target',
    })
  }
  const renderUnpublishedFilterInput = (
    key: keyof DashboardUnpublishedOrderFilters,
    placeholder: string,
    type: 'text' | 'date' | 'number' = 'text',
  ) => (
    <input
      type={type}
      value={unpublishedFilterDraft[key] ?? ''}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => setUnpublishedFilterDraft((previous) => ({ ...previous, [key]: event.target.value }))}
    />
  )
  const renderUnpublishedPersonFilter = (
    key: 'reporterName' | 'customerFacingBusinessName' | 'businessName',
    label: string,
  ) => (
    <select
      value={unpublishedFilterDraft[key] ?? ''}
      aria-label={`筛选${label}`}
      onChange={(event) => setUnpublishedFilterDraft((previous) => ({ ...previous, [key]: event.target.value }))}
    >
      <option value="">全部{label}</option>
      {(unpublishedDetails?.filterOptions[key] ?? []).map((option) => (
        <option key={option.value} value={option.value}>{option.value}（{option.orderCount}单）</option>
      ))}
    </select>
  )
  const hasAppliedUnpublishedFilters = Object.values(unpublishedAppliedFilters).some((value) => value?.trim())
  const applyUnpublishedFilters = () => {
    const filters = Object.fromEntries(
      Object.entries(unpublishedFilterDraft)
        .filter(([, value]) => Boolean(value?.trim()))
        .map(([key, value]) => [key, value?.trim() ?? '']),
    ) as DashboardUnpublishedOrderFilters
    setUnpublishedAppliedFilters(filters)
    loadUnpublishedPage(1, unpublishedMonthFilter, unpublishedSelectedMetric, filters)
  }
  const clearUnpublishedFilters = () => {
    setUnpublishedFilterDraft({})
    setUnpublishedAppliedFilters({})
    loadUnpublishedPage(1, unpublishedMonthFilter, unpublishedSelectedMetric, {})
  }
  const withoutUnpublishedDateRange = (filters: DashboardUnpublishedOrderFilters) => {
    const next = { ...filters }
    delete next.orderDateFrom
    delete next.orderDateTo
    return next
  }
  const toggleUnpublishedDateFilterMode = () => {
    const nextMode = unpublishedDateFilterMode === 'fangpian-month' ? 'date-range' : 'fangpian-month'
    const filters = withoutUnpublishedDateRange(unpublishedAppliedFilters)
    setUnpublishedDateFilterMode(nextMode)
    setUnpublishedFilterDraft(withoutUnpublishedDateRange(unpublishedFilterDraft))
    setUnpublishedAppliedFilters(filters)
    setUnpublishedMonthFilter(null)
    loadUnpublishedPage(1, null, unpublishedSelectedMetric, filters)
  }
  const openUnpublishedDetails = (employeeName: string, metricKey: DashboardUnpublishedMetricKey, boardMonthId: number) => {
    setUnpublishedModalEmployeeName(employeeName)
    setUnpublishedSelectedMetric(metricKey)
    setUnpublishedModalOpen(true)
    setUnpublishedBoardMonthId(boardMonthId)
    setUnpublishedMonthFilter(null)
    const employeeChanged = unpublishedFilterEmployeeRef.current !== employeeName
    unpublishedFilterEmployeeRef.current = employeeName
    const filters = withoutUnpublishedDateRange(employeeChanged ? {} : unpublishedAppliedFilters)
    setUnpublishedDateFilterMode('fangpian-month')
    setUnpublishedFilterDraft(withoutUnpublishedDateRange(employeeChanged ? {} : unpublishedFilterDraft))
    setUnpublishedAppliedFilters(filters)
    loadUnpublishedPage(1, null, metricKey, filters, employeeName, unpublishedPageSize, boardMonthId)
  }
  const currentFangpianMonthId = getCurrentDashboardMonthId()
  const initialMonthId = currentFangpianMonthId ?? 149
  const initialTargetSplitMonthId = TARGET_SPLIT_MONTH_IDS.includes((initialMonthId + 1) as TargetSplitMonthId)
    ? (initialMonthId + 1) as TargetSplitMonthId
    : TARGET_SPLIT_MONTH_IDS[TARGET_SPLIT_MONTH_IDS.length - 1]
  const [targetSplitMonth, setTargetSplitMonth] = useState<TargetSplitMonthId>(initialTargetSplitMonthId)
  const targetSplitOwnerName = (TARGET_SPLIT_OWNER_NAMES as readonly string[]).includes(selectedName) ? selectedName : ''
  const isMuyuanTeamTargetSplit = targetSplitOwnerName === '示例开发01'
  const isMuyuanNovemberTargetSplit = targetSplitOwnerName === '示例开发01' && targetSplitMonth === 150
  const targetSplitEmployeeNames: DashboardCompanyBoardEmployeeName[] = targetSplitOwnerName === '示例开发01'
    ? [...TARGET_MANAGEMENT_BOARD_EMPLOYEES]
    : targetSplitOwnerName ? [targetSplitOwnerName as DashboardCompanyBoardEmployeeName] : []
  const [targetSplitPlansByOwner, setTargetSplitPlansByOwner] = useState<Record<string, TargetSplitPlans>>(() =>
    Object.fromEntries(TARGET_SPLIT_OWNER_NAMES.map((ownerName) => [ownerName, readTargetSplitPlans(ownerName)])))
  const targetSplitPlansByOwnerRef = useRef(targetSplitPlansByOwner)
  targetSplitPlansByOwnerRef.current = targetSplitPlansByOwner
  const [targetSplitCloudSyncStatus, setTargetSplitCloudSyncStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle')
  const [targetSplitCloudSyncError, setTargetSplitCloudSyncError] = useState('')
  const [targetSplitCloudReadyKey, setTargetSplitCloudReadyKey] = useState('')
  const [targetSplitCloudRetry, setTargetSplitCloudRetry] = useState(0)
  const targetSplitCloudSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const targetSplitCloudSyncKey = targetSplitOwnerName && targetSplitMonth === 150
    ? `${targetSplitOwnerName}:150`
    : ''
  const targetSplitCloudSyncKeyRef = useRef(targetSplitCloudSyncKey)
  targetSplitCloudSyncKeyRef.current = targetSplitCloudSyncKey
  const targetSplitCloudPlan = targetSplitOwnerName
    ? targetSplitPlansByOwner[targetSplitOwnerName]?.[targetSplitMonth]
    : undefined
  const targetSplitPlans = (targetSplitOwnerName ? targetSplitPlansByOwner[targetSplitOwnerName] : undefined) ?? {}
  const setTargetSplitPlans = (update: TargetSplitPlans | ((current: TargetSplitPlans) => TargetSplitPlans)) => {
    if (!targetSplitOwnerName) return
    setTargetSplitPlansByOwner((current) => ({
      ...current,
      [targetSplitOwnerName]: typeof update === 'function'
        ? update(current[targetSplitOwnerName] ?? {})
        : update,
    }))
  }
  const targetSplitSnapshotCacheRef = useRef<Record<string, TargetSplitSnapshotCache>>({})
  const [targetSplitGenerating, setTargetSplitGenerating] = useState(false)
  const [targetSplitGenerationProgress, setTargetSplitGenerationProgress] = useState('')
  const [targetSplitGenerationError, setTargetSplitGenerationError] = useState('')
  const [targetSplitLogicCollapsed, setTargetSplitLogicCollapsed] = useState(true)
  const [muyuanNovemberDifferenceExpanded, setMuyuanNovemberDifferenceExpanded] = useState(false)
  const [targetSplitUnallocatedExpanded, setTargetSplitUnallocatedExpanded] = useState(false)
  const [targetSplitBoardView, setTargetSplitBoardView] = useState<'logic'>('logic')
  const targetSplitActiveBoardView = isMuyuanTeamTargetSplit ? 'logic' : targetSplitBoardView
  const [targetSplitViewMode, setTargetSplitViewMode] = useState<'summary' | 'details'>('summary')
  const [expandedTargetSplitRationales, setExpandedTargetSplitRationales] = useState<Set<string>>(() => new Set())
  const [targetSplitEditingCell, setTargetSplitEditingCell] = useState<{ rowId: string; field: TargetSplitEditableField } | null>(null)
  const [targetSplitSummaryEditingCell, setTargetSplitSummaryEditingCell] = useState<string | null>(null)
  const [targetSplitImportError, setTargetSplitImportError] = useState('')
  const [targetSplitImportNotice, setTargetSplitImportNotice] = useState('')
  const [targetSplitImportLoading, setTargetSplitImportLoading] = useState(false)
  const [targetSplitBoardImportLoading, setTargetSplitBoardImportLoading] = useState(false)
  const [targetSplitBoardImportFeedback, setTargetSplitBoardImportFeedback] = useState<{ status: 'loading' | 'success' | 'error'; message: string } | null>(null)
  const [targetSplitImportEmployeeName, setTargetSplitImportEmployeeName] = useState<string | null>(null)
  const enqueueTargetSplitCloudSave = (ownerName: string, monthId: TargetSplitMonthId, plan: TargetSplitPlan) => {
    const savePromise = targetSplitCloudSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => { await saveTargetSplitPlan(ownerName, monthId, plan) })
    targetSplitCloudSaveQueueRef.current = savePromise
    return savePromise
  }
  const targetSplitPlan = targetSplitPlans[targetSplitMonth] ?? createEmptyTargetSplitPlan()
  const hasTargetSplitPlanData = (employeeName: string, monthId: TargetSplitMonthId) => {
    const plan = targetSplitPlansByOwner[employeeName]?.[monthId]
    return Boolean(plan && (plan.generatedAt || plan.rows.length > 0 || Number(plan.totalTarget) > 0))
  }
  const targetSplitBoardHasAnyPlan = Boolean(targetSplitOwnerName) && (
    supportsTargetSplitBoard(targetSplitOwnerName)
    || Object.values(targetSplitPlansByOwner[targetSplitOwnerName] ?? {}).some((plan) =>
      Boolean(plan && (plan.generatedAt || plan.rows.length > 0 || Number(plan.totalTarget) > 0)),
    )
  )
  const targetSplitBoardAvailable = Boolean(targetSplitOwnerName)
    && (supportsTargetSplitBoard(targetSplitOwnerName) || hasTargetSplitPlanData(targetSplitOwnerName, targetSplitMonth))
  const targetSplitBoardIsImportedOnly = targetSplitBoardAvailable && !supportsTargetSplitBoard(targetSplitOwnerName)
  const toggleTargetSplitRationale = (key: string) => {
    setExpandedTargetSplitRationales((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const updateTargetSplitPlan = (update: (current: TargetSplitPlan) => TargetSplitPlan) => {
    setTargetSplitPlans((current) => ({
      ...current,
      [targetSplitMonth]: update(current[targetSplitMonth] ?? createEmptyTargetSplitPlan()),
    }))
  }
  useEffect(() => {
    if (!isPersonalTargetSplitOwner(targetSplitOwnerName) || targetSplitMonth !== 150) return
    const currentPlan = targetSplitPlansByOwner[targetSplitOwnerName]?.[targetSplitMonth]
    if (!currentPlan) return
    const keepRow = (row: TargetSplitRow) => shouldKeepTargetSplitRow(row, targetSplitOwnerName)
    const rows = currentPlan.rows.filter(keepRow)
    const generatedRows = currentPlan.generatedRows.filter(keepRow)
    if (rows.length === currentPlan.rows.length && generatedRows.length === currentPlan.generatedRows.length) return
    setTargetSplitPlansByOwner((current) => {
      const ownerPlans = current[targetSplitOwnerName]
      const plan = ownerPlans?.[targetSplitMonth]
      if (!plan) return current
      const keepCurrentRow = (row: TargetSplitRow) => shouldKeepTargetSplitRow(row, targetSplitOwnerName)
      const nextRows = plan.rows.filter(keepCurrentRow)
      const nextGeneratedRows = plan.generatedRows.filter(keepCurrentRow)
      if (nextRows.length === plan.rows.length && nextGeneratedRows.length === plan.generatedRows.length) return current
      return {
        ...current,
        [targetSplitOwnerName]: {
          ...ownerPlans,
          [targetSplitMonth]: { ...plan, rows: nextRows, generatedRows: nextGeneratedRows },
        },
      }
    })
  }, [targetSplitOwnerName, targetSplitMonth, targetSplitPlansByOwner])
  useEffect(() => {
    try {
      for (const [ownerName, plans] of Object.entries(targetSplitPlansByOwner)) {
        localStorage.setItem(getTargetSplitStorageKey(ownerName), JSON.stringify(plans))
      }
    } catch {
      setTargetSplitGenerationError('浏览器本地存储空间不足，拆分草稿可能无法保存。')
    }
  }, [targetSplitPlansByOwner])
  useEffect(() => {
    if (!targetSplitBoardActive || !targetSplitCloudSyncKey) {
      setTargetSplitCloudReadyKey('')
      setTargetSplitCloudSyncStatus('idle')
      setTargetSplitCloudSyncError('')
      return
    }

    let cancelled = false
    const [ownerName, monthIdText] = targetSplitCloudSyncKey.split(':')
    const monthId = Number(monthIdText) as TargetSplitMonthId
    const localPlanAtRequest = targetSplitPlansByOwnerRef.current[ownerName]?.[monthId]
    const localPlanSignatureAtRequest = JSON.stringify(localPlanAtRequest ?? null)
    setTargetSplitCloudReadyKey('')
    setTargetSplitCloudSyncStatus('loading')
    setTargetSplitCloudSyncError('')

    void getTargetSplitPlan(ownerName, monthId).then((response) => {
      if (cancelled) return
      const latestLocalPlan = targetSplitPlansByOwnerRef.current[ownerName]?.[monthId]
      const localChangedWhileLoading = JSON.stringify(latestLocalPlan ?? null) !== localPlanSignatureAtRequest
      if (response.plan && (!localChangedWhileLoading || !hasPersistableTargetSplitPlan(latestLocalPlan))) {
        if (!isTargetSplitPlan(response.plan)) throw new Error('云端计划格式异常；本机草稿已保留。')
        const storedCloudPlan = ownerName === '示例开发01' && monthId === 150
          ? removeTargetSplitOutsourcingOrderCount(response.plan as TargetSplitPlan)
          : response.plan as TargetSplitPlan
        const cloudPlan: TargetSplitPlan = {
          ...storedCloudPlan,
          importedCustomerTargetNames: Array.isArray(storedCloudPlan.importedCustomerTargetNames)
            ? storedCloudPlan.importedCustomerTargetNames.map(String)
            : [],
        }
        setTargetSplitPlansByOwner((current) => ({
          ...current,
          [ownerName]: { ...(current[ownerName] ?? {}), [monthId]: cloudPlan },
        }))
        setTargetSplitCloudSyncStatus('saved')
      } else {
        setTargetSplitCloudSyncStatus('idle')
      }
      setTargetSplitCloudReadyKey(targetSplitCloudSyncKey)
    }).catch((error) => {
      if (cancelled) return
      setTargetSplitCloudSyncStatus('error')
      setTargetSplitCloudSyncError(error instanceof Error ? error.message : '读取云端计划失败，已保留本机草稿。')
    })

    return () => { cancelled = true }
  }, [targetSplitBoardActive, targetSplitCloudSyncKey, targetSplitCloudRetry])
  useEffect(() => {
    if (!targetSplitBoardActive
      || !targetSplitCloudSyncKey
      || targetSplitCloudReadyKey !== targetSplitCloudSyncKey
      || !hasPersistableTargetSplitPlan(targetSplitCloudPlan)) return

    let cancelled = false
    const [ownerName, monthIdText] = targetSplitCloudSyncKey.split(':')
    const monthId = Number(monthIdText) as TargetSplitMonthId
    const planSnapshot = JSON.parse(JSON.stringify(targetSplitCloudPlan)) as TargetSplitPlan
    const timeoutId = window.setTimeout(() => {
      setTargetSplitCloudSyncStatus('saving')
      setTargetSplitCloudSyncError('')
      const savePromise = enqueueTargetSplitCloudSave(ownerName, monthId, planSnapshot)
      void savePromise.then(() => {
        if (!cancelled) setTargetSplitCloudSyncStatus('saved')
      }).catch((error) => {
        if (!cancelled) {
          setTargetSplitCloudSyncStatus('error')
          setTargetSplitCloudSyncError(error instanceof Error ? error.message : '保存到云端失败，本机草稿仍保留。')
        }
      })
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [targetSplitBoardActive, targetSplitCloudReadyKey, targetSplitCloudSyncKey, targetSplitCloudPlan])
  const [targetManagementSubmissionMonthOptions, setTargetManagementSubmissionMonthOptions] = useState(getTargetManagementSubmissionMonthOptions)
  useEffect(() => {
    const updateOptions = () => {
      const nextOptions = getTargetManagementSubmissionMonthOptions()
      setTargetManagementSubmissionMonthOptions((current) =>
        current.length === nextOptions.length
          && current.every((option, index) => option.monthId === nextOptions[index]?.monthId)
          ? current
          : nextOptions,
      )
    }
    const intervalId = window.setInterval(updateOptions, 60 * 1000)
    window.addEventListener('focus', updateOptions)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', updateOptions)
    }
  }, [])
  const [allDashboardMonthId, setAllDashboardMonthId] = useState<DashboardMonthId>(initialMonthId)
  const [customerDashboardMonth, setCustomerDashboardMonth] = useState<DashboardMonthId>(initialMonthId)
  const unpublishedSummary = unpublishedSummaries[selectedName]?.boardMonthId === customerDashboardMonth ? unpublishedSummaries[selectedName] : null
  const unpublishedModalSummary = unpublishedSummaries[unpublishedModalEmployeeName]?.boardMonthId === unpublishedBoardMonthId ? unpublishedSummaries[unpublishedModalEmployeeName] : null
  const [wangYueTargetManagementMonth, setWangYueTargetManagementMonth] = useState<TargetManagementMonthId>(initialMonthId)
  const [wangYueTargetManagementDataOwner, setWangYueTargetManagementDataOwner] = useState(selectedName)
  const [wangYueTargetManagementCompanySlots, setWangYueTargetManagementCompanySlots] = useState<string[]>(() =>
    readWangYueTargetManagementLayouts(selectedName)[initialMonthId]?.companySlots
      ?? Array.from({ length: WANGYUE_TARGET_MANAGEMENT_DEFAULT_COMPANY_COUNT }, () => ''),
  )
  const [activeWangYueTargetManagementCompanySearchSlot, setActiveWangYueTargetManagementCompanySearchSlot] = useState<number | null>(null)
  const [wangYueTargetManagementCompanySearch, setWangYueTargetManagementCompanySearch] = useState('')
  const [wangYueTargetManagementCompanySearchSource, setWangYueTargetManagementCompanySearchSource] = useState<'deal' | 'catalog'>('deal')
  const [wangYueTargetManagementCompanyOpenRequest, setWangYueTargetManagementCompanyOpenRequest] = useState<{ slotIndex: number; token: number; source: 'deal' | 'catalog' } | null>(null)
  const [wangYueTargetManagementCompanyLookbackMonths, setWangYueTargetManagementCompanyLookbackMonths] = useState(3)
  const [wangYueTargetManagementCompanyOptions, setWangYueTargetManagementCompanyOptions] = useState<DashboardTargetManagementCompanyOptionsResponse['companies']>([])
  const [wangYueTargetManagementCompanyOptionsStatus, setWangYueTargetManagementCompanyOptionsStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const wangYueTargetManagementCompanyOptionsQuery = wangYueTargetManagementCompanySearchSource === 'catalog'
    ? wangYueTargetManagementCompanySearch.trim()
    : ''
  const wangYueTargetManagementDealCompanyOptionsCacheRef = useRef(new Map<string, {
    expiresAt: number
    companies: DashboardTargetManagementCompanyOptionsResponse['companies']
  }>())
  const [wangYueTargetManagementBrandFilters, setWangYueTargetManagementBrandFilters] = useState<Record<string, string>>(() =>
    readWangYueTargetManagementLayouts(selectedName)[initialMonthId]?.brandFilters ?? {},
  )
  const [wangYueTargetManagementSubBrandFilters, setWangYueTargetManagementSubBrandFilters] = useState<Record<string, string>>(() =>
    readWangYueTargetManagementLayouts(selectedName)[initialMonthId]?.subBrandFilters ?? {},
  )
  const [wangYueTargetManagementBrandResetTokens, setWangYueTargetManagementBrandResetTokens] = useState<Record<string, number>>({})
  const [wangYueTargetManagementBrandSlotCounts, setWangYueTargetManagementBrandSlotCounts] = useState<Record<string, number>>(() =>
    readWangYueTargetManagementLayouts(selectedName)[initialMonthId]?.brandSlotCounts ?? {},
  )
  const [wangYueTargetManagementProductLines, setWangYueTargetManagementProductLines] = useState<Record<string, WangYueTargetManagementProductLine[]>>(() =>
    readWangYueTargetManagementLayouts(selectedName)[initialMonthId]?.productLines ?? {},
  )
  const [expandedWangYueTargetManagementProductLineActions, setExpandedWangYueTargetManagementProductLineActions] = useState<string | null>(null)
  const [editingWangYueTargetManagementProductLineId, setEditingWangYueTargetManagementProductLineId] = useState<string | null>(null)
  const [expandedWangYueTargetManagementContactActions, setExpandedWangYueTargetManagementContactActions] = useState<string | null>(null)
  const [editingWangYueTargetManagementContactGoalKey, setEditingWangYueTargetManagementContactGoalKey] = useState<string | null>(null)
  const [editingWangYueTargetManagementMetricGoalKey, setEditingWangYueTargetManagementMetricGoalKey] = useState<string | null>(null)
  const [wangYueTargetManagementBrandCatalog, setWangYueTargetManagementBrandCatalog] = useState<DashboardTargetManagementBrandOptionsResponse['brands']>([])
  const [wangYueTargetManagementBrandCatalogStatus, setWangYueTargetManagementBrandCatalogStatus] = useState<'idle' | 'loading' | 'loaded' | 'empty' | 'error'>('idle')
  const wangYueTargetManagementBrandCatalogRequestsRef = useRef(false)
  const loadTargetManagementBrandCatalog = useCallback((companyName: string) => {
    const normalizedCompanyName = companyName.trim()
    if (!normalizedCompanyName) return
    if (wangYueTargetManagementBrandCatalogStatus === 'loaded'
      || wangYueTargetManagementBrandCatalogStatus === 'loading'
      || wangYueTargetManagementBrandCatalogRequestsRef.current) return

    wangYueTargetManagementBrandCatalogRequestsRef.current = true
    setWangYueTargetManagementBrandCatalogStatus('loading')
    getTargetManagementBrandOptions(normalizedCompanyName)
      .then((response) => {
        setWangYueTargetManagementBrandCatalog(response.brands)
        setWangYueTargetManagementBrandCatalogStatus(response.snapshotUpdatedAt && response.brands.length > 0 ? 'loaded' : 'empty')
      })
      .catch(() => setWangYueTargetManagementBrandCatalogStatus('error'))
      .finally(() => {
        wangYueTargetManagementBrandCatalogRequestsRef.current = false
      })
  }, [wangYueTargetManagementBrandCatalogStatus])
  const [wangYueTargetManagementBrandOpenRequest, setWangYueTargetManagementBrandOpenRequest] = useState<{ key: string; token: number } | null>(null)
  const [wangYueTargetManagementActualsByMonth, setWangYueTargetManagementActualsByMonth] = useState<Record<string, DashboardTargetManagementActualsResponse>>({})
  const [wangYueTargetManagementActualsStatusByMonth, setWangYueTargetManagementActualsStatusByMonth] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({})
  const [targetManagementSubmissionSnapshots, setTargetManagementSubmissionSnapshots] = useState<Record<string, DashboardTargetManagementSubmissionSnapshotResponse>>({})
  const [targetManagementSubmissionSnapshotStatuses, setTargetManagementSubmissionSnapshotStatuses] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({})
  const loadTargetManagementSubmissionSnapshot = useCallback((employeeName: DashboardCompanyBoardEmployeeName, monthId: number) => {
    const key = JSON.stringify([employeeName, monthId])
    setTargetManagementSubmissionSnapshotStatuses((current) => ({
      ...current,
      [key]: current[key] === 'loaded' ? 'loaded' : 'loading',
    }))
    void getTargetManagementSubmissionSnapshot(monthId, employeeName)
      .then((response) => {
        setTargetManagementSubmissionSnapshots((current) => ({ ...current, [key]: response }))
        setTargetManagementSubmissionSnapshotStatuses((current) => ({ ...current, [key]: 'loaded' }))
      })
      .catch(() => {
        setTargetManagementSubmissionSnapshotStatuses((current) => ({
          ...current,
          [key]: current[key] === 'loaded' ? 'loaded' : 'error',
        }))
      })
  }, [])
  const wangYueTargetManagementActualsRequestsRef = useRef(new Set<string>())
  const wangYueTargetManagementPostImportRefreshRequestsRef = useRef(new Set<string>())
  const [wangYueTargetManagementGoals, setWangYueTargetManagementGoals] = useState<WangYueTargetManagementGoals>(() => readTargetManagementGoals(selectedName))
  const [businessReport, setBusinessReport] = useState<{
    employeeName: DashboardCompanyBoardEmployeeName
    data: BusinessReportData
    goals: WangYueTargetManagementGoals
    amountUnit: 'wan' | 'yuan'
  } | null>(null)
  const [businessReportLoading, setBusinessReportLoading] = useState(false)

  const generateBusinessReport = async (employeeName: DashboardCompanyBoardEmployeeName, monthId: DashboardMonthId) => {
    if (!isTargetManagementBoardEmployee(employeeName) || businessReportLoading) return
    setBusinessReportLoading(true)
    const monthIndex = DASHBOARD_MONTH_IDS.indexOf(monthId)
    const previousMonthId = monthIndex > 0 ? DASHBOARD_MONTH_IDS[monthIndex - 1] : null
    const snapshotErrors: string[] = []
    const reportGoals = wangYueTargetManagementDataOwner === employeeName
      ? wangYueTargetManagementGoals
      : readTargetManagementGoals(employeeName)
    const reportAmountUnit = wangYueTargetManagementAmountDisplay.unit
    const readSnapshot = <T,>(label: string, request: Promise<T>) =>
      readOptionalReportSnapshot(request, label, snapshotErrors)
    const readPrevious = <T,>(label: string, load: (month: number) => Promise<T>) =>
      previousMonthId === null
        ? Promise.resolve(null)
        : readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[previousMonthId].label} ${label}`, load(previousMonthId))
    try {
      const [
        companyPublishCurrent,
        companyPublishPrevious,
        companyDealCurrent,
        companyDealPrevious,
        brandPublishCurrent,
        brandPublishPrevious,
        brandDealCurrent,
        brandDealPrevious,
        companyBrandPublishCurrent,
        companyBrandPublishPrevious,
        companyBrandDealCurrent,
        companyBrandDealPrevious,
        submissionCurrent,
        submissionPrevious,
        dealBreakdownCurrent,
        dealBreakdownPrevious,
      ] = await Promise.all([
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}公司发布`, getDashboardCompanyPerformance(monthId, 'publish', employeeName)),
        readPrevious(`${employeeName}公司发布`, (previousMonth) => getDashboardCompanyPerformance(previousMonth, 'publish', employeeName)),
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}公司成单`, getDashboardCompanyPerformance(monthId, 'deal', employeeName)),
        readPrevious(`${employeeName}公司成单`, (previousMonth) => getDashboardCompanyPerformance(previousMonth, 'deal', employeeName)),
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}品牌发布`, getDashboardBrandPerformance(monthId, 'publish', employeeName)),
        readPrevious(`${employeeName}品牌发布`, (previousMonth) => getDashboardBrandPerformance(previousMonth, 'publish', employeeName)),
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}品牌成单`, getDashboardBrandPerformance(monthId, 'deal', employeeName)),
        readPrevious(`${employeeName}品牌成单`, (previousMonth) => getDashboardBrandPerformance(previousMonth, 'deal', employeeName)),
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}公司品牌发布`, getDashboardCompanyBrandPerformance(monthId, 'publish', employeeName)),
        readPrevious(`${employeeName}公司品牌发布`, (previousMonth) => getDashboardCompanyBrandPerformance(previousMonth, 'publish', employeeName)),
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}公司品牌成单`, getDashboardCompanyBrandPerformance(monthId, 'deal', employeeName)),
        readPrevious(`${employeeName}公司品牌成单`, (previousMonth) => getDashboardCompanyBrandPerformance(previousMonth, 'deal', employeeName)),
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}做表数量`, getTargetManagementSubmissionSnapshot(monthId, employeeName)),
        readPrevious(`${employeeName}做表数量`, (previousMonth) => getTargetManagementSubmissionSnapshot(previousMonth, employeeName)),
        readSnapshot(`${DASHBOARD_FANGPIAN_PERIODS[monthId].label} ${employeeName}平台与商务助理成单拆分`, getDashboardCompanyPerformanceBreakdown(monthId, employeeName)),
        readPrevious(`${employeeName}平台与商务助理成单拆分`, (previousMonth) => getDashboardCompanyPerformanceBreakdown(previousMonth, employeeName)),
      ])
      setBusinessReport({
        employeeName,
        goals: reportGoals,
        amountUnit: reportAmountUnit,
        data: {
          monthId,
          previousMonthId,
          companyPublishCurrent,
          companyPublishPrevious,
          companyDealCurrent,
          companyDealPrevious,
          brandPublishCurrent,
          brandPublishPrevious,
          brandDealCurrent,
          brandDealPrevious,
          companyBrandPublishCurrent,
          companyBrandPublishPrevious,
          companyBrandDealCurrent,
          companyBrandDealPrevious,
          submissionCurrent,
          submissionPrevious,
          dealBreakdownCurrent,
          dealBreakdownPrevious,
          snapshotErrors: [...new Set(snapshotErrors)],
        },
      })
    } finally {
      setBusinessReportLoading(false)
    }
  }

  useEffect(() => {
    if (wangYueTargetManagementDataOwner === selectedName) return
    const savedLayout = readWangYueTargetManagementLayouts(selectedName)[wangYueTargetManagementMonth]
    setWangYueTargetManagementCompanySlots(savedLayout?.companySlots
      ?? Array.from({ length: WANGYUE_TARGET_MANAGEMENT_DEFAULT_COMPANY_COUNT }, () => ''))
    setWangYueTargetManagementBrandFilters(savedLayout?.brandFilters ?? {})
    setWangYueTargetManagementSubBrandFilters(savedLayout?.subBrandFilters ?? {})
    setWangYueTargetManagementBrandSlotCounts(savedLayout?.brandSlotCounts ?? {})
    setWangYueTargetManagementProductLines(savedLayout?.productLines ?? {})
    setWangYueTargetManagementBrandResetTokens({})
    setWangYueTargetManagementGoals(readTargetManagementGoals(selectedName))
    setActiveWangYueTargetManagementCompanySearchSlot(null)
    setWangYueTargetManagementCompanySearch('')
    setWangYueTargetManagementCompanySearchSource('deal')
    setWangYueTargetManagementCompanyOptions([])
    setWangYueTargetManagementCompanyOptionsStatus('idle')
    setWangYueTargetManagementCompanyOpenRequest(null)
    setWangYueTargetManagementBrandOpenRequest(null)
    setExpandedWangYueTargetManagementProductLineActions(null)
    setEditingWangYueTargetManagementProductLineId(null)
    setExpandedWangYueTargetManagementContactActions(null)
    setEditingWangYueTargetManagementContactGoalKey(null)
    setEditingWangYueTargetManagementMetricGoalKey(null)
    setWangYueTargetManagementImportOpen(false)
    setTargetManagementSubmissionDetailsContext(null)
    setCompanyOrderModal(null)
    setWangYueTargetManagementDataOwner(selectedName)
  }, [selectedName, wangYueTargetManagementDataOwner, wangYueTargetManagementMonth])
  const hasCurrentTargetManagementActualTargets = hasWangYueTargetManagementActualTargets(
    wangYueTargetManagementGoals,
    wangYueTargetManagementMonth,
  )
  const targetManagementBoardIsActive = wangYueTargetManagementActive
    && (isOtherViewer || isTargetManagementBoardEmployee(selectedName))
    && wangYueTargetManagementDataOwner === selectedName
  const [wangYueTargetManagementImportOpen, setWangYueTargetManagementImportOpen] = useState(false)
  const [wangYueTargetManagementImportMode, setWangYueTargetManagementImportMode] = useState<'link' | 'file'>('link')
  const [wangYueTargetManagementImportUrl, setWangYueTargetManagementImportUrl] = useState('')
  const [wangYueTargetManagementImportFile, setWangYueTargetManagementImportFile] = useState<File | null>(null)
  const [wangYueTargetManagementImportLoading, setWangYueTargetManagementImportLoading] = useState(false)
  const [wangYueTargetManagementImportProgress, setWangYueTargetManagementImportProgress] = useState('')
  const [wangYueTargetManagementImportError, setWangYueTargetManagementImportError] = useState('')
  const [wangYueTargetManagementImportPreview, setWangYueTargetManagementImportPreview] = useState<DashboardTargetManagementImportPreviewResponse | null>(null)
  const [wangYueTargetManagementImportNotice, setWangYueTargetManagementImportNotice] = useState('')
  const [wangYueTargetManagementImportChatInput, setWangYueTargetManagementImportChatInput] = useState('')
  const [wangYueTargetManagementImportChatMessages, setWangYueTargetManagementImportChatMessages] = useState<DashboardTargetManagementImportChatMessage[]>([TARGET_MANAGEMENT_IMPORT_WELCOME])
  const wangYueTargetManagementImportScrollRangeRef = useRef<HTMLInputElement>(null)
  const wangYueTargetManagementImportTableWrapRef = useRef<HTMLDivElement>(null)
  const wangYueTargetManagementImportTableRef = useRef<HTMLTableElement>(null)
  const [wangYueTargetManagementImportScrollMax, setWangYueTargetManagementImportScrollMax] = useState(0)

  useEffect(() => {
    const table = wangYueTargetManagementImportTableRef.current
    const tableWrap = wangYueTargetManagementImportTableWrapRef.current
    if (!table || !tableWrap) {
      setWangYueTargetManagementImportScrollMax(0)
      return
    }
    const updateScrollWidth = () => {
      setWangYueTargetManagementImportScrollMax(Math.max(0, table.scrollWidth - tableWrap.clientWidth))
    }
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(table)
    resizeObserver.observe(tableWrap)
    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [wangYueTargetManagementImportPreview])

  const loadWangYueTargetManagementImportPreview = async () => {
    setWangYueTargetManagementImportLoading(true)
    setWangYueTargetManagementImportError('')
    setWangYueTargetManagementImportPreview(null)
    setWangYueTargetManagementImportChatInput('')
    setWangYueTargetManagementImportChatMessages([TARGET_MANAGEMENT_IMPORT_WELCOME])
    setWangYueTargetManagementImportProgress('正在提交后台读取任务…')
    try {
      const response = await previewWangYueTargetManagementImport(
        wangYueTargetManagementImportUrl.trim(),
        selectedName as DashboardCompanyBoardEmployeeName,
        setWangYueTargetManagementImportProgress,
      )
      setWangYueTargetManagementImportPreview({
        ...response,
        rows: sortWangYueTargetManagementImportRows(response.rows),
      })
    } catch (error) {
      setWangYueTargetManagementImportError(error instanceof Error ? error.message : '读取企微表格失败')
    } finally {
      setWangYueTargetManagementImportLoading(false)
      setWangYueTargetManagementImportProgress('')
    }
  }

  const loadWangYueTargetManagementImportFilePreview = async () => {
    if (!wangYueTargetManagementImportFile) return
    setWangYueTargetManagementImportLoading(true)
    setWangYueTargetManagementImportError('')
    setWangYueTargetManagementImportPreview(null)
    setWangYueTargetManagementImportChatInput('')
    setWangYueTargetManagementImportChatMessages([TARGET_MANAGEMENT_IMPORT_WELCOME])
    setWangYueTargetManagementImportProgress('正在提交后台读取任务…')
    try {
      const response = await previewWangYueTargetManagementFileImport(
        wangYueTargetManagementImportFile,
        wangYueTargetManagementMonth,
        selectedName as DashboardCompanyBoardEmployeeName,
        setWangYueTargetManagementImportProgress,
      )
      setWangYueTargetManagementImportPreview({
        ...response,
        rows: sortWangYueTargetManagementImportRows(response.rows),
      })
    } catch (error) {
      setWangYueTargetManagementImportError(error instanceof Error ? error.message : '读取Excel文件失败')
    } finally {
      setWangYueTargetManagementImportLoading(false)
      setWangYueTargetManagementImportProgress('')
    }
  }

  const reviseWangYueTargetManagementImport = async () => {
    const preview = wangYueTargetManagementImportPreview
    const instruction = wangYueTargetManagementImportChatInput.trim()
    if (!preview || !instruction || wangYueTargetManagementImportLoading) return
    const userMessage: DashboardTargetManagementImportChatMessage = { role: 'user', content: instruction }
    setWangYueTargetManagementImportChatInput('')
    setWangYueTargetManagementImportChatMessages((current) => [...current, userMessage])
    setWangYueTargetManagementImportLoading(true)
    setWangYueTargetManagementImportProgress('正在理解诉求并更新导入预览…')
    try {
      const response = await reviseWangYueTargetManagementImportPreview(
        preview,
        instruction,
        wangYueTargetManagementImportChatMessages.slice(-8),
        selectedName as DashboardCompanyBoardEmployeeName,
        setWangYueTargetManagementImportProgress,
      )
      setWangYueTargetManagementImportPreview({
        ...response.preview,
        rows: sortWangYueTargetManagementImportRows(response.preview.rows),
      })
      setWangYueTargetManagementImportChatMessages((current) => [
        ...current,
        { role: 'assistant', content: response.reply },
      ].slice(-24))
    } catch (error) {
      const message = error instanceof Error ? error.message : '诉求处理失败，请重试'
      setWangYueTargetManagementImportChatMessages((current) => [
        ...current,
        { role: 'assistant', content: `暂时无法调整预览：${message}` },
      ].slice(-24))
    } finally {
      setWangYueTargetManagementImportLoading(false)
      setWangYueTargetManagementImportProgress('')
    }
  }

  const refreshImportedTargetManagementActuals = (monthId: number, employeeName: DashboardCompanyBoardEmployeeName, importSummary: string) => {
    const inFlightMonths = wangYueTargetManagementPostImportRefreshRequestsRef.current
    const actualKey = getTargetManagementActualKey(employeeName, monthId)
    if (inFlightMonths.has(actualKey)) {
      setWangYueTargetManagementImportNotice(`${importSummary}；目标信息已保存，该月份的首次业绩更新正在后台进行。`)
      return
    }
    inFlightMonths.add(actualKey)
    setWangYueTargetManagementActualsStatusByMonth((current) => ({ ...current, [actualKey]: 'loading' }))
    setWangYueTargetManagementImportNotice(`${importSummary}；目标信息已保存，正在后台首次更新业绩快照…`)
    void refreshTargetManagementSnapshot(monthId, employeeName, (progress) => {
      setWangYueTargetManagementImportNotice(`${importSummary}；首次业绩更新：${progress}`)
    })
      .then(() => getTargetManagementActuals(monthId, employeeName))
      .then((response) => {
        setWangYueTargetManagementActualsByMonth((current) => ({ ...current, [actualKey]: response }))
        setWangYueTargetManagementActualsStatusByMonth((current) => ({ ...current, [actualKey]: 'loaded' }))
        setWangYueTargetManagementImportNotice(`${importSummary}；首次业绩刷新完成，后续按看板两小时快照计划更新。`)
      })
      .catch((error) => {
        setWangYueTargetManagementActualsStatusByMonth((current) => ({
          ...current,
          [actualKey]: wangYueTargetManagementActualsByMonth[actualKey] ? 'loaded' : 'error',
        }))
        const detail = error instanceof Error ? error.message : '未知错误'
        setWangYueTargetManagementImportNotice(`${importSummary}；首次业绩刷新失败：${detail}。目标信息已保存，后续仍按看板计划刷新。`)
      })
      .finally(() => inFlightMonths.delete(actualKey))
  }

  const applyWangYueTargetManagementImport = async () => {
    if (!targetManagementBoardIsActive || !wangYueTargetManagementImportPreview || wangYueTargetManagementImportLoading) return
    if (!isTargetManagementImportConfiguredEmployee(selectedName)) {
      setWangYueTargetManagementImportError(`${selectedName}的目标表导入规则尚未单独配置，请先确认该人员的表格字段和项目规则。`)
      return
    }
    setWangYueTargetManagementImportLoading(true)
    const employeeName = selectedName as DashboardCompanyBoardEmployeeName
    const preview = wangYueTargetManagementImportPreview
    const previousLayout = readWangYueTargetManagementLayouts(employeeName)[preview.monthId]
    const previousCompanySlots = previousLayout?.companySlots ?? []
    const importedCompanyNames = [...new Set(preview.rows.map((row) => row.companyName))]
    const companiesByTargetMergeGroup = new Map<string, string[]>()
    const mergedCompanyNames = new Set<string>()
    for (const row of preview.rows) {
      for (const mergeGroup of Object.values(row.targetMergeGroups ?? {})) {
        if (!mergeGroup) continue
        const companies = companiesByTargetMergeGroup.get(mergeGroup) ?? []
        if (!companies.includes(row.companyName)) companies.push(row.companyName)
        companiesByTargetMergeGroup.set(mergeGroup, companies)
        mergedCompanyNames.add(row.companyName)
      }
    }
    const orderedImportedCompanyNames: string[] = []
    const addedImportedCompanies = new Set<string>()
    const handledTargetMergeGroups = new Set<string>()
    const addImportedCompany = (companyName: string) => {
      if (companyName && !addedImportedCompanies.has(companyName)) {
        addedImportedCompanies.add(companyName)
        orderedImportedCompanyNames.push(companyName)
      }
    }
    for (const row of preview.rows) {
      const mergeGroups = [...new Set(Object.values(row.targetMergeGroups ?? {}).filter(Boolean))]
      if (mergeGroups.length === 0) {
        addImportedCompany(row.companyName)
        continue
      }
      for (const mergeGroup of mergeGroups) {
        if (handledTargetMergeGroups.has(mergeGroup)) continue
        handledTargetMergeGroups.add(mergeGroup)
        for (const companyName of companiesByTargetMergeGroup.get(mergeGroup) ?? []) addImportedCompany(companyName)
      }
      addImportedCompany(row.companyName)
    }
    const companySlots = [...new Set([
      ...previousCompanySlots.filter((companyName) => !mergedCompanyNames.has(companyName)),
      ...orderedImportedCompanyNames,
    ])]
    const companySlotIndexes = new Map(companySlots.map((companyName, index) => [companyName, index]))
    const brandFilters: Record<string, string> = {}
    const subBrandFilters: Record<string, string> = {}
    const brandSlotCounts: Record<string, number> = {}
    const brandIndexesByGroupAndName = new Map<string, number>()
    const previousBrandFilters = previousLayout?.brandFilters ?? {}
    const previousSubBrandFilters = previousLayout?.subBrandFilters ?? {}
    const getBrandIndexKey = (groupKey: string, brandName: string) =>
      JSON.stringify([groupKey, brandName.trim().toLocaleLowerCase('zh-CN')])

    for (const [previousFilterKey, brandName] of Object.entries(previousBrandFilters)) {
      const match = previousFilterKey.match(/^(\d+):(\d+):(\d+)$/)
      if (!match || !brandName.trim()) continue
      const [, previousSlotIndexText, platformId, brandIndexText] = match
      const companyName = previousCompanySlots[Number(previousSlotIndexText)]
      const slotIndex = companySlotIndexes.get(companyName)
      if (slotIndex === undefined) continue
      const filterKey = `${slotIndex}:${platformId}:${brandIndexText}`
      brandFilters[filterKey] = brandName
      const subBrand = previousSubBrandFilters[previousFilterKey]
      if (subBrand?.trim()) subBrandFilters[filterKey] = subBrand
      const groupKey = `${slotIndex}:${platformId}`
      brandSlotCounts[groupKey] = Math.max(brandSlotCounts[groupKey] ?? 0, Number(brandIndexText) + 1)
      brandIndexesByGroupAndName.set(getBrandIndexKey(groupKey, brandName), Number(brandIndexText))
    }
    for (const [previousGroupKey, count] of Object.entries(previousLayout?.brandSlotCounts ?? {})) {
      const match = previousGroupKey.match(/^(\d+):(\d+)$/)
      if (!match) continue
      const previousSlotIndex = Number(match[1])
      const companyName = previousCompanySlots[previousSlotIndex]
      const slotIndex = companySlotIndexes.get(companyName)
      if (slotIndex === undefined) continue
      const groupKey = `${slotIndex}:${match[2]}`
      brandSlotCounts[groupKey] = Math.max(brandSlotCounts[groupKey] ?? 0, count)
    }

    const preparedRows = preview.rows.map((row) => {
      const slotIndex = companySlotIndexes.get(row.companyName) ?? 0
      const groupKey = `${slotIndex}:${row.platformId}`
      const brandIndexKey = getBrandIndexKey(groupKey, row.projectBrand)
      const existingBrandIndex = brandIndexesByGroupAndName.get(brandIndexKey)
      const brandIndex = existingBrandIndex ?? brandSlotCounts[groupKey] ?? 0
      const filterKey = `${groupKey}:${brandIndex}`
      brandFilters[filterKey] = row.projectBrand
      brandSlotCounts[groupKey] = Math.max(brandSlotCounts[groupKey] ?? 0, brandIndex + 1)
      brandIndexesByGroupAndName.set(brandIndexKey, brandIndex)
      return { ...row, slotIndex, brandIndex }
    })
    const importedGoalCount = preparedRows.reduce((count, row) => count
      + Object.values(row.targets ?? {}).filter((value) => hasPositiveWangYueTargetManagementGoal(value)).length, 0)

    for (const [slotIndex] of companySlots.entries()) {
      for (const platform of WANGYUE_TARGET_MANAGEMENT_PLATFORMS) {
        const key = `${slotIndex}:${platform.id}`
        if (brandSlotCounts[key] === undefined) brandSlotCounts[key] = 0
      }
    }

    const nextGoals = { ...wangYueTargetManagementGoals }
    const totalTargetKey = `${preview.monthId}:total-target`
    nextGoals[totalTargetKey] = { ...nextGoals[totalTargetKey], totalTarget: preview.totalTarget }
    const mergeGroupGoalKeys = WANGYUE_TARGET_MANAGEMENT_MERGEABLE_TARGET_KEYS.map(getTargetManagementMergeGroupGoalKey)
    for (const [goalKey, existingGoals] of Object.entries(nextGoals)) {
      if (!goalKey.startsWith(`${preview.monthId}:`)) continue
      const clearedGoals = { ...existingGoals }
      for (const mergeGroupGoalKey of mergeGroupGoalKeys) delete clearedGoals[mergeGroupGoalKey]
      delete clearedGoals.importedEmptyProjectRow
      nextGoals[goalKey] = clearedGoals
    }
    for (const row of preparedRows) {
      const { brandIndex } = row
      const contactPerson = row.contactPerson?.trim()
      const goalKey = `${preview.monthId}:${row.companyName}:${row.platformId}:${row.projectBrand}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
      const rowGoals = { ...nextGoals[goalKey] }
      if (contactPerson) rowGoals.contactPerson = contactPerson
      rowGoals.importedEmptyProjectRow = row.projectBrand.trim() ? undefined : 'true'
      for (const targetKey of WANGYUE_TARGET_MANAGEMENT_MERGEABLE_TARGET_KEYS) {
        const mergeGroup = row.targetMergeGroups?.[targetKey]
        const mergeGroupGoalKey = getTargetManagementMergeGroupGoalKey(targetKey)
        if (mergeGroup) {
          rowGoals[mergeGroupGoalKey] = mergeGroup
          if (row.targets?.[targetKey] === undefined) delete rowGoals[targetKey]
        } else {
          delete rowGoals[mergeGroupGoalKey]
        }
      }
      for (const [targetKey, targetValue] of Object.entries(row.targets ?? {}) as Array<[WangYueTargetManagementGoalKey, string]>) {
        if (!/^\d+(?:\.\d+)?$/.test(targetValue)) continue
        rowGoals[targetKey] = targetValue
      }
      if (Object.keys(rowGoals).length > 0) nextGoals[goalKey] = rowGoals
    }
    try {
      localStorage.setItem(getTargetManagementGoalsStorageKey(employeeName), JSON.stringify(nextGoals))
    } catch {}
    setWangYueTargetManagementGoals(nextGoals)

    const productLines = previousLayout?.productLines ?? {}
    const layout = { companySlots, brandFilters, subBrandFilters, brandSlotCounts, productLines }
    saveWangYueTargetManagementLayout(preview.monthId, layout, employeeName)
    setWangYueTargetManagementMonth(preview.monthId as TargetManagementMonthId)
    setWangYueTargetManagementCompanySlots(companySlots)
    setWangYueTargetManagementBrandFilters(brandFilters)
    setWangYueTargetManagementSubBrandFilters(subBrandFilters)
    setWangYueTargetManagementBrandSlotCounts(brandSlotCounts)
    setWangYueTargetManagementProductLines(productLines)
    setWangYueTargetManagementBrandResetTokens({})
    setWangYueTargetManagementAmountDisplay((current) => ({ ...current, unit: 'wan' }))
    const contactCount = preview.rows.filter((row) => row.contactPerson?.trim()).length
    const projectLabel = employeeName === '示例对客13' ? '项目' : '品牌'
    const amountImportSummary = employeeName === '示例对客13' ? '金额原值按元换算为万' : '金额目标按万'
    const importSummary = `已导入${preview.sheetTitle}：${importedCompanyNames.length}家公司、${preview.rows.length}组平台${projectLabel}、${contactCount}位对接人、${importedGoalCount}项目标；${amountImportSummary}、外采按单，合并目标只计一次，空白目标保留原值`
    setWangYueTargetManagementImportOpen(false)
    setWangYueTargetManagementImportPreview(null)
    if (hasWangYueTargetManagementActualTargets(nextGoals, preview.monthId)) {
      refreshImportedTargetManagementActuals(preview.monthId, employeeName, `${importSummary}、${importedGoalCount}项品牌目标`)
    } else {
      setWangYueTargetManagementImportNotice(`${importSummary}；当前未录入业绩目标，已跳过首次业绩快照更新。`)
    }
    setWangYueTargetManagementImportLoading(false)
  }

  useEffect(() => {
    const keyword = wangYueTargetManagementCompanyOptionsQuery
    const isCatalogSearch = wangYueTargetManagementCompanySearchSource === 'catalog'
    if (!targetManagementBoardIsActive || activeWangYueTargetManagementCompanySearchSlot === null) return
    const dealCompanyCacheKey = `${selectedName}:${wangYueTargetManagementCompanyLookbackMonths}`

    if (!isCatalogSearch) {
      const cached = wangYueTargetManagementDealCompanyOptionsCacheRef.current.get(dealCompanyCacheKey)
      if (cached && cached.expiresAt > Date.示例公司有限公司()) {
        setWangYueTargetManagementCompanyOptions(cached.companies)
        setWangYueTargetManagementCompanyOptionsStatus('loaded')
        return
      }
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setWangYueTargetManagementCompanyOptionsStatus('loading')
      const request = isCatalogSearch
        ? getTargetManagementCompanyOptions(keyword)
        : getTargetManagementDealCompanyOptions('', wangYueTargetManagementCompanyLookbackMonths, selectedName as DashboardCompanyBoardEmployeeName)
      request
        .then((response) => {
          if (cancelled) return
          if (!isCatalogSearch) {
            wangYueTargetManagementDealCompanyOptionsCacheRef.current.set(dealCompanyCacheKey, {
              expiresAt: Date.示例公司有限公司() + 2 * 60 * 60 * 1000,
              companies: response.companies,
            })
          }
          setWangYueTargetManagementCompanyOptions(response.companies)
          setWangYueTargetManagementCompanyOptionsStatus('loaded')
        })
        .catch(() => {
          if (cancelled) return
          setWangYueTargetManagementCompanyOptions([])
          setWangYueTargetManagementCompanyOptionsStatus('error')
        })
    }, isCatalogSearch && keyword ? 500 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    activeWangYueTargetManagementCompanySearchSlot,
    targetManagementBoardIsActive,
    selectedName,
    wangYueTargetManagementCompanyOptionsQuery,
    wangYueTargetManagementCompanySearchSource,
    wangYueTargetManagementCompanyLookbackMonths,
  ])
  const [wangYueTargetManagementAmountDisplay, setWangYueTargetManagementAmountDisplay] = useState<AmountDisplay>({
    unit: 'wan',
    decimals: 1,
  })
  const [selectedMonths, setSelectedMonths] = useState<Record<Dimension, DashboardMonthId>>({
    publish: initialMonthId,
    deal: initialMonthId,
    payment: initialMonthId,
  })
  const [companyDashboardMonths, setCompanyDashboardMonths] = useState<Record<Dimension, DashboardMonthId>>({
    publish: initialMonthId,
    deal: initialMonthId,
    payment: initialMonthId,
  })
  const [brandDashboardMonths, setBrandDashboardMonths] = useState<Record<Dimension, DashboardMonthId>>({
    publish: initialMonthId,
    deal: initialMonthId,
    payment: initialMonthId,
  })
  const [wangYueCompanyDashboardMonths, setWangYueCompanyDashboardMonths] = useState<Record<Dimension, DashboardMonthId>>({
    publish: initialMonthId,
    deal: initialMonthId,
    payment: initialMonthId,
  })
  const [wangYueBrandDashboardMonths, setWangYueBrandDashboardMonths] = useState<Record<Dimension, DashboardMonthId>>({
    publish: initialMonthId,
    deal: initialMonthId,
    payment: initialMonthId,
  })
  const [companyBoardData, setCompanyBoardData] = useState<Record<string, DashboardCompanyPerformanceResponse>>({})
  const [companyBoardStatuses, setCompanyBoardStatuses] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({})
  const [brandBoardData, setBrandBoardData] = useState<Record<string, DashboardBrandPerformanceResponse>>({})
  const [brandBoardStatuses, setBrandBoardStatuses] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({})
  const [companyBoardSorts, setCompanyBoardSorts] = useState<Record<Dimension, SortConfig>>({
    publish: { ...DEFAULT_COMPANY_BOARD_SORT },
    deal: { ...DEFAULT_COMPANY_BOARD_SORT },
    payment: { ...DEFAULT_COMPANY_BOARD_SORT },
  })
  const [wangYueCompanyBoardSorts, setWangYueCompanyBoardSorts] = useState<Record<Dimension, SortConfig>>({
    publish: { ...DEFAULT_COMPANY_BOARD_SORT },
    deal: { ...DEFAULT_COMPANY_BOARD_SORT },
    payment: { ...DEFAULT_COMPANY_BOARD_SORT },
  })
  const [companyNameFilters, setCompanyNameFilters] = useState<Record<Dimension, string>>({
    publish: '',
    deal: '',
    payment: '',
  })
  const [wangYueCompanyNameFilters, setWangYueCompanyNameFilters] = useState<Record<Dimension, string>>({
    publish: '',
    deal: '',
    payment: '',
  })
  const [wangYueCompanyVisibleColumns, setWangYueCompanyVisibleColumns] = useState<Record<Dimension, Set<CompanyBoardColumnKey>>>(() => ({
    publish: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    deal: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    payment: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
  }))
  const [companyVisibleColumns, setCompanyVisibleColumns] = useState<Record<Dimension, Set<CompanyBoardColumnKey>>>(() => ({
    publish: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    deal: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    payment: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
  }))
  const [brandBoardSorts, setBrandBoardSorts] = useState<Record<Dimension, SortConfig>>({
    publish: { ...DEFAULT_COMPANY_BOARD_SORT },
    deal: { ...DEFAULT_COMPANY_BOARD_SORT },
    payment: { ...DEFAULT_COMPANY_BOARD_SORT },
  })
  const [wangYueBrandBoardSorts, setWangYueBrandBoardSorts] = useState<Record<Dimension, SortConfig>>({
    publish: { ...DEFAULT_COMPANY_BOARD_SORT },
    deal: { ...DEFAULT_COMPANY_BOARD_SORT },
    payment: { ...DEFAULT_COMPANY_BOARD_SORT },
  })
  const [brandNameFilters, setBrandNameFilters] = useState<Record<Dimension, string>>({
    publish: '',
    deal: '',
    payment: '',
  })
  const [wangYueBrandNameFilters, setWangYueBrandNameFilters] = useState<Record<Dimension, string>>({
    publish: '',
    deal: '',
    payment: '',
  })
  const [wangYueBrandVisibleColumns, setWangYueBrandVisibleColumns] = useState<Record<Dimension, Set<CompanyBoardColumnKey>>>(() => ({
    publish: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    deal: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    payment: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
  }))
  const [wangYueEntityTrend, setWangYueEntityTrend] = useState<{
    employeeName: CustomerCompanyBrandBoardEmployeeName
    board: 'company' | 'brand'
    dimension: Dimension
    monthId: DashboardMonthId
  } | null>(null)
  const [brandVisibleColumns, setBrandVisibleColumns] = useState<Record<Dimension, Set<CompanyBoardColumnKey>>>(() => ({
    publish: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    deal: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
    payment: new Set(COMPANY_BOARD_COLUMNS.map((column) => column.key)),
  }))
  const dashboardMonthIdsKey = DASHBOARD_MONTH_IDS.join(',')
  const [dashboardMembersByMonth, setDashboardMembersByMonth] = useState<Record<number, DashboardMemberTarget[]>>({})
  const [dashboardMonthStatus, setDashboardMonthStatus] = useState<Record<number, 'loading' | 'loaded' | 'error'>>({})
  const [performanceRefresh, setPerformanceRefresh] = useState<{
    key: string
    status: 'running' | 'done' | 'error'
    message: string
  } | null>(null)
  const dashboardMonthCacheRef = useRef<Record<number, {
    members: DashboardMemberTarget[]
    updatedAt: number
  }>>({})
  const dashboardMonthStatusRef = useRef<Record<number, 'loading' | 'loaded' | 'error'>>({})
  const dashboardMonthRequestIdRef = useRef<Record<number, number>>({})
  const previousDashboardSelectionRef = useRef({ employeeName: selectedName, dimension: selectedDashboardDimension })
  const [manualValues, setManualValues] = useState<Record<string, ManualValue>>(() => {
    const readStoredValues = (key: string): Record<string, ManualValue> => {
      try {
        const saved = localStorage.getItem(key)
        return saved ? JSON.parse(saved) as Record<string, ManualValue> : {}
      } catch {
        return {}
      }
    }

    try {
      return migrateManualValues(
        readStoredValues(LEGACY_STORAGE_KEY),
        readStoredValues(STORAGE_KEY),
      )
    } catch {
      return {}
    }
  })
  const manualValuesRef = useRef(manualValues)
  const [targetPersistenceError, setTargetPersistenceError] = useState('')
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({})
  const [editingMetricTargetKey, setEditingMetricTargetKey] = useState<string | null>(null)
  const [commissionRateDrafts, setCommissionRateDrafts] = useState<Record<string, string>>({})
  const [amountDisplay, setAmountDisplay] = useState<Record<Dimension, AmountDisplay>>(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_STORAGE_KEY)
      const parsed = saved ? JSON.parse(saved) as Partial<Record<Dimension, Partial<AmountDisplay>>> : {}
      return DIMENSIONS.reduce((result, dimension) => {
        const savedDisplay = parsed[dimension]
        result[dimension] = {
          unit: savedDisplay?.unit === 'wan' ? 'wan' : DEFAULT_AMOUNT_DISPLAY[dimension].unit,
          decimals: Number.isInteger(savedDisplay?.decimals) && savedDisplay.decimals >= 0 && savedDisplay.decimals <= 4
            ? savedDisplay.decimals
            : DEFAULT_AMOUNT_DISPLAY[dimension].decimals,
        }
        return result
      }, {} as Record<Dimension, AmountDisplay>)
    } catch {
      return DEFAULT_AMOUNT_DISPLAY
    }
  })
  const [customerAmountDisplay, setCustomerAmountDisplay] = useState<AmountDisplay>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY)
      const parsed = saved ? JSON.parse(saved) as Partial<AmountDisplay> : {}
      return {
        unit: parsed.unit === 'wan' ? 'wan' : 'yuan',
        decimals: Number.isInteger(parsed.decimals) && parsed.decimals >= 0 && parsed.decimals <= 4
          ? parsed.decimals
          : 1,
      }
    } catch {
      return DEFAULT_AMOUNT_DISPLAY.publish
    }
  })
  const [companyAmountDisplay, setCompanyAmountDisplay] = useState<AmountDisplay>(() => {
    try {
      const saved = localStorage.getItem(COMPANY_DISPLAY_STORAGE_KEY)
      const parsed = saved ? JSON.parse(saved) as Partial<AmountDisplay> : {}
      return {
        unit: parsed.unit === 'wan' ? 'wan' : 'yuan',
        decimals: Number.isInteger(parsed.decimals) && parsed.decimals >= 0 && parsed.decimals <= 4
          ? parsed.decimals
          : 1,
      }
    } catch {
      return { unit: 'yuan', decimals: 1 }
    }
  })
  const [wangYueEntityAmountDisplay, setWangYueEntityAmountDisplay] = useState<AmountDisplay>(() => {
    try {
      const saved = localStorage.getItem(WANGYUE_ENTITY_DISPLAY_STORAGE_KEY)
      const parsed = saved ? JSON.parse(saved) as Partial<AmountDisplay> : {}
      return {
        unit: parsed.unit === 'wan' ? 'wan' : 'yuan',
        decimals: Number.isInteger(parsed.decimals) && parsed.decimals >= 0 && parsed.decimals <= 4
          ? parsed.decimals
          : 1,
      }
    } catch {
      return { unit: 'yuan', decimals: 1 }
    }
  })

  useEffect(() => {
    manualValuesRef.current = manualValues
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(manualValues))
    } catch {
      // 浏览器存储不可用时仍允许当前页面内使用
    }
  }, [manualValues])

  useEffect(() => {
    if (wangYueTargetManagementDataOwner !== selectedName || !(isOtherViewer || isTargetManagementBoardEmployee(selectedName))) return
    try {
      localStorage.setItem(getTargetManagementGoalsStorageKey(selectedName), JSON.stringify(wangYueTargetManagementGoals))
    } catch {
      return
    }
  }, [selectedName, wangYueTargetManagementDataOwner, wangYueTargetManagementGoals])

  useEffect(() => {
    if (wangYueTargetManagementDataOwner !== selectedName || !(isOtherViewer || isTargetManagementBoardEmployee(selectedName))) return
    saveWangYueTargetManagementLayout(wangYueTargetManagementMonth, {
      companySlots: wangYueTargetManagementCompanySlots,
      brandFilters: wangYueTargetManagementBrandFilters,
      subBrandFilters: wangYueTargetManagementSubBrandFilters,
      brandSlotCounts: wangYueTargetManagementBrandSlotCounts,
      productLines: wangYueTargetManagementProductLines,
    }, selectedName)
  }, [selectedName, wangYueTargetManagementDataOwner, wangYueTargetManagementMonth, wangYueTargetManagementCompanySlots, wangYueTargetManagementBrandFilters, wangYueTargetManagementSubBrandFilters, wangYueTargetManagementBrandSlotCounts, wangYueTargetManagementProductLines])

  useEffect(() => {
    let cancelled = false
    const monthIds = dashboardMonthIdsKey.split(',').map(Number)
    Promise.all(monthIds.map((monthId) => getMetricTargets(monthId)))
      .then((responses) => {
        if (cancelled) return
        const localValues = manualValuesRef.current
        const targets = responses.flatMap((response) => response.targets)
        const remoteKeys = new Set(targets.map((target) => `${target.monthId}:${target.employeeName}:${target.dimension}:${target.metricKey}`))
        const mergedValues = { ...localValues }
        for (const target of targets) {
          mergedValues[`${target.monthId}:${target.employeeName}:${target.dimension}:${target.metricKey}`] = {
            target: target.target,
            commissionRate: target.commissionRate,
          }
        }
        const localOnlyTargets = Object.entries(localValues).flatMap(([key, value]) => {
          if (remoteKeys.has(key)) return []
          const [monthIdText, employeeName, dimension, metricKey] = key.split(':')
          const monthId = Number(monthIdText)
          if (!monthIds.includes(monthId)) return []
          if (!DASHBOARD_MEMBERS.some((member) => member.name === employeeName)) return []
          if (!identity.allowedEmployeeNames.includes(employeeName) || !canEditDashboardTargets(identity, employeeName)) return []
          if (!DIMENSIONS.includes(dimension as Dimension)) return []
          return [{
            monthId,
            employeeName,
            dimension: dimension as Dimension,
            metricKey,
            target: value.target,
            commissionRate: value.commissionRate,
          }]
        })
        manualValuesRef.current = mergedValues
        setManualValues(mergedValues)
        if (localOnlyTargets.length > 0) {
          updateMetricTargets(localOnlyTargets).then(() => {
            if (!cancelled) setTargetPersistenceError('')
          }).catch(() => {
            if (!cancelled) setTargetPersistenceError('目标或提成系数未能同步到云端，请检查网络后重试。')
          })
        }
      })
      .catch(() => {
        if (!cancelled) setTargetPersistenceError('无法读取云端目标设置；当前显示的可能只是本机缓存。')
      })
    return () => {
      cancelled = true
    }
  }, [dashboardMonthIdsKey])

  useEffect(() => {
    try {
      localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(amountDisplay))
    } catch {
      // 浏览器存储不可用时仍允许当前页面内使用
    }
  }, [amountDisplay])

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOMER_DISPLAY_STORAGE_KEY, JSON.stringify(customerAmountDisplay))
    } catch {
      // 浏览器存储不可用时仍允许当前页面内使用
    }
  }, [customerAmountDisplay])

  useEffect(() => {
    try {
      localStorage.setItem(COMPANY_DISPLAY_STORAGE_KEY, JSON.stringify(companyAmountDisplay))
    } catch {
      // 浏览器存储不可用时仍允许当前页面内使用
    }
  }, [companyAmountDisplay])

  useEffect(() => {
    try {
      localStorage.setItem(WANGYUE_ENTITY_DISPLAY_STORAGE_KEY, JSON.stringify(wangYueEntityAmountDisplay))
    } catch {
      // 浏览器存储不可用时仍允许当前页面内使用
    }
  }, [wangYueEntityAmountDisplay])

  useEffect(() => {
    let timer: number | undefined
    const refreshHours = Array.from({ length: 12 }, (_, index) => index * 2)
    const historicalRefreshHours = [10, 14, 18]
    const scheduledHours = [...new Set([...refreshHours, ...historicalRefreshHours])].sort((left, right) => left - right)
    const monthIds = dashboardMonthIdsKey.split(',').map(Number)
    const previousSelection = previousDashboardSelectionRef.current
    const dimensionOnlyChanged = previousSelection.employeeName === selectedName
      && previousSelection.dimension !== selectedDashboardDimension
    previousDashboardSelectionRef.current = { employeeName: selectedName, dimension: selectedDashboardDimension }

    const refresh = (refreshMonthIds = monthIds, includeUnpublishedSummary = true) => {
      setDashboardMonthStatus((current) => ({
        ...current,
        ...Object.fromEntries(refreshMonthIds.map((monthId) => [monthId, 'loading'])),
      }))
      const targetLoads = refreshMonthIds.map((monthId) => {
        const requestId = (dashboardMonthRequestIdRef.current[monthId] ?? 0) + 1
        dashboardMonthRequestIdRef.current[monthId] = requestId
        dashboardMonthStatusRef.current[monthId] = 'loading'
        return getDashboardTargets(monthId)
          .then((response) => {
            if (dashboardMonthRequestIdRef.current[monthId] !== requestId) return
            dashboardMonthCacheRef.current[monthId] = {
              members: response.members,
              updatedAt: Date.示例公司有限公司(),
            }
            dashboardMonthStatusRef.current[monthId] = 'loaded'
            setDashboardMembersByMonth((current) => ({ ...current, [monthId]: response.members }))
            setDashboardMonthStatus((current) => ({ ...current, [monthId]: 'loaded' }))
          })
          .catch(() => {
            if (dashboardMonthRequestIdRef.current[monthId] !== requestId) return
            dashboardMonthStatusRef.current[monthId] = 'error'
            setDashboardMonthStatus((current) => ({ ...current, [monthId]: 'error' }))
          })
      })
      if (includeUnpublishedSummary) {
        Promise.all(targetLoads).then(() => {
          if (supportsUnpublishedMetrics(selectedName)) refreshUnpublishedSummary(selectedName, customerDashboardMonth)
          else setUnpublishedStatuses((previous) => ({ ...previous, [selectedName]: 'idle' }))
        })
      }
    }

    const scheduleNextRefresh = () => {
      const 示例公司有限公司 = new Date()
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(示例公司有限公司)
      const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)
      const beijingNow = new Date(Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
        part('second'),
        示例公司有限公司.getMilliseconds(),
      ))
      const next = new Date(beijingNow)
      const currentHour = beijingNow.getUTCHours()
      const currentMinute = beijingNow.getUTCMinutes()
      let nextHour = scheduledHours.find((hour) => hour > currentHour || (hour === currentHour && currentMinute < 10))
      if (nextHour === undefined) {
        next.setUTCDate(next.getUTCDate() + 1)
        nextHour = scheduledHours[0]
      }
      next.setUTCHours(nextHour, 10, 0, 0)
      const delay = next.getTime() - beijingNow.getTime()
      timer = window.setTimeout(() => {
        const scheduledHour = next.getUTCHours()
        const scheduledDateParts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        }).formatToParts(new Date())
        const readScheduledPart = (type: Intl.DateTimeFormatPartTypes) => Number(
          scheduledDateParts.find((entry) => entry.type === type)?.value ?? 0,
        )
        const scheduledLocalDate = new Date(
          readScheduledPart('year'),
          readScheduledPart('month') - 1,
          readScheduledPart('day'),
        )
        const currentMonthId = getCurrentDashboardMonthId(scheduledLocalDate)
        if (refreshHours.includes(scheduledHour) && currentMonthId !== undefined) {
          refresh([currentMonthId], true)
        }
        if (historicalRefreshHours.includes(scheduledHour) && currentMonthId !== undefined) {
          const historicalMonthIds = monthIds.filter((monthId) =>
            monthId < currentMonthId && monthId >= Math.max(147, currentMonthId - 4),
          )
          if (historicalMonthIds.length > 0) refresh(historicalMonthIds, false)
        }
        scheduleNextRefresh()
      }, Math.max(1000, delay))
    }

    const monthsNeedingInitialLoad = monthIds.filter((monthId) => {
      const cached = dashboardMonthCacheRef.current[monthId]
      const refreshInterval = 24 * 60 * 60 * 1000
      if (dashboardMonthStatusRef.current[monthId] === 'loading') return false
      return !cached
        || Date.示例公司有限公司() - cached.updatedAt >= refreshInterval
        || dashboardMonthStatusRef.current[monthId] === 'error'
    })
    refresh(monthsNeedingInitialLoad, !dimensionOnlyChanged)
    scheduleNextRefresh()
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [dashboardMonthIdsKey, selectedName, selectedDashboardDimension])

  useEffect(() => {
    if (selectedName !== '示例开发01' || supplementaryDashboardDimensions.customer !== 'publish') return
    const customerMonthId = customerDashboardMonth
    const requiredMonthIds = customerMonthId > 147
      ? [customerMonthId, (customerMonthId - 1) as DashboardMonthId]
      : [customerMonthId]
    const primaryMetricsSettled = requiredMonthIds.every((monthId) =>
      dashboardMonthStatus[monthId] === 'loaded' || dashboardMonthStatus[monthId] === 'error',
    )
    if (!primaryMetricsSettled) return
    for (const employeeName of CUSTOMER_DASHBOARD_MEMBERS) {
      if ((unpublishedStatuses[employeeName] ?? 'idle') === 'loading') continue
      if (unpublishedSummaries[employeeName]?.boardMonthId === customerMonthId) continue
      void refreshUnpublishedSummary(employeeName, customerMonthId)
    }
  }, [selectedName, customerDashboardMonth, supplementaryDashboardDimensions.customer, dashboardMonthStatus, unpublishedStatuses, unpublishedSummaries, refreshUnpublishedSummary])

  useEffect(() => {
    const isCurrentTargetManagementBoard = targetManagementBoardIsActive
    const isCustomerCompanyBoard = !targetSplitBoardActive && (isOtherViewer || isCustomerCompanyBrandBoardEmployee(selectedName))
      && (isCurrentTargetManagementBoard || (!isCurrentTargetManagementBoard && wangYueTargetEntityBoard === 'company'))
    const isMuyuanCompanyBoard = !targetSplitBoardActive && selectedName === '示例开发01' && activeSupplementaryDashboard === 'company'
    if (!isCustomerCompanyBoard && !isMuyuanCompanyBoard) return
    const employeeName: DashboardCompanyBoardEmployeeName = isCustomerCompanyBoard
      ? selectedName as CustomerCompanyBrandBoardEmployeeName
      : '示例开发01'
    const dimension = isCustomerCompanyBoard
      ? isCurrentTargetManagementBoard ? 'publish' : wangYueTargetEntityDimensions.company
      : supplementaryDashboardDimensions.company
    const monthId = isCustomerCompanyBoard
      ? isCurrentTargetManagementBoard ? wangYueTargetManagementMonth : wangYueCompanyDashboardMonths[dimension]
      : companyDashboardMonths[dimension]
    if (isCurrentTargetManagementBoard && !DASHBOARD_MONTH_IDS.includes(monthId as DashboardMonthId)) return
    const key = getCompanyBoardCacheKey(employeeName, monthId, dimension)
    const status = companyBoardStatuses[key]
    if (status === 'loading' || status === 'loaded' || status === 'error') return

    setCompanyBoardStatuses((current) => ({ ...current, [key]: 'loading' }))
    getDashboardCompanyPerformance(monthId, dimension, employeeName)
      .then((response) => {
        setCompanyBoardData((current) => ({ ...current, [key]: response }))
        setCompanyBoardStatuses((current) => ({ ...current, [key]: 'loaded' }))
      })
      .catch(() => {
        setCompanyBoardStatuses((current) => ({ ...current, [key]: 'error' }))
      })
  }, [selectedName, activeSupplementaryDashboard, wangYueTargetEntityBoard, targetManagementBoardIsActive, targetSplitBoardActive, wangYueTargetManagementMonth, wangYueTargetEntityDimensions.company, supplementaryDashboardDimensions.company, companyDashboardMonths, wangYueCompanyDashboardMonths, companyBoardStatuses])

  useEffect(() => {
    if (!TARGET_MANAGEMENT_BOARD_EMPLOYEES.includes(selectedName as typeof TARGET_MANAGEMENT_BOARD_EMPLOYEES[number])
      || targetManagementBoardIsActive
      || wangYueTargetEntityBoard !== 'company'
      || wangYueTargetEntityDimensions.company !== 'deal') return
    const employeeName = selectedName as DashboardCompanyBoardEmployeeName
    const monthId = wangYueCompanyDashboardMonths[wangYueTargetEntityDimensions.company]
    const refreshSnapshot = () => loadTargetManagementSubmissionSnapshot(employeeName, monthId)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshSnapshot()
    }
    refreshSnapshot()
    const intervalId = window.setInterval(refreshSnapshot, 2 * 60 * 60 * 1000)
    window.addEventListener('focus', refreshSnapshot)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshSnapshot)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [selectedName, targetManagementBoardIsActive, wangYueTargetEntityBoard, wangYueTargetEntityDimensions.company, wangYueCompanyDashboardMonths, loadTargetManagementSubmissionSnapshot])

  useEffect(() => {
    if (!targetManagementBoardIsActive) return
    if (wangYueTargetManagementBrandCatalogStatus !== 'idle') return
    const companyName = wangYueTargetManagementCompanySlots.find((name) => name.trim())?.trim()
    if (!companyName) return

    const timeoutId = window.setTimeout(() => {
      loadTargetManagementBrandCatalog(companyName)
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [targetManagementBoardIsActive, selectedName, wangYueTargetManagementCompanySlots, wangYueTargetManagementBrandCatalogStatus, loadTargetManagementBrandCatalog])

  useEffect(() => {
    if (!targetManagementBoardIsActive) return
    if (!DASHBOARD_MONTH_IDS.includes(wangYueTargetManagementMonth as DashboardMonthId)) return
    if (!hasCurrentTargetManagementActualTargets) return
    const monthId = wangYueTargetManagementMonth
    const actualKey = getTargetManagementActualKey(selectedName, monthId)
    if (wangYueTargetManagementPostImportRefreshRequestsRef.current.has(actualKey)) return
    const companySnapshotKey = getCompanyBoardCacheKey(selectedName as DashboardCompanyBoardEmployeeName, monthId, 'publish')
    if (companyBoardStatuses[companySnapshotKey] !== 'loaded') return
    const status = wangYueTargetManagementActualsStatusByMonth[actualKey]
    if (status === 'loading' || status === 'loaded' || status === 'error') return
    if (wangYueTargetManagementActualsRequestsRef.current.has(actualKey)) return

    wangYueTargetManagementActualsRequestsRef.current.add(actualKey)
    setWangYueTargetManagementActualsStatusByMonth((current) => ({ ...current, [actualKey]: 'loading' }))
    getTargetManagementActuals(monthId, selectedName as DashboardCompanyBoardEmployeeName)
      .then((response) => {
        setWangYueTargetManagementActualsByMonth((current) => ({ ...current, [actualKey]: response }))
        setWangYueTargetManagementActualsStatusByMonth((current) => ({ ...current, [actualKey]: 'loaded' }))
      })
      .catch(() => {
        setWangYueTargetManagementActualsStatusByMonth((current) => ({ ...current, [actualKey]: 'error' }))
      })
      .finally(() => wangYueTargetManagementActualsRequestsRef.current.delete(actualKey))
  }, [targetManagementBoardIsActive, selectedName, wangYueTargetManagementMonth, hasCurrentTargetManagementActualTargets, wangYueTargetManagementActualsStatusByMonth, companyBoardStatuses])

  useEffect(() => {
    if (!targetManagementBoardIsActive) return
    if (!DASHBOARD_MONTH_IDS.includes(wangYueTargetManagementMonth as DashboardMonthId)) return
    if (!hasCurrentTargetManagementActualTargets) return
    const monthId = wangYueTargetManagementMonth
    const actualKey = getTargetManagementActualKey(selectedName, monthId)
    const intervalId = window.setInterval(() => {
      if (!hasCurrentTargetManagementActualTargets) return
      if (wangYueTargetManagementPostImportRefreshRequestsRef.current.has(actualKey)) return
      void getTargetManagementActuals(monthId, selectedName as DashboardCompanyBoardEmployeeName)
        .then((response) => {
          setWangYueTargetManagementActualsByMonth((current) => ({ ...current, [actualKey]: response }))
          setWangYueTargetManagementActualsStatusByMonth((current) => ({ ...current, [actualKey]: 'loaded' }))
        })
        .catch(() => {
          setWangYueTargetManagementActualsStatusByMonth((current) => ({
            ...current,
            [actualKey]: current[actualKey] === 'loaded' ? 'loaded' : 'error',
          }))
        })
    }, 2 * 60 * 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [targetManagementBoardIsActive, selectedName, wangYueTargetManagementMonth, hasCurrentTargetManagementActualTargets])

  useEffect(() => {
    const isCustomerBrandBoard = !targetSplitBoardActive && !targetManagementBoardIsActive && (isOtherViewer || isCustomerCompanyBrandBoardEmployee(selectedName)) && wangYueTargetEntityBoard === 'brand'
    const isMuyuanBrandBoard = !targetSplitBoardActive && selectedName === '示例开发01' && activeSupplementaryDashboard === 'brand'
    if (!isCustomerBrandBoard && !isMuyuanBrandBoard) return
    const employeeName: DashboardCompanyBoardEmployeeName = isCustomerBrandBoard
      ? selectedName as CustomerCompanyBrandBoardEmployeeName
      : '示例开发01'
    const dimension = isCustomerBrandBoard
      ? wangYueTargetEntityDimensions.brand
      : supplementaryDashboardDimensions.brand
    const monthId = isCustomerBrandBoard
      ? wangYueBrandDashboardMonths[dimension]
      : brandDashboardMonths[dimension]
    const key = getBrandBoardCacheKey(employeeName, monthId, dimension)
    const status = brandBoardStatuses[key]
    if (status === 'loading' || status === 'loaded' || status === 'error') return

    setBrandBoardStatuses((current) => ({ ...current, [key]: 'loading' }))
    getDashboardBrandPerformance(monthId, dimension, employeeName)
      .then((response) => {
        setBrandBoardData((current) => ({ ...current, [key]: response }))
        setBrandBoardStatuses((current) => ({ ...current, [key]: 'loaded' }))
      })
      .catch(() => {
        setBrandBoardStatuses((current) => ({ ...current, [key]: 'error' }))
      })
  }, [selectedName, activeSupplementaryDashboard, wangYueTargetEntityBoard, targetManagementBoardIsActive, targetSplitBoardActive, wangYueTargetEntityDimensions.brand, supplementaryDashboardDimensions.brand, brandDashboardMonths, wangYueBrandDashboardMonths, brandBoardStatuses])

  useEffect(() => {
    if (!(isOtherViewer || isCustomerCompanyBrandBoardEmployee(selectedName))) return
    setWangYueCompanyNameFilters({ publish: '', deal: '', payment: '' })
    setWangYueBrandNameFilters({ publish: '', deal: '', payment: '' })
  }, [selectedName])

  useEffect(() => {
    setWangYueTargetManagementActive(false)
    setTargetSplitBoardActive(false)
    setTargetSplitImportOpen(false)
    setTargetSplitImportEmployeeName(null)
    setTargetSplitImportNotice('')
    setTargetSplitImportError('')
  }, [selectedName])

  useEffect(() => {
    if (!wangYueEntityTrend) return
    const monthIndex = DASHBOARD_MONTH_IDS.indexOf(wangYueEntityTrend.monthId)
    if (monthIndex <= 0) return
    const previousMonthId = DASHBOARD_MONTH_IDS[monthIndex - 1]

    if (wangYueEntityTrend.board === 'company') {
      const key = getCompanyBoardCacheKey(wangYueEntityTrend.employeeName, previousMonthId, wangYueEntityTrend.dimension)
      const status = companyBoardStatuses[key]
      if (status === 'loading' || status === 'loaded' || status === 'error') return
      setCompanyBoardStatuses((current) => ({ ...current, [key]: 'loading' }))
      getDashboardCompanyPerformance(previousMonthId, wangYueEntityTrend.dimension, wangYueEntityTrend.employeeName)
        .then((response) => {
          setCompanyBoardData((current) => ({ ...current, [key]: response }))
          setCompanyBoardStatuses((current) => ({ ...current, [key]: 'loaded' }))
        })
        .catch(() => {
          setCompanyBoardStatuses((current) => ({ ...current, [key]: 'error' }))
        })
      return
    }

    const key = getBrandBoardCacheKey(wangYueEntityTrend.employeeName, previousMonthId, wangYueEntityTrend.dimension)
    const status = brandBoardStatuses[key]
    if (status === 'loading' || status === 'loaded' || status === 'error') return
    setBrandBoardStatuses((current) => ({ ...current, [key]: 'loading' }))
    getDashboardBrandPerformance(previousMonthId, wangYueEntityTrend.dimension, wangYueEntityTrend.employeeName)
      .then((response) => {
        setBrandBoardData((current) => ({ ...current, [key]: response }))
        setBrandBoardStatuses((current) => ({ ...current, [key]: 'loaded' }))
      })
      .catch(() => {
        setBrandBoardStatuses((current) => ({ ...current, [key]: 'error' }))
      })
  }, [wangYueEntityTrend, companyBoardStatuses, brandBoardStatuses])

  useEffect(() => {
    const tableWrap = companyTableWrapRef.current
    const tableContent = companyTableContentRef.current
    if (!tableWrap || !tableContent) return
    const updateScrollWidth = () => {
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      setCompanyTableScrollMax(maxScroll)
      setCompanyTableScrollPosition(Math.min(tableWrap.scrollLeft, maxScroll))
      const header = tableContent.querySelector<HTMLElement>('.customer-dashboard-header')
      const headerCells = header ? Array.from(header.children) as HTMLElement[] : []
      const frozenColumnCount = Number(tableContent.dataset.companyFreezeCount) || 2
      const columnOffsets: number[] = []
      let left = 0
      headerCells.forEach((cell) => {
        columnOffsets.push(left)
        left += cell.getBoundingClientRect().width
      })
      tableContent.querySelectorAll<HTMLElement>('.customer-dashboard-row').forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          const gridCell = cell as HTMLElement
          if (index < frozenColumnCount && index < columnOffsets.length) {
            gridCell.dataset.companyFrozen = 'true'
            gridCell.style.position = 'sticky'
            gridCell.style.left = `${columnOffsets[index]}px`
            gridCell.style.zIndex = row === header ? '6' : '2'
            gridCell.style.backgroundColor = row === header ? '#f2f4f7' : '#fff'
          } else {
            delete gridCell.dataset.companyFrozen
            gridCell.style.removeProperty('position')
            gridCell.style.removeProperty('left')
            gridCell.style.removeProperty('z-index')
            gridCell.style.removeProperty('background-color')
          }
        })
      })
    }
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(tableContent)
    resizeObserver.observe(tableWrap)
    const mutationObserver = new MutationObserver(updateScrollWidth)
    mutationObserver.observe(tableContent, { childList: true, subtree: true })
    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [selectedName, activeSupplementaryDashboard, wangYueTargetEntityBoard, wangYueTargetEntityDimensions.company, wangYueTargetEntityDimensions.brand, supplementaryDashboardDimensions.company, supplementaryDashboardDimensions.brand, companyDashboardMonths, brandDashboardMonths, wangYueCompanyDashboardMonths, wangYueBrandDashboardMonths, companyVisibleColumns, brandVisibleColumns, wangYueCompanyVisibleColumns, wangYueBrandVisibleColumns, companyBoardData, brandBoardData])

  useEffect(() => {
    const tableWrap = targetManagementTableWrapRef.current
    const tableContent = targetManagementTableContentRef.current
    if (!tableWrap || !tableContent) return
    const updateScrollWidth = () => {
      const header = tableContent.querySelector<HTMLElement>('.target-management-header')
      if (header) {
        let left = 0
        Array.from(header.children).slice(0, 4).forEach((cell, index) => {
          tableContent.style.setProperty(`--target-management-frozen-left-${index}`, `${left}px`)
          left += cell.getBoundingClientRect().width
        })
      }
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      setTargetManagementTableScrollMax(maxScroll)
      for (const range of [targetManagementTableRangeRef.current, targetManagementTableBottomRangeRef.current]) {
        if (range) {
          range.max = String(maxScroll)
          range.value = String(Math.min(tableWrap.scrollLeft, maxScroll))
        }
      }
    }
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(tableContent)
    resizeObserver.observe(tableWrap)
    const header = tableContent.querySelector<HTMLElement>('.target-management-header')
    if (header) {
      resizeObserver.observe(header)
      Array.from(header.children).slice(0, 4).forEach((cell) => resizeObserver.observe(cell))
    }
    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [selectedName, activeSupplementaryDashboard, wangYueTargetManagementActive, wangYueTargetManagementMonth, wangYueTargetManagementCompanySlots, wangYueTargetManagementBrandFilters, wangYueTargetManagementSubBrandFilters, wangYueTargetManagementBrandSlotCounts])

  useEffect(() => {
    if (!targetSplitBoardActive) return
    const tableWrap = targetSplitTableWrapRef.current
    const table = tableWrap?.querySelector<HTMLElement>('.target-management-table')
    if (!tableWrap || !table) return
    const updateScrollWidth = () => {
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      setTargetSplitTableScrollMax(maxScroll)
      setTargetSplitTableScrollPosition(Math.min(tableWrap.scrollLeft, maxScroll))
    }
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(table)
    resizeObserver.observe(tableWrap)
    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [selectedName, targetSplitBoardActive])

  const [chartOpen, setChartOpen] = useState<Record<Dimension, boolean>>({
    publish: false,
    deal: false,
    payment: false,
  })
  const [chartFilters, setChartFilters] = useState<Record<Dimension, {
    current: boolean
    lastMonth: boolean
    completion: boolean
  }>>({
    publish: { current: true, lastMonth: true, completion: true },
    deal: { current: true, lastMonth: true, completion: true },
    payment: { current: true, lastMonth: true, completion: true },
  })

  const toggleChartFilter = (dimension: Dimension, key: 'current' | 'lastMonth' | 'completion') => {
    setChartFilters((current) => ({
      ...current,
      [dimension]: {
        ...current[dimension],
        [key]: !current[dimension][key],
      },
    }))
  }

  const [visibleColumns, setVisibleColumns] = useState<Record<Dimension, Set<ColumnKey>>>(() => ({
    publish: new Set(COLUMNS_BY_DIMENSION.publish.map((column) => column.key)),
    deal: new Set(COLUMNS_BY_DIMENSION.deal.map((column) => column.key)),
    payment: new Set(COLUMNS_BY_DIMENSION.payment.map((column) => column.key)),
  }))
  const [customerVisibleColumns, setCustomerVisibleColumns] = useState<Record<Dimension, Set<ColumnKey>>>(() => ({
    publish: new Set(CUSTOMER_COLUMNS_BY_DIMENSION.publish.map((column) => column.key)),
    deal: new Set(CUSTOMER_COLUMNS_BY_DIMENSION.deal.map((column) => column.key)),
    payment: new Set(CUSTOMER_COLUMNS_BY_DIMENSION.payment.map((column) => column.key)),
  }))
  const [customerChartOpen, setCustomerChartOpen] = useState(false)
  const [customerDashboardTabs, setCustomerDashboardTabs] = useState<string[]>([])
  const [activeCustomerDashboardTab, setActiveCustomerDashboardTab] = useState<string | null>(null)
  const [customerChartFilters, setCustomerChartFilters] = useState({ current: true, lastMonth: true, completion: true })
  useEffect(() => {
    const tableWrap = customerTableWrapRef.current
    const tableContent = customerTableContentRef.current
    if (!tableWrap || !tableContent) return
    const updateScrollWidth = () => {
      const maxScroll = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth)
      setCustomerTableScrollMax(maxScroll)
      setCustomerTableScrollPosition(Math.min(tableWrap.scrollLeft, maxScroll))
    }
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(tableContent)
    resizeObserver.observe(tableWrap)
    window.addEventListener('resize', updateScrollWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollWidth)
    }
  }, [selectedName, supplementaryDashboardDimensions.customer, customerDashboardMonth, customerVisibleColumns, activeCustomerDashboardTab])

  const toggleColumn = (dimension: Dimension, columnKey: ColumnKey) => {
    setVisibleColumns((current) => {
      const columns = new Set(current[dimension])
      if (columns.has(columnKey)) columns.delete(columnKey)
      else columns.add(columnKey)
      return { ...current, [dimension]: columns }
    })
  }

  const toggleCustomerColumn = (dimension: Dimension, columnKey: ColumnKey) => {
    setCustomerVisibleColumns((current) => {
      const columns = new Set(current[dimension])
      if (columns.has(columnKey)) columns.delete(columnKey)
      else columns.add(columnKey)
      return { ...current, [dimension]: columns }
    })
  }

  const toggleCompanyColumn = (dimension: Dimension, columnKey: CompanyBoardColumnKey) => {
    setCompanyVisibleColumns((current) => {
      const columns = new Set(current[dimension])
      if (columns.has(columnKey)) columns.delete(columnKey)
      else columns.add(columnKey)
      return { ...current, [dimension]: columns }
    })
  }

  const toggleBrandColumn = (dimension: Dimension, columnKey: CompanyBoardColumnKey) => {
    setBrandVisibleColumns((current) => {
      const columns = new Set(current[dimension])
      if (columns.has(columnKey)) columns.delete(columnKey)
      else columns.add(columnKey)
      return { ...current, [dimension]: columns }
    })
  }

  const updateSelectedMonth = (dimension: Dimension, value: string) => {
    const monthId = Number(value) as DashboardMonthId
    if (!DASHBOARD_MONTH_IDS.includes(monthId)) return
    setSelectedMonths((current) => ({ ...current, [dimension]: monthId }))
  }

  const updateAllDashboardMonths = (value: string) => {
    const monthId = Number(value) as DashboardMonthId
    if (!DASHBOARD_MONTH_IDS.includes(monthId)) return
    const nextMonths = { publish: monthId, deal: monthId, payment: monthId }
    const savedLayout = readWangYueTargetManagementLayouts(selectedName)[monthId]
    setAllDashboardMonthId(monthId)
    setSelectedMonths(nextMonths)
    setCustomerDashboardMonth(monthId)
    setCompanyDashboardMonths(nextMonths)
    setBrandDashboardMonths(nextMonths)
    setWangYueCompanyDashboardMonths(nextMonths)
    setWangYueBrandDashboardMonths(nextMonths)
    setCompanyNameFilters({ publish: '', deal: '', payment: '' })
    setBrandNameFilters({ publish: '', deal: '', payment: '' })
    setWangYueTargetManagementMonth(monthId)
    setWangYueTargetManagementCompanySlots(savedLayout?.companySlots
      ?? Array.from({ length: WANGYUE_TARGET_MANAGEMENT_DEFAULT_COMPANY_COUNT }, () => ''))
    setWangYueTargetManagementBrandFilters(savedLayout?.brandFilters ?? {})
    setWangYueTargetManagementSubBrandFilters(savedLayout?.subBrandFilters ?? {})
    setWangYueTargetManagementBrandSlotCounts(savedLayout?.brandSlotCounts ?? {})
    setWangYueTargetManagementProductLines(savedLayout?.productLines ?? {})
  }

  const updateCustomerDashboardMonth = (value: string) => {
    const monthId = Number(value) as DashboardMonthId
    if (!DASHBOARD_MONTH_IDS.includes(monthId)) return
    setCustomerDashboardMonth(monthId)
  }

  const updateCompanyDashboardMonth = (dimension: Dimension, value: string) => {
    const monthId = Number(value) as DashboardMonthId
    if (!DASHBOARD_MONTH_IDS.includes(monthId)) return
    setCompanyDashboardMonths((current) => ({ ...current, [dimension]: monthId }))
    setCompanyNameFilters((current) => ({ ...current, [dimension]: '' }))
  }

  const updateBrandDashboardMonth = (dimension: Dimension, value: string) => {
    const monthId = Number(value) as DashboardMonthId
    if (!DASHBOARD_MONTH_IDS.includes(monthId)) return
    setBrandDashboardMonths((current) => ({ ...current, [dimension]: monthId }))
    setBrandNameFilters((current) => ({ ...current, [dimension]: '' }))
  }

  const openCustomerMemberDashboard = (employeeName: string) => {
    setCustomerDashboardTabs((current) => current.includes(employeeName) ? current : [...current, employeeName])
    setActiveCustomerDashboardTab(employeeName)
    setSupplementaryDashboardDimensions((current) => ({ ...current, customer: 'publish' }))
  }

  const closeCustomerMemberDashboard = (employeeName: string) => {
    setCustomerDashboardTabs((current) => current.filter((name) => name !== employeeName))
    setActiveCustomerDashboardTab((current) => current === employeeName ? null : current)
  }

  const updateManualValue = (
    dimension: Dimension,
    metricKey: MetricKey,
    patch: Partial<ManualValue>,
  ) => {
    if (!canEditDashboardTargets(identity, selectedName)) return
    const monthId = selectedMonths[dimension]
    const key = manualValueKey(monthId, selectedName, dimension, metricKey)
    setManualValues((current) => {
      const next = {
      ...current,
      [key]: {
        target: current[key]?.target ?? 0,
        commissionRate: current[key]?.commissionRate ?? 0,
        ...patch,
      },
      }
      manualValuesRef.current = next
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // 浏览器存储不可用时仍保留当前页面内的录入值
      }
      return next
    })
  }

  const updateAmountDisplay = (dimension: Dimension, patch: Partial<AmountDisplay>) => {
    setAmountDisplay((current) => ({
      ...current,
      [dimension]: { ...current[dimension], ...patch },
    }))
  }

  const persistManualValue = (dimension: Dimension, metricKey: MetricKey) => {
    if (!canEditDashboardTargets(identity, selectedName)) return
    const monthId = selectedMonths[dimension]
    const key = manualValueKey(monthId, selectedName, dimension, metricKey)
    const value = manualValuesRef.current[key] ?? manualValues[key] ?? { target: 0, commissionRate: 0 }
    updateMetricTargets([{
      monthId,
      employeeName: selectedName,
      dimension,
      metricKey,
      target: value.target,
      commissionRate: value.commissionRate,
    }]).then(() => {
      setTargetPersistenceError('')
    }).catch(() => {
      setTargetPersistenceError('目标或提成系数未能同步到云端，请检查网络后重试。')
    })
  }

  const updateTarget = (dimension: Dimension, metricKey: MetricKey, rawValue: string) => {
    const key = manualValueKey(selectedMonths[dimension], selectedName, dimension, metricKey)
    setTargetDrafts((current) => ({ ...current, [key]: rawValue }))
    const target = parseTargetInput(rawValue, metricKey)
    if (target !== undefined) updateManualValue(dimension, metricKey, { target })
  }

  const finishTargetEdit = (dimension: Dimension, metricKey: MetricKey) => {
    const key = manualValueKey(selectedMonths[dimension], selectedName, dimension, metricKey)
    const rawValue = targetDrafts[key]
    const target = rawValue === undefined
      ? undefined
      : parseTargetInput(rawValue, metricKey)
    if (target !== undefined) updateManualValue(dimension, metricKey, { target })
    setTargetDrafts((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    persistManualValue(dimension, metricKey)
  }

  const updateCommissionRate = (dimension: Dimension, metricKey: MetricKey, rawValue: string) => {
    const key = manualValueKey(selectedMonths[dimension], selectedName, dimension, metricKey)
    setCommissionRateDrafts((current) => ({ ...current, [key]: rawValue }))
    if (rawValue.trim() === '') {
      updateManualValue(dimension, metricKey, { commissionRate: 0 })
      return
    }
    const parsedValue = Number(rawValue)
    if (Number.isFinite(parsedValue)) {
      updateManualValue(dimension, metricKey, { commissionRate: parsedValue })
    }
  }

  const finishCommissionRateEdit = (dimension: Dimension, metricKey: MetricKey) => {
    const key = manualValueKey(selectedMonths[dimension], selectedName, dimension, metricKey)
    persistManualValue(dimension, metricKey)
    setCommissionRateDrafts((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const selectedMember = DASHBOARD_MEMBERS.find((member) => member.name === selectedName) ?? visibleDashboardMembers[0] ?? DASHBOARD_MEMBERS[0]
  const grouped = GROUP_NAMES.map((group) => ({
    group,
    members: visibleDashboardMembers.filter((member) => member.group === group),
  })).filter(({ members }) => members.length > 0)
  const sidebarUpdateMonthId = selectedMonths[selectedDashboardDimension]
  const sidebarUpdateMembers = dashboardMembersByMonth[sidebarUpdateMonthId] ?? []
  const formatSnapshotUpdateTime = (updatedAt?: string | null) => {
    if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) return null
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(updatedAt))
  }
  const getDisplayedPerformance = (employeeName: string, dimension: Dimension, monthId: DashboardMonthId) => {
    const member = dashboardMembersByMonth[monthId]?.find((item) => item.name === employeeName)
    if (member?.hasPerformanceSnapshot) {
      return performanceFromOrderMetric(member.orderMetric[dimension])
    }
    if (monthId === 148) return getMemberPerformance(employeeName, dimension)
    if (monthId === 147) return getMemberLastMonthPerformance(employeeName, dimension)
    return EMPTY_PERFORMANCE
  }
  const getPreviousMonthPerformance = (employeeName: string, dimension: Dimension, monthId: DashboardMonthId) => {
    if (monthId === 147) return EMPTY_PERFORMANCE
    return getDisplayedPerformance(employeeName, dimension, (monthId - 1) as DashboardMonthId)
  }
  const hasCurrentMonthPerformance = (monthId: DashboardMonthId) => {
    if (monthId === 148) return true
    return dashboardMembersByMonth[monthId]?.some((member) => member.name === selectedName && member.hasPerformanceSnapshot) ?? false
  }
  const hasEmployeePerformanceSnapshot = (employeeName: string, monthId: DashboardMonthId) => {
    if (monthId === 148) return true
    return dashboardMembersByMonth[monthId]?.some((member) => member.name === employeeName && member.hasPerformanceSnapshot) ?? false
  }
  const refreshSelectedEmployeePerformance = async (employeeName: string, monthId: DashboardMonthId) => {
    if (performanceRefresh?.status === 'running') return
    const refreshKey = employeeName + ':' + monthId
    setPerformanceRefresh({ key: refreshKey, status: 'running', message: '正在提交单人刷新…' })
    try {
      await refreshPerformanceSnapshot(monthId, employeeName, (message) => {
        setPerformanceRefresh({ key: refreshKey, status: 'running', message })
      })
      const requestId = (dashboardMonthRequestIdRef.current[monthId] ?? 0) + 1
      dashboardMonthRequestIdRef.current[monthId] = requestId
      const response = await getDashboardTargets(monthId)
      if (dashboardMonthRequestIdRef.current[monthId] === requestId) {
        dashboardMonthCacheRef.current[monthId] = { members: response.members, updatedAt: Date.示例公司有限公司() }
        dashboardMonthStatusRef.current[monthId] = 'loaded'
        setDashboardMembersByMonth((current) => ({ ...current, [monthId]: response.members }))
        setDashboardMonthStatus((current) => ({ ...current, [monthId]: 'loaded' }))
      }
      setPerformanceRefresh({ key: refreshKey, status: 'done', message: DASHBOARD_FANGPIAN_PERIODS[monthId].label + ' ' + employeeName + '业绩已更新' })
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误'
      setPerformanceRefresh({ key: refreshKey, status: 'error', message: '更新失败：' + detail })
    }
  }
  const negativeAlerts = DIMENSIONS.flatMap((dimension) => {
    const monthId = selectedMonths[dimension]
    const monthNumber = monthId - 139
    const currentPerformance = getDisplayedPerformance(selectedName, dimension, monthId)
    const lastMonthPerformance = getPreviousMonthPerformance(selectedName, dimension, monthId)
    const currentAvailable = hasCurrentMonthPerformance(monthId)
    return SUB_METRICS.flatMap(({ key, name }) => {
      if (key === 'outsourcingOrderCount') return []
      const alertName = key === 'outsourcing' ? '外采业绩利润' : name
      const alerts: string[] = []
      if (currentAvailable && currentPerformance[key] < 0) {
        alerts.push(`${selectedName} ${DIMENSION_NAMES[dimension]}看板中${alertName}为负数（方片月${monthNumber}月）`)
      }
      if (lastMonthPerformance[key] < 0) {
        alerts.push(`${selectedName} ${DIMENSION_NAMES[dimension]}看板中${alertName}为负数（方片月${monthNumber - 1}月）`)
      }
      return alerts
    })
  })
  const customerCompanyBrandBoardEmployeeName = (isOtherViewer || isCustomerCompanyBrandBoardEmployee(selectedName))
    ? selectedName as CustomerCompanyBrandBoardEmployeeName
    : null
  const isWangYueTargetManagementActive = targetManagementBoardIsActive
  const companyBoardEmployeeRoleLabel = selectedName === '示例开发10' ? '结款商务' : '商务对客人'
  const targetSplitFinancialGoalKeys = getTargetSplitFinancialGoalKeys(targetSplitOwnerName, targetSplitPlan)
  const targetSplitGoalKeys = getTargetSplitGoalKeys(targetSplitOwnerName, targetSplitPlan, targetSplitMonth)
  const getTargetSplitPersonTarget = (employeeName: string, plan = targetSplitPlan) => {
    const manuallyAssignedTarget = plan.customerTargets[employeeName]
    if (targetSplitOwnerName === '示例开发01'
      && Array.isArray(plan.importedCustomerTargetNames)
      && plan.importedCustomerTargetNames.includes(employeeName)) {
      const importedTarget = manuallyAssignedTarget?.trim() ?? ''
      const importedValue = Number(importedTarget)
      return importedTarget && Number.isFinite(importedValue) && importedValue >= 0
        ? Number(importedValue.toFixed(2))
        : 0
    }
    if (isMuyuanNovemberTargetSplit && manuallyAssignedTarget !== undefined) {
      return Number((Number(manuallyAssignedTarget) || 0).toFixed(2))
    }
    const financialGoalKeys = getTargetSplitFinancialGoalKeys(targetSplitOwnerName, plan)
    const assignedGoals = plan.customerGoalTargets[employeeName]
    const hasAssignedFinancialGoals = financialGoalKeys.some((goalKey) =>
      assignedGoals?.[goalKey] !== undefined && assignedGoals[goalKey] !== '',
    )
    if (hasAssignedFinancialGoals) {
      const financialGoalTotal = financialGoalKeys.reduce(
        (sum, goalKey) => sum + (Number(assignedGoals[goalKey]) || 0),
        0,
      )
      return Number(financialGoalTotal.toFixed(2))
    }
    const employeeRows = plan.rows.filter((row) => row.customerFacingPerson === employeeName)
    const rowGoalTotal = employeeRows.reduce((sum, row) => sum + getTargetSplitFinancialTotal(row.targets, financialGoalKeys), 0)
    return Number(rowGoalTotal.toFixed(2))
  }
  const targetSplitPlanHasPersonTargetBaseline = (plan = targetSplitPlan) => Boolean(plan.generatedAt)
    || Object.keys(plan.customerGoalTargets).length > 0
    || plan.rows.length > 0
  const getTargetSplitPersonTargetInputValue = (employeeName: string, plan = targetSplitPlan) => {
    const storedTarget = plan.customerTargets[employeeName]
    if (storedTarget !== undefined) return storedTarget
    return targetSplitPlanHasPersonTargetBaseline(plan) ? getTargetSplitPersonTarget(employeeName, plan).toFixed(2) : ''
  }
  const importTargetSplitPeopleToTargetBoard = async () => {
    if (targetSplitBoardImportLoading) return
    const targets = targetSplitEmployeeNames.map((employeeName) => ({
      employeeName,
      value: getTargetSplitPersonTargetInputValue(employeeName).trim(),
    }))
    const incompleteEmployees = targets.filter(({ value }) => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)
    if (incompleteEmployees.length) {
      setTargetSplitBoardImportFeedback({ status: 'error', message: `导入未执行：以下人员的总目标为空或无效，请先补齐：${incompleteEmployees.map(({ employeeName }) => employeeName).join('、')}。` })
      return
    }
    const teamTotalTargetValue = Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim())
    if (!Number.isFinite(teamTotalTargetValue) || teamTotalTargetValue <= 0) {
      setTargetSplitBoardImportFeedback({ status: 'error', message: '导入未执行：八人总目标为空或无效，请先填写总目标。' })
      return
    }
    const teamGoalTargets = targetSplitGoalKeys.map((goalKey) => ({
      goalKey,
      value: (targetSplitPlan.goalTargets[goalKey] ?? '').trim(),
    }))
    const incompleteTeamGoals = teamGoalTargets.filter(({ goalKey, value }) => {
      const numericValue = Number(value)
      return value === '' || !Number.isFinite(numericValue) || numericValue < 0
        || (goalKey === 'outsourcingOrderCountTarget' && !Number.isInteger(numericValue))
    })
    if (incompleteTeamGoals.length) {
      const missingLabels = incompleteTeamGoals.map(({ goalKey }) => TARGET_SPLIT_GOAL_LABELS[goalKey]).join('、')
      setTargetSplitBoardImportFeedback({ status: 'error', message: '导入未执行：示例开发01别名第一行的具体目标未填写或无效：' + missingLabels + '。' })
      return
    }
    const monthLabel = DASHBOARD_FANGPIAN_PERIODS[targetSplitMonth].label
    setTargetSplitBoardImportLoading(true)
    setTargetSplitBoardImportFeedback({ status: 'loading', message: '正在写入八位对客人目标及示例开发01别名本人八人总目标和具体目标…' })
    setTargetSplitImportNotice('')
    try {
      const importedTargets = [
        ...targets.flatMap(({ employeeName, value }) => {
          const personTargets = [{
            monthId: targetSplitMonth,
            employeeName,
            dimension: 'publish' as const,
            metricKey: 'total',
            target: Math.round(Number(value) * 100) * 100,
          }]
          for (const goalKey of targetSplitGoalKeys) {
            const metricKey = goalKey === 'outsourcingOrderCountTarget'
              ? 'outsourcingOrderCount'
              : TARGET_SPLIT_METRIC_BY_GOAL[goalKey]
            const goalValue = getTargetSplitCustomerGoalTotal(employeeName, goalKey)
            personTargets.push({
              monthId: targetSplitMonth,
              employeeName,
              dimension: 'publish' as const,
              metricKey,
              target: goalKey === 'outsourcingOrderCountTarget'
                ? Math.round(goalValue)
                : Math.round(goalValue * 100) * 100,
            })
          }
          return personTargets
        }),
        {
          monthId: targetSplitMonth,
          employeeName: '示例开发01',
          dimension: 'publish' as const,
          metricKey: 'total',
          target: Math.round(teamTotalTargetValue * 100) * 100,
        },
        ...teamGoalTargets.map(({ goalKey, value }) => ({
          monthId: targetSplitMonth,
          employeeName: '示例开发01',
          dimension: 'publish' as const,
          metricKey: goalKey === 'outsourcingOrderCountTarget'
            ? 'outsourcingOrderCount'
            : TARGET_SPLIT_METRIC_BY_GOAL[goalKey],
          target: goalKey === 'outsourcingOrderCountTarget'
            ? Math.round(Number(value))
            : Math.round(Number(value) * 100) * 100,
        })),
      ]
      await updateMetricTargets(importedTargets)
      const nextManualValues = { ...manualValuesRef.current }
      for (const target of importedTargets) {
        const key = manualValueKey(target.monthId, target.employeeName, target.dimension, target.metricKey as MetricKey)
        nextManualValues[key] = {
          target: target.target,
          commissionRate: nextManualValues[key]?.commissionRate ?? 0,
        }
      }
      manualValuesRef.current = nextManualValues
      setManualValues(nextManualValues)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextManualValues))
      } catch {}
      setTargetPersistenceError('')
      const goalColumnCount = targetSplitGoalKeys.length
      const successMessage = `导入成功：已将${monthLabel}方片月8位对客人的总目标及${goalColumnCount}项具体目标写入各自业务目标看板，并将八人总目标和${goalColumnCount}项具体目标写入示例开发01本人业务目标看板。`
      setTargetSplitImportNotice(successMessage)
      setTargetSplitBoardImportFeedback({ status: 'success', message: successMessage })
    } catch (error) {
      const errorMessage = `导入失败：${error instanceof Error ? error.message : '目标看板保存失败，请稍后重试。'}`
      setTargetSplitImportNotice(errorMessage)
      setTargetSplitBoardImportFeedback({ status: 'error', message: errorMessage })
    } finally {
      setTargetSplitBoardImportLoading(false)
    }
  }
  const getTargetSplitRowHasTargets = (row: TargetSplitRow) =>
    Object.values(row.targets).some((value) => Number(value) > 0)
  const getTargetSplitRowNeedsDimensions = (row: TargetSplitRow) => {
    if (!getTargetSplitRowHasTargets(row)) return false
    return !TARGET_MANAGEMENT_BOARD_EMPLOYEES.includes(row.customerFacingPerson as typeof TARGET_MANAGEMENT_BOARD_EMPLOYEES[number])
      || !row.companyName.trim()
      || row.platformId === null
      || !TARGET_SPLIT_PLATFORMS.some((platform) => platform.id === row.platformId)
      || (row.platformId !== 0 && !row.projectBrand.trim())
  }
  const targetSplitRowHasCompleteDimensions = (row: TargetSplitRow) =>
    TARGET_MANAGEMENT_BOARD_EMPLOYEES.includes(row.customerFacingPerson as typeof TARGET_MANAGEMENT_BOARD_EMPLOYEES[number])
    && Boolean(row.companyName.trim())
    && row.platformId !== null
    && TARGET_SPLIT_PLATFORMS.some((platform) => platform.id === row.platformId)
    && (row.platformId === 0 || Boolean(row.projectBrand.trim()))
  const targetSplitImportableRows = targetSplitPlan.rows.filter((row) =>
    !getTargetSplitRowNeedsDimensions(row)
    && (getTargetSplitRowHasTargets(row)
      || (isPersonalTargetSplitOwner(targetSplitOwnerName) && targetSplitRowHasCompleteDimensions(row))),
  )
  const targetSplitIncompleteRowCount = targetSplitPlan.rows.filter(getTargetSplitRowNeedsDimensions).length
  const targetSplitAllocatedAmount = targetSplitEmployeeNames.reduce(
    (sum, employeeName) => sum + getTargetSplitPersonTarget(employeeName),
    0,
  )
  const targetSplitDetailAmount = targetSplitPlan.rows.reduce(
    (sum, row) => sum + getTargetSplitFinancialTotal(row.targets, targetSplitFinancialGoalKeys),
    0,
  )
  const getTargetSplitCustomerGoalDetailTotal = (employeeName: string, goalKey: TargetSplitGoalKey, plan = targetSplitPlan) =>
    plan.rows
      .filter((row) => row.customerFacingPerson === employeeName)
      .reduce((sum, row) => sum + (Number(row.targets[goalKey]) || 0), 0)
  const getTargetSplitCustomerGoalTotal = (employeeName: string, goalKey: TargetSplitGoalKey, plan = targetSplitPlan) => {
    const assignedTarget = plan.customerGoalTargets[employeeName]?.[goalKey]
    return assignedTarget === undefined
      ? getTargetSplitCustomerGoalDetailTotal(employeeName, goalKey, plan)
      : Number(assignedTarget) || 0
  }
  const getTargetSplitCustomerGoalUnallocated = (employeeName: string, goalKey: TargetSplitGoalKey, plan = targetSplitPlan) =>
    Math.max(0, getTargetSplitCustomerGoalTotal(employeeName, goalKey, plan) - getTargetSplitCustomerGoalDetailTotal(employeeName, goalKey, plan))
  const getTargetSplitCustomerUnallocatedTarget = (employeeName: string, plan = targetSplitPlan) =>
    Math.max(0, getTargetSplitPersonTarget(employeeName, plan)
      - getTargetSplitFinancialGoalKeys(targetSplitOwnerName, plan).reduce((sum, goalKey) => sum + getTargetSplitCustomerGoalDetailTotal(employeeName, goalKey, plan), 0))
  const targetSplitAllocationGap = (Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim()) || 0) - targetSplitAllocatedAmount
  const targetSplitGoalInputIsValid = (goalKey: TargetSplitGoalKey) => {
    const rawValue = targetSplitPlan.goalTargets[goalKey]
    if (rawValue === undefined || rawValue.trim() === '') return false
    const value = Number(rawValue)
    if (!Number.isFinite(value) || value < 0) return false
    return goalKey === 'outsourcingOrderCountTarget'
      ? Number.isInteger(value)
      : Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  }
  const targetSplitGoalInputsComplete = targetSplitGoalKeys.every(targetSplitGoalInputIsValid)
  const targetSplitGoalTotalCents = targetSplitFinancialGoalKeys.reduce(
    (sum, goalKey) => sum + Math.round((Number(targetSplitPlan.goalTargets[goalKey]) || 0) * 100),
    0,
  )
  const targetSplitCustomerTargetTotalCents = targetSplitEmployeeNames.reduce(
    (sum, employeeName) => sum + Math.round((Number(targetSplitPlan.customerTargets[employeeName]) || 0) * 100),
    0,
  )
  const targetSplitCustomerTargetInputsComplete = targetSplitEmployeeNames.every((employeeName) => {
    const rawValue = targetSplitPlan.customerTargets[employeeName]
    if (rawValue === undefined || rawValue.trim() === '') return false
    const value = Number(rawValue)
    return Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  })
  const targetSplitGenerationMatchesGoalInputs = isMuyuanNovemberTargetSplit
    ? targetSplitGoalInputsComplete
      && targetSplitCustomerTargetInputsComplete
      && targetSplitGoalKeys.every((goalKey) => {
        const currentValue = Number(targetSplitPlan.goalTargets[goalKey])
        const generatedValue = Number(targetSplitPlan.generatedGoalTargets[goalKey])
        return Number.isFinite(generatedValue) && currentValue === generatedValue
      })
      && targetSplitGoalTotalCents <= Math.round((Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim()) || 0) * 100)
      && targetSplitEmployeeNames.every((employeeName) => {
        const currentValue = Number(targetSplitPlan.customerTargets[employeeName])
        const generatedValue = Number(targetSplitPlan.generatedCustomerTargets?.[employeeName])
        return Number.isFinite(generatedValue) && currentValue === generatedValue
      })
      && !getTargetSplitAllocationSettingsError(targetSplitPlan.allocationSettings)
      && targetSplitPlan.allocationPolicyVersion === getTargetSplitAllocationPolicyVersion(targetSplitOwnerName, targetSplitMonth)
    : targetSplitGoalInputsComplete && targetSplitGoalKeys.every((goalKey) => {
      const currentValue = Number(targetSplitPlan.goalTargets[goalKey])
      const generatedValue = Number(targetSplitPlan.generatedGoalTargets[goalKey])
      return Number.isFinite(generatedValue) && currentValue === generatedValue
    }) && !getTargetSplitAllocationSettingsError(targetSplitPlan.allocationSettings)
      && targetSplitPlan.allocationPolicyVersion === getTargetSplitAllocationPolicyVersion(targetSplitOwnerName, targetSplitMonth)
  const targetSplitPlanNeedsRegeneration = Boolean(targetSplitPlan.generatedAt)
    && (targetSplitPlan.allocationPolicyVersion !== getTargetSplitAllocationPolicyVersion(targetSplitOwnerName, targetSplitMonth)
      || (isMuyuanNovemberTargetSplit && !targetSplitGenerationMatchesGoalInputs))
  const targetSplitAllocationSettingsError = getTargetSplitAllocationSettingsError(targetSplitPlan.allocationSettings)
  const targetSplitSourceWeightTotal = (Object.values(targetSplitPlan.allocationSettings.sourceWeights).reduce((sum, value) => sum + (Number(value) || 0), 0))
  const getTargetSplitPersonIncompleteRowCount = (employeeName: string) =>
    targetSplitPlan.rows.filter((row) => row.customerFacingPerson === employeeName && getTargetSplitRowNeedsDimensions(row)).length
  const getTargetSplitPersonImportBlockReason = (employeeName: string) => {
    if (targetSplitOwnerName !== '示例开发01' && !targetSplitGenerationMatchesGoalInputs) {
      return '固定目标尚未生成对应拆分结果，或目标金额已修改；请先点击“生成目标”。'
    }
    if (getTargetSplitPersonTarget(employeeName) <= 0) {
      return '该对客人当前没有分配目标。'
    }
    const incompleteRowCount = getTargetSplitPersonIncompleteRowCount(employeeName)
    return targetSplitOwnerName !== '示例开发01' && incompleteRowCount > 0
      ? `还有 ${incompleteRowCount} 行已填写目标但缺少对客人、公司、平台或项目品牌，请补齐后再导入。`
      : ''
  }
  const targetSplitUsesHeaderImportOnly = Boolean(targetSplitOwnerName)
    && targetSplitOwnerName !== '示例开发01'
    && supportsTargetSplitBoard(targetSplitOwnerName)
  const targetSplitImportScopeNames = targetSplitImportEmployeeName
    ? [targetSplitImportEmployeeName]
    : targetSplitEmployeeNames
  const targetSplitImportScopeRows = targetSplitImportableRows.filter((row) =>
    targetSplitImportScopeNames.includes(row.customerFacingPerson),
  )
  const targetSplitImportScopeIncompleteRowCount = targetSplitImportEmployeeName
    ? getTargetSplitPersonIncompleteRowCount(targetSplitImportEmployeeName)
    : targetSplitIncompleteRowCount
  const targetSplitImportScopeAllocatedAmount = targetSplitImportScopeNames.reduce(
    (sum, employeeName) => sum + getTargetSplitPersonTarget(employeeName),
    0,
  )
  const updateTargetSplitAllocationSettings = (update: (settings: TargetSplitAllocationSettings) => TargetSplitAllocationSettings) => {
    const nextSettings = update(targetSplitPlan.allocationSettings)
    const settingsError = getTargetSplitAllocationSettingsError(nextSettings)
    const cache = targetSplitSnapshotCacheRef.current[`${targetSplitOwnerName}:${targetSplitMonth}`]
    const totalTarget = Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim())
    const goalTargets = Object.fromEntries(targetSplitGoalKeys.map((goalKey) => {
      const value = Number(targetSplitPlan.goalTargets[goalKey])
      return [goalKey, goalKey === 'outsourcingOrderCountTarget' ? String(value) : value.toFixed(2)]
    })) as TargetSplitPlan['goalTargets']
    const financialGoalTotalCents = targetSplitFinancialGoalKeys.reduce(
      (sum, goalKey) => sum + Math.round(Number(goalTargets[goalKey]) * 100),
      0,
    )
    const canRecalculate = !isMuyuanNovemberTargetSplit
      && Boolean(cache && targetSplitPlan.generatedAt)
      && !settingsError
      && Number.isFinite(totalTarget)
      && totalTarget > 0
      && targetSplitGoalInputsComplete
      && financialGoalTotalCents === Math.round(totalTarget * 100)

    if (canRecalculate && cache) {
      try {
        const allocation = buildTargetSplitPlanFromSnapshots(
          targetSplitMonth,
          cache.historyMonthIds,
          totalTarget.toFixed(2),
          goalTargets,
          cache.sourcesByEmployee,
          toTargetSplitAllocationParameters(nextSettings),
          targetSplitEmployeeNames,
          isPersonalTargetSplitOwner(targetSplitOwnerName) && targetSplitPlan.personalOpportunityStructureInitialized
            ? targetSplitPlan.rows
            : undefined,
          targetSplitFinancialGoalKeys,
        )
        if (allocation.hasHistoricalPerformance) {
          const generatedRows = allocation.rows.map((row) => ({ ...row, targets: { ...row.targets } }))
          const nextPlan: TargetSplitPlan = {
            ...targetSplitPlan,
            totalTarget: totalTarget.toFixed(2),
            goalTargets,
            allocationSettings: nextSettings,
            preserveOpportunityStructure: isPersonalTargetSplitOwner(targetSplitOwnerName) || targetSplitPlan.preserveOpportunityStructure,
            personalOpportunityStructureInitialized: isPersonalTargetSplitOwner(targetSplitOwnerName)
              || targetSplitPlan.personalOpportunityStructureInitialized,
            rows: generatedRows.map((row) => ({ ...row, targets: { ...row.targets } })),
            generatedRows,
            customerTargets: allocation.customerTargets,
            generatedCustomerTargets: allocation.customerTargets,
            importedCustomerTargetNames: [],
            customerGoalTargets: allocation.customerGoalTargets,
            customerRationales: allocation.customerRationales,
            companyRationales: allocation.companyRationales,
            generatedGoalTargets: goalTargets,
            sourceWarnings: allocation.sourceWarnings,
            baselineMonthId: allocation.baselineMonthId,
            allocationPolicyVersion: getTargetSplitAllocationPolicyVersion(targetSplitOwnerName, targetSplitMonth),
            sourceUpdatedAt: allocation.sourceUpdatedAt,
            generatedAt: new Date().toISOString(),
          }
          setTargetSplitPlans((current) => ({ ...current, [targetSplitMonth]: nextPlan }))
          setTargetSplitGenerationError('')
          setTargetSplitGenerationProgress(`参数已按当前缓存快照自动重算预览；目标管理尚未更改。${isPersonalTargetSplitOwner(targetSplitOwnerName) ? `公司、平台及项目行按${targetSplitOwnerName}当前示例公司有限公司配置保留。` : ''}${targetSplitOwnerName === '示例对客16' ? '外采单数不分配给示例公司01有限公司和示例公司02有限公司。' : ''}`)
          return
        }
      } catch (error) {
        setTargetSplitGenerationError(error instanceof Error ? error.message : '按新参数重算失败，请重新生成目标。')
      }
    }

    setTargetSplitPlans((current) => ({
      ...current,
      [targetSplitMonth]: {
        ...targetSplitPlan,
        allocationSettings: nextSettings,
        allocationPolicyVersion: 0,
      },
    }))
    setTargetSplitGenerationProgress(!settingsError && targetSplitPlan.generatedAt && !cache
      ? '参数已保存；当前页面没有这份月份的快照缓存，请点击“生成目标”重新读取已保存快照后重算。'
      : '')
  }
  const updateTargetSplitRow = (rowId: string, field: TargetSplitEditableField, value: string) => {
    updateTargetSplitPlan((plan) => ({
      ...plan,
      preserveOpportunityStructure: plan.preserveOpportunityStructure
        || (isPersonalTargetSplitOwner(targetSplitOwnerName) && ['companyName', 'platformId', 'projectBrand'].includes(field)),
      rows: plan.rows.map((row) => {
        if (row.id !== rowId) return row
        if (field === 'customerFacingPerson') return { ...row, customerFacingPerson: value }
        if (field === 'companyName') return { ...row, companyName: value }
        if (field === 'projectBrand') return { ...row, projectBrand: value }
        if (field === 'platformId') return { ...row, platformId: value === '' ? null : Number(value) }
        return { ...row, targets: { ...row.targets, [field]: value } }
      }),
    }))
  }
  const addTargetSplitRow = () => {
    updateTargetSplitPlan((plan) => ({
      ...plan,
      preserveOpportunityStructure: plan.preserveOpportunityStructure || isPersonalTargetSplitOwner(targetSplitOwnerName),
      rows: [...plan.rows, {
        id: `manual-${crypto.randomUUID()}`,
        customerFacingPerson: '',
        companyName: '',
        platformId: null,
        projectBrand: '',
        targets: {},
      }],
    }))
  }
  const updateTargetSplitRows = (rowIds: string[], field: 'companyName' | 'platformId', value: string) => {
    updateTargetSplitPlan((plan) => ({
      ...plan,
      preserveOpportunityStructure: plan.preserveOpportunityStructure || isPersonalTargetSplitOwner(targetSplitOwnerName),
      rows: plan.rows.map((row) => {
        if (!rowIds.includes(row.id)) return row
        if (field === 'companyName') return { ...row, companyName: value }
        return { ...row, platformId: value === '' ? null : Number(value) }
      }),
    }))
  }
  const deleteTargetSplitRow = (rowId: string) => {
    updateTargetSplitPlan((plan) => ({
      ...plan,
      preserveOpportunityStructure: plan.preserveOpportunityStructure || isPersonalTargetSplitOwner(targetSplitOwnerName),
      rows: plan.rows.filter((row) => row.id !== rowId),
    }))
  }
  const resetTargetSplitRow = (rowId: string) => {
    updateTargetSplitPlan((plan) => {
      const generatedRow = plan.generatedRows.find((row) => row.id === rowId)
      if (!generatedRow) return plan
      return {
        ...plan,
        rows: plan.rows.map((row) => row.id === rowId
          ? { ...generatedRow, targets: { ...generatedRow.targets } }
          : row),
      }
    })
    setTargetSplitEditingCell(null)
  }
  const resetTargetSplitRows = () => {
    if (!window.confirm('重置后将恢复最近一次“生成目标”的建议结果；尚未生成过时会清空明细行。继续吗？')) return
    updateTargetSplitPlan((plan) => ({
      ...plan,
      rows: plan.generatedRows.map((row) => ({ ...row, targets: { ...row.targets } })),
    }))
    setTargetSplitEditingCell(null)
  }
  const loadTargetSplitUnpublishedOrders = async (
    employeeName: DashboardCompanyBoardEmployeeName,
    monthIds?: number[],
  ) => {
    const loadMonth = async (monthId?: number) => {
      const firstPage = await getDashboardUnpublishedOrders(1, 200, monthId, 'total', undefined, employeeName)
      const orders = [...firstPage.orders]
      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const response = await getDashboardUnpublishedOrders(page, 200, monthId, 'total', undefined, employeeName)
        if (response.snapshotUpdatedAt !== firstPage.snapshotUpdatedAt
          || response.orderCount !== firstPage.orderCount
          || response.totalPages !== firstPage.totalPages) {
          throw new Error(`${employeeName}的${monthId ? `方片月${monthId - 139}月` : ''}待发布快照在分页读取期间发生变化，请重新生成目标。`)
        }
        orders.push(...response.orders)
      }
      if (orders.length !== firstPage.orderCount) {
        throw new Error(`${employeeName}的${monthId ? `方片月${monthId - 139}月` : ''}待发布快照分页不完整，无法作为拆分依据。`)
      }
      return { orders, snapshotUpdatedAt: firstPage.snapshotUpdatedAt }
    }
    const monthlyResults = monthIds?.length
      ? await Promise.all(monthIds.map((monthId) => loadMonth(monthId)))
      : [await loadMonth()]
    const snapshotUpdatedAt = monthlyResults[0]?.snapshotUpdatedAt ?? ''
    if (monthlyResults.some((result) => result.snapshotUpdatedAt !== snapshotUpdatedAt)) {
      throw new Error(`${employeeName}的近三个月待发布快照更新时间不一致，请重新生成目标。`)
    }
    return { orders: monthlyResults.flatMap((result) => result.orders), snapshotUpdatedAt }
  }
  const buildRecommendedTargetSplitGoals = (
    totalTarget: number,
    sources: TargetSplitEmployeeSources,
    settings: TargetSplitAllocationSettings,
    financialGoalKeys: readonly TargetSplitFinancialGoalKey[] = TARGET_SPLIT_FINANCIAL_GOAL_KEYS,
  ): Partial<Record<TargetSplitGoalKey, string>> => {
    const publishSnapshots = sources.publish.filter((snapshot): snapshot is DashboardTargetManagementActualsResponse => Boolean(snapshot))
    const baselineDealSnapshot = sources.deal[sources.deal.length - 1]
    const publishWeight = Number(settings.sourceWeights.publish) / 100
    const dealWeight = Number(settings.sourceWeights.deal) / 100
    const unpublishedWeight = Number(settings.sourceWeights.unpublished) / 100
    const getSnapshotMetricAmount = (snapshot: DashboardTargetManagementActualsResponse, goalKey: TargetSplitGoalKey) =>
      snapshot.actuals.reduce((sum, actual) => sum + Number(actual.metrics[TARGET_SPLIT_METRIC_BY_GOAL[goalKey]]?.amount ?? 0), 0)
    const unpublishedAmounts = Object.fromEntries(financialGoalKeys.map((goalKey) => [goalKey, 0])) as Partial<Record<TargetSplitFinancialGoalKey, number>>
    const unpublishedGoalByMetric: Partial<Record<DashboardUnpublishedMetricKey, TargetSplitFinancialGoalKey>> = {
      halfPastTen: 'halfPastTenTarget',
      selfIncubated: 'selfIncubatedTarget',
      signingXiaohongshu: 'signingXiaohongshuTarget',
      signingDouyin: 'signingDouyinTarget',
      signingShipinhao: 'signingShipinhaoTarget',
    }
    for (const order of sources.unpublished ?? []) {
      const goalKey = order.metricKey ? unpublishedGoalByMetric[order.metricKey] : undefined
      if (goalKey && financialGoalKeys.includes(goalKey)) {
        unpublishedAmounts[goalKey] = (unpublishedAmounts[goalKey] ?? 0) + (goalKey === 'halfPastTenTarget' || goalKey === 'selfIncubatedTarget'
          ? Number(order.orderMoney ?? 0)
          : Number(order.incomeMoney ?? 0))
      } else if (financialGoalKeys.includes('outsourcingPerformanceTarget')
        && (Number(order.orderType ?? 0) === 3 || order.metricKey === 'outsourcing')) {
        unpublishedAmounts.outsourcingPerformanceTarget = (unpublishedAmounts.outsourcingPerformanceTarget ?? 0) + Number(order.incomeMoney ?? 0)
      }
    }
    const weightedAmounts = Object.fromEntries(financialGoalKeys.map((goalKey) => {
      const publishAverage = publishSnapshots.length > 0
        ? publishSnapshots.reduce((sum, snapshot) => sum + getSnapshotMetricAmount(snapshot, goalKey), 0) / publishSnapshots.length
        : 0
      const dealAmount = baselineDealSnapshot ? getSnapshotMetricAmount(baselineDealSnapshot, goalKey) : 0
      return [goalKey, publishAverage * publishWeight + dealAmount * dealWeight + (unpublishedAmounts[goalKey] ?? 0) * unpublishedWeight]
    })) as Record<TargetSplitFinancialGoalKey, number>
    const goalUnits = distributeTargetUnits(
      Math.round(totalTarget * 100),
      financialGoalKeys.map((goalKey) => weightedAmounts[goalKey]),
    )
    const recommended = Object.fromEntries(financialGoalKeys.map((goalKey, index) => [
      goalKey,
      ((goalUnits[index] ?? 0) / 100).toFixed(2),
    ])) as Partial<Record<TargetSplitGoalKey, string>>
    const publishOutsourcingAverage = publishSnapshots.length > 0
      ? publishSnapshots.reduce((sum, snapshot) => sum + snapshot.actuals.reduce((actualSum, actual) => actualSum + Number(actual.metrics.outsourcing?.orderCount ?? 0), 0), 0) / publishSnapshots.length
      : 0
    const dealOutsourcingCount = baselineDealSnapshot
      ? baselineDealSnapshot.actuals.reduce((sum, actual) => sum + Number(actual.metrics.outsourcing?.orderCount ?? 0), 0)
      : 0
    const unpublishedOutsourcingCount = (sources.unpublished ?? []).filter((order) => order.metricKey === 'outsourcing').length
    const weightedOutsourcingCount = publishOutsourcingAverage * publishWeight
      + dealOutsourcingCount * dealWeight
      + unpublishedOutsourcingCount * unpublishedWeight
    recommended.outsourcingOrderCountTarget = String(Math.max(0, Math.round(weightedOutsourcingCount)))
    return recommended
  }
  const generateTargetSplit = async (goalInputMode: 'manual' | 'historical' = 'manual') => {
    if (!supportsTargetSplitBoard(selectedName)) return
    const customerTargetInputs = isMuyuanNovemberTargetSplit
      ? Object.fromEntries(targetSplitEmployeeNames.map((employeeName) => [
        employeeName,
        getTargetSplitPersonTargetInputValue(employeeName),
      ])) as Record<string, string>
      : {}
    if (isMuyuanNovemberTargetSplit) {
      const missingEmployees = targetSplitEmployeeNames.filter((employeeName) =>
        customerTargetInputs[employeeName].trim() === '',
      )
      if (missingEmployees.length > 0) {
        setTargetSplitGenerationError(`请填写八位对客人的示例公司有限公司总目标；没有目标的人员请填 0。尚未填写：${missingEmployees.join('、')}。`)
        return
      }
      const invalidEmployees = targetSplitEmployeeNames.filter((employeeName) => {
        const value = Number(customerTargetInputs[employeeName])
        return !Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) >= 0.000001
      })
      if (invalidEmployees.length > 0) {
        setTargetSplitGenerationError(`示例公司有限公司总目标需为非负数且最多两位小数：${invalidEmployees.join('、')}。`)
        return
      }
    }
    const totalTarget = Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim())
    if (!Number.isFinite(totalTarget) || totalTarget <= 0) {
      setTargetSplitGenerationError(isMuyuanNovemberTargetSplit
        ? '八人固定总目标需大于 0；请先核对总目标及固定业绩类别目标。'
        : '请先在“总目标”列输入大于 0 的万元数。')
      return
    }
    if (Math.abs(totalTarget * 100 - Math.round(totalTarget * 100)) >= 0.000001) {
      setTargetSplitGenerationError('总目标金额最多填写两位小数。')
      return
    }
    if ((isMuyuanNovemberTargetSplit || goalInputMode === 'manual') && !targetSplitGoalInputsComplete) {
      setTargetSplitGenerationError(isMuyuanNovemberTargetSplit
        ? '请填写十点半、自孵化、签约小红书/抖音/视频号及外采业绩固定目标；没有目标的类别请填 0。金额最多两位小数。'
        : targetSplitOwnerName === '示例开发01'
        ? '请填写固定的十点半、自孵化、签约小红书/抖音/视频号、外采业绩及外采单数目标；没有目标的项目也请填 0。金额最多两位小数，外采单数请填整数。'
        : '请手动填写十点半、自孵化、签约小红书/抖音/视频号及外采单数目标；没有目标的项目也请填 0。金额最多两位小数，外采单数请填整数。')
      return
    }
    const allocationSettingsError = getTargetSplitAllocationSettingsError(targetSplitPlan.allocationSettings)
    if (allocationSettingsError) {
      setTargetSplitGenerationError(allocationSettingsError)
      return
    }
    let goalTargets = Object.fromEntries(targetSplitGoalKeys.map((goalKey) => {
      const value = Number(targetSplitPlan.goalTargets[goalKey])
      return [goalKey, goalKey === 'outsourcingOrderCountTarget' ? String(value) : value.toFixed(2)]
    })) as TargetSplitPlan['goalTargets']
    const financialGoalTotalCents = targetSplitFinancialGoalKeys.reduce(
      (sum, goalKey) => sum + Math.round(Number(goalTargets[goalKey]) * 100),
      0,
    )
    if (isMuyuanNovemberTargetSplit && financialGoalTotalCents > Math.round(totalTarget * 100)) {
      setTargetSplitGenerationError(`固定类别业绩目标合计为 ${(financialGoalTotalCents / 100).toFixed(2)} 万，超过八人总目标 ${totalTarget.toFixed(2)} 万；请调整目标，未细分目标不能为负数。`)
      return
    }
    if (!isMuyuanNovemberTargetSplit && goalInputMode === 'manual' && financialGoalTotalCents !== Math.round(totalTarget * 100)) {
      setTargetSplitGenerationError(`${targetSplitOwnerName === '示例开发01' ? '六项' : '五项'}业绩目标合计为 ${(financialGoalTotalCents / 100).toFixed(2)} 万，与总目标 ${totalTarget.toFixed(2)} 万不一致；外采单数不计入总目标。`)
      return
    }
    const baselineMonthId = targetSplitMonth - 1
    const historyMonthIds = [targetSplitMonth - 3, targetSplitMonth - 2, targetSplitMonth - 1]
      .filter((monthId) => monthId in DASHBOARD_FANGPIAN_PERIODS)
    if (historyMonthIds.length !== 3) {
      setTargetSplitGenerationError('所选目标月份之前没有完整的三个方片月历史范围。')
      return
    }
    setTargetSplitGenerating(true)
    setTargetSplitGenerationError('')
    setTargetSplitGenerationProgress(isMuyuanNovemberTargetSplit
      ? '正在读取上月发布、上月成单及近三个月未发布订单；不会刷新天玑系统。'
      : targetSplitOwnerName === '示例开发01'
      ? '正在读取近三个月发布、上月成单快照及当前待发布订单；不会刷新天玑系统。'
      : `正在读取${targetSplitOwnerName}本人订单对应的近三个月发布、上月成单快照及当前待发布订单；不会刷新天玑系统。`)
    try {
      const sourcesByEmployee = Object.fromEntries(targetSplitEmployeeNames.map((employeeName) => [employeeName, {
        publish: Array<DashboardTargetManagementActualsResponse | null>(historyMonthIds.length).fill(null),
        deal: Array<DashboardTargetManagementActualsResponse | null>(historyMonthIds.length).fill(null),
        unpublished: null,
        unpublishedUpdatedAt: '',
        errors: {},
      }])) as Record<string, TargetSplitEmployeeSources>
      const unpublishedResultsPromise = Promise.allSettled(
        targetSplitEmployeeNames.map((employeeName) => loadTargetSplitUnpublishedOrders(
          employeeName,
          isMuyuanNovemberTargetSplit ? historyMonthIds : undefined,
        )),
      )
      for (const [monthIndex, monthId] of historyMonthIds.entries()) {
        const monthLabel = DASHBOARD_FANGPIAN_PERIODS[monthId as keyof typeof DASHBOARD_FANGPIAN_PERIODS]?.label ?? `方片月${monthId}`
        if (isMuyuanNovemberTargetSplit && monthId !== baselineMonthId) {
          setTargetSplitGenerationProgress(`跳过${monthLabel}发布和成单快照；本次仅读取上月发布、上月成单及近三个月未发布订单。`)
          continue
        }
        const monthResults = await Promise.all(targetSplitEmployeeNames.map(async (employeeName) => {
          const [publishResult, dealResult] = await Promise.allSettled([
            getTargetManagementActuals(monthId, employeeName, 'publish', targetSplitOwnerName === '示例开发01' && employeeName === '示例对客20' ? '示例开发01' : undefined),
            getTargetManagementActuals(monthId, employeeName, 'deal', targetSplitOwnerName === '示例开发01' && employeeName === '示例对客20' ? '示例开发01' : undefined),
          ])
          return { employeeName, publishResult, dealResult }
        }))
        monthResults.forEach(({ employeeName, publishResult, dealResult }) => {
          const sources = sourcesByEmployee[employeeName]
          if (publishResult.status === 'fulfilled') sources.publish[monthIndex] = publishResult.value
          else {
            sources.errors.publish ??= []
            sources.errors.publish[monthIndex] = `${monthLabel}: ${publishResult.reason instanceof Error ? publishResult.reason.message : String(publishResult.reason)}`
          }
          if (dealResult.status === 'fulfilled') sources.deal[monthIndex] = dealResult.value
          else {
            sources.errors.deal ??= []
            sources.errors.deal[monthIndex] = `${monthLabel}: ${dealResult.reason instanceof Error ? dealResult.reason.message : String(dealResult.reason)}`
          }
        })
        setTargetSplitGenerationProgress(`已读取 ${monthIndex + 1}/${historyMonthIds.length} 个历史方片月：${monthLabel}…`)
      }
      const unpublishedResults = await unpublishedResultsPromise
      unpublishedResults.forEach((result, employeeIndex) => {
        const employeeName = targetSplitEmployeeNames[employeeIndex]
        const sources = sourcesByEmployee[employeeName]
        if (result.status === 'fulfilled') {
          sources.unpublished = result.value.orders
          sources.unpublishedUpdatedAt = result.value.snapshotUpdatedAt
        } else {
          sources.errors.unpublished = [result.reason instanceof Error ? result.reason.message : String(result.reason)]
        }
      })
      const baselineMonthIndex = historyMonthIds.indexOf(baselineMonthId)
      const hasCompletePublishSource = isMuyuanNovemberTargetSplit
        ? baselineMonthIndex >= 0 && targetSplitEmployeeNames.every((employeeName) =>
          sourcesByEmployee[employeeName]?.publish[baselineMonthIndex] !== null
            && sourcesByEmployee[employeeName]?.publish[baselineMonthIndex] !== undefined,
        )
        : historyMonthIds.some((_, monthIndex) => targetSplitEmployeeNames.every((employeeName) =>
          sourcesByEmployee[employeeName]?.publish[monthIndex] !== null
            && sourcesByEmployee[employeeName]?.publish[monthIndex] !== undefined,
        ))
      const hasCompleteDealSource = baselineMonthIndex >= 0
        && targetSplitEmployeeNames.every((employeeName) =>
          sourcesByEmployee[employeeName]?.deal[baselineMonthIndex] !== null
            && sourcesByEmployee[employeeName]?.deal[baselineMonthIndex] !== undefined,
        )
      const hasCompleteUnpublishedSource = targetSplitEmployeeNames.every((employeeName) =>
        sourcesByEmployee[employeeName]?.unpublished !== null
          && sourcesByEmployee[employeeName]?.unpublished !== undefined,
      )
      if (!hasCompletePublishSource || !hasCompleteDealSource || !hasCompleteUnpublishedSource) {
        const describeMissingEmployees = (source: TargetSplitSourceKey, monthIndex?: number) => {
          const missingEmployees = targetSplitEmployeeNames.flatMap((employeeName) => {
            const sources = sourcesByEmployee[employeeName]
            const missingMonthIndexes = monthIndex === undefined
              ? historyMonthIds.flatMap((_, index) => sources?.[source][index] === null || sources?.[source][index] === undefined ? [index] : [])
              : sources?.[source][monthIndex] === null || sources?.[source][monthIndex] === undefined ? [monthIndex] : []
            if (missingMonthIndexes.length === 0) return []
            const failureDetails = missingMonthIndexes.map((index) => {
              const monthId = historyMonthIds[index]
              const monthLabel = DASHBOARD_FANGPIAN_PERIODS[monthId as keyof typeof DASHBOARD_FANGPIAN_PERIODS]?.label ?? `方片月${monthId}`
              const rawReason = sources?.errors[source]?.[index]?.replace(`${monthLabel}: `, '')
              const reason = rawReason && rawReason.length > 80 ? `${rawReason.slice(0, 80)}…` : rawReason
              return reason ? `${monthLabel}（${reason}）` : monthLabel
            })
            return [`${employeeName}（${failureDetails.join('、')}）`]
          })
          return missingEmployees.join('、') || '接口未返回快照数据'
        }
        const diagnostics = [
          !hasCompletePublishSource
            ? isMuyuanNovemberTargetSplit
              ? `上月发布（${DASHBOARD_FANGPIAN_PERIODS[baselineMonthId as keyof typeof DASHBOARD_FANGPIAN_PERIODS]?.label ?? `方片月${baselineMonthId}`}）：${describeMissingEmployees('publish', baselineMonthIndex >= 0 ? baselineMonthIndex : undefined)}`
              : `近三个月发布：${historyMonthIds.map((monthId, monthIndex) => {
                const monthLabel = DASHBOARD_FANGPIAN_PERIODS[monthId as keyof typeof DASHBOARD_FANGPIAN_PERIODS]?.label ?? `方片月${monthId}`
                const missingEmployees = describeMissingEmployees('publish', monthIndex)
                return missingEmployees === '接口未返回快照数据' ? '' : `${monthLabel}缺少${missingEmployees}`
              }).filter(Boolean).join('；') || describeMissingEmployees('publish')}`
            : '',
          !hasCompleteDealSource
            ? `上月成单（${DASHBOARD_FANGPIAN_PERIODS[baselineMonthId as keyof typeof DASHBOARD_FANGPIAN_PERIODS]?.label ?? `方片月${baselineMonthId}`}）：${describeMissingEmployees('deal', baselineMonthIndex >= 0 ? baselineMonthIndex : undefined)}`
            : '',
          !hasCompleteUnpublishedSource
            ? `${isMuyuanNovemberTargetSplit ? '近三个月未发布' : '当前待发布'}：${targetSplitEmployeeNames.flatMap((employeeName) => {
              const sources = sourcesByEmployee[employeeName]
              if (sources?.unpublished !== null && sources?.unpublished !== undefined) return []
              const reason = sources?.errors.unpublished?.[0]
              return [reason ? `${employeeName}（${reason}）` : employeeName]
            }).join('、') || '接口未返回快照数据'}`
            : '',
        ].filter(Boolean)
        setTargetSplitGenerationError(`目标拆分需要完整读取发布、成单和待发布快照；本次未读齐：${diagnostics.join('；')}。`)
        setTargetSplitGenerationProgress('')
        return
      }
      targetSplitSnapshotCacheRef.current[`${targetSplitOwnerName}:${targetSplitMonth}`] = { historyMonthIds, sourcesByEmployee }
      const allocationSourcesByEmployee = isMuyuanNovemberTargetSplit
        ? Object.fromEntries(targetSplitEmployeeNames.map((employeeName) => {
          const sources = sourcesByEmployee[employeeName]
          return [employeeName, {
            ...sources,
            publish: sources.publish.map((snapshot, monthIndex) => historyMonthIds[monthIndex] === baselineMonthId ? snapshot : null),
            deal: sources.deal.map((snapshot, monthIndex) => historyMonthIds[monthIndex] === baselineMonthId ? snapshot : null),
          }]
        })) as Record<string, TargetSplitEmployeeSources>
        : sourcesByEmployee
      if (!isMuyuanNovemberTargetSplit && goalInputMode === 'historical') {
        const recommendedGoalTargets = buildRecommendedTargetSplitGoals(
          totalTarget,
          sourcesByEmployee[targetSplitOwnerName],
          targetSplitPlan.allocationSettings,
          targetSplitFinancialGoalKeys,
        )
        const currentOutsourcingTarget = targetSplitPlan.goalTargets.outsourcingOrderCountTarget?.trim()
        goalTargets = {
          ...recommendedGoalTargets,
          outsourcingOrderCountTarget: currentOutsourcingTarget || recommendedGoalTargets.outsourcingOrderCountTarget || '0',
        } as TargetSplitPlan['goalTargets']
      }
      const allocation = buildTargetSplitPlanFromSnapshots(
        targetSplitMonth,
        historyMonthIds,
        totalTarget.toFixed(2),
        goalTargets,
        allocationSourcesByEmployee,
        toTargetSplitAllocationParameters(targetSplitPlan.allocationSettings),
        targetSplitEmployeeNames,
        isPersonalTargetSplitOwner(targetSplitOwnerName) && targetSplitPlan.personalOpportunityStructureInitialized
          ? targetSplitPlan.rows
        : undefined,
        targetSplitFinancialGoalKeys,
        undefined,
        isMuyuanNovemberTargetSplit ? { publish: [baselineMonthId], deal: [baselineMonthId] } : undefined,
        isMuyuanNovemberTargetSplit ? customerTargetInputs : undefined,
        !isMuyuanNovemberTargetSplit,
      )
      if (!allocation.hasHistoricalPerformance) {
        setTargetSplitGenerationError('已读取快照，但发布、成单和待发布数据均无可用业绩，不能按均分方式生成目标。')
        setTargetSplitGenerationProgress('')
        return
      }
      const generatedRows = allocation.rows.map((row) => ({ ...row, targets: { ...row.targets } }))
      const nextPlan: TargetSplitPlan = {
        ...targetSplitPlan,
        totalTarget: totalTarget.toFixed(2),
        goalTargets,
        allocationSettings: targetSplitPlan.allocationSettings,
        preserveOpportunityStructure: isPersonalTargetSplitOwner(targetSplitOwnerName) || targetSplitPlan.preserveOpportunityStructure,
        personalOpportunityStructureInitialized: isPersonalTargetSplitOwner(targetSplitOwnerName)
          || targetSplitPlan.personalOpportunityStructureInitialized,
        rows: generatedRows.map((row) => ({ ...row, targets: { ...row.targets } })),
        generatedRows,
        customerTargets: allocation.customerTargets,
        generatedCustomerTargets: isMuyuanNovemberTargetSplit
          ? Object.fromEntries(targetSplitEmployeeNames.map((employeeName) => [employeeName, Number(customerTargetInputs[employeeName]).toFixed(2)]))
          : allocation.customerTargets,
        importedCustomerTargetNames: [],
        customerGoalTargets: allocation.customerGoalTargets,
        customerRationales: allocation.customerRationales,
        companyRationales: allocation.companyRationales,
        generatedGoalTargets: goalTargets,
        sourceWarnings: allocation.sourceWarnings,
        baselineMonthId: allocation.baselineMonthId,
        allocationPolicyVersion: getTargetSplitAllocationPolicyVersion(targetSplitOwnerName, targetSplitMonth),
        sourceUpdatedAt: allocation.sourceUpdatedAt,
        generatedAt: new Date().toISOString(),
      }
      updateTargetSplitPlan(() => nextPlan)
      setTargetSplitGenerationProgress(isMuyuanNovemberTargetSplit
        ? '已按示例公司有限公司目标及上月发布、上月成单、近三个月未发布订单完成八人间拆分；“未细分目标”按八人总目标减去当行固定类别目标合计即时计算。'
        : `当前来源权重、示例公司有限公司系数及外采单数档位已应用；金额不按档位排序；固定类别目标总额未变，拆分结果已保存到此浏览器。${isPersonalTargetSplitOwner(targetSplitOwnerName) ? `公司、平台及项目依据${targetSplitOwnerName}本人订单生成；此后重新生成会保留示例公司有限公司配置的公司和项目增删。` : ''}${targetSplitOwnerName === '示例对客16' ? '外采单数不分配给示例公司01有限公司和示例公司02有限公司。' : ''}`)
    } catch (error) {
      setTargetSplitGenerationError(error instanceof Error ? error.message : '读取快照失败，请稍后重试。')
      setTargetSplitGenerationProgress('')
    } finally {
      setTargetSplitGenerating(false)
    }
  }
  const applyTargetSplitImport = async () => {
    if (targetSplitImportLoading) return
    const importEmployeeNames = targetSplitImportEmployeeName
      ? [targetSplitImportEmployeeName]
      : targetSplitEmployeeNames
    if (targetSplitOwnerName !== '示例开发01' && !targetSplitGenerationMatchesGoalInputs) {
      setTargetSplitImportError('固定目标已修改或尚未生成拆分结果，请先点击“生成目标”。')
      return
    }
    const incompleteRowCount = targetSplitImportEmployeeName
      ? getTargetSplitPersonIncompleteRowCount(targetSplitImportEmployeeName)
      : targetSplitIncompleteRowCount
    if (targetSplitOwnerName !== '示例开发01' && incompleteRowCount > 0) {
      setTargetSplitImportError(targetSplitImportEmployeeName
        ? `${targetSplitImportEmployeeName}还有 ${incompleteRowCount} 行已填写目标但缺少对客人、公司、平台或项目品牌，请补齐后再导入。`
        : `还有 ${incompleteRowCount} 行已填写目标但缺少对客人、公司、平台或项目品牌，请补齐后再导入。`)
      return
    }
    if (importEmployeeNames.every((employeeName) => getTargetSplitPersonTarget(employeeName) <= 0)) {
      setTargetSplitImportError(targetSplitImportEmployeeName
        ? `${targetSplitImportEmployeeName}当前没有分配目标，无法导入。`
        : '当前没有可导入的对客人目标。')
      return
    }
    setTargetSplitImportLoading(true)
    setTargetSplitImportError('')
    try {
      if (targetSplitOwnerName !== '示例开发01') {
        for (const employeeName of importEmployeeNames) {
          const employeeRows = targetSplitImportableRows.filter((row) => row.customerFacingPerson === employeeName)
          const previousLayout = readWangYueTargetManagementLayouts(employeeName)[targetSplitMonth]
          const companySlots = [...new Set(employeeRows.map((row) => row.companyName.trim()).filter(Boolean))]
          const companySlotIndexes = new Map(companySlots.map((companyName, index) => [companyName, index]))
          const brandFilters: Record<string, string> = {}
          const brandSlotCounts: Record<string, number> = {}
          const brandIndexesByGroup = new Map<string, number>()
          const nextGoals = Object.fromEntries(Object.entries(readTargetManagementGoals(employeeName)).flatMap(([goalKey, values]) => {
            if (!goalKey.startsWith(`${targetSplitMonth}:`) || goalKey === `${targetSplitMonth}:total-target`) return [[goalKey, values]]
            return values.contactPerson ? [[goalKey, { contactPerson: values.contactPerson }]] : []
          })) as WangYueTargetManagementGoals
          const employeeTarget = getTargetSplitPersonTarget(employeeName)
          const totalTargetKey = `${targetSplitMonth}:total-target`
          nextGoals[totalTargetKey] = { ...nextGoals[totalTargetKey], totalTarget: employeeTarget.toFixed(2) }
          for (const row of employeeRows) {
            const slotIndex = companySlotIndexes.get(row.companyName.trim()) ?? 0
            const groupKey = `${slotIndex}:${row.platformId}`
            const brandIndex = row.platformId === 0 || !row.projectBrand.trim()
              ? 0
              : brandIndexesByGroup.get(groupKey) ?? 0
            if (row.platformId !== 0 && row.projectBrand.trim()) {
              brandFilters[`${groupKey}:${brandIndex}`] = row.projectBrand.trim()
              brandIndexesByGroup.set(groupKey, brandIndex + 1)
              brandSlotCounts[groupKey] = brandIndex + 1
            } else if (brandSlotCounts[groupKey] === undefined) {
              brandSlotCounts[groupKey] = row.platformId === 0 ? 1 : 0
            }
            const goalKey = `${targetSplitMonth}:${row.companyName.trim()}:${row.platformId}:${row.projectBrand.trim()}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
            const rowGoals = { ...nextGoals[goalKey], importedEmptyProjectRow: row.projectBrand.trim() ? undefined : 'true' }
            for (const targetKey of WANGYUE_TARGET_MANAGEMENT_MERGEABLE_TARGET_KEYS) {
              delete rowGoals[getTargetManagementMergeGroupGoalKey(targetKey)]
            }
            for (const targetKey of [...TARGET_SPLIT_FINANCIAL_GOAL_KEYS, 'outsourcingOrderCountTarget'] as TargetSplitGoalKey[]) {
              const targetValue = row.targets[targetKey]?.trim()
              if (targetValue && Number(targetValue) >= 0) rowGoals[targetKey] = targetValue
              else delete rowGoals[targetKey]
            }
            if (Object.keys(rowGoals).length > 0) nextGoals[goalKey] = rowGoals
          }
          for (const [slotIndex] of companySlots.entries()) {
            for (const platform of WANGYUE_TARGET_MANAGEMENT_PLATFORMS) {
              const groupKey = `${slotIndex}:${platform.id}`
              if (brandSlotCounts[groupKey] === undefined) brandSlotCounts[groupKey] = 0
            }
          }
          localStorage.setItem(getTargetManagementGoalsStorageKey(employeeName), JSON.stringify(nextGoals))
          const layout: WangYueTargetManagementLayout = {
            companySlots,
            brandFilters,
            subBrandFilters: {},
            brandSlotCounts,
            productLines: previousLayout?.productLines ?? {},
          }
          saveWangYueTargetManagementLayout(targetSplitMonth, layout, employeeName)
          if (selectedName === employeeName) {
            setWangYueTargetManagementGoals(nextGoals)
            setWangYueTargetManagementMonth(targetSplitMonth)
            setWangYueTargetManagementCompanySlots(companySlots)
            setWangYueTargetManagementBrandFilters(brandFilters)
            setWangYueTargetManagementSubBrandFilters({})
            setWangYueTargetManagementBrandSlotCounts(brandSlotCounts)
            setWangYueTargetManagementProductLines(layout.productLines)
            setWangYueTargetManagementBrandResetTokens({})
          }
        }
      }
      if (targetSplitOwnerName === '示例开发01') {
        const importedAt = new Date().toISOString()
        const importedCustomerPlans: Array<{ employeeName: string; plan: TargetSplitPlan }> = []
        for (const employeeName of importEmployeeNames) {
          const employeeRows = targetSplitImportableRows.filter((row) => row.customerFacingPerson === employeeName)
          const personTarget = getTargetSplitPersonTarget(employeeName)
          if (personTarget <= 0 && employeeRows.length === 0) continue
          const assignedGoalTargets = targetSplitPlan.customerGoalTargets[employeeName]
          const hasAssignedFinancialGoals = targetSplitFinancialGoalKeys.some((goalKey) =>
            assignedGoalTargets?.[goalKey] !== undefined && assignedGoalTargets[goalKey] !== '',
          )
          const goalTargets = Object.fromEntries(targetSplitGoalKeys.map((goalKey) => {
            const assignedValue = assignedGoalTargets?.[goalKey]
            const total = assignedValue !== undefined && assignedValue !== ''
              ? Number(assignedValue) || 0
              : goalKey === 'outsourcingOrderCountTarget' || !hasAssignedFinancialGoals
                ? getTargetSplitCustomerGoalTotal(employeeName, goalKey)
                : 0
            return [goalKey, goalKey === 'outsourcingOrderCountTarget' ? String(Math.round(total)) : total.toFixed(2)]
          })) as TargetSplitPlan['goalTargets']
          const rows = alignTargetSplitRowsToGoalTargets(employeeRows.map((row, index): TargetSplitRow => ({
            id: `imported-${targetSplitMonth}-${employeeName}-${index}`,
            customerFacingPerson: employeeName,
            companyName: row.companyName.trim(),
            platformId: row.platformId,
            projectBrand: row.platformId === 0 ? '' : row.projectBrand.trim(),
            targets: Object.fromEntries(Object.entries(row.targets).filter(([goalKey]) =>
              targetSplitGoalKeys.includes(goalKey as TargetSplitGoalKey),
            )) as TargetSplitRow['targets'],
          })), goalTargets, targetSplitFinancialGoalKeys)
          const previousPlan = targetSplitPlansByOwnerRef.current[employeeName]?.[targetSplitMonth]
          const plan: TargetSplitPlan = {
            ...(previousPlan ?? createEmptyTargetSplitPlan()),
            totalTarget: personTarget.toFixed(2),
            goalTargets,
            preserveOpportunityStructure: false,
            personalOpportunityStructureInitialized: false,
            rows,
            generatedRows: rows.map((row) => ({ ...row, targets: { ...row.targets } })),
            customerTargets: { [employeeName]: personTarget.toFixed(2) },
            generatedCustomerTargets: { [employeeName]: personTarget.toFixed(2) },
            customerGoalTargets: { [employeeName]: goalTargets },
            customerRationales: {
              [employeeName]: `由示例开发01在方片月${targetSplitMonth - 139}月的【听说】总拆分中导入。顶部总目标与下方 ${rows.length} 行公司/平台/项目目标来自本次导入，不按${employeeName}本人的自动拆分逻辑重算。`,
            },
            generatedGoalTargets: goalTargets,
            sourceWarnings: [],
            baselineMonthId: targetSplitPlan.baselineMonthId,
            allocationPolicyVersion: TARGET_SPLIT_TEAM_ALLOCATION_POLICY_VERSION,
            sourceUpdatedAt: targetSplitPlan.sourceUpdatedAt,
            generatedAt: importedAt,
          }
          importedCustomerPlans.push({ employeeName, plan })
        }
        setTargetSplitPlansByOwner((current) => {
          const next = { ...current }
          for (const { employeeName, plan } of importedCustomerPlans) {
            next[employeeName] = {
              ...(current[employeeName] ?? {}),
              [targetSplitMonth]: plan,
            }
          }
          return next
        })
        if (targetSplitMonth === 150) {
          try {
            await Promise.all(importedCustomerPlans.map(({ employeeName, plan }) =>
              enqueueTargetSplitCloudSave(employeeName, targetSplitMonth, plan)))
          } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误'
            throw new Error(`示例公司有限公司【听说】计划已写入本机，但同步共享云端失败：${message}`)
          }
        }
      }
      setTargetSplitImportNotice(targetSplitImportEmployeeName
        ? targetSplitOwnerName === '示例开发01'
          ? `已将方片月${targetSplitMonth - 139}月${targetSplitImportEmployeeName}的目标写入其【听说】看板：顶部为示例公司有限公司总目标，下方 ${targetSplitImportScopeRows.length} 行公司/平台/项目目标同步更新；外采业绩计入总目标，外采单数单独记录。${targetSplitMonth === 150 ? '本月计划已同步至共享云端。' : ''}其他对客人及其他月份不受影响。`
          : `已将方片月${targetSplitMonth - 139}月${targetSplitImportEmployeeName}的拆分目标写入其目标管理看板。总目标为示例公司有限公司分配值；外采单数单独写入，不计入业绩总目标。其他对客人及其他月份数据保留；本次未触发业绩抓取。`
        : targetSplitOwnerName === '示例开发01'
          ? `已将方片月${targetSplitMonth - 139}月拆分目标写入八位对客人的【听说】看板：各人顶部为示例公司有限公司总目标，下方公司/平台/项目目标同步更新；外采业绩计入业绩总目标，外采单数单独记录。${targetSplitMonth === 150 ? '本月计划已同步至共享云端。' : ''}`
          : `已将方片月${targetSplitMonth - 139}月${targetSplitOwnerName}的拆分目标写入其目标管理看板。总目标为本人分配值；外采单数单独写入，不计入业绩总目标。其他月份数据保留；本次未触发业绩抓取。`)
      setTargetSplitImportOpen(false)
      setTargetSplitImportEmployeeName(null)
    } catch (error) {
      setTargetSplitImportError(error instanceof Error ? error.message : '导入失败，请检查浏览器本地存储后重试。')
    } finally {
      setTargetSplitImportLoading(false)
    }
  }
  const getTargetSplitGridTemplateColumns = (boardColumns: ReadonlyArray<{ key: string; kind: string }> = getTargetSplitBoardColumns(), isPersonalBoard = false) => boardColumns.map((column) => {
    if (isPersonalBoard && column.key === 'companyName') return '275px'
    if (isPersonalBoard && (column.key === 'platform' || column.key === 'projectBrand')) return '140px'
    if (isPersonalBoard && column.key === 'brandTotalTarget') return '120px'
    if (column.key === 'totalTarget') return '132px'
    if (column.key === 'customerFacingPerson') return '156px'
    if (column.key === 'actions') return 'minmax(80px, .55fr)'
    if (column.kind === 'target') return '177px'
    return 'minmax(140px, .95fr)'
  }).join(' ')
  const getTargetSplitSummaryGridTemplateColumns = (summaryColumns: ReadonlyArray<{ key: string; kind: string }> = getTargetSplitSummaryColumns()) => summaryColumns.map((column) => {
    if (column.key === 'totalTarget') return '132px'
    if (column.key === 'customerFacingPerson') return '156px'
    if (column.key === 'unallocatedTarget') return '100px'
    if (column.kind === 'target') return '177px'
    return 'minmax(150px, 1fr)'
  }).join(' ')
  const exportTargetSplitWorkbook = async () => {
    const XLSX = await import('xlsx')
    const goalLabels: Record<TargetSplitGoalKey, string> = {
      halfPastTenTarget: '十点半目标（万元）',
      selfIncubatedTarget: '自孵化（不含十点半）目标（万元）',
      signingXiaohongshuTarget: '签约小红书目标（万元）',
      signingDouyinTarget: '签约抖音目标（万元）',
      signingShipinhaoTarget: '签约视频号目标（万元）',
      outsourcingPerformanceTarget: '外采业绩目标（万元）',
      outsourcingOrderCountTarget: '外采单数目标（单）',
    }
    const headers = [
      '数据类型', '负责人', '方片月ID', '对客人', '公司', '平台ID', '平台', '项目品牌', '明细ID',
      '总目标（万元）', '未细分目标（自动计算）', ...targetSplitGoalKeys.map((goalKey) => goalLabels[goalKey]),
    ]
    const excelNumber = (value: string | undefined): string | number => value?.trim() && Number.isFinite(Number(value)) ? Number(value) : ''
    const goalValues = (values: Partial<Record<TargetSplitGoalKey, string>>) =>
      targetSplitGoalKeys.map((goalKey) => excelNumber(values[goalKey]))
    const sumCustomerGoals = (employeeName: string) => targetSplitGoalKeys.reduce(
      (sum, goalKey) => sum + (goalKey === 'outsourcingOrderCountTarget' ? 0 : getTargetSplitCustomerGoalTotal(employeeName, goalKey)),
      0,
    )
    const totalGoalSum = targetSplitGoalKeys.reduce(
      (sum, goalKey) => sum + (goalKey === 'outsourcingOrderCountTarget' ? 0 : Number(targetSplitPlan.goalTargets[goalKey]) || 0),
      0,
    )
    const workbookRows: Array<Array<string | number>> = [
      ['导入格式', '目标拆分V1'],
      ['负责人', targetSplitOwnerName, '方片月ID', targetSplitMonth],
      [],
      headers,
      [
        '团队总目标', targetSplitOwnerName, targetSplitMonth, '', '', '', '', '', '', excelNumber(targetSplitPlan.totalTarget),
        (Number(targetSplitPlan.totalTarget) - totalGoalSum).toFixed(2), ...goalValues(targetSplitPlan.goalTargets),
      ],
      ...targetSplitEmployeeNames.map((employeeName) => {
        const personTarget = getTargetSplitPersonTargetInputValue(employeeName)
        const customerGoals = Object.fromEntries(targetSplitGoalKeys.map((goalKey) => [
          goalKey,
          goalKey === 'outsourcingOrderCountTarget'
            ? targetSplitPlan.customerGoalTargets[employeeName]?.[goalKey] ?? ''
            : getTargetSplitCustomerGoalTotal(employeeName, goalKey).toFixed(2),
        ])) as Partial<Record<TargetSplitGoalKey, string>>
        return [
          '示例公司有限公司目标', targetSplitOwnerName, targetSplitMonth, employeeName, '', '', '', '', '', excelNumber(personTarget),
          (Number(personTarget) - sumCustomerGoals(employeeName)).toFixed(2), ...goalValues(customerGoals),
        ]
      }),
      ...targetSplitPlan.rows.map((row) => [
        '公司明细', targetSplitOwnerName, targetSplitMonth, row.customerFacingPerson, row.companyName,
        row.platformId ?? '', TARGET_SPLIT_PLATFORMS.find((platform) => platform.id === row.platformId)?.name ?? '',
        row.projectBrand, row.id, '', '', ...goalValues(row.targets),
      ]),
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(workbookRows)
    worksheet['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 24 },
      { wch: 24 }, { wch: 18 }, { wch: 24 }, ...targetSplitGoalKeys.map(() => ({ wch: 24 })),
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '目标拆分')
    XLSX.writeFile(workbook, `${targetSplitOwnerName}_听说目标拆分_方片月${targetSplitMonth - 139}月.xlsx`)
  }
  const loadTargetSplitWorkbookImportPreview = async (
    fileOverride?: File,
    modeOverride: 'link' | 'file' | 'image' = targetSplitWorkbookImportMode,
  ) => {
    if (targetSplitWorkbookImportLoading) return
    const selectedFile = fileOverride ?? targetSplitWorkbookImportFile
    if (modeOverride === 'link' && !targetSplitWorkbookImportUrl.trim()) {
      setTargetSplitWorkbookImportError('请粘贴企微在线表格链接')
      return
    }
    if (modeOverride === 'file' && !selectedFile) {
      setTargetSplitWorkbookImportError('请选择要导入的Excel文件')
      return
    }
    if (modeOverride === 'image' && !selectedFile) {
      setTargetSplitWorkbookImportError('请选择图片，或先复制图片并在粘贴区域按 Ctrl+V / ⌘+V')
      return
    }
    if (modeOverride === 'image' && selectedFile && !/^image\/(png|jpe?g|webp|bmp|gif|tiff)$/.test(selectedFile.type.toLowerCase())) {
      setTargetSplitWorkbookImportError('图片格式不支持，请上传 PNG、JPG、WEBP、BMP、GIF 或 TIFF 图片')
      return
    }
    if (modeOverride === 'image' && selectedFile && selectedFile.size > 9 * 1024 * 1024) {
      setTargetSplitWorkbookImportError('图片需小于 9 MB，请压缩或裁剪后重试')
      return
    }
    setTargetSplitWorkbookImportLoading(true)
    setTargetSplitWorkbookImportError('')
    setTargetSplitWorkbookImportPreview(null)
    setTargetSplitWorkbookImportProgress('正在准备读取…')
    try {
      const onProgress = (progress: string) => setTargetSplitWorkbookImportProgress(progress)
      const preview = modeOverride === 'link'
        ? await previewTargetSplitWorkbookLinkImport(targetSplitWorkbookImportUrl.trim(), targetSplitOwnerName, targetSplitMonth, onProgress)
        : modeOverride === 'file'
          ? await previewTargetSplitWorkbookFileImport(selectedFile!, targetSplitOwnerName, targetSplitMonth, onProgress)
          : await previewTargetSplitImageImport(selectedFile!, targetSplitOwnerName, targetSplitMonth, onProgress)
      setTargetSplitWorkbookImportPreview(preview)
    } catch (error) {
      setTargetSplitWorkbookImportError(error instanceof Error ? error.message : '读取失败，请检查链接或表格文件。')
    } finally {
      setTargetSplitWorkbookImportLoading(false)
    }
  }
  const startTargetSplitImageRecognition = (image: File) => {
    if (targetSplitWorkbookImportLoading) return
    const extensionByType: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/gif': 'gif',
      'image/tiff': 'tiff',
    }
    const file = image.name ? image : new File([image], `粘贴图片.${extensionByType[image.type] ?? 'png'}`, { type: image.type })
    setTargetSplitWorkbookImportMode('image')
    setTargetSplitWorkbookImportFile(file)
    setTargetSplitWorkbookImportError('')
    setTargetSplitWorkbookImportPreview(null)
    void loadTargetSplitWorkbookImportPreview(file, 'image')
  }
  const applyTargetSplitWorkbookImport = () => {
    const preview = targetSplitWorkbookImportPreview
    if (!preview) return
    const importedGoalKeys = preview.goalKeys.filter((goalKey): goalKey is TargetSplitGoalKey =>
      (TARGET_SPLIT_ALL_GOAL_KEYS as string[]).includes(goalKey),
    )
    const mergeGoalValues = (
      existing: Partial<Record<TargetSplitGoalKey, string>> = {},
      incoming: Record<string, string>,
    ) => {
      const next = { ...existing }
      for (const goalKey of importedGoalKeys) next[goalKey] = incoming[goalKey] ?? ''
      return next
    }
    updateTargetSplitPlan((plan) => {
      const customerGoalTargets = { ...plan.customerGoalTargets }
      for (const [employeeName, goalValues] of Object.entries(preview.customerGoalTargets)) {
        customerGoalTargets[employeeName] = mergeGoalValues(customerGoalTargets[employeeName], goalValues)
      }
      const importedRows = preview.rows.map((row) => ({
        ...row,
        targets: mergeGoalValues({}, row.targets),
      }))
      return {
        ...plan,
        totalTarget: preview.totalTarget,
        goalTargets: mergeGoalValues(plan.goalTargets, preview.goalTargets),
        customerTargets: { ...plan.customerTargets, ...preview.customerTargets },
        importedCustomerTargetNames: targetSplitOwnerName === '示例开发01'
          ? [...new Set([...plan.importedCustomerTargetNames, ...Object.keys(preview.customerTargets)])]
          : plan.importedCustomerTargetNames,
        customerGoalTargets,
        rows: preview.hasDetailTable ? importedRows : plan.rows,
        generatedRows: preview.hasDetailTable ? importedRows.map((row) => ({ ...row, targets: { ...row.targets } })) : plan.generatedRows,
      }
    })
    setTargetSplitWorkbookImportOpen(false)
    setTargetSplitWorkbookImportPreview(null)
    setTargetSplitWorkbookImportFile(null)
    setTargetSplitImportNotice(`已将${preview.sourceName}中的目标导入${targetSplitOwnerName}方片月${targetSplitMonth - 139}月看板；修改将自动同步到云端。`)
  }
  const renderTargetSplitBoardHeader = () => (
    <>
      <div className="supplementary-dashboard-title-group target-management-dashboard-title-group">
        <div className="dimension-switcher" role="group" aria-label="目标拆分看板维度">
          <span className="dimension-switcher-button publish active" aria-current="true">发布</span>
        </div>
        <h2>发布 · {selectedName} · 听说你还不会拆？</h2>
      </div>
      {targetSplitBoardHasAnyPlan ? <div className="target-management-dashboard-controls">
        <label className="dashboard-month-filter">
          月份
          <select value={targetSplitMonth} onChange={(event) => {
            const monthId = Number(event.target.value) as TargetSplitMonthId
            if (TARGET_SPLIT_MONTH_IDS.includes(monthId)) setTargetSplitMonth(monthId)
          }}>
            {TARGET_SPLIT_MONTH_IDS.map((monthId) => (
              <option key={monthId} value={monthId}>{DASHBOARD_FANGPIAN_PERIODS[monthId].label}</option>
            ))}
          </select>
        </label>
        {isPersonalTargetSplitOwner(targetSplitOwnerName) ? (
          <label className="target-split-toolbar-total">
            <span>总目标（万元）</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetSplitPlan.totalTarget}
              aria-label={`${targetSplitOwnerName}总目标`}
              onChange={(event) => {
                const totalTarget = event.currentTarget.value
                updateTargetSplitPlan((plan) => ({ ...plan, totalTarget }))
              }}
            />
          </label>
        ) : null}
        {supportsTargetSplitBoard(selectedName) ? <>
          <button type="button" className="target-management-import-button" disabled={targetSplitGenerating || Number(targetSplitPlan.totalTarget) <= 0} onClick={() => void generateTargetSplit()}>
            {targetSplitGenerating ? '生成中…' : '生成目标'}
          </button>
          {targetSplitOwnerName !== '示例开发01' ? <button type="button" className="target-management-import-button" disabled={targetSplitGenerating || targetSplitImportLoading} onClick={() => {
            setTargetSplitImportError('')
            setTargetSplitImportEmployeeName(null)
            setTargetSplitImportOpen(true)
          }}>导入目标管理</button> : null}
          {targetSplitMonth === 150 ? <>
            <button type="button" className="target-management-import-button" disabled={targetSplitGenerating} onClick={() => void exportTargetSplitWorkbook()}>
              导出Excel
            </button>
            <button type="button" className="target-management-import-button" disabled={targetSplitGenerating || targetSplitWorkbookImportLoading} onClick={() => {
              setTargetSplitWorkbookImportError('')
              setTargetSplitWorkbookImportPreview(null)
              setTargetSplitWorkbookImportFile(null)
              setTargetSplitWorkbookImportMode('link')
              setTargetSplitWorkbookImportOpen(true)
            }}>
              导入企微/Excel/图片
            </button>
          </> : null}
        </> : null}
        {targetSplitOwnerName === '示例开发01' && supportsTargetSplitBoard(selectedName) ? (
          <button
            type="button"
            className="target-management-import-button"
            disabled={targetSplitGenerating || targetSplitBoardImportLoading}
            onClick={() => void importTargetSplitPeopleToTargetBoard()}
          >
            {targetSplitBoardImportLoading ? '导入中…' : '导入目标看板'}
          </button>
        ) : null}
        {targetSplitOwnerName === '示例开发01' && targetSplitBoardImportFeedback ? (
          <div className={`target-split-board-import-feedback is-${targetSplitBoardImportFeedback.status}`}
            role={targetSplitBoardImportFeedback.status === 'error' ? 'alert' : 'status'}>
            {targetSplitBoardImportFeedback.message}
          </div>
        ) : null}
        {targetSplitCloudSyncKey ? (
          <div className="target-split-cloud-sync">
            <span className={`target-split-cloud-sync-status${targetSplitCloudSyncStatus === 'error' ? ' is-error' : ''}`} role={targetSplitCloudSyncStatus === 'error' ? 'alert' : 'status'}>
              {targetSplitCloudSyncStatus === 'loading' ? '正在读取共享计划…'
                : targetSplitCloudSyncStatus === 'saving' ? '正在保存到云端…'
                  : targetSplitCloudSyncStatus === 'error' ? `同步失败：${targetSplitCloudSyncError}`
                    : targetSplitCloudSyncStatus === 'saved' ? '已保存到共享云端'
                      : '录入或生成后自动同步'}
            </span>
            <button
              type="button"
              className="target-management-import-button"
              disabled={targetSplitCloudSyncStatus === 'loading'
                || targetSplitCloudSyncStatus === 'saving'
                || (targetSplitCloudReadyKey === targetSplitCloudSyncKey && !hasPersistableTargetSplitPlan(targetSplitCloudPlan))}
              onClick={() => {
                const syncKey = targetSplitCloudSyncKey
                if (targetSplitCloudReadyKey !== syncKey) {
                  setTargetSplitCloudRetry((current) => current + 1)
                  return
                }
                const [ownerName, monthIdText] = syncKey.split(':')
                const monthId = Number(monthIdText) as TargetSplitMonthId
                const plan = targetSplitPlansByOwnerRef.current[ownerName]?.[monthId]
                if (!hasPersistableTargetSplitPlan(plan)) return
                const planSnapshot = JSON.parse(JSON.stringify(plan)) as TargetSplitPlan
                setTargetSplitCloudSyncStatus('saving')
                setTargetSplitCloudSyncError('')
                void enqueueTargetSplitCloudSave(ownerName, monthId, planSnapshot).then(() => {
                  if (targetSplitCloudSyncKeyRef.current === syncKey) setTargetSplitCloudSyncStatus('saved')
                }).catch((error) => {
                  if (targetSplitCloudSyncKeyRef.current !== syncKey) return
                  setTargetSplitCloudSyncStatus('error')
                  setTargetSplitCloudSyncError(error instanceof Error ? error.message : '保存到云端失败，本机草稿仍保留。')
                })
              }}
            >
              保存到云端
            </button>
          </div>
        ) : null}
      </div> : null}
    </>
  )
  const renderTargetSplitBoardContent = () => {
    if (!targetSplitBoardAvailable) {
      return (
        <div className="supplementary-dashboard-placeholder">
          {selectedName}的【听说】暂未配置，也没有收到示例开发01总拆分的导入目标；等待按本人逻辑配置或从示例开发01别名看板导入。
        </div>
      )
    }
    const detailMode = targetSplitViewMode === 'details' || targetSplitOwnerName !== '示例开发01'
    const importTargetsListenBoard = targetSplitOwnerName === '示例开发01'
    const hideTargetSplitOwnerColumns = isPersonalTargetSplitOwner(targetSplitOwnerName)
    const showOutsourcingPerformanceTarget = targetSplitFinancialGoalKeys.includes('outsourcingPerformanceTarget')
    const includeOutsourcingOrderCountTarget = targetSplitGoalKeys.includes('outsourcingOrderCountTarget')
    const baseColumns = detailMode
      ? getTargetSplitBoardColumns(showOutsourcingPerformanceTarget, includeOutsourcingOrderCountTarget)
      : getTargetSplitSummaryColumns(showOutsourcingPerformanceTarget, includeOutsourcingOrderCountTarget, isMuyuanNovemberTargetSplit)
    const ownerColumns = hideTargetSplitOwnerColumns
      ? baseColumns.filter((column) => column.key !== 'totalTarget' && column.key !== 'customerFacingPerson')
      : baseColumns
    const columns = hideTargetSplitOwnerColumns
      ? [
        ...ownerColumns.filter((column) => column.key === 'companyName'),
        ...ownerColumns.filter((column) => column.key === 'brandTotalTarget'),
        ...ownerColumns.filter((column) => column.key !== 'companyName' && column.key !== 'brandTotalTarget'),
      ]
      : ownerColumns
    const mergeBrandTotalIntoCompanyBlock = hideTargetSplitOwnerColumns
    const gridTemplateColumns = detailMode
      ? getTargetSplitGridTemplateColumns(columns, hideTargetSplitOwnerColumns)
      : getTargetSplitSummaryGridTemplateColumns(columns)
    const projectBrandColumnIndex = columns.findIndex((column) => column.key === 'projectBrand')
    const targetSplitFrozenColumnCount = hideTargetSplitOwnerColumns && projectBrandColumnIndex >= 0
      ? projectBrandColumnIndex + 1
      : isMuyuanNovemberTargetSplit && !detailMode ? 3 : 2
    const targetSplitFrozenLeftOffsets = hideTargetSplitOwnerColumns
      ? [0, 275, 395, 535]
      : isMuyuanNovemberTargetSplit && !detailMode ? [0, 132, 232] : [0, 132]
    const extraCustomerNames = [...new Set(targetSplitPlan.rows.map((row) => row.customerFacingPerson.trim()).filter(Boolean))]
      .filter((employeeName) => !TARGET_MANAGEMENT_BOARD_EMPLOYEES.includes(employeeName as typeof TARGET_MANAGEMENT_BOARD_EMPLOYEES[number]))
    const targetSplitGroupNames = targetSplitOwnerName === '示例开发01' ? [...TARGET_MANAGEMENT_BOARD_EMPLOYEES] : [targetSplitOwnerName]
    const customerGroups = [...targetSplitGroupNames, ...extraCustomerNames, ...(targetSplitPlan.rows.some((row) => !row.customerFacingPerson.trim()) ? [''] : [])]
      .map((customerName) => ({
        customerName,
        rows: targetSplitPlan.rows.filter((row) => row.customerFacingPerson.trim() === customerName),
      }))
    const snapshotLabel = targetSplitPlan.sourceUpdatedAt && Number.isFinite(Date.parse(targetSplitPlan.sourceUpdatedAt))
      ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(targetSplitPlan.sourceUpdatedAt))
      : '尚未读取'
    const getTargetSplitFrozenColumnStyle = (columnIndex: number) => columnIndex < targetSplitFrozenColumnCount
      ? { position: 'sticky' as const, left: `${targetSplitFrozenLeftOffsets[columnIndex] ?? 0}px` }
      : {}
    const renderTargetSplitSummaryAmount = (
      fieldKey: string,
      value: string,
      label: string,
      onChange: (nextValue: string) => void,
      isPersonal = false,
      disabled = false,
      displayValue = value,
    ) => {
      const editingKey = `${targetSplitOwnerName}:${targetSplitMonth}:${fieldKey}`
      if (targetSplitSummaryEditingCell === editingKey) {
        return (
          <input
            autoFocus
            type="number"
            min="0"
            step="0.01"
            value={value}
            disabled={disabled}
            aria-label={label}
            onChange={(event) => onChange(event.currentTarget.value)}
            onBlur={() => setTargetSplitSummaryEditingCell(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setTargetSplitSummaryEditingCell(null)
            }}
          />
        )
      }
      return (
        <span
          className={`target-split-summary-manual-value${isPersonal ? ' is-personal' : ''}${value.trim() === '' ? ' is-empty' : ''}`}
          role="button"
          tabIndex={disabled ? -1 : 0}
          title={disabled ? undefined : '双击编辑'}
          aria-label={`${label}，${value.trim() || '未填写'}${disabled ? '' : '，双击编辑'}`}
          aria-disabled={disabled}
          onDoubleClick={() => {
            if (!disabled) setTargetSplitSummaryEditingCell(editingKey)
          }}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === 'F2')) setTargetSplitSummaryEditingCell(editingKey)
          }}
        >
          {value.trim() ? displayValue : '双击填写'}
        </span>
      )
    }
    const renderEditableCell = (row: TargetSplitRow, field: TargetSplitEditableField, value: string, kind: 'text' | 'number' | 'person' | 'platform' = 'text') => {
      const isEditing = targetSplitEditingCell?.rowId === row.id && targetSplitEditingCell.field === field
      const commitValue = (nextValue: string) => {
        if (kind === 'number' && nextValue !== '' && (!Number.isFinite(Number(nextValue)) || Number(nextValue) < 0)) {
          setTargetSplitEditingCell(null)
          return
        }
        updateTargetSplitRow(row.id, field, nextValue)
        setTargetSplitEditingCell(null)
      }
      if (isEditing && kind === 'person') {
        return (
          <select
            autoFocus
            className="target-split-inline-select"
            value={value}
            aria-label="选择对客人"
            onChange={(event) => commitValue(event.currentTarget.value)}
            onBlur={() => setTargetSplitEditingCell(null)}
          >
            <option value="">选择对客人</option>
            {TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => <option key={employeeName} value={employeeName}>{employeeName}</option>)}
          </select>
        )
      }
      if (isEditing && kind === 'platform') {
        return (
          <select
            autoFocus
            className="target-split-inline-select"
            value={value}
            aria-label="选择平台"
            onChange={(event) => commitValue(event.currentTarget.value)}
            onBlur={() => setTargetSplitEditingCell(null)}
          >
            <option value="">选择平台</option>
            {TARGET_SPLIT_PLATFORMS.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
          </select>
        )
      }
      if (isEditing && targetSplitOwnerName === '示例对客16' && field === 'projectBrand') {
        return (
          <TargetSplitDirectoryAutocomplete
            value={value}
            directory="brand"
            onCommit={(nextValue) => updateTargetSplitRow(row.id, field, nextValue)}
            onClose={() => setTargetSplitEditingCell(null)}
          />
        )
      }
      if (isEditing) {
        return (
          <input
            autoFocus
            className="target-split-inline-input"
            type={kind === 'number' ? 'number' : 'text'}
            min={kind === 'number' ? 0 : undefined}
            step={kind === 'number' ? '0.01' : undefined}
            value={value}
            aria-label={`编辑${field}`}
            onChange={(event) => {
              const nextValue = event.currentTarget.value
              if (kind === 'number' && nextValue !== '' && !/^\d*(?:\.\d{0,2})?$/.test(nextValue)) return
              updateTargetSplitRow(row.id, field, nextValue)
            }}
            onBlur={() => setTargetSplitEditingCell(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setTargetSplitEditingCell(null)
            }}
          />
        )
      }
      const displayValue = kind === 'platform'
        ? TARGET_SPLIT_PLATFORMS.find((platform) => String(platform.id) === value)?.name ?? '双击选择'
        : kind === 'number'
          ? value === '' ? '双击填写' : `${value}${field === 'outsourcingOrderCountTarget' ? ' 单' : ' 万'}`
          : value || '双击填写'
      return (
        <span
          className={`target-split-editable-value${value === '' ? ' is-empty' : ''}`}
          title="双击编辑"
          tabIndex={0}
          onDoubleClick={() => setTargetSplitEditingCell({ rowId: row.id, field })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') setTargetSplitEditingCell({ rowId: row.id, field })
          }}
        >
          {displayValue}
        </span>
      )
    }
    const renderTargetSplitRowActions = (row: TargetSplitRow) => (
      <span className="target-split-row-actions">
        <button type="button" className="target-management-add-button" onClick={() => resetTargetSplitRow(row.id)}>重置</button>
        <button type="button" className="target-split-delete-button" onClick={() => deleteTargetSplitRow(row.id)}>删减</button>
      </span>
    )
    const renderGroupEditableCell = (
      groupKey: string,
      field: 'companyName' | 'platformId',
      value: string,
      kind: 'text' | 'platform',
      commit: (nextValue: string) => void,
      editingValue = value,
    ) => {
      const isEditing = targetSplitEditingCell?.rowId === groupKey && targetSplitEditingCell.field === field
      if (isEditing && kind === 'platform') {
        return (
          <select
            autoFocus
            className="target-split-inline-select"
            value={value}
            aria-label="选择平台"
            onChange={(event) => {
              commit(event.currentTarget.value)
              setTargetSplitEditingCell(null)
            }}
            onBlur={() => setTargetSplitEditingCell(null)}
          >
            <option value="">选择平台</option>
            {TARGET_SPLIT_PLATFORMS.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
          </select>
        )
      }
      if (isEditing && targetSplitOwnerName === '示例对客16' && field === 'companyName') {
        return (
          <TargetSplitDirectoryAutocomplete
            value={editingValue}
            directory="company"
            onCommit={commit}
            onClose={() => setTargetSplitEditingCell(null)}
          />
        )
      }
      if (isEditing) {
        return (
          <input
            autoFocus
            className="target-split-inline-input"
            type="text"
            value={value}
            aria-label={`编辑${field === 'companyName' ? '公司名称' : '平台'}`}
            onChange={(event) => commit(event.currentTarget.value)}
            onBlur={() => setTargetSplitEditingCell(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setTargetSplitEditingCell(null)
            }}
          />
        )
      }
      const displayValue = kind === 'platform'
        ? TARGET_SPLIT_PLATFORMS.find((platform) => String(platform.id) === value)?.name ?? '双击选择'
        : value || '双击填写'
      return (
        <span
          className={`target-split-editable-value${value === '' ? ' is-empty' : ''}`}
          title="双击编辑"
          tabIndex={0}
          onDoubleClick={() => setTargetSplitEditingCell({ rowId: groupKey, field })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') setTargetSplitEditingCell({ rowId: groupKey, field })
          }}
        >
          {displayValue}
        </span>
      )
    }
    const renderDataRow = (row: TargetSplitRow) => (
      <div
        className={`target-management-row target-split-data-row${row.platformId === 1 ? ' is-platform-xiaohongshu' : row.platformId === 2 ? ' is-platform-douyin' : row.platformId === 5 ? ' is-platform-shipinhao' : row.platformId === 0 ? ' is-platform-outsourcing' : ''}`}
        role="row"
        key={row.id}
        style={{ gridTemplateColumns }}
      >
        {columns.map((column, columnIndex) => {
          let content: ReactNode = '—'
          if (column.key === 'customerFacingPerson') {
            content = renderEditableCell(row, 'customerFacingPerson', row.customerFacingPerson, 'person')
          } else if (column.key === 'totalTarget') {
            const total = getTargetSplitFinancialTotal(row.targets, targetSplitFinancialGoalKeys)
            content = total > 0 ? <strong>{formatTargetSplitWan(total)}</strong> : '—'
          } else if (column.key === 'companyName') {
            content = renderEditableCell(row, 'companyName', row.companyName)
          } else if (column.key === 'platform') {
            content = renderEditableCell(row, 'platformId', row.platformId === null ? '' : String(row.platformId), 'platform')
          } else if (column.key === 'projectBrand') {
            content = renderEditableCell(row, 'projectBrand', row.projectBrand)
          } else if (column.key === 'brandTotalTarget') {
            const total = getTargetSplitFinancialTotal(row.targets, targetSplitFinancialGoalKeys)
            content = total > 0 ? <strong>{formatTargetSplitWan(total)}</strong> : '—'
          } else if (column.key === 'actions') {
            content = renderTargetSplitRowActions(row)
          } else if (column.key !== 'totalTarget' && column.kind === 'target') {
            const goalKey = column.key as TargetSplitGoalKey
            content = renderEditableCell(row, goalKey, row.targets[goalKey] ?? '', 'number')
          }
          return (
            <div
              className={`target-management-cell target-split-data-cell${column.key === 'customerFacingPerson' ? ' target-management-total-target-header' : ''}${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`}
              role="cell"
              key={column.key}
              data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined}
              style={getTargetSplitFrozenColumnStyle(columnIndex)}
            >
              {content}
            </div>
          )
        })}
      </div>
    )
    const getTargetSplitRowsGoalTotal = (rows: TargetSplitRow[], goalKey: TargetSplitGoalKey) =>
      rows.reduce((sum, row) => sum + (Number(row.targets[goalKey]) || 0), 0)
    const getTargetSplitRowsFinancialTotal = (rows: TargetSplitRow[]) =>
      targetSplitFinancialGoalKeys.reduce((sum, goalKey) => sum + getTargetSplitRowsGoalTotal(rows, goalKey), 0)
    const getTargetSplitHierarchicalGroups = (rows: TargetSplitRow[]) => {
      const companyRows = new Map<string, TargetSplitRow[]>()
      for (const row of rows) {
        const companyName = row.companyName.trim() || '未填写公司'
        companyRows.set(companyName, [...(companyRows.get(companyName) ?? []), row])
      }
      const platformOrder = [1, 2, 5, 0]
      return [...companyRows.entries()].map(([companyName, rowsForCompany]) => {
        const platformRows = new Map<number, TargetSplitRow[]>()
        for (const row of rowsForCompany) {
          platformRows.set(row.platformId, [...(platformRows.get(row.platformId) ?? []), row])
        }
        const platforms = [...platformRows.entries()]
          .map(([platformId, rowsForPlatform]) => {
            const sortedRows = [...rowsForPlatform].sort((left, right) =>
              getTargetSplitRowsFinancialTotal([right]) - getTargetSplitRowsFinancialTotal([left])
              || (Number(right.targets.outsourcingOrderCountTarget) || 0) - (Number(left.targets.outsourcingOrderCountTarget) || 0)
              || left.projectBrand.localeCompare(right.projectBrand, 'zh-CN'))
            return {
              platformId,
              platformName: TARGET_SPLIT_PLATFORMS.find((platform) => platform.id === platformId)?.name ?? '未填写平台',
              rows: sortedRows,
            }
          })
          .sort((left, right) => platformOrder.indexOf(left.platformId) - platformOrder.indexOf(right.platformId))
        return {
          companyName,
          rows: rowsForCompany,
          platforms,
          total: getTargetSplitRowsFinancialTotal(rowsForCompany),
          projectCount: platforms.reduce((sum, platform) => sum + (platform.platformId === 0 ? 0 : platform.rows.length), 0),
        }
      }).sort((left, right) => right.total - left.total || left.companyName.localeCompare(right.companyName, 'zh-CN'))
    }
    const getTargetSplitColumnIndex = (key: string) => columns.findIndex((column) => column.key === key)
    const renderHierarchicalCompanyGroup = (company: ReturnType<typeof getTargetSplitHierarchicalGroups>[number]) => {
      const hideCompanySummaryRow = mergeBrandTotalIntoCompanyBlock
      const rowMinHeights: string[] = hideCompanySummaryRow ? [] : ['minmax(48px, auto)']
      let nextRowIndex = hideCompanySummaryRow ? 1 : 2
      const platformLayouts = company.platforms.map((platform) => {
        const projectRows = platform.platformId === 0 ? [] : platform.rows
        const mergePlatformTotals = hideCompanySummaryRow && projectRows.length > 0
        const startRowIndex = nextRowIndex
        const rowSpan = (mergePlatformTotals ? 0 : 1) + projectRows.length
        nextRowIndex += rowSpan
        if (!mergePlatformTotals) rowMinHeights.push('minmax(42px, auto)')
        projectRows.forEach(() => rowMinHeights.push('minmax(52px, auto)'))
        return { platform, projectRows, startRowIndex, rowSpan, mergePlatformTotals }
      })
      const totalRowSpan = nextRowIndex - 1
      const renderHierarchicalCell = (
        column: (typeof columns)[number],
        rowIndex: number,
        content: ReactNode,
        className: string,
        rowSpan?: number,
      ) => {
        const columnIndex = getTargetSplitColumnIndex(column.key)
        return (
          <div
            className={`target-management-cell ${className}${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`}
            role="cell"
            key={column.key}
            data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined}
            style={{
              ...getTargetSplitFrozenColumnStyle(columnIndex),
              gridColumn: String(columnIndex + 1),
              gridRow: rowSpan ? `${rowIndex} / span ${rowSpan}` : String(rowIndex),
            }}
          >
            {content}
          </div>
        )
      }
      return (
        <div
          className="target-management-company-block"
          role="rowgroup"
          key={`target-split-company-${company.companyName}`}
          style={{ gridTemplateColumns, gridTemplateRows: rowMinHeights.join(' ') }}
        >
          <div className="target-management-row target-split-company-row" role="row" style={{ display: 'contents' }}>
            {columns.map((column) => {
              if (column.key === 'companyName') {
                return renderHierarchicalCell(column, 1, (
                  <span className="target-split-hierarchy-name">
                    <span className="target-split-hierarchy-tag">公司</span>
                    <strong>
                      {renderGroupEditableCell(
                        `company-${company.rows[0]?.id ?? 'empty'}`,
                        'companyName',
                        company.companyName,
                        'text',
                        (nextValue) => updateTargetSplitRows(
                          company.rows.map((row) => row.id),
                          'companyName',
                          nextValue,
                        ),
                        company.rows[0]?.companyName.trim() ?? '',
                      )}
                    </strong>
                  </span>
                ), 'target-split-company-cell target-split-company-name-cell target-split-merged-span-cell', totalRowSpan)
              }
              if (mergeBrandTotalIntoCompanyBlock && column.key === 'brandTotalTarget') {
                return renderHierarchicalCell(
                  column,
                  1,
                  company.total > 0 ? <strong>{formatTargetSplitWan(company.total)}</strong> : '—',
                  'target-split-company-cell target-split-total-target-cell target-split-merged-span-cell',
                  totalRowSpan,
                )
              }
              if (hideCompanySummaryRow) return null
              let content: ReactNode = ''
              if (column.key === 'totalTarget' || column.key === 'brandTotalTarget') {
                content = <strong>{formatTargetSplitWan(company.total)}</strong>
              } else if (column.key === 'customerFacingPerson') {
                content = <strong>{targetSplitOwnerName}</strong>
              } else if (column.kind === 'target') {
                const goalKey = column.key as TargetSplitGoalKey
                const total = getTargetSplitRowsGoalTotal(company.rows, goalKey)
                content = goalKey === 'outsourcingOrderCountTarget'
                  ? total > 0 ? `${Math.round(total)} 单` : '—'
                  : total > 0 ? formatTargetSplitWan(total) : '—'
              }
              return renderHierarchicalCell(column, 1, content, 'target-split-company-cell target-split-merged-row-cell')
            })}
          </div>
          {platformLayouts.map(({ platform, projectRows, startRowIndex, rowSpan, mergePlatformTotals }) => (
            <Fragment key={`target-split-company-${company.companyName}-platform-${platform.platformId}`}>
              <div
                className={`target-management-row target-split-platform-row${platform.platformId === 1 ? ' is-platform-xiaohongshu' : platform.platformId === 2 ? ' is-platform-douyin' : platform.platformId === 5 ? ' is-platform-shipinhao' : platform.platformId === 0 ? ' is-platform-outsourcing' : ''}`}
                role="row"
                style={{ display: 'contents' }}
              >
                {columns.map((column) => {
                  if (column.key === 'companyName') return null
                  if (mergeBrandTotalIntoCompanyBlock && column.key === 'brandTotalTarget') return null
                  if (column.key === 'platform') {
                    return renderHierarchicalCell(column, startRowIndex, (
                      <span className="target-split-hierarchy-name">
                        <strong>
                          {renderGroupEditableCell(
                            `company-${company.rows[0]?.id ?? 'empty'}-platform-${platform.platformId}`,
                            'platformId',
                            String(platform.platformId ?? ''),
                            'platform',
                            (nextValue) => updateTargetSplitRows(
                              platform.rows.map((row) => row.id),
                              'platformId',
                              nextValue,
                            ),
                          )}
                        </strong>
                      </span>
                    ), 'target-split-platform-cell target-split-merged-span-cell', rowSpan)
                  }
                  if (mergePlatformTotals) return null
                  let content: ReactNode = ''
                  if (column.key === 'totalTarget' || column.key === 'brandTotalTarget') {
                    const total = getTargetSplitRowsFinancialTotal(platform.rows)
                    content = total > 0 ? <strong>{formatTargetSplitWan(total)}</strong> : '—'
                  } else if (column.key === 'actions' && platform.platformId === 0 && platform.rows[0]) {
                    content = renderTargetSplitRowActions(platform.rows[0])
                  } else if (column.kind === 'target') {
                    const goalKey = column.key as TargetSplitGoalKey
                    const total = getTargetSplitRowsGoalTotal(platform.rows, goalKey)
                    content = platform.platformId === 0 && goalKey === 'outsourcingOrderCountTarget' && platform.rows[0]
                      ? renderEditableCell(platform.rows[0], goalKey, platform.rows[0].targets[goalKey] ?? '', 'number')
                      : goalKey === 'outsourcingOrderCountTarget'
                        ? total > 0 ? `${Math.round(total)} 单` : '—'
                        : total > 0 ? formatTargetSplitWan(total) : '—'
                  }
                  return renderHierarchicalCell(column, startRowIndex, content, 'target-split-platform-cell target-split-merged-row-cell')
                })}
              </div>
              {projectRows.map((row, projectIndex) => (
                <div
                  className={`target-management-row target-split-data-row target-split-hierarchy-project-row${row.platformId === 1 ? ' is-platform-xiaohongshu' : row.platformId === 2 ? ' is-platform-douyin' : row.platformId === 5 ? ' is-platform-shipinhao' : row.platformId === 0 ? ' is-platform-outsourcing' : ''}`}
                  role="row"
                  key={row.id}
                  style={{ display: 'contents' }}
                >
                  {columns.map((column) => {
                    if (column.key === 'companyName' || column.key === 'platform') return null
                    if (mergeBrandTotalIntoCompanyBlock && column.key === 'brandTotalTarget') return null
                    let content: ReactNode = ''
                    if (column.key === 'totalTarget' || column.key === 'brandTotalTarget') {
                      const total = getTargetSplitFinancialTotal(row.targets, targetSplitFinancialGoalKeys)
                      content = total > 0 ? <strong>{formatTargetSplitWan(total)}</strong> : '—'
                    } else if (column.key === 'projectBrand') {
                      content = (
                        <span className="target-split-hierarchy-name">
                          {renderEditableCell(row, 'projectBrand', row.projectBrand)}
                        </span>
                      )
                    } else if (column.key === 'actions') {
                      content = renderTargetSplitRowActions(row)
                    } else if (column.kind === 'target') {
                      const goalKey = column.key as TargetSplitGoalKey
                      content = renderEditableCell(row, goalKey, row.targets[goalKey] ?? '', 'number')
                    }
                    return renderHierarchicalCell(column, startRowIndex + (mergePlatformTotals ? 0 : 1) + projectIndex, content, 'target-split-data-cell target-split-merged-row-cell')
                  })}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )
    }

    return (
      <div
        className="target-management-dashboard-content target-split-board-content"
        role={isMuyuanTeamTargetSplit ? undefined : 'tabpanel'}
        aria-labelledby={isMuyuanTeamTargetSplit ? undefined : 'target-split-view-logic'}
      >
        {!isMuyuanTeamTargetSplit ? <div className="supplementary-dashboard-tabs target-split-view-tabs" role="tablist" aria-label="目标拆分看板">
          <button
            id="target-split-view-logic"
            type="button"
            role="tab"
            aria-selected="true"
            className="supplementary-dashboard-tab active"
            onClick={() => setTargetSplitBoardView('logic')}
          >
            拆分逻辑
          </button>
        </div> : null}
        {targetSplitImportNotice ? <div className="target-split-notice" role="status">{targetSplitImportNotice}</div> : null}
        {targetSplitPlanNeedsRegeneration ? <div className="target-split-notice" role="status">{targetSplitOwnerName === '示例开发01'
          ? `当前${isMuyuanNovemberTargetSplit ? '11月目标或拆分规则' : '拆分规则'}与上次生成结果不同；逐人“导入”仍可按表格当前显示的示例公司有限公司目标执行。若点击“生成目标”，会重新计算分配明细${isMuyuanNovemberTargetSplit ? '，但不会改写八人固定类别目标' : ''}。`
          : '目标分配规则已更新，表格当前仍显示旧拆分预览且不可导入。原有总目标、固定目标和公司/平台/项目配置均已保留；请点击“生成目标”重算明细后再导入。'}</div> : null}
        {targetSplitGenerationError ? <div className="target-split-error" role="alert">{targetSplitGenerationError}</div> : null}
        {targetSplitGenerationProgress ? <div className="target-split-progress" role="status">{targetSplitGenerationProgress}</div> : null}
        {targetSplitActiveBoardView === 'logic' ? <section className="target-split-logic-card" aria-label="目标拆分逻辑">
            <button
              type="button"
              className="target-split-logic-heading"
              aria-expanded={!targetSplitLogicCollapsed}
              aria-controls="target-split-logic-content"
              onClick={() => setTargetSplitLogicCollapsed((collapsed) => !collapsed)}
            >
              <span aria-hidden="true">▾</span>
              <strong>拆分逻辑</strong>
            </button>
            <div className="target-split-logic-body" id="target-split-logic-content" hidden={targetSplitLogicCollapsed}>
            {isMuyuanNovemberTargetSplit ? <p>2026年11月八人总目标及各项固定类别目标均可手动录入；固定类别目标合计不得超过八人总目标。八位对客人的示例公司有限公司总目标可分别录入，合计与八人总目标的差额显示在“差值”行；生成时按各自录入的示例公司有限公司总目标拆分该对客人的具体业绩目标，不会自动修改八人总目标或固定类别目标金额。拆分参考上月发布、上月成单及近三个月未发布订单。本月不设置、不拆分外采单数目标。</p>
            : targetSplitOwnerName === '示例开发01' ? <p>示例开发01八人总拆分规则保持不变：总目标与六项金额目标（含外采业绩）手动输入，人员金额目标参考示例公司有限公司同类业绩并应用示例公司有限公司系数；外采单数仍按团队档位权重拆分。公司、平台和项目仍使用团队拆分规则，其中示例对客20仅统计开发人为示例开发01的订单。</p>
            : isPersonalTargetSplitOwner(targetSplitOwnerName) ? <p>总目标与十点半、自孵化、签约小红书/抖音/视频号、{targetSplitFinancialGoalKeys.includes('outsourcingPerformanceTarget') ? '外采业绩、' : ''}外采单数目标由本人手动输入；{targetSplitFinancialGoalKeys.includes('outsourcingPerformanceTarget') ? '六项' : '五项'}业绩目标合计必须等于总目标，外采单数不计入总目标。只读取{targetSplitOwnerName}本人的近三个月发布、上月成单和当前待发布订单；公司、平台及项目品牌的参考和筛选均以本人订单为准。金额目标优先参考同类业绩，无同类记录时参考整体业务贡献，并保留15%均衡基准；首次按快照生成时，只保留上月有成单且综合潜力不低于总量1%的公司/项目。外采单数只分配给本人上月有外采成单或当前有外采待发布记录的公司，不参考近三个月发布。{targetSplitOwnerName === '示例对客16' ? '示例对客16的外采排除公司规则仅作用于示例对客16本人。' : ''}首次生成后，后续增删公司、平台或项目会按示例公司有限公司配置保留；依据栏显示本人订单金额和外采单数。缺失快照不按零业绩处理，上月成单和当前待发布数据需完整可用后才能生成。点击“生成目标”只重算预览，不会导入目标管理。</p>
            : <p>本看板由示例开发01在【听说】总拆分中按人导入，最上方为{targetSplitOwnerName}本人的全部总目标，下方为具体公司/平台/项目目标；没有启用自动拆分规则，也不会套用示例开发01或示例对客16的拆分口径。需要重新分配时，请回到示例开发01的总拆分表导入。</p>}
          {isPersonalTargetSplitOwner(targetSplitOwnerName) && targetSplitMonth === 150 ? <p>2026年11月单条公司/平台/项目金额明细合计低于0.50万元（¥5,000）时，不分配到该明细，金额计入未细分目标；公司、平台和项目配置仍保留，外采单数不受该门槛影响。</p> : null}
          {supportsTargetSplitBoard(targetSplitOwnerName) ? <div className="target-split-adjustment-panel">
            <div className="target-split-adjustment-section">
              <div className="target-split-adjustment-heading">
                <strong>业绩来源权重</strong>
                <span className={Math.abs(targetSplitSourceWeightTotal - 100) <= 0.01 ? '' : 'is-invalid'}>合计 {targetSplitSourceWeightTotal.toFixed(1)}%（需为 100%）</span>
              </div>
              <div className="target-split-source-weight-grid">
                {(Object.keys(TARGET_SPLIT_SOURCE_LABELS) as TargetSplitSourceKey[]).map((source) => (
                  <label className="target-split-setting-field" key={source}>
                    <span>{TARGET_SPLIT_SOURCE_LABELS[source]}</span>
                    <span className="target-split-setting-input-wrap">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={targetSplitPlan.allocationSettings.sourceWeights[source]}
                        disabled={targetSplitGenerating}
                        aria-label={`${TARGET_SPLIT_SOURCE_LABELS[source]}权重百分比`}
                        onChange={(event) => updateTargetSplitAllocationSettings((settings) => ({
                          ...settings,
                          sourceWeights: { ...settings.sourceWeights, [source]: event.currentTarget.value },
                        }))}
                      />
                      <span>%</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="target-split-adjustment-owner-sections" hidden={targetSplitOwnerName !== '示例开发01'}>
            <div className="target-split-adjustment-section">
              <div className="target-split-adjustment-heading">
                <strong>对客人示例公司有限公司系数</strong>
                <span>金额类别适用，叠加在同类业绩权重上；范围 0–2</span>
              </div>
              <div className="target-split-person-factor-grid">
                {TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => (
                  <label className="target-split-setting-field" key={employeeName}>
                    <span>{employeeName}</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.01"
                      value={targetSplitPlan.allocationSettings.personMultipliers[employeeName] ?? '1.00'}
                      disabled={targetSplitGenerating}
                      aria-label={`${employeeName}示例公司有限公司分配系数`}
                      onChange={(event) => updateTargetSplitAllocationSettings((settings) => ({
                        ...settings,
                        personMultipliers: { ...settings.personMultipliers, [employeeName]: event.currentTarget.value },
                      }))}
                    />
                  </label>
                ))}
              </div>
            </div>
            {!isMuyuanNovemberTargetSplit ? <div className="target-split-adjustment-section">
              <div className="target-split-adjustment-heading">
                <strong>外采单数档位权重</strong>
                <span>仅外采单数适用；同档位填相同数值，数值越大目标越多</span>
              </div>
              <div className="target-split-person-factor-grid target-split-outsourcing-factor-grid">
                {TARGET_MANAGEMENT_BOARD_EMPLOYEES.map((employeeName) => (
                  <label className="target-split-setting-field" key={employeeName}>
                    <span>{employeeName}</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.01"
                      value={targetSplitPlan.allocationSettings.outsourcingOrderCountMultipliers[employeeName] ?? '1.00'}
                      disabled={targetSplitGenerating}
                      aria-label={`${employeeName}外采单数分配系数`}
                      onChange={(event) => updateTargetSplitAllocationSettings((settings) => ({
                        ...settings,
                        outsourcingOrderCountMultipliers: {
                          ...settings.outsourcingOrderCountMultipliers,
                          [employeeName]: event.currentTarget.value,
                        },
                      }))}
                    />
                  </label>
                ))}
              </div>
            </div> : null}
            </div>
            {targetSplitAllocationSettingsError ? <small className="target-split-settings-error" role="alert">{targetSplitAllocationSettingsError}</small> : null}
            <small className="target-split-adjustment-hint">{isMuyuanNovemberTargetSplit
              ? '修改来源权重后请重新点击“生成目标”；权重只影响八人之间的固定类别目标分配。八人总目标及各项类别目标均保持不变；“未细分目标”按八人总目标减去当行固定类别目标合计即时计算，本月不拆分外采单数目标。'
              : targetSplitOwnerName === '示例开发01'
              ? '权重合计有效后会根据当前已读取的快照自动重算拆分预览，不会导入目标管理或刷新天玑；如果本次打开页面后尚未生成过目标，请先点击“生成目标”读取已保存快照。系数调整会替换当前自动拆分明细，固定目标金额不变；金额按同类业绩占比分配，无同类记录时参考整体业绩，再叠加示例公司有限公司系数，不按档位排序；只有外采单数先按外采单数档位权重排序，再在档内按同类单数业绩做±5%微调。'
              : `权重合计有效后会根据当前已读取的${targetSplitOwnerName}本人订单快照重算分层明细，不会导入目标管理或刷新天玑；如果本次打开页面后尚未生成过示例公司有限公司目标，请先点击“生成目标”读取已保存快照。权重只影响公司/平台/项目明细，五项目标保持当前手填值；外采单数只按本人上月成单和当前待发布订单分配，不参考近三个月发布。`}</small>
          </div> : null}
          <span>{targetSplitBoardIsImportedOnly ? '导入来源：示例开发01【听说】总拆分 · ' : ''}来源快照时间：{snapshotLabel}。生成与导入均仅读写本应用保存的数据，不触发天玑刷新。</span>
            {targetSplitPlan.sourceWarnings.map((warning) => <small className="target-split-warning" key={warning}>{warning}</small>)}
            </div>
        </section> : null}
        <div className="target-split-toolbar">
          <span className="target-split-edit-hint">{isMuyuanNovemberTargetSplit
            ? '可手动录入八人总目标、各项固定类别目标及每位对客人的示例公司有限公司总业绩目标；固定类别目标合计不得超过八人总目标，示例公司有限公司目标合计须等于八人总目标。“未细分目标”位于八人总目标行；下方“差值”行逐列计算上方目标减去下方八位对客人同列目标合计。生成不会自动修改录入金额；点击“生成目标”后按历史订单拆分。'
            : targetSplitOwnerName === '示例开发01'
            ? '目标按对客人汇总展示；点击各人旁的“导入”可把该人目标写入其【听说】看板，顶部为全部总目标，下方为公司/平台/项目目标'
            : supportsTargetSplitBoard(targetSplitOwnerName)
              ? isPersonalTargetSplitOwner(targetSplitOwnerName)
                ? `目标只展示${targetSplitOwnerName}本人；公司、平台和项目依据均取本人订单，按“公司 → 平台 → 项目”分层；首次生成建立示例公司有限公司明细，之后重新生成保留手动增删；导入会写入${targetSplitOwnerName}的目标管理`
                : `目标只展示${targetSplitOwnerName}本人，公司、平台和项目品牌分配维度会随生成结果导入${targetSplitOwnerName}的目标管理`
              : `本看板由示例开发01导入：最上方一行为${targetSplitOwnerName}的全部总目标，下方各行为具体公司/平台/项目目标；未启用自动拆分逻辑`}</span>
          {isPersonalTargetSplitOwner(targetSplitOwnerName) && targetSplitActiveBoardView === 'logic' ? (
            <span className="target-split-toolbar-actions">
              {targetSplitOwnerName === '示例对客16' && detailMode ? (
                <button type="button" className="target-management-add-button" aria-expanded={targetSplitUnallocatedExpanded} aria-controls="target-split-personal-unallocated-row" onClick={() => setTargetSplitUnallocatedExpanded((expanded) => !expanded)}>
                  {targetSplitUnallocatedExpanded ? '收起未分配目标' : '未分配目标'}
                </button>
              ) : null}
              <button type="button" className="target-management-add-button" onClick={addTargetSplitRow}>新增行</button>
              <button type="button" className="target-management-add-button" onClick={resetTargetSplitRows}>重置明细</button>
            </span>
          ) : null}
        </div>
        <input
          className="company-dashboard-horizontal-range target-split-horizontal-range"
          type="range"
          min={0}
          max={targetSplitTableScrollMax}
          step={1}
          value={targetSplitTableScrollPosition}
          disabled={targetSplitTableScrollMax === 0}
          aria-label="顶部横向滚动目标拆分表格"
          onChange={(event) => scrollTargetSplitTableTo(Number(event.currentTarget.value))}
        />
        <div className={`target-management-table-wrap target-split-board-table-wrap${targetSplitFrozenColumnCount > 2 ? ' target-split-frozen-through-brand' : ''}${hideTargetSplitOwnerColumns ? ' target-split-emphasized-board' : ''}`} ref={targetSplitTableWrapRef} onScroll={syncTargetSplitTableScroll}>
          <div className={`target-management-table${isMuyuanNovemberTargetSplit && !detailMode ? ' target-split-muyuan-november-summary' : ''}`} role="table" aria-label={detailMode
            ? `${targetSplitOwnerName === '示例开发01' ? '八位对客人' : `${targetSplitOwnerName}本人`}目标拆分明细`
            : `${targetSplitOwnerName === '示例开发01' ? '八位对客人' : `${targetSplitOwnerName}本人`}目标汇总`}>
            <div className="target-management-row target-management-header" role="row" style={{ gridTemplateColumns }}>
              {columns.map((column, columnIndex) => (
                <div
                  className={`target-management-cell${column.key === 'totalTarget' || column.key === 'customerFacingPerson' ? ' target-management-total-target-header' : ''}${column.key === 'customerFacingPerson' && targetSplitOwnerName === '示例开发01' ? ' target-split-customer-header-cell' : ''}${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`}
                  role="columnheader"
                  key={column.key}
                  data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined}
                  style={getTargetSplitFrozenColumnStyle(columnIndex)}
                >
                  <span>{column.name}</span>
                  {column.key === 'customerFacingPerson' && targetSplitOwnerName === '示例开发01' ? (
                    <>
                      <button
                        type="button"
                        className="target-management-import-button target-split-customer-header-import"
                        disabled={targetSplitGenerating || targetSplitImportLoading}
                        onClick={() => {
                          setTargetSplitImportError('')
                          setTargetSplitImportEmployeeName(null)
                          setTargetSplitImportOpen(true)
                        }}
                      >
                        导入各人听说看板
                      </button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
            {targetSplitOwnerName === '示例对客16' && detailMode && targetSplitUnallocatedExpanded ? (
              <div id="target-split-personal-unallocated-row" className="target-management-row target-split-unallocated-summary-row" role="row" aria-label="未分配目标" style={{ gridTemplateColumns }}>
                {columns.map((column, columnIndex) => {
                  let content: ReactNode = ''
                  if (column.key === 'companyName') {
                    content = <strong>未分配</strong>
                  } else if (column.key === 'brandTotalTarget') {
                    const totalTarget = Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim()) || 0
                    const allocatedTotal = getTargetSplitRowsFinancialTotal(targetSplitPlan.rows)
                    content = formatTargetSplitWan(totalTarget - allocatedTotal)
                  } else if (column.kind === 'target') {
                    const goalKey = column.key as TargetSplitGoalKey
                    const goalTarget = Number((targetSplitPlan.goalTargets[goalKey] ?? '').replace(/,/g, '').trim()) || 0
                    const allocatedGoal = getTargetSplitRowsGoalTotal(targetSplitPlan.rows, goalKey)
                    const difference = goalTarget - allocatedGoal
                    content = goalKey === 'outsourcingOrderCountTarget'
                      ? `${difference} 单`
                      : formatTargetSplitWan(difference)
                  }
                  return <div className={`target-management-cell target-split-data-cell target-split-unallocated-cell${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`} role="cell" key={column.key} data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined} style={getTargetSplitFrozenColumnStyle(columnIndex)}>{content}</div>
                })}
              </div>
            ) : null}
            <div className="target-management-row target-split-total-row" role="row" style={{ gridTemplateColumns }}>
              {columns.map((column, columnIndex) => {
                let content: ReactNode = ''
                if (column.key === 'totalTarget') {
                  content = isMuyuanNovemberTargetSplit ? (
                    <label className="target-split-total-input-label">
                      <span>八人总目标（万元）</span>
                      {renderTargetSplitSummaryAmount(
                        'totalTarget',
                        targetSplitPlan.totalTarget,
                        '八人总目标（万元）',
                        (totalTarget) => updateTargetSplitPlan((plan) => ({ ...plan, totalTarget })),
                        false,
                        false,
                        formatTargetSplitWan(Number(targetSplitPlan.totalTarget) || 0),
                      )}
                    </label>
                  ) : (
                    <label className="target-split-total-input-label">
                      <span>{targetSplitOwnerName === '示例开发01' ? '总目标（万元）' : '全部总目标（万元）'}</span>
                      <input type="number" min="0" step="0.01" value={targetSplitPlan.totalTarget} onChange={(event) => {
                        const totalTarget = event.currentTarget.value
                        updateTargetSplitPlan((plan) => ({ ...plan, totalTarget }))
                      }} />
                    </label>
                  )
                } else if (column.key === 'customerFacingPerson') {
                  content = <strong>{targetSplitOwnerName === '示例开发01' ? '分配到八位对客人' : `分配到${targetSplitOwnerName}名下公司/平台/品牌`}：{targetSplitAllocatedAmount.toFixed(2)} 万</strong>
                } else if (column.key === 'companyName') {
                  content = <span>明细目标：{targetSplitDetailAmount.toFixed(2)} 万</span>
                } else if (column.key === 'platform') {
                  content = <span className={Math.abs(targetSplitAllocationGap) < 0.01 ? 'target-split-balanced' : 'target-split-unbalanced'}>分配差额：{targetSplitAllocationGap.toFixed(2)} 万</span>
                } else if (column.key === 'brandTotalTarget' && hideTargetSplitOwnerColumns) {
                  const importedTotal = Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim()) || 0
                  content = importedTotal > 0 ? <strong>{formatTargetSplitWan(importedTotal)}</strong> : '—'
                } else if (column.key === 'brandTotalTarget' && !detailMode) {
                  content = <strong>已分配 {targetSplitAllocatedAmount.toFixed(2)} 万</strong>
                } else if (column.key === 'unallocatedTarget') {
                  if (isMuyuanNovemberTargetSplit) {
                    const totalTargetCents = Math.round((Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim()) || 0) * 100)
                    const unallocatedCents = totalTargetCents - targetSplitGoalTotalCents
                    content = unallocatedCents >= 0
                      ? formatTargetSplitWan(unallocatedCents / 100)
                      : `超出 ${formatTargetSplitWan(Math.abs(unallocatedCents) / 100)}`
                  } else {
                    const unallocatedTotal = customerGroups.reduce((sum, group) => sum + getTargetSplitCustomerUnallocatedTarget(group.customerName), 0)
                    content = unallocatedTotal > 0 ? `${formatTargetSplitWan(unallocatedTotal)}` : '0.00 万'
                  }
                } else if (column.kind === 'target') {
                  const goalKey = column.key as TargetSplitGoalKey
                  const isOrderCount = goalKey === 'outsourcingOrderCountTarget'
                  content = isMuyuanNovemberTargetSplit && !isOrderCount ? (
                    <label className="target-split-total-input-label">
                      <span>固定目标（万元）</span>
                      {renderTargetSplitSummaryAmount(
                        `goalTarget:${goalKey}`,
                        targetSplitPlan.goalTargets[goalKey] ?? '',
                        `手动输入${column.name}`,
                        (value) => updateTargetSplitPlan((plan) => ({
                          ...plan,
                          goalTargets: { ...plan.goalTargets, [goalKey]: value },
                        })),
                        false,
                        false,
                        formatTargetSplitWan(Number(targetSplitPlan.goalTargets[goalKey]) || 0),
                      )}
                    </label>
                  ) : (
                    <label className="target-split-total-input-label">
                      <span>{isOrderCount ? '固定目标（单）' : '固定目标（万元）'}</span>
                      <input
                        type="number"
                        min="0"
                        step={isOrderCount ? '1' : '0.01'}
                        aria-label={`手动输入${column.name}`}
                        value={targetSplitPlan.goalTargets[goalKey] ?? ''}
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          updateTargetSplitPlan((plan) => ({
                            ...plan,
                            goalTargets: { ...plan.goalTargets, [goalKey]: value },
                          }))
                        }}
                      />
                    </label>
                  )
                }
                return <div className={`target-management-cell target-split-total-cell${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`} role="cell" key={column.key} data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined} style={getTargetSplitFrozenColumnStyle(columnIndex)}>{content}</div>
              })}
              {isMuyuanNovemberTargetSplit && !detailMode ? (
                <button
                  type="button"
                  className="target-management-add-button target-split-november-difference-toggle"
                  aria-expanded={muyuanNovemberDifferenceExpanded}
                  aria-controls="target-split-muyuan-november-difference-row"
                  onClick={() => setMuyuanNovemberDifferenceExpanded((expanded) => !expanded)}
                >差值</button>
              ) : null}
            </div>
            {isMuyuanNovemberTargetSplit && !detailMode ? (
              <div id="target-split-muyuan-november-difference-row" className="target-management-row target-split-person-summary target-split-unallocated-summary-row" role="row" aria-label="八人目标差值" hidden={!muyuanNovemberDifferenceExpanded} style={{ gridTemplateColumns }}>
                {columns.map((column, columnIndex) => {
                  let content: ReactNode = ''
                  const totalTargetCents = Math.round((Number(targetSplitPlan.totalTarget.replace(/,/g, '').trim()) || 0) * 100)
                  if (column.key === 'totalTarget') {
                    content = formatTargetSplitWan((totalTargetCents - targetSplitCustomerTargetTotalCents) / 100)
                  } else if (column.key === 'unallocatedTarget') {
                    const totalUnallocatedCents = totalTargetCents - targetSplitGoalTotalCents
                    const customerUnallocatedCents = targetSplitEmployeeNames.reduce((sum, employeeName) => {
                      const customerGoalCents = targetSplitFinancialGoalKeys.reduce(
                        (goalSum, goalKey) => goalSum + Math.round(getTargetSplitCustomerGoalTotal(employeeName, goalKey) * 100),
                        0,
                      )
                      return sum + Math.round(getTargetSplitPersonTarget(employeeName) * 100) - customerGoalCents
                    }, 0)
                    content = formatTargetSplitWan((totalUnallocatedCents - customerUnallocatedCents) / 100)
                  } else if (column.key === 'customerFacingPerson') {
                    content = <strong>差值</strong>
                  } else if (column.kind === 'target') {
                    const goalKey = column.key as TargetSplitGoalKey
                    if (goalKey === 'outsourcingOrderCountTarget') {
                      content = '—'
                    } else {
                      const totalGoalCents = Math.round((Number(targetSplitPlan.goalTargets[goalKey]) || 0) * 100)
                      const customerGoalCents = targetSplitEmployeeNames.reduce(
                        (sum, employeeName) => sum + Math.round(getTargetSplitCustomerGoalTotal(employeeName, goalKey) * 100),
                        0,
                      )
                      content = formatTargetSplitWan((totalGoalCents - customerGoalCents) / 100)
                    }
                  }
                  return <div className={`target-management-cell target-split-person-cell target-split-summary-cell${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`} role="cell" key={column.key} data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined} style={getTargetSplitFrozenColumnStyle(columnIndex)}>{content}</div>
                })}
              </div>
            ) : null}
            {!detailMode ? customerGroups.map(({ customerName }) => {
              const label = customerName || '待选择对客人'
              const personTarget = customerName ? getTargetSplitPersonTarget(customerName) : 0
              const personRationale = targetSplitPlan.customerRationales[customerName]
              const rationalesByGoal = getTargetSplitCustomerRationalesByGoal(personRationale ?? '')
              const hasGoalRationales = Object.values(rationalesByGoal).some(Boolean)
              const rationaleKey = `${targetSplitMonth}:${customerName}`
              const rationaleCollapsed = !expandedTargetSplitRationales.has(rationaleKey)
              return (
                <Fragment key={`split-summary-${label}`}>
                  <div className="target-management-row target-split-person-summary target-split-summary-row" role="row" style={{ gridTemplateColumns }}>
                    {columns.map((column, columnIndex) => {
                      let content: ReactNode = ''
                      if (column.key === 'totalTarget') {
                        content = customerName
                          ? isMuyuanNovemberTargetSplit && targetSplitEmployeeNames.includes(customerName as DashboardCompanyBoardEmployeeName)
                            ? <label className="target-split-total-input-label target-split-person-target-input-label">
                              {renderTargetSplitSummaryAmount(
                                `personTarget:${customerName}`,
                                getTargetSplitPersonTargetInputValue(customerName),
                                `${label}总业绩目标（万元）`,
                                (value) => updateTargetSplitPlan((plan) => {
                                  const customerTargets = Object.fromEntries(targetSplitEmployeeNames.map((employeeName) => [
                                    employeeName,
                                    employeeName === customerName
                                      ? value
                                      : getTargetSplitPersonTargetInputValue(employeeName, plan),
                                  ])) as Record<string, string>
                                  return { ...plan, customerTargets }
                                }),
                                true,
                                targetSplitGenerating,
                                formatTargetSplitWan(personTarget),
                              )}
                            </label>
                            : <strong>{formatTargetSplitWan(personTarget)}</strong>
                          : '—'
                      } else if (column.key === 'customerFacingPerson') {
                        const importBlockReason = customerName ? getTargetSplitPersonImportBlockReason(customerName) : '请先选择对客人'
                        content = (
                          <span className="target-split-person-name target-split-person-summary-name">
                            <span className="target-split-person-summary-name-line">
                              <strong>{label}</strong>
                              {customerName && !targetSplitUsesHeaderImportOnly ? (
                                <button
                                  type="button"
                                  className="target-split-person-import-button"
                                  disabled={targetSplitGenerating || targetSplitImportLoading || Boolean(importBlockReason)}
                                  title={importBlockReason || `${targetSplitOwnerName === '示例开发01' ? `把${label}的目标导入其【听说】看板` : `导入${label}在方片月${targetSplitMonth - 139}月的拆分目标`}`}
                                  aria-label={targetSplitOwnerName === '示例开发01' ? `导入${label}的【听说】看板` : `导入${label}的目标管理`}
                                  onClick={() => {
                                    setTargetSplitImportError('')
                                    setTargetSplitImportEmployeeName(customerName)
                                    setTargetSplitImportOpen(true)
                                  }}
                                >
                                  导入
                                </button>
                              ) : null}
                            </span>
                            {hasGoalRationales && targetSplitActiveBoardView === 'logic' ? (
                              <span className={`target-split-person-rationale${rationaleCollapsed ? ' is-collapsed' : ''}`}>
                                <button
                                  type="button"
                                  className={`target-split-inline-rationale-heading${isMuyuanNovemberTargetSplit ? ' is-muyuan-november' : ''}`}
                                  aria-label={`${rationaleCollapsed ? '展开' : '收起'}${label}分配依据`}
                                  aria-expanded={!rationaleCollapsed}
                                  onClick={() => toggleTargetSplitRationale(rationaleKey)}
                                >
                                  <span aria-hidden="true">▾</span>
                                  <strong>{label} 分配依据</strong>
                                </button>
                              </span>
                            ) : null}
                          </span>
                        )
                      } else if (column.key === 'brandTotalTarget') {
                        content = customerName ? <strong>{formatTargetSplitWan(personTarget)}</strong> : '—'
                      } else if (column.key === 'unallocatedTarget') {
                        if (isMuyuanNovemberTargetSplit) {
                          const allocatedTargetCents = customerName
                            ? targetSplitFinancialGoalKeys.reduce(
                              (sum, goalKey) => sum + Math.round(getTargetSplitCustomerGoalTotal(customerName, goalKey) * 100),
                              0,
                            )
                            : 0
                          const unallocatedCents = Math.round(personTarget * 100) - allocatedTargetCents
                          content = customerName
                            ? unallocatedCents >= 0
                              ? formatTargetSplitWan(unallocatedCents / 100)
                              : `超出 ${formatTargetSplitWan(Math.abs(unallocatedCents) / 100)}`
                            : ''
                        } else {
                          const unallocated = customerName ? getTargetSplitCustomerUnallocatedTarget(customerName) : 0
                          content = unallocated > 0 ? formatTargetSplitWan(unallocated) : '0.00 万'
                        }
                      } else if (column.kind === 'target') {
                        const goalKey = column.key as TargetSplitGoalKey
                        const total = customerName ? getTargetSplitCustomerGoalTotal(customerName, goalKey) : 0
                        if (isMuyuanNovemberTargetSplit
                          && customerName
                          && targetSplitEmployeeNames.includes(customerName as DashboardCompanyBoardEmployeeName)
                          && goalKey !== 'outsourcingOrderCountTarget') {
                          const assignedTarget = targetSplitPlan.customerGoalTargets[customerName]?.[goalKey]
                          content = renderTargetSplitSummaryAmount(
                            `customerGoal:${customerName}:${goalKey}`,
                            assignedTarget ?? total.toFixed(2),
                            `${customerName}${column.name}（万元）`,
                            (value) => updateTargetSplitPlan((plan) => ({
                              ...plan,
                              customerGoalTargets: {
                                ...plan.customerGoalTargets,
                                [customerName]: {
                                  ...plan.customerGoalTargets[customerName],
                                  [goalKey]: value,
                                },
                              },
                            })),
                            false,
                            targetSplitGenerating,
                            total > 0 ? formatTargetSplitWan(total) : '—',
                          )
                        } else {
                          content = goalKey === 'outsourcingOrderCountTarget'
                            ? total > 0 ? `${total} 单` : '0 单'
                            : total > 0 ? formatTargetSplitWan(total) : '—'
                        }
                      }
                      return <div className={`target-management-cell target-split-person-cell target-split-summary-cell${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`} role="cell" key={column.key} data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined} style={getTargetSplitFrozenColumnStyle(columnIndex)}>{content}</div>
                    })}
                  </div>
                  {hasGoalRationales && !rationaleCollapsed && targetSplitActiveBoardView === 'logic' ? (
                    <div className="target-management-row target-split-customer-rationale-row" role="row" aria-label={`${label}目标分析`} style={{ gridTemplateColumns }}>
                      {columns.map((column, columnIndex) => {
                        let content: ReactNode = ''
                        if (column.key === 'customerFacingPerson') {
                          content = <strong>目标分析</strong>
                        } else if (column.kind === 'target') {
                          content = rationalesByGoal[column.key as TargetSplitGoalKey] ?? ''
                        }
                        return <div className={`target-management-cell target-split-person-cell target-split-summary-cell${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`} role="cell" key={column.key} data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined} style={getTargetSplitFrozenColumnStyle(columnIndex)}>{content}</div>
                      })}
                    </div>
                  ) : null}
                </Fragment>
              )
            }) : customerGroups.map(({ customerName, rows }) => {
              const label = customerName || '待选择对客人'
              const personTarget = customerName ? getTargetSplitPersonTarget(customerName) : 0
              const hierarchicalGroups = isPersonalTargetSplitOwner(targetSplitOwnerName) ? getTargetSplitHierarchicalGroups(rows) : []
              const personRationale = targetSplitPlan.customerRationales[customerName]
              const displayedPersonRationale = isMuyuanNovemberTargetSplit
                ? getMuyuanNovemberVisibleCustomerRationale(personRationale ?? '')
                : personRationale
              const rationaleKey = `${targetSplitMonth}:${customerName}`
              const rationaleCollapsed = !expandedTargetSplitRationales.has(rationaleKey)
              return (
                <Fragment key={`split-group-${label}`}>
                  {hideTargetSplitOwnerColumns ? null : (
                  <div className="target-management-row target-split-person-summary" role="row" style={{ gridTemplateColumns }}>
                    {columns.map((column, columnIndex) => {
                      let content: ReactNode = ''
                      if (column.key === 'customerFacingPerson') {
                        const importBlockReason = customerName ? getTargetSplitPersonImportBlockReason(customerName) : '请先选择对客人'
                        content = (
                          <span className="target-split-person-name">
                            <span className="target-split-person-name-text">
                              <strong>{label}</strong>
                              <small>示例公司有限公司目标 {personTarget.toFixed(2)} 万</small>
                            </span>
                            {customerName && !targetSplitUsesHeaderImportOnly ? (
                              <button
                                type="button"
                                className="target-split-person-import-button"
                                disabled={targetSplitGenerating || targetSplitImportLoading || Boolean(importBlockReason)}
                                title={importBlockReason || `${targetSplitOwnerName === '示例开发01' ? `把${label}的目标导入其【听说】看板` : `导入${label}在方片月${targetSplitMonth - 139}月的拆分目标`}`}
                                aria-label={targetSplitOwnerName === '示例开发01' ? `导入${label}的【听说】看板` : `导入${label}的目标管理`}
                                onClick={() => {
                                  setTargetSplitImportError('')
                                  setTargetSplitImportEmployeeName(customerName)
                                  setTargetSplitImportOpen(true)
                                }}
                              >
                                导入
                              </button>
                            ) : null}
                          </span>
                        )
                      } else if (column.key === 'companyName') {
                        content = isPersonalTargetSplitOwner(targetSplitOwnerName)
                          ? <small>{hierarchicalGroups.length} 家公司 · {hierarchicalGroups.reduce((sum, company) => sum + company.platforms.length, 0)} 个平台 · {hierarchicalGroups.reduce((sum, company) => sum + company.projectCount, 0)} 个项目</small>
                          : <small>{rows.length} 组公司/平台/品牌</small>
                      }
                      return <div className={`target-management-cell target-split-person-cell${columnIndex < targetSplitFrozenColumnCount ? ' target-split-frozen-cell' : ''}`} role="cell" key={column.key} data-target-split-frozen-column={columnIndex < targetSplitFrozenColumnCount ? columnIndex : undefined} style={getTargetSplitFrozenColumnStyle(columnIndex)}>{content}</div>
                    })}
                  </div>
                  )}
                  {isPersonalTargetSplitOwner(targetSplitOwnerName)
                    ? hierarchicalGroups.map((company) => {
                      const companyRationale = targetSplitPlan.companyRationales[company.companyName]
                      return (
                        <Fragment key={`target-split-company-wrapper-${company.companyName}`}>
                          {renderHierarchicalCompanyGroup(company)}
                          {companyRationale ? (
                            <div className="target-split-company-rationale" role="row">
                              <div className="target-split-company-rationale-cell" role="cell" style={{ gridColumn: '1 / -1' }}>
                                <strong>目标分配依据：</strong>
                                <span>{companyRationale}</span>
                              </div>
                            </div>
                          ) : null}
                        </Fragment>
                      )
                    })
                    : rows.map(renderDataRow)}
                  {rows.length === 0 ? <div className="target-split-no-detail">暂无公司/平台/品牌明细。可点击“新增行”补充；当前分配值 {personTarget.toFixed(2)} 万尚未细分。</div> : null}
                  {displayedPersonRationale && targetSplitActiveBoardView === 'logic' ? (
                    <div className={`target-split-inline-rationale${rationaleCollapsed ? ' is-collapsed' : ''}`}>
                      <button
                        type="button"
                        className={`target-split-inline-rationale-heading${isMuyuanNovemberTargetSplit ? ' is-muyuan-november' : ''}`}
                        aria-label={`${rationaleCollapsed ? '展开' : '收起'}${label}分配依据`}
                        aria-expanded={!rationaleCollapsed}
                        onClick={() => toggleTargetSplitRationale(rationaleKey)}
                      >
                        <span aria-hidden="true">▾</span>
                        <strong>{label} 分配依据</strong>
                      </button>
                      {!rationaleCollapsed ? <span>{displayedPersonRationale}</span> : null}
                    </div>
                  ) : null}
                </Fragment>
              )
            })}
          </div>
        </div>
        <input
          className="company-dashboard-horizontal-range target-split-horizontal-range target-split-horizontal-range-bottom"
          type="range"
          min={0}
          max={targetSplitTableScrollMax}
          step={1}
          value={targetSplitTableScrollPosition}
          disabled={targetSplitTableScrollMax === 0}
          aria-label="底部横向滚动目标拆分表格"
          onChange={(event) => scrollTargetSplitTableTo(Number(event.currentTarget.value))}
        />
        {targetSplitWorkbookImportOpen ? (
          <div className="chart-modal-backdrop target-split-import-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !targetSplitWorkbookImportLoading) setTargetSplitWorkbookImportOpen(false)
          }}>
            <section className="chart-modal target-split-import-modal target-split-workbook-import-modal" role="dialog" aria-modal="true" aria-labelledby="target-split-workbook-import-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <h3 id="target-split-workbook-import-title">导入企微链接、Excel或图片</h3>
                  <p>导入到{targetSplitOwnerName}2026年11月听说看板；读取后先预览，确认后才更新当前计划。</p>
                </div>
                <button type="button" disabled={targetSplitWorkbookImportLoading} onClick={() => setTargetSplitWorkbookImportOpen(false)}>关闭</button>
              </div>
              <div className="target-management-import-mode-switch" role="group" aria-label="目标拆分导入方式">
                <button
                  type="button"
                  className={targetSplitWorkbookImportMode === 'link' ? 'active' : ''}
                  aria-pressed={targetSplitWorkbookImportMode === 'link'}
                  onClick={() => {
                    setTargetSplitWorkbookImportMode('link')
                    setTargetSplitWorkbookImportFile(null)
                    setTargetSplitWorkbookImportError('')
                    setTargetSplitWorkbookImportPreview(null)
                  }}
                >企微链接</button>
                <button
                  type="button"
                  className={targetSplitWorkbookImportMode === 'file' ? 'active' : ''}
                  aria-pressed={targetSplitWorkbookImportMode === 'file'}
                  onClick={() => {
                    setTargetSplitWorkbookImportMode('file')
                    setTargetSplitWorkbookImportFile(null)
                    setTargetSplitWorkbookImportError('')
                    setTargetSplitWorkbookImportPreview(null)
                  }}
                >Excel文件</button>
                {isMuyuanNovemberTargetSplit ? <button
                  type="button"
                  className={targetSplitWorkbookImportMode === 'image' ? 'active' : ''}
                  aria-pressed={targetSplitWorkbookImportMode === 'image'}
                  onClick={() => {
                    setTargetSplitWorkbookImportMode('image')
                    setTargetSplitWorkbookImportFile(null)
                    setTargetSplitWorkbookImportError('')
                    setTargetSplitWorkbookImportPreview(null)
                  }}
                >图片识别</button> : null}
              </div>
              {targetSplitWorkbookImportMode === 'link' ? (
                <div className="target-management-import-link-row">
                  <input
                    type="url"
                    value={targetSplitWorkbookImportUrl}
                    placeholder="粘贴 doc.weixin.qq.com/sheet/... 链接"
                    aria-label="企微目标拆分表格链接"
                    disabled={targetSplitWorkbookImportLoading}
                    onChange={(event) => setTargetSplitWorkbookImportUrl(event.currentTarget.value)}
                  />
                  <button type="button" className="target-management-import-button" disabled={targetSplitWorkbookImportLoading || !targetSplitWorkbookImportUrl.trim()} onClick={() => void loadTargetSplitWorkbookImportPreview()}>
                    {targetSplitWorkbookImportLoading ? '读取中…' : '读取并预览'}
                  </button>
                </div>
              ) : targetSplitWorkbookImportMode === 'file' ? (
                <div className="target-management-import-file-row">
                  <label className="target-management-import-file-picker">
                    <span>{targetSplitWorkbookImportFile?.name ?? '选择Excel或CSV文件'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.xlsm,.csv"
                      aria-label="选择目标拆分Excel文件"
                      disabled={targetSplitWorkbookImportLoading}
                      onChange={(event) => {
                        setTargetSplitWorkbookImportFile(event.currentTarget.files?.[0] ?? null)
                        setTargetSplitWorkbookImportError('')
                        setTargetSplitWorkbookImportPreview(null)
                      }}
                    />
                  </label>
                  <button type="button" className="target-management-import-button" disabled={targetSplitWorkbookImportLoading || !targetSplitWorkbookImportFile} onClick={() => void loadTargetSplitWorkbookImportPreview()}>
                    {targetSplitWorkbookImportLoading ? '读取中…' : '读取并预览'}
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="target-split-image-paste-zone"
                    tabIndex={0}
                    autoFocus
                    aria-label="图片粘贴识别区域"
                    onPaste={(event) => {
                      const imageItem = Array.from(event.clipboardData.items).find((item) => item.kind === 'file' && item.type.startsWith('image/'))
                      const image = imageItem?.getAsFile() ?? event.clipboardData.files[0]
                      if (!image) return
                      event.preventDefault()
                      startTargetSplitImageRecognition(image)
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith('image/'))
                      if (image) startTargetSplitImageRecognition(image)
                    }}
                  >
                    <strong>复制图片后，在此区域按 Ctrl+V / ⌘+V 自动上传识别</strong>
                    <span>也可以将图片拖到这里；识别完成后先检查预览，再确认导入。</span>
                  </div>
                  <div className="target-management-import-file-row">
                    <label className="target-management-import-file-picker">
                      <span>{targetSplitWorkbookImportFile?.name ?? '选择表格图片（小于 9 MB）'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/bmp,image/gif,image/tiff"
                        aria-label="选择目标拆分表格图片"
                        disabled={targetSplitWorkbookImportLoading}
                        onChange={(event) => {
                          setTargetSplitWorkbookImportFile(event.currentTarget.files?.[0] ?? null)
                          setTargetSplitWorkbookImportError('')
                          setTargetSplitWorkbookImportPreview(null)
                        }}
                      />
                    </label>
                    <button type="button" className="target-management-import-button" disabled={targetSplitWorkbookImportLoading || !targetSplitWorkbookImportFile} onClick={() => void loadTargetSplitWorkbookImportPreview()}>
                      {targetSplitWorkbookImportLoading ? '识别中…' : '上传并识别'}
                    </button>
                  </div>
                </>
              )}
              <p className="target-split-workbook-import-hint">{targetSplitWorkbookImportMode === 'image'
                ? '支持PNG、JPG、WEBP、BMP、GIF、TIFF图片，需小于9 MB。系统会智能识别对客人、总目标和具体业绩目标；图片仅用于本次识别，结果先预览，确认后才导入当前看板。'
                : '支持企微在线表格链接及 .xlsx、.xls、.xlsm、.csv；建议先用本看板的“导出Excel”作为模板。金额按万元录入，外采单数按单录入。企微链接需能读取表格，多个工作表时请选“目标拆分”页。'}</p>
              {targetSplitWorkbookImportLoading ? <div className="dashboard-data-note" role="status" aria-live="polite">{targetSplitWorkbookImportProgress || '后台正在读取表格…'}</div> : null}
              {targetSplitWorkbookImportError ? <p className="target-split-error" role="alert">{targetSplitWorkbookImportError}</p> : null}
              {targetSplitWorkbookImportPreview ? (
                <div className="target-split-workbook-import-preview">
                  <strong>识别结果：{targetSplitWorkbookImportPreview.sourceName} / {targetSplitWorkbookImportPreview.sheetTitle}</strong>
                  <span>总目标：{targetSplitWorkbookImportPreview.totalTarget} 万；识别业绩类别 {targetSplitWorkbookImportPreview.goalKeys.length} 项、对客人 {targetSplitWorkbookImportPreview.recognizedPersonCount} 位、公司明细 {targetSplitWorkbookImportPreview.rows.length} 行。</span>
                  <span>导入范围：{targetSplitOwnerName}，方片月11月；其他人员和月份不变。</span>
                  <span>
                    团队具体目标：{targetSplitWorkbookImportPreview.goalKeys.map((goalKey) => {
                      const goalValue = targetSplitWorkbookImportPreview.goalTargets[goalKey] ?? ''
                      const goalName = columns.find((column) => column.key === goalKey)?.name ?? goalKey
                      const unit = goalKey === 'outsourcingOrderCountTarget' ? '单' : '万'
                      return `${goalName} ${goalValue ? `${goalValue}${unit}` : '—'}`
                    }).join(' / ')}
                  </span>
                  {Object.entries(targetSplitWorkbookImportPreview.customerTargets).length ? (
                    <div className="target-split-workbook-import-people">
                      {Object.entries(targetSplitWorkbookImportPreview.customerTargets).map(([employeeName, personTarget]) => (
                        <span key={employeeName}>
                          <strong>{employeeName}：{personTarget || '—'}{personTarget ? '万' : ''}</strong>
                          {' · '}
                          {targetSplitWorkbookImportPreview.goalKeys.map((goalKey) => {
                            const goalValue = targetSplitWorkbookImportPreview.customerGoalTargets[employeeName]?.[goalKey] ?? ''
                            const goalName = columns.find((column) => column.key === goalKey)?.name ?? goalKey
                            const unit = goalKey === 'outsourcingOrderCountTarget' ? '单' : '万'
                            return `${goalName} ${goalValue ? `${goalValue}${unit}` : '—'}`
                          }).join(' / ')}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {targetSplitWorkbookImportPreview.warnings.map((warning) => <span className="is-warning" key={warning}>{warning}</span>)}
                  <p>{targetSplitWorkbookImportPreview.hasDetailTable
                    ? `确认后替换当前看板的目标与公司明细（${targetSplitWorkbookImportPreview.rows.length}行）。`
                    : targetSplitWorkbookImportMode === 'image'
                      ? '图片未识别到公司/平台/项目品牌明细，确认后保留当前公司明细。'
                      : '文件没有公司/平台/项目品牌明细列，确认后保留当前公司明细。'}未列出的业绩类别和未出现的对客人保留当前值。</p>
                </div>
              ) : null}
              <div className="target-management-import-footer">
                <button type="button" disabled={targetSplitWorkbookImportLoading} onClick={() => setTargetSplitWorkbookImportOpen(false)}>取消</button>
                <button type="button" disabled={targetSplitWorkbookImportLoading || !targetSplitWorkbookImportPreview} onClick={applyTargetSplitWorkbookImport}>
                  确认导入当前看板
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {targetSplitImportOpen ? (
          <div className="chart-modal-backdrop target-split-import-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !targetSplitImportLoading) {
              setTargetSplitImportOpen(false)
              setTargetSplitImportEmployeeName(null)
            }
          }}>
            <section className="chart-modal target-split-import-modal" role="dialog" aria-modal="true" aria-labelledby="target-split-import-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <h3 id="target-split-import-title">{targetSplitImportEmployeeName
                    ? importTargetsListenBoard
                      ? `导入${targetSplitImportEmployeeName}的【听说】看板`
                      : `导入${targetSplitImportEmployeeName}的目标管理`
                    : importTargetsListenBoard ? '导入八位对客人的【听说】看板' : `导入${targetSplitOwnerName}的目标管理`}</h3>
                  <p>{targetSplitImportEmployeeName
                    ? importTargetsListenBoard
                      ? `导入方片月${targetSplitMonth - 139}月；在该对客人的【听说】看板中，最上方一行写入其全部总目标，下方一行起更新具体公司/平台/项目目标；保留其他对客人及其他月份。`
                      : `导入方片月${targetSplitMonth - 139}月；只替换${targetSplitImportEmployeeName}该月的目标及公司/平台/品牌布局，保留其他对客人及其他月份，不抓取业绩。`
                    : importTargetsListenBoard
                      ? `导入方片月${targetSplitMonth - 139}月；在八位对客人各自的【听说】看板中，最上方一行写入示例公司有限公司全部总目标，下方更新公司/平台/项目目标；保留其他月份。`
                      : `导入方片月${targetSplitMonth - 139}月；只替换该月的目标及公司/平台/品牌布局，保留其他月份，不抓取业绩。`}</p>
                </div>
                <button type="button" disabled={targetSplitImportLoading} onClick={() => {
                  setTargetSplitImportOpen(false)
                  setTargetSplitImportEmployeeName(null)
                }}>关闭</button>
              </div>
              <div className="target-split-import-summary">
                <strong>{targetSplitImportEmployeeName
                  ? `${targetSplitImportEmployeeName}发布目标：${targetSplitImportScopeAllocatedAmount.toFixed(2)} 万`
                  : `总发布目标：${Number(targetSplitPlan.totalTarget || 0).toFixed(2)} 万`}</strong>
                <span>{importTargetsListenBoard ? `将写入 ${targetSplitImportScopeRows.length} 行公司/平台/项目目标：顶部为全部总目标，下方一行起更新明细` : `可导入 ${targetSplitImportScopeRows.length} 行公司/平台/品牌目标`}；外采单数单独录入，不计入总目标。</span>
                <div className="target-split-import-people">
                  {targetSplitImportScopeNames.map((employeeName) => <span key={employeeName}>{employeeName}：{getTargetSplitPersonTarget(employeeName).toFixed(2)} 万</span>)}
                </div>
                {targetSplitImportScopeIncompleteRowCount > 0 ? <p className={targetSplitOwnerName === '示例开发01' ? 'target-split-notice' : 'target-split-error'}>{targetSplitImportEmployeeName ? `${targetSplitImportEmployeeName}有 ` : '有 '}{targetSplitImportScopeIncompleteRowCount} 行目标缺少必需维度{targetSplitOwnerName === '示例开发01' ? '；仍可导入示例公司有限公司总目标，未补齐维度的明细行不会写入。' : '，补齐后才能导入。'}</p> : null}
                {targetSplitOwnerName !== '示例开发01' && !targetSplitGenerationMatchesGoalInputs ? <p className="target-split-error">固定目标尚未生成对应拆分结果，或目标金额已修改；请先点击“生成目标”。</p> : null}
                {!targetSplitImportEmployeeName && Math.abs(targetSplitAllocationGap) >= 0.01 ? <p className="target-split-error">{targetSplitOwnerName === '示例开发01' ? '八位对客人分配合计' : `${targetSplitOwnerName}分配合计`}与总目标相差 {targetSplitAllocationGap.toFixed(2)} 万，请重新生成或调整目标后再导入。</p> : null}
                {targetSplitImportError ? <p className="target-split-error" role="alert">{targetSplitImportError}</p> : null}
                <p className="target-split-import-caution">{targetSplitImportEmployeeName
                  ? importTargetsListenBoard
                    ? `确认后只更新${targetSplitImportEmployeeName}本人在该方片月的【听说】看板：顶部总目标与下方公司/平台/项目明细一起替换；其他对客人及其他月份不受影响。`
                    : `确认后只会覆盖${targetSplitImportEmployeeName}本方的方片月目标内容，其他对客人不受影响；如有尚未细分到公司/平台/品牌的金额，将只写入其总目标，需在目标管理中继续拆分。`
                  : importTargetsListenBoard
                    ? '确认后会更新八位对客人各自的【听说】看板：最上方为示例公司有限公司总目标，下方为公司/平台/项目目标；其他月份不受影响。'
                    : targetSplitOwnerName === '示例开发01'
                      ? '确认后会覆盖八示例公司有限公司本方片月的目标内容；如有尚未细分到公司/平台/品牌的金额，将只写入该人的总目标，需在目标管理中继续拆分。'
                      : `确认后只会覆盖${targetSplitOwnerName}本方的方片月目标内容，不会改动其他七位对客人；如有尚未细分到公司/平台/品牌的金额，将只写入总目标，需在目标管理中继续拆分。`}</p>
              </div>
              <div className="target-management-import-footer">
                <button type="button" disabled={targetSplitImportLoading} onClick={() => {
                  setTargetSplitImportOpen(false)
                  setTargetSplitImportEmployeeName(null)
                }}>取消</button>
                <button type="button" disabled={targetSplitImportLoading || (targetSplitOwnerName !== '示例开发01' && (!targetSplitGenerationMatchesGoalInputs || targetSplitImportScopeIncompleteRowCount > 0)) || targetSplitImportScopeAllocatedAmount <= 0 || (!targetSplitImportEmployeeName && Math.abs(targetSplitAllocationGap) >= 0.01)} onClick={applyTargetSplitImport}>
                  {targetSplitImportLoading ? '导入中…' : '确认导入'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`app-layout${isOtherViewer ? ' app-layout-solo' : ''}`}>
      {isOtherViewer ? null : <aside className="member-sidebar">
        <div className="sidebar-title">
          <strong>对客人员</strong>
          <span>{visibleDashboardMembers.length} 人</span>
        </div>
        <nav className="member-nav">
          {grouped.map(({ group, members }) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {members.map((member) => {
                const snapshot = sidebarUpdateMembers.find((item) => item.name === member.name)
                const updatedAt = snapshot?.hasPerformanceSnapshot
                  ? formatSnapshotUpdateTime(snapshot.performanceUpdatedAt)
                  : null
                const updateLabel = updatedAt
                  ? `${updatedAt}已更新`
                  : dashboardMonthStatus[sidebarUpdateMonthId] === 'loading'
                    ? '读取中'
                    : '待更新'
                return (
                  <button
                    className={member.name === selectedName ? 'active' : ''}
                    key={member.name}
                    onClick={() => {
                      setSelectedName(member.name)
                      setUnpublishedModalOpen(false)
                    }}
                  >
                    <span className="member-identity">
                      <span>{member.name}</span>
                      <b className={`member-type ${member.name === '示例开发01' || member.name === '示例开发10' ? 'develop' : 'customer'}`}>
                        {member.name === '示例开发01' || member.name === '示例开发10' ? '开发' : '对客'}
                      </b>
                    </span>
                    <em
                      title={updatedAt
                        ? `方片月${sidebarUpdateMonthId - 139}月 ${updatedAt}已更新`
                        : `方片月${sidebarUpdateMonthId - 139}月暂无成功快照`}
                    >
                      {updateLabel}
                    </em>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>}

      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {isOtherViewer ? identity.employeeName : `${selectedMember.group} · ${selectedMember.name}`}{' '}
              {isOtherViewer ? null : <b className={`eyebrow-member-type ${selectedName === '示例开发01' || selectedName === '示例开发10' ? 'develop' : 'customer'}`}>
                {selectedName === '示例开发01' || selectedName === '示例开发10' ? '开发' : '对客'}
              </b>}
            </p>
            <h1>业务目标看板</h1>
          </div>
          <label className="month-chip">
            <span>看板月份</span>
            <select
              aria-label={`筛选${selectedName}全部方片月看板`}
              value={allDashboardMonthId}
              onChange={(event) => updateAllDashboardMonths(event.target.value)}
            >
              {DASHBOARD_MONTH_IDS.map((monthId) => (
                <option key={monthId} value={monthId}>{DASHBOARD_FANGPIAN_PERIODS[monthId].label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="dashboard-session-logout"
            onClick={async () => {
              try {
                const response = await fetch("/api/tianji/login/logout", { method: "POST", credentials: "include" })
                if (!response.ok) throw new Error("退出登录失败")
                await finishTianjiLogout(response, { notify: (message) => window.alert(message), reload: () => window.location.reload() })
              } catch {
                window.alert("退出登录失败，请稍后重试。")
              }
            }}
          >
            {identity.employeeName} · 退出登录
          </button>
        </header>

        {targetPersistenceError ? (
          <div className="target-persistence-warning" role="alert">{targetPersistenceError}</div>
        ) : null}

        {negativeAlerts.length > 0 ? (
          <div className="negative-alerts" role="alert">
            {negativeAlerts.map((alert) => <p key={alert}>{alert}</p>)}
          </div>
        ) : null}

      {isOtherViewer ? null : <section className="dimension-grid" id="main-dashboard">
        {[selectedDashboardDimension].map((dimension) => {
          const columns = COLUMNS_BY_DIMENSION[dimension].filter(
            (column) => visibleColumns[dimension].has(column.key) || column.key === 'metricName',
          )
          const isPayment = dimension === 'payment'
          const display = amountDisplay[dimension]
          const monthId = selectedMonths[dimension]
          const periodLabel = DASHBOARD_FANGPIAN_PERIODS[monthId].label
          const lastMonthPeriodLabel = monthId > 147
            ? DASHBOARD_FANGPIAN_PERIODS[(monthId - 1) as DashboardMonthId].label
            : '—'
          const previousMonthId = monthId > 147 ? (monthId - 1) as DashboardMonthId : null
          const previousMonthMember = previousMonthId
            ? dashboardMembersByMonth[previousMonthId]?.find((member) => member.name === selectedName)
            : undefined
          const timeProgress = getFangpianMonthTimeProgress(monthId)
          const monthStatus = dashboardMonthStatus[monthId]
          const backendMember = dashboardMembersByMonth[monthId]?.find((member) => member.name === selectedName)
          const targetOrderDetailsSupported = supportsTargetOrderDetails(selectedName)
          const currentOrderSnapshotAvailable = targetOrderDetailsSupported && backendMember?.hasPerformanceSnapshot === true
          const previousOrderSnapshotAvailable = targetOrderDetailsSupported && previousMonthMember?.hasPerformanceSnapshot === true
          const backendMetric = backendMember?.hasPerformanceSnapshot
            ? backendMember?.orderMetric[dimension]
            : undefined
          const staticPerformance = getDisplayedPerformance(selectedName, dimension, monthId)
          const currentMonthPerformanceAvailable = hasCurrentMonthPerformance(monthId)
          const memberPerformance = backendMetric ? {
            ...staticPerformance,
            halfPastTen: backendMetric.halfPastTen.amount,
            selfIncubated: backendMetric.selfIncubated.amount,
            signingXiaohongshu: backendMetric.signingXiaohongshu.amount,
            signingDouyin: backendMetric.signingDouyin.amount,
            signingShipinhao: backendMetric.signingShipinhao.amount,
            outsourcing: backendMetric.outsourcing.amount,
            outsourcingOrderCount: backendMetric.outsourcingOrderCount.orderCount,
            total: backendMetric.total.amount,
          } : staticPerformance
          const memberLastMonthPerformance = getPreviousMonthPerformance(selectedName, dimension, monthId)
          const dashboardSort = dashboardSorts[dimension]
          const getDashboardSortValue = (metricKey: MetricKey, column: SortableColumnKey) => {
            const currentValue = metricKey === 'total'
              ? getTotalPerformance(memberPerformance)
              : memberPerformance[metricKey]
            if (column === 'currentPerformance') return currentValue
            const lastMonthValue = metricKey === 'total'
              ? getTotalPerformance(memberLastMonthPerformance)
              : memberLastMonthPerformance[metricKey]
            if (column === 'lastMonthPerformance') return lastMonthValue
            const target = manualValues[manualValueKey(monthId, selectedName, dimension, metricKey)]?.target ?? 0
            return target > 0 ? currentValue / target : 0
          }
          const monthMainMetrics = monthId === 150
            ? SUB_METRICS.filter(({ key }) => key !== 'outsourcingOrderCount')
            : SUB_METRICS
          const orderedMainMetrics = dashboardSort
            ? [...monthMainMetrics].sort((left, right) => {
              const difference = getDashboardSortValue(left.key, dashboardSort.column)
                - getDashboardSortValue(right.key, dashboardSort.column)
              return dashboardSort.direction === 'asc' ? difference : -difference
            })
            : monthMainMetrics
          const paymentTotal = SUB_METRICS.reduce((sum, { key }) => {
            if (key === 'total') return sum
            const metricValue = memberPerformance[key]
            const commissionRate = manualValues[manualValueKey(monthId, selectedName, dimension, key)]?.commissionRate ?? 0
            return sum + metricValue * commissionRate
          }, 0)

          return (
            <article className={`dimension-card dimension-card-${dimension}`} key={dimension}>
              <div className="dimension-head">
                <div className="dimension-head-left">
                  <div className="dimension-switcher" role="group" aria-label="选择看板维度">
                    {DIMENSIONS.map((option) => (
                      <button
                        className={`dimension-switcher-button ${option}${selectedDashboardDimension === option ? ' active' : ''}`}
                        key={option}
                        type="button"
                        aria-pressed={selectedDashboardDimension === option}
                        onClick={() => setSelectedDashboardDimension(option)}
                      >
                        {DIMENSION_NAMES[option]}
                      </button>
                    ))}
                  </div>
                  <h2 className="dimension-title">
                    {DIMENSION_NAMES[dimension]} · {selectedName}{' '}
                    <b className={`dimension-member-type ${selectedName === '示例开发01' || selectedName === '示例开发10' ? 'develop' : 'customer'}`}>
                      {selectedName === '示例开发01' || selectedName === '示例开发10' ? '开发' : '对客'}
                    </b>
                  </h2>
                </div>
                <div className="dimension-controls">
                  <label className="dashboard-month-filter">
                    月份
                    <select value={monthId} onChange={(event) => updateSelectedMonth(dimension, event.target.value)}>
                      {DASHBOARD_MONTH_IDS.map((optionMonthId) => (
                        <option key={optionMonthId} value={optionMonthId}>{DASHBOARD_FANGPIAN_PERIODS[optionMonthId].label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="head-actions">
                  <div className="amount-display-controls" aria-label={`${DIMENSION_NAMES[dimension]}金额显示设置`}>
                    <label>
                      单位
                      <select
                        value={display.unit}
                        onChange={(event) => updateAmountDisplay(dimension, {
                          unit: event.target.value === 'wan' ? 'wan' : 'yuan',
                        })}
                      >
                        <option value="yuan">元</option>
                        <option value="wan">万元</option>
                      </select>
                    </label>
                    <label>
                      小数
                      <select
                        value={display.decimals}
                        onChange={(event) => updateAmountDisplay(dimension, {
                          decimals: Number(event.target.value),
                        })}
                      >
                        {[0, 1, 2, 3, 4].map((decimal) => (
                          <option key={decimal} value={decimal}>{decimal} 位</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    className="chart-button"
                    onClick={() => setChartOpen((current) => ({
                      ...current,
                      [dimension]: !current[dimension],
                    }))}
                  >
                    业绩趋势
                  </button>
                  {(isOtherViewer || isTargetManagementBoardEmployee(selectedName)) ? (
                    <button
                      type="button"
                      className="business-report-trigger"
                      disabled={businessReportLoading}
                      onClick={() => void generateBusinessReport(selectedName as DashboardCompanyBoardEmployeeName, monthId)}
                    >
                      {businessReportLoading ? '正在生成…' : '生成报告'}
                    </button>
                  ) : null}
                  {identity.canViewAll && supportsUnpublishedMetrics(selectedName) ? (
                    <button
                      type="button"
                      className="business-report-trigger"
                      disabled={performanceRefresh?.status === 'running'}
                      title="仅刷新当前人员和当前方片月的发布、成单、结款快照，不触发全量任务"
                      onClick={() => void refreshSelectedEmployeePerformance(selectedName, monthId)}
                    >
                      {performanceRefresh?.status === 'running' ? '正在更新…' : '更新当前业绩'}
                    </button>
                  ) : null}
                  {performanceRefresh?.key === (selectedName + ':' + monthId) ? (
                    <span className={performanceRefresh.status === 'error' ? 'performance-refresh-status error' : 'performance-refresh-status'} role="status">
                      {performanceRefresh.message}
                    </span>
                  ) : null}
                  <details className="column-filter">
                    <summary>筛选维度</summary>
                    <div className="filter-panel">
                      {COLUMNS_BY_DIMENSION[dimension].filter((column) => column.key !== 'metricName').map((column) => (
                        <label key={column.key}>
                          <input
                            type="checkbox"
                            checked={visibleColumns[dimension].has(column.key)}
                            onChange={() => toggleColumn(dimension, column.key)}
                          />
                          {column.name}
                        </label>
                      ))}
                    </div>
                  </details>
                  </div>
                </div>
              </div>

              {monthStatus === 'loading' ? (
                <div className="dashboard-data-note">正在读取{periodLabel}{selectedName}业绩…</div>
              ) : null}
              {monthStatus === 'error' ? (
                <div className="dashboard-data-note dashboard-data-note-error">{monthId === 150 ? '天玑' : '历史快照'}读取失败，{periodLabel}业绩暂未更新。</div>
              ) : null}
              {monthStatus === 'loaded' && !backendMember?.hasPerformanceSnapshot ? (
                <div className="dashboard-data-note">{monthId === 150 ? `${periodLabel}最新快照尚未生成，暂不可显示本月实绩。` : `${periodLabel}历史快照尚未生成，当前暂显原有数据。`}</div>
              ) : null}
              {backendMember?.hasPerformanceSnapshot && backendMember.performanceUpdatedAt ? (
                <div className="dashboard-data-note">固定快照 · 北京时间 {new Intl.DateTimeFormat('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(backendMember.performanceUpdatedAt))} 更新；刷新页面仍展示此数据。</div>
              ) : null}

              <div className="dimension-table">
                <div
                  className="row"
                  style={{ gridTemplateColumns: `minmax(170px, 1.5fr) repeat(${columns.length - 1}, minmax(105px, 0.9fr))` }}
                >
                  {columns.map((column) => {
                    const sortableColumn = isSortableColumn(column.key) ? column.key : null
                    return (
                      <span key={column.key} className={`column-head column-head-${column.key}`}>
                        {sortableColumn ? (
                          <SortButton
                            column={sortableColumn}
                            label={column.name}
                            sort={dashboardSort}
                            onClick={() => setDashboardSorts((current) => ({
                              ...current,
                              [dimension]: nextSortConfig(current[dimension], sortableColumn),
                            }))}
                            onReset={() => setDashboardSorts((current) => ({ ...current, [dimension]: null }))}
                          />
                        ) : column.name}
                        {column.key === 'currentPerformance' ? <small className="column-period-label">{periodLabel}</small> : null}
                        {column.key === 'lastMonthPerformance' ? <small className="column-period-label">{lastMonthPeriodLabel}</small> : null}
                        {column.key === 'unpublishedPerformance' ? (
                          <small>
                            {unpublishedSummary?.periodLabel ?? '方片月6月至当月'}
                            {unpublishedSummary?.snapshotUpdatedAt
                              ? ` · ${new Intl.DateTimeFormat('zh-CN', {
                                timeZone: 'Asia/Shanghai',
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }).format(new Date(unpublishedSummary.snapshotUpdatedAt))}更新`
                              : ''}
                          </small>
                        ) : null}
                      </span>
                    )
                  })}
                </div>

                {orderedMainMetrics.map(({ key, name }) => {
                  const currentValue = key === 'total' ? getTotalPerformance(memberPerformance) : memberPerformance[key]
                  const lastMonthValue = key === 'total'
                    ? getTotalPerformance(memberLastMonthPerformance)
                    : memberLastMonthPerformance[key]
                  const metricValue = currentValue
                  const metricTargetKey = manualValueKey(monthId, selectedName, dimension, key)
                  const manual = manualValues[metricTargetKey]
                  const target = manual?.target ?? 0
                  const commissionRate = manual?.commissionRate ?? 0
                  const commissionRateKey = metricTargetKey
                  const completionRate = target > 0 ? metricValue / target : 0
                  const commission = isPayment ? metricValue * commissionRate : 0
                  const unpublishedMetricKey = key as DashboardUnpublishedMetricKey
                  const unpublishedMetric = unpublishedSummary?.metrics[unpublishedMetricKey]
                  const renderTargetPerformance = (value: number, targetMonthId: number, canOpen: boolean) => {
                    const valueLabel = isOutsourcingOrderCount(key) ? `${value} 单` : formatAmount(value, display)
                    const valueContent = <b className={value < 0 ? 'negative-value' : undefined}>{valueLabel}</b>
                    if (!canOpen) return valueContent
                    return (
                      <button
                        type="button"
                        className="target-order-amount-button"
                        title="点击查看对应订单明细"
                        aria-label={`${selectedName}方片月${targetMonthId - 139}月${DIMENSION_NAMES[dimension]}${name}，点击查看订单明细`}
                        onClick={() => openTargetOrderDetails(targetMonthId, dimension, key, name)}
                      >
                        {valueContent}
                      </button>
                    )
                  }
                  const values: Partial<Record<ColumnKey, ReactNode>> = {
                    currentPerformance: targetOrderDetailsSupported
                      ? currentMonthPerformanceAvailable
                        ? renderTargetPerformance(metricValue, monthId, currentOrderSnapshotAvailable)
                        : <b>—</b>
                      : (
                        <b className={currentMonthPerformanceAvailable && currentValue < 0 ? 'negative-value' : undefined}>
                          {currentMonthPerformanceAvailable
                            ? isOutsourcingOrderCount(key) ? `${metricValue} 单` : formatAmount(currentValue, display)
                            : '—'}
                        </b>
                      ),
                    lastMonthPerformance: targetOrderDetailsSupported && previousMonthId && previousOrderSnapshotAvailable
                      ? renderTargetPerformance(lastMonthValue, previousMonthId, true)
                      : (
                        <b className={lastMonthValue < 0 ? 'negative-value' : undefined}>
                          {isOutsourcingOrderCount(key) ? `${lastMonthValue} 单` : formatAmount(lastMonthValue, display)}
                        </b>
                    ),
                    target: (
                      !canEditSelectedTargets ? (
                        <span className="target-value-display" title="组员目标仅供查看">
                          <b>{target > 0 ? formatTargetInput(target, key) : '未设置'}</b>
                          {target > 0 ? <small>{isOutsourcingOrderCount(key) ? '单' : '万元'}</small> : null}
                        </span>
                      ) : editingMetricTargetKey === metricTargetKey ? (
                        <div className="target-input">
                          <input
                            autoFocus
                            type="text"
                            inputMode={isOutsourcingOrderCount(key) ? 'numeric' : 'decimal'}
                            value={targetDrafts[metricTargetKey] ?? (target ? formatTargetInput(target, key) : '')}
                            placeholder={isOutsourcingOrderCount(key) ? '0' : '0.00'}
                            aria-label={`${name}目标，单位${isOutsourcingOrderCount(key) ? '单' : '万元'}`}
                            onChange={(event) => updateTarget(dimension, key, event.target.value)}
                            onBlur={() => {
                              finishTargetEdit(dimension, key)
                              setEditingMetricTargetKey(null)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur()
                            }}
                          />
                          <small>{isOutsourcingOrderCount(key) ? '单' : '万元'}</small>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`target-value-display${target > 0 ? '' : ' is-empty'}`}
                          title="点击编辑目标"
                          aria-label={`${name}目标${target > 0 ? formatTargetInput(target, key) : '未设置'}，点击编辑`}
                          onClick={() => {
                            setTargetDrafts((current) => ({
                              ...current,
                              [metricTargetKey]: current[metricTargetKey] ?? (target ? formatTargetInput(target, key) : ''),
                            }))
                            setEditingMetricTargetKey(metricTargetKey)
                          }}
                        >
                          <b>{target > 0 ? formatTargetInput(target, key) : '设置目标'}</b>
                          {target > 0 ? <small>{isOutsourcingOrderCount(key) ? '单' : '万元'}</small> : null}
                        </button>
                      )
                    ),
                    targetCompletion: (
                      <div className="target-completion">
                        <b className={currentMonthPerformanceAvailable && target > 0 && completionRate > timeProgress
                          ? 'target-completion-ahead'
                          : currentMonthPerformanceAvailable && target > 0 && completionRate < timeProgress
                            ? 'target-completion-behind'
                            : undefined}>
                          {currentMonthPerformanceAvailable && target > 0 ? formatRate(completionRate) : '—'}
                        </b>
                        <small>时间进度 {formatRate(timeProgress)}</small>
                      </div>
                    ),
                    unpublishedPerformance: !supportsUnpublishedMetrics(selectedName) ? <b>—</b> : (
                      <button
                        className="unpublished-amount-button"
                        onClick={() => openUnpublishedDetails(selectedName, unpublishedMetricKey, customerDashboardMonth)}
                        aria-label={`查看${selectedName}${UNPUBLISHED_METRIC_NAMES[unpublishedMetricKey]}未发布订单明细`}
                      >
                        {unpublishedStatus === 'error'
                          ? '读取失败'
                          : unpublishedMetric
                            ? unpublishedMetricKey === 'outsourcingOrderCount'
                              ? `${unpublishedMetric.orderCount} 单`
                              : formatAmount(unpublishedMetric.amount, display)
                            : unpublishedStatus === 'loading' ? '读取中…' : '加载中…'}
                        {unpublishedMetric && unpublishedMetricKey !== 'outsourcingOrderCount'
                          ? <small>{unpublishedMetric.orderCount} 单</small>
                          : null}
                      </button>
                    ),
                    commissionRate: (
                      <input
                        type="text"
                        inputMode="decimal"
                        readOnly={!canEditSelectedTargets}
                        title={canEditSelectedTargets ? undefined : '组员提成系数仅供查看'}
                        value={commissionRateDrafts[commissionRateKey] ?? (commissionRate ? String(commissionRate) : '')}
                        placeholder="0"
                        onChange={(event) => updateCommissionRate(dimension, key, event.target.value)}
                        onBlur={() => finishCommissionRateEdit(dimension, key)}
                      />
                    ),
                    commission: <b className={currentMonthPerformanceAvailable && commission < 0 ? 'negative-value' : undefined}>{currentMonthPerformanceAvailable ? formatAmount(commission, display) : '—'}</b>,
                  }

                  return (
                    <div
                      className="row"
                      key={key}
                      style={{ gridTemplateColumns: `minmax(170px, 1.5fr) repeat(${columns.length - 1}, minmax(105px, 0.9fr))` }}
                    >
                      <span>{name}</span>
                      {columns.filter((column) => column.key !== 'metricName').map((column) => (
                        <span key={column.key}>{values[column.key]}</span>
                      ))}
                    </div>
                  )
                })}

                {isPayment && visibleColumns.payment.has('commission') ? (
                  <div className="total-row">
                    <span>提成加总</span>
                    <b className={currentMonthPerformanceAvailable && paymentTotal < 0 ? 'negative-value' : undefined}>{currentMonthPerformanceAvailable ? formatAmount(paymentTotal, amountDisplay.payment) : '—'}</b>
                  </div>
                ) : null}

              </div>
            </article>
          )
        })}
      </section>}

      {customerCompanyBrandBoardEmployeeName ? (
        <section className="supplementary-dashboard-grid wangyue-target-entity-board" aria-label={`${customerCompanyBrandBoardEmployeeName}公司和品牌${(isOtherViewer || isTargetManagementBoardEmployee(selectedName)) ? '及目标管理' : ''}看板`}>
          <article className={`supplementary-dashboard-card${isWangYueTargetManagementActive || targetSplitBoardActive ? ' target-management-dashboard-card' : ` company-dashboard-card company-dashboard-card-${wangYueTargetEntityDimensions[wangYueTargetEntityBoard]}`}`}>
            <div className="supplementary-dashboard-tabs" role="tablist" aria-label={`${customerCompanyBrandBoardEmployeeName}看板类型`}>
              {([
                { key: 'company', label: '公司' },
                { key: 'brand', label: '品牌' },
                ...((isOtherViewer || isTargetManagementBoardEmployee(selectedName)) ? [{ key: 'targetManagement' as const, label: '目标管理' }] : []),
                ...((isOtherViewer || isTargetManagementBoardEmployee(selectedName)) ? [{ key: 'targetSplit' as const, label: '听说你还不会拆？' }] : []),
              ] as const).map(({ key, label }) => {
                const isActive = key === 'targetManagement'
                  ? isWangYueTargetManagementActive
                  : key === 'targetSplit'
                    ? targetSplitBoardActive
                    : !isWangYueTargetManagementActive && !targetSplitBoardActive && wangYueTargetEntityBoard === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`supplementary-dashboard-tab${isActive ? ' active' : ''}`}
                    onClick={() => {
                      setTargetSplitImportOpen(false)
                      if (key === 'targetSplit') {
                        setWangYueTargetManagementActive(false)
                        setTargetSplitBoardActive(true)
                        return
                      }
                      if (key === 'targetManagement') {
                        setTargetSplitBoardActive(false)
                        setWangYueTargetManagementActive(true)
                        return
                      }
                      setTargetSplitBoardActive(false)
                      setWangYueTargetManagementActive(false)
                      setWangYueTargetEntityBoard(key)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="supplementary-dashboard-head company-dashboard-head">
              {targetSplitBoardActive ? renderTargetSplitBoardHeader() : isWangYueTargetManagementActive ? (
                <>
                  <div className="supplementary-dashboard-title-group target-management-dashboard-title-group">
                    <div className="dimension-switcher" role="group" aria-label="目标管理看板维度">
                      <span className="dimension-switcher-button publish active" aria-current="true">发布</span>
                    </div>
                    <h2>{`发布 · ${selectedName} · 目标管理`}</h2>
                  </div>
                  <div className="target-management-dashboard-controls">
                    <label className="dashboard-month-filter">
                      月份
                      <select
                        value={wangYueTargetManagementMonth}
                        onChange={(event) => {
                          const monthId = Number(event.target.value) as TargetManagementMonthId
                          if (!TARGET_MANAGEMENT_MONTH_IDS.includes(monthId)) return
                          saveWangYueTargetManagementLayout(wangYueTargetManagementMonth, {
                            companySlots: wangYueTargetManagementCompanySlots,
                            brandFilters: wangYueTargetManagementBrandFilters,
                            subBrandFilters: wangYueTargetManagementSubBrandFilters,
                            brandSlotCounts: wangYueTargetManagementBrandSlotCounts,
                            productLines: wangYueTargetManagementProductLines,
                          }, selectedName)
                          const savedLayout = readWangYueTargetManagementLayouts(selectedName)[monthId]
                          setWangYueTargetManagementMonth(monthId)
                          setWangYueTargetManagementCompanySlots(savedLayout?.companySlots
                            ?? Array.from({ length: WANGYUE_TARGET_MANAGEMENT_DEFAULT_COMPANY_COUNT }, () => ''))
                          setActiveWangYueTargetManagementCompanySearchSlot(null)
                          setWangYueTargetManagementCompanySearch('')
                          setWangYueTargetManagementCompanySearchSource('deal')
                          setWangYueTargetManagementBrandFilters(savedLayout?.brandFilters ?? {})
                          setWangYueTargetManagementSubBrandFilters(savedLayout?.subBrandFilters ?? {})
                          setWangYueTargetManagementBrandSlotCounts(savedLayout?.brandSlotCounts ?? {})
                          setWangYueTargetManagementProductLines(savedLayout?.productLines ?? {})
                        }}
                    >
                        {TARGET_MANAGEMENT_MONTH_IDS.map((monthId) => (
                          <option key={monthId} value={monthId}>{DASHBOARD_FANGPIAN_PERIODS[monthId].label}</option>
                        ))}
                      </select>
                    </label>
                    {(isOtherViewer || isTargetManagementBoardEmployee(selectedName)) ? (
                      <button
                        type="button"
                        className="target-management-import-button"
                        onClick={() => {
                          setWangYueTargetManagementImportError('')
                          setWangYueTargetManagementImportPreview(null)
                          setWangYueTargetManagementImportChatInput('')
                          setWangYueTargetManagementImportChatMessages([TARGET_MANAGEMENT_IMPORT_WELCOME])
                          setWangYueTargetManagementImportMode('link')
                          setWangYueTargetManagementImportFile(null)
                          setWangYueTargetManagementImportOpen(true)
                        }}
                      >
                        导入目标
                      </button>
                    ) : null}
                    <div className="amount-display-controls" aria-label="目标管理金额显示设置">
                      <label>
                        单位
                        <select
                          value={wangYueTargetManagementAmountDisplay.unit}
                          onChange={(event) => setWangYueTargetManagementAmountDisplay((current) => ({
                            ...current,
                            unit: event.target.value === 'wan' ? 'wan' : 'yuan',
                          }))}
                        >
                          <option value="yuan">元</option>
                          <option value="wan">万元</option>
                        </select>
                      </label>
                      <label>
                        小数
                        <select
                          value={wangYueTargetManagementAmountDisplay.decimals}
                          onChange={(event) => setWangYueTargetManagementAmountDisplay((current) => ({
                            ...current,
                            decimals: Number(event.target.value),
                          }))}
                        >
                          {[0, 1, 2, 3, 4].map((decimals) => (
                            <option key={decimals} value={decimals}>{decimals} 位</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
              <>
              <div className="supplementary-dashboard-title-group">
                <div className="dimension-switcher" role="group" aria-label={`${wangYueTargetEntityBoard === 'company' ? '公司' : '品牌'}看板维度筛选`}>
                  {DIMENSIONS.map((dimension) => (
                    <button
                      className={`dimension-switcher-button ${dimension}${wangYueTargetEntityDimensions[wangYueTargetEntityBoard] === dimension ? ' active' : ''}`}
                      key={dimension}
                      type="button"
                      aria-pressed={wangYueTargetEntityDimensions[wangYueTargetEntityBoard] === dimension}
                      onClick={() => setWangYueTargetEntityDimensions((current) => ({
                        ...current,
                        [wangYueTargetEntityBoard]: dimension,
                      }))}
                    >
                      {DIMENSION_NAMES[dimension]}
                    </button>
                  ))}
                </div>
                <h2>{`${DIMENSION_NAMES[wangYueTargetEntityDimensions[wangYueTargetEntityBoard]]} · ${selectedName} · ${wangYueTargetEntityBoard === 'company' ? '公司看板' : '品牌看板'}`}</h2>
              </div>
              <div className="company-dashboard-controls">
              <label className="dashboard-month-filter">
                月份
                <select
                  value={wangYueTargetEntityBoard === 'company'
                    ? wangYueCompanyDashboardMonths[wangYueTargetEntityDimensions.company]
                    : wangYueBrandDashboardMonths[wangYueTargetEntityDimensions.brand]}
                  onChange={(event) => {
                    const monthId = Number(event.target.value) as DashboardMonthId
                    if (!DASHBOARD_MONTH_IDS.includes(monthId)) return
                    if (wangYueTargetEntityBoard === 'company') {
                      const dimension = wangYueTargetEntityDimensions.company
                      setWangYueCompanyDashboardMonths((current) => ({ ...current, [dimension]: monthId }))
                      setWangYueCompanyNameFilters((current) => ({ ...current, [dimension]: '' }))
                    } else {
                      const dimension = wangYueTargetEntityDimensions.brand
                      setWangYueBrandDashboardMonths((current) => ({ ...current, [dimension]: monthId }))
                      setWangYueBrandNameFilters((current) => ({ ...current, [dimension]: '' }))
                    }
                  }}
                >
                  {DASHBOARD_MONTH_IDS.map((monthId) => (
                    <option key={monthId} value={monthId}>{DASHBOARD_FANGPIAN_PERIODS[monthId].label}</option>
                  ))}
                </select>
              </label>
              <div className="customer-dashboard-toolbar">
                <div className="amount-display-controls" aria-label={`${customerCompanyBrandBoardEmployeeName}公司和品牌看板金额显示设置`}>
                  <label>
                    单位
                    <select
                      value={wangYueEntityAmountDisplay.unit}
                      onChange={(event) => setWangYueEntityAmountDisplay((current) => ({
                        ...current,
                        unit: event.target.value === 'wan' ? 'wan' : 'yuan',
                      }))}
                    >
                      <option value="yuan">元</option>
                      <option value="wan">万元</option>
                    </select>
                  </label>
                  <label>
                    小数
                    <select
                      value={wangYueEntityAmountDisplay.decimals}
                      onChange={(event) => setWangYueEntityAmountDisplay((current) => ({
                        ...current,
                        decimals: Number(event.target.value),
                      }))}
                    >
                      {[0, 1, 2, 3, 4].map((decimals) => (
                        <option key={decimals} value={decimals}>{decimals} 位</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="chart-button"
                  onClick={() => setWangYueEntityTrend({
                    employeeName: customerCompanyBrandBoardEmployeeName,
                    board: wangYueTargetEntityBoard,
                    dimension: wangYueTargetEntityDimensions[wangYueTargetEntityBoard],
                    monthId: wangYueTargetEntityBoard === 'company'
                      ? wangYueCompanyDashboardMonths[wangYueTargetEntityDimensions.company]
                      : wangYueBrandDashboardMonths[wangYueTargetEntityDimensions.brand],
                  })}
                >
                  业绩趋势
                </button>
                <details className="column-filter company-column-filter">
                  <summary>筛选维度</summary>
                  <div className="filter-panel">
                    {COMPANY_BOARD_COLUMNS.map((column) => {
                      const dimension = wangYueTargetEntityDimensions[wangYueTargetEntityBoard]
                      const visibleColumns = wangYueTargetEntityBoard === 'company'
                        ? wangYueCompanyVisibleColumns[dimension]
                        : wangYueBrandVisibleColumns[dimension]
                      return (
                        <label key={column.key}>
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(column.key)}
                            onChange={() => {
                              if (wangYueTargetEntityBoard === 'company') {
                                setWangYueCompanyVisibleColumns((current) => {
                                  const nextColumns = new Set(current[dimension])
                                  if (nextColumns.has(column.key)) nextColumns.delete(column.key)
                                  else nextColumns.add(column.key)
                                  return { ...current, [dimension]: nextColumns }
                                })
                              } else {
                                setWangYueBrandVisibleColumns((current) => {
                                  const nextColumns = new Set(current[dimension])
                                  if (nextColumns.has(column.key)) nextColumns.delete(column.key)
                                  else nextColumns.add(column.key)
                                  return { ...current, [dimension]: nextColumns }
                                })
                              }
                            }}
                          />
                          <span className={column.secondaryName ? 'company-column-filter-label' : undefined}>
                            <span>{column.name}</span>
                            {column.secondaryName ? <small>{column.secondaryName}</small> : null}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </details>
              </div>
              </div>
              </>
              )}
            </div>
            {targetSplitBoardActive ? renderTargetSplitBoardContent() : null}
            {isWangYueTargetManagementActive ? (
              (() => {
                const monthId = wangYueTargetManagementMonth
                const timeProgress = getFangpianMonthTimeProgress(monthId)
                const targetManagementPlatforms = WANGYUE_TARGET_MANAGEMENT_PLATFORMS
                const actualKey = getTargetManagementActualKey(selectedName, monthId)
                const snapshotKey = getCompanyBoardCacheKey(selectedName as DashboardCompanyBoardEmployeeName, monthId, 'publish')
                const snapshot = companyBoardData[snapshotKey]
                const snapshotStatus = companyBoardStatuses[snapshotKey] ?? 'loading'
                const companies = snapshot?.companies ?? []
                const actualsStatus = wangYueTargetManagementActualsStatusByMonth[actualKey]
                const actualsResponse = wangYueTargetManagementActualsByMonth[actualKey]
                const actualsByDimensionKey = new Map(actualsResponse?.actuals.map((actual) => [
                  JSON.stringify([actual.companyName, actual.platformId, actual.brandName]),
                  actual.metrics,
                ]) ?? [])
                const emptyMetric = { amount: 0, orderCount: 0 }
                const emptyActualMetrics: DashboardTargetManagementActualsResponse['actuals'][number]['metrics'] = {
                  halfPastTen: emptyMetric,
                  selfIncubated: emptyMetric,
                  signingXiaohongshu: emptyMetric,
                  signingDouyin: emptyMetric,
                  signingShipinhao: emptyMetric,
                  outsourcing: emptyMetric,
                }
                const externalActualsByDimensionKey = new Map<string, { amount: number; orderCount: number }>()
                const externalActualsByCompanyKey = new Map<string, { amount: number; orderCount: number }>()
                const actualsByCompanyPlatformKey = new Map<string, typeof emptyActualMetrics>()
                for (const actual of actualsResponse?.actuals ?? []) {
                  const key = JSON.stringify([actual.companyName, actual.brandName])
                  const current = externalActualsByDimensionKey.get(key) ?? { amount: 0, orderCount: 0 }
                  current.amount += actual.metrics.outsourcing.amount
                  current.orderCount += actual.metrics.outsourcing.orderCount
                  externalActualsByDimensionKey.set(key, current)
                  const companyKey = JSON.stringify([actual.companyName])
                  const companyExternal = externalActualsByCompanyKey.get(companyKey) ?? { amount: 0, orderCount: 0 }
                  companyExternal.amount += actual.metrics.outsourcing.amount
                  companyExternal.orderCount += actual.metrics.outsourcing.orderCount
                  externalActualsByCompanyKey.set(companyKey, companyExternal)
                  const companyPlatformKey = JSON.stringify([actual.companyName, actual.platformId])
                  const platformMetrics = actualsByCompanyPlatformKey.get(companyPlatformKey) ?? {
                    halfPastTen: { ...emptyMetric },
                    selfIncubated: { ...emptyMetric },
                    signingXiaohongshu: { ...emptyMetric },
                    signingDouyin: { ...emptyMetric },
                    signingShipinhao: { ...emptyMetric },
                    outsourcing: { ...emptyMetric },
                  }
                  for (const metricKey of Object.keys(platformMetrics) as Array<keyof typeof emptyActualMetrics>) {
                    platformMetrics[metricKey].amount += actual.metrics[metricKey].amount
                    platformMetrics[metricKey].orderCount += actual.metrics[metricKey].orderCount
                  }
                  actualsByCompanyPlatformKey.set(companyPlatformKey, platformMetrics)
                }
                const tableCountsByDimensionKey = new Map(actualsResponse?.tableCounts.map((item) => [
                  JSON.stringify([item.companyName, item.platformId, item.brandName]),
                  item.count,
                ]) ?? [])
                const getVisibleBrandIndexes = (slotIndex: number, platformId: number) => {
                  const slotKey = `${slotIndex}:${platformId}`
                  const slotCount = wangYueTargetManagementBrandSlotCounts[slotKey] ?? getTargetManagementDefaultBrandSlotCount(platformId)
                  return Array.from({ length: slotCount }, (_, brandIndex) => brandIndex).filter((brandIndex) => {
                    const brandFilterKey = `${slotKey}:${brandIndex}`
                    const companyName = wangYueTargetManagementCompanySlots[slotIndex]?.trim() ?? ''
                    const brandName = wangYueTargetManagementBrandFilters[brandFilterKey] ?? ''
                    const brandGoalKey = brandName
                      ? `${monthId}:${companyName}:${platformId}:${brandName}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                      : `${monthId}:${companyName}:${platformId}:${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                    return platformId === WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID
                      || Boolean(wangYueTargetManagementBrandFilters[brandFilterKey]?.trim())
                      || wangYueTargetManagementBrandOpenRequest?.key === brandFilterKey
                      || wangYueTargetManagementGoals[brandGoalKey]?.importedEmptyProjectRow === 'true'
                  })
                }
                const getVisibleBrandRowCount = (slotIndex: number, platformId: number) =>
                  getVisibleBrandIndexes(slotIndex, platformId).reduce((count, brandIndex) => {
                    const brandFilterKey = `${slotIndex}:${platformId}:${brandIndex}`
                    const brandName = wangYueTargetManagementBrandFilters[brandFilterKey] ?? ''
                    const brandGoalKey = brandName
                      ? `${monthId}:${wangYueTargetManagementCompanySlots[slotIndex]?.trim() ?? ''}:${platformId}:${brandName}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                      : `${monthId}:empty-slot-${slotIndex}:${platformId}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                    return count + 1 + (wangYueTargetManagementProductLines[brandGoalKey]?.length ?? 0)
                  }, 0)
                let nextCompanyRow = 2
                const companyGroups = wangYueTargetManagementCompanySlots.flatMap((companyValue, slotIndex) => {
                  const companyName = companyValue.trim()
                  if (!companyName && activeWangYueTargetManagementCompanySearchSlot !== slotIndex) return []
                  const companyHasSnapshot = companies.some((company) => company.companyName === companyName)
                  const selectedCompanyName = companyName
                  const catalogBrandOptions = wangYueTargetManagementBrandCatalog
                  const brandOptions = [...new Map(catalogBrandOptions.map((brand) => [
                    brand.brandName.toLocaleLowerCase('zh-CN'),
                    { value: brand.brandName, orderCount: 0 },
                  ])).values()]
                  const rowCount = Math.max(1, targetManagementPlatforms
                    .map((platform) => getVisibleBrandRowCount(slotIndex, platform.id))
                    .reduce((total, count) => total + count, 0))
                  const rowStart = nextCompanyRow
                  nextCompanyRow += rowCount
                  return [{
                    slotIndex,
                    companyName,
                    selectedCompanyName,
                    companyHasSnapshot,
                    catalogBrandOptions,
                    brandOptions,
                    brandCatalogStatus: wangYueTargetManagementBrandCatalogStatus,
                    rowStart,
                    rowCount,
                  }]
                })
                const rows: WangYueTargetManagementDisplayRow[] = companyGroups.flatMap((group) => {
                  const groupRows: WangYueTargetManagementDisplayRow[] = targetManagementPlatforms.flatMap((platform): WangYueTargetManagementDisplayRow[] =>
                  getVisibleBrandIndexes(group.slotIndex, platform.id).flatMap((brandIndex): WangYueTargetManagementDisplayRow[] => {
                    const brandFilterKey = `${group.slotIndex}:${platform.id}:${brandIndex}`
                    const brandFilter = wangYueTargetManagementBrandFilters[brandFilterKey] ?? ''
                    const subBrandFilter = wangYueTargetManagementSubBrandFilters[brandFilterKey] ?? ''
                    const normalizedBrandFilter = brandFilter.toLocaleLowerCase('zh-CN')
                    const selectedProjectBrandIds = group.catalogBrandOptions
                      .filter((brand) => brand.brandName.toLocaleLowerCase('zh-CN') === normalizedBrandFilter)
                      .map((brand) => brand.id)
                    const subBrandOptions = [...new Map(group.catalogBrandOptions
                      .filter((brand) => Number(brand.parentId) > 0
                        && (!brandFilter || selectedProjectBrandIds.includes(Number(brand.parentId))))
                      .map((brand) => [
                        brand.brandName.toLocaleLowerCase('zh-CN'),
                        { value: brand.brandName, orderCount: 0 },
                      ])).values()]
                    const brandGoalKey = group.companyName
                      ? `${monthId}:${group.companyName}:${platform.id}:${brandFilter}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                      : `${monthId}:empty-slot-${group.slotIndex}:${platform.id}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                    const isImportedEmptyProject = wangYueTargetManagementGoals[brandGoalKey]?.importedEmptyProjectRow === 'true'
                    const brandRow: WangYueTargetManagementDisplayRow = {
                      ...group,
                      platform,
                      brandIndex,
                      brandFilterKey,
                      brandFilter,
                      subBrandFilter,
                      subBrandOptions,
                      brandHierarchyAvailable: group.catalogBrandOptions.some((brand) => typeof brand.parentId === 'number'),
                      brandName: brandFilter,
                      brandIsKnown: group.brandOptions.some((brand) => brand.value === brandFilter),
                      actualsStatus,
                      actualMetrics: platform.id === WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID
                        ? {
                          ...emptyActualMetrics,
                          outsourcing: externalActualsByCompanyKey.get(JSON.stringify([group.selectedCompanyName])) ?? emptyMetric,
                        }
                        : isImportedEmptyProject
                          ? actualsByCompanyPlatformKey.get(JSON.stringify([group.selectedCompanyName, platform.id])) ?? emptyActualMetrics
                          : actualsByDimensionKey.get(JSON.stringify([group.selectedCompanyName, platform.id, brandFilter])) ?? emptyActualMetrics,
                      rowKey: `${monthId}:target-row-${group.slotIndex}-${platform.id}-${brandIndex}`,
                      isEmptyPlaceholder: false as const,
                      isImportedEmptyProject,
                      isProductLine: false as const,
                      goalKey: brandGoalKey,
                    }
                    const productLineRows: WangYueTargetManagementDisplayRow[] = (wangYueTargetManagementProductLines[brandGoalKey] ?? []).map((productLine, productLineIndex) => ({
                      ...brandRow,
                      brandName: productLine.name || `品线${productLineIndex + 1}`,
                      rowKey: `${brandRow.rowKey}:product-line-${productLine.id}`,
                      goalKey: `${brandGoalKey}:product-line:${productLine.id}`,
                      parentGoalKey: brandGoalKey,
                      isProductLine: true as const,
                      productLineId: productLine.id,
                      productLineName: productLine.name,
                    }))
                    return [brandRow, ...productLineRows]
                  }),
                )
                  if (groupRows.length > 0) return groupRows
                  const emptyPlaceholderRow: WangYueTargetManagementDisplayRow = {
                    ...group,
                    platform: targetManagementPlatforms[0],
                    brandIndex: -1,
                    brandFilterKey: `${group.slotIndex}:empty-brand-placeholder`,
                    brandFilter: '',
                    subBrandFilter: '',
                    subBrandOptions: [],
                    brandHierarchyAvailable: false,
                    brandName: '',
                    brandIsKnown: false,
                    actualsStatus,
                    actualMetrics: emptyActualMetrics,
                    rowKey: `${monthId}:target-row-${group.slotIndex}-empty-brand-placeholder`,
                    isEmptyPlaceholder: true as const,
                    isImportedEmptyProject: false,
                    isProductLine: false as const,
                    goalKey: `${monthId}:empty-company-slot-${group.slotIndex}`,
                  }
                  return [emptyPlaceholderRow]
                })
                const gridTemplateColumns = WANGYUE_TARGET_MANAGEMENT_COLUMNS.map((column) => {
                  if (column.key === 'totalTarget') return 'minmax(74px, .5fr)'
                  if (column.key === 'companyName') return 'minmax(123px, .78fr)'
                  if (column.key === 'platform') return 'minmax(70px, .467fr)'
                  if (column.key === 'projectBrand') return 'minmax(62px, .415fr)'
                  if (column.key === 'brandTotalTarget') return 'minmax(82px, .55fr)'
                  if (column.key === 'contactPerson') return 'minmax(68px, .45fr)'
                  if (column.kind === 'actual' && 'metricKey' in column) return 'minmax(120px, .533fr)'
                  if (column.kind === 'actual') return 'minmax(107px, .533fr)'
                  if (column.kind === 'target') return 'minmax(69px, .445fr)'
                  return 'minmax(103px, .667fr)'
                }).join(' ')
                const getTargetManagementFrozenColumnStyle = (columnIndex: number) => columnIndex < 4
                  ? {
                    position: 'sticky' as const,
                    left: `var(--target-management-frozen-left-${columnIndex}, 0px)`,
                  }
                  : {}
                const totalTargetKey = `${monthId}:total-target`
                const legacyTotalTarget = Object.entries(wangYueTargetManagementGoals).find(([rowKey, goals]) =>
                  rowKey.startsWith(`${monthId}:`) && Boolean(goals.totalTarget),
                )?.[1].totalTarget
                const totalTargetValue = wangYueTargetManagementGoals[totalTargetKey]?.totalTarget ?? legacyTotalTarget ?? ''
                const updateGoal = (rowKey: string, goalKey: WangYueTargetManagementGoalKey, value: string) => {
                  setWangYueTargetManagementGoals((current) => ({
                    ...current,
                    [rowKey]: { ...current[rowKey], [goalKey]: value },
                  }))
                }
                const mergedTargetGroups = new Map<string, {
                  targetKey: (typeof WANGYUE_TARGET_MANAGEMENT_MERGEABLE_TARGET_KEYS)[number]
                  mergeGroup: string
                  startIndex: number
                  rowSpan: number
                  memberRows: WangYueTargetManagementDisplayRow[]
                }>()
                const mergedTargetGroupByRowAndTarget = new Map<string, string>()
                for (const targetKey of WANGYUE_TARGET_MANAGEMENT_MERGEABLE_TARGET_KEYS) {
                  const mergeGoalKey = getTargetManagementMergeGroupGoalKey(targetKey)
                  const memberIndexesByGroup = new Map<string, number[]>()
                  rows.forEach((row, rowIndex) => {
                    if (row.isProductLine || row.isEmptyPlaceholder) return
                    const mergeGroup = wangYueTargetManagementGoals[row.goalKey]?.[mergeGoalKey]
                    if (!mergeGroup) return
                    memberIndexesByGroup.set(mergeGroup, [...(memberIndexesByGroup.get(mergeGroup) ?? []), rowIndex])
                  })
                  for (const [mergeGroup, memberIndexes] of memberIndexesByGroup) {
                    if (memberIndexes.length < 2) continue
                    const firstIndex = Math.min(...memberIndexes)
                    const lastIndex = Math.max(...memberIndexes)
                    const baseRowsInSpan = rows.slice(firstIndex, lastIndex + 1).filter((row) => !row.isProductLine && !row.isEmptyPlaceholder)
                    if (baseRowsInSpan.length !== memberIndexes.length
                      || baseRowsInSpan.some((row) => wangYueTargetManagementGoals[row.goalKey]?.[mergeGoalKey] !== mergeGroup)) continue
                    const groupKey = `${targetKey}:${mergeGroup}`
                    const group = {
                      targetKey,
                      mergeGroup,
                      startIndex: firstIndex,
                      rowSpan: lastIndex - firstIndex + 1,
                      memberRows: memberIndexes.map((index) => rows[index]),
                    }
                    mergedTargetGroups.set(groupKey, group)
                    for (const row of group.memberRows) mergedTargetGroupByRowAndTarget.set(`${row.rowKey}:${targetKey}`, groupKey)
                  }
                }
                const renderMergedTargetGroup = (group: (typeof mergedTargetGroups extends Map<string, infer T> ? T : never)) => {
                  const targetColumnIndex = WANGYUE_TARGET_MANAGEMENT_COLUMNS.findIndex((column) => column.key === group.targetKey)
                  const actualColumnIndex = WANGYUE_TARGET_MANAGEMENT_COLUMNS.findIndex((column) =>
                    column.kind === 'actual' && 'targetKey' in column && column.targetKey === group.targetKey,
                  )
                  const actualColumn = WANGYUE_TARGET_MANAGEMENT_COLUMNS[actualColumnIndex]
                  if (targetColumnIndex < 0 || actualColumnIndex < 0 || !actualColumn || !('metricKey' in actualColumn)) return null
                  const targetOwnerRow = group.memberRows.find((row) =>
                    wangYueTargetManagementGoals[row.goalKey]?.[group.targetKey] !== undefined,
                  ) ?? group.memberRows[0]
                  const targetValue = wangYueTargetManagementGoals[targetOwnerRow.goalKey]?.[group.targetKey] ?? ''
                  const targetIsSet = hasPositiveWangYueTargetManagementGoal(targetValue)
                  const isCountMetric = actualColumn.valueType === 'orderCount'
                  const targetUnit = isCountMetric ? '单' : wangYueTargetManagementAmountDisplay.unit === 'wan' ? '万' : '元'
                  const targetEditorKey = `${targetOwnerRow.goalKey}:${group.targetKey}`
                  const companyNames = [...new Set(group.memberRows.map((row) => row.selectedCompanyName).filter(Boolean))]
                  const isOutsourcingCountGroup = group.targetKey === 'outsourcingOrderCountTarget'
                  const actualsAvailable = targetIsSet && group.memberRows.every((row) =>
                    row.actualsStatus === 'loaded'
                    && Boolean(row.selectedCompanyName)
                    && row.companyHasSnapshot
                    && (isOutsourcingCountGroup || row.brandIsKnown || row.isImportedEmptyProject),
                  )
                  const actualValue = isOutsourcingCountGroup
                    ? companyNames.reduce((sum, companyName) => sum
                      + (externalActualsByCompanyKey.get(JSON.stringify([companyName]))?.orderCount ?? 0), 0)
                    : group.memberRows.reduce((sum, row) => {
                      const metric = row.actualMetrics[actualColumn.metricKey]
                      return sum + (isCountMetric ? metric.orderCount : metric.amount)
                    }, 0)
                  const targetInSnapshotUnits = isCountMetric
                    ? Number(targetValue)
                    : Number(targetValue) * (wangYueTargetManagementAmountDisplay.unit === 'wan' ? 10000 : 1)
                  const completion = actualsAvailable && targetInSnapshotUnits > 0 ? actualValue / targetInSnapshotUnits : null
                  const completionClass = !targetIsSet
                    ? 'is-no-target'
                    : completion === null
                      ? 'is-unavailable'
                      : completion > timeProgress
                        ? 'is-ahead'
                        : completion < timeProgress
                          ? 'is-behind'
                          : 'is-on-track'
                  const actualLabel = !targetIsSet
                    ? ''
                    : actualsAvailable
                      ? isCountMetric ? `${actualValue} 单` : formatAmount(actualValue, wangYueTargetManagementAmountDisplay)
                      : '—'
                  const completionLabel = !targetIsSet ? '' : completion === null ? '—' : formatRate(completion)
                  const mergeRowStyle = (columnIndex: number) => ({
                    gridColumn: columnIndex + 1,
                    gridRow: `${group.startIndex + 2} / span ${group.rowSpan}`,
                  })
                  return (
                    <Fragment key={`${group.targetKey}:${group.mergeGroup}`}>
                      <div className="target-management-merged-row" role="row" style={mergeRowStyle(targetColumnIndex)}>
                        <div className="target-management-cell target-management-goal-cell" role="cell">
                          {editingWangYueTargetManagementMetricGoalKey === targetEditorKey ? (
                            <div className="target-management-goal-input-wrap">
                              <input
                                className="target-management-goal-input"
                                type="number"
                                min="0"
                                step={isCountMetric ? '1' : '0.01'}
                                autoFocus
                                value={targetValue}
                                aria-label={`${companyNames.join('、')} 合并${actualColumn.name}目标（${targetUnit}）`}
                                onChange={(event) => updateGoal(targetOwnerRow.goalKey, group.targetKey, event.target.value)}
                                onBlur={() => setEditingWangYueTargetManagementMetricGoalKey(null)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') event.currentTarget.blur()
                                }}
                              />
                              <span>{targetUnit}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={`target-management-goal-display${targetIsSet ? '' : ' is-empty'}`}
                              title={targetIsSet ? `合并目标 ${targetValue} ${targetUnit}，点击编辑` : '点击设置合并目标'}
                              aria-label={`${companyNames.join('、')} 合并${actualColumn.name}目标${targetIsSet ? `${targetValue}${targetUnit}` : '未设置'}，点击编辑`}
                              onClick={() => setEditingWangYueTargetManagementMetricGoalKey(targetEditorKey)}
                            >
                              {targetIsSet ? <><b>{targetValue}</b><small>{targetUnit}</small></> : '设置目标'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="target-management-merged-row" role="row" style={mergeRowStyle(actualColumnIndex)}>
                        <div className="target-management-cell target-management-actual-completion-cell" role="cell">
                          {actualsAvailable && (actualColumn.metricKey === 'outsourcing' || actualColumn.metricKey === 'signingXiaohongshu' || actualColumn.metricKey === 'signingDouyin' || actualColumn.metricKey === 'signingShipinhao' || actualColumn.metricKey === 'selfIncubated' || actualColumn.metricKey === 'halfPastTen') ? (
                            <button
                              type="button"
                              className="target-management-actual-value target-management-actual-order-link"
                              title={`${actualLabel}，点击查看合并订单明细`}
                              aria-label={`查看${companyNames.join('、')}合并${actualColumn.name}订单明细`}
                              onClick={() => setCompanyOrderModal({
                                monthId,
                                dimension: 'publish',
                                metricKey: actualColumn.metricKey,
                                ...(companyNames.length === 1 ? { companyName: companyNames[0] } : {}),
                                filters: companyNames.length > 1 ? { companyNames } : {},
                                employeeName: selectedName as DashboardCompanyBoardEmployeeName,
                                metricLabel: actualColumn.name,
                                source: 'target',
                              })}
                            >
                              {actualLabel}
                            </button>
                          ) : (
                            <span className="target-management-actual-value" title={actualLabel}>{actualLabel}</span>
                          )}
                          <span className={`target-management-completion-badge ${completionClass}`} title={targetIsSet ? `合并目标完成度；方片月时间进度 ${formatRate(timeProgress)}` : undefined}>
                            {completionLabel}
                          </span>
                        </div>
                      </div>
                    </Fragment>
                  )
                }
                const requestCompanySearch = (slotIndex: number, source: 'deal' | 'catalog') => {
                  setWangYueTargetManagementBrandOpenRequest(null)
                  setActiveWangYueTargetManagementCompanySearchSlot(slotIndex)
                  setWangYueTargetManagementCompanySearch('')
                  setWangYueTargetManagementCompanySearchSource(source)
                  setWangYueTargetManagementCompanyOptions([])
                  setWangYueTargetManagementCompanyOptionsStatus('loading')
                  setWangYueTargetManagementCompanyOpenRequest((current) => ({
                    slotIndex,
                    token: (current?.token ?? 0) + 1,
                    source,
                  }))
                }
                const requestCompanyCatalogSelection = (slotIndex: number) => requestCompanySearch(slotIndex, 'catalog')
                const openTargetManagementBrandSelection = (slotIndex: number, platformId: number) => {
                  const platformSlotKey = `${slotIndex}:${platformId}`
                  const slotCount = wangYueTargetManagementBrandSlotCounts[platformSlotKey] ?? getTargetManagementDefaultBrandSlotCount(platformId)
                  const brandIndex = Array.from({ length: slotCount }, (_, index) => index).find((index) =>
                    !wangYueTargetManagementBrandFilters[`${platformSlotKey}:${index}`]?.trim(),
                  ) ?? slotCount
                  if (brandIndex >= slotCount) {
                    setWangYueTargetManagementBrandSlotCounts((current) => ({
                      ...current,
                      [platformSlotKey]: brandIndex + 1,
                    }))
                  }
                  const brandFilterKey = `${platformSlotKey}:${brandIndex}`
                  setWangYueTargetManagementBrandOpenRequest((current) => ({
                    key: brandFilterKey,
                    token: (current?.token ?? 0) + 1,
                  }))
                }
                const insertCompanySlotAfter = (slotIndex: number) => {
                  const insertAt = slotIndex + 1
                  setWangYueTargetManagementCompanySlots((current) => [
                    ...current.slice(0, insertAt),
                    '',
                    ...current.slice(insertAt),
                  ])
                  setWangYueTargetManagementBrandFilters((current) =>
                    shiftTargetManagementCompanySlotRecord(current, insertAt, 'insert'),
                  )
                  setWangYueTargetManagementSubBrandFilters((current) =>
                    shiftTargetManagementCompanySlotRecord(current, insertAt, 'insert'),
                  )
                  setWangYueTargetManagementBrandSlotCounts((current) =>
                    shiftTargetManagementCompanySlotRecord(current, insertAt, 'insert'),
                  )
                  setWangYueTargetManagementGoals((current) =>
                    shiftTargetManagementEmptySlotGoals(current, insertAt, 'insert'),
                  )
                  requestCompanyCatalogSelection(insertAt)
                }
                const removeCompanySlot = (slotIndex: number) => {
                  setWangYueTargetManagementBrandOpenRequest(null)
                  setWangYueTargetManagementCompanyOpenRequest(null)
                  setActiveWangYueTargetManagementCompanySearchSlot(null)
                  setWangYueTargetManagementCompanySearch('')
                  setWangYueTargetManagementCompanySearchSource('deal')
                  if (wangYueTargetManagementCompanySlots.length <= 1) {
                    setWangYueTargetManagementCompanySlots([''])
                    setWangYueTargetManagementBrandFilters((current) =>
                      shiftTargetManagementCompanySlotRecord(current, slotIndex, 'remove'),
                    )
                    setWangYueTargetManagementSubBrandFilters((current) =>
                      shiftTargetManagementCompanySlotRecord(current, slotIndex, 'remove'),
                    )
                    setWangYueTargetManagementBrandSlotCounts((current) =>
                      shiftTargetManagementCompanySlotRecord(current, slotIndex, 'remove'),
                    )
                    return
                  }
                  setWangYueTargetManagementCompanySlots((current) => current.filter((_, index) => index !== slotIndex))
                  setWangYueTargetManagementBrandFilters((current) =>
                    shiftTargetManagementCompanySlotRecord(current, slotIndex, 'remove'),
                  )
                  setWangYueTargetManagementSubBrandFilters((current) =>
                    shiftTargetManagementCompanySlotRecord(current, slotIndex, 'remove'),
                  )
                  setWangYueTargetManagementBrandSlotCounts((current) =>
                    shiftTargetManagementCompanySlotRecord(current, slotIndex, 'remove'),
                  )
                  setWangYueTargetManagementGoals((current) =>
                    shiftTargetManagementEmptySlotGoals(current, slotIndex, 'remove'),
                  )
                  setActiveWangYueTargetManagementCompanySearchSlot((current) =>
                    current === null || current === slotIndex ? null : current > slotIndex ? current - 1 : current,
                  )
                }
                const removePlatformRows = (group: (typeof companyGroups)[number], platform: (typeof WANGYUE_TARGET_MANAGEMENT_PLATFORMS)[number]) => {
                  const platformSlotKey = `${group.slotIndex}:${platform.id}`
                  const brandFilterPrefix = `${platformSlotKey}:`
                  const goalKeyPrefix = group.companyName
                    ? `${monthId}:${group.companyName}:${platform.id}:`
                    : `${monthId}:empty-slot-${group.slotIndex}:${platform.id}`
                  setWangYueTargetManagementBrandSlotCounts((current) => ({
                    ...current,
                    [platformSlotKey]: 0,
                  }))
                  setWangYueTargetManagementBrandFilters((current) => Object.fromEntries(
                    Object.entries(current).filter(([key]) => !key.startsWith(brandFilterPrefix)),
                  ))
                  setWangYueTargetManagementSubBrandFilters((current) => Object.fromEntries(
                    Object.entries(current).filter(([key]) => !key.startsWith(brandFilterPrefix)),
                  ))
                  setWangYueTargetManagementBrandResetTokens((current) => Object.fromEntries(
                    Object.entries(current).filter(([key]) => !key.startsWith(brandFilterPrefix)),
                  ))
                  setWangYueTargetManagementProductLines((current) => Object.fromEntries(
                    Object.entries(current).filter(([key]) => !key.startsWith(goalKeyPrefix)),
                  ))
                  setWangYueTargetManagementGoals((current) => Object.fromEntries(
                    Object.entries(current).filter(([key]) => !key.startsWith(goalKeyPrefix)),
                  ))
                  setWangYueTargetManagementBrandOpenRequest(null)
                }
                return (
                  <div className="target-management-dashboard-content" role="tabpanel" aria-label={`${selectedName}发布目标管理`}>
                    {wangYueTargetManagementImportNotice ? (
                      <div className="target-management-import-notice" role="status">
                        <span>{wangYueTargetManagementImportNotice}</span>
                        <button type="button" aria-label="关闭导入提示" onClick={() => setWangYueTargetManagementImportNotice('')}>×</button>
                      </div>
                    ) : null}
                    {wangYueTargetManagementImportOpen ? (
                      <div
                        className="chart-modal-backdrop target-management-import-backdrop"
                        role="presentation"
                        onMouseDown={(event) => {
                          if (event.target === event.currentTarget) setWangYueTargetManagementImportOpen(false)
                        }}
                      >
                        <section
                          className="chart-modal target-management-import-modal"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="wangyue-target-import-title"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <div className="modal-head">
                            <div>
                              <h3 id="wangyue-target-import-title">导入{selectedName}目标拆分</h3>
                              <p>粘贴企微表格链接或上传Excel文件，读取并预览后再确认导入。</p>
                            </div>
                            <button type="button" onClick={() => setWangYueTargetManagementImportOpen(false)}>关闭</button>
                          </div>
                          <div className="target-management-import-mode-switch" role="group" aria-label="导入方式">
                            <button
                              type="button"
                              className={wangYueTargetManagementImportMode === 'link' ? 'active' : ''}
                              aria-pressed={wangYueTargetManagementImportMode === 'link'}
                              onClick={() => {
                                setWangYueTargetManagementImportMode('link')
                                setWangYueTargetManagementImportError('')
                                setWangYueTargetManagementImportPreview(null)
                                setWangYueTargetManagementImportChatInput('')
                                setWangYueTargetManagementImportChatMessages([TARGET_MANAGEMENT_IMPORT_WELCOME])
                              }}
                            >
                              链接导入
                            </button>
                            <button
                              type="button"
                              className={wangYueTargetManagementImportMode === 'file' ? 'active' : ''}
                              aria-pressed={wangYueTargetManagementImportMode === 'file'}
                              onClick={() => {
                                setWangYueTargetManagementImportMode('file')
                                setWangYueTargetManagementImportError('')
                                setWangYueTargetManagementImportPreview(null)
                                setWangYueTargetManagementImportChatInput('')
                                setWangYueTargetManagementImportChatMessages([TARGET_MANAGEMENT_IMPORT_WELCOME])
                              }}
                            >
                              上传表格
                            </button>
                          </div>
                          {!isTargetManagementImportConfiguredEmployee(selectedName) ? (
                            <div className="dashboard-data-note">
                              {selectedName}的导入模板尚未配置。其他人员的目标表字段、平台和项目规则不一定与示例对客16相同；请先提供该人员的企微表格链接或文件，确认解析规则后再导入。
                            </div>
                          ) : null}
                          {wangYueTargetManagementImportMode === 'link' ? (
                            <div className="target-management-import-link-row">
                              <input
                                type="url"
                                value={wangYueTargetManagementImportUrl}
                                placeholder="粘贴 doc.weixin.qq.com/sheet/... 链接"
                                aria-label="企微目标表格链接"
                                disabled={!isTargetManagementImportConfiguredEmployee(selectedName)}
                                onChange={(event) => setWangYueTargetManagementImportUrl(event.target.value)}
                              />
                              <button
                                type="button"
                                className="target-management-import-button"
                                disabled={!isTargetManagementImportConfiguredEmployee(selectedName) || wangYueTargetManagementImportLoading || !wangYueTargetManagementImportUrl.trim()}
                                onClick={() => void loadWangYueTargetManagementImportPreview()}
                              >
                                {wangYueTargetManagementImportLoading ? '读取中…' : '读取并预览'}
                              </button>
                            </div>
                          ) : (
                            <div className="target-management-import-file-row">
                              <label className="target-management-import-file-picker">
                                <span>{wangYueTargetManagementImportFile?.name ?? '选择Excel或CSV表格'}</span>
                                <input
                                  type="file"
                                  accept=".xlsx,.xls,.xlsm,.csv"
                                  aria-label="选择Excel或CSV目标表格"
                                  disabled={!isTargetManagementImportConfiguredEmployee(selectedName)}
                                  onChange={(event) => {
                                    setWangYueTargetManagementImportFile(event.target.files?.[0] ?? null)
                                    setWangYueTargetManagementImportError('')
                                    setWangYueTargetManagementImportPreview(null)
                                    setWangYueTargetManagementImportChatInput('')
                                    setWangYueTargetManagementImportChatMessages([TARGET_MANAGEMENT_IMPORT_WELCOME])
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                className="target-management-import-button"
                                disabled={!isTargetManagementImportConfiguredEmployee(selectedName) || wangYueTargetManagementImportLoading || !wangYueTargetManagementImportFile}
                                onClick={() => void loadWangYueTargetManagementImportFilePreview()}
                              >
                                {wangYueTargetManagementImportLoading ? '读取中…' : '读取并预览'}
                              </button>
                            </div>
                          )}
                          <div className="target-management-import-mapping-note">
                            {isTargetManagementImportConfiguredEmployee(selectedName) ? (
                              selectedName === '示例对客13' ? (
                                <>
                                  支持企微表格链接及 .xlsx、.xls、.xlsm、.csv 文件；读取月度目标、天玑目录内公司、平台、“项目”列和对接人，不读取“细分项目”、表格格式或实际业绩。自孵、签约红书、签约抖音、签约视频号、十点半目标按万录入，外采单量按单录入；同一公司、平台、项目下的细分项目目标按各指标加总，平台分开计算；空白目标保留原值。<br />
                                </>
                              ) : (
                                <>
                                支持企微表格链接及 .xlsx、.xls、.xlsm、.csv 文件；自动跳过空白行，导入总目标、公司、平台、“品牌&项目”对应的项目品牌、对接人及品牌业绩目标，不读取或录入细分品牌、表格格式和实际业绩。金额类目标按“万”录入，外采目标按“单”录入；“/”或空白目标不覆盖已有值。品牌按天玑目录匹配；“平安等”映射为“示例品牌”，“理想”映射为“示例品牌”，“新品牌”“未知”跳过；示例对客16看板支持外采平台。<br />
                                同一公司、平台和项目品牌下的各品线目标会按指标加总，平台之间分别计算。
                                </>
                              )) : '完成该人员的表格适配后，这里会显示该人员专属的字段和项目录入说明。'}
                          </div>
                          {wangYueTargetManagementImportLoading ? (
                            <div className="dashboard-data-note" role="status" aria-live="polite">
                              {wangYueTargetManagementImportProgress || '后台正在读取表格…'}
                            </div>
                          ) : null}
                          {wangYueTargetManagementImportError ? (
                            <div className="dashboard-data-note dashboard-data-note-error" role="alert">{wangYueTargetManagementImportError}</div>
                          ) : null}
                          {wangYueTargetManagementImportPreview ? (() => {
                            const preview = wangYueTargetManagementImportPreview
                            const companyCount = new Set(preview.rows.map((row) => row.companyName)).size
                            const contactCount = preview.rows.filter((row) => row.contactPerson?.trim()).length
                            const targetCount = preview.rows.reduce((count, row) => count + Object.keys(row.targets ?? {}).length, 0)
                            const warningRows = preview.rows.filter((row) => row.targetWarnings?.length)
                            const targetPreviewFields = [
                              { key: 'selfIncubatedTarget', name: '自孵化（万）' },
                              { key: 'signingXiaohongshuTarget', name: '签约小红书（万）' },
                              { key: 'signingDouyinTarget', name: '签约抖音（万）' },
                              { key: 'signingShipinhaoTarget', name: '签约视频号（万）' },
                              { key: 'halfPastTenTarget', name: '十点半（万）' },
                            ] as const
                            const targetMergeGroupRows = new Map<string, number[]>()
                            preview.rows.forEach((row, rowIndex) => {
                              for (const [targetKey, mergeGroup] of Object.entries(row.targetMergeGroups ?? {})) {
                                if (!mergeGroup) continue
                                const key = `${targetKey}:${mergeGroup}`
                                targetMergeGroupRows.set(key, [...(targetMergeGroupRows.get(key) ?? []), rowIndex])
                              }
                            })
                            return (
                              <>
                                <div className="target-management-import-summary">
                                  <span>{preview.sourceName} · {preview.sheetTitle}</span>
                                  <span>总目标：<b>{preview.totalTarget} 万</b></span>
                                  <span>可导入：<b>{preview.importableRowCount}</b> 组平台品牌 / {companyCount} 家公司</span>
                                  <span>对接人：<b>{contactCount}</b> 条</span>
                                  <span>业绩目标：<b>{targetCount}</b> 项</span>
                                  {selectedName === '示例对客13' ? <span>金额数值按元÷10000换算为万；合并目标按组只计一次</span> : null}
                                  {warningRows.length ? <span>目标待核对：<b>{warningRows.length}</b> 行</span> : null}
                                  <span>跳过：<b>{preview.skippedRows.length}</b> 行</span>
                                </div>
                                <div className="target-management-import-chat">
                                  <div className="target-management-import-chat-log" role="log" aria-label="导入诉求对话" aria-live="polite">
                                    {wangYueTargetManagementImportChatMessages.map((message, index) => (
                                      <div
                                        className={`target-management-import-chat-message ${message.role}`}
                                        key={`${message.role}:${index}`}
                                      >
                                        <b>{message.role === 'user' ? '你' : '助手'}</b>
                                        <span>{message.content}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <form
                                    className="target-management-import-chat-form"
                                    onSubmit={(event) => {
                                      event.preventDefault()
                                      void reviseWangYueTargetManagementImport()
                                    }}
                                  >
                                    <textarea
                                      value={wangYueTargetManagementImportChatInput}
                                      maxLength={1000}
                                      placeholder="例如：把总目标改成60万；将某公司的对接人改为张三；补充某公司抖音平台的某品牌"
                                      aria-label="输入导入调整诉求"
                                      onChange={(event) => setWangYueTargetManagementImportChatInput(event.target.value)}
                                    />
                                    <button
                                      type="submit"
                                      className="target-management-import-button"
                                      disabled={wangYueTargetManagementImportLoading || !wangYueTargetManagementImportChatInput.trim()}
                                    >
                                      {wangYueTargetManagementImportLoading ? '处理中…' : '按诉求调整预览'}
                                    </button>
                                  </form>
                                  <p>智能调整只更新下方预览；检查无误后，再点击“确认导入”写入看板。</p>
                                </div>
                                <input
                                  className="company-dashboard-horizontal-range target-management-import-horizontal-range"
                                  ref={wangYueTargetManagementImportScrollRangeRef}
                                  type="range"
                                  min={0}
                                  max={wangYueTargetManagementImportScrollMax}
                                  defaultValue={0}
                                  disabled={wangYueTargetManagementImportScrollMax === 0}
                                  aria-label="横向滚动目标导入预览表格"
                                  onChange={(event) => {
                                    if (wangYueTargetManagementImportTableWrapRef.current) {
                                      wangYueTargetManagementImportTableWrapRef.current.scrollLeft = Number(event.target.value)
                                    }
                                  }}
                                />
                                <div
                                  className="target-management-import-preview-wrap"
                                  ref={wangYueTargetManagementImportTableWrapRef}
                                  onScroll={syncWangYueTargetManagementImportTableScroll}
                                >
                                  <table className="target-management-import-preview-table" ref={wangYueTargetManagementImportTableRef}>
                                    <thead>
                                      <tr>
                                        <th>公司</th>
                                        <th>平台</th>
                                        <th>{selectedName === '示例对客13' ? '项目' : '项目品牌'}</th>
                                        <th>对接人</th>
                                        {targetPreviewFields.map((field) => <th key={field.key}>{field.name}</th>)}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {preview.rows.map((row, rowIndex) => (
                                        <tr key={`${row.rowNumber}:${row.companyName}:${row.platformId}:${row.projectBrand}`}>
                                          <td>{row.companyName}</td>
                                          <td>{row.platformName}</td>
                                          <td>{row.projectBrand}</td>
                                          <td>{row.contactPerson || '—'}</td>
                                          {targetPreviewFields.map((field) => {
                                            const mergeGroup = row.targetMergeGroups?.[field.key]
                                            const groupRows = mergeGroup
                                              ? targetMergeGroupRows.get(`${field.key}:${mergeGroup}`) ?? []
                                              : []
                                            if (groupRows.length > 1 && groupRows[0] !== rowIndex) return null
                                            return <td key={field.key} rowSpan={groupRows.length > 1 ? groupRows.length : undefined}>
                                              {row.targets?.[field.key] ?? '—'}
                                            </td>
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {preview.rows.length === 0 ? (
                                  <div className="dashboard-data-note dashboard-data-note-error" role="status">
                                    没有可导入的平台{selectedName === '示例对客13' ? '项目' : '品牌'}；请查看下方跳过原因。总目标不会单独写入。
                                  </div>
                                ) : null}
                                {preview.skippedRows.length > 0 ? (
                                  <details className="target-management-import-skipped">
                                    <summary>查看跳过的 {preview.skippedRows.length} 行</summary>
                                    <div>
                                      {preview.skippedRows.map((row) => (
                                        <p key={`${row.rowNumber}:${row.companyName}:${row.projectBrand}`}>
                                          第{row.rowNumber}行：{row.companyName || '未填写公司'} / {row.platformName || '未填写平台'} / {row.projectBrand || (selectedName === '示例对客13' ? '未填写项目' : '未填写项目品牌')} — {row.reason}
                                        </p>
                                      ))}
                                    </div>
                                  </details>
                                ) : null}
                                {warningRows.length > 0 ? (
                                  <details className="target-management-import-skipped" open>
                                    <summary>需核对目标数值的 {warningRows.length} 行</summary>
                                    <div>
                                      {warningRows.map((row) => (
                                        <p key={`target-warning:${row.rowNumber}:${row.companyName}:${row.projectBrand}`}>
                                          第{row.rowNumber}行：{row.companyName} / {row.platformName} / {row.projectBrand} — {row.targetWarnings.join('；')}
                                        </p>
                                      ))}
                                    </div>
                                  </details>
                                ) : null}
                                <div className="target-management-import-footer">
                                  <span>确认后更新 {DASHBOARD_FANGPIAN_PERIODS[preview.monthId as DashboardMonthId]?.label ?? '对应月份'} 的总目标、公司/平台/{selectedName === '示例对客13' ? '项目' : '品牌'}布局、对接人及目标；同一公司、平台和{selectedName === '示例对客13' ? '项目' : '项目品牌'}下的细分目标已按指标加总，平台之间分别计算；空白目标保留原值，实际业绩不变。</span>
                                  <button type="button" disabled={wangYueTargetManagementImportLoading || preview.rows.length === 0} onClick={() => void applyWangYueTargetManagementImport()}>
                                    {wangYueTargetManagementImportLoading ? '正在导入…' : preview.rows.length === 0 ? '没有可导入内容' : '确认导入'}
                                  </button>
                                </div>
                              </>
                            )
                          })() : null}
                        </section>
                      </div>
                    ) : null}
                    <div className="dashboard-data-note">日常查看读取已保存的发布订单快照；确认导入目标后，会立即刷新该月份快照。手动新增且不在快照中的公司或品牌暂不显示实绩。</div>
                    {snapshotStatus === 'loading' ? <div className="dashboard-data-note">正在读取已保存的发布公司名单…</div> : null}
                    {snapshotStatus === 'error' ? <div className="dashboard-data-note dashboard-data-note-error">发布公司快照暂不可用，无法显示公司名单。</div> : null}
                    {actualsStatus === 'loading' ? <div className="dashboard-data-note">正在读取已保存的订单快照并计算目标完成度…</div> : null}
                    {actualsStatus === 'error' ? <div className="dashboard-data-note dashboard-data-note-error">订单快照暂不可用，无法计算目标完成度。</div> : null}
                    <input
                      className="company-dashboard-horizontal-range target-management-horizontal-range"
                      ref={targetManagementTableRangeRef}
                      type="range"
                      min={0}
                      max={targetManagementTableScrollMax}
                      defaultValue={0}
                      disabled={targetManagementTableScrollMax === 0}
                      aria-label={`横向滚动${selectedName}目标管理表格`}
                      onChange={(event) => {
                        scrollTargetManagementTableTo(Number(event.target.value))
                      }}
                    />
                    <div
                      className="target-management-table-wrap target-management-dashboard-table-wrap"
                      ref={targetManagementTableWrapRef}
                      onScroll={syncTargetManagementTableScroll}
                    >
                      <div
                        className="target-management-table"
                        ref={targetManagementTableContentRef}
                        role="table"
                        aria-label={`${selectedName}发布目标管理维度`}
                        style={{
                          gridTemplateColumns,
                          gridTemplateRows: `minmax(76px, auto) ${rows.length
                            ? rows.map((row) => row.isEmptyPlaceholder ? '52px' : row.isProductLine ? 'minmax(104px, auto)' : 'minmax(136px, auto)').join(' ')
                            : 'minmax(112px, auto)'}`,
                        }}
                      >
                          <div className="target-management-row target-management-header" role="row" style={{ gridTemplateColumns, gridColumn: '1 / -1', gridRow: 1 }}>
                            {WANGYUE_TARGET_MANAGEMENT_COLUMNS.map((column, columnIndex) => (
                              <div className={`target-management-cell${column.key === 'totalTarget' ? ' target-management-total-target-header' : column.key === 'companyName' ? ' target-management-company-name-header' : ''}`} role="columnheader" key={column.key} data-target-management-frozen-column={columnIndex < 4 ? columnIndex : undefined} style={{ gridColumn: columnIndex + 1, gridRow: 1, ...getTargetManagementFrozenColumnStyle(columnIndex) }}>
                                <span>{column.name}</span>
                              </div>
                            ))}
                          </div>
                          {rows.map((row, rowIndex) => (
                            <div className={`target-management-row${rowIndex === rows.length - 1 ? ' target-management-last-row' : ''}${row.platform.id === 1 ? ' is-platform-xiaohongshu' : row.platform.id === 2 ? ' is-platform-douyin' : row.platform.id === 5 ? ' is-platform-shipinhao' : row.platform.id === WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID ? ' is-platform-outsourcing' : ''}`} role="row" key={row.rowKey} style={{ gridTemplateColumns, gridColumn: '1 / -1', gridRow: rowIndex + 2 }}>
                            {WANGYUE_TARGET_MANAGEMENT_COLUMNS.map((column, columnIndex) => {
                              const mergeGroupKey = 'targetKey' in column
                                ? mergedTargetGroupByRowAndTarget.get(`${row.rowKey}:${column.targetKey}`)
                                : undefined
                              if (mergeGroupKey) return null
                                if (column.key === 'totalTarget' || column.key === 'companyName' || column.key === 'platform') return null
                                if (row.isEmptyPlaceholder) {
                                  return (
                                    <div
                                      className="target-management-cell target-management-empty-brand-placeholder"
                                      role="cell"
                                      key={column.key}
                                      data-target-management-frozen-column={columnIndex < 4 ? columnIndex : undefined}
                                      style={{ gridColumn: columnIndex + 1, ...getTargetManagementFrozenColumnStyle(columnIndex) }}
                                    />
                                  )
                                }
                                if (column.key === 'projectBrand') {
                                  if (row.isProductLine) {
                                    const productLineActionsExpanded = expandedWangYueTargetManagementProductLineActions === row.productLineId
                                    const productLineIsEditing = editingWangYueTargetManagementProductLineId === row.productLineId
                                    return (
                                      <div
                                        className="target-management-cell target-management-product-line-cell"
                                        role="cell"
                                        key={column.key}
                                        data-target-management-frozen-column={columnIndex < 4 ? columnIndex : undefined}
                                        style={{ gridColumn: columnIndex + 1, ...getTargetManagementFrozenColumnStyle(columnIndex) }}
                                      >
                                        <div className={`target-management-product-line-actions${productLineActionsExpanded ? ' is-open' : ''}`}>
                                          <button
                                            type="button"
                                            className="target-management-product-line-toggle"
                                            aria-label={productLineActionsExpanded ? '收起品线操作' : '展开品线操作'}
                                            aria-expanded={productLineActionsExpanded}
                                            title={productLineActionsExpanded ? '收起' : '品线操作'}
                                            onClick={() => setExpandedWangYueTargetManagementProductLineActions((current) => current === row.productLineId ? null : row.productLineId ?? null)}
                                          >
                                            <span aria-hidden="true">▾</span>
                                          </button>
                                          {productLineActionsExpanded ? (
                                            <button
                                              type="button"
                                              className="target-management-product-line-delete"
                                              aria-label={`删减${row.productLineName || '品线'}`}
                                              title="删除这条品线"
                                              onClick={() => {
                                                setWangYueTargetManagementProductLines((current) => {
                                                  const next = { ...current }
                                                  const remaining = (next[row.parentGoalKey!] ?? []).filter((productLine) => productLine.id !== row.productLineId)
                                                  if (remaining.length) next[row.parentGoalKey!] = remaining
                                                  else delete next[row.parentGoalKey!]
                                                  return next
                                                })
                                                setWangYueTargetManagementGoals((current) => {
                                                  const next = { ...current }
                                                  delete next[row.goalKey]
                                                  return next
                                                })
                                                setExpandedWangYueTargetManagementProductLineActions(null)
                                              }}
                                            >
                                              删减
                                            </button>
                                          ) : null}
                                        </div>
                                        <span className="target-management-product-line-label">品线</span>
                                        {productLineIsEditing ? (
                                          <input
                                            className="target-management-product-line-name-input"
                                            type="text"
                                            autoFocus
                                            aria-label={`${row.companyName} ${row.platform.name} ${row.brandFilter}品线名称`}
                                            placeholder="输入品线名称"
                                            value={row.productLineName}
                                            onChange={(event) => setWangYueTargetManagementProductLines((current) => ({
                                              ...current,
                                              [row.parentGoalKey]: (current[row.parentGoalKey] ?? []).map((productLine) => productLine.id === row.productLineId
                                                ? { ...productLine, name: event.target.value }
                                                : productLine),
                                            }))}
                                            onBlur={() => setEditingWangYueTargetManagementProductLineId(null)}
                                            onKeyDown={(event) => {
                                              if (event.key === 'Enter' || event.key === 'Escape') {
                                                setEditingWangYueTargetManagementProductLineId(null)
                                              }
                                            }}
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            className={`target-management-product-line-name-display${row.productLineName ? '' : ' is-empty'}`}
                                            title={row.productLineName || '点击输入品线名称'}
                                            onClick={() => setEditingWangYueTargetManagementProductLineId(row.productLineId ?? null)}
                                          >
                                            {row.productLineName || '输入品线名称'}
                                          </button>
                                        )}
                                      </div>
                                    )
                                  }
                                  const brandSlotKey = `${row.slotIndex}:${row.platform.id}`
                                  const brandSlotCount = wangYueTargetManagementBrandSlotCounts[brandSlotKey] ?? getTargetManagementDefaultBrandSlotCount(row.platform.id)
                                  const getBrandRowGoalKey = (brandIndex: number, brandName: string) => row.companyName
                                    ? `${monthId}:${row.companyName}:${row.platform.id}:${brandName}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                                    : `${monthId}:empty-slot-${row.slotIndex}:${row.platform.id}${brandIndex === 0 ? '' : `:brand-${brandIndex + 1}`}`
                                  const deleteBrandRow = () => {
                                    if (brandSlotCount <= 1) return
                                    const getBrandFilterKey = (brandIndex: number) => `${row.slotIndex}:${row.platform.id}:${brandIndex}`
                                    const transfers: Array<{ goalKey: string; values: Partial<Record<WangYueTargetManagementGoalKey, string>> }> = []
                                    const productLineGoalTransfers: Array<{ goalKey: string; values: Partial<Record<WangYueTargetManagementGoalKey, string>> }> = []
                                    for (let brandIndex = row.brandIndex + 1; brandIndex < brandSlotCount; brandIndex += 1) {
                                      const brandName = wangYueTargetManagementBrandFilters[getBrandFilterKey(brandIndex)] ?? ''
                                      const oldGoalKey = getBrandRowGoalKey(brandIndex, brandName)
                                      const newGoalKey = getBrandRowGoalKey(brandIndex - 1, brandName)
                                      const values = wangYueTargetManagementGoals[oldGoalKey]
                                      if (values) transfers.push({ goalKey: newGoalKey, values })
                                      for (const productLine of wangYueTargetManagementProductLines[oldGoalKey] ?? []) {
                                        const productLineGoalKey = `${oldGoalKey}:product-line:${productLine.id}`
                                        const productLineValues = wangYueTargetManagementGoals[productLineGoalKey]
                                        if (productLineValues) {
                                          productLineGoalTransfers.push({
                                            goalKey: `${newGoalKey}:product-line:${productLine.id}`,
                                            values: productLineValues,
                                          })
                                        }
                                      }
                                    }
                                    setWangYueTargetManagementBrandSlotCounts((current) => ({
                                      ...current,
                                      [brandSlotKey]: Math.max(1, (current[brandSlotKey] ?? WANGYUE_TARGET_MANAGEMENT_BRANDS_PER_PLATFORM) - 1),
                                    }))
                                    setWangYueTargetManagementBrandFilters((current) => {
                                      const next = { ...current }
                                      for (let brandIndex = row.brandIndex; brandIndex < brandSlotCount; brandIndex += 1) {
                                        delete next[getBrandFilterKey(brandIndex)]
                                      }
                                      for (let brandIndex = row.brandIndex + 1; brandIndex < brandSlotCount; brandIndex += 1) {
                                        const oldKey = getBrandFilterKey(brandIndex)
                                        const newKey = getBrandFilterKey(brandIndex - 1)
                                        if (current[oldKey] !== undefined) next[newKey] = current[oldKey]
                                      }
                                      return next
                                    })
                                    setWangYueTargetManagementSubBrandFilters((current) => {
                                      const next = { ...current }
                                      for (let brandIndex = row.brandIndex; brandIndex < brandSlotCount; brandIndex += 1) {
                                        delete next[getBrandFilterKey(brandIndex)]
                                      }
                                      for (let brandIndex = row.brandIndex + 1; brandIndex < brandSlotCount; brandIndex += 1) {
                                        const oldKey = getBrandFilterKey(brandIndex)
                                        const newKey = getBrandFilterKey(brandIndex - 1)
                                        if (current[oldKey] !== undefined) next[newKey] = current[oldKey]
                                      }
                                      return next
                                    })
                                    setWangYueTargetManagementProductLines((current) => {
                                      const next = { ...current }
                                      for (let brandIndex = row.brandIndex; brandIndex < brandSlotCount; brandIndex += 1) {
                                        const brandName = wangYueTargetManagementBrandFilters[getBrandFilterKey(brandIndex)] ?? ''
                                        delete next[getBrandRowGoalKey(brandIndex, brandName)]
                                      }
                                      for (let brandIndex = row.brandIndex + 1; brandIndex < brandSlotCount; brandIndex += 1) {
                                        const brandName = wangYueTargetManagementBrandFilters[getBrandFilterKey(brandIndex)] ?? ''
                                        const oldGoalKey = getBrandRowGoalKey(brandIndex, brandName)
                                        const newGoalKey = getBrandRowGoalKey(brandIndex - 1, brandName)
                                        if (current[oldGoalKey] !== undefined) next[newGoalKey] = current[oldGoalKey]
                                      }
                                      return next
                                    })
                                    setWangYueTargetManagementGoals((current) => {
                                      const next = { ...current }
                                      for (let brandIndex = row.brandIndex; brandIndex < brandSlotCount; brandIndex += 1) {
                                        const brandName = wangYueTargetManagementBrandFilters[getBrandFilterKey(brandIndex)] ?? ''
                                        const oldGoalKey = getBrandRowGoalKey(brandIndex, brandName)
                                        delete next[oldGoalKey]
                                        for (const productLine of wangYueTargetManagementProductLines[oldGoalKey] ?? []) {
                                          delete next[`${oldGoalKey}:product-line:${productLine.id}`]
                                        }
                                      }
                                      for (const transfer of transfers) next[transfer.goalKey] = transfer.values
                                      for (const transfer of productLineGoalTransfers) next[transfer.goalKey] = transfer.values
                                      return next
                                    })
                                    setWangYueTargetManagementBrandOpenRequest(null)
                                  }
                                  const addProductLine = () => {
                                    if (!row.brandFilter.trim()) return
                                    const productLine: WangYueTargetManagementProductLine = {
                                      id: `${Date.示例公司有限公司().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                                      name: '',
                                    }
                                    setWangYueTargetManagementProductLines((current) => ({
                                      ...current,
                                      [row.goalKey]: [...(current[row.goalKey] ?? []), productLine],
                                    }))
                                  }
                                  const brandActions = (
                                    <>
                                      <button
                                        type="button"
                                        className="target-management-add-button target-management-reset-brand-row"
                                        aria-label={`重置${row.companyName || '当前公司'}${row.platform.name}第${row.brandIndex + 1}个项目品牌`}
                                        title="重置项目品牌筛选"
                                        onClick={() => {
                                          setWangYueTargetManagementBrandFilters((current) => ({
                                            ...current,
                                            [row.brandFilterKey]: '',
                                          }))
                                          setWangYueTargetManagementSubBrandFilters((current) => ({
                                            ...current,
                                            [row.brandFilterKey]: '',
                                          }))
                                          setWangYueTargetManagementBrandResetTokens((current) => ({
                                            ...current,
                                            [row.brandFilterKey]: (current[row.brandFilterKey] ?? 0) + 1,
                                          }))
                                          setWangYueTargetManagementBrandOpenRequest(null)
                                        }}
                                      >
                                        重置
                                      </button>
                                      <button
                                        type="button"
                                        className="target-management-add-button target-management-add-product-line"
                                        aria-label={`为${row.brandFilter || '项目品牌'}新增品线`}
                                        title={row.brandFilter ? `在${row.brandFilter}下新增品线` : '请先选择项目品牌'}
                                        disabled={!row.brandFilter.trim()}
                                        onClick={addProductLine}
                                      >
                                        新增品线
                                      </button>
                                      <button
                                        type="button"
                                        className="target-management-add-button target-management-delete-brand-row"
                                        aria-label={`删除${row.companyName || '当前公司'}${row.platform.name}第${row.brandIndex + 1}个项目品牌行`}
                                        title={brandSlotCount <= 1 ? '每个平台至少保留一行' : '删除当前项目品牌行'}
                                        disabled={brandSlotCount <= 1}
                                        onClick={deleteBrandRow}
                                      >
                                        删减
                                      </button>
                                    </>
                                  )
                                  return (
                                    <div
                                      className={`target-management-cell target-management-brand-item-cell${row.selectedCompanyName ? ' has-selected-company' : ''}${row.brandFilter ? ' has-selected-brand' : ''}`}
                                      role="cell"
                                      key={column.key}
                                      data-target-management-frozen-column={columnIndex < 4 ? columnIndex : undefined}
                                      style={{ gridColumn: columnIndex + 1, ...getTargetManagementFrozenColumnStyle(columnIndex) }}
                                    >
                                      {!row.selectedCompanyName ? (
                                        <div className="target-management-brand-filter-prompt">
                                          先新增或选择公司
                                        </div>
                                      ) : row.isImportedEmptyProject ? (
                                        <div className="target-management-brand-item-name target-management-brand-selected-name" title="原表未指定项目，目标按公司和平台保留">
                                          未指定项目
                                        </div>
                                      ) : (
                                        <NameAutocompleteFilter
                                          ariaLabel={`${row.companyName} ${row.platform.name}第${row.brandIndex + 1}个项目品牌筛选`}
                                          placeholder={`品牌${row.brandIndex + 1}`}
                                          value={row.brandFilter}
                                          options={row.brandOptions.map((brand) => ({ name: brand.value, count: 0 }))}
                                          hideZeroCount
                                          hideInputWhenSelected
                                          collapseOnAnyValue
                                          selectionOnly
                                          clearSearchOnFocus
                                          dropdownActions={brandActions}
                                          openToken={wangYueTargetManagementBrandOpenRequest?.key === row.brandFilterKey
                                            ? wangYueTargetManagementBrandOpenRequest.token
                                            : undefined}
                                          emptyMessage={row.brandCatalogStatus === 'idle' || row.brandCatalogStatus === 'loading'
                                            ? '正在读取品牌快照…'
                                            : row.brandCatalogStatus === 'error'
                                              ? '读取品牌快照失败，请稍后重试'
                                              : row.brandCatalogStatus === 'empty'
                                                ? '品牌快照尚未生成，请运行后台刷新任务'
                                                : '品牌快照中没有可选品牌'}
                                          resetToken={wangYueTargetManagementBrandResetTokens[row.brandFilterKey] ?? 0}
                                          onChange={(value) => {
                                            setWangYueTargetManagementBrandFilters((current) => ({
                                              ...current,
                                              [row.brandFilterKey]: value,
                                            }))
                                            setWangYueTargetManagementSubBrandFilters((current) => ({
                                              ...current,
                                              [row.brandFilterKey]: '',
                                            }))
                                            setWangYueTargetManagementBrandOpenRequest(null)
                                          }}
                                          onClose={() => {
                                            if (wangYueTargetManagementBrandOpenRequest?.key === row.brandFilterKey) {
                                              setWangYueTargetManagementBrandOpenRequest(null)
                                            }
                                          }}
                                        />
                                      )}
                                      {row.brandFilter ? (
                                        <div className="target-management-brand-item-name target-management-brand-selected-name">
                                          {row.brandFilter}
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                }
                                if (column.key === 'contactPerson') {
                                  const contactPerson = wangYueTargetManagementGoals[row.goalKey]?.contactPerson ?? ''
                                  const contactPersonNames = contactPerson.split(/[\n,，、;；]+/).map((name) => name.trim()).filter(Boolean)
                                  const formattedContactPerson = contactPersonNames.join('、') || contactPerson.trim()
                                  const contactActionsExpanded = expandedWangYueTargetManagementContactActions === row.goalKey
                                  const contactIsEditing = editingWangYueTargetManagementContactGoalKey === row.goalKey
                                  const contactPersonFontSize = contactPerson
                                    ? Math.max(
                                      10,
                                      Math.min(16, 16 - Math.max(0, Array.from(formattedContactPerson).length - 5) * 0.3 - Math.max(0, contactPersonNames.length - 1) * 1.2),
                                    )
                                    : 12
                                  return (
                                    <div className="target-management-cell target-management-brand-item-cell target-management-contact-person-cell" role="cell" key={column.key} style={{ gridColumn: columnIndex + 1 }}>
                                      <div className={`target-management-contact-person-actions${contactActionsExpanded ? ' is-open' : ''}`}>
                                        <button
                                          type="button"
                                          className="target-management-product-line-toggle"
                                          aria-label={contactActionsExpanded ? '收起对接人操作' : '展开对接人操作'}
                                          aria-expanded={contactActionsExpanded}
                                          title={contactActionsExpanded ? '收起' : '对接人操作'}
                                          onClick={() => setExpandedWangYueTargetManagementContactActions((current) => current === row.goalKey ? null : row.goalKey)}
                                        >
                                          <span aria-hidden="true">▾</span>
                                        </button>
                                        {contactActionsExpanded ? (
                                          <button
                                            type="button"
                                            className="target-management-contact-person-reset"
                                            aria-label="重置对接人"
                                            title="清空对接人"
                                            onClick={() => {
                                              updateGoal(row.goalKey, column.key, '')
                                              setExpandedWangYueTargetManagementContactActions(null)
                                            }}
                                          >
                                            重置
                                          </button>
                                        ) : null}
                                      </div>
                                      {contactIsEditing ? (
                                        <input
                                          className="target-management-product-line-name-input target-management-contact-person-input"
                                          type="text"
                                          autoFocus
                                          aria-label={`${row.companyName} ${row.platform.name} ${row.brandName} 对接人`}
                                          placeholder="手动输入对接人"
                                          value={contactPerson}
                                          onChange={(event) => updateGoal(row.goalKey, column.key, event.target.value)}
                                          onBlur={() => setEditingWangYueTargetManagementContactGoalKey(null)}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === 'Escape') {
                                              setEditingWangYueTargetManagementContactGoalKey(null)
                                            }
                                          }}
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          className={`target-management-contact-person-display${contactPerson ? '' : ' is-empty'}`}
                                          title={contactPerson || '点击输入对接人'}
                                          aria-label={contactPerson || '点击输入对接人'}
                                          style={{ fontSize: `${contactPersonFontSize}px` }}
                                          onClick={() => setEditingWangYueTargetManagementContactGoalKey(row.goalKey)}
                                        >
                                          {formattedContactPerson || '输入对接人'}
                                        </button>
                                      )}
                                    </div>
                                  )
                                }
                                if (column.key === 'brandTotalTarget') {
                                  const targetTotal = Number(WANGYUE_TARGET_MANAGEMENT_SUM_TARGET_KEYS.reduce((sum, targetKey) => {
                                    const target = Number(wangYueTargetManagementGoals[row.goalKey]?.[targetKey] ?? '')
                                    return sum + (Number.isFinite(target) && target > 0 ? target : 0)
                                  }, 0).toFixed(2))
                                  const unit = wangYueTargetManagementAmountDisplay.unit === 'wan' ? '万' : '元'
                                  const targetLabel = targetTotal > 0 ? `${targetTotal} ${unit}` : '—'
                                  const manualUnitMultiplier = wangYueTargetManagementAmountDisplay.unit === 'wan' ? 10000 : 1
                                  const projectPublishAmount = row.isProductLine
                                    ? WANGYUE_TARGET_MANAGEMENT_SUM_TARGET_KEYS.reduce((sum, targetKey) => sum + (Number(wangYueTargetManagementGoals[row.goalKey]?.[`${targetKey.slice(0, -6)}Actual` as WangYueTargetManagementGoalKey]) || 0), 0) * manualUnitMultiplier
                                    : row.actualMetrics.halfPastTen.amount
                                      + row.actualMetrics.selfIncubated.amount
                                      + row.actualMetrics.signingXiaohongshu.amount
                                      + row.actualMetrics.signingDouyin.amount
                                      + row.actualMetrics.signingShipinhao.amount
                                  const projectPublishAvailable = row.isProductLine
                                    ? WANGYUE_TARGET_MANAGEMENT_SUM_TARGET_KEYS.some((targetKey) => Boolean(wangYueTargetManagementGoals[row.goalKey]?.[`${targetKey.slice(0, -6)}Actual` as WangYueTargetManagementGoalKey]?.trim()))
                                    : row.actualsStatus === 'loaded' && row.companyHasSnapshot && (row.brandIsKnown || row.isImportedEmptyProject)
                                  const projectTargetSnapshotAmount = targetTotal * manualUnitMultiplier
                                  const projectPublishCompletion = projectPublishAvailable && projectTargetSnapshotAmount > 0 ? projectPublishAmount / projectTargetSnapshotAmount : null
                                  const projectCompletionClass = targetTotal <= 0 ? 'is-no-target' : projectPublishCompletion === null ? 'is-unavailable' : projectPublishCompletion > timeProgress ? 'is-ahead' : projectPublishCompletion < timeProgress ? 'is-behind' : 'is-on-track'
                                  return (
                                    <div className="target-management-cell target-management-brand-total-target-cell" role="cell" key={column.key} style={{ gridColumn: columnIndex + 1 }}>
                                      <span className="target-management-brand-total-target-value" title={`后续金额目标合计（不含外采单数目标）：${targetLabel}`}>
                                        {targetTotal > 0 ? <><b>{targetTotal}</b><small>{unit}</small></> : '—'}
                                      </span>
                                      <div className="target-management-publish-summary">
                                        <span title={projectPublishAvailable ? `发布业绩：${formatAmount(projectPublishAmount, wangYueTargetManagementAmountDisplay)}` : '发布业绩暂不可用'}><small>发布</small>{projectPublishAvailable ? formatAmount(projectPublishAmount, wangYueTargetManagementAmountDisplay) : '—'}</span>
                                        <strong className={`target-management-publish-completion ${projectCompletionClass}`} title={`目标完成度；方片月时间进度 ${formatRate(timeProgress)}`}>
                                          完成 {projectPublishCompletion === null ? '—' : formatRate(projectPublishCompletion)}
                                        </strong>
                                      </div>
                                    </div>
                                  )
                                }
                                if (column.kind === 'target') {
                                  const targetValue = wangYueTargetManagementGoals[row.goalKey]?.[column.targetKey] ?? ''
                                  const targetIsSet = hasPositiveWangYueTargetManagementGoal(targetValue)
                                  const targetUnit = column.targetKey === 'outsourcingOrderCountTarget'
                                    ? '单'
                                    : wangYueTargetManagementAmountDisplay.unit === 'wan' ? '万' : '元'
                                  const targetEditorKey = `${row.goalKey}:${column.targetKey}`
                                  return (
                                    <div className="target-management-cell target-management-goal-cell" role="cell" key={column.key} style={{ gridColumn: columnIndex + 1 }}>
                                      {editingWangYueTargetManagementMetricGoalKey === targetEditorKey ? (
                                        <div className="target-management-goal-input-wrap">
                                        <input
                                          className="target-management-goal-input"
                                          type="number"
                                          min="0"
                                          step={targetUnit === '单' ? '1' : '0.01'}
                                          autoFocus
                                          value={targetValue}
                                          aria-label={`${row.companyName} ${row.platform.name} ${row.brandName} ${column.name}（${targetUnit}）`}
                                          onChange={(event) => updateGoal(row.goalKey, column.targetKey, event.target.value)}
                                          onBlur={() => setEditingWangYueTargetManagementMetricGoalKey(null)}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter') event.currentTarget.blur()
                                          }}
                                        />
                                        <span>{targetUnit}</span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className={`target-management-goal-display${targetIsSet ? '' : ' is-empty'}`}
                                          title={targetIsSet ? `${targetValue} ${targetUnit}，点击编辑` : '点击设置目标'}
                                          aria-label={`${row.companyName} ${row.platform.name} ${row.brandName} ${column.name}${targetIsSet ? `${targetValue}${targetUnit}` : '未设置'}，点击编辑`}
                                          onClick={() => setEditingWangYueTargetManagementMetricGoalKey(targetEditorKey)}
                                        >
                                          {targetIsSet ? <><b>{targetValue}</b><small>{targetUnit}</small></> : '设置目标'}
                                        </button>
                                      )}
                                    </div>
                                  )
                                }
                                if (column.key === 'tableCount') {
                                  if (row.isProductLine) {
                                    const tableCount = wangYueTargetManagementGoals[row.goalKey]?.tableCount ?? ''
                                    return (
                                      <div className="target-management-cell target-management-table-count-cell target-management-product-line-table-count" role="cell" key={column.key} style={{ gridColumn: columnIndex + 1 }}>
                                        <input
                                          className="target-management-product-line-manual-actual"
                                          type="number"
                                          min="0"
                                          step="1"
                                          aria-label={`${row.companyName} ${row.platform.name} ${row.brandFilter} ${row.productLineName || '品线'}做表数量（份）`}
                                          value={tableCount}
                                          onChange={(event) => updateGoal(row.goalKey, 'tableCount', event.target.value)}
                                        />
                                        <span>份</span>
                                      </div>
                                    )
                                  }
                                  const tableCountAvailable = row.actualsStatus === 'loaded'
                                    && Boolean(row.selectedCompanyName)
                                    && row.platform.id !== WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID
                                    && row.brandIsKnown
                                    && Boolean(actualsResponse?.tableCountSnapshotUpdatedAt)
                                  const tableCountKey = JSON.stringify([row.selectedCompanyName, row.platform.id, row.brandName])
                                  const tableCount = tableCountsByDimensionKey.get(tableCountKey) ?? 0
                                  const tableCountLabel = tableCountAvailable ? `${tableCount} 份` : '—'
                                  return (
                                    <div className="target-management-cell target-management-table-count-cell" role="cell" key={column.key} style={{ gridColumn: columnIndex + 1 }}>
                                      {tableCountAvailable ? (
                                        <button
                                          type="button"
                                          className="target-management-actual-value target-management-table-count-link"
                                          title={`${tableCountLabel}，点击查看提报明细`}
                                          aria-label={`${row.selectedCompanyName} ${row.platform.name} ${row.brandName} ${tableCountLabel}，查看提报明细`}
                                          onClick={() => setTargetManagementSubmissionDetailsContext({
                                            monthId,
                                            employeeName: '示例对客16',
                                            companyName: row.selectedCompanyName,
                                            platformName: row.platform.name,
                                            brandName: row.brandName,
                                            count: tableCount,
                                          })}
                                        >
                                          {tableCountLabel}
                                        </button>
                                      ) : (
                                        <span className="target-management-actual-value" title={tableCountLabel}>{tableCountLabel}</span>
                                      )}
                                    </div>
                                  )
                                }
                                if (column.kind === 'actual' && 'metricKey' in column && 'targetKey' in column) {
                                  const isManualProductLineActual = row.isProductLine
                                  const manualActualKey = column.key as WangYueTargetManagementGoalKey
                                  const manualActualValue = isManualProductLineActual
                                    ? wangYueTargetManagementGoals[row.goalKey]?.[manualActualKey] ?? ''
                                    : ''
                                  const targetInputValue = wangYueTargetManagementGoals[row.goalKey]?.[column.targetKey] ?? ''
                                  const hasTarget = hasPositiveWangYueTargetManagementGoal(targetInputValue)
                                  const isOutsourcingPerformance = column.metricKey === 'outsourcing'
                                  const actualsAvailable = isManualProductLineActual
                                    ? manualActualValue.trim() !== ''
                                    : (hasTarget || isOutsourcingPerformance)
                                    && row.actualsStatus === 'loaded'
                                    && Boolean(row.selectedCompanyName)
                                    && row.companyHasSnapshot
                                    && (isOutsourcingPerformance || row.brandIsKnown || row.isImportedEmptyProject)
                                  const metricActual = row.actualMetrics?.[column.metricKey]
                                  const isCountMetric = column.valueType === 'orderCount'
                                  const canOpenOrderDetails = !isManualProductLineActual
                                    && actualsAvailable
                                    && hasTarget
                                    && Boolean(row.selectedCompanyName)
                                    && row.companyHasSnapshot
                                    && (row.brandIsKnown || row.isImportedEmptyProject)
                                    && (metricActual?.orderCount ?? 0) > 0
                                  const manualUnitMultiplier = isCountMetric || wangYueTargetManagementAmountDisplay.unit !== 'wan' ? 1 : 10000
                                  const actualValue = isManualProductLineActual
                                    ? (Number(manualActualValue) || 0) * manualUnitMultiplier
                                    : isCountMetric
                                      ? metricActual?.orderCount ?? 0
                                      : metricActual?.amount ?? 0
                                  const targetValue = Number(targetInputValue)
                                  const targetInSnapshotUnits = isCountMetric
                                    ? targetValue
                                    : targetValue * (wangYueTargetManagementAmountDisplay.unit === 'wan' ? 10000 : 1)
                                  const completion = actualsAvailable && targetInSnapshotUnits > 0
                                    ? actualValue / targetInSnapshotUnits
                                    : null
                                  const completionClass = !hasTarget
                                    ? 'is-no-target'
                                    : completion === null
                                    ? 'is-unavailable'
                                    : completion > timeProgress
                                      ? 'is-ahead'
                                      : completion < timeProgress
                                        ? 'is-behind'
                                        : 'is-on-track'
                                  const actualLabel = !hasTarget && !isOutsourcingPerformance
                                    ? ''
                                    : actualsAvailable
                                    ? isManualProductLineActual
                                      ? `${manualActualValue}${isCountMetric ? ' 单' : wangYueTargetManagementAmountDisplay.unit === 'wan' ? ' 万' : ' 元'}`
                                      : column.valueType === 'orderCount'
                                      ? `${actualValue} 单`
                                      : formatAmount(actualValue, wangYueTargetManagementAmountDisplay)
                                    : isManualProductLineActual ? '' : '—'
                                  const completionLabel = !hasTarget
                                    ? ''
                                    : completion === null ? '—' : formatRate(completion)
                                  return (
                                    <div className="target-management-cell target-management-actual-completion-cell" role="cell" key={column.key} style={{ gridColumn: columnIndex + 1 }}>
                                      {isManualProductLineActual && hasTarget ? (
                                        <input
                                          className="target-management-product-line-manual-actual"
                                          type="number"
                                          min="0"
                                          step={isCountMetric ? '1' : '0.01'}
                                          aria-label={`${row.companyName} ${row.platform.name} ${row.brandFilter} ${row.productLineName || '品线'}${column.name}（${isCountMetric ? '单' : wangYueTargetManagementAmountDisplay.unit === 'wan' ? '万' : '元'}）`}
                                          title={actualLabel === '—' ? '手动录入品线实绩' : `手动实绩 ${actualLabel}`}
                                          value={manualActualValue}
                                          onChange={(event) => updateGoal(row.goalKey, manualActualKey, event.target.value)}
                                        />
                                      ) : (
                                        canOpenOrderDetails ? (
                                          <button
                                            type="button"
                                            className="target-management-actual-value target-management-actual-order-link"
                                            title={`${actualLabel}，点击查看订单明细`}
                                            aria-label={`查看${row.companyName} ${row.platform.name} ${row.brandFilter} ${column.name}订单明细`}
                                            onClick={() => openWangYueTargetManagementOrderDetails(
                                              monthId,
                                              row,
                                              column.metricKey,
                                              column.name,
                                            )}
                                          >
                                            {actualLabel}
                                          </button>
                                        ) : (
                                          <span className="target-management-actual-value" title={actualLabel}>{actualLabel}</span>
                                        )
                                      )}
                                      <span className={`target-management-completion-badge ${completionClass}`} title={hasTarget ? `目标完成度；方片月时间进度 ${formatRate(timeProgress)}` : undefined}>
                                        {completionLabel}
                                      </span>
                                    </div>
                                  )
                                }
                                return (
                                <div className="target-management-cell" role="cell" key={column.key} style={{ gridColumn: columnIndex + 1 }}>
                                  —
                                </div>
                                )
                              })}
                            </div>
                          ))}
                          {[...mergedTargetGroups.values()].map(renderMergedTargetGroup)}
                          <div className="target-management-merged-row" role="row" data-target-management-frozen-column="0" style={{ gridColumn: 1, gridRow: `2 / span ${Math.max(rows.length, 1)}`, ...getTargetManagementFrozenColumnStyle(0) }}>
                            <div className="target-management-cell target-management-total-target-cell target-management-total-target-column-cell target-management-green-column-cell" role="cell">
                              <TargetManagementTotalGoalCell
                                value={totalTargetValue}
                                unit={wangYueTargetManagementAmountDisplay.unit}
                                ariaLabel={`${monthId} 总目标`}
                                onChange={(value) => updateGoal(totalTargetKey, 'totalTarget', value)}
                                onAddCompany={() => insertCompanySlotAfter(wangYueTargetManagementCompanySlots.length - 1)}
                              />
                            </div>
                          </div>
                          {companyGroups.map((group) => {
                            const companyTargetAmount = Number(rows
                              .filter((row) => row.slotIndex === group.slotIndex && !row.isProductLine && !row.isEmptyPlaceholder)
                              .reduce((sum, row) => sum + WANGYUE_TARGET_MANAGEMENT_SUM_TARGET_KEYS.reduce((goalSum, targetKey) => goalSum + (Number(wangYueTargetManagementGoals[row.goalKey]?.[targetKey]) || 0), 0), 0)
                              .toFixed(2))
                            const companyPublishSnapshot = companies.find((company) => company.companyName === group.companyName)
                            const companyPublishAmount = companyPublishSnapshot
                              ? companyPublishSnapshot.halfPastTen.amount
                                + companyPublishSnapshot.selfIncubated.amount
                                + companyPublishSnapshot.signingXiaohongshu.amount
                                + companyPublishSnapshot.signingDouyin.amount
                                + companyPublishSnapshot.signingShipinhao.amount
                                + companyPublishSnapshot.outsourcing.amount
                              : 0
                            const companyPublishAvailable = snapshotStatus === 'loaded'
                            const companyTargetSnapshotAmount = companyTargetAmount * (wangYueTargetManagementAmountDisplay.unit === 'wan' ? 10000 : 1)
                            const companyPublishCompletion = companyPublishAvailable && companyTargetSnapshotAmount > 0 ? companyPublishAmount / companyTargetSnapshotAmount : null
                            const companyCompletionClass = companyTargetAmount <= 0 ? 'is-no-target' : companyPublishCompletion === null ? 'is-unavailable' : companyPublishCompletion > timeProgress ? 'is-ahead' : companyPublishCompletion < timeProgress ? 'is-behind' : 'is-on-track'
                            const normalizedCompanySearch = wangYueTargetManagementCompanySearch.trim().toLocaleLowerCase('zh-CN')
                            const isCompanyCatalogSearch = wangYueTargetManagementCompanySearchSource === 'catalog'
                              && activeWangYueTargetManagementCompanySearchSlot === group.slotIndex
                            const existingPlatformIds = group.companyName
                              ? targetManagementPlatforms.filter((platform) =>
                                getVisibleBrandIndexes(group.slotIndex, platform.id).length > 0,
                              ).map((platform) => platform.id)
                              : targetManagementPlatforms.map((platform) => platform.id)
                            const companyOptions = (activeWangYueTargetManagementCompanySearchSlot === group.slotIndex
                              ? wangYueTargetManagementCompanyOptions
                              : [])
                              .filter((company) => !normalizedCompanySearch
                                || company.companyName.toLocaleLowerCase('zh-CN').includes(normalizedCompanySearch))
                              .filter((company) => !companyGroups.some((other) =>
                                other.slotIndex !== group.slotIndex && other.companyName === company.companyName,
                              ))
                              .map((company) => ({
                                name: company.companyName,
                                count: isCompanyCatalogSearch
                                  ? 0
                                  : company.orderCount
                                    ?? companies.find((snapshotCompany) => snapshotCompany.companyName === company.companyName)?.totalOrderCount
                                    ?? 0,
                              }))
                              .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
                            const companySearchEmptyMessage = activeWangYueTargetManagementCompanySearchSlot !== group.slotIndex
                              ? '点击搜索框查看成单公司'
                              : wangYueTargetManagementCompanyOptionsStatus === 'loading'
                                ? wangYueTargetManagementCompanySearchSource === 'catalog'
                                  ? wangYueTargetManagementCompanySearch
                                    ? '正在搜索天玑公司目录…'
                                    : '正在读取天玑系统全部公司…'
                              : `正在读取近${wangYueTargetManagementCompanyLookbackMonths}个月${selectedName}成单公司快照…`
                                : wangYueTargetManagementCompanyOptionsStatus === 'error'
                                  ? wangYueTargetManagementCompanySearchSource === 'catalog'
                                    ? '天玑公司目录快照尚未生成或读取失败，请等待后台刷新任务完成'
                                    : `${selectedName}成单公司快照读取失败`
                                  : !wangYueTargetManagementCompanySearch.trim()
                                    ? wangYueTargetManagementCompanySearchSource === 'catalog'
                                      ? '天玑公司目录中暂无可选公司'
                                      : '没有匹配的成单公司'
                                : wangYueTargetManagementCompanySearchSource === 'catalog'
                                      ? '天玑目录中没有匹配的公司'
                                      : `近${wangYueTargetManagementCompanyLookbackMonths}个月${selectedName}成单公司中没有匹配项`
                            const resetCompanySelection = () => {
                              setWangYueTargetManagementBrandOpenRequest(null)
                              setWangYueTargetManagementCompanyOpenRequest(null)
                              setWangYueTargetManagementCompanySlots((current) => current.map((name, index) =>
                                index === group.slotIndex ? '' : name,
                              ))
                              setActiveWangYueTargetManagementCompanySearchSlot(null)
                              setWangYueTargetManagementCompanySearch('')
                              setWangYueTargetManagementCompanySearchSource('deal')
                              setWangYueTargetManagementBrandFilters((current) => Object.fromEntries(
                                Object.entries(current).filter(([key]) => !key.startsWith(`${group.slotIndex}:`)),
                              ))
                              setWangYueTargetManagementSubBrandFilters((current) => Object.fromEntries(
                                Object.entries(current).filter(([key]) => !key.startsWith(`${group.slotIndex}:`)),
                              ))
                            }
                            return (
                              <Fragment key={`company-group-${group.slotIndex}`}>
                                <div
                                  className="target-management-merged-row"
                                  role="row"
                                  data-target-management-frozen-column="1"
                                  data-target-management-company-group
                                  style={{ gridColumn: 2, gridRow: `${group.rowStart} / span ${group.rowCount}`, ...getTargetManagementFrozenColumnStyle(1) }}
                                >
                                  <div className="target-management-cell target-management-total-target-cell target-management-company-filter-cell target-management-green-column-cell" role="cell">
                                    <NameAutocompleteFilter
                                      ariaLabel={`第${group.slotIndex + 1}个公司筛选`}
                                      placeholder="搜索或选择公司名称"
                                      value={wangYueTargetManagementCompanySlots[group.slotIndex]}
                                      options={companyOptions}
                                      hideZeroCount={isCompanyCatalogSearch}
                                      hideInputWhenSelected
                                      collapseOnAnyValue
                                      selectionOnly
                                      showResetButton={false}
                                      openToken={wangYueTargetManagementCompanyOpenRequest?.slotIndex === group.slotIndex
                                        ? wangYueTargetManagementCompanyOpenRequest.token
                                        : undefined}
                                      emptyMessage={companySearchEmptyMessage}
                                      clearSearchOnFocus
                                      rightAccessory={(
                                        <select
                                          className="target-management-company-lookback-filter"
                                          aria-label="公司候选成单时间范围"
                                          value={wangYueTargetManagementCompanyLookbackMonths}
                                          disabled={activeWangYueTargetManagementCompanySearchSlot === group.slotIndex && wangYueTargetManagementCompanySearchSource === 'catalog'}
                                          onChange={(event) => setWangYueTargetManagementCompanyLookbackMonths(Number(event.target.value))}
                                        >
                                          <option value={3}>近三个月</option>
                                          <option value={2}>近两个月</option>
                                          <option value={1}>近一个月</option>
                                        </select>
                                      )}
                                      onSearchTermChange={(keyword) => {
                                        const searchSource = wangYueTargetManagementCompanyOpenRequest?.slotIndex === group.slotIndex
                                          ? wangYueTargetManagementCompanyOpenRequest.source
                                          : 'deal'
                                        const sourceChanged = searchSource !== wangYueTargetManagementCompanySearchSource
                                        if (sourceChanged) {
                                          setWangYueTargetManagementCompanySearchSource(searchSource)
                                        }
                                        setActiveWangYueTargetManagementCompanySearchSlot(group.slotIndex)
                                        setWangYueTargetManagementCompanySearch(keyword)
                                        if (searchSource === 'catalog') {
                                          setWangYueTargetManagementCompanyOptions([])
                                          setWangYueTargetManagementCompanyOptionsStatus(keyword.trim() ? 'loading' : 'idle')
                                        } else {
                                          if (sourceChanged) setWangYueTargetManagementCompanyOptions([])
                                          if (sourceChanged || wangYueTargetManagementCompanyOptions.length === 0) {
                                            setWangYueTargetManagementCompanyOptionsStatus('loading')
                                          }
                                        }
                                      }}
                                      onClose={() => {
                                        if (wangYueTargetManagementCompanyOpenRequest?.slotIndex === group.slotIndex) {
                                          setWangYueTargetManagementCompanyOpenRequest(null)
                                        }
                                        setActiveWangYueTargetManagementCompanySearchSlot(null)
                                        setWangYueTargetManagementCompanySearch('')
                                        setWangYueTargetManagementCompanySearchSource('deal')
                                        setWangYueTargetManagementCompanyOptions([])
                                        setWangYueTargetManagementCompanyOptionsStatus('idle')
                                      }}
                                      onReset={resetCompanySelection}
                                      onChange={(value) => {
                                        if (value.trim() && companyGroups.some((other) => other.slotIndex !== group.slotIndex && other.companyName === value.trim())) return
                                        setWangYueTargetManagementBrandOpenRequest(null)
                                        setWangYueTargetManagementCompanyOpenRequest(null)
                                        setActiveWangYueTargetManagementCompanySearchSlot(null)
                                        setWangYueTargetManagementCompanySearch('')
                                        setWangYueTargetManagementCompanySearchSource('deal')
                                        setWangYueTargetManagementCompanySlots((current) => current.map((name, index) =>
                                          index === group.slotIndex ? value : name,
                                        ))
                                        setWangYueTargetManagementBrandFilters((current) => Object.fromEntries(
                                          Object.entries(current).filter(([key]) => !key.startsWith(`${group.slotIndex}:`)),
                                        ))
                                        setWangYueTargetManagementSubBrandFilters((current) => Object.fromEntries(
                                          Object.entries(current).filter(([key]) => !key.startsWith(`${group.slotIndex}:`)),
                                        ))
                                      }}
                                    />
                                    <CollapsibleCompanyActions
                                      platforms={WANGYUE_TARGET_MANAGEMENT_ADDABLE_PLATFORMS}
                                      existingPlatformIds={existingPlatformIds}
                                      onAddPlatform={(platformId) => openTargetManagementBrandSelection(group.slotIndex, platformId)}
                                    >
                                      <button
                                        type="button"
                                        className="target-management-add-button"
                                        aria-label={`重置第${group.slotIndex + 1}行公司筛选`}
                                        title="重置公司筛选"
                                        onClick={resetCompanySelection}
                                      >
                                        重置
                                      </button>
                                      <button
                                        type="button"
                                        className="target-management-add-button"
                                        aria-label={isCompanyCatalogSearch
                                          ? `切换到第${group.slotIndex + 1}行对客公司筛选`
                                          : `切换到第${group.slotIndex + 1}行全部公司筛选`}
                                        title={isCompanyCatalogSearch ? '切换回对客成单公司筛选' : '筛选天玑系统中的全部公司'}
                                        onClick={() => requestCompanySearch(group.slotIndex, isCompanyCatalogSearch ? 'deal' : 'catalog')}
                                      >
                                        {isCompanyCatalogSearch ? '对客公司筛选' : '全部公司筛选'}
                                      </button>
                                      <button
                                        type="button"
                                        className="target-management-add-button target-management-delete-company-row"
                                        aria-label={`删减第${group.slotIndex + 1}行公司`}
                                        title="删减此公司行"
                                        onClick={() => removeCompanySlot(group.slotIndex)}
                                      >
                                        删减
                                      </button>
                                    </CollapsibleCompanyActions>
                                    {group.companyName ? (
                                      <div className="target-management-company-selected-name">
                                        <span>{group.companyName}</span>
                                        {companyTargetAmount > 0 ? (
                                          <small>目标 {companyTargetAmount.toFixed(2)}{wangYueTargetManagementAmountDisplay.unit === 'wan' ? '万' : '元'}</small>
                                        ) : null}
                                        <div className="target-management-publish-summary is-company">
                                          <span title={companyPublishAvailable ? `总发布业绩：${formatAmount(companyPublishAmount, wangYueTargetManagementAmountDisplay)}` : '发布业绩暂不可用'}><small>发布</small>{companyPublishAvailable ? formatAmount(companyPublishAmount, wangYueTargetManagementAmountDisplay) : '—'}</span>
                                          <strong className={`target-management-publish-completion ${companyCompletionClass}`} title={`目标完成度；方片月时间进度 ${formatRate(timeProgress)}`}>
                                            完成 {companyPublishCompletion === null ? '—' : formatRate(companyPublishCompletion)}
                                          </strong>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                {targetManagementPlatforms.map((platform, platformIndex) => {
                                  const visibleBrandIndexes = getVisibleBrandIndexes(group.slotIndex, platform.id)
                                  const brandCount = getVisibleBrandRowCount(group.slotIndex, platform.id)
                                  if (brandCount <= 0) return null
                                  const visiblePlatformCount = targetManagementPlatforms.filter((item) =>
                                    getVisibleBrandIndexes(group.slotIndex, item.id).length > 0,
                                  ).length
                                  const rowsBeforePlatform = targetManagementPlatforms.slice(0, platformIndex).reduce((total, previousPlatform) =>
                                    total + getVisibleBrandRowCount(group.slotIndex, previousPlatform.id), 0)
                                  return (
                                  <div
                                    className={`target-management-merged-row${platform.id === 1 ? ' is-platform-xiaohongshu' : platform.id === 2 ? ' is-platform-douyin' : platform.id === 5 ? ' is-platform-shipinhao' : platform.id === WANGYUE_TARGET_MANAGEMENT_EXTERNAL_PLATFORM_ID ? ' is-platform-outsourcing' : ''}`}
                                    role="row"
                                    key={`platform-group-${group.slotIndex}-${platform.id}`}
                                    data-target-management-frozen-column="2"
                                    style={{
                                      gridColumn: 3,
                                      gridRow: `${group.rowStart + rowsBeforePlatform} / span ${brandCount}`,
                                      ...getTargetManagementFrozenColumnStyle(2),
                                    }}
                                  >
                                    <div className="target-management-cell target-management-platform-cell" role="cell">
                                      <CollapsiblePlatformActions
                                        platformName={platform.name}
                                        disabled={visiblePlatformCount <= 1}
                                        onAddBrand={() => openTargetManagementBrandSelection(group.slotIndex, platform.id)}
                                        onRemove={() => removePlatformRows(group, platform)}
                                      />
                                      <span className="target-management-platform-name">{platform.name}</span>
                                    </div>
                                  </div>
                                  )
                                })}
                              </Fragment>
                            )
                          })}
                      </div>
                    </div>
                    <input
                      className="company-dashboard-horizontal-range target-management-horizontal-range target-management-horizontal-range-bottom"
                      ref={targetManagementTableBottomRangeRef}
                      type="range"
                      min={0}
                      max={targetManagementTableScrollMax}
                      defaultValue={0}
                      disabled={targetManagementTableScrollMax === 0}
                      aria-label={`从底部横向滚动${selectedName}目标管理表格`}
                      onChange={(event) => scrollTargetManagementTableTo(Number(event.target.value))}
                    />
                  </div>
                )
              })()
            ) : null}
            {!isWangYueTargetManagementActive && !targetSplitBoardActive && wangYueTargetEntityBoard === 'company' ? (() => {
              const dimension = wangYueTargetEntityDimensions.company
              const monthId = wangYueCompanyDashboardMonths[dimension]
              const snapshotKey = getCompanyBoardCacheKey(customerCompanyBrandBoardEmployeeName, monthId, dimension)
              const snapshot = companyBoardData[snapshotKey]
              const status = companyBoardStatuses[snapshotKey] ?? 'loading'
              const companySort = wangYueCompanyBoardSorts[dimension]
              const visibleCompanyColumns = COMPANY_BOARD_COLUMNS.filter((column) => wangYueCompanyVisibleColumns[dimension].has(column.key))
              const showBrandShare = OTHER_CUSTOMER_SHARE_EMPLOYEES.has(customerCompanyBrandBoardEmployeeName ?? '')
              const companyDisplayColumns = showBrandShare
                ? visibleCompanyColumns.some((column) => column.key === 'total')
                  ? visibleCompanyColumns.flatMap((column) => column.key === 'total'
                    ? [column, { key: 'brandShare' as const, name: '品牌占比' }]
                    : [column])
                  : [{ key: 'brandShare' as const, name: '品牌占比' }, ...visibleCompanyColumns]
                : visibleCompanyColumns
              const isWangYueCompanyBoard = customerCompanyBrandBoardEmployeeName === '示例对客16'
              const isTargetManagementDealCompanyBoard = TARGET_MANAGEMENT_BOARD_EMPLOYEES.includes(customerCompanyBrandBoardEmployeeName as typeof TARGET_MANAGEMENT_BOARD_EMPLOYEES[number]) && dimension === 'deal'
              const submissionSnapshotKey = JSON.stringify([customerCompanyBrandBoardEmployeeName, monthId])
              const submissionSnapshot = isTargetManagementDealCompanyBoard ? targetManagementSubmissionSnapshots[submissionSnapshotKey] : undefined
              const submissionSnapshotStatus = isTargetManagementDealCompanyBoard ? targetManagementSubmissionSnapshotStatuses[submissionSnapshotKey] ?? 'loading' : 'loaded'
              const submissionCountsByCompany = new Map<string, number>()
              for (const item of submissionSnapshot?.tableCounts ?? []) {
                submissionCountsByCompany.set(item.companyName, (submissionCountsByCompany.get(item.companyName) ?? 0) + item.count)
              }
              const companies = snapshot?.companies ?? []
              const selectedCompanyName = wangYueCompanyNameFilters[dimension].trim()
              const filteredCompanies = selectedCompanyName
                ? companies.filter((company) => company.companyName.toLocaleLowerCase().includes(selectedCompanyName.toLocaleLowerCase()))
                : companies
              const companySummary = filteredCompanies.reduce((summary, company) => ({
                amount: summary.amount + company.totalAmount,
                orderCount: summary.orderCount + company.totalOrderCount,
              }), { amount: 0, orderCount: 0 })
              const getSortValue = (company: DashboardCompanyPerformanceResponse['companies'][number], column: SortableColumnKey) => {
                if (column === 'companyName') return company.companyName
                if (column === 'companyHalfPastTen') return company.halfPastTen.amount
                if (column === 'companySelfIncubated') return company.selfIncubated.amount
                if (column === 'companySigningXiaohongshu') return company.signingXiaohongshu.amount
                if (column === 'companySigningDouyin') return company.signingDouyin.amount
                if (column === 'companySigningShipinhao') return company.signingShipinhao.amount
                if (column === 'companyOutsourcing') return company.outsourcing.amount
                if (column === 'companyTotal') return company.totalAmount
                return company.totalOrderCount
              }
              const orderedCompanies = companySort
                ? [...filteredCompanies].sort((left, right) => {
                  const leftValue = getSortValue(left, companySort.column)
                  const rightValue = getSortValue(right, companySort.column)
                  const difference = typeof leftValue === 'string' && typeof rightValue === 'string'
                    ? leftValue.localeCompare(rightValue, 'zh-CN')
                    : Number(leftValue) - Number(rightValue)
                  return companySort.direction === 'asc' ? difference : -difference
                })
                : filteredCompanies
              const gridTemplateColumns = [
                'minmax(60px, .4fr)',
                'minmax(220px, 1.5fr)',
                ...companyDisplayColumns.map((column) => column.key === 'orderCount' || column.key === 'brandShare' ? 'minmax(110px, .75fr)' : 'minmax(140px, 1fr)'),
                ...(isTargetManagementDealCompanyBoard ? ['minmax(130px, .85fr)'] : []),
              ].join(' ')
              const frozenColumnCount = Math.max(2, companyDisplayColumns.findIndex((column) => column.key === 'total') + 3)
              const tableMinWidth = `${280 + companyDisplayColumns.reduce((width, column) => width + (column.key === 'orderCount' || column.key === 'brandShare' ? 110 : 140), 0) + (isTargetManagementDealCompanyBoard ? 130 : 0)}px`
              const periodLabel = DASHBOARD_FANGPIAN_PERIODS[monthId].label
              const renderSortButton = (column: SortableColumnKey, label: string, secondaryLabel?: string) => (
                <SortButton
                  column={column}
                  label={label}
                  secondaryLabel={secondaryLabel}
                  sort={companySort}
                  onClick={() => setWangYueCompanyBoardSorts((current) => ({
                    ...current,
                    [dimension]: nextSortConfig(current[dimension], column),
                  }))}
                  onReset={() => setWangYueCompanyBoardSorts((current) => ({
                    ...current,
                    [dimension]: { ...DEFAULT_COMPANY_BOARD_SORT },
                  }))}
                />
              )
              const renderMetricButton = (
                companyName: string,
                metricKey: DashboardCompanyMetricKey,
                amount: number,
                orderCount: number,
              ) => (
                <button
                  type="button"
                  className={`company-dashboard-amount${metricKey === 'total' ? ' company-dashboard-total' : ''}`}
                  aria-label={`${companyName}，${COMPANY_METRIC_NAMES[metricKey]}，${formatAmount(amount, wangYueEntityAmountDisplay)}，${orderCount}单，点击查看订单`}
                  onClick={() => openCompanyOrderDetails(monthId, dimension, metricKey, companyName, undefined, undefined, customerCompanyBrandBoardEmployeeName)}
                >
                  {formatAmount(amount, wangYueEntityAmountDisplay)}
                  <small>{orderCount} 单</small>
                </button>
              )
              return (
                <>
                  {status === 'loading' ? <div className="dashboard-data-note">正在读取{periodLabel}{customerCompanyBrandBoardEmployeeName}公司业绩快照…</div> : null}
                  {status === 'error' ? <div className="dashboard-data-note dashboard-data-note-error">{customerCompanyBrandBoardEmployeeName}公司看板快照暂不可用，请等待后台计划刷新后重试。</div> : null}
                  {status === 'loaded' && snapshot ? (
                    <>
                      <div className="company-dashboard-summary" aria-label={`${customerCompanyBrandBoardEmployeeName}公司汇总数据`}>
                        <button
                          type="button"
                          aria-label={`${customerCompanyBrandBoardEmployeeName}全部公司业绩，${formatAmount(Number(companySummary.amount.toFixed(2)), wangYueEntityAmountDisplay)}，点击查看订单`}
                          onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedCompanyName ? { customerName: selectedCompanyName } : undefined, customerCompanyBrandBoardEmployeeName)}
                        >
                          <span>全部公司业绩</span>
                          <b>{formatAmount(Number(companySummary.amount.toFixed(2)), wangYueEntityAmountDisplay)}</b>
                        </button>
                        <button
                          type="button"
                          aria-label={`${customerCompanyBrandBoardEmployeeName}全部公司成单单数，${companySummary.orderCount}单，点击查看订单`}
                          onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedCompanyName ? { customerName: selectedCompanyName } : undefined, customerCompanyBrandBoardEmployeeName)}
                        >
                          <span>成单单数</span>
                          <b>{companySummary.orderCount} 单</b>
                        </button>
                      </div>
                      <input
                        className="company-dashboard-horizontal-range"
                        type="range"
                        min={0}
                        max={companyTableScrollMax}
                        value={Math.min(companyTableScrollPosition, companyTableScrollMax)}
                        disabled={companyTableScrollMax === 0}
                        aria-label={`横向滚动${customerCompanyBrandBoardEmployeeName}公司看板`}
                        onChange={(event) => {
                          const scrollLeft = Number(event.target.value)
                          if (companyTableWrapRef.current) companyTableWrapRef.current.scrollLeft = scrollLeft
                          setCompanyTableScrollPosition(scrollLeft)
                        }}
                      />
                      <div
                        className="customer-dashboard-table-wrap company-dashboard-table-wrap wangyue-target-entity-table-wrap"
                        aria-label={`${periodLabel}${DIMENSION_NAMES[dimension]}${customerCompanyBrandBoardEmployeeName}公司业绩`}
                        ref={companyTableWrapRef}
                        onScroll={syncCompanyTableScroll}
                      >
                        <div className="customer-dashboard-table company-dashboard-table" ref={companyTableContentRef} data-company-freeze-count={frozenColumnCount} style={{ minWidth: tableMinWidth }}>
                          <div className="customer-dashboard-row customer-dashboard-header" role="row" style={{ gridTemplateColumns }}>
                            <span role="columnheader">序号</span>
                            <span role="columnheader" className="company-dashboard-name-filter-header">
                              {renderSortButton('companyName', '公司名称')}
                              <NameAutocompleteFilter
                                ariaLabel={`筛选${customerCompanyBrandBoardEmployeeName}公司名称`}
                                placeholder="输入或选择公司名称"
                                value={wangYueCompanyNameFilters[dimension]}
                                options={companies.map((company) => ({ name: company.companyName, count: company.totalOrderCount }))}
                                onChange={(value) => setWangYueCompanyNameFilters((current) => ({ ...current, [dimension]: value }))}
                              />
                            </span>
                            {companyDisplayColumns.map((column) => (
                              <span role="columnheader" key={column.key}>
                                {column.key === 'brandShare'
                                  ? <span className="company-dashboard-share-heading">{column.name}</span>
                                  : renderSortButton(COMPANY_SORT_COLUMNS[column.key], column.name, column.secondaryName)}
                              </span>
                            ))}
                            {isTargetManagementDealCompanyBoard ? <span role="columnheader">做表数量</span> : null}
                          </div>
                          {orderedCompanies.map((company, index) => (
                            <div className="customer-dashboard-row" role="row" key={company.companyName} style={{ gridTemplateColumns }}>
                              <span className="company-dashboard-index" role="cell">{index + 1}</span>
                              <span className="customer-dashboard-person" role="rowheader">{company.companyName}</span>
                              {companyDisplayColumns.map((column) => {
                                if (column.key === 'brandShare') {
                                  return (
                                    <div role="cell" key={column.key} className="company-dashboard-share-cell">
                                      <button
                                        type="button"
                                        className="company-dashboard-share-open"
                                        aria-label={`查看${company.companyName}的品牌业绩占比`}
                                        onClick={() => setCompanyBrandShareContext({
                                          kind: 'brands',
                                          monthId,
                                          dimension,
                                          companyName: company.companyName,
                                          employeeName: customerCompanyBrandBoardEmployeeName as DashboardCompanyBoardEmployeeName,
                                        })}
                                      >
                                        查看
                                      </button>
                                    </div>
                                  )
                                }
                                if (column.key === 'orderCount') {
                                  return (
                                    <div role="cell" key={column.key}>
                                      <button
                                        type="button"
                                        className={`company-dashboard-order-count${isWangYueCompanyBoard ? ' company-dashboard-order-count-wang-yue' : ''}`}
                                        aria-label={`${company.companyName}，全部订单，${company.totalOrderCount}单，点击查看订单`}
                                        onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', company.companyName, undefined, undefined, customerCompanyBrandBoardEmployeeName)}
                                      >
                                        {company.totalOrderCount} 单
                                      </button>
                                    </div>
                                  )
                                }
                                const metric = column.key === 'total'
                                  ? { amount: company.totalAmount, orderCount: company.totalOrderCount }
                                  : company[column.key]
                                return <div role="cell" key={column.key}>{renderMetricButton(company.companyName, column.key, metric.amount, metric.orderCount)}</div>
                              })}
                              {isTargetManagementDealCompanyBoard ? (
                                <div role="cell" className="company-dashboard-share-cell">
                                  {submissionSnapshotStatus === 'loaded' ? (
                                    <button
                                      type="button"
                                      className="company-dashboard-order-count company-dashboard-submission-count"
                                      aria-label={`${company.companyName}做表数量${submissionCountsByCompany.get(company.companyName) ?? 0}份，点击查看明细`}
                                      onClick={() => setTargetManagementSubmissionDetailsContext({
                                        monthId,
                                        employeeName: customerCompanyBrandBoardEmployeeName,
                                        companyName: company.companyName,
                                        platformName: '',
                                        brandName: '',
                                        count: submissionCountsByCompany.get(company.companyName) ?? 0,
                                      })}
                                    >
                                      {submissionCountsByCompany.get(company.companyName) ?? 0} 份
                                    </button>
                                  ) : submissionSnapshotStatus === 'error' ? (
                                    <button type="button" className="company-dashboard-order-count" onClick={() => loadTargetManagementSubmissionSnapshot(customerCompanyBrandBoardEmployeeName, monthId)}>重试</button>
                                  ) : (
                                    <span className="company-dashboard-snapshot-loading">读取中…</span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))}
                          {orderedCompanies.length === 0 ? <div className="company-dashboard-empty">{selectedCompanyName ? '没有符合筛选条件的公司订单。' : '该方片月没有符合条件的公司订单。'}</div> : null}
                        </div>
                      </div>
                      <div className="company-dashboard-snapshot-note">
                        {companyBoardEmployeeRoleLabel}：{customerCompanyBrandBoardEmployeeName} · 自孵十点半单独统计 · 发布维度外采按结款时间 · 快照更新时间：{snapshot.snapshotUpdatedAt
                          ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(snapshot.snapshotUpdatedAt))
                          : '未知'}
                      </div>
                    </>
                  ) : null}
                </>
              )
            })() : null}
            {!isWangYueTargetManagementActive && !targetSplitBoardActive && wangYueTargetEntityBoard === 'brand' ? (() => {
              const dimension = wangYueTargetEntityDimensions.brand
              const monthId = wangYueBrandDashboardMonths[dimension]
              const snapshotKey = getBrandBoardCacheKey(customerCompanyBrandBoardEmployeeName, monthId, dimension)
              const snapshot = brandBoardData[snapshotKey]
              const status = brandBoardStatuses[snapshotKey] ?? 'loading'
              const brandSort = wangYueBrandBoardSorts[dimension]
              const visibleBrandColumns = COMPANY_BOARD_COLUMNS.filter((column) => wangYueBrandVisibleColumns[dimension].has(column.key))
              const showCompanyShare = OTHER_CUSTOMER_SHARE_EMPLOYEES.has(customerCompanyBrandBoardEmployeeName ?? '')
              const brandDisplayColumns = showCompanyShare
                ? visibleBrandColumns.some((column) => column.key === 'total')
                  ? visibleBrandColumns.flatMap((column) => column.key === 'total'
                    ? [column, { key: 'companyShare' as const, name: '公司占比' }]
                    : [column])
                  : [{ key: 'companyShare' as const, name: '公司占比' }, ...visibleBrandColumns]
                : visibleBrandColumns
              const brands = snapshot?.brands ?? []
              const selectedBrandName = wangYueBrandNameFilters[dimension].trim()
              const filteredBrands = selectedBrandName
                ? brands.filter((brand) => brand.brandName.toLocaleLowerCase().includes(selectedBrandName.toLocaleLowerCase()))
                : brands
              const brandSummary = filteredBrands.reduce((summary, brand) => ({
                amount: summary.amount + brand.totalAmount,
                orderCount: summary.orderCount + brand.totalOrderCount,
              }), { amount: 0, orderCount: 0 })
              const getSortValue = (brand: DashboardBrandPerformanceResponse['brands'][number], column: SortableColumnKey) => {
                if (column === 'brandName') return brand.brandName
                if (column === 'companyHalfPastTen') return brand.halfPastTen.amount
                if (column === 'companySelfIncubated') return brand.selfIncubated.amount
                if (column === 'companySigningXiaohongshu') return brand.signingXiaohongshu.amount
                if (column === 'companySigningDouyin') return brand.signingDouyin.amount
                if (column === 'companySigningShipinhao') return brand.signingShipinhao.amount
                if (column === 'companyOutsourcing') return brand.outsourcing.amount
                if (column === 'companyTotal') return brand.totalAmount
                return brand.totalOrderCount
              }
              const orderedBrands = brandSort
                ? [...filteredBrands].sort((left, right) => {
                  const leftValue = getSortValue(left, brandSort.column)
                  const rightValue = getSortValue(right, brandSort.column)
                  const difference = typeof leftValue === 'string' && typeof rightValue === 'string'
                    ? leftValue.localeCompare(rightValue, 'zh-CN')
                    : Number(leftValue) - Number(rightValue)
                  return brandSort.direction === 'asc' ? difference : -difference
                })
                : filteredBrands
              const gridTemplateColumns = [
                'minmax(60px, .4fr)',
                'minmax(220px, 1.5fr)',
                ...brandDisplayColumns.map((column) => column.key === 'orderCount' || column.key === 'companyShare' ? 'minmax(110px, .75fr)' : 'minmax(140px, 1fr)'),
              ].join(' ')
              const frozenColumnCount = Math.max(2, brandDisplayColumns.findIndex((column) => column.key === 'total') + 3)
              const tableMinWidth = `${280 + brandDisplayColumns.reduce((width, column) => width + (column.key === 'orderCount' || column.key === 'companyShare' ? 110 : 140), 0)}px`
              const periodLabel = DASHBOARD_FANGPIAN_PERIODS[monthId].label
              const renderSortButton = (column: SortableColumnKey, label: string, secondaryLabel?: string) => (
                <SortButton
                  column={column}
                  label={label}
                  secondaryLabel={secondaryLabel}
                  sort={brandSort}
                  onClick={() => setWangYueBrandBoardSorts((current) => ({
                    ...current,
                    [dimension]: nextSortConfig(current[dimension], column),
                  }))}
                  onReset={() => setWangYueBrandBoardSorts((current) => ({
                    ...current,
                    [dimension]: { ...DEFAULT_COMPANY_BOARD_SORT },
                  }))}
                />
              )
              const renderMetricButton = (
                brandName: string,
                metricKey: DashboardCompanyMetricKey,
                amount: number,
                orderCount: number,
              ) => (
                <button
                  type="button"
                  className={`company-dashboard-amount${metricKey === 'total' ? ' company-dashboard-total' : ''}`}
                  aria-label={`${brandName}，${COMPANY_METRIC_NAMES[metricKey]}，${formatAmount(amount, wangYueEntityAmountDisplay)}，${orderCount}单，点击查看订单`}
                  onClick={() => openCompanyOrderDetails(monthId, dimension, metricKey, undefined, brandName, undefined, customerCompanyBrandBoardEmployeeName)}
                >
                  {formatAmount(amount, wangYueEntityAmountDisplay)}
                  <small>{orderCount} 单</small>
                </button>
              )
              return (
                <>
                  {status === 'loading' ? <div className="dashboard-data-note">正在读取{periodLabel}{customerCompanyBrandBoardEmployeeName}品牌业绩快照…</div> : null}
                  {status === 'error' ? <div className="dashboard-data-note dashboard-data-note-error">{customerCompanyBrandBoardEmployeeName}品牌看板暂不可用，请等待后台计划刷新对应公司的订单快照。</div> : null}
                  {status === 'loaded' && snapshot ? (
                    <>
                      <div className="company-dashboard-summary" aria-label={`${customerCompanyBrandBoardEmployeeName}品牌汇总数据`}>
                        <button
                          type="button"
                          aria-label={`${customerCompanyBrandBoardEmployeeName}全部品牌业绩，${formatAmount(Number(brandSummary.amount.toFixed(2)), wangYueEntityAmountDisplay)}，点击查看订单`}
                          onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedBrandName ? { brandName: selectedBrandName } : undefined, customerCompanyBrandBoardEmployeeName)}
                        >
                          <span>全部品牌业绩</span>
                          <b>{formatAmount(Number(brandSummary.amount.toFixed(2)), wangYueEntityAmountDisplay)}</b>
                        </button>
                        <button
                          type="button"
                          aria-label={`${customerCompanyBrandBoardEmployeeName}全部品牌订单数，${brandSummary.orderCount}单，点击查看订单`}
                          onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedBrandName ? { brandName: selectedBrandName } : undefined, customerCompanyBrandBoardEmployeeName)}
                        >
                          <span>订单数</span>
                          <b>{brandSummary.orderCount} 单</b>
                        </button>
                      </div>
                      <input
                        className="company-dashboard-horizontal-range"
                        type="range"
                        min={0}
                        max={companyTableScrollMax}
                        value={Math.min(companyTableScrollPosition, companyTableScrollMax)}
                        disabled={companyTableScrollMax === 0}
                        aria-label={`横向滚动${customerCompanyBrandBoardEmployeeName}品牌看板`}
                        onChange={(event) => {
                          const scrollLeft = Number(event.target.value)
                          if (companyTableWrapRef.current) companyTableWrapRef.current.scrollLeft = scrollLeft
                          setCompanyTableScrollPosition(scrollLeft)
                        }}
                      />
                      <div
                        className="customer-dashboard-table-wrap company-dashboard-table-wrap wangyue-target-entity-table-wrap"
                        aria-label={`${periodLabel}${DIMENSION_NAMES[dimension]}${customerCompanyBrandBoardEmployeeName}品牌业绩`}
                        ref={companyTableWrapRef}
                        onScroll={syncCompanyTableScroll}
                      >
                        <div className="customer-dashboard-table company-dashboard-table" ref={companyTableContentRef} data-company-freeze-count={frozenColumnCount} style={{ minWidth: tableMinWidth }}>
                          <div className="customer-dashboard-row customer-dashboard-header" role="row" style={{ gridTemplateColumns }}>
                            <span role="columnheader">序号</span>
                            <span role="columnheader" className="company-dashboard-name-filter-header">
                              {renderSortButton('brandName', '品牌名称')}
                              <NameAutocompleteFilter
                                ariaLabel={`筛选${customerCompanyBrandBoardEmployeeName}品牌名称`}
                                placeholder="输入或选择品牌名称"
                                value={wangYueBrandNameFilters[dimension]}
                                options={brands.map((brand) => ({ name: brand.brandName, count: brand.totalOrderCount }))}
                                onChange={(value) => setWangYueBrandNameFilters((current) => ({ ...current, [dimension]: value }))}
                              />
                            </span>
                            {brandDisplayColumns.map((column) => (
                              <span role="columnheader" key={column.key}>
                                {column.key === 'companyShare'
                                  ? <span className="company-dashboard-share-heading">{column.name}</span>
                                  : renderSortButton(COMPANY_SORT_COLUMNS[column.key], column.name, column.secondaryName)}
                              </span>
                            ))}
                          </div>
                          {orderedBrands.map((brand, index) => (
                            <div className="customer-dashboard-row" role="row" key={brand.brandName} style={{ gridTemplateColumns }}>
                              <span className="company-dashboard-index" role="cell">{index + 1}</span>
                              <span className="customer-dashboard-person" role="rowheader">{brand.brandName}</span>
                              {brandDisplayColumns.map((column) => {
                                if (column.key === 'companyShare') {
                                  return (
                                    <div role="cell" key={column.key} className="company-dashboard-share-cell">
                                      <button
                                        type="button"
                                        className="company-dashboard-share-open"
                                        aria-label={`查看${brand.brandName}的公司业绩占比`}
                                        onClick={() => setCompanyBrandShareContext({
                                          kind: 'companies',
                                          monthId,
                                          dimension,
                                          brandName: brand.brandName,
                                          employeeName: customerCompanyBrandBoardEmployeeName as DashboardCompanyBoardEmployeeName,
                                        })}
                                      >
                                        查看
                                      </button>
                                    </div>
                                  )
                                }
                                if (column.key === 'orderCount') {
                                  return (
                                    <div role="cell" key={column.key}>
                                      <button
                                        type="button"
                                        className="company-dashboard-order-count"
                                        aria-label={`${brand.brandName}，全部订单，${brand.totalOrderCount}单，点击查看订单`}
                                        onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, brand.brandName, undefined, customerCompanyBrandBoardEmployeeName)}
                                      >
                                        {brand.totalOrderCount} 单
                                      </button>
                                    </div>
                                  )
                                }
                                const metric = column.key === 'total'
                                  ? { amount: brand.totalAmount, orderCount: brand.totalOrderCount }
                                  : brand[column.key]
                                return <div role="cell" key={column.key}>{renderMetricButton(brand.brandName, column.key, metric.amount, metric.orderCount)}</div>
                              })}
                            </div>
                          ))}
                          {orderedBrands.length === 0 ? <div className="company-dashboard-empty">{selectedBrandName ? '没有符合筛选条件的品牌订单。' : '该方片月没有符合条件的品牌订单。'}</div> : null}
                        </div>
                      </div>
                      <div className="company-dashboard-snapshot-note">
                        {companyBoardEmployeeRoleLabel}：{customerCompanyBrandBoardEmployeeName} · 品牌汇总复用{customerCompanyBrandBoardEmployeeName}公司订单快照 · 时间与状态口径同公司看板 · 快照更新时间：{snapshot.snapshotUpdatedAt
                          ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(snapshot.snapshotUpdatedAt))
                          : '未知'}
                      </div>
                    </>
                  ) : null}
                </>
              )
            })() : null}
          </article>
        </section>
      ) : null}

      {selectedName === '示例开发01' ? (
        <section className="supplementary-dashboard-grid" aria-label="示例开发01扩展看板">
          {!targetSplitBoardActive ? SUPPLEMENTARY_DASHBOARDS.filter(({ key }) => key === activeSupplementaryDashboard).map(({ key, title }) => (
            <article
              className={`supplementary-dashboard-card${key === 'customer'
                ? ` customer-dashboard-card customer-dashboard-card-${supplementaryDashboardDimensions.customer}`
                : key === 'company' || key === 'brand'
                  ? ` company-dashboard-card company-dashboard-card-${supplementaryDashboardDimensions[key]}`
                  : ''}`}
              key={key}
              id={`supplementary-dashboard-panel-${key}`}
              role="tabpanel"
            >
              <div className="supplementary-dashboard-tabs" role="tablist" aria-label="扩展看板类型">
                {SUPPLEMENTARY_DASHBOARDS.map((dashboard) => (
                  <button
                    key={dashboard.key}
                    type="button"
                    role="tab"
                    aria-selected={activeSupplementaryDashboard === dashboard.key}
                    className={`supplementary-dashboard-tab${activeSupplementaryDashboard === dashboard.key ? ' active' : ''}`}
                    onClick={() => {
                      setTargetSplitBoardActive(false)
                      setTargetSplitImportOpen(false)
                      setActiveSupplementaryDashboard(dashboard.key)
                      if (dashboard.key === 'customer') setActiveCustomerDashboardTab(null)
                    }}
                  >
                    {dashboard.tabLabel}
                  </button>
                ))}
                <button
                  type="button"
                  role="tab"
                  aria-selected={false}
                  className="supplementary-dashboard-tab"
                  onClick={() => {
                    setTargetSplitImportOpen(false)
                    setActiveSupplementaryDashboard('brand')
                    setTargetSplitBoardActive(true)
                  }}
                >
                  听说你还不会拆？
                </button>
              </div>
              {key === 'customer' ? (
                activeCustomerDashboardTab ? (
                <div className="customer-dashboard-tabs" role="tablist" aria-label="对客人员看板标签">
                  {customerDashboardTabs.map((employeeName) => (
                    <div className={`customer-dashboard-tab-item${activeCustomerDashboardTab === employeeName ? ' active' : ''}`} key={employeeName}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeCustomerDashboardTab === employeeName}
                        className="customer-dashboard-tab"
                        onClick={() => setActiveCustomerDashboardTab(employeeName)}
                      >
                        {employeeName}看板
                      </button>
                      <button
                        type="button"
                        className="customer-dashboard-tab-close"
                        aria-label={`关闭${employeeName}看板`}
                        onClick={() => closeCustomerMemberDashboard(employeeName)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                ) : null
              ) : null}
              <div className={`supplementary-dashboard-head${key === 'customer' ? ' customer-dashboard-head' : key === 'company' || key === 'brand' ? ' company-dashboard-head' : ''}`}>
                <div className="supplementary-dashboard-title-group">
                  {key !== 'customer' || activeCustomerDashboardTab === null ? (
                    <div className="dimension-switcher" role="group" aria-label={`${title}维度筛选`}>
                      {DIMENSIONS.map((dimension) => (
                        <button
                          className={`dimension-switcher-button ${dimension}${supplementaryDashboardDimensions[key] === dimension ? ' active' : ''}`}
                          key={dimension}
                          type="button"
                          aria-pressed={supplementaryDashboardDimensions[key] === dimension}
                          onClick={() => setSupplementaryDashboardDimensions((current) => ({
                            ...current,
                            [key]: dimension,
                          }))}
                        >
                          {DIMENSION_NAMES[dimension]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <h2>{key === 'customer'
                    ? activeCustomerDashboardTab
                      ? `${DIMENSION_NAMES.publish} · ${activeCustomerDashboardTab}`
                      : `${DIMENSION_NAMES[supplementaryDashboardDimensions.customer]} · 对客人`
                  : key === 'company'
                      ? `${DIMENSION_NAMES[supplementaryDashboardDimensions.company]} · ${title}`
                      : key === 'brand'
                        ? `${DIMENSION_NAMES[supplementaryDashboardDimensions.brand]} · ${title}`
                      : title}</h2>
                </div>
                {key === 'customer' ? (
                  <div className="customer-dashboard-controls">
                    <label className="dashboard-month-filter">
                      月份
                      <select value={customerDashboardMonth} onChange={(event) => updateCustomerDashboardMonth(event.target.value)}>
                        {DASHBOARD_MONTH_IDS.map((monthId) => (
                          <option key={monthId} value={monthId}>{DASHBOARD_FANGPIAN_PERIODS[monthId].label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="customer-dashboard-toolbar">
                      <div className="amount-display-controls" aria-label="对客人看板金额显示设置">
                        <label>
                          单位
                          <select
                            value={customerAmountDisplay.unit}
                            onChange={(event) => setCustomerAmountDisplay((current) => ({
                              ...current,
                              unit: event.target.value === 'wan' ? 'wan' : 'yuan',
                            }))}
                          >
                            <option value="yuan">元</option>
                            <option value="wan">万元</option>
                          </select>
                        </label>
                        <label>
                          小数
                          <select
                            value={customerAmountDisplay.decimals}
                            onChange={(event) => setCustomerAmountDisplay((current) => ({
                              ...current,
                              decimals: Number(event.target.value),
                            }))}
                          >
                            {[0, 1, 2, 3, 4].map((decimals) => <option key={decimals} value={decimals}>{decimals} 位</option>)}
                          </select>
                        </label>
                      </div>
                      {activeCustomerDashboardTab === null ? (
                        <>
                          <button type="button" className="chart-button" onClick={() => setCustomerChartOpen(true)}>业绩趋势</button>
                          <details className="column-filter">
                            <summary>筛选维度</summary>
                            <div className="filter-panel">
                              {CUSTOMER_COLUMNS_BY_DIMENSION[supplementaryDashboardDimensions.customer].map((column) => (
                                <label key={column.key}>
                                  <input
                                    type="checkbox"
                                    checked={customerVisibleColumns[supplementaryDashboardDimensions.customer].has(column.key)}
                                    onChange={() => toggleCustomerColumn(supplementaryDashboardDimensions.customer, column.key)}
                                  />
                                {column.name}
                              </label>
                            ))}
                            </div>
                          </details>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {key === 'company' ? (
                  <div className="company-dashboard-controls">
                    <label className="dashboard-month-filter">
                      月份
                      <select
                        value={companyDashboardMonths[supplementaryDashboardDimensions.company]}
                        onChange={(event) => updateCompanyDashboardMonth(supplementaryDashboardDimensions.company, event.target.value)}
                      >
                        {DASHBOARD_MONTH_IDS.map((monthId) => (
                          <option key={monthId} value={monthId}>{DASHBOARD_FANGPIAN_PERIODS[monthId].label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="customer-dashboard-toolbar">
                      <div className="amount-display-controls" aria-label="公司看板金额显示设置">
                        <label>
                          单位
                          <select
                            value={companyAmountDisplay.unit}
                            onChange={(event) => setCompanyAmountDisplay((current) => ({
                              ...current,
                              unit: event.target.value === 'wan' ? 'wan' : 'yuan',
                            }))}
                          >
                            <option value="yuan">元</option>
                            <option value="wan">万元</option>
                          </select>
                        </label>
                        <label>
                          小数
                          <select
                            value={companyAmountDisplay.decimals}
                            onChange={(event) => setCompanyAmountDisplay((current) => ({
                              ...current,
                              decimals: Number(event.target.value),
                            }))}
                          >
                            {[0, 1, 2, 3, 4].map((decimals) => (
                              <option key={decimals} value={decimals}>{decimals} 位</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <details className="column-filter company-column-filter">
                        <summary>筛选维度</summary>
                        <div className="filter-panel">
                          {COMPANY_BOARD_COLUMNS.map((column) => (
                            <label key={column.key}>
                              <input
                                type="checkbox"
                                checked={companyVisibleColumns[supplementaryDashboardDimensions.company].has(column.key)}
                                onChange={() => toggleCompanyColumn(supplementaryDashboardDimensions.company, column.key)}
                              />
                              <span className={column.secondaryName ? 'company-column-filter-label' : undefined}>
                                <span>{column.name}</span>
                                {column.secondaryName ? <small>{column.secondaryName}</small> : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                ) : null}
                {key === 'brand' ? (
                  <div className="company-dashboard-controls">
                    <label className="dashboard-month-filter">
                      月份
                      <select
                        value={brandDashboardMonths[supplementaryDashboardDimensions.brand]}
                        onChange={(event) => updateBrandDashboardMonth(supplementaryDashboardDimensions.brand, event.target.value)}
                      >
                        {DASHBOARD_MONTH_IDS.map((monthId) => (
                          <option key={monthId} value={monthId}>{DASHBOARD_FANGPIAN_PERIODS[monthId].label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="customer-dashboard-toolbar">
                      <div className="amount-display-controls" aria-label="品牌看板金额显示设置">
                        <label>
                          单位
                          <select
                            value={companyAmountDisplay.unit}
                            onChange={(event) => setCompanyAmountDisplay((current) => ({
                              ...current,
                              unit: event.target.value === 'wan' ? 'wan' : 'yuan',
                            }))}
                          >
                            <option value="yuan">元</option>
                            <option value="wan">万元</option>
                          </select>
                        </label>
                        <label>
                          小数
                          <select
                            value={companyAmountDisplay.decimals}
                            onChange={(event) => setCompanyAmountDisplay((current) => ({
                              ...current,
                              decimals: Number(event.target.value),
                            }))}
                          >
                            {[0, 1, 2, 3, 4].map((decimals) => (
                              <option key={decimals} value={decimals}>{decimals} 位</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <details className="column-filter company-column-filter">
                        <summary>筛选维度</summary>
                        <div className="filter-panel">
                          {COMPANY_BOARD_COLUMNS.map((column) => (
                            <label key={column.key}>
                              <input
                                type="checkbox"
                                checked={brandVisibleColumns[supplementaryDashboardDimensions.brand].has(column.key)}
                                onChange={() => toggleBrandColumn(supplementaryDashboardDimensions.brand, column.key)}
                              />
                              <span className={column.secondaryName ? 'company-column-filter-label' : undefined}>
                                <span>{column.name}</span>
                                {column.secondaryName ? <small>{column.secondaryName}</small> : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                ) : null}
              </div>
              {key === 'customer' ? (
                <>
                  {activeCustomerDashboardTab ? (() => {
                    const employeeName = activeCustomerDashboardTab
                    const monthId = customerDashboardMonth
                    const previousMonthId = monthId > 147 ? (monthId - 1) as DashboardMonthId : null
                    const currentPerformance = getDisplayedPerformance(employeeName, 'publish', monthId)
                    const lastMonthPerformance = previousMonthId
                      ? getDisplayedPerformance(employeeName, 'publish', previousMonthId)
                      : EMPTY_PERFORMANCE
                    const currentAvailable = hasEmployeePerformanceSnapshot(employeeName, monthId)
                    const memberSort = customerMemberSorts[employeeName] ?? null
                    const getCustomerMemberSortValue = (metricKey: MetricKey, column: SortableColumnKey) => {
                      const currentValue = metricKey === 'total'
                        ? getTotalPerformance(currentPerformance)
                        : currentPerformance[metricKey]
                      if (column === 'currentPerformance') return currentValue
                      const lastMonthValue = metricKey === 'total'
                        ? getTotalPerformance(lastMonthPerformance)
                        : lastMonthPerformance[metricKey]
                      if (column === 'lastMonthPerformance') return lastMonthValue
                      const target = manualValues[manualValueKey(monthId, employeeName, 'publish', metricKey)]?.target ?? 0
                      return target > 0 ? currentValue / target : 0
                    }
                    const orderedMemberMetrics = memberSort
                      ? [...SUB_METRICS].sort((left, right) => {
                        const difference = getCustomerMemberSortValue(left.key, memberSort.column)
                          - getCustomerMemberSortValue(right.key, memberSort.column)
                        return memberSort.direction === 'asc' ? difference : -difference
                      })
                      : SUB_METRICS
                    const periodLabel = DASHBOARD_FANGPIAN_PERIODS[monthId].label
                    const lastMonthPeriodLabel = previousMonthId ? DASHBOARD_FANGPIAN_PERIODS[previousMonthId].label : '—'
                    return (
                      <div className="customer-member-board-table-wrap" role="tabpanel">
                        <table className="customer-member-board-table">
                          <thead>
                            <tr>
                              <th>业绩指标</th>
                              <th>
                                <SortButton
                                  column="currentPerformance"
                                  label="本月业绩"
                                  sort={memberSort}
                                  onClick={() => setCustomerMemberSorts((current) => ({
                                    ...current,
                                    [employeeName]: nextSortConfig(current[employeeName] ?? null, 'currentPerformance'),
                                  }))}
                                  onReset={() => setCustomerMemberSorts((current) => ({ ...current, [employeeName]: null }))}
                                />
                                <small>{periodLabel}</small>
                              </th>
                              <th>
                                <SortButton
                                  column="lastMonthPerformance"
                                  label="上月业绩"
                                  sort={memberSort}
                                  onClick={() => setCustomerMemberSorts((current) => ({
                                    ...current,
                                    [employeeName]: nextSortConfig(current[employeeName] ?? null, 'lastMonthPerformance'),
                                  }))}
                                  onReset={() => setCustomerMemberSorts((current) => ({ ...current, [employeeName]: null }))}
                                />
                                <small>{lastMonthPeriodLabel}</small>
                              </th>
                              <th>目标</th>
                              <th>
                                <SortButton
                                  column="targetCompletion"
                                  label="目标完成度"
                                  sort={memberSort}
                                  onClick={() => setCustomerMemberSorts((current) => ({
                                    ...current,
                                    [employeeName]: nextSortConfig(current[employeeName] ?? null, 'targetCompletion'),
                                  }))}
                                  onReset={() => setCustomerMemberSorts((current) => ({ ...current, [employeeName]: null }))}
                                />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderedMemberMetrics.map(({ key, name }) => {
                              const currentValue = key === 'total' ? getTotalPerformance(currentPerformance) : currentPerformance[key]
                              const lastMonthValue = key === 'total' ? getTotalPerformance(lastMonthPerformance) : lastMonthPerformance[key]
                              const target = manualValues[manualValueKey(monthId, employeeName, 'publish', key)]?.target ?? 0
                              const completion = target > 0 ? currentValue / target : 0
                              const formatMetricAmount = (value: number) => isOutsourcingOrderCount(key)
                                ? `${value} 单`
                                : formatAmount(value, customerAmountDisplay)
                              return (
                                <tr key={key}>
                                  <th scope="row">{name}</th>
                                  <td>{currentAvailable ? formatMetricAmount(currentValue) : ''}</td>
                                  <td>{previousMonthId ? formatMetricAmount(lastMonthValue) : ''}</td>
                                  <td>{target > 0 ? formatMetricAmount(target) : ''}</td>
                                  <td>{currentAvailable && target > 0 ? formatRate(completion) : ''}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })() : (() => {
                  const dimension = supplementaryDashboardDimensions.customer
                  const monthId = customerDashboardMonth
                  const previousMonthId = monthId > 147 ? (monthId - 1) as DashboardMonthId : null
                  const currentPeriodLabel = DASHBOARD_FANGPIAN_PERIODS[monthId].label
                  const lastMonthPeriodLabel = previousMonthId ? DASHBOARD_FANGPIAN_PERIODS[previousMonthId].label : '—'
                  const visibleCustomerColumns = CUSTOMER_COLUMNS_BY_DIMENSION[dimension]
                    .filter((column) => customerVisibleColumns[dimension].has(column.key))
                    .map((column) => ({
                      ...column,
                      monthLabel: column.key === 'currentPerformance'
                        ? currentPeriodLabel
                        : column.key === 'lastMonthPerformance'
                          ? lastMonthPeriodLabel
                          : CUSTOMER_METRIC_COLUMNS.some((metricColumn) => metricColumn.key === column.key)
                            ? currentPeriodLabel
                          : undefined,
                    }))
                  const rosterSort = customerRosterSorts[dimension]
                  const getRosterSortValue = (memberName: string, column: SortableColumnKey) => {
                    if (column === 'currentPerformance') {
                      return getTotalPerformance(getDisplayedPerformance(memberName, dimension, monthId))
                    }
                    if (column === 'lastMonthPerformance') {
                      return previousMonthId
                        ? getTotalPerformance(getDisplayedPerformance(memberName, dimension, previousMonthId))
                        : 0
                    }
                    if (CUSTOMER_METRIC_COLUMNS.some((metricColumn) => metricColumn.key === column)) {
                      return getDisplayedPerformance(memberName, dimension, monthId)[column as MetricKey]
                    }
                    const publishPerformance = getDisplayedPerformance(memberName, 'publish', monthId)
                    const publishTotal = getTotalPerformance(publishPerformance)
                    const publishTarget = manualValues[manualValueKey(monthId, memberName, 'publish', 'total')]?.target ?? 0
                    return publishTarget > 0 ? publishTotal / publishTarget : 0
                  }
                  const orderedCustomerMembers = rosterSort
                    ? [...CUSTOMER_DASHBOARD_MEMBERS].sort((left, right) => {
                      const difference = getRosterSortValue(left, rosterSort.column)
                        - getRosterSortValue(right, rosterSort.column)
                      return rosterSort.direction === 'asc' ? difference : -difference
                    })
                    : CUSTOMER_DASHBOARD_MEMBERS
                  const timeProgress = getFangpianMonthTimeProgress(monthId)
                  const gridTemplateColumns = `minmax(145px, .7fr) repeat(${visibleCustomerColumns.length}, minmax(150px, 1fr))`
                  const tableMinWidth = `${Math.max(700, 145 + visibleCustomerColumns.length * 165)}px`
                  return (
                    <>
                      <input
                        className="customer-dashboard-horizontal-range"
                        type="range"
                        min={0}
                        max={customerTableScrollMax}
                        value={Math.min(customerTableScrollPosition, customerTableScrollMax)}
                        disabled={customerTableScrollMax === 0}
                        aria-label="横向滚动对客人看板"
                        onChange={(event) => {
                          const scrollLeft = Number(event.target.value)
                          if (customerTableWrapRef.current) customerTableWrapRef.current.scrollLeft = scrollLeft
                          setCustomerTableScrollPosition(scrollLeft)
                        }}
                      />
                      <div
                        className="customer-dashboard-table-wrap customer-dashboard-roster-table-wrap"
                        aria-label="对客人员业绩"
                        ref={customerTableWrapRef}
                        onScroll={syncCustomerTableScroll}
                      >
                      <div
                        className="customer-dashboard-table"
                        role="table"
                        style={{ minWidth: tableMinWidth }}
                        ref={customerTableContentRef}
                      >
                        <div className="customer-dashboard-row customer-dashboard-header" role="row" style={{ gridTemplateColumns }}>
                          <span role="columnheader" className="customer-dashboard-name-header">
                            <strong>对客人</strong>
                            <small>（点击名字可跳转）</small>
                          </span>
                          {visibleCustomerColumns.map((column) => {
                            const sortableColumn = isSortableColumn(column.key) ? column.key : null
                            return (
                              <span
                                role="columnheader"
                                key={column.key}
                                className={column.monthLabel ? 'customer-dashboard-period-head' : undefined}
                              >
                                {sortableColumn ? (
                                  <SortButton
                                    column={sortableColumn}
                                    label={column.name}
                                    sort={rosterSort}
                                    onClick={() => setCustomerRosterSorts((current) => ({
                                      ...current,
                                      [dimension]: nextSortConfig(current[dimension], sortableColumn),
                                    }))}
                                    onReset={() => setCustomerRosterSorts((current) => ({
                                      ...current,
                                      [dimension]: { column: 'currentPerformance', direction: 'desc' },
                                    }))}
                                  />
                                ) : column.name}
                                {column.monthLabel ? <small>{column.monthLabel}</small> : null}
                              </span>
                            )
                          })}
                        </div>
                        {orderedCustomerMembers.map((memberName) => {
                          const currentPerformance = getDisplayedPerformance(memberName, dimension, monthId)
                          const lastMonthPerformance = previousMonthId
                            ? getDisplayedPerformance(memberName, dimension, previousMonthId)
                            : EMPTY_PERFORMANCE
                          const currentAvailable = hasEmployeePerformanceSnapshot(memberName, monthId)
                          const currentTotal = getTotalPerformance(currentPerformance)
                          const lastMonthTotal = getTotalPerformance(lastMonthPerformance)
                          const publishPerformance = getDisplayedPerformance(memberName, 'publish', monthId)
                          const publishAvailable = hasEmployeePerformanceSnapshot(memberName, monthId)
                          const publishTotal = getTotalPerformance(publishPerformance)
                          const publishTarget = manualValues[manualValueKey(monthId, memberName, 'publish', 'total')]?.target ?? 0
                          const publishCompletion = publishTarget > 0 ? publishTotal / publishTarget : 0
                          const unpublishedSummary = unpublishedSummaries[memberName]
                          const unpublishedStatus = unpublishedStatuses[memberName] ?? 'idle'
                          const unpublishedMetric = unpublishedSummary?.metrics.total
                          const renderCustomerCell = (column: Column): ReactNode => {
                            if (column.key === 'currentPerformance') {
                              return currentAvailable ? formatAmount(currentTotal, customerAmountDisplay) : '—'
                            }
                            if (column.key === 'lastMonthPerformance') {
                              return previousMonthId ? formatAmount(lastMonthTotal, customerAmountDisplay) : '—'
                            }
                            if (CUSTOMER_METRIC_COLUMNS.some((metricColumn) => metricColumn.key === column.key)) {
                              const metricKey = column.key as MetricKey
                              const value = currentPerformance[metricKey]
                              return currentAvailable
                                ? metricKey === 'outsourcingOrderCount'
                                  ? `${value} 单`
                                  : formatAmount(value, customerAmountDisplay)
                                : '—'
                            }
                            if (column.key === 'unpublishedPerformance') {
                              return (
                                <button
                                  type="button"
                                  className="unpublished-amount-button customer-dashboard-unpublished"
                                  onClick={() => openUnpublishedDetails(memberName, 'total', customerDashboardMonth)}
                                  aria-label={`查看${memberName}未发布总业绩订单明细`}
                                >
                                  {unpublishedMetric
                                    ? formatAmount(unpublishedMetric.amount, customerAmountDisplay)
                                    : unpublishedStatus === 'error' ? '快照暂不可用' : unpublishedStatus === 'loading' ? '读取中…' : '加载中…'}
                                  {unpublishedMetric ? <small>{unpublishedMetric.orderCount} 单</small> : null}
                                </button>
                              )
                            }
                            return '—'
                          }
                          return (
                            <div className="customer-dashboard-row" role="row" key={memberName} style={{ gridTemplateColumns }}>
                              <span className="customer-dashboard-person" role="rowheader">
                                <button
                                  type="button"
                                  className="customer-dashboard-person-link"
                                  onClick={() => openCustomerMemberDashboard(memberName)}
                                  aria-label={`打开${memberName}的对客人看板`}
                                >
                                  {memberName}
                                </button>
                                <div className="customer-dashboard-completion">
                                  {publishAvailable && publishTarget > 0 ? (
                                    <>
                                      <b className={publishCompletion > timeProgress
                                        ? 'target-completion-ahead'
                                        : publishCompletion < timeProgress
                                          ? 'target-completion-behind'
                                          : undefined}>
                                        目标完成度 {formatRate(publishCompletion)}
                                      </b>
                                      <small>时间进度 {formatRate(timeProgress)}</small>
                                    </>
                                  ) : null}
                                </div>
                              </span>
                              {visibleCustomerColumns.map((column) => (
                                <span
                                  role="cell"
                                  key={column.key}
                                  className={column.key === 'currentPerformance'
                                      ? 'customer-dashboard-current'
                                      : column.key === 'lastMonthPerformance'
                                        ? 'customer-dashboard-last'
                                        : CUSTOMER_METRIC_COLUMNS.some((metricColumn) => metricColumn.key === column.key)
                                          ? `customer-dashboard-metric ${getCustomerMetricColorClass(column.key)}`
                                          : undefined}
                                >
                                  {renderCustomerCell(column)}
                                </span>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                      </div>
                    </>
                  )
                  })()}
                </>
              ) : key === 'company' ? (() => {
                const dimension = supplementaryDashboardDimensions.company
                const monthId = companyDashboardMonths[dimension]
                const snapshotKey = getCompanyBoardCacheKey('示例开发01', monthId, dimension)
                const snapshot = companyBoardData[snapshotKey]
                const status = companyBoardStatuses[snapshotKey] ?? 'loading'
                const companySort = companyBoardSorts[dimension]
                const visibleCompanyColumns = COMPANY_BOARD_COLUMNS.filter((column) => companyVisibleColumns[dimension].has(column.key))
                const companyDisplayColumns = visibleCompanyColumns.some((column) => column.key === 'total')
                  ? visibleCompanyColumns.flatMap((column) => column.key === 'total'
                    ? [column, { key: 'brandShare' as const, name: '品牌占比' }]
                    : [column])
                  : [{ key: 'brandShare' as const, name: '品牌占比' }, ...visibleCompanyColumns]
                const getCompanySortValue = (company: DashboardCompanyPerformanceResponse['companies'][number], column: SortableColumnKey) => {
                  if (column === 'companyName') return company.companyName
                  if (column === 'companyHalfPastTen') return company.halfPastTen.amount
                  if (column === 'companySelfIncubated') return company.selfIncubated.amount
                  if (column === 'companySigningXiaohongshu') return company.signingXiaohongshu.amount
                  if (column === 'companySigningDouyin') return company.signingDouyin.amount
                  if (column === 'companySigningShipinhao') return company.signingShipinhao.amount
                  if (column === 'companyOutsourcing') return company.outsourcing.amount
                  if (column === 'companyTotal') return company.totalAmount
                  return company.totalOrderCount
                }
                const companies = snapshot?.companies ?? []
                const selectedCompanyName = companyNameFilters[dimension].trim()
                const filteredCompanies = selectedCompanyName
                  ? companies.filter((company) => company.companyName.toLocaleLowerCase().includes(selectedCompanyName.toLocaleLowerCase()))
                  : companies
                const companySummary = filteredCompanies.reduce((summary, company) => ({
                  amount: summary.amount + company.totalAmount,
                  orderCount: summary.orderCount + company.totalOrderCount,
                }), { amount: 0, orderCount: 0 })
                const orderedCompanies = companySort
                  ? [...filteredCompanies].sort((left, right) => {
                    const leftValue = getCompanySortValue(left, companySort.column)
                    const rightValue = getCompanySortValue(right, companySort.column)
                    const difference = typeof leftValue === 'string' && typeof rightValue === 'string'
                      ? leftValue.localeCompare(rightValue, 'zh-CN')
                      : Number(leftValue) - Number(rightValue)
                    return companySort.direction === 'asc' ? difference : -difference
                  })
                  : filteredCompanies
                const companyGridTemplateColumns = [
                  'minmax(60px, .4fr)',
                  'minmax(220px, 1.5fr)',
                  ...companyDisplayColumns.map((column) => column.key === 'orderCount'
                    ? 'minmax(110px, .75fr)'
                    : column.key === 'brandShare'
                      ? 'minmax(110px, .75fr)'
                      : 'minmax(140px, 1fr)'),
                ].join(' ')
                const companyFrozenColumnCount = Math.max(2, companyDisplayColumns.findIndex((column) => column.key === 'total') + 3)
                const companyTableMinWidth = `${280 + companyDisplayColumns.reduce((width, column) => width + (column.key === 'orderCount' || column.key === 'brandShare' ? 110 : 140), 0)}px`
                const companyPeriodLabel = DASHBOARD_FANGPIAN_PERIODS[monthId].label
                const renderCompanySortButton = (column: SortableColumnKey, label: string, secondaryLabel?: string) => (
                  <SortButton
                    column={column}
                    label={label}
                    secondaryLabel={secondaryLabel}
                    sort={companySort}
                    onClick={() => setCompanyBoardSorts((current) => ({
                      ...current,
                      [dimension]: nextSortConfig(current[dimension], column),
                    }))}
                    onReset={() => setCompanyBoardSorts((current) => ({
                      ...current,
                      [dimension]: { ...DEFAULT_COMPANY_BOARD_SORT },
                    }))}
                  />
                )
                const renderCompanyMetricButton = (
                  companyName: string,
                  metricKey: DashboardCompanyMetricKey,
                  amount: number,
                  orderCount: number,
                ) => (
                  <button
                    type="button"
                    className={`company-dashboard-amount${metricKey === 'total' ? ' company-dashboard-total' : ''}`}
                    aria-label={`${companyName}，${COMPANY_METRIC_NAMES[metricKey]}，${formatAmount(amount, companyAmountDisplay)}，${orderCount}单，点击查看订单`}
                    onClick={() => openCompanyOrderDetails(monthId, dimension, metricKey, companyName)}
                  >
                    {formatAmount(amount, companyAmountDisplay)}
                    <small>{orderCount} 单</small>
                  </button>
                )
                return (
                  <>
                    {status === 'loading' ? (
                      <div className="dashboard-data-note">正在读取{companyPeriodLabel}公司业绩快照…</div>
                    ) : null}
                    {status === 'error' ? (
                      <div className="dashboard-data-note dashboard-data-note-error">公司看板快照暂不可用，请等待后台计划刷新。</div>
                    ) : null}
                    {status === 'loaded' && snapshot ? (
                      <>
                        <div className="company-dashboard-summary" aria-label="全部公司汇总数据">
                          <button
                            type="button"
                            aria-label={`全部公司业绩，${formatAmount(Number(companySummary.amount.toFixed(2)), companyAmountDisplay)}，点击查看订单`}
                            onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedCompanyName ? { customerName: selectedCompanyName } : undefined)}
                          >
                            <span>全部公司业绩</span>
                            <b>{formatAmount(Number(companySummary.amount.toFixed(2)), companyAmountDisplay)}</b>
                          </button>
                          <button
                            type="button"
                            aria-label={`全部公司成单单数，${companySummary.orderCount}单，点击查看订单`}
                            onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedCompanyName ? { customerName: selectedCompanyName } : undefined)}
                          >
                            <span>成单单数</span>
                            <b>{companySummary.orderCount} 单</b>
                          </button>
                        </div>
                        <input
                          className="company-dashboard-horizontal-range"
                          type="range"
                          min={0}
                          max={companyTableScrollMax}
                          value={Math.min(companyTableScrollPosition, companyTableScrollMax)}
                          disabled={companyTableScrollMax === 0}
                          aria-label="横向滚动公司看板"
                          onChange={(event) => {
                            const scrollLeft = Number(event.target.value)
                            if (companyTableWrapRef.current) companyTableWrapRef.current.scrollLeft = scrollLeft
                            setCompanyTableScrollPosition(scrollLeft)
                          }}
                        />
                        <div
                          className="customer-dashboard-table-wrap company-dashboard-table-wrap"
                          aria-label={`${companyPeriodLabel}${DIMENSION_NAMES[dimension]}公司业绩`}
                          ref={companyTableWrapRef}
                          onScroll={syncCompanyTableScroll}
                        >
                          <div
                            className="customer-dashboard-table company-dashboard-table"
                            ref={companyTableContentRef}
                            data-company-freeze-count={companyFrozenColumnCount}
                            style={{ minWidth: companyTableMinWidth }}
                          >
                            <div className="customer-dashboard-row customer-dashboard-header" role="row" style={{ gridTemplateColumns: companyGridTemplateColumns }}>
                              <span role="columnheader">序号</span>
                              <span role="columnheader" className="company-dashboard-name-filter-header">
                                {renderCompanySortButton('companyName', '公司名称')}
                                <NameAutocompleteFilter
                                  ariaLabel="筛选公司名称"
                                  placeholder="输入或选择公司名称"
                                  value={companyNameFilters[dimension]}
                                  options={companies.map((company) => ({ name: company.companyName, count: company.totalOrderCount }))}
                                  onChange={(value) => setCompanyNameFilters((current) => ({ ...current, [dimension]: value }))}
                                />
                              </span>
                              {companyDisplayColumns.map((column) => (
                                <span role="columnheader" key={column.key}>
                                  {column.key === 'brandShare'
                                    ? <span className="company-dashboard-share-heading">{column.name}</span>
                                    : renderCompanySortButton(COMPANY_SORT_COLUMNS[column.key], column.name, column.secondaryName)}
                                </span>
                              ))}
                            </div>
                            {orderedCompanies.map((company, index) => (
                              <div className="customer-dashboard-row" role="row" key={company.companyName} style={{ gridTemplateColumns: companyGridTemplateColumns }}>
                                <span className="company-dashboard-index" role="cell">{index + 1}</span>
                                <span className="customer-dashboard-person" role="rowheader">{company.companyName}</span>
                                {companyDisplayColumns.map((column) => {
                                  if (column.key === 'brandShare') {
                                    return (
                                      <div role="cell" key={column.key} className="company-dashboard-share-cell">
                                        <button
                                          type="button"
                                          className="company-dashboard-share-open"
                                          aria-label={`查看${company.companyName}的品牌业绩占比`}
                                          onClick={() => setCompanyBrandShareContext({ kind: 'brands', monthId, dimension, companyName: company.companyName, employeeName: '示例开发01' })}
                                        >
                                          查看
                                        </button>
                                      </div>
                                    )
                                  }
                                  if (column.key === 'orderCount') {
                                    return (
                                      <div role="cell" key={column.key}>
                                        <button
                                          type="button"
                                          className="company-dashboard-order-count"
                                          aria-label={`${company.companyName}，全部订单，${company.totalOrderCount}单，点击查看订单`}
                                          onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', company.companyName)}
                                        >
                                          {company.totalOrderCount} 单
                                        </button>
                                      </div>
                                    )
                                  }
                                  const metric = column.key === 'total'
                                    ? { amount: company.totalAmount, orderCount: company.totalOrderCount }
                                    : company[column.key]
                                  return (
                                    <div role="cell" key={column.key}>
                                      {renderCompanyMetricButton(company.companyName, column.key, metric.amount, metric.orderCount)}
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                            {orderedCompanies.length === 0 ? (
                              <div className="company-dashboard-empty">{selectedCompanyName ? '没有符合筛选条件的公司订单。' : '该方片月没有符合条件的公司订单。'}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="company-dashboard-snapshot-note">
                          结款商务：示例开发01 · 自孵十点半单独统计 · 发布维度外采按结款时间 · 快照更新时间：{snapshot.snapshotUpdatedAt
                            ? new Intl.DateTimeFormat('zh-CN', {
                              timeZone: 'Asia/Shanghai',
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(snapshot.snapshotUpdatedAt))
                            : '未知'}
                        </div>
                      </>
                    ) : null}
                  </>
                )
              })() : key === 'brand' ? (() => {
                const dimension = supplementaryDashboardDimensions.brand
                const monthId = brandDashboardMonths[dimension]
                const snapshotKey = `${monthId}:${dimension}`
                const snapshot = brandBoardData[snapshotKey]
                const status = brandBoardStatuses[snapshotKey] ?? 'loading'
                const brandSort = brandBoardSorts[dimension]
                const visibleBrandColumns = COMPANY_BOARD_COLUMNS.filter((column) => brandVisibleColumns[dimension].has(column.key))
                const brandDisplayColumns = visibleBrandColumns.some((column) => column.key === 'total')
                  ? visibleBrandColumns.flatMap((column) => column.key === 'total'
                    ? [column, { key: 'companyShare' as const, name: '公司占比' }]
                    : [column])
                  : [{ key: 'companyShare' as const, name: '公司占比' }, ...visibleBrandColumns]
                const getBrandSortValue = (brand: DashboardBrandPerformanceResponse['brands'][number], column: SortableColumnKey) => {
                  if (column === 'brandName') return brand.brandName
                  if (column === 'companyHalfPastTen') return brand.halfPastTen.amount
                  if (column === 'companySelfIncubated') return brand.selfIncubated.amount
                  if (column === 'companySigningXiaohongshu') return brand.signingXiaohongshu.amount
                  if (column === 'companySigningDouyin') return brand.signingDouyin.amount
                  if (column === 'companySigningShipinhao') return brand.signingShipinhao.amount
                  if (column === 'companyOutsourcing') return brand.outsourcing.amount
                  if (column === 'companyTotal') return brand.totalAmount
                  return brand.totalOrderCount
                }
                const brands = snapshot?.brands ?? []
                const selectedBrandName = brandNameFilters[dimension].trim()
                const filteredBrands = selectedBrandName
                  ? brands.filter((brand) => brand.brandName.toLocaleLowerCase().includes(selectedBrandName.toLocaleLowerCase()))
                  : brands
                const brandSummary = filteredBrands.reduce((summary, brand) => ({
                  amount: summary.amount + brand.totalAmount,
                  orderCount: summary.orderCount + brand.totalOrderCount,
                }), { amount: 0, orderCount: 0 })
                const orderedBrands = brandSort
                  ? [...filteredBrands].sort((left, right) => {
                    const leftValue = getBrandSortValue(left, brandSort.column)
                    const rightValue = getBrandSortValue(right, brandSort.column)
                    const difference = typeof leftValue === 'string' && typeof rightValue === 'string'
                      ? leftValue.localeCompare(rightValue, 'zh-CN')
                      : Number(leftValue) - Number(rightValue)
                    return brandSort.direction === 'asc' ? difference : -difference
                  })
                  : filteredBrands
                const brandGridTemplateColumns = [
                  'minmax(60px, .4fr)',
                  'minmax(220px, 1.5fr)',
                  ...brandDisplayColumns.map((column) => column.key === 'orderCount'
                    ? 'minmax(110px, .75fr)'
                    : column.key === 'companyShare'
                      ? 'minmax(110px, .75fr)'
                      : 'minmax(140px, 1fr)'),
                ].join(' ')
                const brandFrozenColumnCount = Math.max(2, brandDisplayColumns.findIndex((column) => column.key === 'total') + 3)
                const brandTableMinWidth = `${280 + brandDisplayColumns.reduce((width, column) => width + (column.key === 'orderCount' || column.key === 'companyShare' ? 110 : 140), 0)}px`
                const brandPeriodLabel = DASHBOARD_FANGPIAN_PERIODS[monthId].label
                const renderBrandSortButton = (column: SortableColumnKey, label: string, secondaryLabel?: string) => (
                  <SortButton
                    column={column}
                    label={label}
                    secondaryLabel={secondaryLabel}
                    sort={brandSort}
                    onClick={() => setBrandBoardSorts((current) => ({
                      ...current,
                      [dimension]: nextSortConfig(current[dimension], column),
                    }))}
                    onReset={() => setBrandBoardSorts((current) => ({
                      ...current,
                      [dimension]: { ...DEFAULT_COMPANY_BOARD_SORT },
                    }))}
                  />
                )
                const renderBrandMetricButton = (
                  brandName: string,
                  metricKey: DashboardCompanyMetricKey,
                  amount: number,
                  orderCount: number,
                ) => (
                  <button
                    type="button"
                    className={`company-dashboard-amount${metricKey === 'total' ? ' company-dashboard-total' : ''}`}
                    aria-label={`${brandName}，${COMPANY_METRIC_NAMES[metricKey]}，${formatAmount(amount, companyAmountDisplay)}，${orderCount}单，点击查看订单`}
                    onClick={() => openCompanyOrderDetails(monthId, dimension, metricKey, undefined, brandName)}
                  >
                    {formatAmount(amount, companyAmountDisplay)}
                    <small>{orderCount} 单</small>
                  </button>
                )
                return (
                  <>
                    {status === 'loading' ? (
                      <div className="dashboard-data-note">正在读取{brandPeriodLabel}品牌业绩快照…</div>
                    ) : null}
                    {status === 'error' ? (
                      <div className="dashboard-data-note dashboard-data-note-error">品牌看板快照暂不可用，请确认公司订单快照已生成。</div>
                    ) : null}
                    {status === 'loaded' && snapshot ? (
                      <>
                        <div className="company-dashboard-summary" aria-label="全部品牌汇总数据">
                          <button
                            type="button"
                            aria-label={`全部品牌业绩，${formatAmount(Number(brandSummary.amount.toFixed(2)), companyAmountDisplay)}，点击查看订单`}
                            onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedBrandName ? { brandName: selectedBrandName } : undefined)}
                          >
                            <span>全部品牌业绩</span>
                            <b>{formatAmount(Number(brandSummary.amount.toFixed(2)), companyAmountDisplay)}</b>
                          </button>
                          <button
                            type="button"
                            aria-label={`全部品牌订单数，${brandSummary.orderCount}单，点击查看订单`}
                            onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, undefined, selectedBrandName ? { brandName: selectedBrandName } : undefined)}
                          >
                            <span>订单数</span>
                            <b>{brandSummary.orderCount} 单</b>
                          </button>
                        </div>
                        <input
                          className="company-dashboard-horizontal-range"
                          type="range"
                          min={0}
                          max={companyTableScrollMax}
                          value={Math.min(companyTableScrollPosition, companyTableScrollMax)}
                          disabled={companyTableScrollMax === 0}
                          aria-label="横向滚动品牌看板"
                          onChange={(event) => {
                            const scrollLeft = Number(event.target.value)
                            if (companyTableWrapRef.current) companyTableWrapRef.current.scrollLeft = scrollLeft
                            setCompanyTableScrollPosition(scrollLeft)
                          }}
                        />
                        <div
                          className="customer-dashboard-table-wrap company-dashboard-table-wrap"
                          aria-label={`${brandPeriodLabel}${DIMENSION_NAMES[dimension]}品牌业绩`}
                          ref={companyTableWrapRef}
                          onScroll={syncCompanyTableScroll}
                        >
                          <div
                            className="customer-dashboard-table company-dashboard-table"
                            ref={companyTableContentRef}
                            data-company-freeze-count={brandFrozenColumnCount}
                            style={{ minWidth: brandTableMinWidth }}
                          >
                            <div className="customer-dashboard-row customer-dashboard-header" role="row" style={{ gridTemplateColumns: brandGridTemplateColumns }}>
                              <span role="columnheader">序号</span>
                              <span role="columnheader" className="company-dashboard-name-filter-header">
                                {renderBrandSortButton('brandName', '品牌名称')}
                                <NameAutocompleteFilter
                                  ariaLabel="筛选品牌名称"
                                  placeholder="输入或选择品牌名称"
                                  value={brandNameFilters[dimension]}
                                  options={brands.map((brand) => ({ name: brand.brandName, count: brand.totalOrderCount }))}
                                  onChange={(value) => setBrandNameFilters((current) => ({ ...current, [dimension]: value }))}
                                />
                              </span>
                              {brandDisplayColumns.map((column) => (
                                <span role="columnheader" key={column.key}>
                                  {column.key === 'companyShare'
                                    ? <span className="company-dashboard-share-heading">{column.name}</span>
                                    : renderBrandSortButton(COMPANY_SORT_COLUMNS[column.key], column.name, column.secondaryName)}
                                </span>
                              ))}
                            </div>
                            {orderedBrands.map((brand, index) => (
                              <div className="customer-dashboard-row" role="row" key={brand.brandName} style={{ gridTemplateColumns: brandGridTemplateColumns }}>
                                <span className="company-dashboard-index" role="cell">{index + 1}</span>
                                <span className="customer-dashboard-person" role="rowheader">{brand.brandName}</span>
                                {brandDisplayColumns.map((column) => {
                                  if (column.key === 'companyShare') {
                                    return (
                                      <div role="cell" key={column.key} className="company-dashboard-share-cell">
                                        <button
                                          type="button"
                                          className="company-dashboard-share-open"
                                          aria-label={`查看${brand.brandName}的公司业绩占比`}
                                          onClick={() => setCompanyBrandShareContext({ kind: 'companies', monthId, dimension, brandName: brand.brandName, employeeName: '示例开发01' })}
                                        >
                                          查看
                                        </button>
                                      </div>
                                    )
                                  }
                                  if (column.key === 'orderCount') {
                                    return (
                                      <div role="cell" key={column.key}>
                                        <button
                                          type="button"
                                          className="company-dashboard-order-count"
                                          aria-label={`${brand.brandName}，全部订单，${brand.totalOrderCount}单，点击查看订单`}
                                          onClick={() => openCompanyOrderDetails(monthId, dimension, 'total', undefined, brand.brandName)}
                                        >
                                          {brand.totalOrderCount} 单
                                        </button>
                                      </div>
                                    )
                                  }
                                  const metric = column.key === 'total'
                                    ? { amount: brand.totalAmount, orderCount: brand.totalOrderCount }
                                    : brand[column.key]
                                  return (
                                    <div role="cell" key={column.key}>
                                      {renderBrandMetricButton(brand.brandName, column.key, metric.amount, metric.orderCount)}
                                    </div>
                                  )
                                })}
                              </div>
                            ))}
                            {orderedBrands.length === 0 ? (
                              <div className="company-dashboard-empty">{selectedBrandName ? '没有符合筛选条件的品牌订单。' : '该方片月没有符合条件的品牌订单。'}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="company-dashboard-snapshot-note">
                          结款商务：示例开发01 · 品牌汇总复用公司订单快照 · 时间口径与公司看板一致 · 快照更新时间：{snapshot.snapshotUpdatedAt
                            ? new Intl.DateTimeFormat('zh-CN', {
                              timeZone: 'Asia/Shanghai',
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(snapshot.snapshotUpdatedAt))
                            : '未知'}
                        </div>
                      </>
                    ) : null}
                  </>
                )
              })() : (
                <div className="supplementary-dashboard-placeholder">
                  {DIMENSION_NAMES[supplementaryDashboardDimensions[key]]}模块内容待补充
                </div>
              )}
            </article>
          )) : (
            <article className="supplementary-dashboard-card target-management-dashboard-card">
              <div className="supplementary-dashboard-tabs" role="tablist" aria-label="示例开发01扩展看板类型">
                {SUPPLEMENTARY_DASHBOARDS.map((dashboard) => (
                  <button
                    key={dashboard.key}
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className="supplementary-dashboard-tab"
                    onClick={() => {
                      setTargetSplitBoardActive(false)
                      setTargetSplitImportOpen(false)
                      setActiveSupplementaryDashboard(dashboard.key)
                      if (dashboard.key === 'customer') setActiveCustomerDashboardTab(null)
                    }}
                  >
                    {dashboard.tabLabel}
                  </button>
                ))}
                <button type="button" role="tab" aria-selected="true" className="supplementary-dashboard-tab active">
                  听说你还不会拆？
                </button>
              </div>
              <div className="supplementary-dashboard-head company-dashboard-head">
                {renderTargetSplitBoardHeader()}
              </div>
              {renderTargetSplitBoardContent()}
            </article>
          )}
        </section>
      ) : null}

      {wangYueEntityTrend ? (() => {
        const { employeeName, board, dimension, monthId } = wangYueEntityTrend
        const monthIndex = DASHBOARD_MONTH_IDS.indexOf(monthId)
        const previousMonthId = monthIndex > 0 ? DASHBOARD_MONTH_IDS[monthIndex - 1] : null
        const currentKey = board === 'company'
          ? getCompanyBoardCacheKey(employeeName, monthId, dimension)
          : getBrandBoardCacheKey(employeeName, monthId, dimension)
        const previousKey = previousMonthId === null
          ? null
          : board === 'company'
            ? getCompanyBoardCacheKey(employeeName, previousMonthId, dimension)
            : getBrandBoardCacheKey(employeeName, previousMonthId, dimension)
        const currentStatus = board === 'company' ? companyBoardStatuses[currentKey] : brandBoardStatuses[currentKey]
        const previousStatus = previousKey === null
          ? undefined
          : board === 'company' ? companyBoardStatuses[previousKey] : brandBoardStatuses[previousKey]
        const getEntities = (key: string): Array<{ name: string; amount: number }> => {
          if (board === 'company') {
            return (companyBoardData[key]?.companies ?? []).map((company) => ({
              name: company.companyName,
              amount: company.totalAmount,
            }))
          }
          return (brandBoardData[key]?.brands ?? []).map((brand) => ({
            name: brand.brandName,
            amount: brand.totalAmount,
          }))
        }
        const nameFilter = board === 'company'
          ? wangYueCompanyNameFilters[dimension].trim().toLocaleLowerCase()
          : wangYueBrandNameFilters[dimension].trim().toLocaleLowerCase()
        const currentEntities = getEntities(currentKey).filter((entity) =>
          !nameFilter || entity.name.toLocaleLowerCase().includes(nameFilter),
        )
        const previousEntities = previousKey === null ? [] : getEntities(previousKey).filter((entity) =>
          !nameFilter || entity.name.toLocaleLowerCase().includes(nameFilter),
        )
        const trendValues = new Map<string, { current: number; previous: number }>()
        for (const entity of currentEntities) {
          trendValues.set(entity.name, { current: entity.amount, previous: 0 })
        }
        for (const entity of previousEntities) {
          const values = trendValues.get(entity.name) ?? { current: 0, previous: 0 }
          values.previous = entity.amount
          trendValues.set(entity.name, values)
        }
        const trendRows = [...trendValues.entries()].sort((left, right) =>
          Math.max(right[1].current, right[1].previous) - Math.max(left[1].current, left[1].previous),
        )
        const trendSeries: ChartSeries[] = [
          ...(currentStatus === 'loaded' ? [{
            name: `${DASHBOARD_FANGPIAN_PERIODS[monthId].label}总业绩`,
            color: '#2f5cff',
            kind: 'bar' as const,
            values: trendRows.map(([, values]) => values.current),
          }] : []),
          ...(previousMonthId !== null && previousStatus === 'loaded' ? [{
            name: `${DASHBOARD_FANGPIAN_PERIODS[previousMonthId].label}总业绩`,
            color: '#8b5cf6',
            kind: 'bar' as const,
            values: trendRows.map(([, values]) => values.previous),
          }] : []),
        ]
        const boardName = board === 'company' ? '公司' : '品牌'
        return (
          <div className="chart-modal-backdrop" key="customer-entity-trend" onClick={() => setWangYueEntityTrend(null)}>
            <div
              className="chart-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-entity-trend-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <div>
                  <h3 id="customer-entity-trend-title">{DASHBOARD_FANGPIAN_PERIODS[monthId].label} · {DIMENSION_NAMES[dimension]} · {employeeName}{boardName}业绩趋势</h3>
                  <p className="customer-dashboard-chart-note">按{boardName}对比当前与上一个方片月的总业绩，使用已保存的快照</p>
                </div>
                <button type="button" onClick={() => setWangYueEntityTrend(null)}>关闭</button>
              </div>
              {currentStatus === 'loading' ? <div className="dashboard-data-note">正在读取当前方片月快照…</div> : null}
              {currentStatus === 'error' ? <div className="dashboard-data-note dashboard-data-note-error">当前方片月快照暂不可用。</div> : null}
              {previousMonthId !== null && previousStatus === 'loading' ? <div className="dashboard-data-note">正在读取上一个方片月快照…</div> : null}
              {previousMonthId !== null && previousStatus === 'error' ? <div className="dashboard-data-note dashboard-data-note-error">上一个方片月快照暂不可用。</div> : null}
              {trendSeries.length > 0 && trendRows.length > 0 ? (
                <TrendChart
                  series={trendSeries}
                  categoryLabels={trendRows.map(([name]) => name)}
                  formatValue={(value) => formatAmount(value, wangYueEntityAmountDisplay)}
                  formatLineValue={(value) => formatRate(value)}
                />
              ) : currentStatus === 'loaded' && (previousMonthId === null || previousStatus === 'loaded') ? (
                <div className="supplementary-dashboard-placeholder">当前筛选条件下没有可展示的业绩趋势</div>
              ) : null}
              {previousMonthId === null ? <div className="dashboard-data-note">当前是可选范围内最早的方片月，没有更早月份可对比。</div> : null}
            </div>
          </div>
        )
      })() : null}

      {selectedName === '示例开发01' && activeSupplementaryDashboard === 'customer' && customerChartOpen ? (() => {
        const dimension = supplementaryDashboardDimensions.customer
        const monthId = customerDashboardMonth
        const previousMonthId = monthId > 147 ? (monthId - 1) as DashboardMonthId : null
        const currentAvailable = CUSTOMER_DASHBOARD_MEMBERS.every((memberName) =>
          hasEmployeePerformanceSnapshot(memberName, monthId),
        )
        const currentValues = CUSTOMER_DASHBOARD_MEMBERS.map((memberName) =>
          getTotalPerformance(getDisplayedPerformance(memberName, dimension, monthId)),
        )
        const previousValues = previousMonthId
          ? CUSTOMER_DASHBOARD_MEMBERS.map((memberName) => getTotalPerformance(getDisplayedPerformance(memberName, dimension, previousMonthId)))
          : []
        const trendSeries: ChartSeries[] = [
          ...(customerChartFilters.current && currentAvailable ? [{
            name: '本月业绩',
            color: '#2f5cff',
            kind: 'bar' as const,
            values: currentValues,
          }] : []),
          ...(customerChartFilters.lastMonth && previousMonthId ? [{
            name: '上月业绩',
            color: '#f59e0b',
            kind: 'bar' as const,
            values: previousValues,
          }] : []),
          ...(dimension === 'publish' && customerChartFilters.completion && currentAvailable ? [{
            name: '目标完成度',
            color: '#12b76a',
            kind: 'line' as const,
            values: CUSTOMER_DASHBOARD_MEMBERS.map((memberName, index) => {
              const target = manualValues[manualValueKey(monthId, memberName, dimension, 'total')]?.target ?? 0
              return target > 0 ? currentValues[index] / target : 0
            }),
          }] : []),
        ]
        return (
          <div className="chart-modal-backdrop" key="customer-dashboard-chart" onClick={() => setCustomerChartOpen(false)}>
            <div
              className="chart-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-dashboard-chart-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <div>
                  <h3 id="customer-dashboard-chart-title">{DASHBOARD_FANGPIAN_PERIODS[monthId].label} · {DIMENSION_NAMES[dimension]} · 对客人业绩趋势</h3>
                  <p className="customer-dashboard-chart-note">按对客人员比较本月与上月总业绩</p>
                </div>
                <div className="chart-controls modal-controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={customerChartFilters.current}
                      disabled={!currentAvailable}
                      onChange={() => setCustomerChartFilters((current) => ({ ...current, current: !current.current }))}
                    />
                    本月业绩
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={customerChartFilters.lastMonth}
                      disabled={!previousMonthId}
                      onChange={() => setCustomerChartFilters((current) => ({ ...current, lastMonth: !current.lastMonth }))}
                    />
                    上月业绩
                  </label>
                  {dimension === 'publish' ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={customerChartFilters.completion}
                        disabled={!currentAvailable}
                        onChange={() => setCustomerChartFilters((current) => ({ ...current, completion: !current.completion }))}
                      />
                      目标完成度
                    </label>
                  ) : null}
                  <button type="button" onClick={() => setCustomerChartOpen(false)}>关闭</button>
                </div>
              </div>
              {!currentAvailable ? <div className="dashboard-data-note">本月快照未齐，为避免显示不完整数据，暂不绘制本月业绩和目标完成度。</div> : null}
              {trendSeries.length > 0 ? (
                <TrendChart
                  series={trendSeries}
                  categoryLabels={[...CUSTOMER_DASHBOARD_MEMBERS]}
                  formatValue={(value) => formatAmount(value, customerAmountDisplay)}
                  formatLineValue={(value) => formatRate(value)}
                />
              ) : <div className="supplementary-dashboard-placeholder">当前没有可展示的趋势数据</div>}
            </div>
          </div>
        )
      })() : null}

      {DIMENSIONS.map((dimension) => {
        if (!chartOpen[dimension]) return null
        const monthId = selectedMonths[dimension]
        const currentAvailable = hasCurrentMonthPerformance(monthId)
        const currentPerformance = getDisplayedPerformance(selectedName, dimension, monthId)
        const previousPerformance = getPreviousMonthPerformance(selectedName, dimension, monthId)
        return (
        <div className="chart-modal-backdrop" key={dimension}>
          <div className="chart-modal">
            <div className="modal-head">
              <h3>{DASHBOARD_FANGPIAN_PERIODS[monthId].label} · {DIMENSION_NAMES[dimension]}业绩趋势</h3>
              <div className="chart-controls modal-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={chartFilters[dimension].current}
                    onChange={() => toggleChartFilter(dimension, 'current')}
                  />
                  本月业绩
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={chartFilters[dimension].lastMonth}
                    onChange={() => toggleChartFilter(dimension, 'lastMonth')}
                  />
                  上月业绩
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={chartFilters[dimension].completion}
                    onChange={() => toggleChartFilter(dimension, 'completion')}
                  />
                  目标完成度
                </label>
                <button onClick={() => setChartOpen((current) => ({ ...current, [dimension]: false }))}>
                  关闭
                </button>
              </div>
            </div>
            <TrendChart
              series={[
                ...(chartFilters[dimension].current && currentAvailable ? [{
                  name: '本月业绩',
                  color: '#2f5cff',
                  kind: 'bar',
                  values: SUB_METRICS.map(({ key }) => getMetricValue(currentPerformance, key)),
                }] : []),
                ...(chartFilters[dimension].lastMonth ? [{
                  name: '上月业绩',
                  color: '#f59e0b',
                  kind: 'bar',
                  values: SUB_METRICS.map(({ key }) => getMetricValue(previousPerformance, key)),
                }] : []),
                ...(chartFilters[dimension].completion && currentAvailable ? [{
                  name: '目标完成度',
                  color: '#12b76a',
                  kind: 'line',
                  values: SUB_METRICS.map(({ key }) => {
                    const target = manualValues[manualValueKey(monthId, selectedName, dimension, key)]?.target ?? 0
                    return target > 0 ? getMetricValue(currentPerformance, key) / target : 0
                  }),
                }] : []),
              ]}
              formatValue={(value) => value.toLocaleString('zh-CN')}
              formatLineValue={(value) => formatRate(value)}
            />
          </div>
        </div>
        )
      })}
      {unpublishedModalOpen && supportsUnpublishedMetrics(unpublishedModalEmployeeName) ? (
        <div className="chart-modal-backdrop" onClick={() => setUnpublishedModalOpen(false)}>
          <div
            className="chart-modal unpublished-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unpublished-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 id="unpublished-modal-title">
                  {unpublishedModalEmployeeName} · {UNPUBLISHED_METRIC_NAMES[unpublishedSelectedMetric]} · 未发布订单明细
                </h3>
                <p>
                  {unpublishedDetails?.periodLabel ?? unpublishedModalSummary?.periodLabel ?? '方片月6月至当月'} · 成单时间 · 状态：未发布
                  {unpublishedDetails?.snapshotUpdatedAt
                    ? ` · 快照更新于${new Intl.DateTimeFormat('zh-CN', {
                      timeZone: 'Asia/Shanghai',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(unpublishedDetails.snapshotUpdatedAt))}`
                    : ''}
                </p>
              </div>
              <button onClick={() => setUnpublishedModalOpen(false)}>关闭</button>
            </div>
            <div className="unpublished-summary">
              {unpublishedSelectedMetric === 'outsourcingOrderCount' ? (
                <span>{hasAppliedUnpublishedFilters ? '筛选后外采单数（全量）' : '未发布外采单数（全量）'} <b>{unpublishedDetails ? `${unpublishedDetails.orderCount} 单` : '—'}</b></span>
              ) : (
                <span>{hasAppliedUnpublishedFilters ? '筛选后业绩（全量）' : '未发布业绩（全量）'} <b>{unpublishedDetails ? formatAmount(unpublishedDetails.amount, amountDisplay.publish) : '—'}</b></span>
              )}
              {unpublishedSelectedMetric !== 'outsourcingOrderCount' ? (
                <span>{hasAppliedUnpublishedFilters ? '筛选后订单数（全量）' : '订单数（全量）'} <b>{unpublishedDetails?.orderCount ?? '—'}</b></span>
              ) : null}
              <span>取数口径 <b>
                {unpublishedSelectedMetric === 'halfPastTen' || unpublishedSelectedMetric === 'selfIncubated'
                  ? '成交金额'
                  : unpublishedSelectedMetric === 'outsourcingOrderCount' ? '订单数' : '公司收益'}
              </b></span>
            </div>
            {unpublishedDetailsError ? <div className="unpublished-error">{unpublishedDetailsError}</div> : null}
            <div className="unpublished-filter-actions">
              <span>金额与单数汇总覆盖全部匹配订单；明细每页可选50/100/200条</span>
              <div>
                <button type="button" disabled={unpublishedDetailsLoading} onClick={applyUnpublishedFilters}>筛选</button>
                <button type="button" disabled={unpublishedDetailsLoading} onClick={clearUnpublishedFilters}>重置</button>
              </div>
            </div>
            <input
              className="unpublished-table-horizontal-range"
              type="range"
              min={0}
              max={unpublishedTableScrollMax}
              value={Math.min(unpublishedTableScrollPosition, unpublishedTableScrollMax)}
              disabled={unpublishedTableScrollMax === 0}
              aria-label="横向滚动订单明细"
              onChange={(event) => {
                const scrollLeft = Number(event.target.value)
                if (unpublishedTableWrapRef.current) {
                  unpublishedTableWrapRef.current.scrollLeft = scrollLeft
                }
                setUnpublishedTableScrollPosition(scrollLeft)
              }}
            />
            <div
              className="unpublished-table-wrap"
              ref={unpublishedTableWrapRef}
              onScroll={syncUnpublishedTableScroll}
            >
              <table className="unpublished-table" ref={unpublishedTableRef}>
                <thead>
                  <tr>
                    <th>订单编号</th>
                    <th>公司名称</th>
                    <th>品牌</th>
                    <th>博主</th>
                    <th>平台</th>
                    <th>订单状态</th>
                    <th>成单时间</th>
                    <th>成交金额</th>
                    <th>公司收益</th>
                    <th>提报人</th>
                    <th>商务对客人</th>
                    <th>结款商务</th>
                  </tr>
                  <tr className="unpublished-filter-row">
                    <th>{renderUnpublishedFilterInput('orderCode', '订单编号')}</th>
                    <th>{renderUnpublishedFilterInput('customerName', '公司名称')}</th>
                    <th>{renderUnpublishedFilterInput('brandName', '品牌')}</th>
                    <th>{renderUnpublishedFilterInput('creatorName', '博主')}</th>
                    <th>{renderUnpublishedFilterInput('platformName', '平台')}</th>
                    <th>{renderUnpublishedFilterInput('statusText', '订单状态')}</th>
                    <th>
                      <div className="unpublished-date-filter-switch">
                        <button
                          className="unpublished-date-filter-toggle"
                          type="button"
                          aria-label={unpublishedDateFilterMode === 'fangpian-month' ? '切换到日期范围筛选' : '切换到方片月筛选'}
                          title={unpublishedDateFilterMode === 'fangpian-month' ? '切换到日期范围筛选' : '切换到方片月筛选'}
                          disabled={unpublishedDetailsLoading}
                          onClick={toggleUnpublishedDateFilterMode}
                        >
                          ⇄
                        </button>
                        {unpublishedDateFilterMode === 'fangpian-month' ? (
                          <select
                            value={unpublishedMonthFilter ?? ''}
                            aria-label="按成单方片月筛选"
                            disabled={unpublishedDetailsLoading}
                            onChange={(event) => {
                              const monthId = event.target.value ? Number(event.target.value) : null
                              setUnpublishedMonthFilter(monthId)
                              loadUnpublishedPage(1, monthId)
                            }}
                          >
                            <option value="">全部方片月</option>
                            {(unpublishedModalSummary?.availableMonths ?? unpublishedDetails?.availableMonths ?? []).map((month) => (
                              <option key={month.monthId} value={month.monthId}>{month.label}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="unpublished-filter-range date">
                            {renderUnpublishedFilterInput('orderDateFrom', '开始日期', 'date')}
                            {renderUnpublishedFilterInput('orderDateTo', '结束日期', 'date')}
                          </div>
                        )}
                      </div>
                    </th>
                    <th>
                      <div className="unpublished-filter-range">
                        {renderUnpublishedFilterInput('orderMoneyMin', '最低', 'number')}
                        {renderUnpublishedFilterInput('orderMoneyMax', '最高', 'number')}
                      </div>
                    </th>
                    <th>
                      <div className="unpublished-filter-range">
                        {renderUnpublishedFilterInput('incomeMoneyMin', '最低', 'number')}
                        {renderUnpublishedFilterInput('incomeMoneyMax', '最高', 'number')}
                      </div>
                    </th>
                    <th>{renderUnpublishedPersonFilter('reporterName', '提报人')}</th>
                    <th>{renderUnpublishedPersonFilter('customerFacingBusinessName', '商务对客人')}</th>
                    <th>{renderUnpublishedPersonFilter('businessName', '结款商务')}</th>
                  </tr>
                </thead>
                <tbody>
                  {unpublishedDetails?.orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.orderCode || order.id}</td>
                      <td>{order.customerName || '—'}</td>
                      <td>{order.brandName || '—'}</td>
                      <td>{order.creatorName || '—'}</td>
                      <td>{order.platformName || '—'}</td>
                      <td>{order.statusText}</td>
                      <td>{order.orderDate
                        ? new Date(order.orderDate * 1000).toLocaleString('zh-CN', {
                            timeZone: 'Asia/Shanghai',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}</td>
                      <td>{formatAmount(order.orderMoney, amountDisplay.publish)}</td>
                      <td>{formatAmount(order.incomeMoney, amountDisplay.publish)}</td>
                      <td>{order.reporterName || '—'}</td>
                      <td>{order.customerFacingBusinessName || '—'}</td>
                      <td>{order.businessName || '—'}</td>
                    </tr>
                  ))}
                  {!unpublishedDetailsLoading && !unpublishedDetailsError && unpublishedDetails?.orders.length === 0 ? (
                    <tr><td className="unpublished-empty" colSpan={12}>没有符合条件的订单</td></tr>
                  ) : null}
                </tbody>
              </table>
              {unpublishedDetailsLoading ? <div className="unpublished-table-state">正在读取订单明细…</div> : null}
            </div>
            <div className="unpublished-pagination">
              <span>共 {unpublishedDetails?.orderCount ?? 0} 单 · 第 {unpublishedDetails?.page ?? 1} / {Math.max(1, unpublishedDetails?.totalPages ?? 1)} 页</span>
              <div>
                <label className="unpublished-page-size">
                  每页
                  <select
                    value={unpublishedPageSize}
                    disabled={unpublishedDetailsLoading}
                    onChange={(event) => {
                      const pageSize = Number(event.target.value) as UnpublishedPageSize
                      setUnpublishedPageSize(pageSize)
                      loadUnpublishedPage(1, unpublishedMonthFilter, unpublishedSelectedMetric, unpublishedAppliedFilters, unpublishedModalEmployeeName, pageSize)
                    }}
                  >
                    {UNPUBLISHED_PAGE_SIZES.map((pageSize) => <option key={pageSize} value={pageSize}>{pageSize}条</option>)}
                  </select>
                </label>
                <button
                  disabled={unpublishedDetailsLoading || !unpublishedDetails || unpublishedDetails.page <= 1}
                  onClick={() => loadUnpublishedPage((unpublishedDetails?.page ?? 1) - 1)}
                >上一页</button>
                <button
                  disabled={unpublishedDetailsLoading || !unpublishedDetails || unpublishedDetails.page >= unpublishedDetails.totalPages}
                  onClick={() => loadUnpublishedPage((unpublishedDetails?.page ?? 1) + 1)}
                >下一页</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {companyOrderModal ? (
        <CompanyOrdersModal
          key={`${companyOrderModal.monthId}:${companyOrderModal.dimension}:${companyOrderModal.metricKey}:${companyOrderModal.companyName ?? 'all'}:${companyOrderModal.brandName ?? ''}:${companyOrderModal.employeeName ?? ''}:${companyOrderModal.metricLabel ?? ''}`}
          context={companyOrderModal}
          amountDisplay={companyOrderModal.source === 'target'
            ? amountDisplay[companyOrderModal.dimension]
            : customerAmountDisplay}
          onClose={() => setCompanyOrderModal(null)}
        />
      ) : null}
      {companyBrandShareContext ? (
        <CompanyBrandShareModal
          key={`${companyBrandShareContext.kind}:${companyBrandShareContext.monthId}:${companyBrandShareContext.dimension}:${companyBrandShareContext.kind === 'brands' ? companyBrandShareContext.companyName : companyBrandShareContext.brandName}`}
          context={companyBrandShareContext}
          amountDisplay={customerAmountDisplay}
          onClose={() => setCompanyBrandShareContext(null)}
          onItemSelect={(itemName) => {
            const context = companyBrandShareContext
            if (!context) return
            setCompanyBrandShareContext(null)
            if (context.kind === 'brands') {
              openCompanyOrderDetails(
                context.monthId,
                context.dimension,
                'total',
                context.companyName,
                itemName,
                undefined,
                context.employeeName,
              )
            } else {
              openCompanyOrderDetails(
                context.monthId,
                context.dimension,
                'total',
                itemName,
                context.brandName,
                undefined,
                context.employeeName,
              )
            }
          }}
        />
      ) : null}
      {targetManagementSubmissionDetailsContext ? (
        <TargetManagementSubmissionDetailsModal
          key={`${targetManagementSubmissionDetailsContext.employeeName}:${targetManagementSubmissionDetailsContext.monthId}:${targetManagementSubmissionDetailsContext.companyName}:${targetManagementSubmissionDetailsContext.platformName}:${targetManagementSubmissionDetailsContext.brandName}`}
          employeeName={targetManagementSubmissionDetailsContext.employeeName}
          monthId={targetManagementSubmissionDetailsContext.monthId}
          monthOptions={targetManagementSubmissionMonthOptions}
          monthLabel={DASHBOARD_FANGPIAN_PERIODS[targetManagementSubmissionDetailsContext.monthId as DashboardMonthId]?.label ?? `方片月${targetManagementSubmissionDetailsContext.monthId - 139}月`}
          companyName={targetManagementSubmissionDetailsContext.companyName}
          platformName={targetManagementSubmissionDetailsContext.platformName}
          brandName={targetManagementSubmissionDetailsContext.brandName}
          expectedCount={targetManagementSubmissionDetailsContext.count}
          details={targetManagementSubmissionSnapshots[JSON.stringify([targetManagementSubmissionDetailsContext.employeeName, targetManagementSubmissionDetailsContext.monthId])]?.tableCountDetails
            ?? wangYueTargetManagementActualsByMonth[getTargetManagementActualKey(targetManagementSubmissionDetailsContext.employeeName, targetManagementSubmissionDetailsContext.monthId)]?.tableCountDetails
            ?? []}
          detailsAvailable={targetManagementSubmissionSnapshots[JSON.stringify([targetManagementSubmissionDetailsContext.employeeName, targetManagementSubmissionDetailsContext.monthId])]?.tableCountDetailsAvailable
            ?? Boolean(wangYueTargetManagementActualsByMonth[getTargetManagementActualKey(targetManagementSubmissionDetailsContext.employeeName, targetManagementSubmissionDetailsContext.monthId)]?.tableCountDetailsAvailable)}
          refreshedAt={targetManagementSubmissionSnapshots[JSON.stringify([targetManagementSubmissionDetailsContext.employeeName, targetManagementSubmissionDetailsContext.monthId])]?.snapshotUpdatedAt
            ?? wangYueTargetManagementActualsByMonth[getTargetManagementActualKey(targetManagementSubmissionDetailsContext.employeeName, targetManagementSubmissionDetailsContext.monthId)]?.tableCountSnapshotUpdatedAt
            ?? ''}
          onClose={() => setTargetManagementSubmissionDetailsContext(null)}
        />
      ) : null}
      {businessReport && selectedName === businessReport.employeeName ? (
        <BusinessReportModal
          employeeName={businessReport.employeeName}
          data={businessReport.data}
          goals={businessReport.goals}
          amountUnit={businessReport.amountUnit}
          monthTimeProgress={getFangpianMonthTimeProgress(businessReport.data.monthId as DashboardMonthId)}
          onClose={() => setBusinessReport(null)}
        />
      ) : null}
      </main>
    </div>
  )
}

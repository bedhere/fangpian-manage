import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconChevron } from './Icons'

export type SelOption = { value: string; label: string; color?: string; disabled?: boolean }
export type SelGroup = { label: string; options: SelOption[] }

/**
 * 应用自己的下拉菜单。
 * 为什么不用原生 <select>: 展开的面板是系统/浏览器画的 (浅色、直角、蓝色高亮),
 * 跟这个深色圆角的界面完全不搭。这里自己画一个, 配色/圆角/字体跟应用一致。
 */
export function Select({
  value = '',
  onChange,
  options,
  groups,
  placeholder = '请选择',
  disabled = false,
  className = '',
  popWidth,
  align = 'left',
  multiple = false,
  values = [],
  onValuesChange,
  ariaLabel,
  searchLabel,
}: {
  value?: string
  onChange?: (v: string) => void
  options?: SelOption[]
  /** 分组选项 (用于「按小组分组」这类场景), 与 options 二选一 */
  groups?: SelGroup[]
  placeholder?: string
  disabled?: boolean
  className?: string
  popWidth?: number
  align?: 'left' | 'right'
  /** 多选模式: 点选会切换勾选, 面板不关闭; 用 values / onValuesChange 读写 */
  multiple?: boolean
  values?: string[]
  onValuesChange?: (v: string[]) => void
  ariaLabel?: string
  /** Optional search for long member lists. */
  searchLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ x: 0, y: 0, w: 160, below: true })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // 扁平化用于「找到当前选中的那项」: options (固定项) + 各分组的项。
  // 之前只取 groups, 导致放在 options 里的固定项 (如兜底的「其他」) 选上了也显示不出来。
  const flat = useMemo(
    () => [...(options || []), ...(groups ? groups.flatMap((g) => g.options) : [])],
    [groups, options],
  )
  const current = flat.find((o) => o.value === value)
  const selectedLabels = multiple ? flat.filter((o) => values.includes(o.value)).map((o) => o.label) : []
  const isOn = (v: string) => (multiple ? values.includes(v) : v === value)
  const rows = flat.length + (groups ? groups.length : 0)
  const H = Math.min(320, rows * 32 + 12 + (searchLabel ? 44 : 0))
  const matches = (option: SelOption) => option.label.toLowerCase().includes(search.trim().toLowerCase())

  const openAt = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const W = Math.max(popWidth || 0, Math.round(r.width), 148)
    const x =
      align === 'right' ? Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8)) : Math.min(Math.max(8, r.left), window.innerWidth - W - 8)
    const below = r.bottom + H + 10 <= window.innerHeight
    const y = below ? r.bottom + 6 : Math.max(8, r.top - H - 8)
    setPos({ x, y, w: W, below })
    setSearch('')
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e?: Event) => {
      const el = e?.target as HTMLElement | null
      if (el instanceof Node && popRef.current?.contains(el)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('click', close)
    const onResize = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (o: SelOption) => {
    if (o.disabled) return
    if (multiple) {
      const next = values.includes(o.value) ? values.filter((v) => v !== o.value) : [...values, o.value]
      onValuesChange?.(next)
      return
    }
    onChange?.(o.value)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`sel${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''} ${className}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          if (open) setOpen(false)
          else openAt()
        }}
      >
        <span className="sel-label" style={!multiple && current?.color ? { color: current.color } : undefined}>
          {multiple ? (
            selectedLabels.length ? selectedLabels.join('、') : <em>{placeholder}</em>
          ) : current ? (
            current.label
          ) : (
            <em>{placeholder}</em>
          )}
        </span>
        <IconChevron size={12} />
      </button>

      {open && (
        <div
          ref={popRef}
          className={`sel-pop${pos.below ? '' : ' is-above'}`}
          style={{ left: pos.x, top: pos.y, width: pos.w, overscrollBehavior: 'contain' }}
          role={searchLabel ? 'dialog' : 'listbox'}
          aria-label={searchLabel ? '选择执行人' : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {searchLabel && <input className="sel-search" type="search" aria-label={searchLabel} placeholder={searchLabel} value={search} onChange={event => setSearch(event.target.value)} autoFocus />}
          <div role={searchLabel ? 'listbox' : undefined} aria-label={searchLabel ? '执行人选项' : undefined}>
          {options?.filter(matches).map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={isOn(o.value)}
              className={`sel-item${isOn(o.value) ? ' is-on' : ''}${o.disabled ? ' is-disabled' : ''}`}
              disabled={o.disabled}
              onClick={() => pick(o)}
            >
              <span style={o.color ? { color: o.color } : undefined}>{o.label}</span>
              {isOn(o.value) && <IconCheck size={13} />}
            </button>
          ))}
          {groups?.filter(g => g.options.some(matches)).map((g) => (
            <div key={g.label}>
              <p className="sel-group">{g.label}</p>
              {g.options.filter(matches).map((o) => (
                <button
                  key={`${g.label}:${o.value}`}
                  role="option"
                  aria-selected={isOn(o.value)}
                  className={`sel-item${isOn(o.value) ? ' is-on' : ''}${o.disabled ? ' is-disabled' : ''}`}
                  disabled={o.disabled}
                  onClick={() => pick(o)}
                >
                  <span style={o.color ? { color: o.color } : undefined}>{o.label}</span>
                  {isOn(o.value) && <IconCheck size={13} />}
                </button>
              ))}
            </div>
          ))}
          {searchLabel && !flat.some(matches) && <div className="sel-empty">没有匹配的执行人</div>}
          </div>
          {flat.length === 0 && <p className="sel-group">没有可选项</p>}
        </div>
      )}
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatCalendarDay, formatDay, startOfDay } from '../domain/dates'
import { IconCalendar } from './Icons'
import { Select } from './Select'

/**
 * 自带的日期选择器 —— 为什么不用原生 <input type="date">:
 * 那个日历面板是浏览器自己画的(系统弹层), CSS 碰不到, 圆角/配色都没法改。
 * 这里用应用自己的样式画一个, 和深/浅色主题、圆角、字体完全一致。
 *
 * 约定:
 *   · 不传 withTime → 只选到「哪一天」, 存下来的时间是当天 23:59:59 (当天不算逾期)
 *   · 传 withTime   → 多一行「时:分」, 给提醒时间用
 */
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const pad2 = (n: number) => String(n).padStart(2, '0')

export function DatePicker({
  value,
  onChange,
  withTime = false,
  variant = 'chip',
  placeholder,
  danger = false,
  relative = true,
  min = null,
  max = null,
}: {
  value: string | null
  onChange: (iso: string | null) => void
  withTime?: boolean
  /** chip = 表格单元格里那种小胶囊; field = 表单里那种输入框 */
  variant?: 'chip' | 'field'
  placeholder?: string
  danger?: boolean
  relative?: boolean
  /** 可选范围 (ISO, 按天算) —— 子任务的截止不能晚于主任务, 也不能早于今天 */
  min?: string | null
  max?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const current = value ? new Date(value) : null
  // 可选范围按「天」比较, 越界的日子直接不给点
  const minDay = min ? startOfDay(new Date(min)).getTime() : null
  const maxDay = max ? startOfDay(new Date(max)).getTime() : null
  const outOfRange = (d: Date) => {
    const t = startOfDay(d).getTime()
    return (minDay !== null && t < minDay) || (maxDay !== null && t > maxDay)
  }
  const todayOut = outOfRange(new Date())
  const rangeText =
    minDay !== null && maxDay !== null
      ? `只能选 ${formatDay(min!)} 到 ${formatDay(max!)}`
      : maxDay !== null
        ? `不晚于 ${formatDay(max!)}`
        : minDay !== null
          ? `不早于 ${formatDay(min!)}`
          : ''
  const [view, setView] = useState(() => {
    const base = current || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [hour, setHour] = useState(() => (current ? current.getHours() : 18))
  const [minute, setMinute] = useState(() => (current ? current.getMinutes() : 0))

  /** 打开时按触发元素的屏幕位置定位 (单元格有 overflow:hidden, 不能用绝对定位) */
  const openAt = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const W = 292
    const H = withTime ? 400 : 356
    const x = Math.min(Math.max(8, r.left), window.innerWidth - W - 8)
    const y = r.bottom + H + 10 > window.innerHeight ? Math.max(8, r.top - H - 8) : r.bottom + 8
    setPos({ x, y })
    const base = value ? new Date(value) : new Date()
    setView(new Date(base.getFullYear(), base.getMonth(), 1))
    if (value) {
      setHour(new Date(value).getHours())
      setMinute(new Date(value).getMinutes())
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onScroll = () => setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay()) // 以周日为第一列
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [view])

  const today = new Date()
  const sameDay = (a: Date | null, b: Date) =>
    !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const emit = (d: Date | null) => {
    if (!d) {
      onChange(null)
      setOpen(false)
      return
    }
    const x = new Date(d)
    if (withTime) x.setHours(hour, minute, 0, 0)
    else x.setHours(23, 59, 59, 999)
    onChange(x.toISOString())
    setOpen(false)
  }

  const label = value ? relative ? formatDay(value) : formatCalendarDay(value) : ''
  const timeText = withTime && value ? ` ${String(new Date(value).getHours()).padStart(2, '0')}:${String(new Date(value).getMinutes()).padStart(2, '0')}` : ''

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={
          variant === 'chip'
            ? `cell-chip${value ? '' : ' is-empty'}${danger ? ' is-danger' : ''}`
            : 'input dp-field'
        }
        onClick={openAt}
      >
        {variant === 'field' && <IconCalendar size={13} />}
        <span>{label ? label + timeText : placeholder || (withTime ? '设提醒时间' : '设日期')}</span>
      </button>

      {open && (
        <div className="dp-pop" style={{ left: pos.x, top: pos.y }} ref={popRef}>
          <div className="dp-head">
            <button className="dp-nav" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              ‹
            </button>
            <span className="dp-title">
              {view.getFullYear()}年{view.getMonth() + 1}月
            </span>
            <button className="dp-nav" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              ›
            </button>
          </div>

          <div className="dp-week">
            {WEEK.map((w, i) => (
              <span key={w} className={i === 0 || i === 6 ? 'is-weekend' : ''}>
                {w}
              </span>
            ))}
          </div>

          <div className="dp-grid">
            {days.map((d) => {
              const other = d.getMonth() !== view.getMonth()
              const isToday = sameDay(today, d)
              const isPicked = sameDay(current, d)
              const out = outOfRange(d)
              return (
                <button
                  key={d.toISOString()}
                  className={`dp-day${other ? ' is-other' : ''}${isToday ? ' is-today' : ''}${isPicked ? ' is-picked' : ''}${out ? ' is-out' : ''}`}
                  disabled={out}
                  title={out ? rangeText : undefined}
                  onClick={() => emit(d)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {withTime && (
            <div className="dp-time">
              <span>时间</span>
              <div className="dp-time-sel">
                <Select
                  value={String(hour)}
                  popWidth={104}
                  onChange={(v) => setHour(Number(v))}
                  options={Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${pad2(i)} 时` }))}
                />
              </div>
              <div className="dp-time-sel">
                <Select
                  value={String(minute)}
                  popWidth={104}
                  onChange={(v) => setMinute(Number(v))}
                  options={[...new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, ...(minute % 5 ? [minute] : [])])]
                    .sort((a, b) => a - b)
                    .map((m) => ({ value: String(m), label: `${pad2(m)} 分` }))}
                />
              </div>
            </div>
          )}

          {rangeText && <div className="dp-range">{rangeText}</div>}

          <div className="dp-foot">
            <button className="dp-link" onClick={() => emit(null)}>
              清除
            </button>
            <button className="dp-link" disabled={todayOut} title={todayOut ? rangeText : undefined} onClick={() => emit(new Date())}>
              今天
            </button>
          </div>
        </div>
      )}
    </>
  )
}

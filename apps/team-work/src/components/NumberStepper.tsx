import { useEffect, useRef, useState } from 'react'
import { IconChevron } from './Icons'

/**
 * 数字输入框 (右侧带上下步进按钮)。
 *
 * 为什么不用 <input type="number">: 它自带的那对上下箭头是**浏览器/系统画的** ——
 * 一个直角的实心小方块, 颜色也不跟主题走, 在这个圆角深色界面里特别突兀 (和当初
 * 原生 <select> / <input type="date"> 是同一个毛病)。所以跟 Select / DatePicker
 * 一样自己画一对: 圆角、配色、hover 都用页面自己的 token。
 *
 * 交互: 点按钮按 step 加/减, 键盘 ↑/↓ 也能加/减, 失焦时把输入夹回 [min, max]。
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  placeholder = '',
  disabled = false,
  className = '',
  title,
}: {
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  min?: number
  max?: number
  placeholder?: string
  disabled?: boolean
  className?: string
  title?: string
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value))
  /** 正在输入时不要被外部的值 (自动刷新/别人改了) 覆盖掉光标下的内容 */
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setText(value === null || value === undefined ? '' : String(value))
  }, [value])

  const clamp = (n: number) => {
    let v = n
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    return Number(v.toFixed(4))
  }

  /** 文本 → 值; 空串 = 清空 (null), 非法字符按 null 处理 */
  const parse = (raw: string): number | null => {
    const t = raw.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? clamp(n) : null
  }

  const nudge = (dir: 1 | -1) => {
    const cur = typeof value === 'number' ? value : min ?? 0
    const next = clamp(Number((cur + dir * step).toFixed(4)))
    setText(String(next))
    onChange(next)
  }

  return (
    <div className={`num-stepper${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <input
        className="ap-input is-num"
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        title={title}
        onFocus={() => {
          editing.current = true
        }}
        onBlur={() => {
          editing.current = false
          const v = parse(text)
          setText(v === null ? '' : String(v))
          if (v !== value) onChange(v)
        }}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          const v = parse(raw)
          // 输入到一半 (比如 "1." 或 "-") 先别回调, 免得把中间态写进数据
          if (v !== null || raw.trim() === '') onChange(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            nudge(1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            nudge(-1)
          }
        }}
      />
      <span className="num-step">
        <button
          type="button"
          className="num-step-btn"
          aria-label="增加"
          title="增加"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => nudge(1)}
        >
          <IconChevron size={11} className="num-step-up" />
        </button>
        <button
          type="button"
          className="num-step-btn"
          aria-label="减少"
          title="减少"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => nudge(-1)}
        >
          <IconChevron size={11} />
        </button>
      </span>
    </div>
  )
}

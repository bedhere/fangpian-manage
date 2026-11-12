import { Select } from './Select'

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * 时间选择 ('HH:mm')。
 * 原来用的是原生 <input type="time"> —— 弹出的时/分面板是系统画的 (浅色、直角),
 * 跟界面不搭, 所以换成两个应用自己的下拉。
 */
export function TimeSelect({
  value,
  onChange,
  minuteStep = 5,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  minuteStep?: number
  className?: string
}) {
  const [rawH = '9', rawM = '0'] = (value || '09:00').split(':')
  const h = Math.max(0, Math.min(23, Number(rawH) || 0))
  const m = Math.max(0, Math.min(59, Number(rawM) || 0))

  const hours = Array.from({ length: 24 }, (_, i) => ({ value: pad2(i), label: `${pad2(i)} 时` }))
  const step = Math.max(1, minuteStep)
  const mins = Array.from({ length: Math.floor(59 / step) + 1 }, (_, i) => i * step)
  if (!mins.includes(m)) mins.push(m)
  const minutes = mins
    .sort((a, b) => a - b)
    .map((x) => ({ value: pad2(x), label: `${pad2(x)} 分` }))

  return (
    <span className={`time-sel ${className}`}>
      <Select value={pad2(h)} options={hours} popWidth={104} onChange={(v) => onChange(`${v}:${pad2(m)}`)} />
      <Select value={pad2(m)} options={minutes} popWidth={104} onChange={(v) => onChange(`${pad2(h)}:${v}`)} />
    </span>
  )
}

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

/** Explicit confirmation keeps keyboard and touch edits away from accidental drags. */
export function ProgressEditor({ title, progress, onSave, onClose }: {
  title: string
  progress?: number
  onSave: (value: number) => Promise<string | null>
  onClose: () => void
}) {
  const [value, setValue] = useState(progress === undefined ? '' : String(progress))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const saving = useRef(false)
  const mounted = useRef(true)
  const close = () => { if (!saving.current) onClose() }
  useEffect(() => {
    mounted.current = true
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    input.current?.focus()
    input.current?.select()
    return () => { mounted.current = false; document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving.current) return
    const percent = Number(value)
    if (!value.trim() || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      setError('请输入0至100的整数进度')
      input.current?.focus()
      return
    }
    saving.current = true
    setBusy(true)
    setError('')
    try {
      const result = await onSave(percent)
      if (!mounted.current) return
      if (result) setError(result)
      else onClose()
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      saving.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    if (event.key !== 'Tab') return
    const items = [...(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)') || [])]
    if (!items.length) return
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
  }
  return createPortal(<div className="progress-edit-mask" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <div ref={dialog} className="progress-edit-dialog" role="dialog" aria-modal="true" aria-label="编辑任务进度" onKeyDown={keyboard}>
      <h2>编辑进度</h2><p className="progress-edit-title">{title}</p>
      <form onSubmit={submit} noValidate>
        <label>进度百分比<div className="progress-edit-input"><input ref={input} aria-label="进度百分比" type="number" inputMode="numeric" min="0" max="100" step="1" value={value} onChange={event => setValue(event.target.value)} disabled={busy}/><span>%</span></div></label>
        <p className="progress-edit-help">填写0～100。保存100%会标记完成；降到100%以下会重新打开任务。</p>
        {error && <p className="progress-edit-error" role="alert">{error}</p>}
        <div className="progress-edit-actions"><button type="button" className="btn ghost" onClick={close} disabled={busy}>取消</button><button type="submit" className="btn primary" disabled={busy}>{busy ? '保存中…' : '保存进度'}</button></div>
      </form>
    </div>
  </div>, document.body)
}

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppProvider'
import type { Task } from '../domain/types'
import { ProgressEditor } from './ProgressEditor'

/**
 * 进度条: 按住拖动改进度。
 *   0     → 空条, 不上色
 *   中间  → 黄色
 *   100   → 绿色, 并且把任务标记为已完成
 * 使用方片统一的黄色进度与绿色完成状态。
 */
export function ProgressCell({
  task,
  locked,
  lockedHint,
}: {
  task: Task
  /** true = 不能拖 (不是执行人 / 还没人认领) */
  locked: boolean
  lockedHint?: string
}) {
  const { updateTask, pushToast } = useApp()
  const [draft, setDraft] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const savingRef = useRef(false)

  const value = draft ?? task.progress ?? 0
  const color = value <= 0 ? 'transparent' : value >= 100 ? 'var(--fp-success)' : 'var(--fp-yellow)'

  /** 按屏幕位置算进度 (0~100) */
  const ratioAt = (clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(100, Math.round(((clientX - r.left) / Math.max(1, r.width)) * 100)))
  }

  const commit = async (p: number) => {
    if (savingRef.current) return '进度正在保存，请稍候'
    savingRef.current = true
    setSaving(true)
    try {
      await updateTask(task.id, { progress: p } as any)
      return null
    } catch (e: any) {
      const message = e?.message || String(e)
      pushToast({ title: '进度没保存', body: message, kind: 'error' })
      return message
    } finally {
      savingRef.current = false
      setSaving(false)
      setDraft(null)
    }
  }

  // 拖动中: 鼠标移出元素也要跟手, 所以监听 window
  useEffect(() => {
    if (draft === null) return
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      setDraft(ratioAt(e.clientX))
    }
    const up = (e: PointerEvent) => {
      if (!dragging.current) return
      dragging.current = false
      const p = ratioAt(e.clientX)
      setDraft(p)
      void commit(p)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    const cancel = () => { dragging.current = false; setDraft(null) }
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft !== null, task.id])

  const start = (e: React.PointerEvent) => {
    if (locked || savingRef.current || editing) return
    e.preventDefault()
    dragging.current = true
    setDraft(ratioAt(e.clientX))
  }

  const text = task.progressUnspecified && draft === null ? '未填' : `${value}%`
  return (<>
    <span
      className={`prog${locked ? ' is-locked' : ''}${saving ? ' is-saving' : ''}`}
      title={locked ? lockedHint || '只有执行人能改进度' : '点击百分比输入进度，也可拖动进度条'}
    >
      <span
        className="prog-track"
        ref={trackRef}
        onPointerDown={start}
        role="slider"
        aria-label="进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-disabled={locked || saving}
        tabIndex={locked ? -1 : 0}
        onKeyDown={event => {
          if (locked || saving) return
          if (['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            setEditing(true)
          }
        }}
      >
        <span className="prog-fill" style={{ width: `${value}%`, background: color }} />
      </span>
      {locked ? <em>{task.progressUnspecified && draft === null ? task.sourceStatus || '未填' : `${value}%`}</em> : <button type="button" className="progress-edit-trigger" aria-label={`编辑进度，当前${text}`} onClick={() => setEditing(true)} disabled={saving}>{text}<span aria-hidden="true">✎</span></button>}
      {(task.progressConflict || task.status === 'done' && task.progress < 100 || task.sourceStatus === '待核对') && <span className="chip is-warn" title="原表完成状态与百分比不一致，保留原值待核对">待核对</span>}
    </span>
    {editing && !locked && <ProgressEditor title={task.title} progress={task.progressUnspecified ? undefined : task.progress} onSave={commit} onClose={() => setEditing(false)}/>}
  </>)
}

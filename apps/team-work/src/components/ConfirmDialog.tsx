import { useEffect, useRef } from 'react'
import { useApp } from '../store/AppProvider'

/**
 * 应用内确认框。
 * 原来的 window.confirm 在预览的 iframe (sandbox 没给 allow-modals) 和部分桌面 webview 里
 * 会被直接挡掉 —— 点了删除看起来「没反应」, 就是这个原因。这里自己画一个。
 */
export function ConfirmDialog() {
  const { confirmAsk, answerConfirm } = useApp()
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!confirmAsk) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        answerConfirm(false)
      }
      if (e.key === 'Enter') {
        e.stopPropagation()
        answerConfirm(true)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [confirmAsk, answerConfirm])

  if (!confirmAsk) return null
  return (
    <div className="modal-mask is-confirm" onMouseDown={() => answerConfirm(false)}>
      <div className="confirm-box" role="dialog" aria-modal="true" aria-label={confirmAsk.title} onMouseDown={(e) => e.stopPropagation()}>
        <h3>{confirmAsk.title}</h3>
        {confirmAsk.body && <p>{confirmAsk.body}</p>}
        <div className="confirm-actions">
          <button className="btn ghost sm" onClick={() => answerConfirm(false)}>
            取消
          </button>
          <button
            ref={okRef}
            className={`btn sm${confirmAsk.danger ? ' danger' : ' primary'}`}
            onClick={() => answerConfirm(true)}
          >
            {confirmAsk.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}

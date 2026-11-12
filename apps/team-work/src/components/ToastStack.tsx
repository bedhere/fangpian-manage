import { useApp } from '../store/AppProvider'
import { IconBell, IconCheck } from './Icons'

export function ToastStack() {
  const { toasts, dismissToast } = useApp()
  if (toasts.length === 0) return null
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div className={`toast toast--${t.kind}`} key={t.id} onClick={() => dismissToast(t.id)}>
          <span className="toast-icon">{t.kind === 'reminder' ? <IconBell size={15} /> : <IconCheck size={15} />}</span>
          <div className="toast-body">
            <strong>{t.title}</strong>
            <span>{t.body}</span>
          </div>
          <button className="toast-close" aria-label="关闭">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

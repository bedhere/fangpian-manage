import { MemoManager } from './MemoManager'

/** 备忘录独立窗口 —— 从右上角头像菜单里打开 */
export function MemoWindow({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>备忘录</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="modal-body">
          <MemoManager />
        </div>
      </div>
    </div>
  )
}

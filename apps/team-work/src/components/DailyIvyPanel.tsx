import { useState } from 'react'
import { formatDay } from '../domain/dates'
import { useApp } from '../store/AppProvider'
import { IconCopy, IconTrash } from './Icons'

/** 'YYYY-MM-DD' → '10月15日' (今天/昨天另说) */
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, (m || 1) - 1, d || 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === -1) return '昨天'
  const md = `${m}月${d}日`
  return y === new Date().getFullYear() ? md : `${y}年${md}`
}

/**
 * 「当日艾维利」的文本预览 + 历史清单。
 *
 * 生成当天那段时会顺手存一条 (一天一条, 同一天覆盖), 所以往上翻就能追溯过去写过什么。
 * 历史里的每一条都能展开看全文、单独复制; 今天的这条改完再复制也会覆盖保存。
 */
export function DailyIvyPanel({ text, onClose }: { text: string; onClose: () => void }) {
  const { pushToast, ivy, saveIvy, removeIvy } = useApp()
  const [draft, setDraft] = useState(text)
  /** 展开看全文的历史记录 id */
  const [openId, setOpenId] = useState<string | null>(null)

  const today = (() => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })()

  const copy = async (t: string, alsoSave = false) => {
    try {
      await navigator.clipboard.writeText(t)
      if (alsoSave) {
        try {
          await saveIvy(t)
        } catch {
          /* 存历史失败不影响复制 */
        }
      }
      pushToast({ title: '已复制', body: alsoSave ? '今天的这段也存进历史了' : '直接粘到群里就行', kind: 'info' })
      onClose()
    } catch {
      pushToast({ title: '复制失败', body: '请手动全选复制', kind: 'error' })
    }
  }

  const others = ivy.filter((r) => r.date !== today)

  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div className="modal ivy-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>当日艾维利</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="modal-body">
          <p className="field-note">
            今天完成的 + 截止日是今天的 (同一条件只记一次)。符号按进度给: 完成 ✅ / 有进度没完成{' '}
            <span className="ivy-key">🚶‍♂️</span> / 没进度 ❌。下面还有<b>历史艾维利</b>, 往上翻能追溯过去写过的。
          </p>
          <textarea
            className="ivy-text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={Math.min(18, Math.max(6, draft.split('\n').length + 1))}
          />
          <div className="ivy-actions">
            <button className="btn primary sm" onClick={() => void copy(draft, true)}>
              <IconCopy size={13} /> 复制文本
            </button>
            <button className="btn ghost sm" onClick={onClose}>
              关闭
            </button>
          </div>

          <div className="ivy-history">
            <div className="ivy-history-head">
              <span>历史艾维利</span>
              <em>{ivy.length ? `共 ${ivy.length} 天 (含今天)` : '还没有历史'}</em>
            </div>
            {ivy.length === 0 && (
              <p className="field-note">还没有历史 —— 每天点一次这个按钮, 当天这段就会自动存下来。</p>
            )}
            <ul className="ivy-history-list">
              {ivy.map((r) => {
                const lines = r.text.split('\n').length
                const open = openId === r.id
                return (
                  <li className={`ivy-history-row${open ? ' is-open' : ''}`} key={r.id}>
                    <button className="ivy-history-day" onClick={() => setOpenId(open ? null : r.id)}>
                      <strong>{dayLabel(r.date)}</strong>
                      <em>
                        {r.date === today ? '今天 · ' : ''}
                        {lines} 行 · {formatDay(r.updatedAt)}
                      </em>
                    </button>
                    <span className="spacer" />
                    <button className="btn ghost sm" onClick={() => void copy(r.text)}>
                      复制
                    </button>
                    <button
                      className="icon-btn sm"
                      aria-label="删除这条历史"
                      title="删掉这一天的记录"
                      onClick={() => void removeIvy(r.id).catch(() => pushToast({ title: '删不掉', body: '', kind: 'error' }))}
                    >
                      <IconTrash size={13} />
                    </button>
                    {open && <pre className="ivy-history-text">{r.text}</pre>}
                  </li>
                )
              })}
            </ul>
            {others.length === 0 && ivy.length === 1 && (
              <p className="field-note">目前只存了今天这一条, 之后每天都会各留一条。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

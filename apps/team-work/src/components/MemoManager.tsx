import { useState } from 'react'
import { formatDay } from '../domain/dates'
import { useApp } from '../store/AppProvider'

/**
 * 备忘录的管理面板: 回看全部历史 / 标记完成 / 删除 / 清空已完成。
 * 和桌面小窗底部那个「备忘录」是同一份数据 (都走 /api/memos)。
 * 这里自己起标题会跟弹窗标题重复, 所以只画内容 —— 标题由外面的窗口给。
 */
export function MemoManager({ defaultAll = false }: { defaultAll?: boolean }) {
  const { memos, updateMemo, removeMemo, clearDoneMemos, pushToast } = useApp()
  const [all, setAll] = useState(defaultAll)
  const pending = memos.filter((m) => !m.done).length
  const list = all ? memos : memos.filter((m) => !m.done)

  return (
    <>
      <div className="memo-admin-bar">
        <span className="memo-count">
          共 {memos.length} 条 · 未完成 {pending}
        </span>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => setAll((v) => !v)}>
          {all ? '只看未完成' : '看全部历史'}
        </button>
        <button
          className="btn danger ghost sm"
          disabled={!memos.some((m) => m.done)}
          onClick={async () => {
            const n = await clearDoneMemos()
            pushToast({ title: `已清理 ${n} 条已完成的备忘`, body: '', kind: 'info' })
          }}
        >
          清空已完成
        </button>
      </div>

      <ul className="memo-admin-list">
        {list.map((m) => (
          <li className={`memo-admin-row${m.done ? ' is-done' : ''}`} key={m.id}>
            <span className="memo-admin-text" title={m.text}>
              {m.text}
            </span>
            <span className="memo-admin-date">
              {formatDay(m.createdAt)}
              {m.done && m.doneAt ? ` · 完成于 ${formatDay(m.doneAt)}` : ''}
            </span>
            <button
              className="btn ghost sm"
              onClick={() => void updateMemo(m.id, { done: !m.done })}
              title={m.done ? '标记为未完成' : '标记为已完成'}
            >
              {m.done ? '恢复' : '完成'}
            </button>
            <button className="btn ghost sm danger-text" onClick={() => void removeMemo(m.id)}>
              删除
            </button>
          </li>
        ))}
        {memos.length === 0 && <li className="field-note">还没有备忘 —— 在桌面小窗底部的「备忘录」里记, 或者在这里记也一样。</li>}
        {memos.length > 0 && list.length === 0 && all && <li className="field-note">一条都没有。</li>}
        {memos.length > 0 && list.length === 0 && !all && (
          <li className="field-note">未完成的都清完了, 切「看全部历史」可以回看以前的记录。</li>
        )}
      </ul>
    </>
  )
}

import { useEffect, useState } from 'react'
import { formatDay } from '../domain/dates'
import type { Task } from '../domain/types'
import { useApp } from '../store/AppProvider'
import { IconTrash } from './Icons'

type TrashTask = Task & { subCount?: number }

/**
 * 回收站。
 * 删除任务不再弹确认框, 而是丢进这里 —— 可以单条/批量恢复, 也可以彻底删掉。
 */
export function TrashPanel({ onClose }: { onClose: () => void }) {
  const { trashTasks, restoreTasks, purgeTasks, askConfirm, pushToast } = useApp()
  const [list, setList] = useState<TrashTask[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await trashTasks()
      setList(r)
      setPicked(new Set())
    } catch (e: any) {
      pushToast({ title: '回收站加载失败', body: e?.message || String(e), kind: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allPicked = list.length > 0 && picked.size === list.length
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(list.map((t) => t.id)))

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      pushToast({ title: msg, body: '', kind: 'info' })
      await load()
    } catch (e: any) {
      pushToast({ title: '操作失败', body: e?.message || String(e), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const ids = Array.from(picked)

  const purgeOne = async (t: TrashTask) => {
    const ok = await askConfirm({
      title: `彻底删除「${t.title}」?`,
      body: t.subCount ? `下面还有 ${t.subCount} 条子任务, 会一起删掉。彻底删除后无法恢复。` : '彻底删除后无法恢复。',
      confirmText: '彻底删除',
      danger: true,
    })
    if (ok) await run(() => purgeTasks([t.id]), '已彻底删除')
  }

  const purgePicked = async () => {
    const ok = await askConfirm({
      title: `彻底删除选中的 ${ids.length} 条?`,
      body: '连同它们的子任务一起删掉, 无法恢复。',
      confirmText: '彻底删除',
      danger: true,
    })
    if (ok) await run(() => purgeTasks(ids), `已彻底删除 ${ids.length} 条`)
  }

  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>回收站</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="modal-body">
          <div className="trash-bar">
            <label className="trash-all">
              <input type="checkbox" checked={allPicked} onChange={toggleAll} disabled={list.length === 0} />
              全选
            </label>
            <span className="trash-count">
              {list.length} 条{ids.length ? ` · 已选 ${ids.length}` : ''}
            </span>
            <span className="spacer" />
            <button
              className="btn ghost sm"
              disabled={!ids.length || busy}
              onClick={() => void run(() => restoreTasks(ids), `已恢复 ${ids.length} 条`)}
            >
              恢复选中
            </button>
            <button className="btn danger sm" disabled={!ids.length || busy} onClick={() => void purgePicked()}>
              <IconTrash size={13} /> 删除选中
            </button>
          </div>

          {loading && <p className="field-note">加载中…</p>}
          {!loading && list.length === 0 && (
            <p className="field-note">回收站是空的。删除的任务会先放到这里, 可以随时恢复。</p>
          )}

          <div className="trash-list">
            {list.map((t) => (
              <div className={`trash-row${picked.has(t.id) ? ' is-picked' : ''}`} key={t.id}>
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => togglePick(t.id)} aria-label={`选择 ${t.title}`} />
                <span className="trash-title" title={t.title}>
                  {t.title}
                  {t.subCount ? <em>（含 {t.subCount} 条子任务）</em> : null}
                </span>
                <span className="trash-meta">
                  {formatDay(t.dueAt)}
                  {t.dueAt ? ' · ' : ''}
                  {t.deletedAt ? `删除于 ${formatDay(t.deletedAt)}` : ''}
                </span>
                <button className="btn ghost sm" disabled={busy} onClick={() => void run(() => restoreTasks([t.id]), '已恢复')}>
                  恢复
                </button>
                <button className="btn ghost sm danger-text" disabled={busy} onClick={() => void purgeOne(t)}>
                  彻底删除
                </button>
              </div>
            ))}
          </div>

          <p className="field-note">只能看到/恢复自己派发的任务; 负责人(管理员)能看到全部。</p>
        </div>
      </div>
    </div>
  )
}

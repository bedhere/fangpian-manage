import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDay, isDueOverdue } from '../domain/dates'
import type { Memo, Task } from '../domain/types'
import { detectTags } from '../domain/autotag'
import { useApp } from '../store/AppProvider'
import { IconCheck, IconExpand, IconList, IconMinimize, IconPlus, IconTrash } from '../components/Icons'

/**
 * 小窗列表的一行。
 *   head  = 为了给子任务交代上下文, 补出来的主任务行
 *   depth = 相对主任务缩进几级 (0 = 主任务那一行)
 * 主任务 (含补出来的那行) 不给对勾 —— 它的完成由子任务决定。
 */
type WidgetRow = {
  key: string
  head: boolean
  task: Task
  depth: number
  hasKids: boolean
  /** 子任务进度 (只在主任务行上有意义) */
  kids: { done: number; total: number }
}
/** 子任务每缩进一级的像素数 = 复选框 19 + 行内间隙 9 */
const SUB_INDENT = 28

/**
 * 桌面小窗: 只显示「今天要做的」——我负责的、今天到期或已经逾期的。
 * 数据来自服务器 (局域网里那台机器), 所以小窗看到的和别人派给你的是一致的。
 */
export function WidgetView({
  onExpand,
  onDragStart,
  onCollapsedChange,
}: {
  onExpand: () => void
  onDragStart?: (e: React.PointerEvent) => void
  /** 折叠成小球时告诉外层 —— 预览要据此把外框收成小球大小 */
  onCollapsedChange?: (collapsed: boolean) => void
}) {
  const {
    tasks, user, org, toggleTask, createTask, pushToast,
    memos, addMemo, updateMemo, removeMemo,
  } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [title, setTitle] = useState('')
  /** 备忘录面板展开没 */
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoText, setMemoText] = useState('')
  const [editingMemo, setEditingMemo] = useState<string | null>(null)
  const [memoDraft, setMemoDraft] = useState('')
  /** 正在播放「滑出去」动画的那条 */
  const [flying, setFlying] = useState<string | null>(null)
  const setCollapsedBoth = (v: boolean) => {
    setCollapsed(v)
    onCollapsedChange?.(v)
  }
  const inputRef = useRef<HTMLInputElement>(null)

  const { items, rows } = useMemo(() => {
    if (!user) return { items: [] as Task[], rows: [] as WidgetRow[] }
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    // 只认已经认领到自己名下的 (别人派给你、还没确认的在「待认领」)
    const mine = (t: Task) => t.ownerId === user.id
    const byId = new Map(tasks.map((t) => [t.id, t]))
    // 子任务自己没设时间时, 跟父任务的时间走 —— 否则「明天到期的任务」的子步骤
    // 会因为没时间而错误地出现在今天的清单里
    const effectiveDue = (t: Task): string | null => t.dueAt || (t.parentId ? byId.get(t.parentId)?.dueAt || null : null)
    const list = tasks
      .filter((t) => {
        // 周期"规则"是模板不是待办, 不进小窗; 挂在规则下面的子任务同理
        if (t.recurrence && !t.templateId) return false
        const parent = t.parentId ? byId.get(t.parentId) : null
        if (parent?.recurrence && !parent.templateId) return false
        if (t.status !== 'open' || !mine(t)) return false
        const due = effectiveDue(t)
        return !due || new Date(due).getTime() <= endOfToday.getTime()
      })
      .sort((a, b) => {
        const ad = effectiveDue(a)
        const bd = effectiveDue(b)
        const av = ad ? new Date(ad).getTime() : Infinity
        const bv = bd ? new Date(bd).getTime() : Infinity
        return av - bv
      })
      .slice(0, 8)

    const inList = new Set(list.map((t) => t.id))

    // 子任务进度: 用来判断「这是主任务, 不给对勾」, 顺便把 x/y 显示出来
    const kidStat = new Map<string, { done: number; total: number }>()
    for (const t of tasks) {
      if (!t.parentId || !byId.has(t.parentId)) continue
      const cur = kidStat.get(t.parentId) || { done: 0, total: 0 }
      cur.total += 1
      if (t.status === 'done') cur.done += 1
      kidStat.set(t.parentId, cur)
    }
    const kidsOf = (id: string) => kidStat.get(id) || { done: 0, total: 0 }

    const rows: WidgetRow[] = []
    const shownParent = new Set<string>()
    const depthOf = new Map<string, number>()
    for (const t of list) {
      const parent = t.parentId ? byId.get(t.parentId) : null
      let depth = 0
      if (parent) {
        // 主任务自己不在今天的清单里 -> 补一行出来当上下文 (缩进 0)
        if (!inList.has(parent.id) && !shownParent.has(parent.id)) {
          shownParent.add(parent.id)
          depthOf.set(parent.id, 0)
          rows.push({ key: `p-${parent.id}`, head: true, task: parent, depth: 0, hasKids: true, kids: kidsOf(parent.id) })
        }
        const pd = depthOf.get(parent.id)
        depth = pd === undefined ? 1 : pd + 1
      }
      depthOf.set(t.id, depth)
      rows.push({ key: t.id, head: false, task: t, depth, hasKids: (kidStat.get(t.id)?.total || 0) > 0, kids: kidsOf(t.id) })
    }
    return { items: list, rows }
  }, [tasks, user])

  const lateCount = items.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.示例公司有限公司()).length

  const submit = async () => {
    const text = title.trim()
    if (!text) return
    try {
      // 名字里出现板块/类型的关键词就顺手填上, 认不出来就不填
      const hit = detectTags(text, org)
      await createTask({
        title: text,
        scope: 'user',
        assigneeId: user?.id,
        dueAt: new Date(new Date().setHours(23, 59, 0, 0)).toISOString(),
        ...(hit.category ? { category: hit.category } : {}),
        ...(hit.type ? { type: hit.type } : {}),
      })
      setTitle('')
      inputRef.current?.focus()
    } catch (e: any) {
      pushToast({ title: '添加失败', body: e?.message || String(e), kind: 'error' })
    }
  }

  if (!user) {
    return (
      <div className="widget widget--plain">
        <div className="widget-title">还没登录</div>
        <p className="widget-sub">桌面小窗需要先登录一次。点下面的按钮打开完整界面。</p>
        <button className="btn primary sm" onClick={onExpand}>
          打开登录
        </button>
      </div>
    )
  }

  if (collapsed) {
    return (
      <button className="orb" onClick={() => setCollapsedBoth(false)} title="展开待办小窗">
        <span className="orb-count">{items.length}</span>
        <span className="orb-label">今日待办</span>
      </button>
    )
  }

  const today = new Date()
  /** 还没完成的备忘条数 (底部那个红点角标) */
  const pendingMemos = memos.filter((m) => !m.done).length

  return (
    <div className="widget">
      <header className="widget-head" data-tauri-drag-region onPointerDown={onDragStart}>
        <div className="widget-heading">
          <span className="widget-title">今天 · {user.name}</span>
          <span className="widget-sub">
            {today.getMonth() + 1} 月 {today.getDate()} 日 · {items.length} 项
            {lateCount > 0 ? ` (${lateCount} 项逾期)` : ''}
          </span>
        </div>
        <div className="widget-actions">
          <button className="icon-btn sm" title="折叠成小球" aria-label="折叠" onClick={() => setCollapsed(true)} onPointerDown={(e) => e.stopPropagation()}>
            <IconMinimize size={14} />
          </button>
          <button className="icon-btn sm" title="打开完整界面" aria-label="打开完整界面" onClick={onExpand} onPointerDown={(e) => e.stopPropagation()}>
            <IconExpand size={14} />
          </button>
        </div>
      </header>

      <div className="widget-add">
        <input
          ref={inputRef}
          value={title}
          placeholder="给自己加一件事, 回车"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
        <button className="widget-add-btn" onClick={submit} aria-label="添加">
          <IconPlus size={15} />
        </button>
      </div>

      <ul className="widget-list">
        {rows.map((row) => {
          const task = row.task
          const own = task.dueAt
          const late = isDueOverdue(own)
          // 主任务 (补出来的那行 / 自己还有子任务的那行) 不打勾: 它由子任务决定完成
          const noCheck = row.head || row.hasKids
          // 主任务行点明「主任务 · x/y」—— 让「为什么没对勾」一眼有答案
          const meta = [
            row.head ? '主任务' : task.parentId ? '子任务' : noCheck ? '主任务' : '',
            noCheck && row.kids.total ? `${row.kids.done}/${row.kids.total}` : '',
            own ? formatDay(own) : task.parentId ? '跟父任务' : '未设日期',
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li
              key={row.key}
              className={`widget-item${task.parentId ? ' is-sub' : ''}${row.head ? ' is-parent-head' : ''}${noCheck ? ' is-main' : ''}`}
              style={row.depth ? { marginLeft: row.depth * SUB_INDENT } : undefined}
            >
              {noCheck ? (
                <span className="checkbox-spacer" aria-hidden="true" />
              ) : (
                <button className="checkbox" onClick={() => void toggleTask(task)} aria-label="标记完成">
                  <IconCheck size={11} />
                </button>
              )}
              <button className="widget-item-main" onClick={onExpand}>
                <span className="widget-item-title">{task.title}</span>
                <span className={`widget-item-meta${late ? ' is-late' : ''}`}>{meta}</span>
              </button>
            </li>
          )
        })}
        {items.length === 0 && (
          <li className="widget-empty">
            <IconCheck size={18} />
            <span>今天没有要做的了</span>
          </li>
        )}
      </ul>

      {/* 上面留出来的那条黑条: 备忘录展开着的时候点它 = 滑回清单。
          (备忘录面板从它下面滑上来, 所以这条黑条也是有内容时唯一能点回清单的地方之一) */}
      {memoOpen && (
        <button className="memo-strip" onClick={() => setMemoOpen(false)} aria-label="回到清单" title="回到清单" />
      )}

      {/* 底部那条黄颜色的标签栏: 只有「清单」状态时是按钮 —— 点它上拉备忘录。
          备忘录展开时它就是一整条黄的 (回到清单走上面那条黑条), 右边只挂一个红点角标 */}
      <footer
        className={`widget-tabs${memoOpen ? ' is-open' : ''}`}
        {...(memoOpen
          ? {}
          : {
              role: 'button',
              tabIndex: 0,
              'aria-expanded': false,
              title: '打开备忘录',
              onClick: () => setMemoOpen(true),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') setMemoOpen(true)
              },
            })}
      >
        <span className="widget-tab-label">{!memoOpen && (<><IconList size={13} /> 备忘录</>)}</span>
        {pendingMemos > 0 && (
          <span className="widget-tab-badge" title={`${pendingMemos} 条备忘还没完成`}>
            {pendingMemos > 99 ? '99+' : pendingMemos}
          </span>
        )}
      </footer>

      <MemoPanel
        open={memoOpen}
        onToggle={() => setMemoOpen((v) => !v)}
        memos={memos}
        pending={memos.filter((m) => !m.done).length}
        text={memoText}
        onText={setMemoText}
        editing={editingMemo}
        draft={memoDraft}
        onDraft={setMemoDraft}
        flying={flying}
        onStartEdit={(id, t) => {
          setEditingMemo(id)
          setMemoDraft(t)
        }}
        onCancelEdit={() => setEditingMemo(null)}
        onSaveEdit={async (id) => {
          const t = memoDraft.trim()
          setEditingMemo(null)
          if (!t) return
          try {
            await updateMemo(id, { text: t })
          } catch (e: any) {
            pushToast({ title: '改不了', body: e?.message || String(e), kind: 'error' })
          }
        }}
        onAdd={async () => {
          const t = memoText.trim()
          if (!t) return
          setMemoText('')
          try {
            await addMemo(t)
          } catch (e: any) {
            pushToast({ title: '记不上', body: e?.message || String(e), kind: 'error' })
          }
        }}
        onToggleDone={async (id, done) => {
          if (done) return
          // 先播横向滑出, 动画走完再真正标记 (标记后它会沉到最下面, 变 50% 透明)
          setFlying(id)
          window.setTimeout(async () => {
            try {
              await updateMemo(id, { done: true })
            } catch (e: any) {
              pushToast({ title: '标记失败', body: e?.message || String(e), kind: 'error' })
            } finally {
              setFlying(null)
            }
          }, 260)
        }}
        onRestore={async (id) => {
          try {
            await updateMemo(id, { done: false })
          } catch (e: any) {
            pushToast({ title: '恢复失败', body: e?.message || String(e), kind: 'error' })
          }
        }}
        onRemove={async (id) => {
          try {
            await removeMemo(id)
          } catch (e: any) {
            pushToast({ title: '删不掉', body: e?.message || String(e), kind: 'error' })
          }
        }}
      />
    </div>
  )
}

/**
 * 备忘录面板: 从底部滑上来的独立一屏。
 * 和任务完全隔离 —— 数据、排序、完成逻辑都是自己的一套。
 */
function MemoPanel({
  open, onToggle, memos, pending, text, onText,
  editing, draft, onDraft, flying,
  onStartEdit, onCancelEdit, onSaveEdit, onAdd, onToggleDone, onRestore, onRemove,
}: {
  open: boolean
  onToggle: () => void
  memos: Memo[]
  pending: number
  text: string
  onText: (v: string) => void
  editing: string | null
  draft: string
  onDraft: (v: string) => void
  flying: string | null
  onStartEdit: (id: string, text: string) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onAdd: () => void
  onToggleDone: (id: string, done: boolean) => void
  onRestore: (id: string) => void
  onRemove: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  /** Esc 放弃编辑: blur 会晚一步触发, 用它区分「保存」和「放弃」 */
  const cancelRef = useRef(false)
  const commitEdit = (id: string) => {
    if (cancelRef.current) {
      cancelRef.current = false
      onCancelEdit()
      return
    }
    onSaveEdit(id)
  }
  // 展开后自动聚焦输入框, 点了就能直接写
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 320)
  }, [open])

  return (
    <div className={`memo-panel${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="memo-head">
        <span className="memo-title">
          <IconList size={13} /> 备忘录
        </span>
        <span className="memo-count">{pending ? `${pending} 未完成` : '全部完成'}</span>
      </div>

      <div className="memo-input">
        <input
          ref={inputRef}
          value={text}
          placeholder="记点东西, 回车"
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAdd()
          }}
        />
        <button className="memo-add" onClick={onAdd} disabled={!text.trim()} aria-label="记下来">
          <IconPlus size={14} />
        </button>
      </div>

      <ul className="memo-list">
        {memos.map((m) => {
          const isEditing = editing === m.id
          return (
            <li
              key={m.id}
              className={`memo-item${m.done ? ' is-done' : ''}${flying === m.id ? ' is-fly' : ''}`}
            >
              <button
                className={`checkbox${m.done ? ' is-on' : ''}`}
                aria-label={m.done ? '恢复未完成' : '标记完成'}
                title={m.done ? '点一下恢复' : '标记完成, 它会沉到最下面'}
                onClick={() => (m.done ? onRestore(m.id) : onToggleDone(m.id, m.done))}
              >
                {m.done && <IconCheck size={11} />}
              </button>

              {isEditing ? (
                <input
                  className="memo-edit"
                  autoFocus
                  value={draft}
                  onChange={(e) => onDraft(e.target.value)}
                  onBlur={() => commitEdit(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') {
                      cancelRef.current = true
                      e.currentTarget.blur()
                    }
                  }}
                />
              ) : (
                <button className="memo-text" onClick={() => onStartEdit(m.id, m.text)} title="点一下改内容">
                  {m.text}
                </button>
              )}

              <span className="memo-date">{formatDay(m.createdAt)}</span>
              <button className="memo-del" aria-label="删除备忘" onClick={() => onRemove(m.id)}>
                <IconTrash size={12} />
              </button>
            </li>
          )
        })}
        {memos.length === 0 && <li className="memo-empty">还没有备忘 —— 在上面那行写点东西, 回车</li>}
      </ul>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { User } from '../domain/types'
import { UserAvatar } from './Avatar'
import { IconChevron, IconSearch } from './Icons'

/**
 * 成员选择器 —— 一个能搜索的下拉。
 *
 * 为什么不用一排勾选框: 人一多就铺成好几行, 占掉半屏 (小组/部门的「成员」那块就是这样)。
 * 这里收成一个框: 已选的人变成框里的小胶囊 (✕ 移除), 打字过滤, 回车选第一个。
 */
export function MemberPicker({
  users,
  selectedIds,
  onToggle,
  placeholder = '搜索成员…',
}: {
  users: User[]
  selectedIds: string[]
  /** 选中/取消某示例公司有限公司 (由调用方决定是加进小组还是部门) */
  onToggle: (id: string, on: boolean) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 点外面 / Esc 收起
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = users.filter((u) => selectedIds.includes(u.id))
  const kw = q.trim().toLowerCase()
  const list = users.filter(
    (u) =>
      !kw ||
      u.name.toLowerCase().includes(kw) ||
      (u.account || '').toLowerCase().includes(kw) ||
      (u.title || '').toLowerCase().includes(kw),
  )

  const pick = (u: User) => {
    onToggle(u.id, !selectedIds.includes(u.id))
    setQ('')
    inputRef.current?.focus()
  }

  return (
    <div className="ms" ref={boxRef}>
      <div
        className={`ms-field${open ? ' is-open' : ''}`}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {selected.map((u) => (
          <span className="ms-chip" key={u.id}>
            <UserAvatar user={u} size={14} />
            {u.name}
            <button
              className="ms-chip-x"
              aria-label={`把 ${u.name} 移出`}
              onClick={(e) => {
                e.stopPropagation()
                onToggle(u.id, false)
              }}
            >
              ×
            </button>
          </span>
        ))}
        <IconSearch size={13} />
        <input
          ref={inputRef}
          className="ms-input"
          value={q}
          placeholder={selected.length ? '' : placeholder}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && list.length) pick(list[0])
            if (e.key === 'Backspace' && !q && selected.length) onToggle(selected[selected.length - 1].id, false)
          }}
        />
        <IconChevron size={12} className={`ms-caret${open ? ' is-open' : ''}`} />
      </div>

      {open && (
        <div className="ms-pop" role="listbox">
          {list.map((u) => {
            const on = selectedIds.includes(u.id)
            return (
              <button className={`ms-row${on ? ' is-on' : ''}`} key={u.id} onClick={() => pick(u)} role="option" aria-selected={on}>
                <span className={`ms-check${on ? ' is-on' : ''}`}>{on ? '✓' : ''}</span>
                <UserAvatar user={u} size={16} />
                <span className="ms-name">{u.name}</span>
                <em>{u.title || (u.role === 'admin' ? '管理员' : '成员')}</em>
              </button>
            )
          })}
          {!list.length && <p className="field-note ms-empty">没有匹配的成员</p>}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { daysUntilDue, formatDay, startOfDay } from '../domain/dates'
import { canDeleteTask, canEditTask } from '../domain/permissions'
import { dimsOf, dimValueOf, REPEAT_LABEL, WEEKDAY_LABEL, type Group, type Task, type User } from '../domain/types'
import { useApp } from '../store/AppProvider'
import { Avatar } from './Avatar'
import { api } from '../api/client'
import { CreatorCell, DimCell, DueCell, ExecutorCell, PriorityCell, TitleCell } from './TaskCells'
import { ProgressCell } from './ProgressCell'
import { IconCheck, IconChevron, IconCopy, IconGrip4, IconPlus, IconRefresh, IconTrash } from './Icons'

interface Org {
  users: User[]
  groups: Group[]
  departments: Array<{ id: string; name: string }>
}

/** 周期规则行的「执行对象」文字 (规则不可认领, 所以只展示范围) */
export function targetText(task: Task, org: Org): string {
  if (task.scope === 'group') {
    const g = org.groups.find((x) => x.id === task.groupId)
    return g ? `${g.name} · 组` : '已删除小组'
  }
  if (task.scope === 'dept') {
    const d = org.departments.find((x) => x.id === task.departmentId)
    return d ? `${d.name} · 部门` : '已删除部门'
  }
  const u = org.users.find((x) => x.id === task.assigneeId)
  return u ? u.name : '已删除用户'
}

/**
 * 同一时刻只允许开一个 ⋯ 菜单。
 * 每个 TaskRow 各有各的 state, 光靠 window 的 click 监听关不掉别人那个 —— 因为点 ⋯ 时
 * 事件被 stopPropagation 了。这里记一下当前是谁开着的, 谁要开就先把上一个关掉。
 */
let openMenuOwner: { close: () => void } | null = null

/** 标记位宽度: 下拉箭头和子任务横杠都居中放在这一格里, 所以永远在同一条竖线上 */
const MARKER_W = 18
/** 复选框宽度 */
const CHECKBOX_W = 19
/** 标题单元格自己的左内边距 */
const TITLE_PAD = 8
/**
 * 子任务每一层向右缩进多少 —— 缩进发生在**标题单元格内部** (单元格宽度不变),
 * 所以不管嵌套几层、窗口多窄、列宽怎么拖, 后面那些数据列永远严格对齐。
 * 每层固定缩进, 配合连接线表示归属; 标题换行不改变后面各列的位置。
 */
const INDENT_STEP = 24

/**
 * 完成时间 / 记录时间 用的日期文字。
 * 不用 formatDue 那种「今天 / 明天 / 逾期 2 天」的相对说法 —— 那两个是截止日的口径,
 * 这里要的是「事情发生在哪一天」, 所以写绝对日期, 跨年才带上年份。
 */
function dayLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}年${md}`
}

export interface TaskRowProps {
  task: Task
  depth: number
  /** 上层最近的那个截止日 (自己没设日期时也用它做行首渐变, 并作为日期选择的上限) */
  ancestorDueAt?: string | null
  childDone: number
  childTotal: number
  hasChildren: boolean
  expanded: boolean
  onToggleExpand: () => void
  /** 打开整行表单 (要一次改多个字段 / 改周期规则时用) */
  onOpenFullForm: () => void
  onAddSubtask: () => void
  onInsertBelow: () => void
  /** 复制这条任务, 复制出来的会落在它下面 */
  onDuplicate: () => void
  /** 能不能拖 (按权限); 拖拽把手是整个任务名 */
  canDrag: boolean
  onDragStart: () => void
  onDragEnd: () => void
}

export function TaskRow({
  task,
  depth,
  ancestorDueAt,
  childDone,
  childTotal,
  hasChildren,
  expanded,
  onToggleExpand,
  onOpenFullForm,
  onAddSubtask,
  onInsertBelow,
  onDuplicate,
  canDrag,
  onDragStart,
  onDragEnd,
}: TaskRowProps) {
  const { org, user, toggleTask, claimTask, releaseTask, deleteTask, updateTask, pushToast, askConfirm } = useApp()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  /** 自己的菜单所有者标识 (稳定引用, 用来判断「当前开着的是不是我」) */
  const menuOwner = useRef<{ close: () => void } | null>(null)
  if (!menuOwner.current) menuOwner.current = { close: () => setMenu(null) }
  const closeMenu = useCallback(() => {
    setMenu(null)
    if (openMenuOwner === menuOwner.current) openMenuOwner = null
  }, [])
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(task.note)
  const noteCancel = useRef(false)

  useEffect(() => {
    if (!menu) return
    const close = () => closeMenu()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', close)
    window.addEventListener('contextmenu', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', close)
      window.removeEventListener('contextmenu', close, true)
      // 关掉的是自己那个菜单时, 把「当前菜单」的登记也清掉
      if (openMenuOwner === menuOwner.current) openMenuOwner = null
    }
  }, [menu, closeMenu])

  useEffect(() => setNoteDraft(task.note), [task.note])

  const done = task.status === 'done'
  const isRule = !!task.recurrence && !task.templateId
  // 可领/可抢: 派给我示例公司有限公司的 (领) + 我所在小组/部门的 (抢)
  const myGroups = user?.groupIds || []
  const canClaim =
    !task.assignmentPending &&
    !task.importSource?.group &&
    !isRule &&
    !done &&
    !task.ownerId &&
    (task.scope === 'user'
      ? task.assigneeId === user?.id
      : task.scope === 'group'
        ? !!task.groupId && myGroups.includes(task.groupId)
        : !!task.departmentId && task.departmentId === user?.departmentId)
  // 子任务的板块 / 类型跟随主任务, 行内不给改 (服务端也会忽略)
  const followsParent = !!task.parentId
  // 有子任务的任务: 完成状态由子任务推导 (子任务全完成会自动完成), 所以不给它手动的对勾框
  // (周期规则行除外 —— 那个对勾是「停用规则」的开关)
  const derivedDone = hasChildren && !isRule
  // 只有执行人本人能打勾; 别人看得到但按钮是灰的 (服务端也会拦)
  const canCheck = task.ownerId === user?.id
  // 行尾的到期渐变: **已逾期=红, 今天到期=橙, 明天到期=橙**; 已完成的不给。
  // 子任务自己没设日期时, 用上层的截止日 —— 和下面那一列的提示口径一致
  const inheritedDue = task.dueAt ? null : ancestorDueAt ?? null
  const dueIn = done ? null : daysUntilDue(task.dueAt || ancestorDueAt || null)
  // 子任务: 截止只能落在「今天 → 上层截止日」之间
  const dueMax = ancestorDueAt ?? null
  const dueMin =
    dueMax && new Date(dueMax).getTime() >= startOfDay(new Date()).getTime()
      ? startOfDay(new Date()).toISOString()
      : null
  const dueTone =
    dueIn === null
      ? ''
      : dueIn < 0
        ? ' is-due-overdue'
        : dueIn === 0
          ? ' is-due-today'
          : dueIn === 1
            ? ' is-due-tomorrow'
            : ''
  const mine = task.ownerId === user?.id || task.assigneeId === user?.id
  // 删除: 只有派发人(负责人)和管理员; 执行人不能删
  const canDelete = canDeleteTask(task, user)
  const canEdit = canEditTask(task, user)
  // 调整执行人: **只有负责人(管理员)** —— 派发人本人也不行
  const canAssign = user?.role === 'admin'
  // 截止日期: **只有派发人(和负责人)能定**。执行人认领之后也不能改 ——
  // 时间以派发人设的为准 (派发人没设的话, 就跟着上层主任务那个默认日期走)
  const canEditDue = user?.role === 'admin' || task.creatorId === user?.id
  /** 两个分类现在的名字 (板块 / 类型 可被负责人改名) */
  const dims = dimsOf(org)

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 先把别的行开着的菜单关掉, 免得叠着两个
    if (openMenuOwner && openMenuOwner !== menuOwner.current) openMenuOwner.close()
    openMenuOwner = menuOwner.current
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 210), y: Math.min(e.clientY, window.innerHeight - 270) })
  }

  const saveNote = async () => {
    setNoteOpen(false)
    if (noteCancel.current) {
      noteCancel.current = false
      setNoteDraft(task.note)
      return
    }
    if (noteDraft === task.note) return
    await updateTask(task.id, { note: noteDraft } as any)
  }

  return (
    <>
      <div
        className={`trow${done ? ' is-done' : ''}${isRule ? ' is-rule' : ''}${depth > 0 ? ' is-sub' : ' is-root'}${hasChildren ? ' is-parent' : ''}${dueTone}`}
        onContextMenu={openMenu}
        title={isRule ? `周期任务规则: ${targetText(task, org)} —— 按周期自动生成当天的待办` : undefined}
      >
        {/* 最前面是「把手」(四个点): 只有它能拖 —— 按住它拖 = 移动这条任务 (连带子树) */}
        <span className="trow-lead">
          <span className="lead-marker">
            {canDrag ? (
              <span
                className="row-grip"
                draggable
                title="按住拖动这一行: 拖到别的任务上会变成它的子任务, 拖到两行之间会变成同级"
                aria-label="按住拖动这一行"
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', task.id)
                  e.dataTransfer.effectAllowed = 'move'
                  // 抓手太小, 拿它当拖影会很迷 —— 改成拖整行的快照
                  const row = (e.currentTarget as HTMLElement).closest('.trow')
                  if (row) e.dataTransfer.setDragImage(row, 18, 22)
                  onDragStart()
                }}
                onDragEnd={onDragEnd}
              >
                <IconGrip4 size={14} />
              </span>
            ) : null}
          </span>
        </span>

        {/* 标题: 点一下改名。拖动不在这里了 —— 用最前面那个把手 */}
        <span className="trow-title" style={{ paddingLeft: TITLE_PAD + depth * INDENT_STEP,
          '--branch-left': `${TITLE_PAD + (depth - 1) * INDENT_STEP + CHECKBOX_W / 2}px` } as CSSProperties}>
          {derivedDone ? (
            // 有子任务的这条没有对勾 (完成状态由子任务推导), 那格正好放展开箭头 ——
            // 箭头于是紧贴在任务名前面, 左边不再留一大片空位
            <span className="checkbox-slot">
              <button
                className={`tree-toggle${expanded ? ' is-open' : ''}`}
                onClick={onToggleExpand}
                aria-label="展开/收起子任务"
                aria-expanded={expanded}
                title={expanded ? '收起子任务' : '展开子任务'}
              >
                <IconChevron size={13} />
              </button>
            </span>
          ) : (
            <button
              className={`checkbox${done ? ' is-on' : ''}`}
              disabled={!canCheck}
              title={
                isRule
                  ? done
                    ? '已停用, 不再自动生成待办'
                    : '勾选 = 停用这条周期规则, 不再自动生成待办'
                  : canCheck
                    ? done
                      ? '标记未完成'
                      : '标记完成'
                    : task.ownerId
                      ? `执行人是 ${org.users.find((u) => u.id === task.ownerId)?.name || '别人'}, 只有 TA 能打勾`
                      : '这条任务还没人领, 先「领」或「抢」下来再打勾'
              }
              aria-label={canCheck ? (done ? '标记未完成' : '标记完成') : '只有执行人能打勾'}
              onClick={() => void toggleTask(task)}
            >
              {done && <IconCheck size={12} />}
            </button>
          )}
          <TitleCell task={task} canEdit={canEdit} />
          {isRule && (
            <span
              className="rule-tag"
              title="周期任务: 按周期自动生成当天的待办; 前面的对勾勾上就是停用这条规则"
            >
              <IconRefresh size={12} />
            </span>
          )}
          {task.note.trim() && (
            <button className="trow-note-dot" title="有备注, 点这里编辑" onClick={() => setNoteOpen((v) => !v)} />
          )}
        </span>

        {/* 优先级: 点一下下拉选 (周期规则同样显示优先级) */}
        <span className="trow-cell">
          <PriorityCell task={task} canEdit={canEdit} />
        </span>

        {/* 进度: 按住拖动, 拉满即完成 (只有执行人能拖) */}
        <span className="trow-cell">
          <ProgressCell
            task={task}
            // 有子任务的主任务: 进度是子任务的平均值, 不能手动拖
            locked={hasChildren || task.ownerId !== user?.id}
            lockedHint={
              hasChildren
                ? '进度 = 子任务进度的平均值, 会自动跟着子任务走'
                : task.ownerId
                  ? `执行人是 ${org.users.find((u) => u.id === task.ownerId)?.name || '别人'}, 只有 TA 能改进度`
                  : '这条任务还没人领, 先领/抢下来再改进度'
            }
          />
        </span>

        {/* 派发人: 谁建的这条任务, 固定不可改 */}
        <span className="trow-cell">
          <CreatorCell task={task} />
        </span>

        {/* 执行人: 派给谁做。只有负责人能调, 其他人只读(小组/部门任务可以认领) */}
        <span className="trow-cell">
          {isRule ? (
            <span className="chip is-plain" title={targetText(task, org)}>
              {targetText(task, org)}
            </span>
          ) : (
            <ExecutorCell task={task} canAssign={canAssign} />
          )}
        </span>

        {/* 截止时间 (周期规则显示重复规则; 子任务没设日期时直接显示上层那个日期) */}
        <span className="trow-cell" title={inheritedDue ? '自己没设日期, 显示的是上层主任务的截止日' : undefined}>
          {isRule ? (
            <span className="chip is-plain">
              {REPEAT_LABEL[task.recurrence!.freq]} {task.recurrence!.at}
              {task.recurrence!.freq === 'weekly' && task.recurrence!.byWeekday?.length
                ? ' ' + task.recurrence!.byWeekday.map((i) => WEEKDAY_LABEL[i]).join('/')
                : ''}
            </span>
          ) : (
            <DueCell task={task} canEdit={canEditDue} inheritedDue={inheritedDue} maxDue={dueMax} minDue={dueMin} />
          )}
        </span>

        {/* 分类维度: 每个维度一列, 点一下下拉选 (子任务跟随主任务, 只读) */}
        {dims.map((d) => (
          <span
            key={d.id}
            className="trow-cell trow-cat"
            title={followsParent ? `子任务的${d.name}跟随主任务, 不能单独改` : undefined}
          >
            {isRule || followsParent ? (
              dimValueOf(task, d.id) || <span className="trow-empty">—</span>
            ) : (
              <DimCell task={task} dimId={d.id} canEdit={canEdit} />
            )}
          </span>
        ))}

        {/* 完成时间: 打对勾(或子任务全完成自动完成)那天的日期 */}
        <span className="trow-cell" title={task.doneAt ? `完成于 ${formatDay(task.doneAt)}` : done ? '原始记录未提供实际完成时间' : '还没完成'}>
          {task.doneAt ? <span className="trow-day">{dayLabel(task.doneAt)}</span> : <span className="trow-empty">—</span>}
        </span>

        {/* 记录时间: 这条任务建立(记下来)的日期 */}
        <span className="trow-cell" title={`记录于 ${formatDay(task.createdAt)}`}>
          <span className="trow-day">{dayLabel(task.createdAt)}</span>
        </span>

        <span className="trow-spacer" aria-hidden="true" />

        {/* 子任务进度 */}
        <span className="trow-cell">
          {childTotal > 0 ? (
            <span className={`chip${childTotal > 0 && childDone === childTotal ? ' is-ok' : ''}`}>
              {childDone}/{childTotal}
            </span>
          ) : (
            <span className="trow-empty">—</span>
          )}
        </span>

        <span className="trow-actions">
          <button className="icon-btn sm" title="添加子任务" aria-label="添加子任务" onClick={onAddSubtask}>
            <IconPlus size={14} />
          </button>
          <button className="icon-btn sm" title="更多" aria-label="更多操作" onClick={openMenu}>
            ⋯
          </button>
        </span>
      </div>

      {noteOpen && (
        <div className="trow-note-row">
          <span className="form-hint">备注</span>
          {task.evidence?.map((file, index) => file.storageKey.endsWith('/source.xlsx') && (user?.role !== 'admin' || user.managedDepartmentIds !== undefined) ? null : (
            <button key={file.storageKey} className="btn sm" title={file.name} onClick={() => {
              void api.get<{ url: string }>(`/api/tasks/${task.id}/evidence/${index}`)
                .then(({ url }) => window.open(url, '_blank', 'noopener,noreferrer'))
                .catch((error) => pushToast({ title: '附件无法打开', body: error.message, kind: 'error' }))
            }}>{file.name}</button>
          ))}
          <input
            autoFocus
            className="form-note"
            value={noteDraft}
            placeholder="写点上下文、验收标准…"
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                noteCancel.current = true
                e.currentTarget.blur()
              }
            }}
          />
          <button className="btn primary sm" onClick={() => void saveNote()}>
            保存
          </button>
        </div>
      )}

      {menu && (
        <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button className="ctx-item" onClick={() => { closeMenu(); onInsertBelow() }}>
            <IconPlus size={13} /> 在下方添加任务
          </button>
          <button className="ctx-item" onClick={() => { closeMenu(); onDuplicate() }}>
            <IconCopy size={13} /> 复制该任务
          </button>
          <button className="ctx-item" onClick={() => { closeMenu(); onAddSubtask() }}>
            <IconPlus size={13} /> 添加子任务
          </button>
          <button className="ctx-item" onClick={() => { closeMenu(); setNoteOpen(true) }}>
            编辑备注
          </button>
          <button className="ctx-item" onClick={() => { closeMenu(); onOpenFullForm() }}>
            编辑全部字段…
          </button>
          {!isRule && (
            canCheck && (
              <button className="ctx-item" onClick={() => { closeMenu(); void toggleTask(task) }}>
                <IconCheck size={13} /> {done ? '标记未完成' : '标记完成'}
              </button>
            )
          )}
          {canClaim && (
            <button className="ctx-item" onClick={() => { closeMenu(); void claimTask(task.id) }}>
              <IconCheck size={13} /> {task.scope === 'user' ? '领' : '抢'}
            </button>
          )}
          {!isRule && !done && mine && task.scope !== 'user' && (
            <button className="ctx-item" onClick={() => { closeMenu(); void releaseTask(task.id) }}>
              退回未认领
            </button>
          )}
          {canDelete && (
            <>
              <span className="ctx-sep" />
              <button
                className="ctx-item is-danger"
                onClick={() => {
                  closeMenu()
                  // 不弹确认: 删除只是丢进回收站, 需要时去那里恢复
                  void (async () => {
                    try {
                      await deleteTask(task.id)
                      pushToast({
                        title: '已移到回收站',
                        body: childTotal ? `含 ${childTotal} 条子任务 · 可在「回收站」恢复` : '可在「回收站」恢复',
                        kind: 'info',
                      })
                    } catch (e: any) {
                      pushToast({ title: '删除失败', body: e?.message || String(e), kind: 'error' })
                    }
                  })()
                }}
              >
                <IconTrash size={13} /> 删除任务
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}


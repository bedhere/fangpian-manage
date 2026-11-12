import { useEffect, useState } from 'react'
import { useApp } from '../store/AppProvider'
import { UserAvatar } from '../components/Avatar'
import { SettingsPanel } from '../components/SettingsPanel'
import { ToastStack } from '../components/ToastStack'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TaskDetail } from '../components/TaskDetail'
import { TrashPanel } from '../components/TrashPanel'
import { MemoWindow } from '../components/MemoWindow'
import { DesktopAppPanel } from '../components/DesktopAppPanel'
import { WecomPanel } from '../components/WecomPanel'
import { IconCheck, IconChevron, IconDesktop, IconDownload, IconList, IconLogout, IconSettings, IconTrash, IconUser } from '../components/Icons'
import { useBoardActions } from '../store/BoardActions'
import { BoardView } from './BoardView'
import { AppraisalView } from './AppraisalView'
import { IconGrip } from '../components/Icons'

export function Shell({ onOpenWidget }: { onOpenWidget?: () => void }) {
  const { user, summary, refresh, memos, logout, pushToast } = useApp()
  const board = useBoardActions()
  /**
   * 回收站里的条数。
   * 直接读全局统计 (summary), 不看板注册什么 —— 以前是靠 BoardView 把条数注册到顶栏,
   * 一旦那一步因为时序/页面切换没跑到, 角标就整个不出现; 现在跟看板挂不挂载无关。
   */
  const trashCount = summary?.trash ?? 0
  /** 头像菜单上「备忘录」那一行显示的未完成条数 */
  const pendingMemos = memos.filter((m) => !m.done).length
  /** 顶栏「导出」的小菜单开着没 */
  const [exportOpen, setExportOpen] = useState(false)
  const [wecomOpen, setWecomOpen] = useState(false)
  /** 回收站面板 (放在这里而不是看板里: 「绩效」页也能打开) */
  const [trashOpen, setTrashOpen] = useState(false)
  /** 右上角头像菜单开着没 */
  const [userMenu, setUserMenu] = useState(false)
  /** 备忘录独立窗口 */
  const [memoOpen, setMemoOpen] = useState(false)
  /** 「浏览器小窗」面板 */
  const [deskOpen, setDeskOpen] = useState(false)
  /** 'board' = 待办看板; 'appraisal' = 月度绩效考核 */
  const [page, setPage] = useState<'board' | 'appraisal'>('board')
  /** null=关着; 'main'=设置主页; 'account'=账号与安全 */
  const [settingsPage, setSettingsPage] = useState<null | 'main' | 'account'>(null)

  // 点别处 / 滚动 / Esc 关掉导出菜单
  useEffect(() => {
    if (!exportOpen) return
    const close = (e?: Event) => {
      const el = e?.target as HTMLElement | null
      if (el && typeof el.closest === 'function' && el.closest('.topbar-export')) return
      setExportOpen(false)
    }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', () => setExportOpen(false))
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [exportOpen])

  // 点别处 / 滚动 / Esc 关掉头像菜单
  useEffect(() => {
    if (!userMenu) return
    const close = (e?: Event) => {
      const el = e?.target as HTMLElement | null
      if (el && typeof el.closest === 'function' && el.closest('.user-wrap')) return
      setUserMenu(false)
    }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', () => setUserMenu(false))
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [userMenu])

  // 切回这个标签页时顺手刷一下统计, 保证回收站条数是新的 (别人删了东西也能看到)
  useEffect(() => {
    const onFocus = () => void refresh(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark">
            <IconCheck size={14} />
          </span>
          <strong>部门待办</strong>
        </div>

        <div className="topbar-right">
          {onOpenWidget && (
            <button className="btn ghost sm" title="桌面小窗预览" onClick={onOpenWidget}>
              小窗
            </button>
          )}
          <div className="seg sm topbar-nav">
            <button className={`seg-btn${page === 'board' ? ' is-on' : ''}`} onClick={() => setPage('board')}>
              待办
            </button>
            <button className={`seg-btn${page === 'appraisal' ? ' is-on' : ''}`} onClick={() => setPage('appraisal')}>
              绩效
            </button>
          </div>
          {board && page === 'board' && (
            <div className="topbar-export">
              <button
                className="icon-btn"
                title="导出表格"
                aria-label="导出表格"
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                onClick={() => setExportOpen((v) => !v)}
              >
                <IconDownload size={16} />
              </button>
              {exportOpen && (
                <div className="ctx-menu topbar-menu" role="menu">
                  <button className="ctx-item" onClick={() => {setExportOpen(false);setWecomOpen(true)}}>示例品牌在线表格<em>导入任务 / 写回进度</em></button>
                  <span className="ctx-sep" />
                  <button className="ctx-item" onClick={() => { setExportOpen(false); board.exportWork('today') }}>
                    今日工作
                    <em>今天到期 / 已逾期</em>
                  </button>
                  <button className="ctx-item" onClick={() => { setExportOpen(false); board.exportWork('week') }}>
                    本周工作
                    <em>本周一 ~ 周日到期</em>
                  </button>
                  <button className="ctx-item" onClick={() => { setExportOpen(false); board.exportWork('month') }}>
                    本期工作
                    <em>本月到期</em>
                  </button>
                  <span className="ctx-sep" />
                  <p className="export-hint">按当前视图与筛选导出; 想连已完成一起导, 先打开「隐藏已完成」开关。</p>
                </div>
              )}
            </div>
          )}
          <button
            className="icon-btn"
            title={trashCount > 0 ? `回收站 · ${trashCount} 条待处理` : '回收站'}
            aria-label="回收站"
            onClick={() => setTrashOpen(true)}
          >
            <IconTrash size={16} />
            {trashCount > 0 && (
              <span className="icon-badge" aria-hidden="true">
                {trashCount > 99 ? '99+' : trashCount}
              </span>
            )}
          </button>
          <button
            className="icon-btn"
            title="浏览器小窗 (Windows / macOS)"
            aria-label="浏览器小窗"
            onClick={() => setDeskOpen(true)}
          >
            <IconDesktop size={16} />
          </button>
          <button className="icon-btn" title="设置" aria-label="设置" onClick={() => setSettingsPage('main')}>
            <IconSettings size={16} />
          </button>
          <div className="user-wrap">
            <button
              className={`user-chip${userMenu ? ' is-on' : ''}`}
              title="账号 / 备忘录 / 切用户 / 退出"
              aria-haspopup="menu"
              aria-expanded={userMenu}
              onClick={() => setUserMenu((v) => !v)}
            >
              <UserAvatar user={user} size={22} />
              <span>{user?.name}</span>
              <IconChevron size={12} />
            </button>
            {userMenu && (
              <div className="ctx-menu topbar-menu user-menu" role="menu">
                <div className="user-menu-head">
                  <UserAvatar user={user} size={30} />
                  <span className="user-menu-id">
                    <strong>{user?.name}</strong>
                    <em>
                      {user?.title || (user?.role === 'admin' ? '管理员' : '成员')} · {user?.account}
                    </em>
                  </span>
                </div>
                <span className="ctx-sep" />
                <button
                  className="ctx-item"
                  onClick={() => {
                    setUserMenu(false)
                    setSettingsPage('account')
                  }}
                >
                  <IconUser size={13} /> 账号与安全
                </button>
                <button
                  className="ctx-item"
                  onClick={() => {
                    setUserMenu(false)
                    setMemoOpen(true)
                  }}
                >
                  <IconList size={13} /> 备忘录
                  <em>{pendingMemos ? `${pendingMemos} 条未完成` : '全部完成'}</em>
                </button>
                <button
                  className="ctx-item"
                  onClick={async () => {
                    setUserMenu(false)
                    await logout()
                    pushToast({ title: '已退出, 换个账号登录', body: '', kind: 'info' })
                  }}
                >
                  <IconUser size={13} /> 切换用户
                </button>
                <button
                  className="ctx-item danger"
                  onClick={async () => {
                    setUserMenu(false)
                    await logout()
                  }}
                >
                  <IconLogout size={13} /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="shell-main">
        {page === 'board' ? <BoardView /> : <AppraisalView />}
      </main>

      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
      {memoOpen && <MemoWindow onClose={() => setMemoOpen(false)} />}
      {deskOpen && <DesktopAppPanel onClose={() => setDeskOpen(false)} onOpenWidget={onOpenWidget} />}
      {wecomOpen && <WecomPanel onClose={() => setWecomOpen(false)} />}
      {settingsPage && <SettingsPanel initialPage={settingsPage} onClose={() => setSettingsPage(null)} />}
      <ToastStack />
      <TaskDetail />
      <ConfirmDialog />
    </div>
  )
}


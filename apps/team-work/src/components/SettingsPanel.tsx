import { useState } from 'react'
import { getServerUrl } from '../api/client'
import { requestNotifyPermission } from '../notify'
import { isDesktopShell } from '../notify'
import { dimNames } from '../domain/types'
import { useApp } from '../store/AppProvider'
import { AdminView } from '../views/AdminView'
import { AccountSettings } from './AccountSettings'
import { IconBell } from './Icons'
import { TimeSelect } from './TimeSelect'

export function SettingsPanel({
  onClose,
  initialPage = 'main',
}: {
  onClose: () => void
  /** 从哪一页打开 —— 点头像直接进「账号与安全」, 点齿轮进「设置」主页 */
  initialPage?: 'main' | 'account' | 'admin'
}) {
  const { settings, setSettings, org, user, updateServerUrl } = useApp()
  const dims = dimNames(org)
  const [server, setServer] = useState(getServerUrl())
  const [page, setPage] = useState<'main' | 'account' | 'admin'>(initialPage)
  const desktop = isDesktopShell()

  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div className={`modal${page === 'admin' ? ' modal-wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{page === 'account' ? '账号与安全' : page === 'admin' ? '管理' : '设置'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="modal-body">
          {page === 'account' ? (
            <AccountSettings onBack={() => setPage('main')} />
          ) : page === 'admin' ? (
            <>
              <button className="modal-back" onClick={() => setPage('main')}>
                ‹ 返回设置
              </button>
              <AdminView embedded />
            </>
          ) : (
          <>
          <section className="setting-block">
            <h3>外观</h3>
            <p className="setting-note">与方片保持一致，使用统一的暖白与明黄配色。</p>
          </section>

          <section className="setting-block">
            <h3>提醒</h3>
            <label className="switch-row">
              <span>
                系统通知
                <em>到点的任务弹系统原生通知</em>
              </span>
              <button
                className={`switch${settings.notificationsEnabled ? ' is-on' : ''}`}
                onClick={async () => { if (settings.notificationsEnabled) { setSettings({ notificationsEnabled: false }); return; } const result = await requestNotifyPermission(); setSettings({ notificationsEnabled: result === 'web' || result === 'native' }); }}
              >
                <span />
              </button>
            </label>
            <label className="switch-row">
              <span>
                免打扰时段
                <em>这段时间内不弹通知, 提醒顺延到结束后</em>
              </span>
              <button className={`switch${settings.dndEnabled ? ' is-on' : ''}`} onClick={() => setSettings({ dndEnabled: !settings.dndEnabled })}>
                <span />
              </button>
            </label>
            {settings.dndEnabled && (
              <div className="quick-row">
                <TimeSelect value={settings.dndStart} onChange={(v) => setSettings({ dndStart: v })} />
                <span className="dash">→</span>
                <TimeSelect value={settings.dndEnd} onChange={(v) => setSettings({ dndEnd: v })} />
              </div>
            )}
          </section>

          {desktop && (
            <section className="setting-block">
              <h3>服务器地址</h3>
              <p className="setting-note">桌面小窗连的是哪台机器的服务。改完会重新加载并需要重新登录。</p>
              <div className="quick-row">
                <input className="input" value={server} placeholder="http://192.168.1.20:3001" onChange={(e) => setServer(e.target.value)} />
                <button className="btn sm" onClick={() => updateServerUrl(server)}>
                  保存并重载
                </button>
              </div>
            </section>
          )}

          {user?.role === 'admin' && (
            <section className="setting-block">
              <h3>管理</h3>
              <button className="account-row" onClick={() => setPage('admin')}>
                <span className="account-row-icon">⚙</span>
                <span className="account-row-text">
                  <strong>部门 / 小组 / 成员</strong>
                  <em>使用方片统一的部门、成员与权限管理</em>
                </span>
                <span className="account-row-hint">进入 ›</span>
              </button>
              <p className="field-note">只有负责人(管理员)能看到这一项。</p>
            </section>
          )}

          <section className="setting-block">
            <h3>会话</h3>
            <p className="field-note">
              切换用户 / 退出登录 都搬到右上角你自己的头像那里了 (点头像 → 菜单里选)。
            </p>
          </section>

          <p className="setting-footnote">
            <IconBell size={12} /> 页面保持打开时，每约 20 秒检查提醒；关闭页面后停止提醒。
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}

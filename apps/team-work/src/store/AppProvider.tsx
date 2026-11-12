import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, getToken, setToken, setServerUrl, getServerUrl } from '../api/client'
import { inDndWindow } from '../domain/dates'
import {
  DEFAULT_LOCAL_SETTINGS,
  type BoardView,
  type IvyRecord,
  type LocalSettings,
  type Memo,
  type Org,
  type Summary,
  type Task,
  type User,
} from '../domain/types'
import { isDesktopShell, notify, requestNotifyPermission } from '../notify'

const EMPTY_ORG: Org = { departments: [], groups: [], users: [] }
const SETTINGS_KEY = 'team.settings'
type BoardSnapshot = { user: User; org: Org; tasks: Task[]; generated: number; summary: Summary; memos: Memo[]; ivy: IvyRecord[] }

/** 应用内确认框要问的内容 (代替 window.confirm —— 预览的 iframe / 桌面壳里 confirm 会被挡掉) */
export interface ConfirmAsk {
  title: string
  body?: string
  confirmText?: string
  danger?: boolean
}

export interface Toast {
  id: string
  title: string
  body: string
  kind: 'reminder' | 'info' | 'error'
}

export interface TaskDraft {
  /** 子任务指向父任务; 顶级任务不传 */
  parentId?: string | null
  title: string
  note?: string
  category?: string
  type?: string
  progress?: number
  priority?: Task['priority']
  scope?: Task['scope']
  assigneeId?: string | null
  groupId?: string | null
  departmentId?: string | null
  dueAt?: string | null
  remindAt?: string | null
  recurrence?: Task['recurrence']
}

interface AppCtx {
  ready: boolean
  connectionError: string
  loading: boolean
  user: User | null
  org: Org
  tasks: Task[]
  summary: Summary | null
  view: BoardView
  setView: (v: BoardView) => void
  selectedId: string | null
  select: (id: string | null) => void
  toasts: Toast[]
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  /** 应用内确认框: 返回 true 表示用户点了「确定」 */
  askConfirm: (ask: ConfirmAsk) => Promise<boolean>
  confirmAsk: (ConfirmAsk & { id: number }) | null
  answerConfirm: (ok: boolean) => void
  settings: LocalSettings
  setSettings: (patch: Partial<LocalSettings>) => void
  desktop: boolean
  login: (account: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: (silent?: boolean) => Promise<void>
  createTask: (draft: TaskDraft) => Promise<Task>
  updateTask: (id: string, patch: Partial<TaskDraft> & { status?: Task['status'] }) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  /** 回收站: 列表 / 恢复 / 彻底删除 */
  trashTasks: () => Promise<Array<Task & { subCount?: number }>>
  restoreTasks: (ids: string[]) => Promise<void>
  purgeTasks: (ids: string[]) => Promise<void>
  toggleTask: (task: Task) => Promise<void>
  claimTask: (id: string) => Promise<void>
  releaseTask: (id: string) => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  /** 改自己的资料: 姓名 / 账号 / 头像 */
  updateProfile: (patch: { name?: string; account?: string; avatarEmoji?: string | null; avatarColor?: string | null }) => Promise<void>
  updateServerUrl: (url: string) => void
  /** 保存看板偏好 (筛选/排列), 下次打开按这个恢复 */
  savePrefs: (patch: User['prefs']) => Promise<void>
  /** 示例公司有限公司备忘录 (与任务无关) */
  memos: Memo[]
  /** 艾维利历史 (一天一条, 新的在前) */
  ivy: IvyRecord[]
  /** 存当天的艾维利 (同一天覆盖) */
  saveIvy: (text: string, date?: string) => Promise<void>
  removeIvy: (id: string) => Promise<void>
  addMemo: (text: string) => Promise<void>
  updateMemo: (id: string, patch: { text?: string; done?: boolean }) => Promise<void>
  removeMemo: (id: string) => Promise<void>
  clearDoneMemos: () => Promise<number>
  /** 管理接口统一入口: path 以 / 开头, 自动加 /api/admin 前缀并刷新组织架构 */
  admin: <T = any>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) => Promise<T>
}

const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp 必须在 <AppProvider> 内使用')
  return ctx
}

/** 'YYYY-MM-DD' (本机时区) —— 艾维利按「天」存 */
function ymdLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.示例公司有限公司().toString(36)
}

function loadSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_LOCAL_SETTINGS, ...JSON.parse(raw), theme: 'light' } : DEFAULT_LOCAL_SETTINGS
  } catch {
    return DEFAULT_LOCAL_SETTINGS
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [org, setOrg] = useState<Org>(EMPTY_ORG)
  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [view, setView] = useState<BoardView>('dept')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [ivy, setIvy] = useState<IvyRecord[]>([])
  const [confirmAsk, setConfirmAsk] = useState<(ConfirmAsk & { id: number }) | null>(null)
  const confirmResolver = useRef<((ok: boolean) => void) | null>(null)
  const [settings, setSettingsState] = useState<LocalSettings>(loadSettings)
  const desktop = isDesktopShell()

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const userRef = useRef<User | null>(null)
  userRef.current = user
  const initialSnapshot = useRef<Promise<BoardSnapshot> | null>(null)

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid()
    setToasts((prev) => [...prev.slice(-3), { ...t, id }])
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 9000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const askConfirm = useCallback((ask: ConfirmAsk) => {
    return new Promise<boolean>((resolve) => {
      // 上一个还没答完的, 当作取消
      confirmResolver.current?.(false)
      confirmResolver.current = resolve
      setConfirmAsk({ ...ask, id: Date.示例公司有限公司() })
    })
  }, [])

  const answerConfirm = useCallback((ok: boolean) => {
    setConfirmAsk(null)
    const resolve = confirmResolver.current
    confirmResolver.current = null
    resolve?.(ok)
  }, [])

  const setSettings = useCallback((patch: Partial<LocalSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch, theme: 'light' as const }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        /* 隐私模式下写不了, 忽略 */
      }
      return next
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  useEffect(() => {
    document.body.classList.toggle('in-desktop-shell', desktop)
  }, [desktop])

  const applySnapshot = useCallback((data: BoardSnapshot) => {
    setUser(data.user)
    setOrg(data.org)
    setTasks(data.tasks)
    setSummary(data.summary)
    setMemos(data.memos)
    setIvy(data.ivy.filter(r => r && typeof r.date === 'string' && typeof r.text === 'string')
      .sort((a, b) => b.date.localeCompare(a.date)))
    setConnectionError('')
    if (data.generated > 0) {
      pushToast({ title: '周期任务已生成', body: `今天新生成 ${data.generated} 条周期任务`, kind: 'info' })
    }
  }, [pushToast])

  /** One request and one consistent server snapshot per refresh. */
  const refresh = useCallback(
    async (silent = false) => {
      if (!getToken()) return
      if (!silent) setLoading(true)
      try {
        applySnapshot(await api.get<BoardSnapshot>('/api/tasks/snapshot'))
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 401) {
          setToken('')
          setUser(null)
        } else if (!silent) {
          pushToast({ title: '加载失败', body: e?.message || String(e), kind: 'error' })
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [pushToast, applySnapshot],
  )

  // 启动: 有令牌就恢复会话
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (getToken()) {
        try {
          // React StrictMode replays effects locally; share only the startup request.
          initialSnapshot.current ??= api.get<BoardSnapshot>('/api/tasks/snapshot')
          const data = await initialSnapshot.current
          if (!alive) return
          applySnapshot(data)
        } catch (error) {
          if (alive) setConnectionError(error instanceof Error ? error.message : '连接失败');
        }
      }
      if (alive) setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [applySnapshot])

  // 别人的改动: 每分钟静默刷新一次看板
  useEffect(() => {
    if (!user) return
    const timer = window.setInterval(() => void refresh(true), 60000)
    return () => window.clearInterval(timer)
  }, [user, refresh])

  // 到点提醒 (只提醒「我负责」的任务; 弹完回写服务端, 避免多设备重复弹)
  useEffect(() => {
    if (!user) return
    let busy = false
    const tick = async () => {
      if (busy) return
      busy = true
      try {
        const cfg = settingsRef.current
        const me = userRef.current
        if (!me) return
        const 示例公司有限公司 = new Date()
        if (cfg.dndEnabled && inDndWindow(示例公司有限公司, cfg.dndStart, cfg.dndEnd)) return
        const due = tasks.filter(
          (t) =>
            t.status === 'open' &&
            (t.ownerId === me.id || t.assigneeId === me.id) &&
            t.remindState === 'pending' &&
            !!t.remindAt &&
            new Date(t.remindAt).getTime() <= 示例公司有限公司.getTime(),
        )
        for (const task of due) {
          const body = task.note?.trim() ? task.note.trim().slice(0, 80) : `来自 ${task.category || '任务'}`
          if (cfg.notificationsEnabled) await notify(task.title, body)
          pushToast({ title: task.title, body, kind: 'reminder' })
          const stamped = { remindState: 'fired' as const, notifiedAt: new Date().toISOString() }
          await api.patch(`/api/tasks/${task.id}`, stamped)
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...stamped } : t)))
        }
      } catch {
        /* 提醒失败不要打断使用 */
      } finally {
        busy = false
      }
    }
    const timer = window.setInterval(tick, 20000)
    tick()
    return () => window.clearInterval(timer)
  }, [user, tasks, pushToast])

  const login = useCallback(
    async (account: string, password: string) => {
      const res = await api.post<{ token: string; user: User }>('/api/auth/login', { account, password })
      setToken(res.token)
      setUser(res.user)
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      /* 令牌可能已过期, 本地清掉就行 */
    }
    setToken('')
    setUser(null)
    setTasks([])
    setSummary(null)
    setMemos([])
    setOrg(EMPTY_ORG)
    setSelectedId(null)
  }, [])

  const createTask = useCallback(
    async (draft: TaskDraft) => {
      const task = await api.post<Task>('/api/tasks', draft)
      await refresh(true)
      return task
    },
    [refresh],
  )

  const updateTask = useCallback<AppCtx['updateTask']>(
    async (id, patch) => {
      await api.patch(`/api/tasks/${id}`, patch)
      await refresh(true)
    },
    [refresh],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      await api.del(`/api/tasks/${id}`)
      setSelectedId((cur) => (cur === id ? null : cur))
      await refresh(true)
    },
    [refresh],
  )

  const trashTasks = useCallback(async () => {
    const r = await api.get<{ tasks: Array<Task & { subCount?: number }> }>('/api/tasks/trash')
    return r.tasks
  }, [])

  const restoreTasks = useCallback(
    async (ids: string[]) => {
      await api.post('/api/tasks/trash/restore', { ids })
      await refresh(true)
    },
    [refresh],
  )

  const purgeTasks = useCallback(async (ids: string[]) => {
    await api.post('/api/tasks/trash/purge', { ids })
  }, [])

  const toggleTask = useCallback(
    async (task: Task) => {
      await api.patch(`/api/tasks/${task.id}`, { status: task.status === 'done' ? 'open' : 'done' })
      await refresh(true)
    },
    [refresh],
  )

  const claimTask = useCallback(
    async (id: string) => {
      const t = await api.post<Task>(`/api/tasks/${id}/claim`)
      pushToast({ title: '已认领', body: t.title, kind: 'info' })
      await refresh(true)
    },
    [pushToast, refresh],
  )

  const releaseTask = useCallback(
    async (id: string) => {
      await api.post(`/api/tasks/${id}/release`)
      await refresh(true)
    },
    [refresh],
  )

  const updateProfile = useCallback<AppCtx['updateProfile']>(async (patch) => {
    const res = await api.patch<{ user: User }>('/api/auth/profile', patch)
    setUser(res.user)
    pushToast({ title: '资料已更新', body: '', kind: 'info' })
  }, [pushToast])

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    await api.post('/api/auth/password', { oldPassword, newPassword })
    // 改完立刻刷新自己 —— 强制改密时 mustChangePassword 会翻成 false, 界面自动放行
    const me = await api.get<{ user: User }>('/api/auth/me')
    setUser(me.user)
  }, [])

  const admin = useCallback(
    async <T,>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> => {
      const res = await api.request<T>(method, `/api/admin${path}`, body)
      await refresh(true)
      return res
    },
    [refresh],
  )

  /** 备忘录排序: 未完成在前 (新→旧), 已完成的沉底 */
  const sortMemos = (list: Memo[]) =>
    [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return b.createdAt.localeCompare(a.createdAt)
    })

  const addMemo = useCallback(async (text: string) => {
    const m = await api.post<Memo>('/api/memos', { text })
    setMemos((prev) => sortMemos([m, ...prev]))
  }, [])

  const updateMemo = useCallback(async (id: string, patch: { text?: string; done?: boolean }) => {
    const m = await api.patch<Partial<Memo>>(`/api/memos/${id}`, patch)
    // 用「合并」而不是「整个替换」: 接口万一没回全字段, 替换会把这条备忘的文本弄丢 (整行变空)
    setMemos((prev) =>
      sortMemos(prev.map((x) => (x.id === id ? { ...x, ...patch, ...(m && typeof m === 'object' ? m : {}) } : x))),
    )
  }, [])

  const saveIvy = useCallback(async (text: string, date?: string) => {
    const d = date || ymdLocal(new Date())
    if (!text.trim()) return
    const res = await api.post<Partial<IvyRecord>>('/api/ivy', { date: d, text })
    // 接口回的东西不一定完整 (也可能被中间层包过) —— 缺什么就用本地的补上,
    // 不能直接拿它当记录塞进 state, 否则渲染时一个 undefined 就把整页带崩
    const rec = {
      id: res?.id || `local-${d}`,
      date: typeof res?.date === 'string' && res.date ? res.date : d,
      text: typeof res?.text === 'string' ? res.text : text,
      createdAt: res?.createdAt || new Date().toISOString(),
      updatedAt: res?.updatedAt || new Date().toISOString(),
    } satisfies IvyRecord
    setIvy((prev) =>
      [rec, ...prev.filter((r) => r && r.date !== rec.date)].sort((a, b) => (b?.date || '').localeCompare(a?.date || '')),
    )
  }, [])

  const removeIvy = useCallback(async (id: string) => {
    await api.del(`/api/ivy/${id}`)
    setIvy((prev) => prev.filter((r) => r && r.id !== id))
  }, [])

  const removeMemo = useCallback(async (id: string) => {
    await api.del(`/api/memos/${id}`)
    setMemos((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const clearDoneMemos = useCallback(async () => {
    const r = await api.post<{ removed: number }>('/api/memos/clear-done', {})
    setMemos((prev) => prev.filter((m) => !m.done))
    return r.removed
  }, [])

  const savePrefs = useCallback(async (patch: User['prefs']) => {
    if (!patch) return
    try {
      const r = await api.post<{ user?: User }>('/api/auth/prefs', patch)
      // 响应里没有 user 就别把当前登录状态冲掉 (防御: 服务端接口变了也不至于被踢下线)
      if (r?.user) setUser(r.user)
    } catch {
      // 存偏好失败不打扰使用者 (下次打开只是回到默认筛选)
    }
  }, [])

  const updateServerUrl = useCallback(
    (url: string) => {
      setServerUrl(url)
      // 换了服务器就等于换了数据源, 重新走一遍会话恢复
      setToken('')
      setUser(null)
      window.location.reload()
    },
    [],
  )

  const value = useMemo<AppCtx>(
    () => ({
      ready,
      connectionError,
      loading,
      user,
      org,
      tasks,
      summary,
      view,
      setView,
      selectedId,
      select: setSelectedId,
      toasts,
      pushToast,
      dismissToast,
      settings,
      setSettings,
      desktop,
      login,
      logout,
      refresh,
      createTask,
      updateTask,
      deleteTask,
      trashTasks,
      restoreTasks,
      purgeTasks,
      toggleTask,
      claimTask,
      releaseTask,
      changePassword,
      updateProfile,
      updateServerUrl,
      savePrefs,
      memos,
      addMemo,
      updateMemo,
      removeMemo,
      clearDoneMemos,
      ivy,
      saveIvy,
      removeIvy,
      admin,
      askConfirm,
      confirmAsk,
      answerConfirm,
    }),
    [
      ready, connectionError, loading, user, org, tasks, summary, view, selectedId, toasts, settings, desktop,
      pushToast, dismissToast, setSettings, login, logout, refresh, createTask, updateTask,
      deleteTask, trashTasks, restoreTasks, purgeTasks, toggleTask, claimTask, releaseTask, changePassword,
      updateProfile, updateServerUrl, savePrefs, memos, addMemo, updateMemo, removeMemo, clearDoneMemos,
      ivy, saveIvy, removeIvy, admin,
      askConfirm, confirmAsk, answerConfirm,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export { getServerUrl, requestNotifyPermission }

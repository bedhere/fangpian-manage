import { useCallback, useEffect, useRef, useState } from 'react'
import { isDesktopShell, setWindowMode } from './notify'
import { BoardActionsProvider } from './store/BoardActions'
import { AppProvider, useApp } from './store/AppProvider'
import { navigateParent } from './api/client'
import { Shell } from './views/Shell'
import { WidgetView } from './views/WidgetView'
import '../../../packages/ui/src/theme.css'
import './styles.css'
import './fangpian.css'

type Mode = 'full' | 'widget'

function initialMode(): Mode {
  if (typeof window === 'undefined') return 'full'
  return new URLSearchParams(window.location.search).get('mode') === 'widget' ? 'widget' : 'full'
}

/** 距屏幕边缘至少留这么多像素, 保证小窗永远还能被抓住 */
const EDGE_PAD = 10
/** 小窗的可调范围与默认值 (尺寸记在浏览器里) */
const MIN_W = 240
const MIN_H = 160
const DEFAULT_W = 320
const DEFAULT_H = 420
const SIZE_KEY = 'team.widgetSize'
const EDGE_MARGIN = 46

function loadSize(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(SIZE_KEY)
    if (!raw) return { w: DEFAULT_W, h: DEFAULT_H }
    const v = JSON.parse(raw)
    return {
      w: Number.isFinite(v?.w) && v.w >= MIN_W ? v.w : DEFAULT_W,
      h: Number.isFinite(v?.h) && v.h >= MIN_H ? v.h : DEFAULT_H,
    }
  } catch {
    return { w: DEFAULT_W, h: DEFAULT_H }
  }
}

/** 八个方向对应的鼠标指针 */
const RESIZE_CURSOR: Record<string, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
}

/**
 * 浏览器里预览小窗: 套一层假桌面, 可以拖着玩。
 *
 * ⚠️ 拖拽必须用「相对位移」算: 小窗是锚在右下角 (right/bottom) 再叠加 translate 的,
 * 早先直接把鼠标的视口坐标当成位移量, 结果鼠标一动小窗就飞到屏幕外 —— 表现就是
 * 「点一下就消失」。现在改成 位移 = 起点位移 + (当前鼠标 - 按下时鼠标), 并且钳在视口内。
 */
function WidgetPreview({ onExpand }: { onExpand: () => void }) {
  /**
   * 像真窗口一样缩放:
   *   · 锚点用**左上角**(x/y 就是左上角坐标), 所以往右拖右边缘就往右长, 鼠标指哪长哪
   *   · 八个方向都能拉(四边 + 四角), 鼠标贴到边上会变成对应的缩放指针
   *   · 尺寸记在浏览器里, 下次打开还是这个大小
   */
  const [rect, setRect] = useState(() => {
    const { w, h } = loadSize()
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1400
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900
    return { x: Math.max(8, vw - EDGE_MARGIN - w), y: Math.max(8, vh - EDGE_MARGIN - h), w, h }
  })
  const [collapsed, setCollapsed] = useState(false)
  const [moving, setMoving] = useState(false)
  const [resizing, setResizing] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mx: number; my: number; start: { x: number; y: number; w: number; h: number } } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify({ w: rect.w, h: rect.h }))
    } catch {
      /* 忽略 */
    }
  }, [rect.w, rect.h])

  /** 按住顶部空白处 → 移动整个小窗 (跟手) */
  const onMoveStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      drag.current = { mx: e.clientX, my: e.clientY, start: { ...rect } }
      setMoving(true)
      const onMove = (ev: PointerEvent) => {
        const d = drag.current
        if (!d) return
        setRect({ ...d.start, x: d.start.x + (ev.clientX - d.mx), y: d.start.y + (ev.clientY - d.my) })
      }
      const onUp = () => {
        drag.current = null
        setMoving(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [rect],
  )

  /** 拖某个方向 → 缩放 (完全跟随鼠标) */
  const onResizeStart = useCallback(
    (dir: string) => (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const start = { ...rect }
      const mx = e.clientX
      const my = e.clientY
      setResizing(dir)
      document.body.style.cursor = RESIZE_CURSOR[dir]
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - mx
        const dy = ev.clientY - my
        let { x, y, w, h } = start
        if (dir.includes('e')) w = start.w + dx
        if (dir.includes('s')) h = start.h + dy
        if (dir.includes('w')) {
          w = start.w - dx
          x = start.x + dx
        }
        if (dir.includes('n')) {
          h = start.h - dy
          y = start.y + dy
        }
        // 到了最小尺寸就停住, 不要继续反向移动
        if (w < MIN_W) {
          if (dir.includes('w')) x -= MIN_W - w
          w = MIN_W
        }
        if (h < MIN_H) {
          if (dir.includes('n')) y -= MIN_H - h
          h = MIN_H
        }
        setRect({ x, y, w, h })
      }
      const onUp = () => {
        setResizing(null)
        document.body.style.cursor = ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [rect],
  )

  return (
    <div className={`desk${moving || resizing ? ' is-dragging' : ''}`}>
      <div className="desk-wall" />
      <div className="desk-menubar">
        <span className="desk-dot" />
        <span className="desk-menubar-title">预览 · 桌面小窗效果</span>
        <button className="desk-back" onClick={onExpand}>
          返回完整界面
        </button>
      </div>
      <div
        ref={wrapRef}
        className={`desk-widget${collapsed ? ' is-collapsed' : ''}`}
        style={{ left: rect.x, top: rect.y, width: collapsed ? undefined : rect.w, height: collapsed ? undefined : rect.h }}
      >
        <WidgetView onExpand={onExpand} onDragStart={onMoveStart} onCollapsedChange={setCollapsed} />

        {/* 八个方向的隐形缩放手柄: 贴到边上鼠标就变成缩放指针 */}
        {!collapsed &&
          Object.keys(RESIZE_CURSOR).map((dir) => (
            <span key={dir} className={`wz wz-${dir}`} onPointerDown={onResizeStart(dir)} />
          ))}
      </div>
      <div className="desk-hint">
        <span>按住顶部可拖动 · 鼠标贴到小窗四边或四角可拉伸</span>
      </div>
    </div>
  )
}

function Router() {
  const { ready, user, desktop, connectionError } = useApp()
  const [mode, setMode] = useState<Mode>(initialMode)

  // 桌面壳里「展开完整界面」要把窗口放大, 不然看板挤在 340px 宽的小窗里没法用
  useEffect(() => {
    if (!desktop) return
    void setWindowMode(mode)
  }, [desktop, mode])

  useEffect(() => {
    if (desktop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'widget') setMode('full')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, desktop])

  if (!ready) {
    return (
      <div className="splash">
        <span className="spin" />
        正在连接服务器…
      </div>
    )
  }

  if (!user) return <div className="splash"><p>{connectionError || '部门待办暂未连接，请返回方片工作台登录后刷新页面。'}</p><button className="btn primary" onClick={() => navigateParent('login')}>前往方片登录</button></div>

  if (user.mustChangePassword) {
    return (
      <div className="widget widget--plain">
        <div className="widget-title">请先设置密码</div>
        <p className="widget-sub">你现在用的是初始密码, 要先改成自己的密码才能用。</p>
        <button className="btn primary sm" onClick={() => navigateParent('password')}>
          去设置密码
        </button>
      </div>
    )
  }

  if (mode === 'widget') {
    if (desktop) return <WidgetView onExpand={() => setMode('full')} />
    return <WidgetPreview onExpand={() => setMode('full')} />
  }

  // 还在用初始密码 → 先改密, 别的界面一律不给进 (服务端也会拦)

  return <Shell onOpenWidget={() => setMode('widget')} />
}

export default function App() {
  return (
    <AppProvider>
      {/* 看板把「导出 / 回收站」这两个动作注册给顶栏按钮 */}
      <BoardActionsProvider>
        <Router />
      </BoardActionsProvider>
    </AppProvider>
  )
}


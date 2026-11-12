/**
 * 通知抽象层 —— 上层代码只调 notify(), 不关心跑在哪。
 *
 * 优先级:
 *   1) Tauri 桌面壳: 调壳里注册的 Rust 命令 widget_notify → 真正的系统原生通知
 *      (壳里用 tauri-plugin-notification 实现, 见 desktop-tauri/src-tauri/src/main.rs)
 *   2) 浏览器: Web Notification API
 *   3) 都不行: 返回 'unsupported', 由调用方降级成应用内横幅提示
 */
export type NotifyResult = 'native' | 'web' | 'unsupported' | 'denied'

function tauriInvoke(): ((cmd: string, args?: any) => Promise<any>) | null {
  const w = window as any
  if (w.__TAURI__?.core?.invoke) return w.__TAURI__.core.invoke
  if (w.__TAURI_INTERNALS__?.invoke) return w.__TAURI_INTERNALS__.invoke
  return null
}

export function isDesktopShell(): boolean {
  return tauriInvoke() !== null
}

export async function requestNotifyPermission(): Promise<NotifyResult> {
  const invoke = tauriInvoke()
  if (invoke) {
    try {
      await invoke('widget_request_notify_permission')
      return 'native'
    } catch {
      return 'unsupported'
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'web'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const p = await Notification.requestPermission()
    return p === 'granted' ? 'web' : 'denied'
  } catch {
    return 'unsupported'
  }
}

export async function notify(title: string, body: string): Promise<NotifyResult> {
  const invoke = tauriInvoke()
  if (invoke) {
    try {
      await invoke('widget_notify', { title, body })
      return 'native'
    } catch {
      /* 壳没注册这个命令时退回浏览器通道 */
    }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, silent: false })
      return 'web'
    } catch {
      return 'unsupported'
    }
  }
  return 'unsupported'
}

/**
 * 桌面壳专用: 在「小窗」和「完整界面」之间切换窗口尺寸。
 * 小窗是 340×460 的置顶无边框窗; 完整界面放大到 1200×800、允许缩放、不再置顶,
 * 否则看板挤在小窗里没法用。壳里没注册这个命令时静默返回, 不影响浏览器运行。
 */
export async function setWindowMode(mode: 'full' | 'widget'): Promise<boolean> {
  const invoke = tauriInvoke()
  if (!invoke) return false
  try {
    await invoke('widget_set_mode', { mode })
    return true
  } catch {
    return false
  }
}

// 「连接天玑账号」按钮 —— 使用者用自己的天玑身份授权本应用（二级授权）。
//
// 直接抄这个组件，不要自己拼小窗逻辑：弹窗拦截器的时序、postMessage 的 origin 校验、
// 用户中途关窗，这三处每一处写错都会表现成"点了没反应"，而且很难查。
//
// 后端要有两个路由（见 server/platform/tianji-viewer.ts 顶部注释）：
//   POST /api/tianji/connect   → { consentUrl }
//   POST /api/tianji/callback  → { ok: true }   收一次性 code
//
// 用法：
//   {needAuth && <TianjiConnect onConnected={() => refetch()} />}

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  onConnected?: () => void
  /** 授权模板 id，缺省用后端配置的那个 */
  templateId?: string
  label?: string
}

const GATEWAY_MESSAGE_SOURCE = 'arp-tianji-sso'

export function TianjiConnect({ onConnected, templateId, label = '连接我的天玑账号' }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const winRef = useRef<Window | null>(null)
  const doneRef = useRef(false)

  // 收授权结果：网关的小窗结果页会 postMessage 回来
  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d: any = e.data
      if (!d || d.source !== GATEWAY_MESSAGE_SOURCE) return
      const code = d.params?.tianji_delegate
      if (!code) {
        if (d.params?.tianji_error) setErr(d.params.tianji_error_msg || '授权未完成')
        return
      }
      doneRef.current = true
      try {
        // ★ 一次性 code 必须交给**后端**去兑换（后端才有应用的 SA token），
        //   前端不碰句柄 —— 句柄代表"代表这示例公司有限公司访问天玑"的授权。
        const res = await fetch('/api/tianji/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code }),
        })
        if (!res.ok) throw new Error(await res.text())
        setErr('')
        onConnected?.()
      } catch (e: any) {
        setErr(`授权保存失败：${e?.message || e}`)
      } finally {
        setBusy(false)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [onConnected])

  const connect = useCallback(async () => {
    setErr('')
    doneRef.current = false
    // ★ 必须在点击的同步调用栈里先把空窗开出来：等 fetch 回来再 open 会被
    //   Safari/Firefox 判为"非用户手势触发"直接拦掉。
    const w = window.open('', 'tianji-consent', 'width=520,height=680')
    winRef.current = w
    setBusy(true)
    try {
      const res = await fetch('/api/tianji/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId }),
      })
      const body = await res.json()
      if (!body?.consentUrl) throw new Error(body?.message || '未拿到授权地址')
      if (w) {
        w.location.href = body.consentUrl
      } else {
        // 弹窗被拦截：退回整页跳转，别把用户卡在这里
        window.location.href = body.consentUrl
      }
    } catch (e: any) {
      setErr(`发起授权失败：${e?.message || e}`)
      setBusy(false)
      try {
        w?.close()
      } catch {
        /* ignore */
      }
    }
  }, [templateId])

  // 用户手动关掉小窗：不然按钮会一直转
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => {
      if (winRef.current?.closed) {
        clearInterval(t)
        setBusy(false)
        if (!doneRef.current) setErr('授权未完成')
      }
    }, 500)
    return () => clearInterval(t)
  }, [busy])

  return (
    <div>
      <button onClick={connect} disabled={busy}>
        {busy ? '授权中…' : label}
      </button>
      {err && <div style={{ color: '#cf222e', marginTop: 8, fontSize: 13 }}>{err}</div>}
    </div>
  )
}

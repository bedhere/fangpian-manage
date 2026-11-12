import { useEffect, useRef, useState } from 'react'

type TianjiIdentity = {
  employeeId: number
  name: string
  canViewAll: boolean
  department: string
  role: string
}

const LOGIN_MESSAGE_SOURCE = 'fangpian-tianji-sso'

export default function TianjiLoginPage({ expectedName }: { expectedName?: string } = {}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [identity, setIdentity] = useState<TianjiIdentity | null>(null)
  const popupRef = useRef<Window | null>(null)
  const expectedOriginRef = useRef<string | null>(null)
  const finishedRef = useRef(false)
  const stateRef = useRef<string | null>(null)
  const attemptRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const receiveLoginResult = async (event: MessageEvent) => {
      if (event.source !== popupRef.current || event.origin !== expectedOriginRef.current) return
      const message = event.data
      if (!message || message.source !== LOGIN_MESSAGE_SOURCE || finishedRef.current || !stateRef.current) return
      if (message.params?.state !== stateRef.current) return
      const code = message.params?.code
      if (!code) {
        if (message.params?.error) {
          setError('天玑身份授权未完成，请重试。')
          setBusy(false)
        }
        return
      }
      if (typeof code !== 'string' || code.length > 2048 || /[\x00-\x20\x7f]/.test(code)) return
      const attempt = attemptRef.current
      finishedRef.current = true
      try {
        const response = await fetch('/api/tianji/login/callback', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state: message.params.state }),
          signal: abortRef.current?.signal,
        })
        if (attempt !== attemptRef.current) return
        const result = await response.json()
        if (attempt !== attemptRef.current) return
        if (!response.ok) throw new Error(result.message || '天玑身份核验失败')
        setIdentity(result.identity)
        setError('')
        window.setTimeout(() => {
          if (attempt !== attemptRef.current) return
          const url = new URL(window.location.href)
          url.searchParams.delete('page')
          window.location.replace(url.pathname + url.search + url.hash)
        }, 500)
      } catch (caught) {
        if (attempt !== attemptRef.current) return
        setError(caught instanceof Error ? caught.message : '天玑身份核验失败，请重试。')
      } finally {
        if (attempt === attemptRef.current) setBusy(false)
      }
    }
    window.addEventListener('message', receiveLoginResult)
    return () => {
      window.removeEventListener('message', receiveLoginResult)
      attemptRef.current++
      abortRef.current?.abort()
      stateRef.current = null
      expectedOriginRef.current = null
      popupRef.current?.close()
      popupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!busy) return
    const attempt = attemptRef.current
    const deadline = window.setTimeout(() => {
      if (attempt !== attemptRef.current || finishedRef.current) return
      attemptRef.current++
      abortRef.current?.abort()
      stateRef.current = null
      expectedOriginRef.current = null
      popupRef.current?.close()
      setBusy(false)
      setError('授权等待超时，请重新发起天玑授权；请在授权窗口中确认同意并等待自动返回。')
    }, 120_000)
    const timer = window.setInterval(() => {
      if (attempt !== attemptRef.current || finishedRef.current) return
      if (popupRef.current?.closed) {
        window.clearInterval(timer)
        attemptRef.current++
        abortRef.current?.abort()
        stateRef.current = null
        expectedOriginRef.current = null
        setBusy(false)
        setError('授权窗口已关闭，尚未完成身份核验。')
      }
    }, 500)
    return () => { window.clearInterval(timer); window.clearTimeout(deadline) }
  }, [busy])

  const startLogin = async () => {
    const attempt = ++attemptRef.current
    abortRef.current?.abort()
    popupRef.current?.close()
    const controller = new AbortController()
    abortRef.current = controller
    setError('')
    setIdentity(null)
    finishedRef.current = false
    expectedOriginRef.current = null
    stateRef.current = null
    const popup = window.open('', 'tianji-identity-consent', 'width=520,height=680')
    popupRef.current = popup
    setBusy(true)
    try {
      const response = await fetch('/api/tianji/login/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      })
      if (attempt !== attemptRef.current) return
      const result = await response.json()
      if (attempt !== attemptRef.current) return
      if (!response.ok || !result.consentUrl || typeof result.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.state)) throw new Error(result.message || '暂时无法获取天玑授权页面')
      const consentUrl = new URL(result.consentUrl)
      if (consentUrl.protocol !== 'https:') throw new Error('天玑授权地址不安全')
      if (result.callbackOrigin !== window.location.origin || result.messageSource !== LOGIN_MESSAGE_SOURCE) throw new Error('天玑授权返回地址配置不正确')
      expectedOriginRef.current = result.callbackOrigin
      stateRef.current = result.state
      if (!popup) throw new Error('浏览器拦截了授权窗口，请允许弹出窗口后重试')
      popup.location.href = consentUrl.href
    } catch (caught) {
      if (attempt !== attemptRef.current) return
      setError(caught instanceof Error ? caught.message : '发起天玑授权失败，请稍后重试。')
      setBusy(false)
      popup?.close()
    }
  }

  const returnToDashboard = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('page')
    window.location.href = url.pathname + url.search + url.hash
  }

  return (
    <main className="tianji-login-page">
      <section className="tianji-login-card">
        <div className="tianji-login-mark" aria-hidden="true">天</div>
        <p className="tianji-login-eyebrow">业务目标看板 · 账号权限</p>
        <h1>使用天玑账号登录</h1>
        {expectedName ? <p className="tianji-login-description">当前方片账号：{expectedName}，请使用同一人员的天玑账号授权。</p> : null}
        <p className="tianji-login-description">
          通过天玑官方身份授权确认员工身份。普通员工默认查看本人看板，示例开发01可查看全部人员；不会收集或保存天玑密码。
        </p>
        <div className="tianji-login-scope">
          <strong>本次申请权限</strong>
          <span>确认天玑账号身份</span>
          <small>业务数据沿用天玑账号已有的读取权限，不申请写入权限</small>
        </div>
        {identity ? (
          <div className="tianji-login-success" role="status">
            <strong>身份核验成功，正在进入看板…</strong>
            <span>{identity.name || '天玑用户'} · 员工 ID {identity.employeeId}</span>
            {identity.department ? <small>{identity.department}{identity.role ? ` · ${identity.role}` : ''}</small> : null}
          </div>
        ) : null}
        {error ? <p className="tianji-login-error" role="alert">{error}</p> : null}
        <button className="tianji-login-primary" type="button" onClick={startLogin} disabled={busy}>
          {busy ? '正在打开天玑授权…' : identity ? '正在登录…' : '前往天玑授权并继续'}
        </button>
        <button className="tianji-login-back" type="button" onClick={returnToDashboard}>返回看板</button>
        <p className="tianji-login-footnote">登录核验员工身份；看板按天玑账号已有权限只读查询业绩、订单与目标，不修改天玑数据、不保存密码。已同步数据保留快照与更新时间。</p>
      </section>
    </main>
  )
}





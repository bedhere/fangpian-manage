import { lazy, Suspense, useEffect, useState } from 'react'
import type { DashboardLoginIdentity } from './App'
import TianjiLoginPage from './TianjiLoginPage'
import { checkDashboardSession, DashboardSessionError } from './dashboard-session'
import CommerceBoard from './CommerceBoard'
const LegacyApp = lazy(() => import('./App'))
const LEGACY_SNAPSHOT_EMPLOYEES = new Set([275,472,676,906,904,411,897,677,811,813,799,668])

export default function DashboardRoot() {
  const [legacy, setLegacy] = useState(false)
  const [initialView, setInitialView] = useState<'checking' | 'legacy' | 'commerce'>('checking')
  const [identity, setIdentity] = useState<DashboardLoginIdentity | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [configured, setConfigured] = useState(false)
  const [businessConfigured, setBusinessConfigured] = useState(false)
  const [platformDisplayName, setPlatformDisplayName] = useState<string | undefined>(undefined)

  useEffect(() => {
    const requireTianjiIdentity = () => {
      setIdentity(null)
      setStatus('ready')
    }
    window.addEventListener('external-collab:tianji-auth-required', requireTianjiIdentity)
    return () => window.removeEventListener('external-collab:tianji-auth-required', requireTianjiIdentity)
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setStatus('loading')
    checkDashboardSession(controller.signal)
      .then((result) => {
        if (!active) return
        setIdentity(result.authenticated === true ? result.identity : null)
        setConfigured(result.configured === true)
        setBusinessConfigured(result.businessConfigured === true)
        setPlatformDisplayName(
          typeof result.platformDisplayName === 'string' ? result.platformDisplayName.trim() : undefined,
        )
        setStatus('ready')
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(
          error instanceof DashboardSessionError ? error.message : '登录状态检查暂时中断，请重新检查。',
        )
        setStatus('error')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [retry])

  useEffect(() => {
    if (!identity) return
    if (!LEGACY_SNAPSHOT_EMPLOYEES.has(identity.employeeId)) {
      setInitialView('commerce')
      return
    }
    const controller = new AbortController()
    setInitialView('checking')
    ;(async () => {
      const catalogResponse = await fetch('/api/dashboard/commerce/catalog', {signal:controller.signal,credentials:'include'})
      if (!catalogResponse.ok) throw new Error('无法检查商务快照')
      const catalog = await catalogResponse.json()
      const 示例公司有限公司 = Date.示例公司有限公司()/1000
      const month = catalog.periods?.find((p:any)=>p.kind==='month'&&p.start<=示例公司有限公司&&示例公司有限公司<p.end)
      if (!month) { setInitialView('legacy'); return }
      const statusResponse = await fetch(`/api/dashboard/commerce/status?personId=${identity.employeeId}&periodId=${month.id}`, {signal:controller.signal,credentials:'include'})
      if (!statusResponse.ok) throw new Error('无法检查商务快照')
      const snapshot = await statusResponse.json()
      if (!controller.signal.aborted) setInitialView(snapshot.batchId ? 'commerce' : 'legacy')
    })().catch(()=>{if(!controller.signal.aborted)setInitialView('legacy')})
    return ()=>controller.abort()
  }, [identity])

  if (status === 'loading') {
    return (
      <main className="tianji-login-page">
        <div className="tianji-login-card">正在检查登录状态…</div>
      </main>
    )
  }
  if (status === 'error') {
    return (
      <main className="tianji-login-page">
        <section className="tianji-login-card">
          <h1>暂时无法检查登录状态</h1>
          <p className="tianji-login-description">{errorMessage}</p>
          <button
            className="tianji-login-primary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            重新检查
          </button>
        </section>
      </main>
    )
  }
  if (!configured)
    return (
      <main className="tianji-login-page">
        <section className="tianji-login-card">
          <div className="tianji-login-mark" aria-hidden="true">
            方
          </div>
          <p className="tianji-login-eyebrow">商务部门协作 · 天玑连接</p>
          <h1>天玑连接待配置</h1>
          <p className="tianji-login-description">天玑连接尚待管理员完成应用登记。配置完成后重新检查即可。</p>
          <button
            className="tianji-login-primary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            重新检查连接
          </button>
        </section>
      </main>
    )
  if(identity && initialView==='checking')return <main className="tianji-login-page"><div className="tianji-login-card">正在读取已保存的看板数据…</div></main>
  return identity ? (
    <>
      {!businessConfigured ? (
        <aside className="fp-collab-connection-notice" role="status">
          <strong>业务数据待连接</strong>
          <span>当前仅可读取已保存的完整快照。同步能力取决于本人及后台账号的实际天玑授权。</span>
        </aside>
      ) : null}
      {legacy || initialView==='legacy' ? (
        <>
          {initialView==='legacy' && !legacy ? <aside className="fp-collab-connection-notice" role="status"><strong>正在显示原看板已有数据</strong><span>新版首次数据仍在核对，原有业绩和目标保留。新版就绪后重新进入即可；也可先查看新版界面。</span></aside> : null}
          <button className="commerce-legacy-back" onClick={() => {setLegacy(false);setInitialView('commerce')}}>
            {initialView==='legacy' ? '查看新版商务看板' : '返回商务看板'}
          </button>
          <Suspense fallback={<p>正在打开原目标计划…</p>}>
            <LegacyApp identity={identity} />
          </Suspense>
        </>
      ) : (
        <CommerceBoard identity={identity} onLegacy={() => setLegacy(true)} />
      )}
    </>
  ) : (
    <TianjiLoginPage expectedName={platformDisplayName} />
  )
}

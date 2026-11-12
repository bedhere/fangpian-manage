import { AsyncLocalStorage } from 'node:async_hooks'
import type { PlatformActor } from './boundary'

const actors = new AsyncLocalStorage<PlatformActor>()
let tokenProvider: ((actor: PlatformActor) => Promise<string>) | undefined
let serviceActorProvider: (() => Promise<PlatformActor>) | undefined

export function configureTianjiDataAccess(tokens: (actor: PlatformActor) => Promise<string>, service: () => Promise<PlatformActor>) {
  tokenProvider = tokens
  serviceActorProvider = service
}
export function withTianjiDataActor<T>(actor: PlatformActor, action: () => T): T { return actors.run(actor, action) }
export function isTianjiAutoTaskAllowed(name: string): boolean {
  if (process.env.TIANJI_DATA_MODE !== 'direct-sso') return true
  try {
    const names: unknown = JSON.parse(process.env.TIANJI_AUTO_TASK_ALLOWLIST || '[]')
    return Array.isArray(names) && names.length <= 50 && names.every(item => typeof item === 'string' && item.length <= 200) && names.includes(name)
  } catch { return false }
}
export async function currentTianjiDataToken(): Promise<string> {
  const actor = actors.getStore()
  if (!actor || !tokenProvider) throw new Error('天玑只读数据请求缺少已验证的当前身份')
  return tokenProvider(actor)
}
/** Background work requires an explicitly configured service identity. A viewer
 * request always retains its own identity and never falls back to the service. */
export async function withTianjiDataService<T>(action: () => Promise<T>): Promise<T> {
  if (process.env.TIANJI_DATA_MODE !== 'direct-sso' || actors.getStore()) return action()
  return withTianjiBackgroundService(action)
}
/** Explicitly authorized background jobs collect the shared cache with the
 * configured service identity. This is never a fallback for a viewer read. */
export async function withTianjiBackgroundService<T>(action: () => Promise<T>): Promise<T> {
  if (process.env.TIANJI_DATA_MODE !== 'direct-sso') return action()
  if (!serviceActorProvider) throw new Error('天玑只读同步账号尚未配置')
  return actors.run(await serviceActorProvider(), action)
}

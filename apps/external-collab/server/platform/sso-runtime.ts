import { TianjiSso, TianjiSsoError } from './tianji-sso'
import { TianjiRateLimitError } from './tianji-rate-limit'
import { quotaAwareTianjiFetch, tianjiQuota } from './tianji-quota-runtime'
export function ssoRuntime() {
  const origin = new URL(process.env.EXTERNAL_COLLAB_PUBLIC_ORIGIN || 'https://example.invalid')
  if (origin.protocol !== 'https:') throw new Error('天玑 SSO 回调必须使用 HTTPS')
  return new TianjiSso({ baseUrl: process.env.TIANJI_SSO_BASE_URL || '', clientId: process.env.TIANJI_SSO_CLIENT_ID || '', clientSecret: process.env.TIANJI_SSO_CLIENT_SECRET || '', redirectUri: `${origin.origin}/external-collab/tianji-callback` }, quotaAwareTianjiFetch, async path => {
    try { await tianjiQuota.acquire(path, 8000) }
    catch (error) { if (error instanceof TianjiRateLimitError) throw new TianjiSsoError('rate_limited', error.message); throw error }
  }, () => tianjiQuota.cooldown())
}

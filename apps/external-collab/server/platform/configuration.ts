export function connectionConfiguration() {
  const required = ['TIANJI_SSO_BASE_URL', 'TIANJI_SSO_CLIENT_ID', 'TIANJI_SSO_CLIENT_SECRET', 'EXTERNAL_COLLAB_TOKEN_KEY']
  const missingConfiguration = required.filter(key => !process.env[key]?.trim())
  return { configured: missingConfiguration.length === 0, missingConfiguration, businessConfigured: Boolean((process.env.TIANJI_DATA_MODE === 'direct-sso' && process.env.TIANJI_DATA_SERVICE_USER_ID) || (process.env.TIANJI_DATA_PROXY_URL && process.env.TIANJI_DATA_PROXY_TOKEN) || (process.env.STUDIO_PLATFORM_URL && process.env.STUDIO_APP_TOKEN)) }
}

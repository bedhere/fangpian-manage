const oauthErrors = new Set(['access_denied', 'invalid_request', 'unauthorized_client', 'unsupported_response_type', 'invalid_scope', 'server_error', 'temporarily_unavailable']);
/** Public popup callback: no API calls, session access, or credential persistence. */
export function deliverTianjiCallback(host: Window): 'delivered' | 'invalid' | 'no-opener' {
  const query = new URLSearchParams(host.location.search);
  host.history.replaceState(null, '', host.location.pathname);
  const state = query.get('state');
  const code = query.get('code');
  const error = query.get('error');
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state) || query.getAll('state').length !== 1
    || query.getAll('code').length > 1 || query.getAll('error').length > 1
    || (code && error) || (!code && !error) || (code && (code.length > 2048 || /[\x00-\x20\x7f]/.test(code)))
    || (error && !oauthErrors.has(error))) return 'invalid';
  if (!host.opener) return 'no-opener';
  host.opener.postMessage({ source: 'fangpian-tianji-sso', params: { ...(code ? { code } : { error }), state } }, host.location.origin);
  return 'delivered';
}

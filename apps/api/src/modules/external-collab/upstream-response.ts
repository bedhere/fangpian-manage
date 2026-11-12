/** Tianji expiry must not trigger Fangpian's JWT-refresh/logout machinery. */
export function externalResponse(status: number, text: string) {
  return status === 401
    ? { status: 403, text: JSON.stringify({ code: 'TIANJI_AUTH_REQUIRED', message: '请重新验证本人的天玑身份' }) }
    : { status, text };
}

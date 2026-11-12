/** Local logout is complete even when the provider cannot confirm revocation. */
export async function finishTianjiLogout(response: Response, actions: { notify: (message: string) => void; reload: () => void }) {
  const result = await response.json()
  if (result.providerRevoked === false) actions.notify(typeof result.message === 'string' && result.message ? result.message : '本地会话已退出，但天玑侧授权撤销未确认。如需彻底撤销授权，请前往天玑账号设置。')
  actions.reload()
}

import { expect, it, vi } from 'vitest';
import { finishTianjiLogout } from '../../../external-collab/client/src/tianji-logout';
it('shows the provider revocation warning before completing the local logout', async () => {
  const events: string[] = [];
  await finishTianjiLogout(Response.json({ ok: true, providerRevoked: false, message: '本地会话已退出，天玑授权撤销未确认。' }), { notify: (message) => events.push(message), reload: () => events.push('reload') });
  expect(events).toEqual(['本地会话已退出，天玑授权撤销未确认。', 'reload']);
});
it('finishes local logout without a warning when provider revocation is confirmed', async () => {
  const notify = vi.fn();
  const reload = vi.fn();
  await finishTianjiLogout(Response.json({ ok: true, providerRevoked: true }), { notify, reload });
  expect(notify).not.toHaveBeenCalled();
  expect(reload).toHaveBeenCalledOnce();
});

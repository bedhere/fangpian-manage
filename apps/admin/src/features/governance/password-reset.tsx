'use client';

import { Button } from '@fangpian/ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const fieldClass = 'mt-2 min-h-11 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-[#ffd85f]/40 disabled:opacity-60';
export function PasswordReset({ user, onClose, onReset }: {
  user: { id: string; displayName: string; username?: string | null; email: string };
  onClose: () => void;
  onReset: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    active.current = true; dialog.current?.showModal();
    return () => { active.current = false; controller.current?.abort(); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    function reject(message: string) { setError(message); setPassword(''); setConfirmation(''); setVisible(false); }
    if (password.length < 12 || password.length > 128 || !password.trim()) { reject('新密码须为12至128个字符'); return; }
    if (password !== confirmation) { reject('两次输入的新密码不一致，请重新输入'); return; }
    if (reason.trim().length < 2 || reason.trim().length > 300) { reject('请填写2至300字的修改原因'); return; }
    if (reason.includes(password)) { reject('修改原因中不要填写密码'); return; }
    const token = sessionStorage.getItem('valueflow_admin_token');
    if (!token) { reject('管理员登录已失效，请重新登录'); return; }
    setPassword(''); setConfirmation(''); setVisible(false);
    pending.current = true; setBusy(true); setError('');
    const request = new AbortController(); controller.current = request;
    try {
      const response = await fetch(`${api}/api/admin/users/${user.id}/reset-password`, {
        method: 'POST', credentials: 'include', signal: request.signal,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ password, reason: reason.trim() }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string; reset?: boolean; selfReset?: boolean };
      if (!active.current || sessionStorage.getItem('valueflow_admin_token') !== token) return;
      if (!response.ok || body.reset !== true) throw new Error(body.message ? String(body.message) : `重置未完成（${response.status}），请核对账号状态和权限`);
      setPassword(''); setConfirmation('');
      if (body.selfReset) {
        sessionStorage.removeItem('valueflow_admin_token');
        window.location.replace('/?passwordReset=1');
        return;
      }
      onReset(`${user.displayName}的密码已重置；原登录已失效，下次登录必须修改密码。`);
      onClose();
    } catch (cause) {
      if (active.current && !request.signal.aborted) setError(cause instanceof Error && cause.name !== 'TypeError' ? cause.message : '网络中断，操作结果暂未确认；请核对账号状态，不要连续提交。');
    } finally {
      pending.current = false;
      if (active.current) { setBusy(false); setPassword(''); setConfirmation(''); setVisible(false); }
    }
  }
  return <dialog ref={dialog} aria-labelledby="password-reset-title" className="m-auto max-h-[90dvh] w-[min(94vw,34rem)] overflow-y-auto rounded-3xl border-0 bg-[#fffdf8] p-5 text-[#303030] shadow-2xl backdrop:bg-black/40 sm:p-7" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form noValidate onSubmit={event => void submit(event)}>
      <div className="flex items-start justify-between gap-4"><div><h2 id="password-reset-title" className="text-2xl font-black">重置成员密码</h2><p className="mt-3 break-words text-sm font-bold">{user.displayName} · {user.username || user.email}</p></div><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>关闭</Button></div>
      <p className="mt-4 rounded-2xl bg-[#fff1b8] p-4 text-sm leading-6">手动设置新密码后，该账号当前登录将失效，下次登录必须改密。暂停或停用状态保持。</p>
      <fieldset disabled={busy} className="mt-5 space-y-4">
        <label className="block text-sm font-bold">新密码<input autoFocus className={fieldClass} type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label className="block text-sm font-bold">确认新密码<input className={fieldClass} type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} />显示本次输入</label>
        <label className="block text-sm font-bold">修改原因<textarea className={fieldClass} required minLength={2} maxLength={300} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="例如：成员忘记密码，核对身份后重置" /></label>
      </fieldset>
      <p className="mt-3 text-xs leading-5 text-[#777166]">新密码至少12位。密码只在本次表单中输入，不会保存到账号列表或审计记录。</p>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {busy ? <p role="status" className="mt-4 text-sm">正在重置，请勿重复提交…</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" disabled={busy}>确认重置密码</Button></div>
    </form>
  </dialog>;
}

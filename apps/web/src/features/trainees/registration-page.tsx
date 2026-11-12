"use client";

import { BrandLogo, Button, Card } from '@fangpian/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient } from '@/lib/api';
import { errorMessage, fieldClass, jsonRequest, type RegistrationOptions } from './types';

export function RegistrationPage() {
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [account, setAccount] = useState<{ username: string; displayName: string } | null>(null);
  useEffect(() => {
    let active = true;
    apiClient.request<RegistrationOptions>('/api/auth/registration-options')
      .then(result => { if (active) setOptions(result); })
      .catch(cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [attempt]);
  async function register(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !options?.registrationAvailable) return;
    if (!name.trim()) { setError('请填写真实姓名'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await apiClient.request<{ username: string; displayName: string; mustChangePassword: true }>('/api/auth/register', jsonRequest('POST', { displayName: name.trim(), ...(mentorId ? { mentorId } : {}) }));
      setAccount(result);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center px-5 py-10 text-[#303030]">
    <Card className="w-full max-w-xl p-7 sm:p-10">
      <BrandLogo variant="wordmark" className="h-14 w-44 object-contain object-left" />
      <p className="mt-8 text-sm font-extrabold tracking-[.15em] text-[#8a761f]">TRAINEE ACCESS</p>
      <h1 className="mt-3 text-3xl font-black">管培生入驻</h1>
      {account ? <div className="mt-6 space-y-5" role="status">
        <p className="text-lg font-bold">{account.displayName}，账号已创建</p>
        <dl className="space-y-3 rounded-2xl bg-[#fff3bf] p-5"><div><dt className="text-sm">登录账号</dt><dd className="break-all text-xl font-black">{account.username}</dd></div><div><dt className="text-sm">初始密码</dt><dd className="font-mono text-xl font-bold">DEMO_ONLY_ChangeMe_2026!</dd></div></dl>
        <p className="text-sm leading-6">请妥善记录账号。首次登录必须修改密码，完成后进入管培生工作区。</p>
        <Link className="fp-button fp-button--primary flex min-h-12 items-center justify-center" href={`/?account=${encodeURIComponent(account.username)}`}>进入登录</Link>
      </div> : <>
        <p className="mt-3 text-sm leading-6 text-[#6d685e]">填写真实姓名，系统会自动生成拼音账号。导师可以稍后由老板分配。</p>
        <form aria-label="管培生注册" onSubmit={register} className="mt-7 space-y-5">
          <label className="block text-sm font-bold">真实姓名<input className={fieldClass} required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
          <label className="block text-sm font-bold">带教导师（选填）<select className={fieldClass} value={mentorId} onChange={e => setMentorId(e.target.value)} disabled={!options || busy}><option value="">暂不选择，待分配</option>{options?.mentors.map(mentor => <option key={mentor.id} value={mentor.id}>{mentor.displayName}{mentor.departmentName ? ` · ${mentor.departmentName}` : ''}</option>)}</select></label>
          {!options && !error ? <p role="status" className="text-sm">正在加载注册选项…</p> : null}
          {options && !options.registrationAvailable ? <p className="rounded-2xl bg-[#fff3bf] p-4 text-sm">当前暂未开放注册，请联系管理员。</p> : null}
          {error ? <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
          {!options && error ? <Button type="button" variant="secondary" onClick={() => { setOptions(null); setError(''); setAttempt(x => x + 1); }}>重新加载</Button> : null}
          <Button className="min-h-12 w-full" loading={busy} disabled={!options?.registrationAvailable || busy}>注册管培生账号</Button>
        </form>
        <p className="mt-6 text-center text-sm"><Link href="/" className="font-bold underline underline-offset-4">已有账号，返回登录</Link></p>
      </>}
    </Card>
  </main>;
}

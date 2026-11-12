"use client";

import { Button } from '@fangpian/ui';
import { useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { errorMessage, fieldClass, jsonRequest, type Mentor, type TraineePerson } from './types';

export function MentorAssignment({ person, mentors, onChanged }: { person: TraineePerson; mentors: Mentor[]; onChanged: () => void }) {
  const [mentorId, setMentorId] = useState(person.mentorId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function save() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await apiClient.request(`/api/trainees/${person.userId}/mentor`, jsonRequest('PATCH', { mentorId: mentorId || null })); onChanged(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mt-4 rounded-2xl bg-[#f7f5ee] p-4"><label className="block text-sm font-bold">{person.displayName}的导师<select className={fieldClass} value={mentorId} onChange={e => setMentorId(e.target.value)} disabled={busy}><option value="">待分配</option>{mentors.filter(mentor => mentor.id !== person.userId).map(mentor => <option key={mentor.id} value={mentor.id}>{mentor.displayName}{mentor.departmentName ? ` · ${mentor.departmentName}` : ''}</option>)}</select></label><Button type="button" variant="secondary" className="mt-3" disabled={busy} loading={busy} onClick={() => void save()} aria-label={`保存${person.displayName}的导师`}>保存导师</Button>{error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}</div>;
}

export function Enrollment({ mentors, selfId, onChanged }: { mentors: Mentor[]; selfId?: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [mentorId, setMentorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function enroll() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await apiClient.request('/api/trainees/enroll', jsonRequest('POST', mentorId ? { mentorId } : {})); onChanged(); setOpen(false); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!open) return <Button type="button" variant="secondary" onClick={() => setOpen(true)}>我要入驻</Button>;
  return <div className="w-full rounded-2xl bg-[#fff3bf] p-5"><h2 className="font-black">以当前账号入驻</h2><p className="mt-2 text-sm leading-6">入驻后可填报自己的每日需求，保留原有账号与权限。</p><label className="mt-3 block text-sm font-bold">带教导师（选填）<select className={fieldClass} value={mentorId} onChange={e => setMentorId(e.target.value)} disabled={busy}><option value="">暂不选择，待分配</option>{mentors.filter(mentor => mentor.id !== selfId).map(mentor => <option key={mentor.id} value={mentor.id}>{mentor.displayName}</option>)}</select></label>{error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}<div className="mt-4 flex gap-3"><Button type="button" disabled={busy} loading={busy} onClick={() => void enroll()}>确认入驻</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>取消</Button></div></div>;
}

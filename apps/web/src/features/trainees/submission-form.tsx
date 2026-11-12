"use client";

import { Button, Card } from '@fangpian/ui';
import { useRef, useState, type FormEvent } from 'react';
import { apiClient } from '@/lib/api';
import { errorMessage, fieldClass, jsonRequest, type Submission, type SubmissionInput, type TraineeWorkspace } from './types';

export function SubmissionForm({ workspace, initial, today, onSaved, onDone, onPartialSave, onCancel }: {
  workspace: TraineeWorkspace; initial?: Submission; today: string;
  onSaved: (row: Submission) => void; onDone: (row: Submission) => void; onPartialSave: () => void; onCancel: () => void;
}) {
  const [record, setRecord] = useState(initial);
  const [values, setValues] = useState<SubmissionInput>(() => ({ title: initial?.title ?? '', departmentId: initial?.departmentId ?? '', workDate: initial?.workDate ?? today, problem: initial?.problem ?? '', solution: initial?.solution ?? '', expectedValue: initial?.expectedValue ?? '' }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  function change(key: keyof SubmissionInput, value: string) { setValues(current => ({ ...current, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const submit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'submit';
    const input = { ...values, title: values.title.trim(), problem: values.problem.trim(), solution: values.solution.trim(), expectedValue: values.expectedValue.trim() };
    if (!input.title || !input.problem || !input.solution || !input.departmentId || !input.workDate) { setError('请完整填写标题、业务部门、日期、问题和方案'); return; }
    pending.current = true; setBusy(true); setError('');
    let saved: Submission | undefined;
    try {
      saved = record
        ? await apiClient.request<Submission>(`/api/trainees/submissions/${record.id}`, jsonRequest('PATCH', { ...input, version: record.version }))
        : await apiClient.request<Submission>('/api/trainees/submissions', jsonRequest('POST', { ...input, submit }));
      setRecord(saved); onSaved(saved);
      if (submit && record) {
        saved = await apiClient.request<Submission>(`/api/trainees/submissions/${saved.id}/submit`, jsonRequest('POST', { version: saved.version }));
        setRecord(saved); onSaved(saved);
      }
      onDone(saved);
    } catch (cause) {
      setError(`${saved ? '修改已保存为草稿，但提交未完成。' : ''}${errorMessage(cause)}`);
      if (saved) onPartialSave();
    } finally { pending.current = false; setBusy(false); }
  }
  return <Card className="mt-6 p-5 sm:p-7">
    <h2 className="text-xl font-black">{initial ? '修改需求' : '填写需求'}</h2>
    {!workspace.selfProfile?.mentorId ? <p className="mt-3 rounded-2xl bg-[#fff3bf] p-4 text-sm leading-6">未分配导师，可提交；需求会保持待审核，等待老板分配导师后处理。</p> : null}
    <form aria-label="需求填报" onSubmit={save} className="mt-5 space-y-5">
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
        <label className="block text-sm font-bold">标题<input className={fieldClass} required maxLength={200} value={values.title} onChange={e => change('title', e.target.value)} /></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-bold">业务部门<select className={fieldClass} required value={values.departmentId} onChange={e => change('departmentId', e.target.value)}><option value="">请选择业务部门</option>{workspace.departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>
          <label className="block text-sm font-bold">日期<input className={fieldClass} type="date" required value={values.workDate} onChange={e => change('workDate', e.target.value)} /></label>
        </div>
        <label className="block text-sm font-bold">发现的问题<textarea className={`${fieldClass} min-h-32 resize-y`} required maxLength={20000} value={values.problem} onChange={e => change('problem', e.target.value)} /></label>
        <label className="block text-sm font-bold">解决方案<textarea className={`${fieldClass} min-h-36 resize-y`} required maxLength={20000} value={values.solution} onChange={e => change('solution', e.target.value)} /></label>
        <label className="block text-sm font-bold">预期价值（选填）<textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={10000} value={values.expectedValue} onChange={e => change('expectedValue', e.target.value)} /></label>
      </fieldset>
      {error ? <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap gap-3"><Button name="action" value="draft" variant="secondary" disabled={busy} loading={busy}>保存草稿</Button><Button name="action" value="submit" disabled={busy} loading={busy}>{record ? '保存并提交审核' : '提交导师审核'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>取消</Button></div>
    </form>
  </Card>;
}

"use client";
import { useEffect, useState } from 'react';
import { FeedbackButton, SlideCommit } from '@fangpian/ui';
import { useActionGate } from './use-action-gate';
export function ConfirmAction({ label, description, onConfirm, className = '', slide = false }: { label: string; description: string; onConfirm: () => unknown | Promise<unknown>; className?: string; slide?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const { pending, run } = useActionGate();
  // Escape cancels, unless a decision is already in flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending]);
  async function confirm() {
    setError('');
    try { return await run(onConfirm); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试'); throw cause; }
  }
  return <><button type="button" onClick={() => { setError(''); setOpen(true); }} className={className}>{label}</button>{open ? <div role="dialog" aria-modal="true" aria-label={`确认${label}`} className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-5" onClick={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">确认{label}</h2><p className="mt-3 text-sm text-[#777166]">{description}</p>{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}<div className="mt-6 flex flex-wrap items-center justify-end gap-3"><button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-full border px-4 py-2 hover:bg-[#f5f1e8]">取消</button>{slide ? <SlideCommit label={`滑动确认${label}`} disabled={pending} onConfirm={confirm} onDone={() => setOpen(false)} /> : <FeedbackButton type="button" autoFocus onClick={async () => { const result = await confirm(); if (result !== false) setOpen(false); return result; }} className="rounded-full bg-[#ffd85f] px-4 py-2 font-black hover:shadow-[0_10px_24px_rgba(255,216,95,.45)]">确认</FeedbackButton>}</div></div></div> : null}</>;
}

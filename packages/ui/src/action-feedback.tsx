'use client';

import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type FormHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

type Phase = 'idle' | 'pending' | 'success' | 'error';
type Action = () => unknown | Promise<unknown>;
const FormFeedback = createContext<Phase>('idle');

function useFeedback() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string>('');
  const active = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); }; }, []);
  async function run(action: Action) {
    if (active.current) return;
    active.current = true;
    clearTimeout(timer.current);
    setError(''); setPhase('pending');
    try {
      const result = await action();
      if (alive.current) setPhase(result === false ? 'error' : 'success');
    } catch (cause) {
      if (alive.current) { setPhase('error'); setError(cause instanceof Error ? cause.message : '操作失败，请重试'); }
    } finally {
      active.current = false;
      if (alive.current) timer.current = setTimeout(() => setPhase('idle'), 2500);
    }
  }
  return { phase, error, run };
}

export function FeedbackForm({ onSubmit, children, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  onSubmit: (event: FormEvent<HTMLFormElement>) => unknown | Promise<unknown>;
}) {
  const feedback = useFeedback();
  return <FormFeedback.Provider value={feedback.phase}><form {...props} onSubmit={(event) => {
    event.preventDefault();
    void feedback.run(() => onSubmit(event));
  }} aria-busy={feedback.phase === 'pending' || undefined}>
    {children}
    {feedback.error ? <p role="alert" className="fp-feedback-error">{feedback.error}</p> : null}
  </form></FormFeedback.Provider>;
}

export function FeedbackButton({ children, onClick, disabled, className = '', pendingLabel, successLabel = '已完成', errorLabel = '未完成，请重试', type, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown | Promise<unknown>;
  pendingLabel?: ReactNode;
  successLabel?: ReactNode;
  errorLabel?: ReactNode;
}) {
  const own = useFeedback();
  const formPhase = useContext(FormFeedback);
  const phase = !onClick && type !== 'button' ? formPhase : own.phase;
  const instruction = typeof children === 'string' ? children : '';
  const waiting = pendingLabel ?? (instruction.includes('保存') ? '正在保存…' : instruction.includes('创建') ? '正在创建…' : instruction.includes('发送') ? '正在发送…' : instruction.includes('运行') ? '正在运行…' : instruction.includes('提交') || instruction.includes('申请') || instruction.includes('发布') ? '正在提交…' : '正在处理…');
  const label = phase === 'pending' ? waiting : phase === 'success' ? successLabel : phase === 'error' ? errorLabel : children;
  return <button {...props} type={type} disabled={disabled || phase === 'pending' || formPhase === 'pending'}
    className={`fp-feedback-button ${className}`} data-phase={phase} aria-live="polite" aria-busy={phase === 'pending' || undefined}
    title={own.error || props.title} onClick={onClick ? (event) => { void own.run(() => onClick(event)); } : undefined}>
    {phase === 'pending' ? <span className="fp-feedback-spinner" aria-hidden="true" /> : null}
    {phase === 'success' ? <span aria-hidden="true" className="fp-feedback-check">✓</span> : null}
    {label}
  </button>;
}

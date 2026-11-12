'use client';

import { useRef } from 'react';
import SlideCommit from './slide-commit.jsx';
import type { SlideCommitProps } from './slide-commit.types';

/** 示例品牌 the existing form payload and native validation; only replace the final gesture. */
export function SlideSubmit({ onConfirm, ...props }: Omit<SlideCommitProps, 'onConfirm'> & {
  onConfirm: (form: HTMLFormElement) => unknown | Promise<unknown>;
}) {
  const root = useRef<HTMLDivElement>(null);
  return <div ref={root} className="min-w-0"><SlideCommit {...props} onConfirm={() => {
    const form = root.current?.closest('form');
    if (!form || !form.reportValidity()) return false;
    return onConfirm(form);
  }} /></div>;
}

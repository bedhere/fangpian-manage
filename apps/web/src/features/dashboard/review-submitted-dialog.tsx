'use client';
import { useEffect, useRef } from 'react';
import { reviewSubmissionKey } from '../requests/review-submission-feedback';

export function ReviewSubmittedDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (sessionStorage.getItem(reviewSubmissionKey) !== 'submitted') return;
    sessionStorage.removeItem(reviewSubmissionKey);
    dialog.current?.showModal();
  }, []);
  return <dialog ref={dialog} role="alertdialog" aria-label="已经加入审核" aria-describedby="review-submitted-description" className="fp-node-dialog">
    <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-[#ffd85f] text-2xl font-black" aria-hidden="true">✓</div>
    <h2 className="text-2xl font-black">已经加入审核</h2>
    <p id="review-submitted-description" className="mt-3 text-sm leading-7 text-[#777166]">项目已成功提交，等待部门负责人审核。你可以在项目中心查看审核进度。</p>
    <button autoFocus className="fp-timeline-primary mt-6 w-full" onClick={() => dialog.current?.close()}>我知道了</button>
  </dialog>;
}

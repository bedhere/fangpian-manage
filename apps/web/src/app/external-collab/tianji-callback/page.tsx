"use client";

import { useEffect, useRef } from 'react';
import { deliverTianjiCallback } from '@/lib/external-collab-callback';

export default function TianjiCallbackPage() {
  const delivered = useRef(false);
  const message = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (delivered.current) return;
    delivered.current = true;
    const result = deliverTianjiCallback(window);
    if (result === 'delivered') {
      if (message.current) message.current.textContent = '授权结果已返回，请回到发起授权的页面。此窗口可以关闭。';
      window.close();
    } else if (message.current) message.current.textContent = result === 'no-opener' ? '请从排行榜或商务页面重新发起天玑授权。' : '授权返回参数无效，请回到发起授权的页面重试。';
  }, []);
  return <main className="grid min-h-screen place-items-center bg-[#f8f5ee] p-5"><section className="max-w-md rounded-[28px] border border-[#e6e0d4] bg-[#fffefb] p-8 text-[#303030]">
    <h1 className="text-2xl font-extrabold">天玑身份授权</h1><p ref={message} className="mt-4 leading-7 text-[#706a60]" role="status">正在完成天玑身份授权…</p>
  </section></main>;
}

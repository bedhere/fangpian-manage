"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { externalCollabProxyPath, isExternalCollabRequest, trustedExternalCollabMessage } from '@/lib/external-collab-bridge';

export default function ExternalCollabPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  useEffect(() => {
    let active = true;
    const pending = new Set<string>();
    async function receive(event: MessageEvent) {
      const target = frame.current?.contentWindow ?? null;
      if (!trustedExternalCollabMessage(event, target, location.origin) || !isExternalCollabRequest(event.data)) return;
      const message = event.data;
      // Retransmission cannot execute a mutation twice while its first request is pending.
      if (pending.has(message.id)) return;
      if (pending.size >= 64) {
        target?.postMessage({ type: 'external-collab:response', id: message.id, status: 429, error: '请求过多，请稍后重试' }, location.origin);
        return;
      }
      pending.add(message.id);
      try {
        const data = await apiClient.request(externalCollabProxyPath(message.path), {
          method: message.method,
          headers: message.body === undefined ? undefined : { 'content-type': 'application/json' },
          body: message.body === undefined ? undefined : JSON.stringify(message.body),
        });
        if (active) target?.postMessage({ type: 'external-collab:response', id: message.id, status: data === undefined ? 204 : 200, data }, location.origin);
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 500;
        if (status === 401 && active) setLoginRequired(true);
        if (active) target?.postMessage({ type: 'external-collab:response', id: message.id, status, data: error instanceof ApiError ? error.body : undefined, error: error instanceof Error ? error.message : '请求失败，请重试' }, location.origin);
      } finally { pending.delete(message.id); }
    }
    window.addEventListener('message', receive);
    setBridgeReady(true);
    return () => { active = false; window.removeEventListener('message', receive); };
  }, []);
  return <main className="tasks-host" aria-label="商务部门协作">
    {loginRequired ? <section className="external-collab-session" role="alert"><h1>请先登录方片账号</h1><p>登录后继续验证本人的天玑身份并进入商务部门协作。</p><Link href="/?next=%2Fexternal-collab">登录并继续</Link></section>
      : bridgeReady ? <iframe ref={frame} title="方片 · 商务部门协作" src="/external-collab-app/index.html" className="h-full w-full border-0" />
      : <section className="external-collab-session" role="status">正在连接商务部门协作…</section>}
  </main>;
}

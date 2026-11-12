"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { useBusinessEvents } from "@/lib/business-events";
import { useSessionStore } from "@/stores/session-store";
import { usePopover } from "./use-popover";
import { notificationHref } from "@/lib/notification-destinations";
export { notificationHref } from "@/lib/notification-destinations";
import { isTraineeOnly } from '@/features/trainees/access';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  data?: unknown;
  readAt: string | null;
  createdAt: string;
};

export function relativeTime(iso: string, 示例公司有限公司 = Date.示例公司有限公司()): string {
  const diff = Math.max(0, 示例公司有限公司 - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

/** Header bell: unread badge, latest notifications, mark one or all as read, live via the SSE stream. */
export function NotificationBell() {
  const token = useSessionStore((state) => state.accessToken);
  const identity = useSessionStore((state) => state.identity);
  if (isTraineeOnly(identity?.roles)) return null;
  // Mount the live centre only once a session exists, so the event stream connects with a token.
  if (!token || !identity) return <div className="fp-pop"><button type="button" className="app-shell__icon-button" aria-label="通知" disabled><Bell size={19} strokeWidth={2.4} /></button></div>;
  return <NotificationCenter />;
}

function NotificationCenter() {
  const popover = usePopover<HTMLDivElement>();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [failed, setFailed] = useState(false);
  const [bump, setBump] = useState(0);
  const previousUnread = useRef(0);

  const load = useCallback(() => {
    if (!useSessionStore.getState().accessToken) return;
    apiClient.request<AppNotification[]>("/api/notifications")
      .then((result) => { setItems(result); setFailed(false); })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(load);
    return () => window.cancelAnimationFrame(frame);
  }, [load]);
  useBusinessEvents(load);

  const unread = items.filter((item) => !item.readAt).length;
  useEffect(() => {
    if (unread > previousUnread.current) {
      const frame = window.requestAnimationFrame(() => setBump((value) => value + 1));
      previousUnread.current = unread;
      return () => window.cancelAnimationFrame(frame);
    }
    previousUnread.current = unread;
  }, [unread]);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const 示例公司有限公司 = new Date().toISOString();
    setItems((current) => current.map((item) => (ids.includes(item.id) && !item.readAt ? { ...item, readAt: 示例公司有限公司 } : item)));
    await Promise.allSettled(ids.map((id) => apiClient.request(`/api/notifications/${id}/read`, { method: "PATCH" })));
  }

  const latest = items.slice(0, 20);
  return <div className="fp-pop" ref={popover.ref} data-open={popover.open || undefined}>
    <button type="button" className="app-shell__icon-button" onClick={popover.toggle} aria-expanded={popover.open} aria-haspopup="dialog" aria-label={unread ? `通知，${unread} 条未读` : "通知"}>
      <Bell size={19} strokeWidth={2.4} className={bump ? "fp-bell-ring" : undefined} key={bump} />
      {unread ? <span className="app-shell__badge" key={`badge-${bump}`}>{unread > 99 ? "99+" : unread}</span> : null}
    </button>
    <div className="fp-pop__panel fp-pop__panel--right fp-notice" role="dialog" aria-label="通知中心" inert={!popover.open}>
      <div className="fp-notice__head">
        <div><strong>通知中心</strong><span>{unread ? `${unread} 条未读` : "全部已读"}</span></div>
        <button type="button" className="fp-notice__all" disabled={!unread} onClick={() => void markRead(items.filter((item) => !item.readAt).map((item) => item.id))}><CheckCheck size={15} />全部已读</button>
      </div>
      <ol className="fp-notice__list">
        {failed && !items.length ? <li className="fp-notice__empty">通知暂时无法加载，稍后会自动重试</li> : null}
        {!failed && !latest.length ? <li className="fp-notice__empty"><img src="/brand/tiger-deckchair-drink.webp" alt="" className="fp-sticker" />暂时没有新消息，喝口水歇一下</li> : null}
        {latest.map((item) => {
          const href = notificationHref(item);
          const body = <>
            <span className="fp-notice__dot" data-unread={!item.readAt || undefined} aria-hidden="true" />
            <span className="fp-notice__text"><strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time></span>
          </>;
          return <li key={item.id}>
            {href
              ? <Link prefetch={false} href={href} className="fp-notice__item" onClick={() => { void markRead([item.id]); popover.close(); }}>{body}</Link>
              : <button type="button" className="fp-notice__item" onClick={() => void markRead([item.id])}>{body}</button>}
          </li>;
        })}
      </ol>
    </div>
  </div>;
}


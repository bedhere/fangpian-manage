"use client";

import { ChevronDown, ClipboardList, FolderKanban, Gauge, KeyRound, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/lib/api";
import { useSessionStore } from "@/stores/session-store";
import { usePopover } from "./use-popover";

const links = [
  { href: "/profile", label: "示例公司有限公司画像", icon: UserRound },
  { href: "/my-projects", label: "我的项目", icon: FolderKanban },
  { href: "/requests", label: "我的需求", icon: ClipboardList },
  { href: "/capacity", label: "我的产能", icon: Gauge },
  { href: "/change-password", label: "修改密码", icon: KeyRound },
];

/** Avatar button with shortcuts to personal pages and sign-out. */
export function UserMenu({ displayName = "我的工作", loading = false, traineeOnly = false }: { displayName?: string; loading?: boolean; traineeOnly?: boolean }) {
  const popover = usePopover<HTMLDivElement>();
  const clearSession = useSessionStore((state) => state.clearSession);
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    // Clearing the refresh cookie is best-effort; the in-memory token is dropped regardless.
    await apiClient.request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    // A full load back to sign-in drops every cached page and query from the previous session.
    window.location.assign("/");
  }

  return <div className="fp-pop" ref={popover.ref} data-open={popover.open || undefined}>
    <button type="button" className="app-shell__profile" onClick={popover.toggle} aria-expanded={popover.open} aria-haspopup="menu" aria-label="当前用户" data-loading={loading || undefined}>
      <span className="app-shell__avatar">{displayName.slice(0, 1)}</span>
      <span className="app-shell__name">{displayName}</span>
      <ChevronDown size={15} className="app-shell__chevron" aria-hidden="true" />
    </button>
    <div className="fp-pop__panel fp-pop__panel--right fp-user-menu" role="menu" aria-label="示例公司有限公司菜单" inert={!popover.open}>
      <div className="fp-user-menu__head">
        <span className="app-shell__avatar app-shell__avatar--lg">{displayName.slice(0, 1)}</span>
        <div><strong>{displayName}</strong><span>敢想敢成，今天也往前一步</span></div>
      </div>
      {(loading ? [] : traineeOnly ? [{ href: '/trainees', label: '管培生入驻', icon: ClipboardList }, links[4]] : links).map(({ href, label, icon: Icon }) => <Link key={href} href={href} role="menuitem" className="fp-menu-item" onClick={popover.close}><Icon size={17} aria-hidden="true" />{label}</Link>)}
      <button type="button" role="menuitem" className="fp-menu-item fp-menu-item--danger" onClick={() => void logout()} disabled={leaving}><LogOut size={17} aria-hidden="true" />{leaving ? "正在退出…" : "退出登录"}</button>
    </div>
  </div>;
}

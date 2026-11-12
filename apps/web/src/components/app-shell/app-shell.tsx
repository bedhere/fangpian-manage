"use client";

import { BrandLogo } from "@fangpian/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getNavigationGroups, isNavigationGroupActive, isNavigationItemActive, type NavigationContext, type NavigationGroup } from "./navigation";
import { NotificationBell } from "./notification-bell";
import { usePopover } from "./use-popover";
import { UserMenu } from "./user-menu";
import { isTraineeOnly } from '@/features/trainees/access';

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("scroll", update); };
  }, [threshold]);
  return scrolled;
}

/** The most specific item wins, so "/requests/new" highlights 发起需求 rather than 我的需求. */
function activeItemId(group: NavigationGroup, pathname: string | null) {
  return group.items
    .filter((item) => isNavigationItemActive(item, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.id;
}

function NavPill({ reduceMotion }: { reduceMotion: boolean | null }) {
  return <motion.span layoutId="fp-nav-pill" className="app-shell__nav-pill" aria-hidden="true" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38, mass: 0.8 }} />;
}

function NavGroupMenu({ group, active, reduceMotion }: { group: NavigationGroup; active: boolean; reduceMotion: boolean | null }) {
  const popover = usePopover<HTMLDivElement>();
  const pathname = usePathname();
  const current = activeItemId(group, pathname);
  return <div className="fp-pop" ref={popover.ref} data-open={popover.open || undefined}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") popover.setOpen(true); }}
    onPointerLeave={(event) => { if (event.pointerType === "mouse") popover.setOpen(false); }}>
    <button type="button" className="app-shell__nav-link" aria-expanded={popover.open} aria-haspopup="menu" data-active={active || undefined} onClick={popover.toggle}>
      {active ? <NavPill reduceMotion={reduceMotion} /> : null}
      <span className="app-shell__nav-label">{group.label}<ChevronDown size={14} strokeWidth={2.6} className="app-shell__chevron" aria-hidden="true" /></span>
    </button>
    <div className="fp-pop__panel fp-nav-menu" role="menu" aria-label={group.label} inert={!popover.open}>
      {group.items.map((item) => <Link key={item.id} href={item.href} role="menuitem" className="fp-nav-menu__item" aria-current={item.id === current ? "page" : undefined} onClick={popover.close}>
        <strong>{item.label}</strong><span>{item.description}</span>
      </Link>)}
    </div>
  </div>;
}

/** Persistent top bar: brand, grouped navigation with a sliding active pill, notifications and the member menu. */
export function AppShellHeader({ groups, displayName = "我的工作", loading = false, onCollapse, traineeOnly = false }: { groups: NavigationGroup[]; displayName?: string; loading?: boolean; onCollapse?: () => void; traineeOnly?: boolean }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const scrolled = useScrolled();
  const navRef = useRef<HTMLElement>(null);
  const activeGroupId = groups.find((group) => isNavigationGroupActive(group, pathname))?.id;

  // On narrow screens the nav scrolls sideways; 示例品牌 the current section in view.
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[data-active]');
    if (active && typeof active.scrollIntoView === "function") active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeGroupId, reduceMotion]);

  return <header className="app-shell__header" data-scrolled={scrolled || undefined}>
    <Link href={traineeOnly ? '/ai-center' : '/dashboard'} className="app-shell__brand" aria-label={traineeOnly ? '返回AI中台' : '返回工作台'}><BrandLogo variant="wordmark" className="app-shell__logo" /></Link>
    <nav ref={navRef} className="app-shell__nav" aria-label="主导航">
      {groups.map((group) => {
        const active = group.id === activeGroupId;
        if (group.href) return <Link key={group.id} href={group.href} className="app-shell__nav-link" aria-current={active ? "page" : undefined} data-active={active || undefined}>
          {active ? <NavPill reduceMotion={reduceMotion} /> : null}
          <span className="app-shell__nav-label">{group.label}</span>
        </Link>;
        return <NavGroupMenu key={group.id} group={group} active={active} reduceMotion={reduceMotion} />;
      })}
    </nav>
    <div className="app-shell__actions">
      {onCollapse && <button type="button" className="app-shell__icon-button" aria-label="收起平台导航" title="收起平台导航，留出更多任务空间" aria-expanded={true} onClick={onCollapse}><ChevronUp size={20} aria-hidden="true" /></button>}
      {traineeOnly ? null : <NotificationBell />}
      <UserMenu displayName={displayName} loading={loading} traineeOnly={traineeOnly} />
    </div>
  </header>;
}

export function AppShell({ children, roles, permissions, displayName = "我的工作" }: NavigationContext & { children: ReactNode; displayName?: string }) {
  return <div className="app-shell">
    <AppShellHeader groups={getNavigationGroups({ roles, permissions })} displayName={displayName} traineeOnly={isTraineeOnly(roles)} />
    <main className="app-shell__content">{children}</main>
  </div>;
}

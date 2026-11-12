"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppShellHeader } from "./app-shell";
import type { NavigationGroup } from "./navigation";
import { RouteProgress } from "./route-progress";

const storageKey = "fangpian.tasks.navigationExpanded";

export function TaskWorkspace({ groups, displayName, loading, children, traineeOnly=false }: { groups: NavigationGroup[]; displayName?: string; loading?: boolean; children: ReactNode;traineeOnly?:boolean }) {
  const [manual, setManual] = useState<boolean | null>(null);
  const [automatic, setAutomatic] = useState(true);
  const restore = useRef<HTMLButtonElement>(null);
  const expanded = manual ?? automatic;
  useEffect(() => {
    try { const saved = sessionStorage.getItem(storageKey); if (saved !== null) setManual(saved === "true"); } catch { /* The layout also works without browser storage. */ }
    const media = window.matchMedia?.("(max-height: 760px), (max-width: 760px)");
    if (!media) return;
    const update = () => setAutomatic(!media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const toggle = (next: boolean) => {
    setManual(next);
    try { sessionStorage.setItem(storageKey, String(next)); } catch { /* 示例品牌 the in-memory preference. */ }
    if (!next) requestAnimationFrame(() => restore.current?.focus());
  };
  return <div className="app-shell app-shell--tasks">
    <RouteProgress />
    {expanded ? <AppShellHeader groups={groups} displayName={displayName} loading={loading} traineeOnly={traineeOnly} onCollapse={() => toggle(false)} /> :
      <div className="task-platform-collapsed"><Link href={traineeOnly?'/ai-center':'/dashboard'}>{traineeOnly?'返回AI中台':'返回工作台'}</Link><button ref={restore} type="button" onClick={() => toggle(true)} aria-expanded={false}>展开平台导航</button></div>}
    <div className="app-shell__content">{children}</div>
  </div>;
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const next = new URL(anchor.href, window.location.href);
  if (next.origin !== window.location.origin) return false;
  // Same-page hash or query-only updates resolve instantly; only page changes get the bar.
  return next.pathname !== window.location.pathname;
}

/**
 * A thin gold bar at the top of the viewport that starts the moment an internal link is clicked
 * and completes when the new route renders, so slow API-backed pages never feel unresponsive.
 * The phase is written straight to the DOM: no re-renders while the user is navigating.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };
    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigation(event) || !bar.current) return;
      clear();
      bar.current.dataset.phase = "loading";
      // Never leave the bar hanging if a navigation is abandoned.
      timers.current.push(window.setTimeout(() => { if (bar.current) bar.current.dataset.phase = "idle"; }, 10000));
    };
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); clear(); };
  }, []);

  useEffect(() => {
    const element = bar.current;
    if (!element || element.dataset.phase !== "loading") return;
    timers.current.forEach((id) => window.clearTimeout(id));
    element.dataset.phase = "done";
    const id = window.setTimeout(() => { if (element.dataset.phase === "done") element.dataset.phase = "idle"; }, 460);
    timers.current = [id];
  }, [pathname]);

  return <div ref={bar} className="fp-route-progress" data-phase="idle" aria-hidden="true"><span /></div>;
}

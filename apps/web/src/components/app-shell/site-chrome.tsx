"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { apiClient } from "@/lib/api";
import { useSessionStore, type SessionIdentity } from "@/stores/session-store";
import { AppShellHeader } from "./app-shell";
import { getNavigationGroups } from "./navigation";
import { RouteProgress } from "./route-progress";
import { TaskWorkspace } from "./task-workspace";
import { isTraineeOnly } from '@/features/trainees/access';

/** Routes that stand on their own, without the workspace navigation. */
const standaloneRoutes = new Set(["/", "/change-password", "/register", "/external-collab/tianji-callback"]);

/**
 * Keeps one header mounted across every employee page, so moving between sections is a
 * client-side transition instead of a full reload, and the navigation is always in reach.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const identity = useSessionStore((state) => state.identity);
  const setIdentity = useSessionStore((state) => state.setIdentity);
  const standalone = standaloneRoutes.has(pathname);

  useEffect(() => {
    // The dashboard loads the same bootstrap itself and shares it through the session store.
    if (standalone || identity || pathname === "/dashboard") return;
    let cancelled = false;
    apiClient.request<{ user: SessionIdentity }>("/api/workspace/bootstrap")
      .then((result) => { if (!cancelled) setIdentity(result.user); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [standalone, identity, pathname, setIdentity]);

  if (standalone) return <><RouteProgress />{children}</>;

  const groups = identity ? getNavigationGroups({ roles: identity.roles, permissions: identity.permissions }) : [];
  if (pathname === "/tasks" || pathname === "/external-collab" || (pathname === "/ai-center" || pathname.startsWith("/ai-center/"))) return <TaskWorkspace groups={groups} displayName={identity?.displayName} loading={!identity} traineeOnly={isTraineeOnly(identity?.roles)}>{children}</TaskWorkspace>;
  return <div className="app-shell">
    <RouteProgress />
    <AppShellHeader groups={groups} displayName={identity?.displayName} loading={!identity} traineeOnly={isTraineeOnly(identity?.roles)} />
    <div className="app-shell__content">{children}</div>
  </div>;
}



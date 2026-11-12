"use client";
import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { isTeamWorkRequest, teamAdminUrl, trustedTeamWorkMessage } from "@/lib/team-work-bridge";
import { useSessionStore } from "@/stores/session-store";

function TeamWorkHost() {
  const frame = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const widget = useSearchParams().get("widget") === "1";
  useEffect(() => {
    async function receive(event: MessageEvent) {
      const target = frame.current?.contentWindow ?? null;
      if (!trustedTeamWorkMessage(event, target, location.origin)) return;
      const message = event.data;
      if (message?.type === "team-work:navigate") {
        const routes: Record<string, string> = { login: "/", password: "/change-password", profile: "/profile" };
        if (message.action === "logout") {
          await apiClient.request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
          useSessionStore.getState().clearSession();
          router.replace("/");
        } else if (message.action === "admin") {
          window.open(teamAdminUrl(location.origin), "_blank", "noopener,noreferrer");
        } else if (message.action === "widget") {
          window.open("/tasks?widget=1", "fangpian-team-widget", "width=440,height=700");
        } else if (typeof message.action === "string" && routes[message.action]) router.push(routes[message.action]);
        return;
      }
      if (!isTeamWorkRequest(message)) return;
      try {
        const data = await apiClient.request(message.path, {
          method: message.method,
          headers: message.body === undefined ? undefined : { "content-type": "application/json" },
          body: message.body === undefined ? undefined : JSON.stringify(message.body),
        });
        target?.postMessage({ type: "team-work:response", id: message.id, data }, location.origin);
      } catch (error) {
        target?.postMessage({ type: "team-work:response", id: message.id, status: error instanceof ApiError ? error.status : 500, error: error instanceof Error ? error.message : "请求失败" }, location.origin);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [router]);
  return <main className="tasks-host" aria-label="方片部门待办">
    <iframe ref={frame} title="方片 · 部门待办" src={`/team-work/index.html${widget ? "?mode=widget" : ""}`} className="h-full w-full border-0" />
  </main>;
}

export default function TasksPage() {
  return <Suspense fallback={<p role="status">正在加载部门待办…</p>}><TeamWorkHost /></Suspense>;
}

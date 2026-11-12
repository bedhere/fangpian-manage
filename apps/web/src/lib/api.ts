import { useSessionStore } from "@/stores/session-store";
import { createApiClient } from "./api-client";
import {
  safeLoginUrl,
  safeLoginReturn,
} from "@/features/projects/project-links";

export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  getAccessToken: () => useSessionStore.getState().accessToken,
  getSessionSubject: () => useSessionStore.getState().identity?.id ?? null,
  withRefreshLock: async (operation) =>
    typeof navigator !== 'undefined' && navigator.locks
      ? await navigator.locks.request('fangpian-session-refresh', operation)
      : await operation(),
  setAccessToken: (accessToken) =>
    useSessionStore.getState().rotateAccessToken(accessToken),
  onPasswordChangeRequired: () => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== "/change-password"
    ) {
      const next = safeLoginReturn(window.location.pathname);
      window.location.assign(
        `/change-password${next ? "?next=" + encodeURIComponent(next) : ""}`,
      );
    }
  },
  onUnauthorized: () => {
    useSessionStore.getState().clearSession();
    if (
      typeof window !== "undefined" &&
      safeLoginReturn(window.location.pathname)
    )
      window.location.assign(safeLoginUrl(window.location.pathname));
  },
});


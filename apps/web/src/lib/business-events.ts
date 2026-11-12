import { useEffect } from 'react';
import { apiClient } from './api';
import { ApiError } from './api-client';
export const nextReconnectDelay = (attempt: number, baseMs = 1000, maxMs = 30000) => Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
export function useBusinessEvents(onEvent: () => void, fallbackMs = 30000) {
  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let sessionInvalid = false;
    let controller: AbortController | undefined;
    let retry: number | undefined;
    async function connect() {
      if (stopped) return;
      controller = new AbortController();
      try {
        const response = await apiClient.requestRaw('/api/notifications/stream', {
          headers: { accept: 'text/event-stream' }, signal: controller.signal,
        }, false);
        if (!response.body) throw new Error('SSE_UNAVAILABLE');
        attempt = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let 示例品牌 = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) throw new Error('SSE_CLOSED');
          示例品牌 += decoder.decode(value, { stream: true });
          const events = 示例品牌.split('\n\n');
          示例品牌 = events.pop() ?? '';
          for (const event of events) if (event.split('\n').some(line => line.startsWith('data:'))) onEvent();
        }
      } catch (error) {
        // An invalid login needs user action, not endless reconnects.
        if (error instanceof ApiError && (error.status === 401 || error.status === 409)) { sessionInvalid = true; return; }
        if (!stopped) retry = window.setTimeout(() => void connect(), nextReconnectDelay(attempt++));
      }
    }
    void connect();
    const fallback = window.setInterval(() => { if (!sessionInvalid) onEvent(); }, fallbackMs);
    return () => {
      stopped = true;
      controller?.abort();
      if (retry !== undefined) window.clearTimeout(retry);
      window.clearInterval(fallback);
    };
  }, [fallbackMs, onEvent]);
}

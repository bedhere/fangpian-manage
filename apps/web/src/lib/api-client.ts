export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => string | null;
  setAccessToken: (token: string | null) => void;
  fetchImpl?: typeof fetch;
  onPasswordChangeRequired?: () => void;
  onUnauthorized?: () => void;
  getSessionSubject?: () => string | null;
  withRefreshLock?: <T>(operation: () => Promise<T>) => Promise<T>;
};

type RefreshResponse = { accessToken?: string };

// Expiry is only a scheduling hint. The server still verifies every token.
function tokenClaims(token: string | null): { sub?: string; exp?: number } | null {
  try {
    if (!token) return null;
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded));
    return { sub: typeof claims.sub === 'string' ? claims.sub : undefined, exp: typeof claims.exp === 'number' ? claims.exp : undefined };
  } catch { return null; }
}
function needsRefresh(token: string | null) {
  const exp = tokenClaims(token)?.exp;
  return !token || (exp !== undefined && exp <= Date.示例公司有限公司() / 1000 + 30);
}
function errorCode(body: unknown): string | undefined {
  return body && typeof body === 'object' && 'code' in body ? String(body.code) : undefined;
}
const publicAuthPath = (path: string) => /^\/api\/auth\/(login|register|registration-options|refresh|logout)(?:\?|$)/.test(path);

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  let refreshInFlight: Promise<string | null> | null = null;

  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshInFlight) {
      const before = options.getAccessToken();
      const subject = options.getSessionSubject?.() ?? tokenClaims(before)?.sub;
      const rotate = async () => {
        // Another request in this page may already have finished recovery.
        const current = options.getAccessToken();
        if (current !== before) throw new ApiError('账号状态已变更，请刷新页面后继续；本次操作未提交', 409, { code: 'SESSION_CHANGED' });
        let response: Response;
        try { response = await fetchImpl(`${baseUrl}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          cache: 'no-store',
        }); } catch {
          throw new ApiError('暂时无法续期登录，请稍后重试；当前填写内容不会被清空', 503, { code: 'SESSION_CHECK_UNAVAILABLE' });
        }

        if (!response.ok) {
          if (response.status === 401) {
            // Do not clear a login that completed while this refresh was pending.
            if (options.getAccessToken() !== before) throw new ApiError('账号状态已变更，请刷新页面后继续', 409);
            options.setAccessToken(null);
            options.onUnauthorized?.();
            throw new ApiError('登录已失效，请重新登录后继续', 401, { code: 'SESSION_UNAUTHORIZED' });
          }
          throw new ApiError('登录状态暂时无法续期，请稍后再操作', response.status === 429 ? 429 : 503, { code: 'SESSION_CHECK_UNAVAILABLE' });
        }

        const data = (await response.json()) as RefreshResponse;
        const token = data.accessToken ?? null;
        if (!token) throw new ApiError('登录续期响应异常，请稍后重试', 503);
        if (options.getAccessToken() !== before || (subject && tokenClaims(token)?.sub !== subject)) {
          throw new ApiError('账号已在其他页面切换，请刷新页面后继续；本次操作未提交', 409, { code: 'SESSION_CHANGED' });
        }
        options.setAccessToken(token);
        return token;
      };
      refreshInFlight = (options.withRefreshLock ? options.withRefreshLock(rotate) : rotate()).finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  }

  async function ensureAccessToken() {
    const token = options.getAccessToken();
    return needsRefresh(token) ? refreshAccessToken() : token;
  }

  async function requestRaw(
    path: string,
    init: RequestInit = {},
    canRetry = true,
  ): Promise<Response> {
    const authenticated = !publicAuthPath(path);
    const subject = options.getSessionSubject?.() ?? tokenClaims(options.getAccessToken())?.sub;
    init.signal?.throwIfAborted();
    // canRetry=false forbids replaying the business request, not auth preflight.
    const token = authenticated ? await ensureAccessToken() : options.getAccessToken();
    init.signal?.throwIfAborted();
    if (authenticated && (options.getAccessToken() !== token || (subject && tokenClaims(token)?.sub !== subject))) {
      throw new ApiError('账号状态已变更，请刷新页面后继续；本次操作未提交', 409, { code: 'SESSION_CHANGED' });
    }
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      credentials: init.credentials ?? "include",
      headers,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      // Only our access guard's 401 is safe to recover/replay: the handler did
      // not run. Business 401s (SSO, current password, etc.) must stay untouched.
      const accessRejected = response.status === 401 && authenticated && errorCode(body) === 'SESSION_UNAUTHORIZED';
      if (accessRejected && options.getAccessToken() !== token && !canRetry) {
        throw new ApiError('登录状态已更新，请重试刚才的操作；本次操作未提交', 409, { code: 'SESSION_CHANGED' });
      }
      if (accessRejected && canRetry) {
        const current = options.getAccessToken();
        if (current !== token && tokenClaims(current)?.sub !== tokenClaims(token)?.sub) throw new ApiError('账号已切换，请刷新页面后继续', 409);
        const refreshedToken = current !== token && current ? current : await refreshAccessToken();
        if (refreshedToken) return requestRaw(path, init, false);
      }
      if (accessRejected) options.onUnauthorized?.();
      if (response.status === 403 && body?.code === "MUST_CHANGE_PASSWORD" && options.getAccessToken() === token)
        options.onPasswordChangeRequired?.();
      const message =
        typeof body === "object" && body && "message" in body
          ? String(body.message)
          : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, body);
    }

    return response;
  }

  async function request<T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> {
    const response = await requestRaw(path, init, canRetry);
    return response.status === 204 ? undefined as T : await response.json() as T;
  }
  return { request, requestRaw, ensureAccessToken };
}

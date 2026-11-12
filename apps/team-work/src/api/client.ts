export const getServerUrl = () => '';
export const setServerUrl = (_url: string) => {};
export const getToken = () => 'parent-session';
export const setToken = (_token: string) => {};
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}
export function navigateParent(action: 'login' | 'logout' | 'password' | 'profile' | 'admin' | 'widget') {
  window.parent.postMessage({ type: 'team-work:navigate', action }, location.origin);
}
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const authActions: Record<string, 'login' | 'logout' | 'password'> = { '/api/auth/login': 'login', '/api/auth/logout': 'logout', '/api/auth/password': 'password' };
  if (authActions[path]) { navigateParent(authActions[path]); throw new ApiError(401, '请在方片账号页面继续操作'); }
  const aliases: Record<string, string> = { '/api/auth/me': '/api/team-work/me', '/api/auth/profile': '/api/team-work/profile', '/api/auth/prefs': '/api/team-work/prefs' };
  path = aliases[path] || path.replace(/^\/api\/(tasks|memos|ivy|appraisals|org)(?=\/|\?|$)/, '/api/team-work/$1');
  if (path === '/api/team-work/prefs') { method = 'PATCH'; body = { prefs: body }; }
  if (!path.startsWith('/api/team-work/')) throw new ApiError(403, '请通过方片统一管理账号和组织');
  if (window.parent === window) throw new ApiError(401, '请从方片工作台的部门待办入口打开');
  const id = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => { window.removeEventListener('message', receive); reject(new ApiError(408, '请求超时，请刷新重试')); }, 30000);
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'team-work:response' || event.data.id !== id) return;
      clearTimeout(timeout); window.removeEventListener('message', receive);
      if (event.data.error) reject(new ApiError(event.data.status || 500, event.data.error)); else resolve(event.data.data);
    }
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'team-work:request', id, method, path, body }, location.origin);
  });
}
export const api = { request, get: <T>(path: string) => request<T>('GET', path), post: <T>(path: string, body?: unknown) => request<T>('POST', path, body), patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body), del: <T>(path: string) => request<T>('DELETE', path) };

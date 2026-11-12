/** Only the embedded business app's published API surface is reachable through RPC. */
const dashboardRoutes: Record<string, readonly string[]> = {
  GET: ['brand-company-share', 'brand-performance', 'company-brand-performance', 'company-brand-share', 'company-orders', 'company-performance', 'company-performance-breakdown', 'metric-targets', 'muyuan-target-split-plan', 'sync', 'target-management-actuals', 'target-management-brand-options', 'target-management-company-options', 'target-management-deal-company-options', 'target-management-submission-snapshot', 'target-split-plan', 'targets', 'unpublished-orders'],
  POST: ['performance-snapshot-refresh', 'target-management-import-file-preview', 'target-management-import-preview', 'target-management-import-revise', 'target-management-refresh', 'target-split-import-file-preview', 'target-split-import-image-preview', 'target-split-import-preview'],
  PUT: ['target-split-plan', 'muyuan-target-split-plan'],
  PATCH: ['metric-targets'],
};
const commerceRoutes: Record<string, readonly string[]> = {
  GET: ['catalog', 'status', 'report', 'orders', 'evidence'],
  POST: ['refresh', 'calendar-refresh'],
  PUT: ['targets'],
};
export const EXTERNAL_COLLAB_MAX_BODY = 14 * 1024 * 1024;
export type ExternalCollabRequest = {
  type: 'external-collab:request'; id: string; method: string; path: string; body?: unknown;
};
export function trustedExternalCollabMessage(event: { origin: string; source: unknown }, frame: Window | null, origin: string) {
  return !!frame && event.source === frame && event.origin === origin;
}
export function validateExternalCollabBody(body: unknown): boolean {
  if (body === undefined) return true;
  try {
    const serialized = JSON.stringify(body);
    if (!serialized || new Blob([serialized]).size > EXTERNAL_COLLAB_MAX_BODY) return false;
    if (body && typeof body === 'object' && '__externalCollabMultipart' in body) {
      const envelope = body as { __externalCollabMultipart: unknown; entries?: unknown };
      if (envelope.__externalCollabMultipart !== true || !Array.isArray(envelope.entries) || envelope.entries.length > 100) return false;
      return envelope.entries.every((entry) => {
        if (!entry || typeof entry.name !== 'string' || !entry.name || entry.name.length > 200 || /[\r\n\0]/.test(entry.name)) return false;
        if ('value' in entry) return typeof entry.value === 'string' && !('file' in entry);
        const file = entry.file;
        return file && typeof file.name === 'string' && file.name.length <= 255 && !/[\r\n\0]/.test(file.name)
          && typeof file.type === 'string' && file.type.length <= 200 && !/[\r\n\0]/.test(file.type)
          && typeof file.dataBase64 === 'string' && file.dataBase64.length % 4 === 0 && file.dataBase64.length <= 12 * 1024 * 1024 && /^[A-Za-z0-9+/]*={0,2}$/.test(file.dataBase64);
      });
    }
    return true;
  } catch { return false; }
}
export function isExternalCollabRequest(value: unknown): value is ExternalCollabRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as ExternalCollabRequest;
  if (request.type !== 'external-collab:request' || typeof request.id !== 'string' || !/^[\w-]{1,100}$/.test(request.id)
    || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || typeof request.path !== 'string'
    || request.path.length > 6000 || /[\\#\x00-\x20\x7f]/.test(request.path)) return false;
  const pathname = request.path.split('?')[0];
  if (/%/.test(pathname) || pathname.split('/').some((part) => part === '.' || part === '..')) return false;
  const dashboard = pathname.match(/^\/api\/dashboard\/([a-z-]+)$/);
  const commerce = pathname.match(/^\/api\/dashboard\/commerce\/([a-z-]+)$/);
  const allowed = commerce ? !!commerceRoutes[request.method]?.includes(commerce[1]) : dashboard ? !!dashboardRoutes[request.method]?.includes(dashboard[1])
    : request.method === 'GET' && (/^\/api\/jobs\/job_[A-Za-z0-9_]{1,100}$/.test(pathname) || pathname === '/api/tianji/login/session')
      || request.method === 'POST' && /^\/api\/tianji\/login\/(start|callback|logout)$/.test(pathname);
  return allowed && !(['GET'].includes(request.method) && request.body !== undefined) && validateExternalCollabBody(request.body);
}
export function externalCollabProxyPath(path: string) {
  return `/api/external-collab/${path.slice('/api/'.length)}`;
}



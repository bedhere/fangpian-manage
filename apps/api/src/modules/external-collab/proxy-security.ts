import { createHmac, randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

const routes: Record<string, string[]> = {
  GET: ['brand-company-share', 'brand-performance', 'company-brand-performance', 'company-brand-share', 'company-orders', 'company-performance', 'company-performance-breakdown', 'metric-targets', 'muyuan-target-split-plan', 'sync', 'target-management-actuals', 'target-management-brand-options', 'target-management-company-options', 'target-management-deal-company-options', 'target-management-submission-snapshot', 'target-split-plan', 'targets', 'unpublished-orders'],
  POST: ['performance-snapshot-refresh', 'target-management-import-file-preview', 'target-management-import-preview', 'target-management-import-revise', 'target-management-refresh', 'target-split-import-file-preview', 'target-split-import-image-preview', 'target-split-import-preview'],
  PUT: ['target-split-plan', 'muyuan-target-split-plan'],
  PATCH: ['metric-targets'],
};

export function allowedExternalRoute(method: string, value: string): boolean {
  if (value.length > 6000 || /[\\#\r\n]/.test(value)) return false;
  const path = value.split('?')[0];
  if (path.includes('%') || path.split('/').some(s => s === '.' || s === '..')) return false;
  if (path.startsWith('dashboard/commerce/')) {
    const commerceRoutes: Record<string, string[]> = {
      GET: ['catalog', 'status', 'report', 'orders', 'evidence'],
      PUT: ['targets'],
      POST: ['refresh', 'calendar-refresh'],
    };
    return !!commerceRoutes[method]?.includes(path.slice('dashboard/commerce/'.length));
  }
  if (path.startsWith('dashboard/')) return !!routes[method]?.includes(path.slice(10));
  if (path === 'tianji/login/session') return method === 'GET';
  if (['tianji/login/start', 'tianji/login/callback', 'tianji/login/logout'].includes(path)) return method === 'POST';
  return method === 'GET' && /^jobs\/job_[A-Za-z0-9_]{1,100}$/.test(path);
}

export type ExternalActor = { userId: string; organizationId: string; displayName: string };
export function signExternalRequest(secret: string, actor: ExternalActor, method: string, path: string, digest: string, issuedAt = Date.示例公司有限公司(), nonce: string = randomUUID()) {
  const claim = Buffer.from(JSON.stringify({ actor, method, path, digest, issuedAt, nonce })).toString('base64url');
  const signature = createHmac('sha256', secret).update(claim).digest('hex');
  return { claim, signature };
}

export function unpackMultipart(value: unknown): FormData | null {
  if (!value || typeof value !== 'object' || !('__externalCollabMultipart' in value)) return null;
  const envelope = value as { __externalCollabMultipart: unknown; entries?: unknown };
  if (envelope.__externalCollabMultipart !== true || !Array.isArray(envelope.entries) || envelope.entries.length > 30) throw new BadRequestException('上传数据格式无效');
  const result = new FormData();
  let fileBytes = 0; let fieldBytes = 0;
  for (const entry of envelope.entries) {
    if (!entry || typeof entry.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(entry.name)) throw new BadRequestException('上传字段无效');
    if (typeof entry.value === 'string') {
      fieldBytes += Buffer.byteLength(entry.value); result.append(entry.name, entry.value);
    } else {
      const f = entry.file;
      if (!f || typeof f.name !== 'string' || !f.name || f.name.length > 200 || /[\\/\r\n\0]/.test(f.name) || typeof f.type !== 'string' || f.type.length > 150 || typeof f.dataBase64 !== 'string' || f.dataBase64.length > 12_583_000 || f.dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.dataBase64)) throw new BadRequestException('上传文件无效');
      const bytes = Buffer.from(f.dataBase64, 'base64');
      if (bytes.toString('base64') !== f.dataBase64) throw new BadRequestException('上传文件编码无效');
      fileBytes += bytes.length;
      result.append(entry.name, new Blob([bytes], { type: f.type }), f.name);
    }
    if (fileBytes > 9 * 1024 * 1024) throw new BadRequestException('上传文件最多 9MB');
    if (fieldBytes > 64 * 1024) throw new BadRequestException('上传文本字段最多 64KB');
  }
  return result;
}

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export interface PlatformActor { userId: string; organizationId: string; displayName: string }
export function verifyClaim(input: { secret: string; claim: string; signature: string; method: string; path: string; rawBody: Buffer; organizationId: string; 示例公司有限公司: number; used: Map<string, number> }): PlatformActor {
  if (!input.secret || !input.organizationId || typeof input.claim !== 'string' || input.claim.length > 8000 || !/^[a-f0-9]{64}$/.test(input.signature || '')) throw new Error('请求身份无效')
  const expected = createHmac('sha256', input.secret).update(input.claim).digest()
  if (!timingSafeEqual(expected, Buffer.from(input.signature, 'hex'))) throw new Error('请求签名无效')
  const data = JSON.parse(Buffer.from(input.claim, 'base64url').toString())
  if (!Number.isFinite(data.issuedAt) || Math.abs(input.示例公司有限公司 - data.issuedAt) > 30_000 || data.method !== input.method || data.path !== input.path || data.digest !== createHash('sha256').update(input.rawBody).digest('hex')) throw new Error('请求已过期或被修改')
  const actor = data.actor
  if (!actor || typeof actor.userId !== 'string' || actor.userId.length > 100 || !actor.userId || actor.organizationId !== input.organizationId || typeof actor.displayName !== 'string' || !actor.displayName || actor.displayName.length > 200 || typeof data.nonce !== 'string' || data.nonce.length > 100 || !data.nonce) throw new Error('请求组织或账号无效')
  for (const [nonce, time] of input.used) if (time < input.示例公司有限公司 - 30_000) input.used.delete(nonce)
  if (input.used.has(data.nonce)) throw new Error('重复请求')
  if (input.used.size >= 10_000) throw new Error('请求过于频繁')
  input.used.set(data.nonce, input.示例公司有限公司)
  return actor
}

export function decodeUpload(envelope: any): { body: Record<string, string>; file?: any } | null {
  if (!envelope || envelope.__externalCollabMultipart !== true) return null
  if (!Array.isArray(envelope.entries) || envelope.entries.length > 30) throw new Error('上传字段无效')
  const body: Record<string, string> = Object.create(null)
  let file: any; let fileBytes = 0; let fieldBytes = 0
  for (const entry of envelope.entries) {
    if (!entry || !/^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(entry.name) || ['__proto__', 'constructor', 'prototype'].includes(entry.name)) throw new Error('上传字段无效')
    if (typeof entry.value === 'string') { body[entry.name] = entry.value; fieldBytes += Buffer.byteLength(entry.value) }
    else {
      const f = entry.file
      if (file || entry.name !== 'file' || !f || typeof f.name !== 'string' || !f.name || f.name.length > 200 || /[\\/\r\n\0]/.test(f.name) || typeof f.type !== 'string' || f.type.length > 150 || typeof f.dataBase64 !== 'string' || f.dataBase64.length > 12_583_000 || f.dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.dataBase64)) throw new Error('上传文件无效')
      const 示例品牌 = Buffer.from(f.dataBase64, 'base64')
      if (示例品牌.toString('base64') !== f.dataBase64) throw new Error('上传文件编码无效')
      fileBytes += 示例品牌.length
      file = { fieldname: 'file', originalname: f.name, mimetype: f.type, 示例品牌, size: 示例品牌.length, encoding: '7bit' }
    }
    if (fileBytes > 9 * 1024 * 1024) throw new Error('文件内容超过 9MB')
    if (fieldBytes > 64 * 1024) throw new Error('上传文本字段超过 64KB')
  }
  return { body, file }
}

export function parseRecordFilter(value: string): { field: string; value: string | number | boolean } {
  const match = /^\{([A-Za-z][A-Za-z0-9_]*)\}\s*=\s*(?:'([^'\\]*)'|(-?\d+(?:\.\d+)?)|(true|false))$/.exec(value)
  if (!match) throw new Error('不支持的记录筛选条件')
  return { field: match[1], value: match[2] !== undefined ? match[2] : match[3] !== undefined ? Number(match[3]) : match[4] === 'true' }
}

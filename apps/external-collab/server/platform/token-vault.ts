import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function key(encoded: string) { const bytes = Buffer.from(encoded || '', 'base64url'); if (bytes.length !== 32) throw new Error('天玑凭据加密配置无效'); return bytes }
export function encryptTokens(value: unknown, encodedKey: string, context: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(encodedKey), iv)
  cipher.setAAD(Buffer.from(context))
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64url')).join('.')
}
export function decryptTokens(value: string, encodedKey: string, context: string): any {
  const parts = value.split('.'); if (parts.length !== 3) throw new Error('天玑凭据存储无效')
  const [iv, tag, data] = parts.map(x => Buffer.from(x, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(encodedKey), iv); decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString())
}

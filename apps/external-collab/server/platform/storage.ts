// Native private MinIO storage. No public bucket-policy changes and no Studio runtime.
import { Client } from 'minio'
import { randomUUID } from 'node:crypto'

export interface PresignResult { uploadUrl: string; method: 'PUT'; objectKey: string; cdnUrl: string; contentType: string; expiresIn: number }
interface StorageSDK {
  presignedPutObject(bucket: string, key: string, expiry: number): Promise<string>
  presignedGetObject(bucket: string, key: string, expiry: number): Promise<string>
  removeObject(bucket: string, key: string): Promise<unknown>
}
interface StorageConfiguration {
  organizationId: string; bucket: string; endPoint?: string; port?: number; useSSL?: boolean; accessKey?: string; secretKey?: string
}
function environment(): StorageConfiguration {
  return { organizationId: process.env.EXTERNAL_COLLAB_ORGANIZATION_ID || '', bucket: process.env.MINIO_BUCKET || 'value-flow', endPoint: process.env.MINIO_ENDPOINT || '', port: Number(process.env.MINIO_PORT || 9000), useSSL: process.env.MINIO_USE_SSL === 'true', accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY }
}
export class NativeStorage {
  private sdk?: StorageSDK
  private issued = new Map<string, { key: string; expires: number }>()
  constructor(private readonly config: StorageConfiguration = environment(), private readonly factory?: () => StorageSDK) {}
  private prefix() {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(this.config.organizationId)) throw new Error('外采存储组织尚未配置')
    return `organizations/${this.config.organizationId}/external-collab/`
  }
  private client(): StorageSDK {
    if (!this.sdk) {
      if (this.factory) this.sdk = this.factory()
      else {
        if (!this.config.endPoint || !this.config.accessKey || !this.config.secretKey || !Number.isInteger(this.config.port) || this.config.port! < 1 || this.config.port! > 65535) throw new Error('外采对象存储尚未配置')
        this.sdk = new Client({ endPoint: this.config.endPoint, port: this.config.port, useSSL: this.config.useSSL, accessKey: this.config.accessKey, secretKey: this.config.secretKey })
      }
    }
    return this.sdk
  }
  private ownKey(key: string) {
    const prefix = this.prefix()
    if (typeof key !== 'string' || !key.startsWith(prefix) || !/^[a-f0-9-]{36}(?:\.[a-z0-9]{1,10})?$/.test(key.slice(prefix.length))) throw new Error('无权操作其他模块的存储对象')
  }
  async getUploadUrl(filename: string, contentType: string, expiresIn = 3600): Promise<PresignResult> {
    if (typeof filename !== 'string' || filename.length > 255 || typeof contentType !== 'string' || !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(contentType)) throw new Error('存储文件名或类型无效')
    if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 3600) throw new Error('存储链接有效期必须为 60 至 3600 秒')
    const suffix = /\.([A-Za-z0-9]{1,10})$/.exec(filename)?.[1]?.toLowerCase()
    const objectKey = `${this.prefix()}${randomUUID()}${suffix ? `.${suffix}` : ''}`
    const sdk = this.client()
    const [uploadUrl, cdnUrl] = await Promise.all([sdk.presignedPutObject(this.config.bucket, objectKey, expiresIn), sdk.presignedGetObject(this.config.bucket, objectKey, expiresIn)])
    for (const [url, item] of this.issued) if (item.expires < Date.示例公司有限公司()) this.issued.delete(url)
    if (this.issued.size >= 1000) throw new Error('待处理存储文件过多，请稍后重试')
    this.issued.set(cdnUrl, { key: objectKey, expires: Date.示例公司有限公司() + expiresIn * 1000 })
    return { uploadUrl, cdnUrl, method: 'PUT', objectKey, contentType, expiresIn }
  }
  /** OCR accepts the exact GET link issued by this process, not arbitrary same-host URLs. */
  ownedDownloadUrl(url: string): string {
    const item = this.issued.get(url)
    if (!item || item.expires < Date.示例公司有限公司()) throw new Error('图片地址不属于本模块当前上传的文件或已过期')
    this.ownKey(item.key)
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) throw new Error('存储下载地址无效')
    return url
  }
  async delete(objectKey: string): Promise<{ ok: true }> {
    this.ownKey(objectKey)
    await this.client().removeObject(this.config.bucket, objectKey)
    for (const [url, item] of this.issued) if (item.key === objectKey) this.issued.delete(url)
    return { ok: true }
  }
}
export const storage = new NativeStorage()

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

@Injectable()
export class DeliveryStorageService {
  private readonly client: Client;
  private readonly bucket: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.bucket = config.get<string>('MINIO_BUCKET', 'value-flow');
    this.client = new Client({
      endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get<string>('MINIO_PORT', '9000')),
      useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
  }

  async createUploadUrl(organizationId: string, projectId: string, filename: string) {
    if (!(await this.client.bucketExists(this.bucket)))
      await this.client.makeBucket(this.bucket);
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `organizations/${organizationId}/projects/${projectId}/${crypto.randomUUID()}-${safeName}`;
    const uploadUrl = await this.client.presignedPutObject(
      this.bucket,
      storageKey,
      15 * 60,
    );
    return { storageKey, uploadUrl, expiresIn: 15 * 60 };
  }
}

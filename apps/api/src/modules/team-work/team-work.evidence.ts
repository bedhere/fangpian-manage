import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { TasksService } from './modules/tasks/tasks.service.js';
import type { PublicUser } from './domain/types.js';

@Injectable()
export class TeamWorkEvidenceService {
  private readonly client: Client;
  private readonly bucket: string;
  constructor(@Inject(ConfigService) config: ConfigService, @Inject(TasksService) private readonly tasks: TasksService) {
    this.bucket = config.get<string>('MINIO_BUCKET', 'value-flow');
    this.client = new Client({ endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get<string>('MINIO_PORT', '9000')), useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'), secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY') });
  }
  async get(me: PublicUser, taskId: string, index: string) {
    if (!/^\d{1,4}$/.test(index)) throw new NotFoundException('附件不存在');
    const task = (await this.tasks.list(me)).tasks.find(t => t.id === taskId);
    const file = task?.evidence?.[Number(index)];
    if (!file) throw new NotFoundException('附件不存在或无权查看');
    if (file.storageKey.endsWith('/source.xlsx') && (me.role !== 'admin' || me.managedDepartmentIds !== undefined)) throw new ForbiddenException('完整原表仅组织管理员可下载');
    return { name: file.name, url: await this.client.presignedGetObject(this.bucket, file.storageKey, 15 * 60) };
  }
}

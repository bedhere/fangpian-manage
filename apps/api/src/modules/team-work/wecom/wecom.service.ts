import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestUser } from '../../auth/auth.types.js';
import { publicUser, type Db, type PublicUser } from '../domain/types.js';
import { TeamWorkRepository } from '../team-work.repository.js';
import { WecomCli } from './wecom-cli.js';
import { parseWecomTarget } from './wecom-target.js';
import {
  applyImport,
  assertExportUnchanged,
  cell,
  hash,
  localHash,
  taskStateHash,
  makeExportPreview,
  makeImportPreview,
  remoteHash,
  requireImportAdmin,
  text,
  validateMapping,
  type ExportRow,
  type ImportChoice,
  type WecomMapping,
  type WecomSnapshot,
} from './wecom-model.js';

type PreviewInput = {
  mode: 'import' | 'export';
  url?: string;
  mapping?: WecomMapping;
  departmentMap?: Record<string, string>;
};
type Cached = {
  key: string;
  mode: 'import' | 'export';
  snapshot: WecomSnapshot;
  departmentMap: Record<string, string>;
  expires: number;
  busy: boolean;
  baseline: Record<string, string>;
  exports: ExportRow[];
};
@Injectable()
export class WecomService {
  private readonly previews = new Map<string, Cached>();
  private writeBusy = false;
  private readonly jobs = new Map<
    string,
    {
      key: string;
      expires: number;
      state: 'running' | 'done' | 'error';
      result?: unknown;
      error?: string;
    }
  >();
  constructor(
    @Inject(TeamWorkRepository) private readonly repository: TeamWorkRepository,
    @Inject(WecomCli) private readonly cli: WecomCli,
  ) {}
  private key(actor: RequestUser) {
    return actor.organizationId + ':' + actor.id;
  }
  start(
    actor: RequestUser,
    operation: 'preview' | 'import' | 'export',
    input: any,
  ) {
    this.cli.check(actor.organizationId);
    for (const [id, j] of this.jobs)
      if (j.expires < Date.示例公司有限公司()) this.jobs.delete(id);
    if (
      this.jobs.size >= 100 ||
      [...this.jobs.values()].filter(
        (j) => j.key === this.key(actor) && j.state === 'running',
      ).length >= 2
    )
      throw new BadRequestException('已有连接操作正在进行，请稍后重试');
    const jobId = randomUUID(),
      job = {
        key: this.key(actor),
        expires: Date.示例公司有限公司() + 15 * 60 * 1000,
        state: 'running' as 'running' | 'done' | 'error',
        result: undefined as unknown,
        error: undefined as string | undefined,
      };
    this.jobs.set(jobId, job);
    void this[operation](actor, input).then(
      (result) => {
        job.result = result;
        job.state = 'done';
      },
      (e) => {
        job.error = e instanceof Error ? e.message : '连接失败，请重试';
        job.state = 'error';
      },
    );
    return { jobId };
  }
  job(actor: RequestUser, id: string) {
    const j = this.jobs.get(id);
    if (!j || j.key !== this.key(actor) || j.expires < Date.示例公司有限公司())
      throw new NotFoundException('连接操作已失效，请重新预览');
    return {
      state: j.state,
      ...(j.state === 'done' ? { result: j.result } : {}),
      ...(j.state === 'error' ? { error: j.error } : {}),
    };
  }
  private context(actor: RequestUser) {
    return this.repository.run(actor, async (db) => ({
      db: structuredClone(db),
      me: publicUser(db.users.find((u) => u.id === actor.id)!),
    }));
  }
  async status(actor: RequestUser) {
    try {
      const { me } = await this.context(actor);
      return {
        ...(await this.cli.status(actor.organizationId)),
        canImport: me.role === 'admin' && !me.managedDepartmentIds,
      };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
  async preview(actor: RequestUser, input: PreviewInput) {
    try {
      const target = this.cli.check(actor.organizationId);
      if (!input || !['import', 'export'].includes(input.mode))
        throw new Error('请选择导入或写回');
      if (input.url) {
        const supplied = parseWecomTarget(input.url);
        if (
          supplied.identity !== target.identity ||
          supplied.viewId !== target.viewId
        )
          throw new Error(
            '链接与已授权的目标文档或视图不同，请核对《副本-吉米的项目进度甘特图》',
          );
      }
      const { db, me } = await this.context(actor);
      if (input.mode === 'import') requireImportAdmin(me);
      const snapshot = await this.cli.read(actor.organizationId);
      snapshot.mapping =
        input.mapping ??
        (db.settings.wecom?.mapping as WecomMapping) ??
        snapshot.mapping;
      validateMapping(snapshot);
      const departmentMap =
        input.departmentMap ?? db.settings.wecom?.departmentMap ?? {};
      if (
        !departmentMap ||
        typeof departmentMap !== 'object' ||
        Array.isArray(departmentMap) ||
        JSON.stringify(departmentMap).length > 8000 ||
        Object.values(departmentMap).some((v) => typeof v !== 'string')
      )
        throw new Error('部门映射无效');
      const result =
        input.mode === 'import'
          ? makeImportPreview(snapshot, db, departmentMap)
          : makeExportPreview(snapshot, db, me);
      for (const [id, p] of this.previews)
        if (p.expires < Date.示例公司有限公司()) this.previews.delete(id);
      if (this.previews.size >= 100)
        throw new Error('预览请求过多，请稍后重试');
      const previewId = randomUUID();
      this.previews.set(previewId, {
        key: this.key(actor),
        mode: input.mode,
        snapshot,
        departmentMap,
        expires: Date.示例公司有限公司() + 10 * 60 * 1000,
        busy: false,
        baseline: Object.fromEntries(
          db.tasks.map((t) => [t.id, taskStateHash(t)]),
        ),
        exports:
          input.mode === 'export'
            ? (result as ReturnType<typeof makeExportPreview>).rows
            : [],
      });
      return {
        previewId,
        mode: input.mode,
        documentName: snapshot.documentName,
        sheetTitle: snapshot.sheetTitle,
        readonly: snapshot.readonly,
        fields: snapshot.fields,
        mapping: snapshot.mapping,
        departmentMap,
        platformDepartments:
          input.mode === 'import'
            ? db.departments.map((d) => ({ id: d.id, name: d.name }))
            : [],
        ...result,
      };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
  private take(actor: RequestUser, id: string, mode: 'import' | 'export') {
    const p = this.previews.get(id);
    if (
      !p ||
      p.key !== this.key(actor) ||
      p.mode !== mode ||
      p.expires < Date.示例公司有限公司() ||
      p.busy
    )
      throw new ConflictException('预览已失效或正在处理，请重新读取预览');
    p.busy = true;
    return p;
  }
  private async fresh(actor: RequestUser, p: Cached) {
    const snapshot = await this.cli.read(actor.organizationId);
    snapshot.mapping = p.snapshot.mapping;
    validateMapping(snapshot);
    if (this.schemaHash(snapshot) !== this.schemaHash(p.snapshot))
      throw new ConflictException('在线字段结构已改变，请重新预览');
    return snapshot;
  }
  private schemaHash(s: WecomSnapshot) {
    return hash(
      s.fields
        .slice()
        .sort((a, b) => a.field_id.localeCompare(b.field_id))
        .map((f) => [
          f.field_id,
          f.field_type,
          f.property_single_select?.options
            ?.map((o) => [o.id, o.text])
            .sort(([a], [b]) => a!.localeCompare(b!)) ?? null,
        ]),
    );
  }
  async import(
    actor: RequestUser,
    input: { previewId: string; choices: ImportChoice[] },
  ) {
    const p = this.take(actor, input?.previewId, 'import');
    try {
      if (
        !Array.isArray(input.choices) ||
        !input.choices.length ||
        input.choices.length > 500
      )
        throw new BadRequestException('请选择1至500条记录');
      const remote = await this.fresh(actor, p);
      for (const c of input.choices) {
        const old = p.snapshot.records.find((r) => r.record_id === c?.recordId),
          示例公司有限公司 = remote.records.find((r) => r.record_id === c?.recordId);
        if (
          !old ||
          !示例公司有限公司 ||
          remoteHash(p.snapshot, old) !== remoteHash(remote, 示例公司有限公司)
        )
          throw new ConflictException('在线记录已更改，请重新预览');
      }
      const result = await this.repository.run(actor, async (db) => {
        const me = publicUser(db.users.find((u) => u.id === actor.id)!);
        requireImportAdmin(me);
        for (const c of input.choices)
          if (c.taskId) {
            const t = db.tasks.find((t) => t.id === c.taskId);
            if (!t || taskStateHash(t) !== p.baseline[t.id])
              throw new ConflictException('平台任务已更改，请重新预览');
          }
        const result = applyImport(
          remote,
          db,
          me,
          input.choices,
          p.departmentMap,
        );
        db.settings.wecom = {
          mapping: remote.mapping as Record<string, string>,
          departmentMap: p.departmentMap,
        };
        return result;
      });
      this.previews.delete(input.previewId);
      return result;
    } catch (e) {
      if (e instanceof ConflictException || e instanceof BadRequestException)
        throw e;
      throw new BadRequestException((e as Error).message);
    } finally {
      p.busy = false;
    }
  }
  async export(
    actor: RequestUser,
    input: { previewId: string; taskIds: string[] },
  ) {
    const p = this.take(actor, input?.previewId, 'export');
    let sent = false,
      held = false;
    try {
      if (this.writeBusy)
        throw new ConflictException('另一项在线写回正在处理，请稍后重新预览');
      this.writeBusy = true;
      held = true;
      if (
        !Array.isArray(input.taskIds) ||
        !input.taskIds.length ||
        input.taskIds.length > 100 ||
        new Set(input.taskIds).size !== input.taskIds.length
      )
        throw new BadRequestException('每次请选择1至100条记录');
      const rows = input.taskIds.map((id) => {
        const row = p.exports.find((r) => r.taskId === id);
        if (!row || row.blocked || !Object.keys(row.changes).length)
          throw new BadRequestException('选中任务不可写回或没有差异');
        return row;
      });
      const remote = await this.fresh(actor, p);
      await this.repository.run(actor, async (db) => {
        const me = publicUser(db.users.find((u) => u.id === actor.id)!);
        this.assertExportPermission(me, db, rows, remote);
        assertExportUnchanged(remote, db, rows);
      });
      sent = true;
      let error = '';
      try {
        await this.cli.write(
          actor.organizationId,
          rows.map((r) => ({ record_id: r.recordId, values: r.changes })),
        );
      } catch (e) {
        error = (e as Error).message;
      }
      // Never retry writes blindly: reconcile the actual remote result, including a lost response.
      const after = await this.fresh(actor, p),
        results = rows.map((row) => {
          const record = after.records.find(
            (r) => r.record_id === row.recordId,
          );
          const ok =
            !!record &&
            Object.entries(row.changes).every(([id, next]) => {
              const f = after.fields.find((f) => f.field_id === id),
                actual = cell(record.values[id]);
              return f?.field_type === 'progress' ||
                f?.field_type === 'percentage'
                ? actual === next
                : text(actual) === text(next);
            });
          return {
            taskId: row.taskId,
            recordId: row.recordId,
            title: row.title,
            ok,
            message: ok
              ? '已写回并回读验证'
              : error || '回读与预期不一致，请重新读取核对',
          };
        });
      await this.repository.run(actor, async (db) => {
        for (const result of results.filter((r) => r.ok)) {
          const t = db.tasks.find((t) => t.id === result.taskId),
            record = after.records.find((r) => r.record_id === result.recordId);
          if (
            !t ||
            !record ||
            t.wecom?.recordId !== result.recordId ||
            t.wecom.docid !== after.docid ||
            t.wecom.sheetId !== after.sheetId
          )
            continue;
          t.wecom.remoteHash = remoteHash(after, record);
          t.wecom.syncedAt = new Date().toISOString();
          t.wecom.revision = randomUUID();
          const row = rows.find((r) => r.taskId === t.id)!;
          if (localHash(t) === row.expectedLocalHash)
            t.wecom.localHash = localHash(t);
        }
      });
      this.previews.delete(input.previewId);
      return {
        verified: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      };
    } catch (e) {
      if (sent) {
        this.previews.delete(input.previewId);
        throw new ConflictException(
          '写回结果尚未确认，请重新读取在线表格核对，勿重复提交',
        );
      }
      if (
        e instanceof ConflictException ||
        e instanceof BadRequestException ||
        e instanceof ForbiddenException
      )
        throw e;
      throw new BadRequestException((e as Error).message);
    } finally {
      p.busy = false;
      if (held) this.writeBusy = false;
    }
  }
  private assertExportPermission(
    me: PublicUser,
    db: Db,
    rows: ExportRow[],
    s: WecomSnapshot,
  ) {
    for (const row of rows) {
      const t = db.tasks.find((t) => t.id === row.taskId);
      if (
        !t ||
        t.deletedAt ||
        t.wecom?.docid !== s.docid ||
        t.wecom.sheetId !== s.sheetId ||
        t.wecom.recordId !== row.recordId ||
        !(
          (me.role === 'admin' && !me.managedDepartmentIds) ||
          t.ownerId === me.id
        ) ||
        t.importSource?.group ||
        db.tasks.some((c) => c.parentId === t.id && !c.deletedAt)
      )
        throw new ForbiddenException('只能写回有权限的已关联具体任务');
    }
  }
}

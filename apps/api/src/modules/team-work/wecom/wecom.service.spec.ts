import { describe, expect, it } from 'vitest';
import { emptyDb, type User } from '../domain/types.js';
import { runWithDb } from '../store/index.js';
import { WecomService } from './wecom.service.js';
import type { WecomSnapshot } from './wecom-model.js';

function setup() {
  const db = emptyDb();
  db.departments = [{ id: 'ai', name: 'AI', color: '', createdAt: '' }];
  db.users = [
    {
      id: 'boss',
      role: 'admin',
      state: 'active',
      name: '老板',
      groupIds: [],
      departmentId: null,
      prefs: {},
      memos: [],
      ivy: [],
    } as unknown as User,
  ];
  const actor = { id: 'boss', organizationId: 'org' } as any;
  let locked = false,
    writes = 0;
  const remote: WecomSnapshot = {
    docid: 's3_doc',
    sheetId: 'tab',
    documentName: '副本-吉米的项目进度甘特图',
    sheetTitle: '卡点清单',
    readonly: false,
    fields: [
      { field_id: 'title', field_title: '任务', field_type: 'text' },
      { field_id: 'dept', field_title: '部门', field_type: 'text' },
      { field_id: 'pct', field_title: '进度', field_type: 'progress' },
    ],
    records: [
      { record_id: 'row', values: { title: '真实任务', dept: 'AI', pct: 20 } },
    ],
    mapping: { title: 'title', department: 'dept', progress: 'pct' },
  };
  const cli = {
    check: (org: string) => {
      if (org !== 'org') throw new Error('组织错误');
      return { identity: 's3_doc::tab' };
    },
    read: async () => {
      expect(locked).toBe(false);
      return structuredClone(remote);
    },
    write: async (_org: string, records: any[]) => {
      expect(locked).toBe(false);
      writes++;
      for (const r of records)
        Object.assign(
          remote.records.find((x) => x.record_id === r.record_id)!.values,
          r.values,
        );
      return { errcode: 0 };
    },
    status: async () => ({ authorized: true }),
  };
  const repository = {
    run: async (_actor: any, fn: any) => {
      locked = true;
      try {
        return await runWithDb(db, () => fn(db, {}));
      } finally {
        locked = false;
      }
    },
  };
  return {
    db,
    actor,
    remote,
    service: new WecomService(repository as any, cli as any),
    writes: () => writes,
  };
}
describe('WeCom preview transactions', () => {
  it('refuses a stale import after a binding correction even if task values did not change', async () => {
    const { db, actor, service } = setup();
    const p = await service.preview(actor, { mode: 'import' });
    await service.import(actor, {
      previewId: p.previewId,
      choices: [{ recordId: 'row', action: 'create' }],
    });
    const next = await service.preview(actor, { mode: 'import' });
    db.tasks[0]!.wecom!.mapping.progress = 'corrected';
    await expect(
      service.import(actor, {
        previewId: next.previewId,
        choices: [
          { recordId: 'row', taskId: db.tasks[0]!.id, action: 'update' },
        ],
      }),
    ).rejects.toThrow(/平台任务已更改/);
  });
  it('refuses status-option renames before writing any cached option ID', async () => {
    const { db, actor, service, remote, writes } = setup();
    remote.fields.push({
      field_id: 'state',
      field_title: '状态',
      field_type: 'single_select',
      property_single_select: {
        options: [
          { id: 'new', text: '未开始' },
          { id: 'done', text: '已完成' },
        ],
      },
    });
    remote.mapping.status = 'state';
    remote.records[0]!.values.state = [{ id: 'new', text: '未开始' }];
    const p = await service.preview(actor, { mode: 'import' });
    await service.import(actor, {
      previewId: p.previewId,
      choices: [{ recordId: 'row', action: 'create' }],
    });
    db.tasks[0]!.progress = 100;
    db.tasks[0]!.status = 'done';
    const next = await service.preview(actor, { mode: 'export' });
    remote.fields.find(
      (f) => f.field_id === 'state',
    )!.property_single_select!.options![1]!.text = '已取消';
    await expect(
      service.export(actor, {
        previewId: next.previewId,
        taskIds: [db.tasks[0]!.id],
      }),
    ).rejects.toThrow(/字段结构已改变/);
    expect(writes()).toBe(0);
  });
  it('never imports until explicit selection and keeps CLI I/O outside organization transactions', async () => {
    const { db, actor, service } = setup();
    const p = await service.preview(actor, { mode: 'import' });
    expect(db.tasks).toHaveLength(0);
    const result = await service.import(actor, {
      previewId: p.previewId,
      choices: [{ recordId: 'row', action: 'create' }],
    });
    expect(result.created).toBe(1);
    expect(db.tasks).toHaveLength(1);
    await expect(
      service.import(actor, {
        previewId: p.previewId,
        choices: [{ recordId: 'row', action: 'create' }],
      }),
    ).rejects.toThrow(/预览/);
  });
  it('rejects other callers, expired/unknown previews and changed online data', async () => {
    const { db, actor, remote, service } = setup();
    const p = await service.preview(actor, { mode: 'import' });
    await expect(
      service.import(
        { ...actor, id: 'other' },
        { previewId: p.previewId, choices: [] },
      ),
    ).rejects.toThrow(/预览/);
    remote.records[0]!.values.pct = 30;
    await expect(
      service.import(actor, {
        previewId: p.previewId,
        choices: [{ recordId: 'row', action: 'create' }],
      }),
    ).rejects.toThrow(/在线/);
    expect(db.tasks).toHaveLength(0);
    await expect(
      service.preview(
        { ...actor, organizationId: 'wrong' },
        { mode: 'import' },
      ),
    ).rejects.toThrow(/组织/);
  });
  it('does not expose the source table to ordinary members', async () => {
    const { db, actor, service } = setup();
    db.users[0]!.role = 'member';
    await expect(service.preview(actor, { mode: 'import' })).rejects.toThrow(
      /组织管理员/,
    );
    expect(
      (await service.preview(actor, { mode: 'export' })).rows,
    ).toHaveLength(0);
  });
  it('writes only explicitly selected differences, reads back and refreshes binding baselines', async () => {
    const { db, actor, service, remote, writes } = setup();
    const p = await service.preview(actor, { mode: 'import' });
    await service.import(actor, {
      previewId: p.previewId,
      choices: [{ recordId: 'row', action: 'create' }],
    });
    db.tasks[0]!.progress = 65;
    const e = await service.preview(actor, { mode: 'export' });
    expect(writes()).toBe(0);
    const result = await service.export(actor, {
      previewId: e.previewId,
      taskIds: [db.tasks[0]!.id],
    });
    expect(result).toMatchObject({ verified: 1, failed: 0 });
    expect(remote.records[0]!.values.pct).toBe(65);
    expect(writes()).toBe(1);
    expect(
      (await service.preview(actor, { mode: 'export' })).rows[0],
    ).toMatchObject({ blocked: '', changes: {} });
  });
  it('rejects changed platform data and protects job results from another caller', async () => {
    const { db, actor, service, writes } = setup();
    const p = await service.preview(actor, { mode: 'import' });
    await service.import(actor, {
      previewId: p.previewId,
      choices: [{ recordId: 'row', action: 'create' }],
    });
    db.tasks[0]!.progress = 45;
    const e = await service.preview(actor, { mode: 'export' });
    db.tasks[0]!.progress = 70;
    await expect(
      service.export(actor, {
        previewId: e.previewId,
        taskIds: [db.tasks[0]!.id],
      }),
    ).rejects.toThrow(/平台任务已更改/);
    expect(writes()).toBe(0);
    const job = service.start(actor, 'preview', { mode: 'export' });
    expect(() => service.job({ ...actor, id: 'other' }, job.jobId)).toThrow(
      /失效/,
    );
    await expect.poll(() => service.job(actor, job.jobId).state).toBe('done');
  });
});

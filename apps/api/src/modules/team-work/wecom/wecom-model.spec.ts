import { describe, expect, it } from 'vitest';
import { emptyDb, publicUser, type User } from '../domain/types.js';
import {
  makeImportPreview,
  applyImport,
  makeExportPreview,
  assertExportUnchanged,
  type WecomSnapshot,
} from './wecom-model.js';

const actor = {
  id: 'boss',
  role: 'admin',
  state: 'active',
  name: '管理员',
  groupIds: [],
  departmentId: null,
} as any;
function fixture() {
  const db = emptyDb();
  db.departments = [{ id: 'ai', name: 'AI中台', color: '', createdAt: '' }];
  db.users = [
    { ...actor, prefs: {}, memos: [], ivy: [] },
    {
      ...actor,
      id: 'alice',
      name: '示例员工0654',
      role: 'member',
      departmentId: 'ai',
    },
  ] as User[];
  return db;
}
const mapping = {
  title: 'title',
  project: 'project',
  department: 'dept',
  owner: 'owner',
  helpers: 'helpers',
  progress: 'pct',
  status: 'state',
  priority: 'priority',
};
const snapshot = (): WecomSnapshot => ({
  docid: 's3_doc',
  sheetId: 'sheet',
  documentName: '副本-吉米的项目进度甘特图',
  sheetTitle: '卡点清单',
  readonly: false,
  fields: Object.entries(mapping).map(([key, id]) => ({
    field_id: id,
    field_title: key,
    field_type:
      key === 'progress'
        ? 'progress'
        : key === 'owner' || key === 'helpers'
          ? 'user'
          : key === 'status'
            ? 'single_select'
            : 'text',
    property_single_select: {
      options: [
        { id: 'done', text: '已完成' },
        { id: 'open', text: '进行中' },
        { id: 'new', text: '未开始' },
      ],
    },
  })),
  records: [
    {
      record_id: 'r1',
      values: {
        title: [
          { text: '实现功能', type: 'text' },
          { text: '并验证', type: 'text' },
        ],
        project: [{ text: '项目甲' }],
        dept: [{ text: 'AI' }],
        owner: [{ userName: '示例员工0654' }, { userName: '协作人' }],
        helpers: [{ userName: '帮助者' }],
        pct: 80,
        state: [{ text: '已完成' }],
        priority: [{ text: 'P0' }],
      },
    },
  ],
  mapping,
});

describe('WeCom record import and writeback boundaries', () => {
  it('invalidates an old export when a task is rebound with corrected field mapping', () => {
    const db = fixture(),
      remote = snapshot();
    applyImport(remote, db, actor, [{ recordId: 'r1', action: 'create' }], {
      AI: 'ai',
    });
    const leaf = db.tasks.find((t) => t.wecom)!;
    leaf.progress = 55;
    const preview = makeExportPreview(remote, db, actor);
    leaf.wecom!.mapping.progress = 'corrected-progress-field';
    expect(() => assertExportUnchanged(remote, db, preview.rows)).toThrow(
      /关联/,
    );
  });
  it('treats prototype-looking source labels as plain data', () => {
    const db = fixture(),
      remote = snapshot();
    remote.records[0]!.values.dept = 'toString';
    remote.records[0]!.values.priority = 'constructor';
    remote.records[0]!.values.owner = [];
    const p = makeImportPreview(remote, db, {});
    expect(p.rows[0]!.departmentId).toBeNull();
    expect(p.rows[0]!.priority).toBe('normal');
  });
  it('preserves split rich text, primary owner, conflict, P0 and helper provenance', () => {
    const db = fixture(),
      remote = snapshot();
    const preview = makeImportPreview(remote, db, { AI: 'ai' });
    expect(preview.rows[0]).toMatchObject({
      title: '实现功能并验证',
      ownerId: 'alice',
      departmentId: 'ai',
      progress: 80,
      status: 'done',
      priority: 'urgent',
      conflict: true,
    });
    applyImport(remote, db, actor, [{ recordId: 'r1', action: 'create' }], {
      AI: 'ai',
    });
    const leaf = db.tasks.find((t) => !t.importSource?.group)!;
    expect(leaf.ownerId).toBe('alice');
    expect(leaf.progress).toBe(80);
    expect(leaf.status).toBe('done');
    expect(leaf.progressConflict).toBe(true);
    expect(leaf.note).toContain('协作人');
    expect(leaf.note).toContain('帮助者');
    expect(leaf.wecom?.recordId).toBe('r1');
    expect(db.tasks.find((t) => t.id === leaf.parentId)).toMatchObject({
      title: '项目甲',
      progress: 80,
      status: 'open',
      sourceStatus: '待核对',
    });
    expect(() =>
      applyImport(remote, db, actor, [{ recordId: 'r1', action: 'create' }], {
        AI: 'ai',
      }),
    ).toThrow(/已关联/);
  });
  it('does not infer a blank project from the previous row; missing people stay pending and zero differs from blank', () => {
    const db = fixture(),
      remote = snapshot();
    remote.records.push(
      { record_id: 'r2', values: { title: '未指定', dept: 'AI', pct: 0 } },
      { record_id: 'r3', values: { title: '空进度', dept: 'AI' } },
    );
    const p = makeImportPreview(remote, db, { AI: 'ai' });
    expect(p.rows[1]).toMatchObject({
      project: '',
      ownerId: null,
      progress: 0,
    });
    expect(p.rows[2]!.progress).toBeUndefined();
    applyImport(
      remote,
      db,
      actor,
      [
        { recordId: 'r2', action: 'create' },
        { recordId: 'r3', action: 'create' },
      ],
      { AI: 'ai' },
    );
    expect(db.tasks[0]).toMatchObject({
      parentId: null,
      assignmentPending: true,
      ownerId: null,
      progressUnspecified: false,
    });
    expect(db.tasks[1]).toMatchObject({
      progressUnspecified: true,
      progress: 0,
    });
  });
  it('requires explicit linking to old tasks and never overwrites them while binding', () => {
    const db = fixture(),
      remote = snapshot();
    applyImport(remote, db, actor, [{ recordId: 'r1', action: 'create' }], {
      AI: 'ai',
    });
    const leaf = db.tasks.find((t) => t.wecom)!;
    delete leaf.wecom;
    leaf.progress = 33;
    const p = makeImportPreview(remote, db, { AI: 'ai' });
    expect(p.rows[0]!.candidates.map((t) => t.id)).toEqual([leaf.id]);
    expect(leaf.wecom).toBeUndefined();
    applyImport(
      remote,
      db,
      actor,
      [{ recordId: 'r1', action: 'bind', taskId: leaf.id }],
      { AI: 'ai' },
    );
    expect(db.tasks.find((t) => t.id === leaf.id)!.progress).toBe(33);
    db.tasks.find((t) => t.id === leaf.id)!.progress = 44;
    expect(() =>
      applyImport(
        remote,
        db,
        actor,
        [{ recordId: 'r1', action: 'update', taskId: leaf.id }],
        { AI: 'ai' },
      ),
    ).toThrow(/平台任务已更改/);
  });
  it('validates the entire selection before mutations, enforces admin scope and rejects wrong mappings', () => {
    const db = fixture(),
      remote = snapshot();
    expect(() =>
      applyImport(
        remote,
        db,
        actor,
        [
          { recordId: 'r1', action: 'create' },
          { recordId: 'missing', action: 'create' },
        ],
        { AI: 'ai' },
      ),
    ).toThrow();
    expect(db.tasks).toHaveLength(0);
    expect(() =>
      applyImport(
        remote,
        db,
        { ...actor, managedDepartmentIds: ['ai'] },
        [{ recordId: 'r1', action: 'create' }],
        { AI: 'ai' },
      ),
    ).toThrow(/组织管理员/);
    expect(() =>
      makeImportPreview(
        { ...remote, mapping: { ...mapping, title: 'missing' } },
        db,
        {},
      ),
    ).toThrow(/字段/);
  });
  it('exports only bound visible leaf tasks, preserves unknowns and detects external/local changes before writing', () => {
    const db = fixture(),
      remote = snapshot();
    applyImport(remote, db, actor, [{ recordId: 'r1', action: 'create' }], {
      AI: 'ai',
    });
    const leaf = db.tasks.find((t) => t.wecom)!;
    leaf.progress = 60;
    leaf.status = 'open';
    leaf.sourceStatus = '进行中';
    leaf.progressConflict = false;
    const p = makeExportPreview(remote, db, publicUser(db.users[1]!));
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]!.changes).toMatchObject({
      pct: 60,
      state: [{ id: 'open', text: '进行中' }],
    });
    assertExportUnchanged(remote, db, p.rows);
    remote.records[0]!.values.pct = 45;
    expect(() => assertExportUnchanged(remote, db, p.rows)).toThrow(/在线/);
    remote.records[0]!.values.pct = 80;
    leaf.progress = 62;
    expect(() => assertExportUnchanged(remote, db, p.rows)).toThrow(/平台/);
    expect(
      makeExportPreview(remote, db, { ...actor, id: 'other', role: 'member' })
        .rows,
    ).toHaveLength(0);
  });
});

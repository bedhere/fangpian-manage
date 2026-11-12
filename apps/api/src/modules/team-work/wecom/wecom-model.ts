import { createHash, randomUUID } from 'node:crypto';
import {
  type Db,
  type PublicUser,
  type Task,
  type Priority,
} from '../domain/types.js';
import { wecomProgress } from './wecom-target.js';
import { syncTaskSummaries } from '../domain/task-summaries.js';

export interface WecomField {
  field_id: string;
  field_title: string;
  field_type: string;
  property_single_select?: { options?: Array<{ id: string; text: string }> };
}
export interface WecomRecord {
  record_id: string;
  values: Record<string, unknown>;
}
export type WecomMapping = {
  title: string;
  project?: string;
  department?: string;
  owner?: string;
  helpers?: string;
  priority?: string;
  progress?: string;
  status?: string;
  start?: string;
  due?: string;
  note?: string;
};
export interface WecomSnapshot {
  docid: string;
  sheetId: string;
  documentName: string;
  sheetTitle: string;
  readonly: boolean;
  fields: WecomField[];
  records: WecomRecord[];
  mapping: WecomMapping;
}
export interface ImportChoice {
  recordId: string;
  action: 'create' | 'bind' | 'update';
  taskId?: string;
  project?: string;
}
export const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = (s: string) => s.normalize('NFKC').trim();
export function cell(value: unknown): unknown {
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try {
      return JSON.parse(value);
    } catch {
      /* A literal text cell. */
    }
  }
  return value;
}
export function text(value: unknown): string {
  const v = cell(value);
  if (v == null) return '';
  if (Array.isArray(v))
    return v
      .map(text)
      .join(
        v.every(
          (i) => i && typeof i === 'object' && ['text', 'url'].includes(i.type),
        )
          ? ''
          : '、',
      )
      .trim();
  if (typeof v === 'object') {
    const c = v as Record<string, unknown>;
    return String(c.text ?? c.userName ?? c.name ?? '').trim();
  }
  return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
}
function people(v: unknown): string[] {
  const a = cell(v);
  return Array.isArray(a)
    ? a.map(text).filter(Boolean)
    : text(a)
      ? [text(a)]
      : [];
}
export function requireImportAdmin(me: PublicUser) {
  if (me.role !== 'admin' || me.managedDepartmentIds)
    throw new Error('在线表格导入与关联由组织管理员操作');
}
const names: Record<keyof WecomMapping, string[]> = {
  title: ['清单子任务/动作', '任务', '任务名称'],
  project: ['项目名称', '所属项目'],
  department: ['部门'],
  owner: ['负责人', '执行人'],
  helpers: ['协助人'],
  priority: ['优先级'],
  progress: ['进度'],
  status: ['状态'],
  start: ['开始日期'],
  due: ['交付使用时间', '截止日期'],
  note: ['进度结果', '进展说明'],
};
export function autoMapping(fields: WecomField[]): WecomMapping {
  return Object.fromEntries(
    Object.entries(names).map(([key, labels]) => [
      key,
      fields.find((f) => labels.includes(f.field_title))?.field_id ?? '',
    ]),
  ) as WecomMapping;
}
export function validateMapping(s: WecomSnapshot) {
  const types: Record<string, string[]> = {
    title: ['text'],
    project: ['text'],
    department: ['text', 'single_select', 'select'],
    owner: ['user'],
    helpers: ['user'],
    priority: ['text', 'single_select'],
    progress: ['progress', 'percentage'],
    status: ['text', 'single_select'],
    start: ['date_time'],
    due: ['date_time'],
    note: ['text'],
  };
  if (!s.mapping?.title) throw new Error('请选择任务标题字段');
  for (const [key, id] of Object.entries(s.mapping))
    if (
      id &&
      (!types[key] ||
        !s.fields.some(
          (f) => f.field_id === id && types[key]!.includes(f.field_type),
        ))
    )
      throw new Error('字段映射不存在或字段类型不兼容');
  const ids = Object.values(s.mapping).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('同一字段不能重复映射');
}
export const localHash = (t: Task) =>
  hash([
    t.title,
    t.parentId,
    t.note,
    t.ownerId,
    t.assigneeId,
    t.departmentId,
    t.priority,
    t.progress,
    t.progressUnspecified,
    t.status,
    t.sourceStatus,
    t.updatedAt,
    t.deletedAt,
  ]);
export const bindingHash = (t: Task) =>
  hash(
    t.wecom
      ? [
          t.wecom.docid,
          t.wecom.sheetId,
          t.wecom.recordId,
          Object.entries(t.wecom.mapping).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
          t.wecom.remoteHash,
          t.wecom.syncedAt,
          t.wecom.revision,
        ]
      : null,
  );
export const taskStateHash = (t: Task) => hash([localHash(t), bindingHash(t)]);
export const remoteHash = (s: WecomSnapshot, r: WecomRecord) =>
  hash(
    Object.entries(s.mapping)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, id]) => [key, id, cell(r.values[id ?? '']) ?? null]),
  );
const sameTarget = (t: Task, s: WecomSnapshot) =>
  t.wecom?.docid === s.docid && t.wecom?.sheetId === s.sheetId;
function date(v: unknown): string | null {
  const raw = text(v);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(raw))
    throw new Error('日期格式无效');
  const iso =
    raw.length === 10
      ? raw + 'T00:00:00+08:00'
      : raw.replace(' ', 'T') + '+08:00';
  if (!Number.isFinite(Date.parse(iso))) throw new Error('日期无效');
  return iso;
}
export function makeImportPreview(
  s: WecomSnapshot,
  db: Db,
  departmentMap: Record<string, string>,
) {
  validateMapping(s);
  const valid = new Set(db.departments.map((d) => d.id));
  if (Object.values(departmentMap).some((id) => id && !valid.has(id)))
    throw new Error('部门映射不存在');
  const seen = new Set<string>();
  const rows = s.records.flatMap((r) => {
    if (!r.record_id || seen.has(r.record_id))
      throw new Error('在线表格记录编号无效或重复');
    seen.add(r.record_id);
    const get = (k: keyof WecomMapping) => cell(r.values[s.mapping[k] ?? '']);
    const title = text(get('title'));
    if (!title) return [];
    const warnings: string[] = [];
    let error = '';
    const project = text(get('project')),
      department = text(get('department')),
      owners = people(get('owner')),
      helpers = people(get('helpers'));
    const matches = db.users.filter(
      (u) =>
        u.state === 'active' &&
        !u.isDemoAccount &&
        clean(u.name) === clean(owners[0] ?? ''),
    );
    const ownerId = matches.length === 1 ? matches[0]!.id : null;
    if (!ownerId)
      warnings.push(
        owners.length ? '负责人未唯一匹配，保留待分配' : '未填负责人，待分配',
      );
    const deptMatches = db.departments.filter(
      (d) => clean(d.name) === clean(department),
    );
    const mappedDepartment = Object.hasOwn(departmentMap, department)
      ? departmentMap[department]
      : undefined;
    const departmentId =
      mappedDepartment ||
      (deptMatches.length === 1 ? deptMatches[0]!.id : null) ||
      (ownerId ? matches[0]!.departmentId : null);
    if (
      !mappedDepartment &&
      department &&
      deptMatches.length !== 1 &&
      departmentId
    )
      warnings.push('部门未直接匹配，按主执行人所属部门归属');
    let progress: number | undefined,
      startAt: string | null = null,
      dueAt: string | null = null;
    try {
      const pf = s.fields.find((f) => f.field_id === s.mapping.progress);
      progress = pf
        ? wecomProgress(
            get('progress'),
            pf.field_type as 'progress' | 'percentage',
          )
        : undefined;
      startAt = date(get('start'));
      dueAt = date(get('due'));
    } catch (e) {
      error = (e as Error).message;
    }
    const sourceStatus = text(get('status')),
      status = sourceStatus
        ? sourceStatus === '已完成'
          ? 'done'
          : 'open'
        : progress === 100
          ? 'done'
          : 'open';
    const conflict =
      progress !== undefined &&
      !!sourceStatus &&
      (status === 'done') !== (progress === 100);
    if (conflict) warnings.push('状态与进度冲突，按原值保留');
    if (!project) warnings.push('原表未填项目，不自动沿用上一行');
    const p = text(get('priority'));
    const priority: Priority = /^P[0-3]$/.test(p)
      ? (
          { P0: 'urgent', P1: 'high', P2: 'normal', P3: 'low' } as Record<
            string,
            Priority
          >
        )[p]!
      : 'normal';
    if (p && !/^P[0-3]$/.test(p)) warnings.push('未识别优先级，使用P2');
    if (title.length > 500 || project.length > 500)
      error = '任务或项目名称超过500字';
    const bound = db.tasks.find(
      (t) => sameTarget(t, s) && t.wecom!.recordId === r.record_id,
    );
    const candidates = db.tasks.filter(
      (t) =>
        !t.deletedAt &&
        !t.importSource?.group &&
        !(t.recurrence && !t.templateId) &&
        !db.tasks.some((c) => c.parentId === t.id && !c.deletedAt) &&
        clean(t.title) === clean(title) &&
        (!project ||
          clean(db.tasks.find((p) => p.id === t.parentId)?.title ?? '') ===
            clean(project)) &&
        (!ownerId || (t.ownerId || t.assigneeId) === ownerId) &&
        (!t.wecom || (sameTarget(t, s) && t.wecom.recordId === r.record_id)),
    );
    if (bound?.deletedAt) warnings.push('关联任务在回收站，请先恢复');
    const note = [
      `来源：${s.documentName} / ${s.sheetTitle}`,
      project ? `所属项目：${project}` : '',
      `原始部门：${department || '未填写'}`,
      `负责人：${owners.join('、') || '未填写'}`,
      helpers.length ? `协助人：${helpers.join('、')}` : '',
      sourceStatus ? `原始状态：${sourceStatus}` : '',
      `原始进度：${progress === undefined ? '未填写' : progress + '%'}`,
      text(get('note')),
    ]
      .filter(Boolean)
      .join('\n');
    if (note.length > 8000)
      warnings.push('平台备注只保留前8000字，原表内容保留');
    return [
      {
        recordId: r.record_id,
        title,
        project,
        department,
        departmentId: departmentId ?? null,
        ownerId,
        ownerName: ownerId ? matches[0]!.name : '待分配',
        owners,
        helpers,
        progress,
        status: status as 'open' | 'done',
        sourceStatus,
        conflict,
        priority,
        startAt,
        dueAt,
        note: note.slice(0, 8000),
        warnings,
        error,
        boundTaskId: bound?.id ?? null,
        candidates: candidates.map((t) => ({
          id: t.id,
          title: t.title,
          project: db.tasks.find((p) => p.id === t.parentId)?.title ?? '',
          progress: t.progressUnspecified ? null : t.progress,
        })),
        remoteHash: remoteHash(s, r),
      },
    ];
  });
  return {
    rows,
    skipped: s.records.length - rows.length,
    departments: [...new Set(rows.map((r) => r.department))],
  };
}
export function applyImport(
  s: WecomSnapshot,
  db: Db,
  me: PublicUser,
  choices: ImportChoice[],
  departmentMap: Record<string, string>,
) {
  requireImportAdmin(me);
  if (
    !Array.isArray(choices) ||
    !choices.length ||
    choices.length > 500 ||
    new Set(choices.map((c) => c.recordId)).size !== choices.length
  )
    throw new Error('请选择1至500条不重复的记录');
  const preview = makeImportPreview(s, db, departmentMap),
    selected = choices.map((c) => {
      const row = preview.rows.find((r) => r.recordId === c.recordId);
      if (!row || row.error) throw new Error(row?.error || '记录不存在');
      if (!['create', 'bind', 'update'].includes(c.action))
        throw new Error('导入操作无效');
      if (
        c.project !== undefined &&
        (typeof c.project !== 'string' || c.project.length > 500)
      )
        throw new Error('项目名称无效');
      if (c.action === 'create') {
        if (row.boundTaskId) throw new Error('记录已关联，不能重复创建');
        if (row.candidates.length)
          throw new Error('存在同名任务，请先关联，避免重复导入');
        if (!row.departmentId) throw new Error('请为待分配任务选择部门');
      }
      const task = c.taskId
        ? db.tasks.find((t) => t.id === c.taskId && !t.deletedAt)
        : undefined;
      if (c.action !== 'create') {
        if (
          !task ||
          !(
            row.boundTaskId === task.id ||
            row.candidates.some((t) => t.id === task.id)
          )
        )
          throw new Error('只能关联预览中匹配的任务');
        if (row.boundTaskId && row.boundTaskId !== task.id)
          throw new Error('在线记录已关联其他任务');
        if (
          c.action === 'update' &&
          task.wecom &&
          task.wecom.localHash !== localHash(task)
        )
          throw new Error(
            '平台任务已更改，请先处理差异；可重新关联保留平台数据',
          );
      }
      return { c, row, task };
    });
  if (
    new Set(selected.flatMap((x) => (x.task ? [x.task.id] : []))).size !==
    selected.filter((x) => x.task).length
  )
    throw new Error('不能把多条在线记录关联到同一任务');
  const draft = structuredClone(db.tasks);
  const 示例公司有限公司 = new Date().toISOString();
  let created = 0,
    updated = 0,
    linked = 0;
  const touched = new Set<string>(),
    newParents = new Set<string>();
  for (const { c, row, task: existing } of selected) {
    let task = existing ? draft.find((t) => t.id === existing.id)! : undefined;
    if (!task) {
      const project = (c.project ?? row.project).trim();
      let parentId: string | null = null;
      if (project) {
        const parents = draft.filter(
          (t) =>
            !t.deletedAt &&
            !!t.importSource?.group &&
            clean(t.title) === clean(project) &&
            t.category === row.department &&
            t.departmentId === row.departmentId,
        );
        let parent = parents.length === 1 ? parents[0] : undefined;
        if (!parent) {
          parent = baseTask(
            me,
            project,
            row.departmentId!,
            row.department,
            示例公司有限公司,
          );
          parent.importSource = {
            sha256: hash([s.docid, s.sheetId]),
            group: project,
          };
          draft.push(parent);
          newParents.add(parent.id);
        }
        parentId = parent.id;
      }
      task = {
        ...baseTask(me, row.title, row.departmentId!, row.department, 示例公司有限公司),
        parentId,
      };
      draft.push(task);
      created++;
    } else if (c.action === 'update') updated++;
    else linked++;
    if (c.action !== 'bind')
      Object.assign(task, {
        title: row.title,
        note: row.note,
        scope: row.ownerId ? 'user' : 'dept',
        ownerId: row.ownerId,
        assigneeId: row.ownerId,
        departmentId: row.ownerId ? null : row.departmentId,
        groupId: null,
        assignmentPending: !row.ownerId,
        progress: row.progress ?? 0,
        progressUnspecified: row.progress === undefined,
        progressConflict: row.conflict,
        status: row.status,
        sourceStatus: row.sourceStatus,
        priority: row.priority,
        startAt: row.startAt,
        dueAt: row.dueAt,
        doneAt: row.status === 'done' ? task.doneAt : null,
        updatedAt: 示例公司有限公司,
      });
    task.wecom = {
      revision: randomUUID(),
      docid: s.docid,
      sheetId: s.sheetId,
      recordId: row.recordId,
      mapping: { ...s.mapping } as Record<string, string>,
      remoteHash: row.remoteHash,
      localHash: localHash(task),
      syncedAt: 示例公司有限公司,
    };
    if (c.action !== 'bind') {
      let parent = task.parentId;
      for (let depth = 0; parent && depth < 8; depth++) {
        touched.add(parent);
        parent = draft.find((t) => t.id === parent)?.parentId ?? null;
      }
    }
  }
  const next = { ...db, tasks: draft };
  syncTaskSummaries(next, touched);
  for (const id of newParents) {
    const p = draft.find((t) => t.id === id)!,
      kids = draft.filter((t) => t.parentId === id),
      due = kids
        .flatMap((t) => (t.dueAt ? [t.dueAt] : []))
        .sort((a, b) => Date.parse(a) - Date.parse(b)),
      start = kids.flatMap((t) => (t.startAt ? [t.startAt] : [])).sort();
    p.dueAt = due.at(-1) ?? null;
    p.startAt = start[0] ?? null;
  }
  db.tasks = draft;
  return { created, updated, linked };
}
function baseTask(
  me: PublicUser,
  title: string,
  departmentId: string,
  category: string,
  示例公司有限公司: string,
): Task {
  return {
    id: randomUUID(),
    parentId: null,
    title,
    note: '',
    tags: { cat: category, type: '示例品牌' },
    category,
    type: '示例品牌',
    progress: 0,
    priority: 'normal',
    status: 'open',
    scope: 'dept',
    assigneeId: null,
    groupId: null,
    departmentId,
    ownerId: null,
    claimedById: null,
    claimedAt: null,
    creatorId: me.id,
    dueAt: null,
    remindAt: null,
    remindState: 'none',
    notifiedAt: null,
    recurrence: null,
    templateId: null,
    instanceDate: null,
    doneAt: null,
    deletedAt: null,
    createdAt: 示例公司有限公司,
    updatedAt: 示例公司有限公司,
  };
}
export interface ExportRow {
  taskId: string;
  recordId: string;
  title: string;
  project: string;
  ownerName: string;
  changes: Record<string, unknown>;
  before: Record<string, unknown>;
  expectedRemoteHash: string;
  expectedLocalHash: string;
  expectedBindingHash: string;
  blocked: string;
}
export function makeExportPreview(s: WecomSnapshot, db: Db, me: PublicUser) {
  validateMapping(s);
  const rows: ExportRow[] = db.tasks
    .filter(
      (t) =>
        !t.deletedAt &&
        sameTarget(t, s) &&
        !t.importSource?.group &&
        !(t.recurrence && !t.templateId) &&
        !db.tasks.some((c) => c.parentId === t.id && !c.deletedAt) &&
        ((me.role === 'admin' && !me.managedDepartmentIds) ||
          t.ownerId === me.id),
    )
    .map((t) => {
      const record = s.records.find((r) => r.record_id === t.wecom!.recordId);
      const changes: Record<string, unknown> = {},
        before: Record<string, unknown> = {};
      let blocked = '';
      if (!record) blocked = '原表中没有这条记录或不在当前视图';
      if (JSON.stringify(t.wecom!.mapping) !== JSON.stringify(s.mapping))
        blocked = '字段映射已改变，请重新关联';
      if (record && remoteHash(s, record) !== t.wecom!.remoteHash)
        blocked = '在线记录已更改，请重新读取并核对后关联';
      if (record) {
        const pf = s.fields.find((f) => f.field_id === s.mapping.progress);
        if (pf && !t.progressUnspecified) {
          const next =
            pf.field_type === 'percentage' ? t.progress / 100 : t.progress;
          const old = cell(record.values[pf.field_id]);
          if (old !== next) {
            before[pf.field_id] = old ?? null;
            changes[pf.field_id] = next;
          }
        }
        const sf = s.fields.find((f) => f.field_id === s.mapping.status);
        if (sf) {
          const label =
            t.sourceStatus && t.progressConflict
              ? t.sourceStatus
              : t.status === 'done'
                ? '已完成'
                : t.progress === 0
                  ? '未开始'
                  : '进行中';
          const old = cell(record.values[sf.field_id]);
          if (text(old) !== label) {
            const option = sf.property_single_select?.options?.find(
              (o) => o.text === label,
            );
            if (sf.field_type === 'text' || option) {
              before[sf.field_id] = old ?? null;
              changes[sf.field_id] =
                sf.field_type === 'text'
                  ? label
                  : [{ id: option!.id, text: option!.text }];
            } else blocked = '在线状态选项不匹配，请先核对原表';
          }
        }
      }
      if (s.readonly) blocked = '在线文档为只读';
      return {
        taskId: t.id,
        recordId: t.wecom!.recordId,
        title: t.title,
        project: db.tasks.find((p) => p.id === t.parentId)?.title ?? '',
        ownerName: db.users.find((u) => u.id === t.ownerId)?.name ?? '待分配',
        changes,
        before,
        expectedRemoteHash: record ? remoteHash(s, record) : '',
        expectedLocalHash: localHash(t),
        expectedBindingHash: bindingHash(t),
        blocked,
      };
    });
  return { rows };
}
export function assertExportUnchanged(
  s: WecomSnapshot,
  db: Db,
  rows: ExportRow[],
) {
  if (s.readonly) throw new Error('在线文档为只读');
  for (const row of rows) {
    if (row.blocked) throw new Error(row.blocked);
    const r = s.records.find((r) => r.record_id === row.recordId);
    if (!r || remoteHash(s, r) !== row.expectedRemoteHash)
      throw new Error('在线记录已更改，请重新预览');
    const t = db.tasks.find((t) => t.id === row.taskId && !t.deletedAt);
    if (!t || bindingHash(t) !== row.expectedBindingHash)
      throw new Error('任务关联已更改，请重新预览');
    if (!t || localHash(t) !== row.expectedLocalHash)
      throw new Error('平台任务已更改，请重新预览');
  }
}

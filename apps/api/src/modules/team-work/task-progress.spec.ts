import { describe, expect, it } from 'vitest';
import { emptyDb, publicUser, type User } from './domain/types.js';
import { runWithDb } from './store/index.js';
import { TasksService } from './modules/tasks/tasks.service.js';

const member = (id: string, departmentId = 'a'): User => ({
  id,
  name: id,
  account: id,
  title: '',
  role: 'member',
  state: 'active',
  departmentId,
  groupIds: [departmentId],
  passwordHash: '',
  passwordSalt: '',
  mustChangePassword: false,
  avatarEmoji: null,
  avatarColor: null,
  prefs: {},
  memos: [],
  ivy: [],
  createdAt: new Date().toISOString(),
  lastLoginAt: null,
});
async function scenario(
  fn: (
    s: TasksService,
    db: ReturnType<typeof emptyDb>,
    alice: ReturnType<typeof publicUser>,
    bob: ReturnType<typeof publicUser>,
  ) => Promise<void>,
) {
  const db = emptyDb();
  db.users = [member('alice'), member('bob', 'b')];
  await runWithDb(db, () =>
    fn(
      new TasksService(),
      db,
      publicUser(db.users[0]!),
      publicUser(db.users[1]!),
    ),
  );
}
const input = {
  progressPercent: 65,
  summary: '已完成部署',
  nextAction: '继续验证',
  blockers: '等待业务反馈',
  riskLevel: 1,
};
describe('department task details and progress', () => {
  it('keeps missing-owner imports pending assignment until a manager chooses a person', async () => scenario(async(s,db,me,bob)=>{
    db.departments=[{id:'a',name:'部门',color:'#fff',createdAt:new Date().toISOString()}];
    const task=await s.create({title:'待分配动作',scope:'dept',departmentId:'a'},me);
    Object.assign(task,{assignmentPending:true});
    expect((await s.details(task.id,me)).permissions.canClaim).toBe(false);
    expect((await s.summary(me)).pool).toBe(0);
    await expect(s.claim(task.id,me)).rejects.toThrow();
    await s.update(task.id,{scope:'user',assigneeId:me.id},{...bob,role:'admin'});
    expect((task as any).assignmentPending).toBe(false);
    await s.claim(task.id,me);expect(task.ownerId).toBe(me.id);
  }));
  it('preserves non-completed source status at 100 percent and clears its conflict only on an explicit report', async () => scenario(async (s, db, me) => {
    const parent = await s.create({title:'导入汇总',assigneeId:me.id},me);
    parent.importSource={sha256:'source',group:'导入汇总'};
    const child=await s.create({title:'原表动作',parentId:parent.id,assigneeId:me.id},me);
    Object.assign(child,{status:'open',progress:100,sourceStatus:'进行中',progressConflict:true});
    await s.update(child.id,{note:'保留原始状态'},me);
    expect(child.status).toBe('open');expect(child.progress).toBe(100);expect(child.sourceStatus).toBe('进行中');
    expect(parent.sourceStatus).toBe('待核对');expect(parent.status).toBe('open');
    await s.reportProgress(child.id,{...input,progressPercent:100},me);
    expect((child as any).progressConflict).toBe(false);expect(child.status).toBe('done');expect(parent.status).toBe('done');
  }));
  it('appends authored history, updates progress and derived parent without changing provenance', async () =>
    scenario(async (s, db, me) => {
      const parent = await s.create({ title: '项目', assigneeId: me.id }, me);
      const t = await s.create(
        { title: '任务', parentId: parent.id, assigneeId: me.id },
        me,
      );
      t.importSource = {
        sha256: 'source',
        row: 42,
        original: { progress: 80 },
      };
      t.progressUnspecified = true;
      await s.reportProgress(
        t.id,
        { ...input, authorId: 'forged', createdAt: '2000' } as any,
        me,
      );
      let detail = await s.details(t.id, me);
      expect(detail.task.progress).toBe(65);
      expect(parent.progress).toBe(65);
      expect(detail.updates).toHaveLength(1);
      expect(detail.updates[0]).toMatchObject({
        ...input,
        authorId: me.id,
        authorName: me.name,
      });
      expect(detail.updates[0]!.createdAt).not.toBe('2000');
      expect(t.importSource.original).toEqual({ progress: 80 });
      expect(t.progressUnspecified).toBe(false);
      await s.reportProgress(t.id, { ...input, progressPercent: 100 }, me);
      detail = await s.details(t.id, me);
      expect(detail.task.status).toBe('done');
      expect(detail.task.doneAt).toBeTruthy();
      expect(detail.updates.map((x) => x.progressPercent)).toEqual([100, 65]);
      expect((await s.list(me)).tasks[0]).not.toHaveProperty('updates');
      expect(db.tasks).toHaveLength(2);
    }));
  it('denies hidden details and all progress writes by non-executors, including administrators', async () =>
    scenario(async (s, db, me, bob) => {
      const t = await s.create({ title: '私有任务', assigneeId: me.id }, me);
      await expect(s.details(t.id, bob)).rejects.toThrow();
      await expect(s.reportProgress(t.id, input, bob)).rejects.toThrow();
      const boss = { ...bob, role: 'admin' as const };
      expect((await s.details(t.id, boss)).permissions.canUpdateProgress).toBe(
        false,
      );
      await expect(s.reportProgress(t.id, input, boss)).rejects.toThrow();
      expect(t.progress).toBe(0);
      expect(db.taskUpdates ?? []).toHaveLength(0);
    }));
  it('rejects summary and recurring template reports and invalid forms before any mutation', async () =>
    scenario(async (s, db, me) => {
      const t = await s.create({ title: '任务', assigneeId: me.id }, me);
      for (const patch of [
        { progressPercent: 101 },
        { progressPercent: 2.5 },
        { summary: ' ' },
        { nextAction: '' },
        { riskLevel: 4 },
        { blockers: 13 },
        { summary: 'a'.repeat(4001) },
      ]) {
        await expect(
          s.reportProgress(t.id, { ...input, ...patch } as any, me),
        ).rejects.toThrow();
      }
      t.importSource = { sha256: 'x', group: '汇总' };
      await expect(s.reportProgress(t.id, input, me)).rejects.toThrow();
      delete t.importSource;
      await s.create(
        { title: '子任务', parentId: t.id, assigneeId: me.id },
        me,
      );
      expect((await s.details(t.id, me)).permissions.canUpdateProgress).toBe(
        false,
      );
      await expect(s.reportProgress(t.id, input, me)).rejects.toThrow();
      const rule = await s.create(
        {
          title: '周期',
          assigneeId: me.id,
          recurrence: { freq: 'daily', at: '09:00' },
        },
        me,
      );
      await expect(s.reportProgress(rule.id, input, me)).rejects.toThrow();
      expect(db.taskUpdates ?? []).toHaveLength(0);
    }));
  it('keeps unmodified import conflicts and removes only purged task history', async () =>
    scenario(async (s, db, me) => {
      const t = await s.create({ title: '冲突记录', assigneeId: me.id }, me);
      t.progress = 80;
      t.status = 'done';
      expect((await s.details(t.id, me)).task.progress).toBe(80);
      expect(t.status).toBe('done');
      const other = await s.create({ title: '保留', assigneeId: me.id }, me);
      await s.reportProgress(t.id, input, me);
      await s.reportProgress(other.id, input, me);
      await s.trash(t.id, me);
      await expect(s.details(t.id, me)).rejects.toThrow();
      await s.purge([t.id], me);
      expect(db.taskUpdates?.map((x) => x.taskId)).toEqual([other.id]);
    }));
});

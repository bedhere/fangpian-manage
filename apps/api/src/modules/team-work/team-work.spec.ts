import { describe, it, expect } from 'vitest';
import { store, runWithDb } from './store/index.js';
import { emptyDb, publicUser, type User } from './domain/types.js';
import { TasksService } from './modules/tasks/tasks.service.js';
import { MemosService } from './modules/memos/memos.service.js';
import { AppraisalsService } from './modules/appraisals/appraisals.service.js';
import { canManageTask, canManageUser } from './domain/types.js';
import { TeamWorkController } from './team-work.controller.js';
import { TeamWorkSnapshotController } from './team-work.snapshot.js';
import { IvyService } from './modules/ivy/ivy.service.js';

const user = (id: string, dept = 'a', role: 'admin' | 'member' = 'member'): User => ({
  id, name: id, account: id, title: '', role, state: 'active', departmentId: dept,
  groupIds: [dept], passwordHash: '', passwordSalt: '', mustChangePassword: false,
  avatarEmoji: null, avatarColor: null, prefs: {}, memos: [], ivy: [],
  createdAt: new Date().toISOString(), lastLoginAt: null,
});
function fixture() {
  const db = emptyDb();
  db.users = [user('alice'), user('bob'), user('carol', 'b'), user('boss', 'a', 'admin')];
  db.departments = ['a', 'b'].map(id => ({ id, name: id, color: '#facc15', createdAt: new Date().toISOString() }));
  db.groups = db.departments.map(d => ({ ...d, departmentId: d.id, leaderId: null, dimTags: {}, categories: [], types: [] }));
  return db;
}
describe('team work integration', () => {
  it('returns one consistent snapshot with scoped tasks and only the callers personal records', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const tasks = new TasksService(), memos = new MemosService(), ivy = new IvyService();
      const alice = publicUser(db.users[0]!), carol = publicUser(db.users[2]!);
      const mine = await tasks.create({ title: '我的工作', assigneeId: alice.id }, alice);
      const other = await tasks.create({ title: '其他部门工作', assigneeId: carol.id }, carol);
      await memos.create(alice, '自己的备忘'); await memos.create(carol, '其他人的秘密');
      await ivy.save(carol, '2026-10-22', '其他人的汇报');
      const snapshot = await new TeamWorkSnapshotController(tasks, memos, ivy).snapshot(alice);
      expect(snapshot.tasks.map(t => t.id)).toEqual([mine.id]);
      expect(snapshot.tasks.map(t => t.id)).not.toContain(other.id);
      expect(snapshot.summary.total).toBe(1);
      expect(snapshot.memos.map(m => m.text)).toEqual(['自己的备忘']);
      expect(snapshot.ivy).toEqual([]);
      expect(JSON.stringify(snapshot)).not.toContain('其他人的秘密');
      expect(JSON.stringify(snapshot)).not.toContain('其他人的汇报');
    });
  });
  it('materializes recurring tasks before counting them in the initial snapshot', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const tasks = new TasksService(), me = publicUser(db.users[0]!);
      const template = await tasks.create({ title: '每日事项', assigneeId: me.id, recurrence: { freq: 'daily', at: '09:00' } }, me);
      const snapshot = await new TeamWorkSnapshotController(tasks, new MemosService(), new IvyService()).snapshot(me);
      expect(snapshot.tasks.filter(t => t.templateId === template.id)).toHaveLength(1);
      expect(snapshot.generated).toBe(1);
      expect(snapshot.summary.generatedToday).toBe(1);
    });
  });
  it('does not turn an imported 90 percent conflict into a 100 percent summary', async () => {
    const db=fixture();
    await runWithDb(db,async()=>{
      const service=new TasksService(), me=publicUser(db.users[0]!);
      const parent=await service.create({title:'项目',assigneeId:'alice'},me);
      Object.assign(parent,{importSource:{group:'项目',sha256:'source'}});
      const child=await service.create({title:'动作',parentId:parent.id,assigneeId:'alice'},me);
      Object.assign(child,{status:'done',progress:90});
      await service.update(child.id,{note:'核对'},me);
      expect(parent.progress).toBe(90);expect(parent.status).toBe('open');
    });
  });
  it('does not expose imported summaries as claimable work or include them in workload counts', async () => {
    const db=fixture();
    await runWithDb(db, async()=>{
      const service=new TasksService(), me=publicUser(db.users[0]!);
      const parent=await service.create({title:'汇总',scope:'dept',departmentId:'a'},me);
      Object.assign(parent,{importSource:{group:'项目',sha256:'source'}});
      await service.create({title:'实际动作',parentId:parent.id,scope:'user',assigneeId:'alice'},me);
      expect((await service.summary(me)).pool).toBe(0);
      expect((await service.summary(me)).total).toBe(1);
      await expect(service.claim(parent.id,me)).rejects.toThrow();
    });
  });
  it('excludes explicitly flagged demo and inactive accounts from member choices without matching names', async () => {
    const db = fixture();
    Object.assign(db.users[0]!, { isDemoAccount: true });
    db.users[1]!.state = 'disabled';
    db.users[2]!.name = '平台管理员';
    await runWithDb(db, async () => {
      expect(new TeamWorkController().org().users.map(u => u.id)).toEqual(['carol', 'boss']);
    });
  });
  it('fails closed without a request context', () => { expect(() => store.db).toThrow(); });
  it('keeps overlapping organization request snapshots separate', async () => {
    const a = fixture(), b = fixture();
    await Promise.all([runWithDb(a, async () => { await new Promise(r => setTimeout(r, 10)); await store.update(d => d.users[0]!.name = 'A'); }),
      runWithDb(b, async () => { await store.update(d => d.users[0]!.name = 'B'); })]);
    expect(a.users[0]!.name).toBe('A'); expect(b.users[0]!.name).toBe('B');
  });
  it('supports assignment, claim, child completion and parent progress', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const service = new TasksService(), alice = publicUser(db.users[0]!), bob = publicUser(db.users[1]!);
      const task = await service.create({ title: '交付', assigneeId: bob.id }, alice);
      expect(task.ownerId).toBeNull();
      await service.claim(task.id, bob);
      const child = await service.create({ title: '验证', parentId: task.id }, alice);
      await service.update(child.id, { status: 'done' }, bob);
      const parent = (await service.list(alice)).tasks.find(t => t.id === task.id)!;
      expect(parent.status).toBe('done'); expect(parent.progress).toBe(100);
    });
  });
  it('rejects a subtask added to an unrelated private task', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const service = new TasksService();
      const parent = await service.create({ title: '私有', assigneeId: 'alice' }, publicUser(db.users[0]!));
      await expect(service.create({ title: '越权', parentId: parent.id }, publicUser(db.users[2]!))).rejects.toThrow();
    });
  });
  it('rejects assignment to users or departments outside canonical organization data', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const service = new TasksService(), me = publicUser(db.users[0]!);
      await expect(service.create({ title: '伪造人', assigneeId: 'other-org-user' }, me)).rejects.toThrow();
      await expect(service.create({ title: '伪造部门', scope: 'dept', departmentId: 'other-org-dept' }, me)).rejects.toThrow();
    });
  });
  it('generates a recurring instance once and resets reminder state', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const service = new TasksService(), me = publicUser(db.users[0]!);
      const task = await service.create({ title: '每日', assigneeId: 'alice', remindAt: new Date().toISOString(), recurrence: { freq: 'daily', at: '09:00' } }, me);
      task.remindState = 'fired';
      const first = await service.list(me), second = await service.list(me);
      expect(first.tasks.filter(t => t.templateId === task.id)).toHaveLength(1);
      expect(second.generated).toBe(0);
      expect(first.tasks.find(t => t.templateId === task.id)!.remindState).toBe('pending');
    });
  });
  it('keeps memo content private and rejects another employees appraisal', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const alice = publicUser(db.users[0]!), bob = publicUser(db.users[1]!);
      const memos = new MemosService(); await memos.create(alice, '私人事项');
      expect((await memos.list(bob)).memos).toEqual([]);
      expect(JSON.stringify(publicUser(db.users[0]!))).not.toContain('私人事项');
      await expect(new AppraisalsService().get(bob, { userId: alice.id })).rejects.toThrow();
    });
  });
  it('allows self assessment but preserves supervisor rating columns', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const me = publicUser(db.users[0]!);
      const result = await new AppraisalsService().save(me, { month: '2026-10' }, [{ title: '指标', selfPct: 80, finalCoef: 9, leadPct: 100 }]);
      expect(result.appraisal.items[0]!.selfPct).toBe(80);
      expect(result.appraisal.items[0]!.finalCoef).toBeNull();
      expect(result.appraisal.items[0]!.leadPct).toBeNull();
    });
  });
  it('limits a department supervisor to their managed department', async () => {
    const db = fixture();
    const head = { ...publicUser(db.users[3]!), managedDepartmentIds: ['a'] };
    expect(canManageUser(head, 'alice', db)).toBe(true);
    expect(canManageUser(head, 'carol', db)).toBe(false);
    await runWithDb(db, async () => {
      const tasks = new TasksService();
      const privateTask = await tasks.create({ title: 'B部门私有', assigneeId: 'carol' }, publicUser(db.users[2]!));
      expect(canManageTask(head, privateTask, db)).toBe(false);
      expect((await tasks.list(head)).tasks.map(t => t.id)).not.toContain(privateTask.id);
      await expect(tasks.update(privateTask.id, { title: '越权编辑' }, head)).rejects.toThrow();
      await expect(new AppraisalsService().get(head, { userId: 'carol' })).rejects.toThrow();
    });
  });
  it('rejects invalid task dates, recurrence times and oversized content', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const tasks = new TasksService(), me = publicUser(db.users[0]!);
      await expect(tasks.create({ title: '无效日期', assigneeId: 'alice', dueAt: 'tomorrow' }, me)).rejects.toThrow();
      await expect(tasks.create({ title: '错误周期', assigneeId: 'alice', recurrence: { freq: 'daily', at: '99:00' } }, me)).rejects.toThrow();
      await expect(tasks.create({ title: 'x'.repeat(501), assigneeId: 'alice' }, me)).rejects.toThrow();
    });
  });
  it('prevents linking another departments task into an appraisal', async () => {
    const db = fixture();
    const head = { ...publicUser(db.users[3]!), managedDepartmentIds: ['a'] };
    await runWithDb(db, async () => {
      const task = await new TasksService().create({ title: 'B部门指标', assigneeId: 'carol' }, publicUser(db.users[2]!));
      await expect(new AppraisalsService().save(head, { userId: 'alice', month: '2026-10' }, [{ title: '越权关联', taskId: task.id }])).rejects.toThrow();
    });
  });
  it('does not allow deleted tasks to be claimed or released', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const tasks = new TasksService(), alice = publicUser(db.users[0]!), bob = publicUser(db.users[1]!);
      const task = await tasks.create({ title: '已撤销', assigneeId: bob.id }, alice);
      await tasks.trash(task.id, alice);
      await expect(tasks.claim(task.id, bob)).rejects.toThrow();
      await expect(tasks.release(task.id, bob)).rejects.toThrow();
    });
  });
  it('keeps organization dimensions global and department labels scoped', async () => {
    const db = fixture();
    await runWithDb(db, async () => {
      const controller = new TeamWorkController();
      const head = { ...publicUser(db.users[3]!), managedDepartmentIds: ['a'] };
      await expect(controller.settings(head, { dims: [{ id: 'cat', name: '板块' }, { id: 'type', name: '类型' }] })).rejects.toThrow();
      await expect(controller.groupTags(head, 'b', { dimId: 'cat', tags: ['越权标签'] })).rejects.toThrow();
      await controller.groupTags(head, 'a', { dimId: 'cat', tags: ['日常', '日常'] });
      expect(db.groups.find(g => g.id === 'a')!.categories).toEqual(['日常']);
      await controller.settings(publicUser(db.users[3]!), { dims: [{ id: 'cat', name: '业务' }, { id: 'type', name: '类型' }, { id: 'channel', name: '渠道' }] });
      expect(db.settings.dims.map(d => d.name)).toContain('渠道');
    });
  });
});

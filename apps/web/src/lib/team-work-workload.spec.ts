import { describe, expect, it } from 'vitest';
import { executorId, executorName, groupWorkByPerson, workloadStats } from '../../../team-work/src/domain/workload';
import type { Task, Org } from '../../../team-work/src/domain/types';

const org = { users: [{ id:'a',name:'张三' },{ id:'b',name:'李四' }], groups:[], departments:[] } as unknown as Org;
const task = (id:string, extra:Partial<Task> = {}) => ({id,title:id,ownerId:'a',assigneeId:null,status:'open',progress:50,dueAt:'2099-01-01',...extra}) as Task;
describe('person workload from actual work',()=>{
 it('uses the confirmed owner, falls back to assignee, and keeps blank assignment explicit',()=>{
  expect(executorId(task('a',{ownerId:'b',assigneeId:'a'}))).toBe('b');
  expect(executorName(task('b',{ownerId:null,assigneeId:'b'}),org)).toBe('李四');
  expect(executorName(task('c',{ownerId:null,assignmentPending:true}),org)).toBe('待分配');
 });
 it('groups actual children by executor rather than their unassigned summary without duplicates',()=>{
  const rows=[task('project',{ownerId:null,importSource:{sha256:'s',group:'项目'}}), task('a',{parentId:'project'}),task('b',{parentId:'project',ownerId:'b'}),task('pending',{ownerId:null})];
  const groups=groupWorkByPerson(rows,org);
  expect(groups.map(g=>[g.label,g.tasks.map(t=>t.id)])).toEqual([['张三',['a']],['李四',['b']],['待分配',['pending']]]);
 });
 it('does not count summaries, treat blank progress as zero, or rewrite status-progress conflicts',()=>{
  const stats=workloadStats([task('summary',{importSource:{sha256:'s',group:'项目'},progress:100}),task('blank',{progress:0,progressUnspecified:true}),task('done',{status:'done',progress:80,progressConflict:true}),task('late',{progress:20,dueAt:'2020-01-01'})]);
  expect(stats).toEqual({total:3,open:2,done:1,overdue:1,averageProgress:50,unspecified:1,conflicts:1});
 });
});

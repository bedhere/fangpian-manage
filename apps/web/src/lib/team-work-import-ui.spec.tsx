import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatorCell, ExecutorCell, DueCell } from '../../../team-work/src/components/TaskCells';
import { BoardView } from '../../../team-work/src/views/BoardView';
const { state } = vi.hoisted(() => ({ state: { view:'mine',setView:vi.fn(), user: {id:'me',role:'member',groupIds:['dept'],departmentId:'dept',prefs:{}}, org:{users:[],groups:[],departments:[]}, tasks:[] as any[], summary:{},savePrefs:vi.fn(), updateTask:vi.fn(),pushToast:vi.fn() } }));
vi.mock('../../../team-work/src/store/AppProvider', () => ({ useApp: () => state }));
const task = (id:string,status='open') => ({id,title:id,note:'',progress:status==='done'?100:0,status,scope:'dept',departmentId:'dept',parentId:null,ownerId:'me',creatorId:'hidden-admin',dueAt:null,createdAt:new Date().toISOString(),priority:'normal',category:'',type:''});
describe('imported task presentation',()=>{
 it('labels missing-owner work as pending assignment and never offers self-claim',()=>{
  render(<ExecutorCell task={{...task('待分配动作'),ownerId:null,assignmentPending:true} as any} canAssign={false}/>);
  expect(screen.getByText('待分配')).toBeVisible();expect(screen.queryByRole('button')).toBeNull();
 });
 beforeEach(()=>{state.tasks=[];state.user.prefs={};});
 it('labels spreadsheet provenance without calling a filtered administrator deleted',()=>{
  render(<CreatorCell task={{...task('import'),importSource:{sha256:'source',row:3}} as any}/>);
  expect(screen.queryByText('已删除用户')).toBeNull();expect(screen.getByText('表格导入')).toBeVisible();
 });
 it('never offers a claim action on an imported summary',()=>{
  render(<ExecutorCell task={{...task('group'),ownerId:null,importSource:{group:'真实项目'}} as any} canAssign={false}/>);
  expect(screen.queryByRole('button')).toBeNull();expect(screen.getByText('汇总')).toBeVisible();
 });
 it('does not label an already completed task as overdue',()=>{
  render(<DueCell task={{...task('closed','done'),dueAt:'2020-01-01T23:59:59+08:00'} as any} canEdit={false}/>);
  expect(screen.queryByText(/逾期/)).toBeNull();expect(screen.getByText(/1月1日/)).toBeVisible();
 });
 it('uses an explicit checked hide-completed control and filters completed children too',()=>{
  state.tasks=[task('未完成'),task('已完成记录','done'),{...task('完成子任务','done'),parentId:'未完成'}];
  render(<BoardView/>);
  const hide=screen.getByRole('checkbox',{name:/隐藏已完成/});
  if(hide.getAttribute('aria-checked')!=='true')fireEvent.click(hide);
  expect(screen.queryByText('完成子任务')).toBeNull();expect(screen.queryByText('已完成记录',{exact:true})).toBeNull();
  fireEvent.click(hide);expect(screen.getByText('完成子任务')).toBeVisible();
 });
 it('does not leave an empty imported summary behind after hiding its completed records',()=>{
  state.tasks=[{...task('冲突项目上下文'),ownerId:null,importSource:{sha256:'source',group:'项目'}},{...task('冲突动作','done'),progress:90,parentId:'冲突项目上下文'}];
  render(<BoardView/>);
  const hide=screen.getByRole('checkbox',{name:/隐藏已完成/});
  if(hide.getAttribute('aria-checked')!=='true')fireEvent.click(hide);
  expect(screen.queryByText('冲突项目上下文')).toBeNull();
 });
});

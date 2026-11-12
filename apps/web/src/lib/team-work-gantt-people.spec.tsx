import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardView } from '../../../team-work/src/views/BoardView';

const { state }=vi.hoisted(()=>({state:{view:'all',setView:vi.fn(),user:{id:'boss',role:'admin',groupIds:[],departmentId:null,prefs:{}},org:{users:[{id:'a',name:'张三'},{id:'b',name:'李四'},{id:'unused',name:'无任务示例员工1548'}],groups:[],departments:[]},tasks:[] as any[],summary:{},savePrefs:vi.fn(),updateTask:vi.fn(),pushToast:vi.fn(),select:vi.fn()}}));
vi.mock('../../../team-work/src/store/AppProvider',()=>({useApp:()=>state}));
const task=(id:string,extra={})=>({id,title:id,parentId:'project',ownerId:'a',assigneeId:null,creatorId:'boss',scope:'dept',departmentId:null,note:'',status:'open',progress:60,startAt:'2026-10-01',dueAt:'2026-10-20',createdAt:'2026-10-01',priority:'normal',category:'AI',type:'项目进度',...extra});
beforeEach(()=>{
 vi.clearAllMocks(); localStorage.clear();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-24T12:00:00+08:00'));vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 state.tasks=[task('project',{title:'共同项目',parentId:null,ownerId:null,importSource:{sha256:'s',group:'项目'}}),task('张三执行步骤'),task('李四执行步骤',{ownerId:'b',progress:80}),task('已指派步骤',{ownerId:null,assigneeId:'b'}),task('无负责人步骤',{ownerId:null,assignmentPending:true}),task('未排期步骤',{startAt:null,dueAt:null})];
 state.user.id='boss';state.user.role='admin';state.view='all';state.user.prefs={};
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
describe('gantt executor visibility and filtering',()=>{
 it('preserves completed percentages and flags the conflict while blank progress stays unspecified',()=>{
  state.tasks=[state.tasks[0],task('已完成但80%',{status:'done',progress:80,progressConflict:true}),task('原表空进度',{progress:0,progressUnspecified:true})];
  render(<BoardView/>);fireEvent.click(screen.getByRole('button',{name:'甘特'}));
  const includeDone=screen.getByRole('checkbox',{name:'包含已完成任务'});expect(includeDone).toHaveAttribute('aria-checked','false');fireEvent.click(includeDone);
  const completed=screen.getByRole('button',{name:'查看任务：已完成但80%'}).closest('.gantt-row') as HTMLElement;
  expect(within(completed).getByText('80%')).toBeVisible();expect(within(completed).getByText('已完成')).toBeVisible();expect(within(completed).getByText('待核对')).toBeVisible();
  const blank=screen.getByRole('button',{name:'查看任务：原表空进度'}).closest('.gantt-row') as HTMLElement;
  expect(within(blank).getByText('进度未填')).toBeVisible();expect(within(blank).queryByText('0%')).toBeNull();
 });
 it('shows executor and progress without hovering and opens details from the sticky task label',()=>{
  render(<BoardView/>);fireEvent.click(screen.getByRole('button',{name:'甘特'}));
  const row=screen.getByRole('button',{name:'查看任务：张三执行步骤'}).closest('.gantt-row')!;
  expect(within(row as HTMLElement).getByText('张三',{exact:true})).toBeVisible();
  expect(within(row as HTMLElement).getByText('60%',{exact:true})).toBeVisible();
  expect(within(row as HTMLElement).getByText('逾期',{exact:true})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'查看任务：张三执行步骤'}));expect(state.select).toHaveBeenCalledWith('张三执行步骤');
  expect(screen.getByText('未排期',{exact:true})).toBeVisible();
 });
 it('filters by actual executor, preserves project context, and carries the filter into the list',()=>{
  render(<BoardView/>);fireEvent.click(screen.getByRole('button',{name:'甘特'}));
  fireEvent.click(screen.getByRole('button',{name:'筛选执行人'}));
  expect(screen.queryByRole('option',{name:/无任务示例员工1548/})).toBeNull();
  fireEvent.click(screen.getByRole('option',{name:/李四/}));
  expect(screen.queryByRole('button',{name:'查看任务：张三执行步骤'})).toBeNull();
  expect(screen.getByRole('button',{name:'查看任务：李四执行步骤'})).toBeVisible();
  expect(screen.getByRole('button',{name:'查看任务：已指派步骤'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'按项目'}));
  expect(screen.getByRole('button',{name:'查看任务：共同项目'})).toBeVisible();
  expect(screen.queryByRole('button',{name:'查看任务：张三执行步骤'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'列表'}));
  expect(screen.getByText('共同项目')).toBeVisible();expect(screen.queryByText('张三执行步骤')).toBeNull();expect(screen.getByText('李四执行步骤')).toBeVisible();
 });
 it('keeps waiting assignment separate, and respects other filters for regular members too',()=>{
  state.user.role='member';state.user.id='a';state.view='dept';
  render(<BoardView/>);fireEvent.click(screen.getByRole('button',{name:'筛选执行人'}));fireEvent.click(screen.getByRole('option',{name:/李四/}));
  expect(screen.queryByText('张三执行步骤')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'筛选执行人'}));fireEvent.click(screen.getByRole('option',{name:/待分配/}));
  expect(screen.getByText('无负责人步骤')).toBeVisible();expect(screen.queryByText('已指派步骤')).toBeNull();
  state.user.id='boss';
 });
 it('allows searching a large executor list and clears a previous executor on a statistic navigation',()=>{
  render(<BoardView/>);fireEvent.click(screen.getByRole('button',{name:'筛选执行人'}));
  fireEvent.change(screen.getByRole('searchbox',{name:'搜索执行人'}),{target:{value:'李四'}});
  expect(screen.queryByRole('option',{name:/张三/})).toBeNull();fireEvent.click(screen.getByRole('option',{name:/李四/}));
  fireEvent.click(screen.getByRole('button',{name:/全部待办/}));
  expect(screen.getByText('张三执行步骤')).toBeVisible();
 });
});


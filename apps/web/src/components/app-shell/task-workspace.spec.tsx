import{fireEvent,render,screen}from'@testing-library/react';
import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
import{TaskWorkspace}from'./task-workspace';
vi.mock('./app-shell',()=>({AppShellHeader:({onCollapse}:{onCollapse:()=>void})=><header><nav aria-label="主导航">平台导航</nav><button onClick={onCollapse}>收起平台导航</button></header>}));
vi.mock('./route-progress',()=>({RouteProgress:()=>null}));
describe('task workspace navigation',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 beforeEach(()=>{sessionStorage.clear();vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));});
 it('collapses and restores navigation without unmounting task content and remembers the choice',()=>{
  const view=render(<TaskWorkspace groups={[]}><input aria-label="任务搜索" defaultValue="保留筛选"/></TaskWorkspace>);
  fireEvent.click(screen.getByRole('button',{name:'收起平台导航'}));expect(screen.queryByRole('navigation',{name:'主导航'})).toBeNull();expect(screen.getByLabelText('任务搜索')).toHaveValue('保留筛选');
  view.unmount();render(<TaskWorkspace groups={[]}>任务内容</TaskWorkspace>);expect(screen.queryByRole('navigation',{name:'主导航'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'展开平台导航'}));expect(screen.getByRole('navigation',{name:'主导航'})).toBeVisible();
 });
 it('starts compact on short or narrow screens',()=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  render(<TaskWorkspace groups={[]}>任务内容</TaskWorkspace>);expect(screen.getByRole('button',{name:'展开平台导航'})).toBeVisible();expect(screen.getByText('任务内容')).toBeVisible();
 });
});

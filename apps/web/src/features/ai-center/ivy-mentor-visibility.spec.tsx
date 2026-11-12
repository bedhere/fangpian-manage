import {render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {IvyTab} from './ivy';
import type {Workspace} from './types';
vi.mock('./record-tools',()=>({RecordTools:()=>null}));
describe('mentor current diary (offline)',()=>{
 it('shows the saved current diary without enabling same-day grading',()=>{const data={serverDate:'2026-11-04',week:'2026-11-02',user:{id:'mentor',isTrainee:false},ivy:[{id:'diary',ownerId:'trainee',ownerName:'管培生',dateKey:'2026-11-04',version:1,status:'SUBMITTED',canReview:false,data:{today:[{id:'entry',text:'今日工作成果',status:'DOING'}],tomorrow:[]}}],ivyTaskDays:[]} as unknown as Workspace;render(<IvyTab data={data} busy={false} mutate={vi.fn()}/>);expect(screen.getByText(/今日工作成果/)).toBeVisible();expect(screen.getByText(/今日已保存.*次日起/)).toBeVisible();expect(screen.queryByText('历史日报与评分')).toBeNull();expect(screen.queryByRole('button',{name:/确认.*评价|提交.*评价/})).toBeNull();});
});

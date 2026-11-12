import {render,screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {IvyWecomStatus} from './ivy-wecom-status';
import type {Workspace} from './types';
describe('diary delivery status',()=>{
 it('explains the mentor-approval trigger rather than save-triggered delivery',()=>{render(<IvyWecomStatus data={{ivyWecom:{enabled:true,targetName:'方片AI管培生·1期',testMode:false,pauseReason:null,deliveries:[]}} as unknown as Workspace}/>);expect(screen.getByText(/导师审核.*评级/)).toBeVisible();expect(screen.queryByText(/保存当日日报后自动发送/)).toBeNull();});
 it('does not claim delivery when authorization is paused or a result is unknown',()=>{const data={ivyWecom:{enabled:true,targetName:'示例员工0101',testMode:true,pauseReason:'850003',deliveries:[{recordId:'diary',status:'UNKNOWN',recordVersion:1,errorMessage:'发送结果未确认',completedAt:null}]}} as unknown as Workspace;render(<IvyWecomStatus data={data} recordId="diary"/>);expect(screen.getByText(/发送结果待核对/)).toBeVisible();expect(screen.getByText(/消息通道已暂停/)).toBeVisible();expect(screen.queryByText('消息已发送')).toBeNull();});
 it('keeps the legacy diary UI quiet before the feature is enabled',()=>{const {container}=render(<IvyWecomStatus data={{} as Workspace}/>);expect(container).toBeEmptyDOMElement();});
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressCell } from '../../../team-work/src/components/ProgressCell';
const { updateTask, pushToast }=vi.hoisted(()=>({updateTask:vi.fn(),pushToast:vi.fn()}));
vi.mock('../../../team-work/src/store/AppProvider',()=>({useApp:()=>({updateTask,pushToast})}));
const task={id:'real-task',title:'任务进度',progress:60,status:'open'} as any;
beforeEach(()=>{vi.clearAllMocks();updateTask.mockResolvedValue(undefined)});
describe('explicit task progress editing',()=>{
 it('opens an accessible input and saves an explicit percentage through the existing task endpoint',async()=>{
  render(<ProgressCell task={task} locked={false}/>);fireEvent.click(screen.getByRole('button',{name:'编辑进度，当前60%'}));
  const input=screen.getByRole('spinbutton',{name:'进度百分比'});expect(input).toHaveValue(60);
  fireEvent.change(input,{target:{value:'83'}});fireEvent.click(screen.getByRole('button',{name:'保存进度'}));
  await waitFor(()=>expect(updateTask).toHaveBeenCalledWith('real-task',{progress:83}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 });
 it('requires an integer between 0 and 100, preserves unknown progress, and cancels without saving',()=>{
  render(<ProgressCell task={{...task,progress:0,progressUnspecified:true}} locked={false}/>);fireEvent.click(screen.getByRole('button',{name:'编辑进度，当前未填'}));
  const input=screen.getByRole('spinbutton',{name:'进度百分比'});expect(input).toHaveValue(null);
  for(const value of ['', '101','-1','53.5']){fireEvent.change(input,{target:{value}});fireEvent.click(screen.getByRole('button',{name:'保存进度'}));expect(updateTask).not.toHaveBeenCalled();}
  fireEvent.keyDown(input,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(updateTask).not.toHaveBeenCalled();
 });
 it('leaves a failed value available for retry and prevents duplicate submission',async()=>{
  let reject!:(reason:Error)=>void;updateTask.mockImplementationOnce(()=>new Promise((_,no)=>{reject=no}));
  render(<ProgressCell task={task} locked={false}/>);fireEvent.click(screen.getByRole('button',{name:'编辑进度，当前60%'}));fireEvent.change(screen.getByRole('spinbutton',{name:'进度百分比'}),{target:{value:'70'}});
  fireEvent.click(screen.getByRole('button',{name:'保存进度'}));expect(screen.getByRole('button',{name:'保存中…'})).toBeDisabled();reject(new Error('网络暂不可用'));
  expect(await screen.findByRole('alert')).toHaveTextContent('网络暂不可用');expect(screen.getByRole('spinbutton')).toHaveValue(70);
  fireEvent.click(screen.getByRole('button',{name:'保存进度'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(updateTask).toHaveBeenCalledTimes(2);
 });
 it('keeps others work and aggregate progress read-only',()=>{
  render(<ProgressCell task={task} locked lockedHint="主任务由子任务自动汇总"/>);
  expect(screen.queryByRole('button',{name:/编辑进度/})).toBeNull();expect(screen.getByRole('slider',{name:'进度'})).toHaveAttribute('aria-disabled','true');
 });
});

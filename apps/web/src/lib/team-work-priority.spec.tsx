import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRIORITIES, priorityMeta } from '../../../team-work/src/domain/types';
import { EXPORT_HEADERS } from '../../../team-work/src/domain/export';
import { PriorityCell } from '../../../team-work/src/components/TaskCells';
const { updateTask }=vi.hoisted(()=>({updateTask:vi.fn()}));
vi.mock('../../../team-work/src/store/AppProvider',()=>({useApp:()=>({updateTask})}));
describe('P-level priority presentation',()=>{
 it('matches the original sheet levels without changing persisted keys or sorting weights',()=>{
  expect(PRIORITIES.map(p=>[p.key,p.label,p.short,p.weight])).toEqual([['urgent','P0','P0',4],['high','P1','P1',3],['normal','P2','P2',2],['low','P3','P3',1]]);
  expect(EXPORT_HEADERS).toContain('优先级');expect(EXPORT_HEADERS).not.toContain('重要度');
 });
 it('shows a badge and saves a chosen P0 using the existing urgent value',()=>{
  render(<PriorityCell task={{id:'task',priority:'normal'} as any} canEdit/>);
  fireEvent.click(screen.getByRole('button',{name:'P2'}));
  expect(screen.getAllByRole('option').map(el=>el.textContent?.trim())).toEqual(['P0','P1','P2','P3']);
  fireEvent.click(screen.getByRole('option',{name:'P0'}));
  expect(updateTask).toHaveBeenCalledWith('task',{priority:'urgent'});
 });
 it('keeps read-only task priority disabled and falls back to P2 for an unknown value',()=>{
  render(<PriorityCell task={{id:'task',priority:'low'} as any} canEdit={false}/>);
  expect(screen.getByRole('button',{name:'P3'})).toBeDisabled();expect(priorityMeta('unknown' as any).label).toBe('P2');
 });
});

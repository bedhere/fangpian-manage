import {describe,expect,it} from 'vitest';
import {AiCenterRepository} from './ai-center.repository.js';
import {shanghaiToday} from '../trainees/trainee-policy.js';
const repo=new AiCenterRepository({} as never);
const row=(dateKey=shanghaiToday())=>({kind:'IVY',ownerId:'trainee',dateKey,status:'SUBMITTED',data:{}} as never);
const context=(canReadOwner:boolean)=>({actor:{id:'mentor'},scope:{isManager:false,canReadOwner:()=>canReadOwner,canReview:()=>canReadOwner}} as never);
describe('mentor access to saved Ivy (offline)',()=>{
 it('allows an authorized mentor to read today immediately',()=>{expect(repo.canRead(context(true),row())).toBe(true);});
 it('does not expose today to unrelated people',()=>{expect(repo.canRead(context(false),row())).toBe(false);});
 it('keeps today read-only for grading',()=>{expect(repo.canReviewRecord(context(true),row())).toBe(false);});
 it('preserves permission to review ended days',()=>{expect(repo.canRead(context(true),row('2020-01-01'))).toBe(true);expect(repo.canReviewRecord(context(true),row('2020-01-01'))).toBe(true);});
 it('does not expose future records to a mentor',()=>{expect(repo.canRead(context(true),row('2099-01-01'))).toBe(false);});
});

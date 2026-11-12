import { describe, expect, it } from 'vitest';
import { canApplyWithRestrictions } from './restriction-policy.js';

describe('project application restrictions', () => {
  it('blocks every application during an active application ban', () => {
    expect(canApplyWithRestrictions('P4',[{type:'PROJECT_APPLICATION_BLOCK',value:{},endsAt:new Date('2026-11-01')}],new Date('2026-10-05'))).toBe(false);
  });
  it('blocks only configured high project levels', () => {
    const restrictions=[{type:'HIGH_LEVEL_PROJECT_BLOCK' as const,value:{levels:['P0','P1']},endsAt:new Date('2026-11-01')}];
    expect(canApplyWithRestrictions('P1',restrictions,new Date('2026-10-05'))).toBe(false);
    expect(canApplyWithRestrictions('P3',restrictions,new Date('2026-10-05'))).toBe(true);
  });
});

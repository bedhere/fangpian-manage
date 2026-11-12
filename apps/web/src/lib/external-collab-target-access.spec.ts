import {describe,it,expect} from 'vitest';
const helperPath='@external-collab/target-access';
const {canEditDashboardTargets}=await import(/* @vite-ignore */ helperPath);
describe('dashboard target write scope',()=>{
 it('allows viewing team mates without granting target write or cache-migration permission',()=>{
  const leader={employeeName:'示例对客16',canViewAll:false,allowedEmployeeNames:['示例对客16','示例对客19']};
  expect(canEditDashboardTargets(leader,'示例对客16')).toBe(true);
  expect(canEditDashboardTargets(leader,'示例对客19')).toBe(false);
  expect(canEditDashboardTargets(leader,'示例开发01')).toBe(false);
 });
 it('preserves administrator editing across visible employees',()=>{
  expect(canEditDashboardTargets({employeeName:'示例开发01',canViewAll:true},'示例对客19')).toBe(true);
 });
});

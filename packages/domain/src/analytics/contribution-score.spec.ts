import { describe, expect, it } from 'vitest';
import { calculateContributionScore } from './contribution-score.js';

const weights={projectValue:25,grade:25,projectLevel:15,contribution:15,crossDepartment:10,onTime:5,aiEfficiency:5};
describe('configured contribution score',()=>{
  it('combines value, grade, level, collaboration and efficiency without counting projects only',()=>{
    expect(calculateContributionScore({projectValue:90,grade:'S',projectLevel:'P2',contributionPercent:80,crossDepartment:true,onTime:true,aiExecutionRatio:40},weights)).toBe(86);
  });
  it('rejects weights that do not total 100',()=>expect(()=>calculateContributionScore({projectValue:90,grade:'A',projectLevel:'P3',contributionPercent:100,crossDepartment:false,onTime:true,aiExecutionRatio:0},{...weights,aiEfficiency:4})).toThrow('CONTRIBUTION_WEIGHTS_MUST_TOTAL_100'));
});

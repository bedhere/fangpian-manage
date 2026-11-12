import { describe, expect, it } from 'vitest';
import { calculateProjectHealth, calculateTimeProgress } from './health-calculator.js';
const thresholds={yellowGap:20,redGap:35,redRiskLevel:3,yellowRiskLevel:2};
describe('project health calculator',()=>{
  it('calculates bounded time progress',()=>{expect(calculateTimeProgress(new Date('2026-01-06'),new Date('2026-01-01'),new Date('2026-01-11'))).toBe(50);expect(calculateTimeProgress(new Date('2026-01-20'),new Date('2026-01-01'),new Date('2026-01-11'))).toBe(100);});
  it('marks 80% time and 35% work as RED',()=>expect(calculateProjectHealth({timeProgress:80,workProgress:35,riskLevel:1,hasBlockers:false,overdueMilestones:0},thresholds).status).toBe('RED'));
  it('uses blockers and milestone lateness in a deterministic score',()=>{const result=calculateProjectHealth({timeProgress:50,workProgress:55,riskLevel:2,hasBlockers:true,overdueMilestones:1},thresholds);expect(result.status).toBe('YELLOW');expect(result.score).toBeLessThan(80);});
});

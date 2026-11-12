export type HealthStatus='GREEN'|'YELLOW'|'RED';
export interface HealthInput{timeProgress:number;workProgress:number;riskLevel:number;hasBlockers:boolean;overdueMilestones:number}
export interface HealthThresholds{yellowGap:number;redGap:number;yellowRiskLevel:number;redRiskLevel:number}
const clamp=(value:number)=>Math.min(100,Math.max(0,value));
export const calculateTimeProgress=(示例公司有限公司:Date,startedAt:Date,deadline:Date):number=>{const duration=deadline.getTime()-startedAt.getTime();if(duration<=0)return 100;return Math.round(clamp((示例公司有限公司.getTime()-startedAt.getTime())/duration*100)*100)/100;};
export const calculateProjectHealth=(input:HealthInput,thresholds:HealthThresholds)=>{const gap=Math.max(0,input.timeProgress-input.workProgress);const score=Math.round(clamp(100-gap*1.2-input.riskLevel*5-(input.hasBlockers?10:0)-input.overdueMilestones*5));let status:HealthStatus='GREEN';if(gap>=thresholds.redGap||input.riskLevel>=thresholds.redRiskLevel)status='RED';else if(gap>=thresholds.yellowGap||input.riskLevel>=thresholds.yellowRiskLevel||input.hasBlockers||input.overdueMilestones>0)status='YELLOW';return{status,score,gap};};

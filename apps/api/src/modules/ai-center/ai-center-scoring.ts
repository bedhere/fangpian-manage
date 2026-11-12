import type { AiRecord, CalendarData, ExceptionData, Grade, IvyData, NoteData, Review, TaskData } from './ai-center.types.js';
import { deliveryGroups, GROUPED_SCORE_RULE, LEGACY_SCORE_RULE, taskDeliveryGroup, type ScoreRule } from './ai-center-delivery-rules.js';

export type AiScoreComponent = { score:number|null; expected:number; reviewed:number; missing:number; detail:string; items?:unknown[]; groups?:{key:string;label:string;weight:number;score:number|null;expected:number;reviewed:number;missing:number}[] };
export type AiWeekScoreInput = {
 week:string; asOf:string; asOfTimestamp?:string; memberSince:string;
 calendarTimeline:{version:number;data:CalendarData}[];
 exceptions:{week:string;data:ExceptionData}[];
 tasks:AiRecord<TaskData>[]; ivy:AiRecord<IvyData>[]; notes:AiRecord<NoteData>[];
 unresolvedAppeals?:AiRecord[];
 rulesVersion?:ScoreRule;
};
const quality:Record<Grade,number>={S:100,A:85,B:70,C:50};
const weight:Record<Grade,number>={S:2,A:1.5,B:1,C:0.7};
const DAY=86400000, OFFSET=8*3600000;
const shift=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const localDay=(stamp:number)=>new Date(stamp+OFFSET).toISOString().slice(0,10);
const midnight=(day:string)=>Date.parse(day+'T00:00:00Z')-OFFSET;
function minute(clock:string) { const m=/^(\d{2}):(\d{2})$/.exec(clock);if(!m)return NaN;const h=Number(m[1]),n=Number(m[2]);return h<24&&n<60?h*60+n:NaN; }
function reviewFact(review?:Review) { return review?{grade:review.grade,reviewerId:review.reviewerId,reviewerName:review.reviewerName,reviewerRole:review.reviewerRole,reviewedAt:review.at,comment:review.comment}:{}; }
function component(expected:number,reviewed:number,missing:number,score:number|null,detail:string,items:unknown[]):AiScoreComponent { return {expected,reviewed,missing,score,detail,items}; }
/** Pure calculation: dates and rule configuration are supplied by the caller. No clocks or I/O. */
export function scoreAiWeek(input:AiWeekScoreInput) {
 const rulesVersion=input.rulesVersion??LEGACY_SCORE_RULE;
 const grouped=rulesVersion===GROUPED_SCORE_RULE;
 const {week,asOf,memberSince}=input;const end=shift(week,7),ended=asOf>=end;
 const exactNow=input.asOfTimestamp?Date.parse(input.asOfTimestamp):NaN;
 const pending:string[]=[];const add=(message:string)=>{if(!pending.includes(message))pending.push(message);};
 const timeline=[...input.calendarTimeline].sort((a,b)=>a.data.effectiveFrom.localeCompare(b.data.effectiveFrom)||a.version-b.version);
 const calendar=(day:string)=>{let selected:CalendarData|undefined;for(const row of timeline){if(row.data.effectiveFrom>day)break;selected=row.data;}return selected?.confirmed?selected:undefined;};
 const excluded=new Set(input.exceptions.flatMap(e=>e.data.dates));
 const appeals=new Set<string>();
 for(const a of input.unresolvedAppeals??[]) { const data=a.data as Record<string,unknown>;const id=typeof data.targetRecordId==='string'?data.targetRecordId:typeof data.recordId==='string'?data.recordId:a.parentId;if(id)appeals.add(id);add('存在尚未解决的复核申请，相关分数待核定'); }
 const workSegments=(c:CalendarData):[number,number][]|null=>{
  const start=minute(c.workStart),finish=minute(c.workEnd),bs=minute(c.breakStart),be=minute(c.breakEnd);
  if(![start,finish,bs,be].every(Number.isFinite)||start>=finish||bs>be)return null;
  const segments:[number,number][]=[];
  if(bs>=finish||be<=start)return [[start,finish]];
  if(bs>start)segments.push([start,Math.min(bs,finish)]);if(be<finish)segments.push([Math.max(be,start),finish]);
  return segments.length?segments:null;
 };
 const timeliness=(due:number,submitted:number):number|null=>{
  if(submitted<=due)return 100;
  let late=0;let day=localDay(due);const last=localDay(submitted);
  // Bound pathological date ranges; stop as soon as the final (>3 working days) bracket is known.
  for(let count=0;day<=last&&count<10000;count++,day=shift(day,1)) {
   if(excluded.has(day))continue;
   const c=calendar(day);if(!c)return null;
   if(!c.weekdays.includes(new Date(day+'T00:00:00Z').getUTCDay()))continue;
   const segments=workSegments(c);if(!segments)return null;
   const minutes=segments.reduce((sum,[a,b])=>sum+b-a,0);let elapsed=0;
   for(const [a,b] of segments)elapsed+=Math.max(0,Math.min(submitted,midnight(day)+b*60000)-Math.max(due,midnight(day)+a*60000))/60000;
   late+=elapsed/minutes;if(late>3)return 40;
  }
  if(day<=last)return null;
  return late<=1?80:late<=3?60:40;
 };
 let dExpected=0,dReviewed=0,dMissing=0,dSum=0,dWeights=0,dUnknown=false;
 const taskFacts:Record<string,unknown>[]=[];
 for(const task of input.tasks) {
  const d=task.data;const due=Date.parse(d.dueAt),dueDay=Number.isFinite(due)?localDay(due):null;
  const relevant=dueDay!==null&&dueDay>=week&&dueDay<end;
  const fact:Record<string,unknown>={id:task.id,title:d.title,status:task.status,sourceType:d.sourceType,sourceRecordId:d.sourceRecordId,dueAt:d.dueAt,dueDay,submittedAt:d.submittedAt,selfDifficulty:d.selfDifficulty,confirmedDifficulty:d.confirmedDifficulty,completionRatio:d.completionRatio,...reviewFact(d.review),included:false};
  taskFacts.push(fact);
  if(!d.approvedAt||!d.assigneeId||['DRAFT','OPEN','PROPOSED','DEFERRED','REJECTED','CANCELLED','CANCELED'].includes(task.status))continue;
  if(!Number.isFinite(due)){dUnknown=true;add(`任务「${d.title}」缺少有效交付日期，归属待核定`);continue;}
  // The current milestone contract has no per-milestone deadline/acceptance fields; never infer them from a completed boolean.
  if(d.milestones?.length&&relevant) {dUnknown=true;if(grouped)fact.pending='里程碑交付数据待核定';add(`任务「${d.title}」的里程碑缺少独立交付期及验收数据，待核定`);}
  if(!relevant)continue;
  dExpected++;fact.included=true;
  if(grouped){fact.deliveryGroup=taskDeliveryGroup(d);fact.targetUserId=d.targetUserId;fact.acquisitionMode=d.acquisitionMode;if(fact.deliveryGroup===null){dUnknown=true;add(`任务「${d.title}」原始来源待核定，暂不划入评分分组`);}}
  const w=d.confirmedDifficulty?weight[d.confirmedDifficulty]:undefined;
  if(w===undefined){dUnknown=true;add(`任务「${d.title}」确认难度待核定`);continue;}
  dWeights+=w;
  if(appeals.has(task.id)){dUnknown=true;fact.pending='复核处理中';continue;}
  const q=d.review?quality[d.review.grade]:undefined;
  const ratio=d.completionRatio??1;
  if(task.status==='COMPLETED'&&q!==undefined&&Number.isFinite(ratio)&&ratio>=0&&ratio<=1) {
   const submitted=Date.parse(d.submittedAt??'');
   if(!Number.isFinite(submitted)){dUnknown=true;add(`任务「${d.title}」首次达标提交时间待核定`);continue;}
   const t=ratio===0?100:timeliness(due,submitted);
   if(t===null){dUnknown=true;add(`任务「${d.title}」迟延区间的工作日历或豁免未确认`);continue;}
   const score=ratio*(q*0.8+t*0.2);dSum+=w*score;dReviewed++;fact.score=score;fact.timeliness=t;fact.weight=w;
  } else if((Number.isFinite(exactNow)?due<exactNow:dueDay!<asOf)&&!d.submittedAt&&!d.submission&&!['SUBMITTED','RETURNED','COMPLETED'].includes(task.status)) {
   dMissing++;fact.score=0;fact.missing=true;fact.reason='到期未提交任何可验收成果，规则0分';
  } else {dUnknown=true;fact.pending=(Number.isFinite(exactNow)?due>=exactNow:dueDay!>=asOf)?'交付期尚未结束':'交付验收待核定';add(`任务「${d.title}」${String(fact.pending)}`);}
 }
 const delivery=component(dExpected,dReviewed,dMissing,dExpected>0&&!dUnknown&&dWeights>0?dSum/dWeights:null,`D=Σ(确认难度权重×验收完成比例×(质量×80%+时效×20%))/Σ确认难度权重；应交${dExpected}项，已验收${dReviewed}项，确认未交${dMissing}项。${dExpected?'':'无本周应交任务，不适用。'}`,taskFacts);
 if(grouped){
  delivery.groups=deliveryGroups.map(group=>{
   const facts=taskFacts.filter(f=>f.included===true&&f.deliveryGroup===group.key);
   let sum=0,weights=0,unknown=false;
   for(const f of facts){const w=weight[f.confirmedDifficulty as Grade];if(w===undefined||typeof f.score!=='number'||f.pending){unknown=true;continue;}weights+=w;sum+=w*f.score;}
   return {...group,expected:facts.length,reviewed:facts.filter(f=>typeof f.score==='number'&&!f.missing).length,missing:facts.filter(f=>f.missing===true).length,score:facts.length===0?0:unknown||weights===0?null:sum/weights};
  });
  delivery.score=dUnknown||delivery.groups.some(g=>g.score===null)?null:delivery.groups.reduce((sum,g)=>sum+g.score!*g.weight,0);
  delivery.detail=`D=平时与艾维利任务组×50%+学习清单交付组×30%+公开抢领任务组×20%。各组沿用确认难度加权的验收完成比例×(质量80%+时效20%)；空组0分，固定权重不折算；待评或来源未知仍待核定。应交${dExpected}项，已验收${dReviewed}项，确认未交${dMissing}项。`;
 }
 let iExpected=0,iReviewed=0,iMissing=0,iSum=0,iUnknown=false;
 const ivyFacts:Record<string,unknown>[]=input.ivy.filter(r=>r.dateKey>=week&&r.dateKey<end).map(r=>({id:r.id,date:r.dateKey,status:r.status,version:r.version,...reviewFact(r.data.review),included:false}));
 for(let offset=0;offset<7;offset++) {
  const day=shift(week,offset);if(day<memberSince||day>=asOf||excluded.has(day))continue;
  const c=calendar(day);if(!c){iUnknown=true;add(`${day}工作日历未确认，日报应交要求待核定`);continue;}
  if(!c.weekdays.includes(new Date(day+'T00:00:00Z').getUTCDay()))continue;
  iExpected++;
  const row=input.ivy.filter(r=>r.dateKey===day).sort((a,b)=>b.version-a.version)[0];
  if(!row){iMissing++;ivyFacts.push({date:day,included:true,missing:true,score:0,reason:'应提交日已结束但未提交，规则0分'});continue;}
  const fact=ivyFacts.find(f=>f.id===row.id)!;fact.included=true;
  if(appeals.has(row.id)||row.status!=='REVIEWED'||!row.data.review||quality[row.data.review.grade]===undefined){iUnknown=true;fact.pending='导师评价待核定';add(`${day}日报已提交，评价待核定`);continue;}
  const score=quality[row.data.review.grade];iSum+=score;iReviewed++;fact.score=score;
 }
 const ivy=component(iExpected,iReviewed,iMissing,iExpected>0&&!iUnknown?iSum/iExpected:null,`I=应提交日人工评分之和/已结束的应提交日数；应交${iExpected}日，已评${iReviewed}日，缺交${iMissing}日。当天及未来日期不按缺交计分；休息、批准豁免和入驻前日期不入分母。`,ivyFacts);
 const exception=input.exceptions.filter(e=>e.week===week&&e.data.noteQuota!==null).at(-1);
 const quota=exception?.data.noteQuota??2;
 let lUnknown=false,lSum=0,lReviewed=0;
 const formal=input.notes.filter(n=>n.dateKey===week&&!!n.data.firstSubmittedAt);
 const isLate=(n:AiRecord<NoteData>)=>Date.parse(n.data.firstSubmittedAt??'')>=midnight(end);
 const countedFormal=formal.filter(n=>!isLate(n)||n.data.lateReview?.countInOriginalWeek===true);
 const noteFacts:Record<string,unknown>[]=input.notes.filter(n=>n.dateKey===week).map(n=>({id:n.id,title:n.data.title,status:n.status,version:n.version,firstSubmittedAt:n.data.firstSubmittedAt,submittedAt:n.data.submittedAt,formal:!!n.data.firstSubmittedAt,lateFirstSubmission:!!n.data.firstSubmittedAt&&isLate(n),lateReview:n.data.lateReview,countInOriginalWeek:!!n.data.firstSubmittedAt&&(!isLate(n)||n.data.lateReview?.countInOriginalWeek===true),actionCount:n.data.actions.length,...reviewFact(n.data.review)}));
 if(memberSince>week&&!exception){lUnknown=true;add('本周非完整培养周，学习笔记要求须主管确认减免');}
 if(!exception&&input.exceptions.some(e=>e.week===week&&e.data.dates.some(day=>day>=memberSince&&day>=week&&day<end&&calendar(day)?.weekdays.includes(new Date(day+'T00:00:00Z').getUTCDay())))){lUnknown=true;add('本周有批准的工作日请假，学习笔记要求须主管明确核定为0、1或2篇');}
 if(!ended&&countedFormal.length<quota){lUnknown=true;add('本周尚未结束，学习笔记缺交事实尚未确定');}
 for(const n of formal) {
  const f=noteFacts.find(x=>x.id===n.id)!;
  if(!Number.isFinite(Date.parse(n.data.firstSubmittedAt??''))){lUnknown=true;f.pending='首次提交时间待核定';add(`学习笔记「${n.data.title}」首次提交时间待核定`);continue;}
  if(isLate(n)&&!n.data.lateReview){lUnknown=true;f.pending='跨周首次补交须确认是否调整原周缺交事实';add(`学习笔记「${n.data.title}」跨周首次补交，原周归属复核待核定`);continue;}
  if(isLate(n)&&n.data.lateReview?.countInOriginalWeek===false){f.excludedReason='跨周首次补交未获准调整原周缺交事实';continue;}
  if(appeals.has(n.id)||n.status!=='REVIEWED'||!n.data.review||quality[n.data.review.grade]===undefined||n.data.actions.length<2){lUnknown=true;f.pending='当前版本计划质量待核定';add(`学习笔记「${n.data.title}」当前版本评价待核定`);continue;}
  const score=quality[n.data.review.grade];lSum+=score;lReviewed++;f.score=score;
 }
 const lExpected=Math.max(quota,countedFormal.length),lMissing=ended?Math.max(0,quota-countedFormal.length):0;
 const learning=component(lExpected,lReviewed,lMissing,lExpected>0&&!lUnknown?lSum/lExpected:null,`L=原周计入笔记计划质量分之和/max(本周要求${quota}篇,原周计入篇数${countedFormal.length})；已评${lReviewed}篇，截止缺交${lMissing}篇。及时首交后的修订保留原周事实；跨周首次补交须明确复核才调整原周缺交，行动交付另计入D。${lExpected?'':'本周已豁免且无正式笔记，不适用。'}`,noteFacts);
 if(!ended)add('本周尚未结束，当前明细为阶段性事实，不生成完整周总分');
 // A full weekly score also requires the rule calendar to have been confirmed for every eligible day.
 for(let n=0;n<7;n++){const day=shift(week,n);if(day>=memberSince&&!excluded.has(day)&&!calendar(day))add(`${day}工作日历未确认，完整周评分待核定`);}
 const total=ended&&pending.length===0&&delivery.score!==null&&ivy.score!==null&&learning.score!==null?delivery.score*0.6+ivy.score*0.25+learning.score*0.15:null;
 const suggestedRating=total===null?null:total>=95?'S':total>=90?'A+':total>=80?'A':total>=70?'A-':total>=60?'B':'C';
 return {components:{delivery,ivy,learning},total,suggestedRating,pending,facts:{tasks:taskFacts,ivy:ivyFacts,notes:noteFacts},rulesVersion};
}

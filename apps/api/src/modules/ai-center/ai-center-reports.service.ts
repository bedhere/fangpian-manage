import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import type { RequestUser } from '../auth/auth.types.js';
import { shanghaiToday } from '../trainees/trainee-policy.js';
import { AiCenterRepository, dayShift, validDay, weekStart } from './ai-center.repository.js';
import { scoreAiWeek } from './ai-center-scoring.js';
import { weeklyScoreRule } from './ai-center-delivery-rules.js';
import type { AiContext, CalendarData, ExceptionData, IvyData, NoteData, TaskData } from './ai-center.types.js';

@Injectable()
export class AiCenterReportsService {
  constructor(@Inject(AiCenterRepository) readonly repo:AiCenterRepository) {}
  async build(ctx:AiContext,userId:string,week:string) {
    if(!validDay(week)||weekStart(week)!==week)throw new BadRequestException('请选择周一作为周起始日期');
    const member=ctx.scope.members.get(userId);
    if(!member||!ctx.scope.canReadOwner(userId))throw new ForbiddenException('无权查看该管培生周报告');
    const [rawTasks,rawIvy,rawNotes,calendars,exceptions,appeals]=await Promise.all([
      this.repo.list<TaskData>(ctx,'TASK',{ownerId:userId}),this.repo.list<IvyData>(ctx,'IVY',{ownerId:userId,dateKey:{gte:week,lte:dayShift(week,6)}}),this.repo.list<NoteData>(ctx,'NOTE',{ownerId:userId,dateKey:week}),this.repo.list<CalendarData>(ctx,'CALENDAR'),this.repo.list<ExceptionData>(ctx,'EXCEPTION',{ownerId:userId}),this.repo.list(ctx,'APPEAL',{ownerId:userId,status:'PENDING'}),
    ]);
    const localDay=(s:string)=>{const n=Date.parse(s);return Number.isFinite(n)?new Date(n+8*3600000).toISOString().slice(0,10):'';};
    const inWeek=(s:string)=>s>=week&&s<=dayShift(week,6);
    const tasks=rawTasks.filter(t=>this.repo.canRead(ctx,t)&&(inWeek(localDay(t.data.dueAt))||inWeek(localDay(t.data.submittedAt??''))||inWeek(localDay(t.data.approvedAt??''))||inWeek(localDay(t.createdAt.toISOString()))));
    const ivy=rawIvy.filter(r=>this.repo.canRead(ctx,r));
    const notes=[] as typeof rawNotes;
    for(const n of rawNotes){
      if(this.repo.canRead(ctx,n)){notes.push(n);continue;}
      if(n.status==='DRAFT'&&n.data.firstSubmittedAt&&n.ownerId!==ctx.actor.id){
        const prior=await ctx.tx.aiCenterHistory.findFirst({where:{recordId:n.id,OR:[{snapshot:{path:['status'],equals:'SUBMITTED'}},{snapshot:{path:['status'],equals:'REVIEWED'}},{snapshot:{path:['status'],equals:'RETURNED'}}]},orderBy:{version:'desc'},select:{snapshot:true}});
        const old=(prior?.snapshot as {data?:NoteData}|undefined)?.data;
        if(old){const {review:_review,...safe}=old;notes.push({...n,data:{...safe,firstSubmittedAt:n.data.firstSubmittedAt}});}
      }
    }
    const calendar=calendars[0];
    const histories=calendar?await ctx.tx.aiCenterHistory.findMany({where:{recordId:calendar.id},orderBy:{version:'asc'},select:{version:true,snapshot:true}}):[];
    const calendarTimeline=histories.map(h=>({version:h.version,data:(h.snapshot as {data:unknown}).data as CalendarData}));
    const relevantIds=new Set([...ivy,...notes].map(r=>r.id));
    for(const t of tasks){const due=Date.parse(t.data.dueAt);if(t.data.approvedAt&&Number.isFinite(due)){const d=new Date(due+8*3600000).toISOString().slice(0,10);if(d>=week&&d<=dayShift(week,6))relevantIds.add(t.id);}}
    const plan=await ctx.tx.traineeGrowthPlan.findFirst({where:{organizationId:ctx.actor.organizationId,traineeId:userId,periodStart:new Date(week+'T00:00:00Z')},select:{status:true,revisions:{orderBy:{version:'asc'},select:{snapshot:true}}}});
    const rulesVersion=weeklyScoreRule(week,plan?.revisions.map(r=>r.snapshot)??[],plan?.status==='PUBLISHED');
    const result=scoreAiWeek({rulesVersion,week,asOf:shanghaiToday(),asOfTimestamp:new Date().toISOString(),memberSince:member.data.sinceDate,calendarTimeline,exceptions:exceptions.map(e=>({week:e.dateKey,data:e.data})),tasks,ivy,notes,unresolvedAppeals:appeals.filter(a=>!!a.parentId&&relevantIds.has(a.parentId))});
    for(const fact of result.facts.tasks){const task=tasks.find(t=>t.id===fact.id);if(task)Object.assign(fact,{recordVersion:task.version,description:task.data.description,acceptanceCriteria:task.data.acceptanceCriteria,submission:task.data.submission,evidence:task.data.evidence,submissionFileIds:task.data.submissionFileIds,sourceVersion:task.data.sourceVersion});}
    const fileIds=[...new Set([...tasks.flatMap(t=>t.data.submissionFileIds??[]),...notes.flatMap(n=>n.data.fileIds??[])])];
    const attachments=fileIds.length?await ctx.tx.aiCenterFile.findMany({where:{id:{in:fileIds},record:{organizationId:ctx.actor.organizationId},status:'READY'},select:{id:true,recordId:true,filename:true,size:true,createdAt:true}}):[];
    return {week,traineeId:userId,traineeName:ctx.scope.user(userId)?.name??'历史成员',...result,attachments:attachments.map(f=>({...f,size:Number(f.size),createdAt:f.createdAt.toISOString()})),evidenceVersions:[...tasks,...ivy,...notes].map(r=>({id:r.id,kind:r.kind,version:r.version,updatedAt:r.updatedAt.toISOString()}))};
  }
  async report(actor:RequestUser,id:string,week=weekStart()) {
    return this.repo.withActor(actor,async ctx=>{
      const report=await this.build(ctx,id,week);
      if(id!==actor.id)return {audience:'MENTOR' as const,...report};
      const plan=await ctx.tx.traineeGrowthPlan.findFirst({where:{organizationId:actor.organizationId,traineeId:id,periodStart:new Date(week+'T00:00:00Z'),periodEnd:{lte:new Date(dayShift(week,6)+'T00:00:00Z')},status:'PUBLISHED'},select:{rating:true},orderBy:{updatedAt:'desc'}});
      const counts=(c:{expected:number;reviewed:number;missing:number})=>({expected:c.expected,reviewed:c.reviewed,missing:c.missing});
      return {audience:'TRAINEE' as const,week,traineeId:id,traineeName:report.traineeName,components:{delivery:counts(report.components.delivery),ivy:counts(report.components.ivy),learning:counts(report.components.learning)},finalRating:plan?.rating??null};
    },false);
  }
  async apply(actor:RequestUser,id:string,input:{week:string;expectedVersion?:number;replace:boolean}) {
    return this.repo.withActor(actor,async ctx=>{
      if(!ctx.scope.canReview(id))throw new ForbiddenException('仅对应导师、上级或主管可生成成长草稿');
      const report=await this.build(ctx,id,input.week);
      const profile=await ctx.tx.traineeProfile.findFirst({where:{userId:id,organizationId:actor.organizationId},select:{userId:true}});if(!profile)throw new BadRequestException('管培生档案不存在');
      const start=new Date(input.week+'T00:00:00Z'),end=new Date(dayShift(input.week,6)+'T00:00:00Z');
      const old=await ctx.tx.traineeGrowthPlan.findFirst({where:{organizationId:actor.organizationId,traineeId:id,periodStart:start}});
      if(old&&(!input.replace||old.version!==input.expectedVersion))throw new ConflictException('本周已有成长计划，请核对已有版本并明确确认替换');
      if(old&&old.periodEnd.getTime()!==end.getTime())throw new ConflictException('已有周计划周期不同，保留原始成稿，不覆盖历史周期');
      if(old?.analysisRequestKey&&old.analysisStartedAt&&old.analysisStartedAt.getTime()>Date.示例公司有限公司()-5*60000)throw new ConflictException('会议材料正在分析，暂不能覆盖草稿');
      const taskFacts=report.facts.tasks as {title?:unknown;status?:unknown;grade?:unknown;score?:unknown;included?:boolean}[];
      const achievements=taskFacts.filter(t=>t.status==='COMPLETED'&&t.included===true).map(t=>`- ${String(t.title)}；验收${String(t.grade??'待核定')}`);
      const coverage=([['delivery','任务交付'],['ivy','艾维利'],['learning','学习笔记']] as const).map(([key,label])=>{const c=report.components[key];return `${label}：应交${c.expected}、已评${c.reviewed}、缺交${c.missing}`;}).join('；');
      const fields={departmentText:'AI中台',workResults:[`统计周期：${input.week} 至 ${dayShift(input.week,6)}`,achievements.join('\n')||'本周暂无已完成验收的任务；不根据示例公司有限公司进度推算完成成果。',coverage].join('\n\n'),strengths:achievements.length?`已完成以下经导师确认的交付：\n${achievements.join('\n')}`:'暂无已核定的突出交付证据，请结合会议材料由导师评价。',shortfalls:coverage+'。请导师结合真实业务填写不足和改进方向。',growthAdvice:'结合任务验收、艾维利复盘与学习笔记反馈完善下一周计划。具体建议由导师结合会议讨论填写。',nextAssessment:'继续推进已承诺任务；按工作日历保存艾维利；完成每周至少2篇学习笔记，每篇至少2项有价值的行动建议，豁免以主管确认记录为准。',archiveComment:'本周成长记录已汇总，综合评级由导师核对后发布。'};
      let plan;
      if(old){const changed=await ctx.tx.traineeGrowthPlan.updateMany({where:{id:old.id,version:old.version},data:{...fields,status:'DRAFT',publishedAt:null,updatedBy:actor.id,version:{increment:1},analysisRequestKey:null,analysisStartedAt:null}});if(changed.count!==1)throw new ConflictException('成长计划已被修改');plan=await ctx.tx.traineeGrowthPlan.findUniqueOrThrow({where:{id:old.id}});}
      else plan=await ctx.tx.traineeGrowthPlan.create({data:{...fields,organizationId:actor.organizationId,traineeId:id,periodStart:start,periodEnd:end,createdBy:actor.id,updatedBy:actor.id,status:'DRAFT'}});
      await ctx.tx.traineeGrowthRevision.create({data:{planId:plan.id,version:plan.version,editorId:actor.id,snapshot:{...fields,rating:plan.rating,status:'DRAFT',periodStart:input.week,periodEnd:dayShift(input.week,6),reportVersion:report.rulesVersion} as Prisma.InputJsonValue}});
      const source={source:'AI_CENTER_REPORT',suggestedRating:report.suggestedRating,report};
      const content=Buffer.from(JSON.stringify({traineeName:report.traineeName,...source},null,2));
      await ctx.tx.traineeGrowthSource.create({data:{planId:plan.id,uploaderId:actor.id,filename:'AI中台周记录汇总.json',mimeType:'application/json',contentHash:(await import('node:crypto')).createHash('sha256').update(content).digest('hex'),content:new Uint8Array(content),textContent:content.toString(),status:'ANALYZED',requestKey:crypto.randomUUID(),result:source as unknown as Prisma.InputJsonValue}});
      return {id:plan.id,version:plan.version,status:plan.status};
    });
  }
}

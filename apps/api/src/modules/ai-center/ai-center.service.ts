import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@value-flow/db';
import type { RequestUser } from '../auth/auth.types.js';
import { shanghaiToday } from '../trainees/trainee-policy.js';
import { AI_DEPARTMENT_ID, MENTOR_APPROVER_ID, AiCenterRepository, dayShift, grade, isoDate, text, validDay, weekStart } from './ai-center.repository.js';
import { dataOf, type AiContext, type AiRecord, type CalendarData, type ExceptionData, type IvyData, type MemberData, type NoteData, type Review, type TaskData } from './ai-center.types.js';
import { growthPublicAppeal, growthPublicText } from './growth-public-text.js';
import { sameMentorConfiguration, validateMentorSelection } from './mentor-policy.js';
import { loadTaskIvyDays } from './ai-center-ivy-tasks.js';
import { IvyWecomService } from './ivy-wecom.service.js';

@Injectable()
export class AiCenterService {
  constructor(@Inject(AiCenterRepository) readonly repo:AiCenterRepository,@Inject(IvyWecomService) readonly wecom:IvyWecomService) {}
  async workspace(actor:RequestUser,selectedWeek?:string) {
    const week=selectedWeek??weekStart();if(!validDay(week)||weekStart(week)!==week)throw new BadRequestException('请选择周一日期');
    return this.repo.withActor(actor,async ctx=>{
      const members=await this.repo.list<MemberData>(ctx,'MEMBER');
      const tasks=await this.repo.list<TaskData>(ctx,'TASK');
      const ivy=await this.repo.list<IvyData>(ctx,'IVY',{OR:[{dateKey:{gte:week,lte:dayShift(week,6)}},{dateKey:{lt:shanghaiToday()},status:{not:'REVIEWED'}}]});
      const notes=await this.repo.list<NoteData>(ctx,'NOTE',{OR:[{dateKey:week},{status:'SUBMITTED'}]});
      const links=await this.repo.list(ctx,'LINK',{status:'PENDING'});
      const appeals=await this.repo.list(ctx,'APPEAL',{status:'PENDING'});
      const calendars=await this.repo.list<CalendarData>(ctx,'CALENDAR');
      const filter=<T>(rows:AiRecord<T>[])=>rows.filter(row=>this.repo.canRead(ctx,row)).map(row=>this.repo.view(ctx,row));
      const inbox=await ctx.tx.notification.findMany({where:{userId:actor.id,entityType:'AI_CENTER'},orderBy:{createdAt:'desc'},take:60});
      const ivyTasks={...await loadTaskIvyDays(ctx,week,tasks,ivy),...await this.wecom.summaries(ctx,ivy)};
      return {...ivyTasks,serverDate:shanghaiToday(),week,aiDepartmentId:AI_DEPARTMENT_ID,mentorApprover:{id:MENTOR_APPROVER_ID,name:ctx.scope.user(MENTOR_APPROVER_ID)?.name??'AI中台总负责人',available:ctx.scope.mentorApproverAvailable},user:{id:actor.id,name:ctx.scope.self.name,isManager:ctx.scope.isManager,isTrainee:ctx.scope.isTrainee,isAiStaff:ctx.scope.isAiStaff,isMentor:ctx.scope.isMentor,canApproveMentors:ctx.scope.canApproveMentors},
        taskRequestReviewers:ctx.scope.isTrainee?ctx.scope.mentorIds(actor.id).filter(id=>id!==actor.id).map(id=>({id,name:ctx.scope.user(id)?.name??'导师'})):[],people:[...ctx.scope.users.values()].filter(u=>u.active),members:filter(members),tasks:filter(tasks.filter(t=>t.data.sourceType==='SELF'&&!t.data.approvedAt||!['COMPLETED','CANCELLED','REJECTED'].includes(t.status)||t.data.dueAt.slice(0,10)>=week&&t.data.dueAt.slice(0,10)<=dayShift(week,6))),ivy:filter(ivy),notes:filter(notes),links:filter(links),appeals:filter(appeals),calendar:calendars[0]?this.repo.view(ctx,calendars[0]):null,inbox};
    },false);
  }
  async record(actor:RequestUser,id:string) { return this.repo.withActor(actor,async ctx=>this.repo.view(ctx,await this.repo.get(ctx,id)),false); }
  async history(actor:RequestUser,id:string) {
    return this.repo.withActor(actor,async ctx=>{const row=await this.repo.get(ctx,id);this.repo.assertRead(ctx,row);if(['MANAGER','MEMBER','CALENDAR'].includes(row.kind)&&!ctx.scope.isManager)throw new ForbiddenException('仅主管可查看人员配置审计');const history=await ctx.tx.aiCenterHistory.findMany({where:{recordId:id},orderBy:{version:'desc'}});return row.kind==='APPEAL'&&row.ownerId===actor.id?history.map(h=>{const snapshot=h.snapshot as {data?:Prisma.JsonValue};return {...h,snapshot:{...snapshot,data:growthPublicAppeal(snapshot.data)}};}):history;},false);
  }
  async member(actor:RequestUser,id:string,input:{version:number;aiMentorId:string|null;departmentMentorIds:string[];active:boolean}) {
    return this.repo.withActor(actor,async ctx=>{
      if(!ctx.scope.isManager)throw new ForbiddenException('仅AI中台主管可安排导师');
      if(id===actor.id)throw new ForbiddenException('本人导师配置须提交申请，由指定AI中台总负责人审批');
      const rows=await this.repo.list<MemberData>(ctx,'MEMBER',{ownerId:id});const row=rows[0];if(!row)throw new BadRequestException('该成员尚未纳入AI管培生');
      validateMentorSelection(ctx,id,input.aiMentorId,input.departmentMentorIds,input.active);
      const ids=[input.aiMentorId,...input.departmentMentorIds].filter((x):x is string=>!!x);
      const superseded=row.data.mentorRequest?.status==='PENDING'&&!sameMentorConfiguration(row.data,input);
      const data:MemberData={...row.data,aiMentorId:input.aiMentorId,departmentMentorIds:input.departmentMentorIds,active:input.active,...(superseded?{mentorRequest:{...row.data.mentorRequest!,status:'SUPERSEDED' as const,reviewerId:actor.id,reviewerName:ctx.scope.self.name,reviewedAt:new Date().toISOString(),decisionComment:'管理端已直接修改生效导师配置，原申请不再覆盖新配置；需要时请重新申请。'}}:{})};
      const next=await this.repo.update(ctx,row,input.version,{data,status:input.active?'ACTIVE':'INACTIVE'});
      if(input.aiMentorId&&input.departmentMentorIds.length)await ctx.tx.traineeProfile.updateMany({where:{userId:id,organizationId:actor.organizationId},data:{mentorId:input.aiMentorId}});
      if(superseded){await this.repo.resolveNotifications(ctx,row.id);await this.repo.notify(ctx,next,'导师配置申请已失效','原配置已由管理端更新',[id,MENTOR_APPROVER_ID]);}
      await this.repo.notify(ctx,next,'导师关系已更新','MENTOR_CHANGED',[id,...ids]);
      return this.repo.view(ctx,next);
    });
  }
  async enroll(actor:RequestUser,userId:string) {
    return this.repo.withActor(actor,async ctx=>{
      if(!ctx.scope.isManager)throw new ForbiddenException('仅主管示例品牌入AI管培生');
      const user=ctx.scope.user(userId);if(!user?.active)throw new BadRequestException('请选择本组织有效账号');
      if(ctx.scope.members.has(userId))throw new ConflictException('该成员已纳入管培生，请编辑原记录');
      const dept=await ctx.tx.department.findFirst({where:{id:AI_DEPARTMENT_ID,organizationId:actor.organizationId,status:'ACTIVE',deletedAt:null},select:{id:true}});if(!dept)throw new BadRequestException('AI中台部门无效');
      const old=await ctx.tx.traineeProfile.findFirst({where:{userId,organizationId:actor.organizationId},select:{mentorId:true}});
      await ctx.tx.traineeProfile.upsert({where:{userId},create:{userId,organizationId:actor.organizationId},update:{}});
      const row=await this.repo.create<MemberData>(ctx,{kind:'MEMBER',ownerId:userId,status:'ACTIVE',data:{active:true,sinceDate:shanghaiToday(),aiMentorId:null,departmentMentorIds:[],legacyMentorId:old?.mentorId??null,originalDepartmentId:user.departmentId}});
      await ctx.tx.user.updateMany({where:{id:userId,organizationId:actor.organizationId,deletedAt:null},data:{departmentId:dept.id}});
      await ctx.tx.auditLog.create({data:{organizationId:actor.organizationId,actorId:actor.id,entityType:'User',entityId:userId,action:'AI_TRAINEE_ENROLLED',before:{departmentId:user.departmentId},after:{departmentId:dept.id,memberRecordId:row.id}}});
      return this.repo.view(ctx,row);
    });
  }
  async calendar(actor:RequestUser,input:Omit<CalendarData,'effectiveFrom'>&{version?:number}) {
    return this.repo.withActor(actor,async ctx=>{
      if(!ctx.scope.isManager)throw new ForbiddenException('仅主管可设置工作日历');
      if(!input.weekdays.length||input.weekdays.length>7||new Set(input.weekdays).size!==input.weekdays.length||input.weekdays.some(x=>!Number.isInteger(x)||x<0||x>6))throw new BadRequestException('请选择有效工作日');
      const times=[input.workStart,input.workEnd,input.breakStart,input.breakEnd];
      if(times.some(x=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(x))||input.workStart>=input.workEnd||input.breakStart<input.workStart||input.breakEnd>input.workEnd||input.breakStart>input.breakEnd)throw new BadRequestException('工作及休息时段无效');
      const rows=await this.repo.list<CalendarData>(ctx,'CALENDAR');const old=rows[0];
      const hadConfirmed=old?await ctx.tx.aiCenterHistory.count({where:{recordId:old.id,snapshot:{path:['data','confirmed'],equals:true}}}):0;
      const effectiveFrom=hadConfirmed?([dayShift(shanghaiToday(),1),old!.data.effectiveFrom].sort().at(-1)!):shanghaiToday();
      const data:CalendarData={confirmed:input.confirmed,weekdays:input.weekdays,workStart:input.workStart,workEnd:input.workEnd,breakStart:input.breakStart,breakEnd:input.breakEnd,effectiveFrom};
      const row=old?await this.repo.update(ctx,old,input.version??0,{data}):await this.repo.create(ctx,{kind:'CALENDAR',dateKey:'GLOBAL',status:'ACTIVE',data});return this.repo.view(ctx,row);
    });
  }
  async exception(actor:RequestUser,id:string,input:{week:string;dates:string[];noteQuota?:number;reason:string}) {
    return this.repo.withActor(actor,async ctx=>{
      if(!ctx.scope.isManager||!ctx.scope.members.has(id))throw new ForbiddenException('仅主管可设置管培生豁免');
      if(!validDay(input.week)||weekStart(input.week)!==input.week||input.dates.length>7||input.dates.some(d=>!validDay(d)||d<input.week||d>dayShift(input.week,6)))throw new BadRequestException('豁免日期须在选定周内');
      if(input.noteQuota!==undefined&&![0,1,2].includes(input.noteQuota))throw new BadRequestException('本周笔记要求只能为0、1或2篇');
      const data:ExceptionData={dates:[...new Set(input.dates)],noteQuota:input.noteQuota??null,reason:text(input.reason,'豁免原因',1000),reviewerId:actor.id,reviewerName:ctx.scope.self.name};
      const old=(await this.repo.list<ExceptionData>(ctx,'EXCEPTION',{ownerId:id,dateKey:input.week}))[0];
      if(old&&(data.noteQuota??2)>(old.data.noteQuota??2)&&input.week<weekStart())throw new BadRequestException('不能追溯提高历史周学习要求');
      if(old&&old.data.dates.some(d=>d<shanghaiToday()&&!data.dates.includes(d)))throw new BadRequestException('不能通过普通设置追溯取消已生效的历史日期豁免');
      const row=old?await this.repo.update(ctx,old,old.version,{data}):await this.repo.create(ctx,{kind:'EXCEPTION',ownerId:id,dateKey:input.week,status:'ACTIVE',data});return this.repo.view(ctx,row);
    });
  }
  async appeal(actor:RequestUser,id:string,input:{version:number;reason:string}) {
    return this.repo.withActor(actor,async ctx=>{
      const target=await this.repo.get(ctx,id,['TASK','IVY','NOTE']);this.repo.assertRead(ctx,target);
      if(target.ownerId!==actor.id)throw new ForbiddenException('仅本人可对自己的记录提出复核');
      if(target.version!==input.version)throw new ConflictException('记录已变更，请刷新');
      const old=await this.repo.list(ctx,'APPEAL',{parentId:id,status:'PENDING'});if(old.length)throw new ConflictException('该记录已有待处理复核');
      const previous=(target.data as {review?:Review}).review?.reviewerId;
      const task=target.data as Partial<TaskData>;const excludedReviewerIds=[...new Set([previous,task.approvedBy,task.decisionBy].filter((v):v is string=>!!v))];
      if(!previous&&!task.approvedBy&&!task.decisionBy)throw new BadRequestException('当前记录尚无可复核结论，请先提交导师审核');
      const row=await this.repo.create(ctx,{kind:'APPEAL',ownerId:actor.id,parentId:id,status:'PENDING',data:{reason:text(input.reason,'复核原因',2000),recordVersion:target.version,targetVersion:target.version,targetRecordId:target.id,targetKind:target.kind,excludedReviewerIds,targetSnapshot:{kind:target.kind,status:target.status,data:target.data}}});
      await this.repo.notify(ctx,row,'有新的评分/难度复核申请','APPEAL_REQUEST',ctx.scope.reviewerIds(actor.id).filter(x=>!excludedReviewerIds.includes(x)));return this.repo.view(ctx,row);
    });
  }
  async growthTargets(actor:RequestUser,id?:string) {
    return this.repo.withActor(actor,async ctx=>{
      const rows=await ctx.tx.traineeGrowthPlan.findMany({where:{organizationId:actor.organizationId,status:'PUBLISHED',...(id?{id}:{})},orderBy:{periodStart:'desc'}});
      const visible=rows.filter(p=>ctx.scope.members.has(p.traineeId)&&ctx.scope.canReadOwner(p.traineeId));
      if(id&&!visible.length)throw new NotFoundException('已发布周成长计划不存在或无权查看');
      return visible.map(p=>({id:p.id,kind:'GROWTH',ownerId:p.traineeId,ownerName:ctx.scope.user(p.traineeId)?.name??'历史成员',dateKey:isoDate(p.periodStart),status:p.status,version:p.version,data:{rating:p.rating,archiveComment:p.traineeId===actor.id?growthPublicText(p.archiveComment):p.archiveComment,periodStart:isoDate(p.periodStart),periodEnd:isoDate(p.periodEnd),updatedBy:p.updatedBy},canEdit:false,canReview:ctx.scope.canReview(p.traineeId),createdAt:p.createdAt.toISOString(),updatedAt:p.updatedAt.toISOString()}));
    },false);
  }
  async appealGrowth(actor:RequestUser,id:string,input:{version:number;reason:string}) {
    return this.repo.withActor(actor,async ctx=>{
      const plan=await ctx.tx.traineeGrowthPlan.findFirst({where:{id,organizationId:actor.organizationId,traineeId:actor.id,status:'PUBLISHED'}});
      if(!plan||!ctx.scope.isTrainee)throw new NotFoundException('仅本人可复核自己的已发布周评级');
      if(plan.version!==input.version)throw new ConflictException('计划已变更，请刷新后核对');
      const old=await this.repo.list(ctx,'APPEAL',{status:'PENDING',data:{path:['targetRecordId'],equals:id}});if(old.length)throw new ConflictException('该周计划已有待处理复核');
      const row=await this.repo.create(ctx,{kind:'APPEAL',ownerId:actor.id,dateKey:isoDate(plan.periodStart),status:'PENDING',data:{reason:text(input.reason,'复核原因',2000),recordVersion:plan.version,targetVersion:plan.version,targetRecordId:id,targetKind:'GROWTH',excludedReviewerIds:[plan.updatedBy],targetSnapshot:{kind:'GROWTH',status:plan.status,data:{rating:plan.rating,archiveComment:plan.archiveComment,periodStart:isoDate(plan.periodStart),periodEnd:isoDate(plan.periodEnd)}}}});
      await this.repo.notify(ctx,row,'周成长评级待独立复核','GROWTH_RATING_APPEAL',ctx.scope.reviewerIds(actor.id).filter(x=>x!==plan.updatedBy));return this.repo.view(ctx,row);
    });
  }
  async resolveAppeal(actor:RequestUser,id:string,input:{version:number;targetVersion:number;decision:'UPHOLD'|'CHANGE'|'REOPEN';comment:string;grade?:string;confirmedDifficulty?:string;dueAt?:string}) {
    return this.repo.withActor(actor,async ctx=>{
      const appeal=await this.repo.get<Record<string,unknown>>(ctx,id,'APPEAL');this.repo.assertReview(ctx,appeal);
      if(appeal.status!=='PENDING')throw new ConflictException('复核已处理');
      if(appeal.data.targetKind==='GROWTH') {
        const plan=await ctx.tx.traineeGrowthPlan.findFirst({where:{id:String(appeal.data.targetRecordId),organizationId:actor.organizationId,traineeId:appeal.ownerId!,status:'PUBLISHED'}});
        if(!plan||plan.version!==input.targetVersion)throw new ConflictException('原计划已变更或未发布，请重新核对');
        if(plan.updatedBy===actor.id)throw new ForbiddenException('请由另一位有权限的导师或主管复核原评级');
        if(input.decision==='REOPEN'||input.confirmedDifficulty||input.dueAt)throw new BadRequestException('周评级复核仅支持维持或调整六档评级');
        const comment=text(input.comment,'周评级复核依据',2000);
        if(input.decision==='CHANGE') {
          if(!['S','A+','A','A-','B','C'].includes(input.grade??''))throw new BadRequestException('请选择六档成长评级');
          const archiveComment=plan.archiveComment+'\n\n周评级复核：'+ctx.scope.self.name+' · '+new Date().toISOString()+'\n'+comment;
          const changed=await ctx.tx.traineeGrowthPlan.updateMany({where:{id:plan.id,organizationId:actor.organizationId,version:input.targetVersion},data:{rating:input.grade as 'S'|'A+'|'A'|'A-'|'B'|'C',archiveComment,updatedBy:actor.id,version:{increment:1}}});
          if(changed.count!==1)throw new ConflictException('计划已被其他人修改');
          const next=await ctx.tx.traineeGrowthPlan.findUniqueOrThrow({where:{id:plan.id}});
          await ctx.tx.traineeGrowthRevision.create({data:{planId:next.id,version:next.version,editorId:actor.id,snapshot:{rating:next.rating,departmentText:next.departmentText,workResults:next.workResults,strengths:next.strengths,shortfalls:next.shortfalls,growthAdvice:next.growthAdvice,nextAssessment:next.nextAssessment,archiveComment:next.archiveComment,status:next.status,periodStart:isoDate(next.periodStart),periodEnd:isoDate(next.periodEnd),source:'AI_CENTER_RATING_APPEAL',appealId:id}}});
        } else if(input.decision!=='UPHOLD')throw new BadRequestException('复核决定无效');
        const row=await this.repo.update(ctx,appeal,input.version,{status:'RESOLVED',data:{...appeal.data,decision:input.decision,comment,resolverId:actor.id,resolverName:ctx.scope.self.name,resolvedAt:new Date().toISOString()}});
        await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,row,'周成长评级复核完成','GROWTH_RATING_APPEAL_RESOLVED',[appeal.ownerId!]);return this.repo.view(ctx,row);
      }
      if(!appeal.parentId)throw new BadRequestException('复核来源不存在');
      const target=await this.repo.get<Record<string,unknown>>(ctx,appeal.parentId,['TASK','IVY','NOTE']);
      const previous=target.data.review as Review|undefined;
      if(previous?.reviewerId===actor.id)throw new ForbiddenException('请由另一位导师或主管复核对本人评分的异议');
      if(target.version!==input.targetVersion)throw new ConflictException('原记录已更新，请先核对最新版本');
      const comment=text(input.comment,'复核说明',2000);
      if(input.decision==='CHANGE') {
        if(!input.grade&&!input.confirmedDifficulty&&!input.dueAt)throw new BadRequestException('请选择需要调整的评分、难度或交付期');
        const data={...target.data};
        if(input.grade){if(!previous)throw new BadRequestException('原记录尚无质量评分');data.review=this.repo.review(ctx,target.ownerId!,input.grade,previous.comment,comment);}
        if(input.confirmedDifficulty){if(target.kind!=='TASK')throw new BadRequestException('仅任务有难度');if(!target.data.approvedAt)throw new BadRequestException('尚未批准的任务请先选择重新审核，再由导师确认难度');data.confirmedDifficulty=grade(input.confirmedDifficulty);}
        if(input.dueAt){if(target.kind!=='TASK'||!target.data.approvedAt)throw new BadRequestException('仅已批准任务可复核交付期');const stamp=Date.parse(input.dueAt);if(!Number.isFinite(stamp)||stamp<Date.parse(String(target.data.dueAt)))throw new BadRequestException('外部阻塞或需求变化的复核只能延后交付期，不能追溯提前要求');data.dueAt=new Date(stamp).toISOString();data.lastChangeReason=comment;}
        await this.repo.update(ctx,target,input.targetVersion,{data});
      } else if(input.decision==='REOPEN') {
        if(target.kind!=='TASK'||!['REJECTED','DEFERRED'].includes(target.status))throw new BadRequestException('仅被退回/暂缓的任务申请可以重新审核');
        await this.repo.update(ctx,target,input.targetVersion,{status:'PROPOSED',data:{...target.data,decisionComment:comment}});
      } else if(input.decision!=='UPHOLD')throw new BadRequestException('复核结论无效');
      const row=await this.repo.update(ctx,appeal,input.version,{status:'RESOLVED',data:{...appeal.data,decision:input.decision,comment,resolverId:actor.id,resolverName:ctx.scope.self.name,resolvedAt:new Date().toISOString()}});
      await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,row,'复核结果已更新','APPEAL_RESOLVED',appeal.ownerId?[appeal.ownerId]:[]);return this.repo.view(ctx,row);
    });
  }
  async readNotification(actor:RequestUser,id:string) { return this.repo.withActor(actor,async ctx=>{await ctx.tx.notification.updateMany({where:{id,userId:actor.id,entityType:'AI_CENTER'},data:{readAt:new Date()}});return {ok:true};}); }
}

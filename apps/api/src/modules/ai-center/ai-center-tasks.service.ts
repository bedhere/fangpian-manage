import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { RequestUser } from '../auth/auth.types.js';
import { AI_DEPARTMENT_ID, AiCenterRepository, grade, text } from './ai-center.repository.js';
import type { AiContext, AiRecord, IvyData, LinkData, NoteData, TaskData } from './ai-center.types.js';
import type { CreateAiTaskDto, CreateSelfTaskDto, UpdateSelfTaskDto, UpdateAiTaskDto, LinkDecisionDto, TaskDeclineDto, TaskDecisionDto, TaskDifficultyDto, TaskProgressDto, TaskReviewDto, TaskSubmitDto, TaskVersionDto } from './ai-center-tasks.dto.js';
@Injectable()
export class AiCenterTasksService {
  constructor(@Inject(AiCenterRepository) private readonly repo: AiCenterRepository) {}
  private state(row:AiRecord<unknown>, allowed:string[]) { if(!allowed.includes(row.status))throw new ConflictException('当前状态不允许此操作'); }
  private owner(ctx:AiContext,row:AiRecord<TaskData>) { if(row.ownerId!==ctx.actor.id||row.data.assigneeId!==ctx.actor.id)throw new ForbiddenException('仅承接本人可操作'); }
  private future(value:string) { const stamp=Date.parse(value);if(!Number.isFinite(stamp)||stamp<=Date.示例公司有限公司())throw new BadRequestException('交付时间必须是有效未来时间');return new Date(stamp).toISOString(); }
  private reviewers(ctx:AiContext,row:AiRecord<TaskData>) { return row.ownerId?(row.data.sourceType==='SELF'?ctx.scope.mentorIds(row.ownerId):ctx.scope.reviewerIds(row.ownerId)).filter(id=>id!==row.ownerId&&ctx.scope.user(id)?.active):[]; }
  private selfOwner(ctx:AiContext,row?:AiRecord<TaskData>) {
    if(!ctx.scope.isTrainee)throw new ForbiddenException('仅有效AI管培生可提交自拟任务申请');
    if(row){this.owner(ctx,row);if(row.createdBy!==ctx.actor.id||row.data.sourceType!=='SELF'||row.data.approvedAt||row.data.confirmedDifficulty)throw new ForbiddenException('仅能修改本人尚未批准的自拟任务申请');}
  }
  private selfFields(input:CreateSelfTaskDto) {
    const stamp=Date.parse(input.dueAt);if(!Number.isFinite(stamp))throw new BadRequestException('交付时间无效');
    return {title:text(input.title,'标题',200),description:text(input.description,'简介'),acceptanceCriteria:text(input.acceptanceCriteria,'验收标准'),priority:input.priority,dueAt:new Date(stamp).toISOString(),selfDifficulty:grade(input.selfDifficulty)};
  }
  private selfReady(ctx:AiContext,row:AiRecord<TaskData>) {
    this.future(row.data.dueAt);
    if(!this.reviewers(ctx,row).length)throw new BadRequestException('当前尚无有效对应导师，请先在“我的导师”完成配置审批；申请草稿已保留');
  }
  private async proposalFiles(ctx:AiContext,id:string) {return (await ctx.tx.aiCenterFile.findMany({where:{recordId:id,status:'READY'},select:{id:true},orderBy:{id:'asc'}})).map(file=>file.id);}
  createSelf(actor:RequestUser,input:CreateSelfTaskDto) {return this.repo.withActor(actor,async ctx=>{
    this.selfOwner(ctx);const fields=this.selfFields(input);
    const digest=createHash('sha256').update(JSON.stringify({...fields,submit:input.submit})).digest('hex');
    if(input.requestKey){const old=(await this.repo.list<TaskData>(ctx,'TASK',{ownerId:actor.id,data:{path:['requestKey'],equals:input.requestKey}}))[0];if(old){if(old.data.sourceType!=='SELF'||old.createdBy!==actor.id||old.data.creationRequestHash!==digest)throw new ConflictException('该新建申请已提交且内容不同，请先刷新检查原草稿，避免重复创建');return this.repo.view(ctx,old);}}
    const data:TaskData={...fields,sourceType:'SELF',assigneeId:actor.id,targetUserId:actor.id,confirmedDifficulty:null,progress:0,...(input.requestKey?{requestKey:input.requestKey,creationRequestHash:digest}:{}),...(input.submit?{proposedAt:new Date().toISOString(),proposalFileIds:[]}: {})};
    if(input.submit){this.future(data.dueAt);if(!ctx.scope.mentorIds(actor.id).length)throw new BadRequestException('当前尚无有效对应导师，请先完成导师配置，或先保存任务草稿');}
    const row=await this.repo.create(ctx,{kind:'TASK',ownerId:actor.id,status:input.submit?'PROPOSED':'DRAFT',data});
    if(input.submit)await this.repo.notify(ctx,row,'管培生自拟任务待审核','请审核任务价值、难度与交付期',this.reviewers(ctx,row));return this.repo.view(ctx,row);
  });}
  updateSelf(actor:RequestUser,id:string,input:UpdateSelfTaskDto) {return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.selfOwner(ctx,row);this.state(row,['DRAFT']);
    const {decisionComment:_comment,decisionBy:_by,decisionAt:_at,...prior}=row.data;
    const data:TaskData={...(input.submit?prior:row.data),...this.selfFields(input)};
    const nextRow={...row,data};if(input.submit){this.selfReady(ctx,nextRow);data.proposedAt=new Date().toISOString();data.proposalFileIds=await this.proposalFiles(ctx,id);}
    const next=await this.repo.update(ctx,row,input.version,{status:input.submit?'PROPOSED':'DRAFT',data});
    if(input.submit){await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'管培生自拟任务待审核','请审核最新任务申请',this.reviewers(ctx,next));}return this.repo.view(ctx,next);
  });}
  submitSelf(actor:RequestUser,id:string,input:TaskVersionDto) {return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.selfOwner(ctx,row);this.state(row,['DRAFT']);this.selfReady(ctx,row);
    const {decisionComment:_comment,decisionBy:_by,decisionAt:_at,...prior}=row.data;
    const next=await this.repo.update(ctx,row,input.version,{status:'PROPOSED',data:{...prior,proposedAt:new Date().toISOString(),proposalFileIds:await this.proposalFiles(ctx,id)}});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'管培生自拟任务待审核','请审核任务价值、难度与交付期',this.reviewers(ctx,next));return this.repo.view(ctx,next);
  });}
  reviseSelf(actor:RequestUser,id:string,input:TaskVersionDto) {return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.selfOwner(ctx,row);this.state(row,['PROPOSED','DEFERRED','REJECTED']);
    const next=await this.repo.update(ctx,row,input.version,{status:'DRAFT'});await this.repo.resolveNotifications(ctx,id);return this.repo.view(ctx,next);
  });}
  private async assertCurrentLearningSource(ctx:AiContext,row:AiRecord<TaskData>) {
    if(row.data.sourceType==='IVY') {
      if(!row.data.sourceRecordId||!row.data.evidence?.length)throw new ConflictException('艾维利来源快照缺失，请重新申请');
      const source=await this.repo.get<IvyData>(ctx,row.data.sourceRecordId,'IVY');
      if(source.ownerId!==row.ownerId||row.data.evidence.some(e=>e.recordId!==source.id||!source.data.today.some(v=>v.id===e.entryId&&v.text===e.text)))throw new ConflictException('原艾维利事项已修改或删除，请重新选择最新事项提交申请');
      return;
    }
    if(row.data.sourceType!=='LEARNING')return;
    if(!row.data.sourceRecordId||!row.data.sourceEntryId)throw new ConflictException('学习行动来源快照缺失，请重新提交行动');
    const source=await this.repo.get<NoteData>(ctx,row.data.sourceRecordId,'NOTE');
    if(source.ownerId!==row.ownerId||!source.data.submittedAt||!['SUBMITTED','REVIEWED'].includes(source.status))throw new ConflictException('来源笔记当前未正式提交，请学生重新提交后审核');
    const action=source.data.actions.find(a=>a.id===row.data.sourceEntryId);
    // The unapproved task is the immutable proposal snapshot. Note review alone may
    // advance source.version, while independent task difficulty edits are allowed.
    if(!action||action.title!==row.data.title||action.description!==row.data.description||action.acceptanceCriteria!==row.data.acceptanceCriteria||action.priority!==row.data.priority||action.dueAt!==row.data.dueAt)throw new ConflictException('来源行动已修改或移除，请审核重新提交的最新申请');
  }
  create(actor:RequestUser,b:CreateAiTaskDto) { return this.repo.withActor(actor,async ctx=>{
    if(!ctx.scope.canPublish)throw new ForbiddenException('无权发布任务');
    const target=b.targetUserId??null;
    if(target) {
      const user=ctx.scope.user(target);
      const eligible=ctx.scope.members.get(target)?.data.active||(user?.employee&&user.departmentId===AI_DEPARTMENT_ID);
      if(!user?.active||!eligible||!(target===actor.id||ctx.scope.isManager||ctx.scope.canReview(target)))throw new ForbiddenException('定向成员不在授权范围内');
    }
    const data:TaskData={title:text(b.title,'标题',200),description:text(b.description,'简介'),acceptanceCriteria:text(b.acceptanceCriteria,'验收标准'),priority:b.priority,sourceType:'AI',assigneeId:null,targetUserId:target,selfDifficulty:null,confirmedDifficulty:null,dueAt:this.future(b.dueAt),progress:0};
    const row=await this.repo.create(ctx,{kind:'TASK',ownerId:target,status:b.publish?'OPEN':'DRAFT',data});
    if(b.publish&&target)await this.repo.notify(ctx,row,'收到定向任务','请核对任务要求后接取',[target]);
    return this.repo.view(ctx,row);
  }); }
  update(actor:RequestUser,id:string,b:UpdateAiTaskDto) { return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');
    if(!ctx.scope.canPublish||row.createdBy!==actor.id)throw new ForbiddenException('仅当前有发布权限的原发布人可修改');
    this.state(row,['DRAFT','OPEN']);
    if(row.data.sourceType!=='AI'||row.data.assigneeId||row.data.approvedAt||row.data.confirmedDifficulty)throw new ConflictException('已承接或审批的任务不能修改发布内容');
    const target=b.targetUserId??null;
    if(target) {
      const user=ctx.scope.user(target);
      const eligible=ctx.scope.members.get(target)?.data.active||(user?.employee&&user.departmentId===AI_DEPARTMENT_ID);
      if(!user?.active||!eligible||!(target===actor.id||ctx.scope.isManager||ctx.scope.canReview(target)))throw new ForbiddenException('定向成员不在授权范围内');
    }
    const stamp=Date.parse(b.dueAt);if(!Number.isFinite(stamp))throw new BadRequestException('交付时间无效');
    const dueAt=b.publish?this.future(b.dueAt):new Date(stamp).toISOString();
    const data:TaskData={...row.data,title:text(b.title,'标题',200),description:text(b.description,'简介'),acceptanceCriteria:text(b.acceptanceCriteria,'验收标准'),priority:b.priority,dueAt,targetUserId:target};
    const next=await this.repo.update(ctx,row,b.version,{ownerId:target,status:b.publish?'OPEN':'DRAFT',data});
    await this.repo.resolveNotifications(ctx,id);
    if(b.publish&&target)await this.repo.notify(ctx,next,'定向任务内容已更新','请核对最新任务要求后接取',[target]);
    return this.repo.view(ctx,next);
  }); }
  claim(actor:RequestUser,id:string,b:TaskDifficultyDto) { return this.repo.withActor(actor,async ctx=>{
    if(!ctx.scope.isTrainee&&!ctx.scope.isAiStaff)throw new ForbiddenException('仅有效AI管培生或AI员工可接取');
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.repo.assertRead(ctx,row);this.state(row,['OPEN']);
    if(row.data.assigneeId||(row.data.targetUserId&&row.data.targetUserId!==actor.id))throw new ForbiddenException('任务已接取或定向其他成员');
    const next=await this.repo.update(ctx,row,b.version,{ownerId:actor.id,status:'PROPOSED',data:{...row.data,acquisitionMode:row.data.targetUserId?'DIRECT':'CLAIMED',assigneeId:actor.id,selfDifficulty:grade(b.selfDifficulty)}});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'任务接取待确认','请审核价值与难度',this.reviewers(ctx,next));return this.repo.view(ctx,next);
  }); }
  difficulty(actor:RequestUser,id:string,b:TaskDifficultyDto) { return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.owner(ctx,row);this.state(row,['PROPOSED','DEFERRED']);
    if(row.data.confirmedDifficulty||row.data.approvedAt)throw new ConflictException('已确认难度不能直接修改');
    const next=await this.repo.update(ctx,row,b.version,{data:{...row.data,selfDifficulty:grade(b.selfDifficulty)}});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'任务申请难度已更新','请审核最新申请',this.reviewers(ctx,next));return this.repo.view(ctx,next);
  }); }
  decision(actor:RequestUser,id:string,b:TaskDecisionDto) { return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.repo.assertReview(ctx,row);this.state(row,['PROPOSED','DEFERRED']);
    if(!row.ownerId||row.data.assigneeId!==row.ownerId)throw new ConflictException('申请尚无承接人');
    if(row.data.confirmedDifficulty||row.data.approvedAt)throw new ConflictException('已批准任务须通过复核调整');
    const approve=b.decision==='APPROVE';
    const comment=text(b.comment??'','审核意见',4000,!approve);
    const data:TaskData={...row.data,decisionComment:comment,decisionBy:actor.id,decisionAt:new Date().toISOString()};
    if(approve) { await this.assertCurrentLearningSource(ctx,row);grade(row.data.selfDifficulty);data.confirmedDifficulty=grade(b.confirmedDifficulty);data.dueAt=this.future(b.dueAt??row.data.dueAt);data.approvedAt=new Date().toISOString();data.approvedBy=actor.id; }
    const next=await this.repo.update(ctx,row,b.version,{status:approve?'ACTIVE':b.decision==='DEFER'?'DEFERRED':'REJECTED',data});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'任务申请审核结果',approve?'已确认价值与难度':comment,[row.ownerId]);return this.repo.view(ctx,next);
  }); }
  progress(actor:RequestUser,id:string,b:TaskProgressDto) { return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.owner(ctx,row);this.state(row,['ACTIVE','RETURNED']);
    const data={...row.data,progress:b.progress,...(b.note!==undefined?{progressNote:text(b.note,'进度说明',4000,false)}:{})};
    return this.repo.view(ctx,await this.repo.update(ctx,row,b.version,{data}));
  }); }
  submit(actor:RequestUser,id:string,b:TaskSubmitDto) { return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.owner(ctx,row);this.state(row,['ACTIVE','RETURNED']);
    const files=await ctx.tx.aiCenterFile.findMany({where:{recordId:row.id,status:'READY'},select:{id:true},orderBy:{id:'asc'}});
    const next=await this.repo.update(ctx,row,b.version,{status:'SUBMITTED',data:{...row.data,submission:text(b.submission,'交付说明'),submittedAt:new Date().toISOString(),submissionFileIds:files.map(file=>file.id)}});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'任务交付待验收','请按约定标准确认质量和完成比例',this.reviewers(ctx,next));return this.repo.view(ctx,next);
  }); }
  review(actor:RequestUser,id:string,b:TaskReviewDto) { return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.repo.assertReview(ctx,row);this.state(row,['SUBMITTED','COMPLETED']);
    if(!row.ownerId||!row.data.confirmedDifficulty||!row.data.approvedAt||!row.data.submittedAt)throw new ConflictException('任务尚未完成审批与交付');
    const revise=!!row.data.review||row.status==='COMPLETED';
    const reason=text(b.reason??'','修订原因',1000,revise);
    const approve=b.decision==='APPROVE';const comment=text(b.comment??'','验收意见',4000,!approve);
    const data:TaskData={...row.data,...(revise?{lastChangeReason:reason}:{})};
    if(approve) { data.review=this.repo.review(ctx,row.ownerId,grade(b.grade),comment,reason);data.completionRatio=b.completionRatio??1; }
    else { delete data.review;delete data.completionRatio;data.decisionComment=comment; }
    const next=await this.repo.update(ctx,row,b.version,{status:approve?'COMPLETED':'RETURNED',data});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'任务验收结果',approve?'验收结果已确认':comment,[row.ownerId]);return this.repo.view(ctx,next);
  }); }
  decline(actor:RequestUser,id:string,b:TaskDeclineDto) { return this.repo.withActor(actor,async ctx=>{
    const row=await this.repo.get<TaskData>(ctx,id,'TASK');this.state(row,['OPEN']);
    if(row.data.targetUserId!==actor.id||row.data.assigneeId)throw new ForbiddenException('仅定向成员可拒绝未接取任务');
    const comment=text(b.comment,'拒绝原因',4000);
    const next=await this.repo.update(ctx,row,b.version,{status:'REJECTED',data:{...row.data,decisionComment:comment,declinedBy:[...new Set([...(row.data.declinedBy??[]),actor.id])]}});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'定向任务被拒绝',comment,[row.createdBy]);return this.repo.view(ctx,next);
  }); }
  linkDecision(actor:RequestUser,id:string,b:LinkDecisionDto) { return this.repo.withActor(actor,async ctx=>{
    const link=await this.repo.get<LinkData>(ctx,id,'LINK');this.repo.assertReview(ctx,link);this.state(link,['PENDING']);
    const task=await this.repo.get<TaskData>(ctx,link.data.taskId,'TASK');
    if(!link.ownerId||task.ownerId!==link.ownerId||task.data.assigneeId!==link.ownerId)throw new ConflictException('只能关联该学生本人已承接的任务');
    const approve=b.decision==='APPROVE';const comment=text(b.comment??'','关联审核意见',4000,!approve);
    if(approve) {
      this.state(task,['PROPOSED','ACTIVE','RETURNED','SUBMITTED','COMPLETED','DEFERRED']);
      const source=await this.repo.get<IvyData>(ctx,link.data.sourceRecordId,'IVY');
      if(source.ownerId!==link.ownerId||!source.data.today.some(e=>e.id===link.data.sourceEntryId&&e.text===link.data.text))throw new ConflictException('原艾维利事项已修改或删除，请重新选择最新事项提交关联');
      const evidence=task.data.evidence??[];
      if(evidence.some(e=>e.recordId===link.data.sourceRecordId&&e.entryId===link.data.sourceEntryId))throw new ConflictException('该事项已关联，不能重复归集');
      const tasks=await this.repo.list<TaskData>(ctx,'TASK',{ownerId:link.ownerId});
      if(tasks.some(t=>(t.data.evidence??[]).some(e=>e.recordId===link.data.sourceRecordId&&e.entryId===link.data.sourceEntryId)))throw new ConflictException('该事项已归集到任务');
      await this.repo.update(ctx,task,task.version,{data:{...task.data,evidence:[...evidence,{recordId:link.data.sourceRecordId,entryId:link.data.sourceEntryId,text:link.data.text,reviewedBy:actor.id}]}});
    }
    const next=await this.repo.update(ctx,link,b.version,{status:approve?'APPROVED':'REJECTED',data:{...link.data,decisionComment:comment,reviewerId:actor.id}});
    await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'工作证据关联审核结果',approve?'已合并到原任务，不重复计分':comment,[link.ownerId]);return this.repo.view(ctx,next);
  }); }
}






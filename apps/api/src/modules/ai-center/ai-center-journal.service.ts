import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { learningRichDocument, learningRichText, learningWebsite } from '@value-flow/domain/learning-note';
import { shanghaiToday } from '../trainees/trainee-policy.js';
import { AiCenterRepository, dayShift, grade, text, validDay, weekStart } from './ai-center.repository.js';
import type { AiContext, AiRecord, IvyData, LearningAction, LinkData, NoteData, TaskData } from './ai-center.types.js';
import type { JournalReviewDto, JournalVersionDto, NoteReviewDto, PromoteIvyDto, SaveIvyDto, SaveNoteDto, UpdateNoteDto } from './ai-center-journal.dto.js';
import { IvyWecomService } from './ivy-wecom.service.js';
@Injectable()
export class AiCenterJournalService {
 constructor(@Inject(AiCenterRepository) private readonly repo:AiCenterRepository,@Inject(IvyWecomService) private readonly wecom:IvyWecomService) {}
 private trainee(ctx:AiContext) { if(!ctx.scope.isTrainee)throw new ForbiddenException('仅有效AI管培生可填写'); }
 private own(ctx:AiContext,row:AiRecord<unknown>) { this.trainee(ctx);if(row.ownerId!==ctx.actor.id)throw new ForbiddenException('仅本人可修改'); }
 private version(row:AiRecord<unknown>,version:number|undefined) { if(row.version!==version)throw new ConflictException('记录已变更，请刷新核对'); }
 async saveIvy(actor:RequestUser,b:SaveIvyDto) {
  return this.repo.withActor(actor,async ctx=>{
   this.trainee(ctx);const today=shanghaiToday();
   const entries=[...b.today,...b.tomorrow];if(!entries.length)throw new BadRequestException('请填写至少一条事项');
   if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new BadRequestException('事项编号不能重复');
   for(const e of entries) { e.text=text(e.text,'事项',1000);if(e.note!==undefined)e.note=text(e.note,'备注',2000,false); }
   const rows=await this.repo.list<IvyData>(ctx,'IVY',{ownerId:actor.id,dateKey:today});
   const data:IvyData={today:b.today,tomorrow:b.tomorrow};let row:AiRecord<IvyData>;
   if(rows[0]) { this.version(rows[0],b.version);row=await this.repo.update(ctx,rows[0],b.version!,{data,status:'SUBMITTED'}); }
   else { if(b.version!==undefined&&b.version!==0)throw new ConflictException('当天日记不存在，请刷新');row=await this.repo.create(ctx,{kind:'IVY',ownerId:actor.id,dateKey:today,status:'SUBMITTED',data}); }
   await this.repo.resolveNotifications(ctx,row.id);
   await this.repo.notify(ctx,row,'艾维利已保存',`${today}日报已保存，可立即查看今日事项和示例公司有限公司计划；次日起可评级`);
   return this.repo.view(ctx,row);
  });
 }
 async reviewIvy(actor:RequestUser,id:string,b:JournalReviewDto) {
  return this.repo.withActor(actor,async ctx=>{
   const row=await this.repo.get<IvyData>(ctx,id,'IVY');this.repo.assertReview(ctx,row);this.version(row,b.version);
   if(row.dateKey>=shanghaiToday())throw new BadRequestException('仅可评价已结束日期');
   if(row.data.review&&row.data.review.grade!==b.grade)text(b.reason,'改分原因',1000);
   const next=await this.repo.update(ctx,row,b.version,{status:'REVIEWED',data:{...row.data,review:this.repo.review(ctx,row.ownerId!,b.grade,b.comment,b.reason)}});
   await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'艾维利评价已更新','查看导师评价',[row.ownerId!]);
   const wecomNotice=await this.wecom.enqueueSafely(ctx,next);
   return {...this.repo.view(ctx,next),wecomNotice};
  });
 }
 private taskData(action:Omit<LearningAction,'id'>,owner:string):TaskData {
  return {title:text(action.title,'任务标题',200),description:text(action.description,'任务说明'),acceptanceCriteria:text(action.acceptanceCriteria,'验收标准'),priority:action.priority,dueAt:action.dueAt,selfDifficulty:grade(action.selfDifficulty),sourceType:'LEARNING',assigneeId:owner,targetUserId:owner,confirmedDifficulty:null,progress:0};
 }
 async promoteIvy(actor:RequestUser,id:string,b:PromoteIvyDto) {
  return this.repo.withActor(actor,async ctx=>{
   const row=await this.repo.get<IvyData>(ctx,id,'IVY');this.own(ctx,row);this.version(row,b.version);
   if(!!b.task===!!b.existingTaskId)throw new BadRequestException('请选择创建任务或关联已有任务');
   const selected=b.entryIds.map(entryId=>{ const e=row.data.today.find(x=>x.id===entryId);if(!e)throw new BadRequestException('仅可选择今日事项');return e; });
   const tasks=await this.repo.list<TaskData>(ctx,'TASK');const links=await this.repo.list<LinkData>(ctx,'LINK');
   const reusable=b.task?tasks.find(t=>t.ownerId===actor.id&&t.data.sourceType==='IVY'&&t.data.sourceRecordId===id&&!t.data.approvedAt&&!t.data.confirmedDifficulty&&['PROPOSED','DEFERRED','REJECTED'].includes(t.status)&&selected.length===(t.data.evidence??[]).filter(e=>e.recordId===id).length&&selected.every(e=>t.data.evidence?.some(v=>v.recordId===id&&v.entryId===e.id))):undefined;
   for(const e of selected)if(tasks.some(t=>t.id!==reusable?.id&&(t.data.evidence?.some(v=>v.recordId===id&&v.entryId===e.id)||(t.data.sourceRecordId===id&&t.data.sourceEntryId===e.id)))||links.some(l=>l.data.sourceRecordId===id&&l.data.sourceEntryId===e.id&&l.status!=='REJECTED'))throw new ConflictException('事项已转为任务或存在待审关联；修改原申请请选择同一组事项重新申请');
   if(b.task) {
    const data:TaskData={...this.taskData(b.task,actor.id),sourceType:'IVY',sourceRecordId:id,sourceEntryId:selected[0].id,sourceVersion:row.version,evidence:[...(reusable?.data.evidence??[]).filter(e=>e.recordId!==id),...selected.map(e=>({recordId:id,entryId:e.id,text:e.text}))]};
    const task=reusable?await this.repo.update(ctx,reusable,reusable.version,{status:'PROPOSED',data}):await this.repo.create(ctx,{kind:'TASK',ownerId:actor.id,parentId:id,status:'PROPOSED',dateKey:row.dateKey,data});
    if(reusable)await this.repo.resolveNotifications(ctx,reusable.id);
    await this.repo.notify(ctx,task,'艾维利任务待确认','请确认事项价值与难度');return {tasks:[this.repo.view(ctx,task)],links:[]};
   }
   const task=await this.repo.get<TaskData>(ctx,b.existingTaskId!,'TASK');
   if(task.ownerId!==actor.id||task.data.assigneeId!==actor.id||['DRAFT','OPEN','REJECTED','DEFERRED'].includes(task.status))throw new BadRequestException('只能关联本人已领取任务');
   const created=[];for(const e of selected) { const link=await this.repo.create<LinkData>(ctx,{kind:'LINK',ownerId:actor.id,parentId:id,status:'PENDING',dateKey:row.dateKey,data:{sourceRecordId:id,sourceEntryId:e.id,taskId:task.id,text:e.text}});await this.repo.notify(ctx,link,'事项关联待审核','请确认事项与任务的关联');created.push(this.repo.view(ctx,link)); }
   return {tasks:[],links:created};
  });
 }
 private noteData(b:SaveNoteDto,old?:NoteData):NoteData {
  if(new Set(b.actions.map(a=>a.id)).size!==b.actions.length)throw new BadRequestException('行动编号不能重复');
  if(b.submit&&b.actions.length<2)throw new BadRequestException('正式提交至少需要两条行动建议');
  let contentDocument=old?.contentDocument&&b.content===old.content?old.contentDocument:undefined;
  if(b.contentDocument!==undefined){try{contentDocument=learningRichDocument(b.contentDocument);}catch(error){throw new BadRequestException(error instanceof Error?error.message:'富文本内容格式无效');}}
  const content=contentDocument?learningRichText(contentDocument):b.content;
  const sourceWebsites=b.websites??old?.websites;
  const websites=sourceWebsites?.map(value=>text(value,'网站',2048,false)).filter(Boolean).map(value=>{const url=learningWebsite(value);if(b.submit&&!url)throw new BadRequestException('正式提交前请填写有效的HTTP或HTTPS网站');return url??value;});
  if(!b.submit&&![b.title,content,b.businessLink,...(websites??[]),...b.actions.flatMap(a=>[a.title,a.description,a.acceptanceCriteria,a.dueAt])].some(v=>typeof v==='string'&&v.trim()))throw new BadRequestException('请先填写需要保存的笔记或行动内容');
  const title=b.title.trim()||websites?.map(value=>learningWebsite(value)?new URL(learningWebsite(value)!).hostname:value).join(' / ').slice(0,200)||'';
  const 示例公司有限公司=new Date().toISOString();
  const actions=b.actions.map(a=>b.submit?this.action(a):{id:a.id,title:text(a.title,'行动标题',200,false),description:text(a.description,'行动说明',12000,false),acceptanceCriteria:text(a.acceptanceCriteria,'验收标准',12000,false),priority:a.priority,dueAt:a.dueAt,selfDifficulty:grade(a.selfDifficulty)});
  return {title:text(title,'主题网站',200,b.submit),content:text(content,'学习内容',30000,b.submit),businessLink:text(b.businessLink,'自己的理解',12000,b.submit),...(websites!==undefined?{websites}:{}),...(contentDocument?{contentDocument}:{}),actions,...(old?.fileIds?{fileIds:old.fileIds}:{}),...(old?.submittedAt?{submittedAt:old.submittedAt}:{}),...(old?.supersedesId?{supersedesId:old.supersedesId}:{}),...(old?.firstSubmittedAt?{firstSubmittedAt:old.firstSubmittedAt}:{}),...(old?.lateReview?{lateReview:old.lateReview}:{}),...(b.submit?{submittedAt:示例公司有限公司,firstSubmittedAt:old?.firstSubmittedAt??示例公司有限公司}:{})};
 }
 private action(a:LearningAction):LearningAction { if(!a.dueAt||!Number.isFinite(Date.parse(a.dueAt)))throw new BadRequestException('正式提交前请填写每条行动的有效交付日期');const d=this.taskData(a,'');return {id:a.id,title:d.title,description:d.description,acceptanceCriteria:d.acceptanceCriteria,priority:d.priority,dueAt:d.dueAt,selfDifficulty:a.selfDifficulty}; }
 private week(ctx:AiContext,value?:string) { const day=value??weekStart();if(!validDay(day)||weekStart(day)!==day||day>weekStart())throw new BadRequestException('请选择有效且不晚于本周的周一');const since=ctx.scope.members.get(ctx.actor.id)?.data.sinceDate;if(since&&day<weekStart(since))throw new BadRequestException('不能补交培养启用前的笔记');return day; }
 private async uniqueNote(ctx:AiContext,data:NoteData,week:string,id?:string) {
  const normalized=(v:string)=>v.normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase();
  const rows=await this.repo.list<NoteData>(ctx,'NOTE',{ownerId:ctx.actor.id,dateKey:week});
  const formal=rows.filter(r=>r.id!==id&&r.data.firstSubmittedAt);
  if(formal.some(r=>normalized(r.data.content)===normalized(data.content)))throw new ConflictException('本周已有相同学习正文，请完善原笔记或记录新的学习内容，不能重复提交计数');
  const key=(a:LearningAction)=>normalized(a.title+'\n'+a.description+'\n'+a.acceptanceCriteria);
  const keys=data.actions.map(key);
  if(new Set(keys).size!==keys.length||formal.some(r=>r.data.actions.some(a=>keys.includes(key(a)))))throw new ConflictException('学习行动重复，请将同一成果保留为一个行动，避免重复生成任务');
 }
 private async protectActions(ctx:AiContext,noteId:string,actions:LearningAction[]) {
  const tasks=await this.repo.list<TaskData>(ctx,'TASK',{parentId:noteId});
  for(const task of tasks) {
   if(task.data.sourceType!=='LEARNING'||['PROPOSED','REJECTED','DEFERRED'].includes(task.status))continue;
   if(!task.data.sourceVersion)throw new ConflictException('已批准行动缺少来源版本，请先复核');
   const history=await ctx.tx.aiCenterHistory.findUnique({where:{recordId_version:{recordId:noteId,version:task.data.sourceVersion}}});
   const source=(history?.snapshot as unknown as {data?:NoteData}|undefined)?.data?.actions.find(x=>x.id===task.data.sourceEntryId);
   const a=actions.find(x=>x.id===task.data.sourceEntryId);
   if(!a||!source||['title','description','acceptanceCriteria','priority','dueAt'].some(k=>a[k as keyof LearningAction]!==source[k as keyof LearningAction]))throw new ConflictException('已批准行动的原始内容不可修改或删除，请新建行动');
  }
 }
 private async proposeActions(ctx:AiContext,note:AiRecord<NoteData>) {
  const tasks=await this.repo.list<TaskData>(ctx,'TASK',{parentId:note.id});
  for(const task of tasks) {
   if(task.data.sourceType==='LEARNING'&&['PROPOSED','DEFERRED'].includes(task.status)&&!note.data.actions.some(a=>a.id===task.data.sourceEntryId)) {
    await this.repo.update(ctx,task,task.version,{status:'REJECTED',data:{...task.data,decisionComment:'学习笔记修订已移除此行动'}});await this.repo.resolveNotifications(ctx,task.id);
   }
  }
  for(const a of note.data.actions) {
   const existing=tasks.find(t=>t.data.sourceType==='LEARNING'&&t.data.sourceRecordId===note.id&&t.data.sourceEntryId===a.id);
   if(existing&&!['PROPOSED','REJECTED','DEFERRED'].includes(existing.status))continue;
   const data:TaskData={...existing?.data,...this.taskData(a,note.ownerId!),sourceRecordId:note.id,sourceEntryId:a.id,sourceVersion:note.version};
   // Difficulty edited independently on an existing proposal remains the student's canonical self-rating.
   if(existing)data.selfDifficulty=existing.data.selfDifficulty??a.selfDifficulty;
   const task=existing?await this.repo.update(ctx,existing,existing.version,{data,status:'PROPOSED'}):await this.repo.create(ctx,{kind:'TASK',ownerId:note.ownerId,parentId:note.id,dateKey:note.dateKey,status:'PROPOSED',data});
   await this.repo.notify(ctx,task,'学习行动待确认','请单独确认行动价值、难度与交付期');
  }
 }
 async createNote(actor:RequestUser,b:SaveNoteDto) { return this.repo.withActor(actor,async ctx=>{this.trainee(ctx);const data=this.noteData(b),dateKey=this.week(ctx,b.week);if(b.submit){data.fileIds=[];await this.uniqueNote(ctx,data,dateKey);}const row=await this.repo.create(ctx,{kind:'NOTE',ownerId:actor.id,dateKey,status:b.submit?'SUBMITTED':'DRAFT',data});if(b.submit){await this.proposeActions(ctx,row);await this.repo.notify(ctx,row,'学习笔记待评价','请评价笔记质量');}return this.repo.view(ctx,row);}); }
 async updateNote(actor:RequestUser,id:string,b:UpdateNoteDto) { return this.repo.withActor(actor,async ctx=>{
  const row=await this.repo.get<NoteData>(ctx,id,'NOTE');this.own(ctx,row);this.version(row,b.version);if(!['DRAFT','RETURNED'].includes(row.status))throw new ConflictException('已提交笔记请先创建修订版本');
  const dateKey=this.week(ctx,b.week??row.dateKey);if(dateKey!==row.dateKey&&row.data.firstSubmittedAt)throw new ConflictException('正式提交后不能移动所属周');
  const data=this.noteData(b,row.data);
  if(b.submit)await this.uniqueNote(ctx,data,dateKey,id);
  if(b.submit)data.fileIds=(await ctx.tx.aiCenterFile.findMany({where:{recordId:id,status:'READY',record:{organizationId:ctx.actor.organizationId}},select:{id:true},orderBy:[{createdAt:'asc'},{id:'asc'}]})).map(file=>file.id);
  await this.protectActions(ctx,id,data.actions);const next=await this.repo.update(ctx,row,b.version,{data,dateKey,status:b.submit?'SUBMITTED':'DRAFT'});if(b.submit){await this.proposeActions(ctx,next);await this.repo.notify(ctx,next,'学习笔记待评价','请评价笔记质量');}return this.repo.view(ctx,next);
 }); }
 async reviseNote(actor:RequestUser,id:string,b:JournalVersionDto) { return this.repo.withActor(actor,async ctx=>{
  const row=await this.repo.get<NoteData>(ctx,id,'NOTE');this.own(ctx,row);this.version(row,b.version);if(!['SUBMITTED','REVIEWED','RETURNED'].includes(row.status))throw new ConflictException('当前笔记不能创建修订版本');
  const {review,decisionComment,...data}=row.data;const next=await this.repo.update(ctx,row,b.version,{data,status:'DRAFT'});await this.repo.resolveNotifications(ctx,id);return this.repo.view(ctx,next);
 }); }
 async reviewNote(actor:RequestUser,id:string,b:NoteReviewDto) { return this.repo.withActor(actor,async ctx=>{
  const row=await this.repo.get<NoteData>(ctx,id,'NOTE');this.repo.assertReview(ctx,row);this.version(row,b.version);if(!['SUBMITTED','REVIEWED'].includes(row.status))throw new ConflictException('只能评价当前已提交版本');
  if(row.data.review&&b.decision==='APPROVE'&&row.data.review.grade!==b.grade)text(b.reason,'改分原因',1000);
  const data:NoteData={...row.data};
  const late=Date.parse(row.data.firstSubmittedAt??'')>=Date.parse(dayShift(row.dateKey,7)+'T00:00:00+08:00');
  if(b.decision==='APPROVE'&&late&&typeof b.reconcileLate==='boolean') {
   const reason=text(b.reason,'补交原周归属复核原因',1000);if(reason.length<2)throw new BadRequestException('补交原周归属复核原因至少两字');
   data.lateReview={countInOriginalWeek:b.reconcileLate,reviewerId:ctx.actor.id,reviewerName:ctx.scope.self.name,at:new Date().toISOString(),reason};
  }
  if(b.decision==='APPROVE')data.review=this.repo.review(ctx,row.ownerId!,b.grade,b.comment,b.reason);else { delete data.review;data.decisionComment=text(b.comment,'退回原因',4000); }
  const next=await this.repo.update(ctx,row,b.version,{data,status:b.decision==='APPROVE'?'REVIEWED':'RETURNED'});await this.repo.resolveNotifications(ctx,id);await this.repo.notify(ctx,next,'学习笔记评价结果',b.decision==='APPROVE'?'查看计划质量评分':'请按导师意见修订',[row.ownerId!]);return this.repo.view(ctx,next);
 }); }
}

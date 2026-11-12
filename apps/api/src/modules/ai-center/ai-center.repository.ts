import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { serializable, shanghaiToday } from '../trainees/trainee-policy.js';
import { dataOf, grades, type AiContext, type AiRecord, type AiScope, type AiUser, type Grade, type Kind, type MemberData, type RecordView, type Review, type TaskData } from './ai-center.types.js';
import { growthPublicAppeal } from './growth-public-text.js';

export const AI_DEPARTMENT_ID='cd0e433d-a31a-44c3-98ad-3ae927de7682';
export const MENTOR_APPROVER_ID='650263cd-962c-4851-bc89-511dda046df0';
export const isoDate=(value:Date)=>value.toISOString().slice(0,10);
export const dayShift=(date:string,days:number)=>isoDate(new Date(new Date(date+'T00:00:00Z').getTime()+days*86400000));
export function weekStart(value=shanghaiToday()) { const d=new Date(value+'T00:00:00Z');return dayShift(value,-((d.getUTCDay()+6)%7)); }
export function validDay(value:string) { return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&isoDate(new Date(value+'T00:00:00Z'))===value; }
export function text(value:unknown,label:string,limit=12000,required=true) { if(typeof value!=='string'||value.length>limit||(required&&!value.trim()))throw new BadRequestException(`${label}${required?'必填且':''}不能超过${limit}字`);return value.trim(); }
export function grade(value:unknown):Grade { if(!grades.includes(value as Grade))throw new BadRequestException('请选择S/A/B/C');return value as Grade; }

@Injectable()
export class AiCenterRepository {
  constructor(@Inject(PrismaService) readonly prisma:PrismaService) {}
  async loadScope(tx:Prisma.TransactionClient,actor:RequestUser):Promise<AiScope> {
    const raw=await tx.user.findMany({where:{organizationId:actor.organizationId,deletedAt:null},select:{id:true,displayName:true,departmentId:true,managerId:true,status:true,department:{select:{name:true}},roles:{where:{role:{organizationId:actor.organizationId,status:'ACTIVE'}},select:{role:{select:{code:true}}}}}});
    const users=new Map<string,AiUser>(raw.map(u=>[u.id,{id:u.id,name:u.displayName,departmentId:u.departmentId,departmentName:u.department?.name??null,managerId:u.managerId,active:u.status==='ACTIVE',employee:u.roles.some(x=>x.role.code!=='TRAINEE'),roles:u.roles.map(x=>x.role.code)}]));
    const self=users.get(actor.id);if(!self?.active)throw new ForbiddenException('成员无效');
    const records=await tx.aiCenterRecord.findMany({where:{organizationId:actor.organizationId,kind:{in:['MEMBER','MANAGER']}}});
    const members=new Map(records.filter(r=>r.kind==='MEMBER'&&r.ownerId).map(r=>[r.ownerId!,r as AiRecord<MemberData>]));
    const isManager=self.roles.some(x=>['OWNER','SUPER_ADMIN'].includes(x))||records.some(r=>r.kind==='MANAGER'&&r.ownerId===actor.id&&r.status==='ACTIVE');
    function mentors(id:string) {
      const m=members.get(id)?.data;if(!m?.active)return [];
      const ids=[m.aiMentorId,...m.departmentMentorIds];
      if(!(m.aiMentorId&&m.departmentMentorIds.length)&&m.legacyMentorId)ids.push(m.legacyMentorId);
      return [...new Set(ids.filter((v):v is string=>!!v&&!!users.get(v)?.active&&!!users.get(v)?.employee))];
    }
    const reviewerIds=(id:string)=>[...new Set([...mentors(id),...mentors(id).map(x=>users.get(x)?.managerId).filter((x):x is string=>!!x&&!!users.get(x)?.active&&!!users.get(x)?.employee),...records.filter(r=>r.kind==='MANAGER'&&r.status==='ACTIVE'&&r.ownerId&&users.get(r.ownerId)?.active).map(r=>r.ownerId!)])].filter(x=>x!==id);
    const canReview=(id:string)=>id!==actor.id&&(isManager||reviewerIds(id).includes(actor.id));
    const canReadOwner=(id:string)=>id===actor.id||isManager||canReview(id);
    const isTrainee=!!members.get(actor.id)?.data.active;
    const isAiStaff=self.employee&&self.departmentId===AI_DEPARTMENT_ID;
    const isMentor=[...members.keys()].some(id=>mentors(id).includes(actor.id)||canReview(id));
    const mentorApproverAvailable=!!users.get(MENTOR_APPROVER_ID)?.active&&!!users.get(MENTOR_APPROVER_ID)?.employee&&records.some(r=>r.kind==='MANAGER'&&r.ownerId===MENTOR_APPROVER_ID&&r.status==='ACTIVE');
    return {actor,self,users,members,isManager,isTrainee,isAiStaff,isMentor,mentorApproverAvailable,canApproveMentors:mentorApproverAvailable&&actor.id===MENTOR_APPROVER_ID,user:id=>users.get(id),canReadOwner,canReview,reviewerIds,mentorIds:id=>mentors(id).filter(mentor=>mentor!==id),canPublish:isManager||isMentor||isAiStaff};
  }
  async withActor<T>(actor:RequestUser,work:(ctx:AiContext)=>Promise<T>,write=true):Promise<T> {
    return serializable(this.prisma,async tx=>{
      if(write)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.organizationId},20261102))`;
      const scope=await this.loadScope(tx,actor);
      if(!scope.isManager&&!scope.isTrainee&&!scope.isAiStaff&&!scope.isMentor)throw new ForbiddenException('仅AI中台成员、AI管培生及其导师可进入');
      return work({tx,actor,scope});
    });
  }
  async get<T=Record<string,unknown>>(ctx:AiContext,id:string,kind?:Kind|Kind[]):Promise<AiRecord<T>> {
    const row=await ctx.tx.aiCenterRecord.findFirst({where:{id,organizationId:ctx.actor.organizationId,...(kind?{kind:{in:Array.isArray(kind)?kind:[kind]}}:{})}});
    if(!row)throw new NotFoundException('记录不存在');return row as AiRecord<T>;
  }
  async list<T=Record<string,unknown>>(ctx:AiContext,kind:Kind|Kind[],where:Prisma.AiCenterRecordWhereInput={}) {
    return await ctx.tx.aiCenterRecord.findMany({where:{AND:[{organizationId:ctx.actor.organizationId,kind:{in:Array.isArray(kind)?kind:[kind]}},where]},orderBy:[{dateKey:'desc'},{createdAt:'desc'}]}) as AiRecord<T>[];
  }
  canRead(ctx:AiContext,row:AiRecord<unknown>) {
    if(row.kind==='TASK') {
      const d=dataOf<TaskData>(row);
      if(row.status==='DRAFT')return row.createdBy===ctx.actor.id||ctx.scope.isManager;
      if(row.ownerId===ctx.actor.id||ctx.scope.isManager)return true;
      if(!row.ownerId&&row.createdBy===ctx.actor.id)return true;
      if(row.ownerId&&ctx.scope.canReview(row.ownerId))return true;
      if(d.targetUserId)return d.targetUserId===ctx.actor.id||ctx.scope.canReview(d.targetUserId);
      return row.status==='OPEN'&&(ctx.scope.isTrainee||ctx.scope.isAiStaff||ctx.scope.isMentor);
    }
    if(row.kind==='MANAGER'||row.kind==='CALENDAR')return ctx.scope.isManager||row.kind==='CALENDAR';
    if(!row.ownerId)return ctx.scope.isManager;
    if(row.ownerId===ctx.actor.id)return true;
    if(row.kind==='NOTE'&&row.status==='DRAFT')return false;
    if(row.kind==='IVY'&&row.dateKey>shanghaiToday())return false;
    return ctx.scope.canReadOwner(row.ownerId);
  }
  assertRead(ctx:AiContext,row:AiRecord<unknown>) { if(!this.canRead(ctx,row))throw new NotFoundException('记录不存在或无权查看'); }
  canReviewRecord(ctx:AiContext,row:AiRecord<unknown>) {
    if(row.ownerId===ctx.actor.id)return false;
    if(row.kind==='IVY'&&row.dateKey>=shanghaiToday())return false;
    if(row.kind==='APPEAL'){const d=row.data as {excludedReviewerId?:string;excludedReviewerIds?:string[]};if(d.excludedReviewerId===ctx.actor.id||d.excludedReviewerIds?.includes(ctx.actor.id))return false;}
    if(row.kind==='TASK'){if(dataOf<TaskData>(row).sourceType==='SELF')return !!row.ownerId&&ctx.scope.mentorIds(row.ownerId).includes(ctx.actor.id);return ctx.scope.isManager||!!row.ownerId&&ctx.scope.canReview(row.ownerId);}
    return !!row.ownerId&&ctx.scope.canReview(row.ownerId);
  }
  assertReview(ctx:AiContext,row:AiRecord<unknown>) { if(!this.canReviewRecord(ctx,row))throw new ForbiddenException('无权审批此记录'); }
  async create<T>(ctx:AiContext,input:{kind:Kind;ownerId?:string|null;parentId?:string|null;dateKey?:string;status?:string;data:T}) {
    const row=await ctx.tx.aiCenterRecord.create({data:{...input,organizationId:ctx.actor.organizationId,ownerId:input.ownerId??null,dateKey:input.dateKey??'',status:input.status??'DRAFT',data:input.data as Prisma.InputJsonValue,createdBy:ctx.actor.id,updatedBy:ctx.actor.id}}) as AiRecord<T>;
    await this.history(ctx,row);return row;
  }
  async update<T>(ctx:AiContext,row:AiRecord<T>,version:number,patch:{data?:T;status?:string;ownerId?:string|null;dateKey?:string}) {
    if(!Number.isInteger(version)||version<1||version!==row.version)throw new ConflictException('记录已变更，请刷新后核对');
    const changed=await ctx.tx.aiCenterRecord.updateMany({where:{id:row.id,organizationId:ctx.actor.organizationId,version},data:{...patch,data:patch.data as Prisma.InputJsonValue|undefined,updatedBy:ctx.actor.id,version:{increment:1}}});
    if(changed.count!==1)throw new ConflictException('记录已被其他人修改');
    const next=await this.get<T>(ctx,row.id);await this.history(ctx,next);return next;
  }
  private async history<T>(ctx:AiContext,row:AiRecord<T>) {
    await ctx.tx.aiCenterHistory.create({data:{recordId:row.id,version:row.version,actorId:ctx.actor.id,actorName:ctx.scope.self.name,snapshot:{kind:row.kind,ownerId:row.ownerId,status:row.status,dateKey:row.dateKey,data:row.data} as Prisma.InputJsonValue}});
  }
  view<T>(ctx:AiContext,row:AiRecord<T>):RecordView<T> {
    this.assertRead(ctx,row);
    const own=row.ownerId===ctx.actor.id;
    const selfTask=row.kind==='TASK'&&dataOf<TaskData>(row).sourceType==='SELF';
    const canEdit=selfTask?own&&((ctx.scope.isTrainee&&!dataOf<TaskData>(row).approvedAt&&['DRAFT','PROPOSED','DEFERRED','REJECTED'].includes(row.status))||['ACTIVE','RETURNED'].includes(row.status)):row.kind==='TASK'?(row.createdBy===ctx.actor.id&&['DRAFT','OPEN'].includes(row.status))||(own&&['PROPOSED','DEFERRED','ACTIVE','RETURNED'].includes(row.status)):row.kind==='IVY'?own&&row.dateKey===shanghaiToday():row.kind==='NOTE'?own&&['DRAFT','RETURNED'].includes(row.status):ctx.scope.isManager;
    return {id:row.id,kind:row.kind,ownerId:row.ownerId,ownerName:row.ownerId?ctx.scope.user(row.ownerId)?.name??'历史成员':'未接取',dateKey:row.dateKey,status:row.status,version:row.version,data:row.kind==='APPEAL'&&own?growthPublicAppeal(row.data):row.data,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),canEdit,canReview:this.canReviewRecord(ctx,row)};
  }
  review(ctx:AiContext,ownerId:string,value:unknown,comment='',reason=''):Review {
    const m=ctx.scope.members.get(ownerId)?.data;
    return {grade:grade(value),comment:text(comment,'评价',4000,false),reviewerId:ctx.actor.id,reviewerName:ctx.scope.self.name,reviewerRole:m?.aiMentorId===ctx.actor.id?'AI导师':m?.departmentMentorIds.includes(ctx.actor.id)?'对接部门导师':m?.legacyMentorId===ctx.actor.id?'原带教导师':ctx.scope.isManager?'AI中台主管':ctx.scope.reviewerIds(ownerId).includes(ctx.actor.id)?'导师直属上级':'任务发布人',at:new Date().toISOString(),...(reason?{reason:text(reason,'修改原因',1000)}:{})};
  }
  async notify(ctx:AiContext,row:AiRecord<unknown>,title:string,reason:string,recipients?:string[],includeActor=false) {
    const ids=[...new Set(recipients??(row.ownerId?ctx.scope.reviewerIds(row.ownerId):[]))].filter(id=>(includeActor||id!==ctx.actor.id)&&ctx.scope.user(id)?.active);
    for(const userId of ids) {
      const h=createHash('sha256').update([row.id,row.version,reason,userId].join(':')).digest('hex');
      const id=h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
      await ctx.tx.notification.upsert({where:{id},create:{id,userId,type:'SYSTEM',title:title.slice(0,200),body:row.ownerId?`${ctx.scope.user(row.ownerId)?.name??'管培生'} · ${reason}`:reason,entityType:'AI_CENTER',entityId:row.id},update:{}});
    }
  }
  async resolveNotifications(ctx:AiContext,id:string) { await ctx.tx.notification.updateMany({where:{entityType:'AI_CENTER',entityId:id,readAt:null,user:{organizationId:ctx.actor.organizationId}},data:{readAt:new Date()}}); }
}

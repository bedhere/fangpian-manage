import {ConflictException,ForbiddenException,Inject,Injectable,type OnModuleDestroy,type OnModuleInit} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../../infrastructure/prisma.service.js';
import {AiCenterRepository,weekStart} from './ai-center.repository.js';
import type {AiContext,AiRecord,IvyData,TaskData} from './ai-center.types.js';
import type {RequestUser} from '../auth/auth.types.js';
import {loadTaskIvyDays} from './ai-center-ivy-tasks.js';
import {formatIvyMessage,ivyRoutingHash,ivyHasMentorApproval} from './ivy-wecom-message.js';
import {WecomMessageClient,WecomMessageFailure} from './wecom-message.client.js';

const ACTIVE_SLOT='WECOM_IVY_PRIMARY';
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
@Injectable()
export class IvyWecomService implements OnModuleInit,OnModuleDestroy{
 private timer:ReturnType<typeof setInterval>|undefined;
 private running=false;
 constructor(@Inject(PrismaService) private readonly db:PrismaService,@Inject(AiCenterRepository) private readonly repo:AiCenterRepository,@Inject(WecomMessageClient) private readonly client:WecomMessageClient){}
 onModuleInit(){this.timer=setInterval(()=>void this.processOne(),15000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async enqueueSafely(ctx:AiContext,row:AiRecord<IvyData>){
  // 示例品牌 notification infrastructure failures from rolling back the diary.
  await ctx.tx.$executeRawUnsafe('SAVEPOINT ivy_wecom_enqueue');
  try{
   const result=await this.enqueue(ctx,row);
   await ctx.tx.$executeRawUnsafe('RELEASE SAVEPOINT ivy_wecom_enqueue');
   return result;
  }catch(error){
   await ctx.tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ivy_wecom_enqueue');
   await ctx.tx.$executeRawUnsafe('RELEASE SAVEPOINT ivy_wecom_enqueue');
   if((error as {code?:string}).code==='P2034')throw error;
   return {status:'UNAVAILABLE',targetName:null};
  }
 }
 async enqueue(ctx:AiContext,row:AiRecord<IvyData>){
  const channel=await ctx.tx.wecomIvyChannel.findUnique({where:{organizationId:ctx.actor.organizationId}});
  if(!channel?.enabled)return null;
  if(row.organizationId!==channel.organizationId||row.kind!=='IVY'||!row.ownerId||!ivyHasMentorApproval(row)||row.data.review!.reviewerId!==ctx.actor.id)throw new ConflictException('仅可在导师审核评级通过后推送日报');
  const tasks=await this.repo.list<TaskData>(ctx,'TASK',{ownerId:row.ownerId});
  const automatic=await loadTaskIvyDays(ctx,weekStart(row.dateKey),tasks,[row]);
  if(automatic.ivyTaskWarning)throw new Error('Automatic task snapshot unavailable');
  const entries=automatic.ivyTaskDays?.find(d=>d.ownerId===row.ownerId&&d.dateKey===row.dateKey)?.entries??[];
  const message=formatIvyMessage({recordId:row.id,recordVersion:row.version,dateKey:row.dateKey,ownerName:ctx.scope.user(row.ownerId)?.name??'管培生',savedAt:row.updatedAt.toISOString(),data:row.data,tasks:entries,target:channel});
  const routingHash=ivyRoutingHash(channel);
  const last=await ctx.tx.wecomIvyDelivery.findFirst({where:{channelId:channel.id,recordId:row.id},orderBy:{recordVersion:'desc'},select:{id:true,contentHash:true,routingHash:true,status:true,recordVersion:true}});
  if(last?.contentHash===message.contentHash&&last.routingHash===routingHash&&['PENDING','SENDING','SENT','UNKNOWN'].includes(last.status)){
   if(last.status==='PENDING')await ctx.tx.wecomIvyDelivery.updateMany({where:{id:last.id,status:'PENDING',recordVersion:last.recordVersion},data:{recordVersion:row.version,payload:{content:message.content,approvalVersion:row.version,approvalAt:row.data.review!.at}}});
   return {status:'UNCHANGED',targetName:channel.targetName};
  }
  if(last&&last.recordVersion>=row.version)return {status:last.status,targetName:channel.targetName};
  await ctx.tx.wecomIvyDelivery.updateMany({where:{channelId:channel.id,recordId:row.id,status:'PENDING'},data:{status:'SUPERSEDED',completedAt:new Date()}});
  await ctx.tx.wecomIvyDelivery.createMany({data:[{id:randomUUID(),channelId:channel.id,organizationId:ctx.actor.organizationId,recordId:row.id,recordVersion:row.version,contentHash:message.contentHash,routingHash,
   payload:{content:message.content,approvalVersion:row.version,approvalAt:row.data.review!.at},status:message.tooLong?'FAILED':'PENDING',...(message.tooLong?{errorCode:'TOO_LONG',errorMessage:'日报过长，已保存但未推送；请精简后重新保存',completedAt:new Date()}:{}),}],skipDuplicates:true});
  return {status:message.tooLong?'FAILED':'PENDING',targetName:channel.targetName};
 }
 async sendSaved(_actor:RequestUser,_id:string,_version:number):Promise<never>{
  throw new ForbiddenException('日报仅在导师审核评级通过时自动推送，不提供手动补发');
 }
 async summaries(ctx:AiContext,rows:AiRecord<IvyData>[]){
  const channel=await ctx.tx.wecomIvyChannel.findUnique({where:{organizationId:ctx.actor.organizationId},select:{id:true,enabled:true,targetName:true,targetAliases:true,chatType:true,testMode:true,pauseReason:true}});
  if(!channel?.enabled)return {};
  const ids=rows.filter(r=>this.repo.canRead(ctx,r)).map(r=>r.id);
  const deliveries=ids.length?await ctx.tx.wecomIvyDelivery.findMany({where:{organizationId:ctx.actor.organizationId,channelId:channel.id,routingHash:ivyRoutingHash(channel),recordId:{in:ids}},distinct:['recordId'],orderBy:[{recordId:'asc'},{recordVersion:'desc'}],select:{recordId:true,recordVersion:true,status:true,errorMessage:true,completedAt:true}}):[];
  return {ivyWecom:{enabled:true,targetName:channel.targetName,testMode:channel.testMode,pauseReason:channel.pauseReason,deliveries:deliveries.map(d=>({...d,completedAt:d.completedAt?.toISOString()??null}))}};
 }
 /** Only PENDING entries are eligible. Failed/unknown entries are never auto-retried. */
 async processOne(){
  if(this.running)return;this.running=true;
  try{
   const job=await this.db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261104,917)`;
    const stale=await tx.wecomIvyDelivery.findMany({where:{status:'SENDING',startedAt:{lt:new Date(Date.示例公司有限公司()-120000)}},select:{channelId:true}});
    if(stale.length){
     await tx.wecomIvyDelivery.updateMany({where:{status:'SENDING',startedAt:{lt:new Date(Date.示例公司有限公司()-120000)}},data:{status:'UNKNOWN',activeSlot:null,completedAt:new Date(),errorCode:'PROCESS_INTERRUPTED',errorMessage:'发送进程中断，结果需人工核对；未自动重发'}});
     await tx.wecomIvyChannel.updateMany({where:{id:{in:stale.map(s=>s.channelId)},pausedAt:null},data:{pausedAt:new Date(),pauseReason:'PROCESS_INTERRUPTED'}});
    }
    const active=await tx.wecomIvyDelivery.findFirst({where:{activeSlot:ACTIVE_SLOT},select:{id:true}});if(active)return null;
    const next=await tx.wecomIvyDelivery.findFirst({where:{status:'PENDING',channel:{enabled:true,pausedAt:null}},orderBy:{createdAt:'asc'},include:{channel:true}});if(!next)return null;
    if(next.organizationId!==next.channel.organizationId||next.routingHash!==ivyRoutingHash(next.channel)){
     await tx.wecomIvyDelivery.update({where:{id:next.id},data:{status:'SUPERSEDED',completedAt:new Date(),errorCode:'ROUTING_CHANGED',errorMessage:'接收设置已变更，旧消息未转发给新对象'}});return null;
    }
    const record=await tx.aiCenterRecord.findFirst({where:{id:next.recordId,organizationId:next.organizationId,kind:'IVY'},select:{id:true,version:true,status:true,ownerId:true,data:true}});
    if(!record){await tx.wecomIvyDelivery.update({where:{id:next.id},data:{status:'FAILED',completedAt:new Date(),errorCode:'RECORD_UNAVAILABLE',errorMessage:'原日报不存在，未发送'}});return null;}
    const approvalPayload=next.payload as {approvalVersion?:unknown;approvalAt?:unknown};
    if(!ivyHasMentorApproval(record)||record.version!==next.recordVersion||approvalPayload.approvalVersion!==next.recordVersion||approvalPayload.approvalAt!==(record.data as unknown as IvyData).review?.at){
     await tx.wecomIvyDelivery.update({where:{id:next.id},data:{status:'SUPERSEDED',completedAt:new Date(),errorCode:'REVIEW_VERSION_CHANGED',errorMessage:'日报尚未通过导师评级或审核版本已变更，旧快照未发送'}});return null;
    }
    const claimed=await tx.wecomIvyDelivery.updateMany({where:{id:next.id,status:'PENDING'},data:{status:'SENDING',startedAt:new Date(),activeSlot:ACTIVE_SLOT}});
    return claimed.count===1?next:null;
   });
   if(!job)return;
   try{
    const payload=job.payload as {content?:unknown};
    if(typeof payload.content!=='string')throw new WecomMessageFailure('INVALID_PAYLOAD','消息内容无效，原日报保留');
    await this.client.send(job.channel,payload.content,async()=>{
     const delay=await this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261104,918)`;
      const current=await tx.wecomIvyChannel.findUniqueOrThrow({where:{id:job.channelId}});
      if(!current.enabled||current.pausedAt||ivyRoutingHash(current)!==job.routingHash)throw new WecomMessageFailure('CHANNEL_PAUSED','消息发送已暂停或接收设置已变更');
      const clock=await tx.wecomIvyChannel.aggregate({_max:{nextCallAt:true}});
      const start=Math.max(Date.示例公司有限公司(),clock._max.nextCallAt?.getTime()??0);
      if(start-Date.示例公司有限公司()>15000)throw new WecomMessageFailure('CLOCK_SKEW','发送时间窗口异常，已暂停发送',false,true);
      await tx.wecomIvyChannel.update({where:{id:current.id},data:{nextCallAt:new Date(start+4500)}});
      return Math.max(0,start-Date.示例公司有限公司());
     });
     if(delay)await wait(delay);
     const [current,delivery,approvedRecord]=await Promise.all([this.db.wecomIvyChannel.findUnique({where:{id:job.channelId}}),this.db.wecomIvyDelivery.findUnique({where:{id:job.id},select:{status:true,activeSlot:true}}),this.db.aiCenterRecord.findFirst({where:{id:job.recordId,organizationId:job.organizationId,kind:'IVY'},select:{id:true,version:true,status:true,ownerId:true,data:true}})]);
     if(!approvedRecord||!ivyHasMentorApproval(approvedRecord)||approvedRecord.version!==job.recordVersion||(job.payload as {approvalAt?:unknown}).approvalAt!==(approvedRecord.data as unknown as IvyData).review?.at)throw new WecomMessageFailure('DIARY_REVIEW_CHANGED','日报审核版本已变更，未继续发送');
     if(!current?.enabled||current.pausedAt||ivyRoutingHash(current)!==job.routingHash||delivery?.status!=='SENDING'||delivery.activeSlot!==ACTIVE_SLOT)throw new WecomMessageFailure('CHANNEL_PAUSED','消息发送已暂停或接收设置已变更');
    });
    await this.db.wecomIvyDelivery.updateMany({where:{id:job.id,status:'SENDING'},data:{status:'SENT',activeSlot:null,completedAt:new Date()}});
   }catch(error){
    const failure=error instanceof WecomMessageFailure?error:new WecomMessageFailure('DELIVERY_UNCONFIRMED','发送结果未确认，请核对企微后处理',true,true);
    await this.db.$transaction(async tx=>{
     await tx.wecomIvyDelivery.updateMany({where:{id:job.id,status:'SENDING'},data:{status:failure.uncertain?'UNKNOWN':'FAILED',activeSlot:null,completedAt:new Date(),errorCode:failure.code,errorMessage:failure.message}});
     if(failure.pause)await tx.wecomIvyChannel.updateMany({where:{id:job.channelId,pausedAt:null},data:{pausedAt:new Date(),pauseReason:failure.code}});
    });
   }
  }catch{/* Do not log message bodies, credentials or raw provider responses. */}
  finally{this.running=false;}
 }
}

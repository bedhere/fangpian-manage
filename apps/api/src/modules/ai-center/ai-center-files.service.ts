import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, CopyConditions } from 'minio';
import { randomUUID } from 'node:crypto';
import type { RequestUser } from '../auth/auth.types.js';
import { AiCenterRepository, text } from './ai-center.repository.js';
import type { AiContext, AiRecord, TaskData } from './ai-center.types.js';

@Injectable()
export class AiCenterFilesService {
  private readonly client:Client;private readonly bucket='ai-center-private';private init:Promise<void>|null=null;
  constructor(@Inject(AiCenterRepository) private readonly repo:AiCenterRepository,@Inject(ConfigService) config:ConfigService) {
    this.client=new Client({endPoint:config.get<string>('MINIO_ENDPOINT','localhost'),port:Number(config.get<string>('MINIO_PORT','9000')),useSSL:config.get<string>('MINIO_USE_SSL','false')==='true',accessKey:config.getOrThrow<string>('MINIO_ACCESS_KEY'),secretKey:config.getOrThrow<string>('MINIO_SECRET_KEY')});
  }
  private async ready() {
    if(!this.init)this.init=(async()=>{if(!await this.client.bucketExists(this.bucket))await this.client.makeBucket(this.bucket);else {try {const policy=await this.client.getBucketPolicy(this.bucket);if(policy)throw new Error('Private bucket unexpectedly has policy');}catch(error){const code=(error as {code?:string}).code;if(code!=='NoSuchBucketPolicy'&&code!=='NoSuchBucket'&&(error as Error).message!=='The specified bucket does not have a bucket policy.')throw error;}}})().catch(()=>{this.init=null;throw new ServiceUnavailableException('私有附件存储暂不可用，请联系管理员；未生成公开文件链接');});
    return this.init;
  }
  private meta(row:{id:string;filename:string;mimeType:string;size:bigint;status:string;createdAt:Date}) {return {id:row.id,filename:row.filename,mimeType:row.mimeType,size:Number(row.size),status:row.status,createdAt:row.createdAt.toISOString()};}
  private canUpload(ctx:AiContext,row:AiRecord<unknown>) {
    this.repo.assertRead(ctx,row);
    if(row.kind==='NOTE')return row.ownerId===ctx.actor.id&&['DRAFT','RETURNED'].includes(row.status);
    if(row.kind==='TASK'){
      const data=row.data as TaskData;
      if(data.sourceType==='SELF')return row.ownerId===ctx.actor.id&&data.assigneeId===ctx.actor.id&&((ctx.scope.isTrainee&&row.createdBy===ctx.actor.id&&row.status==='DRAFT'&&!data.approvedAt)||['ACTIVE','RETURNED'].includes(row.status));
      return (row.createdBy===ctx.actor.id&&ctx.scope.canPublish&&['DRAFT','OPEN'].includes(row.status)&&!data.assigneeId)||(row.ownerId===ctx.actor.id&&['PROPOSED','DEFERRED','ACTIVE','RETURNED'].includes(row.status));
    }
    return false;
  }
  async list(actor:RequestUser,id:string) {return this.repo.withActor(actor,async ctx=>{const row=await this.repo.get(ctx,id);this.repo.assertRead(ctx,row);const files=await ctx.tx.aiCenterFile.findMany({where:{recordId:id,...(this.canUpload(ctx,row)?{}:{status:'READY'})},select:{id:true,filename:true,mimeType:true,size:true,status:true,createdAt:true},orderBy:{createdAt:'asc'}});return files.map(f=>this.meta(f));},false);}
  async grant(actor:RequestUser,id:string,input:{filename:string;mimeType:string;size:number;version:number}) {
    const filename=text(input.filename,'文件名',240).replace(/[\x00-\x1f/\\]/g,'_');
    if(!Number.isSafeInteger(input.size)||input.size<=0||input.size>500*1024*1024)throw new BadRequestException('单文件上限500MB');
    const file=await this.repo.withActor(actor,async ctx=>{
      const row=await this.repo.get(ctx,id,['TASK','NOTE']);if(!this.canUpload(ctx,row))throw new ForbiddenException('当前状态不能新增或替换附件');
      if(row.version!==input.version)throw new ConflictException('记录已变更，请刷新');
      const pending=await ctx.tx.aiCenterFile.findFirst({where:{recordId:id,ownerId:actor.id,filename,size:BigInt(input.size),status:'PENDING'},select:{id:true,filename:true,mimeType:true,size:true,status:true,createdAt:true,storageKey:true},orderBy:{createdAt:'desc'}});if(pending)return pending;
      const count=await ctx.tx.aiCenterFile.count({where:{recordId:id}});if(count>=100)throw new BadRequestException('每条记录最多100个附件');
      return ctx.tx.aiCenterFile.create({data:{recordId:id,ownerId:actor.id,filename,mimeType:'application/octet-stream',size:BigInt(input.size),storageKey:`organizations/${actor.organizationId}/records/${id}/${randomUUID()}`},select:{id:true,filename:true,mimeType:true,size:true,status:true,createdAt:true,storageKey:true}});
    });
    await this.ready();
    try {const uploadUrl=await this.client.presignedPutObject(this.bucket,file.storageKey,30*60);const {storageKey:_key,...safe}=file;return {file:this.meta(safe),uploadUrl};}catch{throw new ServiceUnavailableException('暂时无法签发上传地址，原记录未改动');}
  }
  async complete(actor:RequestUser,id:string) {
    const file=await this.repo.withActor(actor,async ctx=>{const f=await ctx.tx.aiCenterFile.findUnique({where:{id}});if(!f||f.ownerId!==actor.id)throw new NotFoundException('文件不存在');const row=await this.repo.get(ctx,f.recordId,['TASK','NOTE']);if(!this.canUpload(ctx,row))throw new ForbiddenException('记录状态已变更，不能确认附件');return f;},false);
    if(file.status==='READY')return this.meta(file);
    await this.ready();let size:number,etag:string;
    try{const stat=await this.client.statObject(this.bucket,file.storageKey);size=stat.size;etag=stat.etag;}catch{throw new BadRequestException('文件尚未上传完成，请稍后手动确认或重新上传');}
    if(size!==Number(file.size)||size>500*1024*1024)throw new BadRequestException('实际文件大小不符，未接纳为正式附件');
    let mimeType='application/octet-stream';const name=file.filename.toLowerCase();
    try {
      const stream=await this.client.getPartialObject(this.bucket,file.storageKey,0,32);const chunks:Buffer[]=[];for await(const c of stream)chunks.push(Buffer.from(c));const head=Buffer.concat(chunks);
      if(name.endsWith('.pdf')&&head.subarray(0,5).toString()==='%PDF-')mimeType='application/pdf';
      else if(/\.png$/.test(name)&&head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mimeType='image/png';
      else if(/\.jpe?g$/.test(name)&&head[0]===255&&head[1]===216)mimeType='image/jpeg';
      else if(name.endsWith('.gif')&&head.subarray(0,4).toString()==='GIF8')mimeType='image/gif';
      else if(name.endsWith('.webp')&&head.subarray(0,4).toString()==='RIFF'&&head.subarray(8,12).toString()==='WEBP')mimeType='image/webp';
      else if(name.endsWith('.mp3')&&(head.subarray(0,3).toString()==='ID3'||head[0]===255&&(head[1]&224)===224))mimeType='audio/mpeg';
      else if(name.endsWith('.mp4')&&head.subarray(4,8).toString()==='ftyp')mimeType='video/mp4';
      else if(/\.(txt|md|csv)$/.test(name))mimeType='text/plain; charset=utf-8';
      // Copy to a new immutable key. The temporary PUT URL can never overwrite approved evidence.
      const finalKey=file.storageKey+'/ready-'+randomUUID();const conditions=new CopyConditions();conditions.setMatchETag(etag);
      await this.client.copyObject(this.bucket,finalKey,`${this.bucket}/${file.storageKey}`,conditions);
      return await this.repo.withActor(actor,async ctx=>{const row=await this.repo.get(ctx,file.recordId,['TASK','NOTE']);if(!this.canUpload(ctx,row))throw new ConflictException('记录已提交，未改动其附件');const current=await ctx.tx.aiCenterFile.findUniqueOrThrow({where:{id}});if(current.status==='READY')return this.meta(current);const f=await ctx.tx.aiCenterFile.update({where:{id},data:{status:'READY',etag,mimeType,storageKey:finalKey},select:{id:true,filename:true,mimeType:true,size:true,status:true,createdAt:true}});return this.meta(f);});
    } catch(error) {if(error instanceof ConflictException||error instanceof ForbiddenException)throw error;throw new BadRequestException('文件校验期间内容发生变化或存储不可用，请重新上传；未改动已提交材料');}
  }
  async download(actor:RequestUser,id:string) {
    const file=await this.repo.withActor(actor,async ctx=>{const f=await ctx.tx.aiCenterFile.findUnique({where:{id}});if(!f||f.status!=='READY')throw new NotFoundException('文件不存在或未确认');this.repo.assertRead(ctx,await this.repo.get(ctx,f.recordId));return f;},false);
    await this.ready();try {const inline=/^(image\/(png|jpeg|gif|webp)|audio\/mpeg|video\/mp4|application\/pdf|text\/plain)/.test(file.mimeType);const url=await this.client.presignedGetObject(this.bucket,file.storageKey,5*60,{'response-content-type':file.mimeType,'response-content-disposition':`${inline?'inline':'attachment'}; filename="download"; filename*=UTF-8''${encodeURIComponent(file.filename)}`});return {url,filename:file.filename};}catch{throw new ServiceUnavailableException('文件下载暂不可用，请稍后重试');}
  }
}

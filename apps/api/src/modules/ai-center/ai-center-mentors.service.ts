import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestUser } from '../auth/auth.types.js';
import { AiCenterRepository, MENTOR_APPROVER_ID, text } from './ai-center.repository.js';
import type { AiContext, AiRecord, MemberData, MentorConfiguration, MentorRequest } from './ai-center.types.js';
import { sameMentorConfiguration, validateMentorSelection } from './mentor-policy.js';
import type { MentorCancelDto, MentorRequestDto, MentorReviewDto } from './ai-center-mentors.dto.js';

@Injectable()
export class AiCenterMentorsService {
  constructor(@Inject(AiCenterRepository) private readonly repo:AiCenterRepository) {}
  private async member(ctx:AiContext,ownerId:string) {
    const record=ctx.scope.members.get(ownerId);if(!record)throw new BadRequestException('管培生培养记录不存在');
    return this.repo.get<MemberData>(ctx,record.id,'MEMBER');
  }
  private own(ctx:AiContext,row:AiRecord<MemberData>) {
    if(row.ownerId!==ctx.actor.id||!ctx.scope.isTrainee||!row.data.active)throw new ForbiddenException('仅有效管培生本人可提交或撤回自己的申请');
  }
  private current(row:AiRecord<MemberData>,version:number) {if(row.version!==version)throw new ConflictException('导师配置或申请已更新，请刷新核对后再提交');}
  private config(data:MentorConfiguration):MentorConfiguration {return {active:data.active,aiMentorId:data.aiMentorId,departmentMentorIds:[...data.departmentMentorIds]};}
  async request(actor:RequestUser,input:MentorRequestDto) {
    return this.repo.withActor(actor,async ctx=>{
      const row=await this.member(ctx,actor.id);this.own(ctx,row);this.current(row,input.version);
      if(!ctx.scope.mentorApproverAvailable)throw new BadRequestException('AI中台总负责人当前不可用，请联系管理员；原导师配置保留');
      validateMentorSelection(ctx,actor.id,input.aiMentorId,input.departmentMentorIds,true);
      const comment=text(input.comment??'','申请说明',1000,false);
      const proposed={active:row.data.active,aiMentorId:input.aiMentorId,departmentMentorIds:input.departmentMentorIds};
      if(sameMentorConfiguration(row.data,proposed))throw new BadRequestException('选择与当前生效导师一致，无需重复申请');
      const old=row.data.mentorRequest;
      if(old?.status==='PENDING'&&sameMentorConfiguration({...old,active:row.data.active},proposed)&&old.comment===comment)throw new ConflictException('同一申请已在审核中，无需重复提交');
      const request:MentorRequest={id:randomUUID(),status:'PENDING',aiMentorId:input.aiMentorId,departmentMentorIds:[...input.departmentMentorIds],comment,submittedBy:actor.id,submittedAt:new Date().toISOString(),base:this.config(row.data)};
      const next=await this.repo.update(ctx,row,input.version,{data:{...row.data,mentorRequest:request}});
      await this.repo.resolveNotifications(ctx,row.id);
      await this.repo.notify(ctx,next,'导师配置申请待审核','请核对本人申请的AI导师和部门导师',[MENTOR_APPROVER_ID]);
      return this.repo.view(ctx,next);
    });
  }
  async cancel(actor:RequestUser,input:MentorCancelDto) {
    return this.repo.withActor(actor,async ctx=>{
      const row=await this.member(ctx,actor.id);this.own(ctx,row);this.current(row,input.version);
      if(row.data.mentorRequest?.status!=='PENDING')throw new ConflictException('当前没有可撤回的待审申请');
      const request:MentorRequest={...row.data.mentorRequest,status:'CANCELLED',decisionComment:'申请人已撤回，原生效导师配置保留。'};
      const next=await this.repo.update(ctx,row,input.version,{data:{...row.data,mentorRequest:request}});
      await this.repo.resolveNotifications(ctx,row.id);return this.repo.view(ctx,next);
    });
  }
  async review(actor:RequestUser,ownerId:string,input:MentorReviewDto) {
    return this.repo.withActor(actor,async ctx=>{
      if(!ctx.scope.canApproveMentors||actor.id===ownerId)throw new ForbiddenException('仅指定AI中台总负责人可审批他人的导师配置申请');
      const row=await this.member(ctx,ownerId);this.current(row,input.version);
      const request=row.data.mentorRequest;
      if(!request||request.status!=='PENDING'||request.id!==input.requestId)throw new ConflictException('申请已变更或已处理，请刷新核对');
      if(!sameMentorConfiguration(row.data,request.base))throw new ConflictException('原生效配置已变化，旧申请不能覆盖；请由本人重新提交');
      const approve=input.decision==='APPROVE';
      const comment=text(input.comment??'','审核说明',1000,!approve);
      if(!approve&&comment.length<2)throw new BadRequestException('驳回时请填写至少两字的具体原因');
      if(approve) {
        if(!row.data.active||!ctx.scope.user(ownerId)?.active)throw new BadRequestException('管培生当前已停用，不能批准');
        validateMentorSelection(ctx,ownerId,request.aiMentorId,request.departmentMentorIds,true);
        const profile=await ctx.tx.traineeProfile.findFirst({where:{organizationId:actor.organizationId,userId:ownerId},select:{userId:true}});
        if(!profile)throw new BadRequestException('培养档案缺失，原配置未改动，请联系管理员');
      }
      const reviewed:MentorRequest={...request,status:approve?'APPROVED':'REJECTED',reviewerId:actor.id,reviewerName:ctx.scope.self.name,reviewedAt:new Date().toISOString(),decisionComment:comment};
      const data:MemberData={...row.data,mentorRequest:reviewed,...(approve?{aiMentorId:request.aiMentorId,departmentMentorIds:[...request.departmentMentorIds]}:{})};
      const next=await this.repo.update(ctx,row,input.version,{data});
      if(approve)await ctx.tx.traineeProfile.update({where:{userId:ownerId},data:{mentorId:request.aiMentorId}});
      await this.repo.resolveNotifications(ctx,row.id);
      await this.repo.notify(ctx,next,approve?'导师配置申请已通过':'导师配置申请已驳回',approve?'新导师配置已生效':comment,approve?[ownerId,request.aiMentorId,...request.departmentMentorIds]:[ownerId]);
      return this.repo.view(ctx,next);
    });
  }
}

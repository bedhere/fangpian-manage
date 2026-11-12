import { BadRequestException } from '@nestjs/common';
import { AI_DEPARTMENT_ID } from './ai-center.repository.js';
import type { AiContext, MentorConfiguration } from './ai-center.types.js';
export function validateMentorSelection(ctx:AiContext,ownerId:string,aiMentorId:string|null,departmentMentorIds:string[],requireComplete:boolean) {
  const ids=[aiMentorId,...departmentMentorIds].filter((id):id is string=>!!id);
  if(departmentMentorIds.length>20||new Set(ids).size!==ids.length||ids.includes(ownerId))throw new BadRequestException('导师不能重复或选择本人，部门导师最多20名');
  if(ids.some(id=>!ctx.scope.user(id)?.active||!ctx.scope.user(id)?.employee))throw new BadRequestException('请选择本组织有效员工担任导师');
  if(aiMentorId&&ctx.scope.user(aiMentorId)?.departmentId!==AI_DEPARTMENT_ID)throw new BadRequestException('AI导师只能选择AI中台部门的有效员工');
  if(requireComplete&&(!aiMentorId||!departmentMentorIds.length))throw new BadRequestException('须选择1名AI导师和至少1名部门导师');
}
export function sameMentorConfiguration(a:MentorConfiguration,b:MentorConfiguration) {
  return a.active===b.active&&a.aiMentorId===b.aiMentorId&&[...a.departmentMentorIds].sort().join(',')===[...b.departmentMentorIds].sort().join(',');
}

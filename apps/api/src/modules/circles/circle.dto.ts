import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateCircleDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(5000) topic!: string;
  @IsIn(['ORGANIZATION', 'DEPARTMENT', 'MEMBERS']) visibility!:
    'ORGANIZATION' | 'DEPARTMENT' | 'MEMBERS';
  @IsOptional() @IsUUID() opportunityId?: string;
  @IsOptional() @IsUUID() businessRequestId?: string;
  @IsOptional() @IsUUID() projectId?: string;
}
export class CircleMessageDto {
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
}
export class CircleReviewDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
}
export class CircleInviteDto {
  @IsUUID() userId!: string;
}
export class CircleDiscussionDto {
  @IsString() @MinLength(1) @MaxLength(10000) content!: string;
}
export class CircleKnowledgeDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(5) @MaxLength(1000) summary!: string;
}

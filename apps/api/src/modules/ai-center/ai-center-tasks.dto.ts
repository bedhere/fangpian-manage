import { IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import type { Grade, Priority } from './ai-center.types.js';
export class TaskVersionDto { @IsInt() @Min(1) version: number; }
export class CreateAiTaskDto {
  @IsString() @Length(1,200) title: string;
  @IsString() @Length(1,12000) description: string;
  @IsString() @Length(1,12000) acceptanceCriteria: string;
  @IsIn(['P0','P1','P2','P3']) priority: Priority;
  @IsISO8601({strict:true}) dueAt: string;
  @IsOptional() @IsUUID() targetUserId?: string|null;
  @IsBoolean() publish: boolean;
}
export class UpdateAiTaskDto extends CreateAiTaskDto { @IsInt() @Min(1) version: number; }
export class CreateSelfTaskDto {
  @IsString() @Length(1,200) title:string;
  @IsString() @Length(1,12000) description:string;
  @IsString() @Length(1,12000) acceptanceCriteria:string;
  @IsIn(['P0','P1','P2','P3']) priority:Priority;
  @IsISO8601({strict:true}) dueAt:string;
  @IsIn(['S','A','B','C']) selfDifficulty:Grade;
  @IsBoolean() submit:boolean;
  @IsOptional() @IsUUID() requestKey?:string;
}
export class UpdateSelfTaskDto extends CreateSelfTaskDto { @IsInt() @Min(1) version:number; }
export class TaskDifficultyDto extends TaskVersionDto { @IsIn(['S','A','B','C']) selfDifficulty: Grade; }
export class TaskDecisionDto extends TaskVersionDto {
  @IsIn(['APPROVE','REJECT','DEFER']) decision: 'APPROVE'|'REJECT'|'DEFER';
  @IsOptional() @IsIn(['S','A','B','C']) confirmedDifficulty?: Grade;
  @IsOptional() @IsISO8601({strict:true}) dueAt?: string;
  @IsOptional() @IsString() @Length(0,4000) comment?: string;
}
export class TaskProgressDto extends TaskVersionDto {
  @IsNumber({allowNaN:false,allowInfinity:false}) @Min(0) @Max(100) progress: number;
  @IsOptional() @IsString() @Length(0,4000) note?: string;
}
export class TaskSubmitDto extends TaskVersionDto { @IsString() @Length(1,12000) submission: string; }
export class TaskReviewDto extends TaskVersionDto {
  @IsIn(['APPROVE','RETURN']) decision: 'APPROVE'|'RETURN';
  @IsOptional() @IsIn(['S','A','B','C']) grade?: Grade;
  @IsOptional() @IsNumber({allowNaN:false,allowInfinity:false}) @Min(0) @Max(1) completionRatio?: number;
  @IsOptional() @IsString() @Length(0,4000) comment?: string;
  @IsOptional() @IsString() @Length(0,1000) reason?: string;
}
export class TaskDeclineDto extends TaskVersionDto { @IsString() @Length(1,4000) comment: string; }
export class LinkDecisionDto extends TaskVersionDto {
  @IsIn(['APPROVE','REJECT']) decision: 'APPROVE'|'REJECT';
  @IsOptional() @IsString() @Length(0,4000) comment?: string;
}


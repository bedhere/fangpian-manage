import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
export class CreateMilestoneDto {
  @IsString() @MinLength(2) title!: string;
  @IsString() description!: string;
  @IsString() dueAt!: string;
  @IsNumber() @Min(0.01) @Max(100) weight!: number;
  @IsString() expectedDeliverable!: string;
  @IsOptional() @IsString() objective?: string;
}
export class ProgressDto {
  @IsInt() @Min(0) @Max(100) progressPercent!: number;
  @IsString() summary!: string;
  @IsOptional() @IsString() blockers?: string;
  @IsInt() @Min(0) @Max(3) riskLevel!: number;
  @IsString() nextAction!: string;
}
export class RiskActionDto {
  @IsString() reason!: string;
  @IsString() remediationPlan!: string;
  @IsString() dueAt!: string;
}
export class ReplaceOwnerDto {
  @IsUUID() newOwnerId!: string;
  @IsString() reason!: string;
}

export class FailProjectDto {
  @IsString() @MinLength(2) reason!: string;
  @IsBoolean() maliciousAbandonment!: boolean;
}

export class SavePlanDto {
  @IsString() @MinLength(2) objective!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateMilestoneDto)
  milestones!: CreateMilestoneDto[];
}

export class InviteMemberDto {
  @IsUUID() userId!: string;
  @IsIn(['CONTRIBUTOR', 'SUPERVISOR', 'REVIEWER']) role!: 'CONTRIBUTOR' | 'SUPERVISOR' | 'REVIEWER';
}

export class RespondInvitationDto {
  @IsBoolean() accept!: boolean;
}

export class SaveTimelineNodeDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MaxLength(4000) description!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string | null;
  @IsIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']) status!: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
}

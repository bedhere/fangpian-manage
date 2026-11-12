import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class SetCapacityDto {
  @IsString() periodStart!: string;
  @IsString() periodEnd!: string;
  @IsNumber() @Min(0) availableHours!: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class SetSkillsDto {
  @IsArray() skills!: Array<{
    skillId: string;
    proficiency: number;
    evidence?: string;
  }>;
}
export class UpdateMyProfileDto {
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MaxLength(100) timezone?: string;
}
export class ApplyProjectDto {
  @IsString() @MinLength(5) motivation!: string;
  @IsNumber() @Min(0.25) estimatedHours!: number;
  @IsString() @MinLength(2) relevantExperience!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class MarketQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['P0', 'P1', 'P2', 'P3', 'P4']) projectLevel?: string;
  @IsOptional() @IsIn(['L0', 'L1', 'L2', 'L3', 'L4']) requiredCapabilityLevel?: string;
}
export class DecideApplicationDto {
  @IsIn(['APPROVED', 'SPECIAL_APPROVED', 'REJECTED']) decision!:
    | 'APPROVED'
    | 'SPECIAL_APPROVED'
    | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class AddMemberDto {
  @IsUUID() userId!: string;
  @IsIn(['CONTRIBUTOR', 'SUPERVISOR', 'REVIEWER']) role!:
    'CONTRIBUTOR' | 'SUPERVISOR' | 'REVIEWER';
}
export class AssignOwnerDto {
  @IsUUID() applicationId!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

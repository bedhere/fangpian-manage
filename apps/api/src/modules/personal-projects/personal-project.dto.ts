import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export const PERSONAL_PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'PAUSED', 'DONE'] as const;
export type PersonalProjectStatusValue = (typeof PERSONAL_PROJECT_STATUSES)[number];

export class CreatePersonalProjectDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString({ each: true }) @MaxLength(200, { each: true }) tasks?: string[];
}

export class UpdatePersonalProjectDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsIn(PERSONAL_PROJECT_STATUSES) status?: PersonalProjectStatusValue;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsDateString() startDate?: string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsDateString() dueDate?: string | null;
}

export class CreatePersonalTaskDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdatePersonalTaskDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsDateString() dueDate?: string | null;
}

export class CreatePersonalUpdateDto {
  @IsString() @MinLength(1) @MaxLength(4000) content!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}

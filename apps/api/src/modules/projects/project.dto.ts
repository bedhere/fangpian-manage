import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListProjectsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['ALL', 'MINE', 'OWNED', 'PUBLISHED', 'DEPARTMENT']) view: 'ALL' | 'MINE' | 'OWNED' | 'PUBLISHED' | 'DEPARTMENT' = 'MINE';
  @IsOptional() @IsString() status?: string;
}
export class CreateProjectDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) description!: string;
  @IsString() @MinLength(5) businessProblem!: string;
  @IsString() @MinLength(5) expectedResult!: string;
  @IsString() @MinLength(5) acceptanceCriteria!: string;
  @IsOptional() @IsString() deadline?: string;
}
export class ManualTriageDto {
  @IsOptional() @IsObject() assessment?: Record<string, unknown>;
}
export class ReviewProjectDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsIn(['APPROVED', 'REJECTED', 'REVISION_REQUIRED']) decision!:
    'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';
  @IsOptional() @IsString() @MaxLength(4000) comment?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) businessValueScore?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) technicalComplexityScore?: number;
  @IsOptional() @IsNumber() @Min(0.25) approvedHours?: number;
  @IsOptional() @IsIn(['P0', 'P1', 'P2', 'P3', 'P4']) projectLevel?:
    'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  @IsOptional() @IsInt() @Min(0) @Max(4) requiredCapabilityLevel?: number;
}

export class ResubmitProjectDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

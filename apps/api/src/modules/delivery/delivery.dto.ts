import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export enum DeliverableTypeDto {
  FILE = 'FILE',
  LINK = 'LINK',
  TEXT = 'TEXT',
  REPOSITORY = 'REPOSITORY',
  OTHER = 'OTHER',
}
export enum AcceptanceRoleDto {
  PUBLISHER_BUSINESS = 'PUBLISHER_BUSINESS',
  DEPARTMENT_HEAD_BUSINESS = 'DEPARTMENT_HEAD_BUSINESS',
  OWNER_MANAGER_TECHNICAL = 'OWNER_MANAGER_TECHNICAL',
}
export enum AcceptanceDecisionDto {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
}

export class SubmitDeliveryDto {
  @IsEnum(DeliverableTypeDto) type!: DeliverableTypeDto;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsOptional() @IsString() storageKey?: string;
  @IsString() @MinLength(2) changeSummary!: string;
}

export class DeliveryReviewDto {
  @IsInt() @Min(0) @Max(100) businessFit!: number;
  @IsInt() @Min(0) @Max(100) technicalQuality!: number;
  @IsInt() @Min(0) @Max(100) completeness!: number;
  @IsInt() @Min(0) @Max(100) risk!: number;
  @IsEnum(['S', 'A', 'B', 'C', 'FAIL']) suggestedGrade!:
    'S' | 'A' | 'B' | 'C' | 'FAIL';
  @IsString() @MinLength(2) reasoningSummary!: string;
  @IsArray() @IsString({ each: true }) issues!: string[];
  @IsArray() @IsString({ each: true }) recommendations!: string[];
}

export class AcceptanceDto {
  @IsEnum(AcceptanceRoleDto) role!: AcceptanceRoleDto;
  @IsEnum(AcceptanceDecisionDto) decision!: AcceptanceDecisionDto;
  @IsInt() @Min(0) @Max(100) score!: number;
  @IsString() @MinLength(2) comment!: string;
}

export class ExecutiveConfirmationDto {
  @IsString() @MinLength(2) note!: string;
}

export class DeliveryUploadDto {
  @IsString() @MinLength(1) filename!: string;
  @IsString() @MinLength(1) contentType!: string;
}

import { IsIn, IsObject, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateKnowledgeAssetDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(5) @MaxLength(1000) summary!: string;
  @IsObject() content!: Record<string, unknown>;
  @IsOptional() @IsIn(['PLAYBOOK', 'TEMPLATE', 'CASE_STUDY', 'PROMPT', 'TOOL', 'OTHER']) assetType?: 'PLAYBOOK' | 'TEMPLATE' | 'CASE_STUDY' | 'PROMPT' | 'TOOL' | 'OTHER';
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) sourceUrl?: string;
  @IsOptional() @IsUUID() requestId?: string;
  @IsOptional() @IsUUID() sessionId?: string;
}

export class ReuseKnowledgeAssetDto {
  @IsIn(['REQUEST', 'PROJECT']) referenceType!: 'REQUEST' | 'PROJECT';
  @IsUUID() referenceId!: string;
  @IsString() @MinLength(8) @MaxLength(200) idempotencyKey!: string;
}

export class ReviewKnowledgeAssetDto {
  @IsIn(['BUSINESS', 'TECHNICAL']) stage!: 'BUSINESS' | 'TECHNICAL';
  @IsIn(['APPROVED', 'REJECTED', 'REVISION_REQUIRED']) decision!: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';
  @IsOptional() @IsString() @MaxLength(4000) comment?: string;
}

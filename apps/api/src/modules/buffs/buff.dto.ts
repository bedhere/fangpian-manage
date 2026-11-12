import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateBuffDto {
  @IsUUID() knowledgeAssetId!: string;
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsString() @MinLength(5) @MaxLength(2000) description!: string;
  @IsIn(['PROMPT', 'AGENT', 'WORKFLOW', 'TOOL']) type!:
    'PROMPT' | 'AGENT' | 'WORKFLOW' | 'TOOL';
  @IsArray() @IsString({ each: true }) permissionCodes!: string[];
  @IsString() @MinLength(5) instructions!: string;
  @IsObject() inputSchema!: Record<string, unknown>;
}
export class CreateBuffVersionDto {
  @IsString() @MinLength(5) instructions!: string;
  @IsObject() inputSchema!: Record<string, unknown>;
}
export class RunBuffDto {
  @IsObject() input!: Record<string, unknown>;
  @IsString() @MinLength(8) @MaxLength(200) idempotencyKey!: string;
  @IsOptional() @IsIn(['REQUEST', 'PROJECT', 'CIRCLE']) contextType?:
    'REQUEST' | 'PROJECT' | 'CIRCLE';
  @IsOptional() @IsUUID() contextId?: string;
}

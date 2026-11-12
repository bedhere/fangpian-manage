import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBusinessRequestDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(5) @MaxLength(4000) problem!: string;
  @IsString() @MinLength(5) @MaxLength(4000) businessContext!: string;
  @IsString() @MinLength(5) @MaxLength(4000) expectedOutcome!: string;
  @IsOptional() @IsString() @MaxLength(4000) constraints?: string;
}

export class DiagnoseBusinessRequestDto {
  @IsOptional() @IsObject() assessment?: Record<string, unknown>;
  @IsOptional() @IsIn(['AUTO', 'AI', 'HUMAN']) route?: 'AUTO' | 'AI' | 'HUMAN';
}

export class ConfirmBusinessRequestProjectDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(4000) businessProblem?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(4000) expectedResult?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(4000) acceptanceCriteria?: string;
}

export class AddAIWorkspaceMessageDto {
  @IsString() @MinLength(1) @MaxLength(20000) content!: string;
  @IsString() @MinLength(8) @MaxLength(200) idempotencyKey!: string;
}

export class CompleteAIWorkspaceDto {
  @IsString() assistantMessageId!: string;
  @IsOptional() @IsObject() editedResult?: Record<string, unknown>;
}

export class BuildAIWorkspaceDemoDto {
  @IsOptional() @IsString() @MaxLength(4000) instruction?: string;
  @IsString() @MinLength(8) @MaxLength(200) idempotencyKey!: string;
}

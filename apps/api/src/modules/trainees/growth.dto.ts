import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
export const growthRatings = ['S', 'A+', 'A', 'A-', 'B', 'C'] as const;
export class GrowthFieldsDto {
  @IsOptional() @IsString() @Length(0,2000) overrideReason?: string;
  @IsOptional() @IsIn(growthRatings) rating?: typeof growthRatings[number] | null;
  @IsString() @Length(0, 200) departmentText: string;
  @IsString() @Length(0, 12000) workResults: string;
  @IsString() @Length(0, 12000) strengths: string;
  @IsString() @Length(0, 12000) shortfalls: string;
  @IsString() @Length(0, 12000) growthAdvice: string;
  @IsString() @Length(0, 12000) nextAssessment: string;
  @IsString() @Length(0, 12000) archiveComment: string;
  @IsBoolean() publish: boolean;
}
export class CreateGrowthDto extends GrowthFieldsDto {
  @IsUUID() traineeId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) periodStart: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) periodEnd: string;
}
export class UpdateGrowthDto extends GrowthFieldsDto {
  @IsInt() @Min(1) version: number;
}
export class GrowthUploadDto {
  @IsString() @Matches(/^[1-9]\d{0,8}$/) version: string;
  @IsUUID() idempotencyKey: string;
}

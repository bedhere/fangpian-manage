import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class LabelingQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}
export class LabelingDayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
}
export class LabelingEntryDto {
  @IsUUID() traineeId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) workDate: string;
  @IsInt() @Min(0) @Max(1_000_000_000) count: number;
  @IsInt() @Min(0) @Max(2_147_483_646) version: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class LabelingImportDto {
  @IsUUID() requestId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => LabelingEntryDto) entries: LabelingEntryDto[];
}

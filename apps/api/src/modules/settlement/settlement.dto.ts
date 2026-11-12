import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ContributionItemDto {
  @IsUUID() userId!: string;
  @Matches(/^\d+(\.\d{1,2})?$/) percentage!: string;
}
export class ProposeContributionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContributionItemDto)
  contributions!: ContributionItemDto[];
}
export class ContributionResponseDto {
  @IsIn(['CONFIRM', 'DISPUTE']) decision!: 'CONFIRM' | 'DISPUTE';
  @IsOptional() @IsString() @MinLength(2) reason?: string;
}
export class ArbitrateContributionsDto extends ProposeContributionsDto {
  @IsString() @MinLength(2) resolution!: string;
}
export class SettlementMonthDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
}

import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateOpportunityDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @IsArray() @IsString({ each: true }) valueTags!: string[];
  @IsIn(['ORGANIZATION', 'DEPARTMENT']) visibility!:
    'ORGANIZATION' | 'DEPARTMENT';
  @IsOptional() @IsISO8601() deadline?: string;
}
export class CreateOpportunityProposalDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(5000) approach!: string;
  @IsString() @MinLength(5) @MaxLength(2000) expectedValue!: string;
}
export class ConvertOpportunityDto {
  @IsUUID() proposalId!: string;
}

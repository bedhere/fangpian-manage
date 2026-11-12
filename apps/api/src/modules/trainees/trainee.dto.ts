import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export class TraineeQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsUUID() traineeId?: string;
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']) status?:
    'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
}
export class CreateSubmissionDto {
  @IsString() @Length(1, 200) title: string;
  @IsUUID() departmentId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) workDate: string;
  @IsString() @Length(1, 20000) problem: string;
  @IsString() @Length(1, 20000) solution: string;
  @IsOptional() @IsString() @Length(0, 10000) expectedValue?: string;
  @IsBoolean() submit: boolean;
}
export class VersionDto {
  @IsInt() @Min(1) version: number;
}
export class UpdateSubmissionDto extends VersionDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(1, 200)
  title?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() departmentId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workDate?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(1, 20000)
  problem?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(1, 20000)
  solution?: string;
  @IsOptional() @IsString() @Length(0, 10000) expectedValue?: string | null;
}
export class ReviewSubmissionDto extends VersionDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @Length(0, 5000) comment?: string;
}
export class EnrollTraineeDto {
  @IsOptional() @IsUUID() mentorId?: string;
}
export class AssignMentorDto {
  @ValidateIf((_o, v) => v !== null) @IsUUID() mentorId: string | null;
}

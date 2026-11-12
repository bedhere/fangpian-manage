import { IsEnum, IsString, MinLength } from 'class-validator';
import { SkillEvidenceStatus } from '@value-flow/db';

export class ReviewSkillEvidenceDto {
  @IsEnum(SkillEvidenceStatus) status!: SkillEvidenceStatus;
  @IsString() @MinLength(2) reason!: string;
}

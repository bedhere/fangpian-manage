import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
export class MentorRequestDto {
  @IsInt() @Min(1) version!:number;
  @IsUUID() aiMentorId!:string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsUUID('all',{each:true}) departmentMentorIds!:string[];
  @IsOptional() @IsString() @MaxLength(1000) comment?:string;
}
export class MentorCancelDto { @IsInt() @Min(1) version!:number; }
export class MentorReviewDto extends MentorCancelDto {
  @IsUUID() requestId!:string;
  @IsIn(['APPROVE','REJECT']) decision!:'APPROVE'|'REJECT';
  @IsOptional() @IsString() @MaxLength(1000) comment?:string;
}

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUUID, Length, Min, ValidateIf, ValidateNested } from 'class-validator';
import type { Grade, Priority } from './ai-center.types.js';
export class JournalVersionDto { @IsInt() @Min(1) version:number; }
export class IvyEntryDto {
 @IsUUID() id:string;
 @IsString() @Length(1,1000) text:string;
 @IsIn(['DONE','DOING','NOT_DONE']) status:'DONE'|'DOING'|'NOT_DONE';
 @IsOptional() @IsString() @Length(0,2000) note?:string;
}
export class SaveIvyDto {
 @IsOptional() @IsInt() @Min(0) version?:number;
 @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>IvyEntryDto) today:IvyEntryDto[];
 @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>IvyEntryDto) tomorrow:IvyEntryDto[];
}
export class JournalReviewDto extends JournalVersionDto {
 @IsIn(['S','A','B','C']) grade:Grade;
 @IsOptional() @IsString() @Length(0,4000) comment?:string;
 @IsOptional() @IsString() @Length(0,1000) reason?:string;
}
export class LearningActionDto {
 @IsUUID() id:string;
 @IsString() @Length(0,200) title:string;
 @IsString() @Length(0,12000) description:string;
 @IsString() @Length(0,12000) acceptanceCriteria:string;
 @IsIn(['P0','P1','P2','P3']) priority:Priority;
 @ValidateIf((o:LearningActionDto)=>o.dueAt!=='') @IsString() @IsISO8601({strict:true}) dueAt:string;
 @IsIn(['S','A','B','C']) selfDifficulty:Grade;
}
export class IvyTaskDto {
 @IsString() @Length(1,200) title:string;
 @IsString() @Length(1,12000) description:string;
 @IsString() @Length(1,12000) acceptanceCriteria:string;
 @IsIn(['P0','P1','P2','P3']) priority:Priority;
 @IsISO8601({strict:true}) dueAt:string;
 @IsIn(['S','A','B','C']) selfDifficulty:Grade;
}
export class PromoteIvyDto extends JournalVersionDto {
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID(undefined,{each:true}) entryIds:string[];
 @IsOptional() @ValidateNested() @Type(()=>IvyTaskDto) task?:IvyTaskDto;
 @IsOptional() @IsUUID() existingTaskId?:string;
}
export class SaveNoteDto {
 @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @Length(0,2048,{each:true}) websites?:string[];
 @IsOptional() @IsObject() contentDocument?:unknown;
 @IsOptional() @IsString() @Length(10,10) week?:string;
 @IsString() @Length(0,200) title:string;
 @IsString() @Length(0,30000) content:string;
 @IsString() @Length(0,12000) businessLink:string;
 @IsArray() @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>LearningActionDto) actions:LearningActionDto[];
 @IsBoolean() submit:boolean;
}
export class UpdateNoteDto extends SaveNoteDto { @IsInt() @Min(1) version:number; }
export class NoteReviewDto extends JournalVersionDto {
 @IsOptional() @IsBoolean() reconcileLate?:boolean;
 @IsIn(['APPROVE','RETURN']) decision:'APPROVE'|'RETURN';
 @IsOptional() @IsIn(['S','A','B','C']) grade?:Grade;
 @IsOptional() @IsString() @Length(0,4000) comment?:string;
 @IsOptional() @IsString() @Length(0,1000) reason?:string;
}

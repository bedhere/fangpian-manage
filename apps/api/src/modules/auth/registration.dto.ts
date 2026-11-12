import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class RegisterDto {
  @IsString() @Length(1, 100) displayName: string;
  @IsOptional() @IsUUID() mentorId?: string;
}

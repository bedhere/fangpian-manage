import { IsString, MinLength, MaxLength } from 'class-validator';
export class LoginDto {
  @IsString() @MinLength(1) @MaxLength(254) email!: string;
  @IsString() @MinLength(8) password!: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(10) @MaxLength(128) newPassword!: string;
}
export class RefreshDto {
  @IsString() @MinLength(20) refreshToken!: string;
}

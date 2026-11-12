import {
  IsArray,
  IsEnum,
  IsInt,
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { EntityStatus, UserStatus } from '@value-flow/db';
export class UpdateSettingDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsDefined() value!: unknown;
  @IsString() @MinLength(2) reason!: string;
}
export class CreateNotificationDto {
  @IsString() userId!: string;
  @IsString() type!: 'PROJECT' | 'REVIEW' | 'RISK' | 'SETTLEMENT' | 'SYSTEM';
  @IsString() title!: string;
  @IsString() body!: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
}
export class UpdateAdminUserDto {
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsString() @MinLength(2) displayName?: string;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) roleIds?: string[];
  @IsString() @MinLength(2) reason!: string;
}
export class ResetAdminUserPasswordDto {
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @MinLength(2) @MaxLength(300) reason!: string;
}
export class CreateAdminUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) displayName!: string;
  @IsString() @MinLength(12) password!: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsArray() @IsString({ each: true }) roleIds!: string[];
}
export class CreateDepartmentDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) code!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() headId?: string;
}
export class UpdateDepartmentDto {
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() headId?: string | null;
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(EntityStatus) status?: EntityStatus;
}
export class UpdateRolePermissionsDto {
  @IsArray() @IsString({ each: true }) permissionCodes!: string[];
  @IsOptional() @IsString() @MinLength(2) reason?: string;
}
export class CreateRoleDto {
  @IsString() @MinLength(2) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @IsString({ each: true }) permissionCodes!: string[];
}
export class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsEnum(EntityStatus) status?: EntityStatus;
  @IsOptional() @IsArray() @IsString({ each: true }) permissionCodes?: string[];
  @IsString() @MinLength(2) reason!: string;
}

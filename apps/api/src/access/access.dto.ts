import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAccessGrantDto {
  @IsString()
  userId!: string;

  @IsString()
  permission!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateOrganizationProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() defaultCurrency?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsString() dateFormat?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) fiscalYearStartMonth?: number;
  @IsOptional() businessHours?: Record<string, unknown>;
}

export class CreateInvitationDto {
  @IsEmail() email!: string;
  @IsOptional() @IsIn(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']) role?: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  @IsOptional() @IsInt() @Min(1) @Max(30) expiresInDays?: number;
}

export class AcceptInvitationDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsString() @MinLength(8) password!: string;
}

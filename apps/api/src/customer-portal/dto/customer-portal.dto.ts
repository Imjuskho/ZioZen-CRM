import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CustomerLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class CustomerPortalProvisionDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CustomerPortalStateDto {
  @IsBoolean()
  active!: boolean;
}

export class CustomerPortalResetPasswordDto {
  @IsString()
  @MinLength(12)
  password!: string;
}

export class CustomerPortalTicketDto {
  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

export class CustomerPortalReplyDto {
  @IsString()
  body!: string;
}

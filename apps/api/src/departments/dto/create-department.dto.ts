import { IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    emailSignature?: string;
    headerText?: string;
    footerText?: string;
  };
}

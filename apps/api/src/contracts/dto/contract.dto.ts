import { IsDateString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateContractDto {
  @IsString()
  subject!: string;

  @IsOptional()
  @IsNumberString()
  value?: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsNumberString()
  value?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

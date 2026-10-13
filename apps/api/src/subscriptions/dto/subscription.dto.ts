import { IsDateString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  name!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  interval?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsDateString()
  nextBillingDate!: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsDateString()
  nextBillingDate?: string;
}

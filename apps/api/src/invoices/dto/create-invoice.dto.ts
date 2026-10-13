import { IsDecimal, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  number!: string;

  @IsDecimal({ decimal_digits: '0,2' })
  amount!: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

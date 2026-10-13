import { IsDecimal, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsDecimal({ decimal_digits: '0,2' })
  amount!: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

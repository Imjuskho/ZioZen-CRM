import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

const decimalAmount = /^\d+(\.\d{1,2})?$/;

export class CreateCreditNoteDto {
  @IsString()
  number!: string;

  @Matches(decimalAmount)
  total!: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  relatedInvoiceId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['draft', 'issued', 'void'])
  status?: string;
}

export class ApplyCreditNoteDto {
  @IsString()
  invoiceId!: string;

  @Matches(decimalAmount)
  amount!: string;
}

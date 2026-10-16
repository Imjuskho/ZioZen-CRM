import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

const decimalAmount = /^\d+(\.\d{1,2})?$/;

export class CreateAccountDto {
  @IsString()
  departmentId!: string;

  @IsString()
  @Matches(/^\d{3,8}$/)
  code!: string;

  @IsString()
  name!: string;

  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  type!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class JournalLineDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @Matches(decimalAmount)
  debit?: string;

  @IsOptional()
  @Matches(decimalAmount)
  credit?: string;
}

export class CreateJournalEntryDto {
  @IsString()
  number!: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class CreateAccountingPeriodDto {
  @IsString()
  departmentId!: string;

  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class PeriodSignOffDto {
  @IsOptional()
  @IsString()
  note?: string;
}

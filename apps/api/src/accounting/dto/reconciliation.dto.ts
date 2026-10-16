import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';

const decimalAmount = /^-?\d+(\.\d{1,2})?$/;

export class CreateReconciliationSessionDto {
  @IsString()
  departmentId!: string;

  @IsString()
  accountId!: string;

  @IsString()
  name!: string;

  @IsDateString()
  statementStart!: string;

  @IsDateString()
  statementEnd!: string;

  @Matches(decimalAmount)
  openingBalance!: string;
}

export class BankTransactionDto {
  @IsString()
  externalId!: string;

  @IsDateString()
  transactionDate!: string;

  @Matches(decimalAmount)
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AddBankTransactionsDto {
  @ValidateNested({ each: true })
  @Type(() => BankTransactionDto)
  transactions!: BankTransactionDto[];
}

export class MatchTransactionDto {
  @IsString()
  journalEntryId!: string;
}

export class CloseReconciliationSessionDto {
  @Matches(decimalAmount)
  closingBalance!: string;
}

export class CreateFinanceExceptionDto {
  @IsString()
  departmentId!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsString()
  title!: string;

  @IsString()
  detail!: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}

export class ResolveFinanceExceptionDto {
  @IsString()
  resolutionNote!: string;
}

export class AssignFinanceExceptionDto {
  @IsString()
  assigneeId!: string;
}

export class ImportStatementDto {
  @IsString()
  csv!: string;
}

export class ImportProviderStatementDto extends ImportStatementDto {
  @IsString()
  provider!: string;
}

export class CreateFinanceExceptionPolicyDto {
  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  thresholdHours!: number;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}

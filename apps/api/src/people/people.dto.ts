import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

const money = /^\d+(\.\d{1,2})?$/;

export class CreateEmployeeDto {
  @IsString() userId!: string;
  @IsString() departmentId!: string;
  @IsString() jobTitle!: string;
  @IsOptional() @IsIn(['full_time', 'part_time', 'contractor']) employmentType?: string;
  @IsOptional() @Matches(money) hourlyRate?: string;
  @IsOptional() @Matches(money) salary?: string;
  @IsDateString() startDate!: string;
}

export class CreateLeaveDto {
  @IsString() employeeId!: string;
  @IsString() type!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() reason?: string;
}

export class DecideLeaveDto {
  @IsIn(['approved', 'rejected']) status!: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateApprovalDto {
  @IsString() departmentId!: string;
  @IsString() entityType!: string;
  @IsString() entityId!: string;
  @IsOptional() @IsString() requiredRole?: string;
  @IsOptional() @IsInt() stepOrder?: number;
}

export class DecideApprovalDto {
  @IsIn(['approved', 'rejected']) status!: string;
  @IsOptional() @IsString() note?: string;
}

export class PayrollLineDto {
  @IsString() employeeId!: string;
  @IsOptional() @Matches(money) bonus?: string;
  @IsOptional() @Matches(money) deductions?: string;
  @IsOptional() @Matches(money) hours?: string;
}

export class CreatePayrollDto {
  @IsString() departmentId!: string;
  @IsString() name!: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PayrollLineDto) lines!: PayrollLineDto[];
}

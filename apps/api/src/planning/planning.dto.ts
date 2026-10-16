import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

const decimal = /^\d+(\.\d{1,2})?$/;

export class CreateRecurringTaskDto {
  @IsString() departmentId!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(['daily', 'weekly', 'monthly']) frequency!: string;
  @IsDateString() nextRunAt!: string;
  @IsOptional() @IsString() assigneeId?: string;
}

export class KeyResultDto {
  @IsString() title!: string;
  @Matches(decimal) target!: string;
  @IsOptional() @Matches(decimal) current?: string;
  @IsOptional() @IsString() unit?: string;
}

export class CreateGoalDto {
  @IsString() departmentId!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => KeyResultDto) keyResults!: KeyResultDto[];
}

export class UpdateKeyResultDto {
  @Matches(decimal) current!: string;
  @IsOptional() @IsIn(['not_started', 'on_track', 'at_risk', 'completed']) status?: string;
}

export class CreateAppointmentDto {
  @IsString() departmentId!: string;
  @IsString() title!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() ownerId?: string;
}

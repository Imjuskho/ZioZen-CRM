import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class CreateTicketReplyDto {
  @IsString()
  body!: string;

  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

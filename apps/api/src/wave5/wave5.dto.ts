import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsEmail } from 'class-validator';

export class CreateAutomationRuleDto {
  @IsString() departmentId!: string;
  @IsString() name!: string;
  @IsString() eventType!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
  @IsObject() action!: Record<string, unknown>;
}

export class AutomationEventDto {
  @IsString() eventId!: string;
  @IsString() eventType!: string;
  @IsString() departmentId!: string;
  @IsObject() payload!: Record<string, unknown>;
}

export class CreateInboxChannelDto {
  @IsString() departmentId!: string;
  @IsIn(['imap', 'whatsapp', 'webchat']) channel!: string;
  @IsString() secret!: string;
}

export class InboundMessageDto {
  @IsString() eventId!: string;
  @IsOptional() @IsString() externalThreadId?: string;
  @IsOptional() @IsString() subject?: string;
  @IsString() sender!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() body!: string;
  @IsOptional() @IsString() direction?: string;
  @IsOptional() metadata?: Record<string, unknown>;
}

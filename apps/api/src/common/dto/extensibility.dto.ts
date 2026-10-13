import { IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  name!: string;

  @IsUrl()
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateCustomFieldDto {
  @IsString()
  entityType!: string;

  @IsString()
  name!: string;

  @IsString()
  label!: string;

  @IsString()
  fieldType!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class SetCustomFieldValueDto {
  @IsString()
  customFieldId!: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  value!: string;
}

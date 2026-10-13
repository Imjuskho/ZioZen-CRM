import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class MembershipDto {
  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

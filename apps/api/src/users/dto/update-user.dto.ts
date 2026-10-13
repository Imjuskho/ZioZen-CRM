import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'])
  role?: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

  @IsOptional()
  active?: boolean;
}

import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContactSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertHomeVideoDto {
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  youtubeId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateHomeVideoDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  youtubeId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

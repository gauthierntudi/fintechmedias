import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PLACEMENTS } from '../ad-catalog';

export class CreateAdDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @IsIn(PLACEMENTS)
  placement!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  targetUrl!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10)
  startsOn!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10)
  endsOn!: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsIn(PLACEMENTS)
  placement?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  targetUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  startsOn?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  endsOn?: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

export class RefuseAdDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class UpdateAdRateDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  price7Days?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  price15Days?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  price30Days?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

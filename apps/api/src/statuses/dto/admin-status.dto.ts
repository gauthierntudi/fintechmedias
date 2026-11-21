import { StatusImageFit, StatusOfferKind } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsUrl,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Vidéo de statut : MP4/MOV, 100 Mo max */
export const STATUS_VIDEO_MAX_BYTES = 100_000_000;

/** Nombre max de diapos dans un statut */
export const STATUS_MAX_SLIDES = 20;

/** Statut (bulle) : visibilité et publication. Le contenu vit dans les diapos. */
export const STATUS_TITLE_MAX = 40;

export class CreateStatusDto {
  /** Titre court sous la bulle ; vide = déduit des diapos */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(STATUS_TITLE_MAX)
  title?: string | null;

  /** Durée de vie en heures (1 h → 7 jours) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  ttlHours?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateStatusDto {
  /** Titre court sous la bulle ; vide = déduit des diapos */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(STATUS_TITLE_MAX)
  title?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** Nouvelle expiration (ISO) */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /** Prolonge / relance : expiration = maintenant + N heures */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  ttlHours?: number;
}

export class CreateStatusSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  articleId?: string | null;

  /** Lien externe (bouton « En savoir plus ») — vide = retiré */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'Lien invalide (https://…)' },
  )
  @MaxLength(500)
  linkUrl?: string | null;

  /** Cadrage de l’image : COVER ou FIT */
  @IsOptional()
  @IsEnum(StatusImageFit)
  imageFit?: StatusImageFit;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(15)
  durationSec?: number;
}

export class UpdateStatusSlideDto extends CreateStatusSlideDto {
  /** Retire le média (diapo → texte / raccourci article) */
  @IsOptional()
  @IsBoolean()
  clearMedia?: boolean;
}

export class ReorderStatusSlidesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(STATUS_MAX_SLIDES)
  @IsString({ each: true })
  ids!: string[];
}

export class MoveStatusDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}

/** Regroupe ce statut dans un autre : ses diapos passent à la suite */
export class MergeStatusDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetId!: string;
}

export class PresignStatusVideoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STATUS_VIDEO_MAX_BYTES)
  size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;
}

export class CompleteStatusVideoDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  key!: string;
}

/** Refus d’un statut abonné (motif visible par l’abonné) */
export class RejectStatusDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** Validation d’un statut abonné : durée de vie optionnelle (sinon celle de l’offre) */
export class ApproveStatusDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  ttlHours?: number;
}

export class CreateStatusOfferDto {
  @IsEnum(StatusOfferKind)
  kind!: StatusOfferKind;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_00)
  priceCents!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  statusLifetimeHours?: number;

  /** PASS : nombre de statuts inclus (vide = illimité) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quota?: number | null;

  /** PASS : validité du forfait en jours */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  periodDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class UpdateStatusOfferDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_00)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  statusLifetimeHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quota?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  periodDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

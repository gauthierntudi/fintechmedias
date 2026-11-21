import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STATUS_TITLE_MAX } from './admin-status.dto';

/** Diapos max d’un statut abonné */
export const SUBSCRIBER_MAX_SLIDES = 5;

/** Brouillon de statut abonné ; les diapos (image / vidéo) s’ajoutent ensuite. */
export class CreateMyStatusDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(STATUS_TITLE_MAX)
  title?: string | null;
}

/** Soumission à la rédaction : décompte sur un forfait ou paiement unique. */
export class SubmitMyStatusDto {
  @IsIn(['PASS', 'SINGLE'])
  billing!: 'PASS' | 'SINGLE';

  /** SINGLE : offre « publication unique » choisie */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  offerId?: string;

  /** SINGLE : numéro Mobile Money (243…) */
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Numéro de téléphone invalide' })
  phone?: string;
}

export class StatusPassCheckoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  offerId!: string;

  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;
}

export class RetryStatusPaymentDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;
}

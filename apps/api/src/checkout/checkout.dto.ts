import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CHECKOUT_KINDS = [
  'SUBSCRIPTION',
  'MAGAZINE',
  'ARTICLE',
  'STATUS',
] as const;

export class CreateCheckoutDto {
  @IsIn(CHECKOUT_KINDS)
  kind!: (typeof CHECKOUT_KINDS)[number];

  /** SUBSCRIPTION : formule choisie */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  planId?: string;

  /** MAGAZINE : numéro acheté */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  magazineId?: string;

  /** ARTICLE : article acheté à l’unité */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  articleId?: string;

  /** STATUS : statut soumis (offre déjà choisie à la soumission) */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  statusId?: string;

  /** Lien de retour après paiement (app : fintechmedias://…, ou le site) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnUrl?: string;
}

export class PayCheckoutDto {
  /** Numéro Mobile Money RDC (243…) */
  @IsString()
  @Matches(/^\+?[0-9 ]{9,18}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;
}

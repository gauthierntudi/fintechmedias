import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const JOB_CONTRACT_TYPES = [
  'CDI',
  'CDD',
  'INTERNSHIP',
  'FREELANCE',
  'CONSULTANCY',
  'APPRENTICESHIP',
  'VOLUNTEER',
  'OTHER',
] as const;
export const JOB_WORK_MODES = ['ON_SITE', 'REMOTE', 'HYBRID'] as const;
export const JOB_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
/** Secteurs de l’annuaire des entreprises fintech. */
export const JOB_COMPANY_SECTORS = [
  'PAYMENTS',
  'BANKING',
  'MICROFINANCE',
  'LENDING',
  'INSURTECH',
  'WEALTH',
  'CRYPTO',
  'INFRASTRUCTURE',
  'REGTECH',
  'OTHER',
] as const;

/** Secteur optionnel ; null pour vider. */
function OptionalSector() {
  return function (target: object, key: string) {
    IsOptional()(target, key);
    ValidateIf((_, v) => v !== null && v !== undefined && v !== '')(
      target,
      key,
    );
    IsIn(JOB_COMPANY_SECTORS)(target, key);
  };
}

/** Champ texte optionnel qui accepte `null` pour vider la valeur. */
function OptionalText(max: number) {
  return function (target: object, key: string) {
    IsOptional()(target, key);
    ValidateIf((_, v) => v !== null && v !== undefined)(target, key);
    IsString()(target, key);
    MaxLength(max)(target, key);
  };
}

/** Date limite « YYYY-MM-DD » (jour civil à Kinshasa) ; null = sans limite. */
function OptionalDay() {
  return function (target: object, key: string) {
    IsOptional()(target, key);
    ValidateIf((_, v) => v !== null && v !== undefined && v !== '')(
      target,
      key,
    );
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Date limite invalide (YYYY-MM-DD)',
    })(target, key);
  };
}

export class CreateJobDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  companyName!: string;

  /** Logo de l’entreprise (clé R2) */
  @OptionalText(400)
  companyLogoKey?: string | null;

  @OptionalText(1000)
  companyUrl?: string | null;

  /** Fiche annuaire : enregistrés sur l’entreprise, pas sur l’offre. */
  @OptionalSector()
  companySector?: string | null;

  @OptionalText(160)
  companyHeadquarters?: string | null;

  @OptionalText(1000)
  companyAppStoreUrl?: string | null;

  @OptionalText(1000)
  companyPlayStoreUrl?: string | null;

  @IsOptional()
  @IsIn(JOB_CONTRACT_TYPES)
  contractType?: (typeof JOB_CONTRACT_TYPES)[number];

  @IsOptional()
  @IsIn(JOB_WORK_MODES)
  workMode?: (typeof JOB_WORK_MODES)[number];

  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: (typeof JOB_STATUSES)[number];

  /** Un ou plusieurs lieux (« Kinshasa, RDC ») */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  locations?: string[];

  @OptionalDay()
  deadline?: string | null;

  @OptionalText(50_000)
  description?: string | null;

  @OptionalText(1000)
  applyUrl?: string | null;

  @OptionalText(200)
  applyEmail?: string | null;
}

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  companyName?: string;

  @OptionalText(400)
  companyLogoKey?: string | null;

  @OptionalText(1000)
  companyUrl?: string | null;

  /** Fiche annuaire : enregistrés sur l’entreprise, pas sur l’offre. */
  @OptionalSector()
  companySector?: string | null;

  @OptionalText(160)
  companyHeadquarters?: string | null;

  @OptionalText(1000)
  companyAppStoreUrl?: string | null;

  @OptionalText(1000)
  companyPlayStoreUrl?: string | null;

  @IsOptional()
  @IsIn(JOB_CONTRACT_TYPES)
  contractType?: (typeof JOB_CONTRACT_TYPES)[number];

  @IsOptional()
  @IsIn(JOB_WORK_MODES)
  workMode?: (typeof JOB_WORK_MODES)[number];

  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: (typeof JOB_STATUSES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  locations?: string[];

  @OptionalDay()
  deadline?: string | null;

  @OptionalText(50_000)
  description?: string | null;

  @OptionalText(1000)
  applyUrl?: string | null;

  @OptionalText(200)
  applyEmail?: string | null;
}

export class ListJobsQueryDto {
  /** open = candidatures ouvertes (défaut) ; closed = date limite passée */
  @IsOptional()
  @IsIn(['open', 'closed', 'all'])
  when?: 'open' | 'closed' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  /** Un ou plusieurs types de contrat, séparés par des virgules (CDI,CDD) */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contract?: string;

  /** Un ou plusieurs modes de travail (ON_SITE,REMOTE) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mode?: string;

  /** Secteur(s) de l’entreprise (annuaire) */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sector?: string;

  /** recent = plus récentes (défaut) ; deadline = date limite la plus proche */
  @IsOptional()
  @IsIn(['recent', 'deadline'])
  sort?: 'recent' | 'deadline';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

/** Édition d’une fiche de l’annuaire (admin). */
export class UpdateJobCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @OptionalText(400)
  logoKey?: string | null;

  @OptionalText(1000)
  url?: string | null;

  @OptionalSector()
  sector?: string | null;

  @OptionalText(160)
  headquarters?: string | null;

  @OptionalText(1000)
  appStoreUrl?: string | null;

  @OptionalText(1000)
  playStoreUrl?: string | null;
}

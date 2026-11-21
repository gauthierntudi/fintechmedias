import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const EVENT_TYPES = [
  'CONFERENCE',
  'SUMMIT',
  'MEETUP',
  'WEBINAR',
  'WORKSHOP',
  'OTHER',
] as const;
export const EVENT_FORMATS = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const;
export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
/** Devises affichées sur les catégories de billets. */
export const EVENT_CURRENCIES = ['USD', 'CDF', 'EUR', 'XAF', 'XOF'] as const;

/** Champ texte optionnel qui accepte `null` pour vider la valeur. */
function OptionalText(max: number) {
  return function (target: object, key: string) {
    IsOptional()(target, key);
    ValidateIf((_, v) => v !== null && v !== undefined)(target, key);
    IsString()(target, key);
    MaxLength(max)(target, key);
  };
}

/** Couleur « #rrggbb » optionnelle ; null pour vider. */
function OptionalHex() {
  return function (target: object, key: string) {
    IsOptional()(target, key);
    ValidateIf((_, v) => v !== null && v !== undefined)(target, key);
    Matches(/^#[0-9a-fA-F]{6}$/, { message: `${key} : couleur #RRGGBB` })(
      target,
      key,
    );
  };
}

export class EventProgrammeItemDto {
  /** Jour (YYYY-MM-DD) pour les événements sur plusieurs jours */
  @OptionalText(10)
  day?: string | null;

  /** Heure de début « HH:MM » */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure invalide (HH:MM)' })
  time!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure de fin invalide' })
  endTime?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @OptionalText(2000)
  description?: string | null;

  /** Noms d’intervenants (texte libre) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  speakers?: string[];
}

export class EventSpeakerDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @OptionalText(160)
  role?: string | null;

  @OptionalText(160)
  organization?: string | null;

  /** Clé R2 renvoyée par POST /admin/events/:id/image */
  @OptionalText(400)
  photoKey?: string | null;

  @OptionalText(1500)
  bio?: string | null;
}

export class EventPriceDto {
  @IsIn(EVENT_CURRENCIES)
  currency!: string;

  /** Montant en unités (ex. 50 = 50 USD). 0 = gratuit. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export class EventTicketTierDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @OptionalText(600)
  description?: string | null;

  @IsArray()
  @ArrayMaxSize(EVENT_CURRENCIES.length)
  @ValidateNested({ each: true })
  @Type(() => EventPriceDto)
  prices!: EventPriceDto[];
}

export class EventCoOrganizerDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  /** Clé R2 renvoyée par POST /admin/events/:id/image */
  @OptionalText(400)
  logoKey?: string | null;

  /** Fond détecté à l’upload (renvoyé par POST /admin/events/:id/image) */
  @OptionalHex()
  logoBg?: string | null;

  @OptionalText(1000)
  url?: string | null;
}

export class EventSponsorLinkDto {
  @IsString()
  @MinLength(1)
  sponsorId!: string;

  @OptionalText(80)
  tier?: string | null;
}

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  slug?: string;

  @OptionalText(600)
  summary?: string | null;

  @OptionalText(50_000)
  description?: string | null;

  @IsOptional()
  @IsIn(EVENT_TYPES)
  type?: (typeof EVENT_TYPES)[number];

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  format?: (typeof EVENT_FORMATS)[number];

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  endsAt?: string | null;

  @OptionalText(160)
  organizer?: string | null;

  /** Logo de l’organisateur (clé R2) */
  @OptionalText(400)
  organizerLogoKey?: string | null;

  /** Fond détecté à l’upload du logo */
  @OptionalHex()
  organizerLogoBg?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => EventCoOrganizerDto)
  coOrganizers?: EventCoOrganizerDto[];

  @OptionalText(120)
  city?: string | null;

  @OptionalText(120)
  country?: string | null;

  @OptionalText(200)
  venueName?: string | null;

  @OptionalText(400)
  venueAddress?: string | null;

  @OptionalText(1000)
  mapUrl?: string | null;

  @OptionalText(1000)
  onlineUrl?: string | null;

  @OptionalText(1000)
  ticketUrl?: string | null;

  /** Couleur de la charte (#RRGGBB) ; null = couleur du site. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'themeColor doit être au format #RRGGBB',
  })
  themeColor?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => EventProgrammeItemDto)
  programme?: EventProgrammeItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => EventSpeakerDto)
  speakers?: EventSpeakerDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EventTicketTierDto)
  ticketTiers?: EventTicketTierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EventSponsorLinkDto)
  sponsors?: EventSponsorLinkDto[];
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  slug?: string;

  @OptionalText(600)
  summary?: string | null;

  @OptionalText(50_000)
  description?: string | null;

  @IsOptional()
  @IsIn(EVENT_TYPES)
  type?: (typeof EVENT_TYPES)[number];

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  format?: (typeof EVENT_FORMATS)[number];

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: (typeof EVENT_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsDateString()
  endsAt?: string | null;

  @OptionalText(160)
  organizer?: string | null;

  /** Logo de l’organisateur (clé R2) */
  @OptionalText(400)
  organizerLogoKey?: string | null;

  /** Fond détecté à l’upload du logo */
  @OptionalHex()
  organizerLogoBg?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => EventCoOrganizerDto)
  coOrganizers?: EventCoOrganizerDto[];

  @OptionalText(120)
  city?: string | null;

  @OptionalText(120)
  country?: string | null;

  @OptionalText(200)
  venueName?: string | null;

  @OptionalText(400)
  venueAddress?: string | null;

  @OptionalText(1000)
  mapUrl?: string | null;

  @OptionalText(1000)
  onlineUrl?: string | null;

  @OptionalText(1000)
  ticketUrl?: string | null;

  /** Couleur de la charte (#RRGGBB) ; null = couleur du site. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'themeColor doit être au format #RRGGBB',
  })
  themeColor?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => EventProgrammeItemDto)
  programme?: EventProgrammeItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => EventSpeakerDto)
  speakers?: EventSpeakerDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EventTicketTierDto)
  ticketTiers?: EventTicketTierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EventSponsorLinkDto)
  sponsors?: EventSponsorLinkDto[];
}

export class ListEventsQueryDto {
  @IsOptional()
  @IsIn(['upcoming', 'past', 'all'])
  when?: 'upcoming' | 'past' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  format?: (typeof EVENT_FORMATS)[number];

  @IsOptional()
  @IsIn(EVENT_TYPES)
  type?: (typeof EVENT_TYPES)[number];

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

  /** Jour précis (YYYY-MM-DD, heure de Kinshasa) — remplace `when`. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

/** Jours ayant au moins un événement publié, sur une plage (max 62 jours). */
export class EventDaysQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  format?: (typeof EVENT_FORMATS)[number];
}

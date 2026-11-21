/** Une teinte unique par rubrique (vert charte, noir, + palette). */
export type CategoryTone =
  | 'green'
  | 'gray'
  | 'black'
  | 'blue'
  | 'teal'
  | 'violet'
  | 'orange'
  | 'rose'
  | 'gold'
  | 'cyan'
  // Legacy (encore acceptés côté clients)
  | 'red'
  | 'dark';

export type CategoryMeta = {
  label: string;
  tone: CategoryTone;
  /** Anciennes rubriques et libellés encore présents en base ou dans les URLs. */
  aliases?: string[];
  /** Visible seulement dans l’app mobile (pas le site). */
  mobileOnly?: boolean;
};

export const SHORT_CATEGORY_SLUG = 'stu-short';

/** Durée d’un article « À la une » sur l’accueil (fenêtre PHP : 45 jours). */
export const FEATURED_TTL_DAYS = 45;

/** Rubriques du site public (hors SHORT mobile). */
export function publicSiteCategorySlugs(): string[] {
  return Object.entries(CATEGORY_META)
    .filter(([, meta]) => !meta.mobileOnly)
    .map(([slug]) => slug);
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  actualites: {
    label: 'Actualités',
    tone: 'green',
    aliases: [
      'Actualités',
      'actualités',
      'actualite',
      'actualité',
      // Ancienne rubrique « Events » (désactivée — voir module Événements)
      'events',
      'Events',
      'événement',
      'evenement',
      'événements',
      'evenements',
    ],
  },
  interview: {
    label: 'Interview',
    tone: 'gray',
    aliases: [
      'Interview',
      'rencontre-avec',
      'qu-en-dit-l-expert',
      'stu-stories',
      'stu-talk',
      'inspirationnel',
      'game-changers',
      'game-changer',
      'grandes-entrevues',
      'grande-entrevue',
      'entrevue-croisee',
    ],
  },
  economie: {
    label: 'Économie',
    tone: 'blue',
    aliases: [
      'Economie',
      'Économie',
      'économie',
      'ecosysteme-pme',
      'stu-data',
      'decryptages',
      'decryptage',
    ],
  },
  politique: {
    label: 'Politique',
    tone: 'teal',
    aliases: ['Politique'],
  },
  international: {
    label: 'Int’l',
    tone: 'violet',
    aliases: ['Int’l', "Int'l", 'intl', "int'l", 'int’l', 'international'],
  },
  portrait: {
    label: 'Édito',
    tone: 'orange',
    aliases: ['Portrait', 'portrait', 'femme', 'edito', 'Édito', 'Edito'],
  },
  entreprise: {
    label: 'Entreprise',
    tone: 'rose',
    aliases: [
      'Entreprise',
      'entreprendre',
      'innovation',
      'stu-news',
      'start-up',
      'vus-sur-le-net',
      'zoom',
    ],
  },
  [SHORT_CATEGORY_SLUG]: {
    label: 'SHORT',
    tone: 'cyan',
    mobileOnly: true,
    aliases: ['short'],
  },
};

function categoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-');
}

const ALIAS_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [slug, meta] of Object.entries(CATEGORY_META)) {
    map[categoryKey(slug)] = slug;
    for (const alias of meta.aliases ?? []) {
      map[categoryKey(alias)] = slug;
    }
  }
  return map;
})();

export function resolveCategorySlug(raw: string): string | null {
  const key = categoryKey(raw);
  if (!key) return null;
  return ALIAS_TO_CANONICAL[key] ?? null;
}

export function categoryQuerySlugs(canonical: string): string[] {
  const meta = CATEGORY_META[canonical];
  if (!meta) return [canonical];
  return [canonical, ...(meta.aliases ?? [])];
}

export function categoryDisplay(raw: string | null | undefined): {
  label: string;
  tone: CategoryTone;
} {
  const key = raw?.trim() || '';
  const canonical = resolveCategorySlug(key) ?? key;
  const meta = CATEGORY_META[canonical];
  if (meta) return { label: meta.label, tone: meta.tone };
  return { label: key || 'Actualités', tone: 'green' };
}

export function isShortCategory(raw: string | null | undefined): boolean {
  return resolveCategorySlug(raw ?? '') === SHORT_CATEGORY_SLUG;
}

export function isMobileOnlyCategory(raw: string | null | undefined): boolean {
  const slug = resolveCategorySlug(raw ?? '');
  return Boolean(slug && CATEGORY_META[slug]?.mobileOnly);
}

/** Seul SHORT est une rubrique exclusivement vidéo. */
export const VIDEO_CATEGORY_SLUGS = [SHORT_CATEGORY_SLUG] as const;

export function isVideoCategory(raw: string | null | undefined): boolean {
  const slug = resolveCategorySlug(raw ?? '');
  return (
    slug != null &&
    (VIDEO_CATEGORY_SLUGS as readonly string[]).includes(slug)
  );
}

export type CategoryTone = 'red' | 'blue' | 'gold' | 'teal' | 'dark';

export type CategoryMeta = {
  label: string;
  tone: CategoryTone;
  /** Anciennes rubriques encore présentes en base. */
  aliases?: string[];
  /** Visible seulement dans l’app mobile (pas le site). */
  mobileOnly?: boolean;
};

export const SHORT_CATEGORY_SLUG = 'stu-short';

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'qu-en-dit-l-expert': {
    label: "Qu'en dit l'expert",
    tone: 'teal',
    aliases: [
      'stu-talk',
      'grandes-entrevues',
      'grande-entrevue',
      'entrevue-croisee',
    ],
  },
  'rencontre-avec': {
    label: 'Rencontre Avec',
    tone: 'gold',
    aliases: ['stu-stories', 'inspirationnel', 'game-changers', 'game-changer'],
  },
  entreprendre: {
    label: 'Entreprendre',
    tone: 'red',
    aliases: ['stu-news', 'edito', 'start-up', 'vus-sur-le-net', 'zoom'],
  },
  'ecosysteme-pme': {
    label: 'Écosystème PME',
    tone: 'blue',
    aliases: ['stu-data', 'decryptages', 'decryptage'],
  },
  femme: {
    label: 'Femme',
    tone: 'dark',
  },
  [SHORT_CATEGORY_SLUG]: {
    label: 'SHORT',
    tone: 'gold',
    mobileOnly: true,
  },
};

const ALIAS_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [slug, meta] of Object.entries(CATEGORY_META)) {
    map[slug] = slug;
    for (const alias of meta.aliases ?? []) {
      map[alias] = slug;
    }
  }
  return map;
})();

export function resolveCategorySlug(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return ALIAS_TO_CANONICAL[key] ?? (CATEGORY_META[key] ? key : null);
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
  return { label: key || 'Actualité', tone: 'teal' };
}

export function isShortCategory(raw: string | null | undefined): boolean {
  return resolveCategorySlug(raw ?? '') === SHORT_CATEGORY_SLUG;
}

export function isMobileOnlyCategory(raw: string | null | undefined): boolean {
  const slug = resolveCategorySlug(raw ?? '');
  return Boolean(slug && CATEGORY_META[slug]?.mobileOnly);
}

export const VIDEO_CATEGORY_SLUGS = [
  'qu-en-dit-l-expert',
  'rencontre-avec',
  SHORT_CATEGORY_SLUG,
] as const;

export function isVideoCategory(raw: string | null | undefined): boolean {
  const slug = resolveCategorySlug(raw ?? '');
  return (
    slug != null &&
    (VIDEO_CATEGORY_SLUGS as readonly string[]).includes(slug)
  );
}

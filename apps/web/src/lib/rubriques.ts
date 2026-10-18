export type RubriqueTone = "red" | "blue" | "gold" | "teal" | "dark";

export type Rubrique = {
  slug: string;
  href: string;
  label: string;
  blurb: string;
  tone: RubriqueTone;
  /** Mise en page 16:9 historique (les articles restent image ou vidéo au cas par cas). */
  format?: "article" | "video";
};

/** Rubriques du slider « À la une » sur l’accueil. */
export const FLAGSHIP_RUBRIQUE_SLUGS = [
  "actualites",
  "interview",
  "economie",
  "politique",
] as const;

/** Rubriques Fintech Médias — navigation, admin et filtres. */
export const RUBRIQUES: readonly Rubrique[] = [
  {
    slug: "actualites",
    href: "/rubrique/actualites",
    label: "Actualités",
    blurb: "L’actualité économique et fintech, au jour le jour.",
    tone: "red",
  },
  {
    slug: "interview",
    href: "/rubrique/interview",
    label: "Interview",
    blurb: "Entretiens avec celles et ceux qui font la fintech africaine.",
    tone: "gold",
  },
  {
    slug: "economie",
    href: "/rubrique/economie",
    label: "Économie",
    blurb: "Marchés, politiques économiques et signaux à suivre.",
    tone: "blue",
  },
  {
    slug: "politique",
    href: "/rubrique/politique",
    label: "Politique",
    blurb: "Décisions publiques et leur effet sur la finance et les entreprises.",
    tone: "teal",
  },
  {
    slug: "international",
    href: "/rubrique/international",
    label: "Int’l",
    blurb: "Ce qui se joue hors des frontières et pèse sur le continent.",
    tone: "dark",
  },
  {
    slug: "portrait",
    href: "/rubrique/portrait",
    label: "Édito",
    blurb: "La voix de la rédaction sur l’actualité finance et fintech.",
    tone: "gold",
  },
  {
    slug: "entreprise",
    href: "/rubrique/entreprise",
    label: "Entreprise",
    blurb: "Sociétés, levées, produits et stratégies.",
    tone: "red",
  },
  {
    slug: "events",
    href: "/rubrique/events",
    label: "Events",
    blurb: "Forums, lancements et rendez-vous du secteur.",
    tone: "teal",
  },
] as const;

export const SHORT_RUBRIQUE: Rubrique = {
  slug: "stu-short",
  href: "/rubrique/stu-short",
  label: "SHORT",
  blurb:
    "Formats courts verticaux, à feuilleter comme TikTok — visibles uniquement dans l’app.",
  tone: "gold",
  format: "video",
};

export const RUBRIQUE_BY_SLUG = Object.fromEntries(
  RUBRIQUES.map((r) => [r.slug, r]),
) as Record<string, Rubrique>;

export const ARTICLE_CATEGORY_OPTIONS = [
  ...RUBRIQUES.map((r) => ({ value: r.slug, label: r.label })),
  { value: SHORT_RUBRIQUE.slug, label: SHORT_RUBRIQUE.label },
] as const;

export const CATEGORY_BLURB: Record<string, string> = Object.fromEntries(
  RUBRIQUES.map((r) => [r.slug, r.blurb]),
);

export const SEARCH_FILTERS = [
  { slug: "", label: "Toutes" },
  ...RUBRIQUES.map((r) => ({ slug: r.slug, label: r.label })),
] as const;

const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  actualites: "actualites",
  actualité: "actualites",
  actualités: "actualites",
  actualite: "actualites",
  interview: "interview",
  "rencontre-avec": "interview",
  "qu-en-dit-l-expert": "interview",
  economie: "economie",
  économie: "economie",
  "ecosysteme-pme": "economie",
  politique: "politique",
  international: "international",
  intl: "international",
  "int'l": "international",
  "int’l": "international",
  portrait: "portrait",
  femme: "portrait",
  edito: "portrait",
  édito: "portrait",
  entreprise: "entreprise",
  entreprendre: "entreprise",
  innovation: "entreprise",
  events: "events",
  "stu-talk": "interview",
  "stu-stories": "interview",
  "stu-news": "entreprise",
  "stu-data": "economie",
};

function categoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Ancienne URL `/categorie/{nom}` → slug canonique. */
export function legacyCategorySlug(raw: string): string | null {
  const key = categoryKey(decodeURIComponent(raw));
  return LEGACY_CATEGORY_SLUGS[key] ?? RUBRIQUE_BY_SLUG[key]?.slug ?? null;
}

/** Seul SHORT reste une rubrique 100 % vidéo ; Interview se juge article par article. */
const VIDEO_KEYS = new Set(
  [...RUBRIQUES, SHORT_RUBRIQUE]
    .filter((r) => r.format === "video")
    .flatMap((r) => [r.slug, r.label.toLowerCase()]),
);

const STORIES_KEYS = new Set([
  "interview",
  "rencontre-avec",
  "rencontre avec",
  "stu-stories",
  "portrait",
]);

const FLAGSHIP_KEYS = new Set<string>([
  ...FLAGSHIP_RUBRIQUE_SLUGS,
  "actualités",
  "économie",
]);

/** Articles autorisés dans le héros d’accueil. */
export function isFlagshipRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    return FLAGSHIP_KEYS.has(value.trim().toLowerCase());
  });
}

/** Rubriques 100 % vidéo (SHORT uniquement). Interview = article ou vidéo selon le média. */
export function isVideoRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    const key = value.trim().toLowerCase();
    return VIDEO_KEYS.has(key) || key === "short";
  });
}

/** Publication vidéo — basée sur le média de l’article, pas sur la rubrique. */
export function isVideoArticle(
  article:
    | {
        videoStatus?: string | null;
        videoHlsUrl?: string | null;
        videoSourceKey?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!article) return false;
  if (article.videoHlsUrl || article.videoSourceKey) return true;
  const status = article.videoStatus;
  return Boolean(status && status !== "NONE");
}

/** SHORT — formats verticaux, app mobile seulement. */
export function isShortRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    const key = value.trim().toLowerCase();
    return key === "stu-short" || key === "short";
  });
}

/** Rubriques « stories » (layout split / pastille). */
export function isStoriesRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    return STORIES_KEYS.has(value.trim().toLowerCase());
  });
}

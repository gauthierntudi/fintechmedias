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
  "qu-en-dit-l-expert",
  "rencontre-avec",
  "entreprendre",
] as const;

/** Rubriques L'Entrevue — navigation, admin et filtres. */
export const RUBRIQUES: readonly Rubrique[] = [
  {
    slug: "qu-en-dit-l-expert",
    href: "/rubrique/qu-en-dit-l-expert",
    label: "Qu'en dit l'expert",
    blurb:
      "Analyses et paroles d’experts pour éclairer les enjeux du moment.",
    tone: "teal",
    format: "video",
  },
  {
    slug: "rencontre-avec",
    href: "/rubrique/rencontre-avec",
    label: "Rencontre Avec",
    blurb:
      "Portraits et échanges avec celles et ceux qui font bouger les lignes.",
    tone: "gold",
    format: "video",
  },
  {
    slug: "entreprendre",
    href: "/rubrique/entreprendre",
    label: "Entreprendre",
    blurb:
      "Initiatives, projets et parcours de celles et ceux qui osent.",
    tone: "red",
  },
  {
    slug: "ecosysteme-pme",
    href: "/rubrique/ecosysteme-pme",
    label: "Écosystème PME",
    blurb:
      "Le tissu des PME, leurs défis, leurs relais et leurs réussites.",
    tone: "blue",
  },
  {
    slug: "femme",
    href: "/rubrique/femme",
    label: "Femme",
    blurb:
      "Voix, parcours et combats des femmes qui transforment leur milieu.",
    tone: "dark",
  },
  {
    slug: "innovation",
    href: "/rubrique/innovation",
    label: "Innovation",
    blurb:
      "Idées, technologies et usages qui font avancer l’entrepreneuriat.",
    tone: "gold",
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

const VIDEO_KEYS = new Set(
  [...RUBRIQUES, SHORT_RUBRIQUE]
    .filter((r) => r.format === "video")
    .flatMap((r) => [r.slug, r.label.toLowerCase()]),
);

/** Anciennes rubriques encore présentes en base / démo. */
const VIDEO_ALIASES = new Set([
  "stu-talk",
  "stu talk",
  "stu-stories",
  "stu stories",
  "inspirationnel",
  "game-changers",
  "game-changer",
  "grandes-entrevues",
  "grande-entrevue",
  "entrevue-croisee",
]);

const STORIES_KEYS = new Set([
  "rencontre-avec",
  "rencontre avec",
  "stu-stories",
  "stu stories",
  "inspirationnel",
]);

const FLAGSHIP_KEYS = new Set([
  ...FLAGSHIP_RUBRIQUE_SLUGS,
  "qu'en dit l'expert",
  "rencontre avec",
  "entreprendre",
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

/** Rubriques vidéo (et leurs alias) — miniatures au format 16:9. */
export function isVideoRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    const key = value.trim().toLowerCase();
    return VIDEO_KEYS.has(key) || VIDEO_ALIASES.has(key);
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

/** Rencontre Avec — pastille or, lecteur 16:9. */
export function isStoriesRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    return STORIES_KEYS.has(value.trim().toLowerCase());
  });
}

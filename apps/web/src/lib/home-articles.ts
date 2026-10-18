import type {
  PublicArticleCard,
  PublicHomeArticles,
} from "@/lib/api";
import {
  DEMO_A_NE_PAS_MANQUER_FEATURED,
  DEMO_A_NE_PAS_MANQUER_LIST,
  DEMO_DOSSIERS,
  DEMO_FEATURED,
  DEMO_FOR_YOU,
  DEMO_FIL_INFO,
  DEMO_GAME_FEATURED,
  DEMO_GAME_GRID,
  DEMO_INSPIRATIONNEL_FEATURED,
  DEMO_INSPIRATIONNEL_GRID,
  DEMO_PLUS_VUS_FEATURED,
  DEMO_PLUS_VUS_LIST,
  DEMO_STARTUP_FEATURED,
  DEMO_STARTUP_GRID,
  DEMO_ZOOM_FEATURED,
  DEMO_ZOOM_GRID,
  type DossierCard,
  type RubriqueSplitStory,
  type RubriqueStory,
  type TopStory,
} from "@/lib/legacy-demo";

const FALLBACK_COVER = "/legacy/articles/1591543587.jpg";

export function articleHref(story: {
  slug?: string;
  id: string | number;
}): string {
  return `/article/${encodeURIComponent(String(story.slug ?? story.id))}`;
}

function tone(
  value: string | undefined,
): TopStory["categoryTone"] {
  switch (value) {
    case "red":
    case "blue":
    case "teal":
    case "dark":
    case "gold":
      return value;
    case "orange":
    case "yellow":
      return "gold";
    default:
      return "teal";
  }
}

function tagTone(
  value: string | undefined,
): RubriqueStory["tagTone"] {
  switch (value) {
    case "red":
    case "blue":
    case "teal":
    case "dark":
    case "gold":
    case "orange":
    case "yellow":
      return value;
    default:
      return "teal";
  }
}

export function toTopStory(a: PublicArticleCard): TopStory {
  return {
    id: a.id,
    slug: a.slug,
    titre: a.title,
    excerpt: a.excerpt ?? undefined,
    cover: a.coverUrl || FALLBACK_COVER,
    category: a.categoryLabel,
    categoryTone: tone(a.categoryTone),
    author: a.authorName,
    authorAvatarUrl: a.authorAvatarUrl ?? null,
    dateLabel: a.dateLabel,
    viewCount: a.viewCount,
    featured: true,
    sponsor: a.sponsor
      ? { name: a.sponsor.name, logoUrl: a.sponsor.logoUrl }
      : null,
  };
}

export function toRubriqueStory(a: PublicArticleCard): RubriqueStory {
  return {
    id: a.id,
    slug: a.slug,
    titre: a.title,
    cover: a.coverUrl || FALLBACK_COVER,
    category: a.categoryLabel,
    author: a.authorName,
    authorAvatarUrl: a.authorAvatarUrl ?? null,
    dateLabel: a.dateLabel,
    tagTone: tagTone(a.categoryTone),
    videoHlsUrl: a.videoHlsUrl ?? null,
    videoPosterUrl: a.videoPosterUrl ?? null,
    videoStatus: a.videoStatus,
    viewCount: a.viewCount,
    sponsor: a.sponsor
      ? { name: a.sponsor.name, logoUrl: a.sponsor.logoUrl }
      : null,
  };
}

export function toSplitStory(a: PublicArticleCard): RubriqueSplitStory {
  return {
    ...toRubriqueStory(a),
    excerpt: a.excerpt ?? undefined,
  };
}

export function toDossierCard(a: PublicArticleCard): DossierCard {
  return {
    id: a.id,
    slug: a.slug,
    titre: a.title,
    cover: a.coverUrl || FALLBACK_COVER,
  };
}

function pick<T>(api: T[], demo: T[], min = 1): T[] {
  return api.length >= min ? api : demo;
}

function pickOne<T>(api: T[], demo: T): T {
  return api[0] ?? demo;
}

const FOR_YOU_CATEGORIES = [
  "actualites",
  "interview",
  "economie",
  "politique",
  "international",
  "portrait",
  "entreprise",
  "events",
] as const;

function seededOrder<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.abs((seed + i * 1103515245) % (i + 1));
    const current = out[i];
    out[i] = out[j]!;
    out[j] = current!;
  }
  return out;
}

function publishedTime(card: PublicArticleCard) {
  const time = Date.parse(card.publishedAt ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/** 4 rubriques tirées pour la session, puis les 5 articles les plus récents. */
export function selectForYou(
  feed: PublicHomeArticles | null,
  seed: number,
): TopStory[] {
  const safeSeed = Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 1;
  if (!feed) return seededOrder(DEMO_FOR_YOU, safeSeed).slice(0, 5);

  const groups: Record<(typeof FOR_YOU_CATEGORIES)[number], PublicArticleCard[]> = {
    actualites: feed.actualites ?? feed.ecosystemePme ?? [],
    interview: feed.interview ?? feed.rencontreAvec ?? [],
    economie: feed.economie ?? feed.innovation ?? [],
    politique: feed.politique ?? feed.entreprendre ?? [],
    international: feed.international ?? feed.expert ?? [],
    portrait: feed.portrait ?? feed.femme ?? [],
    entreprise: feed.entreprise ?? [],
    events: feed.events ?? [],
  };

  const chosen = seededOrder(FOR_YOU_CATEGORIES, safeSeed).slice(0, 4);
  const seen = new Set<string>();
  const cards: PublicArticleCard[] = [];
  for (const category of chosen) {
    for (const card of groups[category]) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      cards.push(card);
    }
  }

  cards.sort((a, b) => {
    const delta = publishedTime(b) - publishedTime(a);
    if (delta !== 0) return delta;
    return (a.id.length * safeSeed) % 1000 - (b.id.length * safeSeed) % 1000;
  });

  const picked = cards.slice(0, 5).map(toTopStory);
  if (picked.length >= 5) return picked;
  const filler = DEMO_FOR_YOU.filter(
    (story) => !picked.some((item) => String(item.id) === String(story.id)),
  );
  return [...picked, ...filler].slice(0, 5);
}

export type HomeArticlesView = {
  featured: TopStory[];
  topGrid: TopStory[];
  forYou: TopStory[];
  ecosystemePme: DossierCard[];
  ecosystemePmeStories: RubriqueStory[];
  filInfo: { id: string | number; slug?: string; titre: string }[];
  entreprendreFeatured: RubriqueStory;
  entreprendreGrid: RubriqueStory[];
  rencontreFeatured: RubriqueSplitStory;
  rencontreGrid: RubriqueSplitStory[];
  plusVusFeatured: RubriqueStory;
  plusVusList: RubriqueStory[];
  expertFeatured: RubriqueStory;
  expertGrid: RubriqueStory[];
  femmeFeatured: RubriqueSplitStory;
  femmeGrid: RubriqueStory[];
  femmeSlides: RubriqueSplitStory[];
  innovationStories: RubriqueStory[];
  eventsStories: RubriqueStory[];
  aNePasManquerFeatured: RubriqueStory;
  aNePasManquerList: RubriqueStory[];
};

export function buildHomeArticlesView(
  feed: PublicHomeArticles | null,
): HomeArticlesView {
  const featured = (feed?.featured ?? []).map(toTopStory);
  const actualitesSource = feed?.actualites ?? feed?.ecosystemePme ?? [];
  const interviewSource = feed?.interview ?? feed?.rencontreAvec ?? [];
  const economieSource = feed?.economie ?? feed?.innovation ?? [];
  const politiqueSource = feed?.politique ?? feed?.entreprendre ?? [];
  const internationalSource = feed?.international ?? feed?.expert ?? [];
  const portraitSource = feed?.portrait ?? feed?.femme ?? [];
  const ecosystemePmeCards = actualitesSource.map(toDossierCard);
  const ecosystemePmeStories = actualitesSource.map(toRubriqueStory);
  const filInfo = (feed?.filInfo ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    titre: a.title,
  }));
  const entreprendre = politiqueSource.map(toRubriqueStory);
  const rencontre = interviewSource.map(toSplitStory);
  const plusVus = (feed?.plusVus ?? []).map(toRubriqueStory);
  const expert = internationalSource.map(toRubriqueStory);
  const femme = portraitSource.map(toSplitStory);
  const innovationStories = economieSource.map(toRubriqueStory);
  const events = (feed?.events ?? []).map(toRubriqueStory);
  const miss = (feed?.aNePasManquer ?? []).map(toRubriqueStory);
  const seen = new Set<string>();
  const forYouLive = [
    ...actualitesSource,
    ...economieSource,
    ...politiqueSource,
    ...interviewSource,
  ]
    .map(toTopStory)
    .filter((story) => {
      const id = String(story.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  const topGridLive = (feed?.topGrid ?? []).map(toTopStory);
  const topGridFallback = featured.slice(1, 5);

  return {
    featured: pick(featured, DEMO_FEATURED, 1),
    topGrid: pick(
      topGridLive.length > 0 ? topGridLive : topGridFallback,
      DEMO_FEATURED.slice(1, 5),
      1,
    ).slice(0, 4),
    forYou: forYouLive.length >= 5 ? forYouLive.slice(0, 5) : DEMO_FOR_YOU,
    ecosystemePme: pick(ecosystemePmeCards, DEMO_DOSSIERS, 1),
    ecosystemePmeStories: pick(ecosystemePmeStories, DEMO_DOSSIERS.map((s) => ({
      ...s,
      category: "Actualités",
      author: "Fintech Médias",
      dateLabel: "",
      tagTone: "blue" as const,
    })), 1),
    filInfo: pick(
      filInfo,
      DEMO_FIL_INFO as { id: string | number; slug?: string; titre: string }[],
      1,
    ).slice(0, 5),
    entreprendreFeatured: pickOne(entreprendre, DEMO_STARTUP_FEATURED),
    entreprendreGrid: pick(entreprendre.slice(1), DEMO_STARTUP_GRID, 1),
    rencontreFeatured: pickOne(
      rencontre,
      DEMO_INSPIRATIONNEL_FEATURED,
    ),
    rencontreGrid: pick(
      rencontre.slice(1),
      DEMO_INSPIRATIONNEL_GRID,
      1,
    ),
    plusVusFeatured: pickOne(plusVus, DEMO_PLUS_VUS_FEATURED),
    plusVusList: pick(plusVus.slice(1), DEMO_PLUS_VUS_LIST, 1).slice(0, 2),
    expertFeatured: pickOne(expert, DEMO_ZOOM_FEATURED),
    expertGrid: pick(expert.slice(1), DEMO_ZOOM_GRID, 1),
    femmeFeatured: pickOne(femme, DEMO_GAME_FEATURED),
    femmeGrid: pick(femme.slice(1), DEMO_GAME_GRID, 1),
    femmeSlides: femme.length > 0 ? femme.slice(0, 5) : [DEMO_GAME_FEATURED],
    innovationStories: pick(
      innovationStories,
      DEMO_DOSSIERS.map((s) => ({
        ...s,
        category: "Économie",
        author: "Fintech Médias",
        dateLabel: "",
        tagTone: "gold" as const,
      })),
      1,
    ),
    eventsStories: pick(
      events,
      DEMO_DOSSIERS.map((s) => ({
        ...s,
        category: "Events",
        author: "Fintech Médias",
        dateLabel: "",
        tagTone: "teal" as const,
      })),
      1,
    ),
    aNePasManquerFeatured: pickOne(miss, DEMO_A_NE_PAS_MANQUER_FEATURED),
    aNePasManquerList: pick(miss.slice(1), DEMO_A_NE_PAS_MANQUER_LIST, 1).slice(
      0,
      2,
    ),
  };
}

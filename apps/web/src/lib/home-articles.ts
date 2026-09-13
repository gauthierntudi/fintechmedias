import type {
  PublicArticleCard,
  PublicHomeArticles,
} from "@/lib/api";
import { isFlagshipRubrique } from "@/lib/rubriques";
import {
  DEMO_A_NE_PAS_MANQUER_FEATURED,
  DEMO_A_NE_PAS_MANQUER_LIST,
  DEMO_DOSSIERS,
  DEMO_FEATURED,
  DEMO_FIL_INFO,
  DEMO_GAME_FEATURED,
  DEMO_GAME_GRID,
  DEMO_INSPIRATIONNEL_FEATURED,
  DEMO_INSPIRATIONNEL_GRID,
  DEMO_PLUS_VUS_FEATURED,
  DEMO_PLUS_VUS_LIST,
  DEMO_STARTUP_FEATURED,
  DEMO_STARTUP_GRID,
  DEMO_TOP_GRID,
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
    dateLabel: a.dateLabel,
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

function pickLatestPerRubrique(
  groups: TopStory[][],
  demo: TopStory[],
  featuredIds: Set<string>,
): TopStory[] {
  const used = new Set(featuredIds);
  const out: TopStory[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] ?? [];
    const article =
      group.find((item) => !used.has(String(item.id))) ?? group[0] ?? demo[i];
    if (!article) continue;
    const id = String(article.id);
    if (used.has(id) && out.some((row) => String(row.id) === id)) continue;
    used.add(id);
    out.push(article);
  }
  return out.slice(0, 5);
}

export type HomeArticlesView = {
  featured: TopStory[];
  topGrid: TopStory[];
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
  innovationStories: RubriqueStory[];
  aNePasManquerFeatured: RubriqueStory;
  aNePasManquerList: RubriqueStory[];
};

export function buildHomeArticlesView(
  feed: PublicHomeArticles | null,
): HomeArticlesView {
  const featured = (feed?.featured ?? [])
    .filter((a) => isFlagshipRubrique(a.category, a.categoryLabel))
    .map(toTopStory);
  const ecosystemePmeCards = (feed?.ecosystemePme ?? []).map(toDossierCard);
  const ecosystemePmeStories = (feed?.ecosystemePme ?? []).map(toRubriqueStory);
  const filInfo = (feed?.filInfo ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    titre: a.title,
  }));
  const entreprendre = (feed?.entreprendre ?? []).map(toRubriqueStory);
  const rencontre = (feed?.rencontreAvec ?? []).map(toSplitStory);
  const plusVus = (feed?.plusVus ?? []).map(toRubriqueStory);
  const expert = (feed?.expert ?? []).map(toRubriqueStory);
  const femme = (feed?.femme ?? []).map(toSplitStory);
  const innovationStories = (feed?.innovation ?? []).map(toRubriqueStory);
  const miss = (feed?.aNePasManquer ?? []).map(toRubriqueStory);

  const featuredIds = new Set(featured.map((a) => String(a.id)));

  return {
    featured: pick(
      featured,
      DEMO_FEATURED.filter((s) => isFlagshipRubrique(s.category)),
      1,
    ),
    topGrid: pickLatestPerRubrique(
      [
        (feed?.expert ?? []).map(toTopStory),
        (feed?.rencontreAvec ?? []).map(toTopStory),
        (feed?.entreprendre ?? []).map(toTopStory),
      ],
      DEMO_TOP_GRID.filter((s) => isFlagshipRubrique(s.category)),
      featuredIds,
    ),
    ecosystemePme: pick(ecosystemePmeCards, DEMO_DOSSIERS, 1),
    ecosystemePmeStories: pick(ecosystemePmeStories, DEMO_DOSSIERS.map((s) => ({
      ...s,
      category: "Écosystème PME",
      author: "L'Entrevue",
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
    innovationStories: pick(
      innovationStories,
      DEMO_DOSSIERS.map((s) => ({
        ...s,
        category: "Innovation",
        author: "L'Entrevue",
        dateLabel: "",
        tagTone: "gold" as const,
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

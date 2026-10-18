import Link from "next/link";
import { DEMO_FEATURED, DEMO_TOP_GRID, type TopStory } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { RUBRIQUES } from "@/lib/rubriques";
import { CoverImage } from "@/components/site/cover-image";
import { ArticleThumbSponsor } from "@/components/site/article-thumb-sponsor";
import { TopCardAdSwap } from "@/components/site/top-card-ad-swap";
import { ViewProgress } from "@/components/site/view-progress";
import "./top-stories.css";

const SIDE_AREAS = ["a", "b", "c", "d"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  actualites: "#ed2228",
  interview: "#0457d3",
  economie: "#ce5105",
  politique: "#e6a406",
  intl: "#09b960",
  portrait: "#6709dc",
  entreprise: "#626a6b",
  events: "#2b3a6c",
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "");
}

function categoryColor(label: string) {
  const key = normalizeKey(label).replace(/[^a-z]/g, "");
  return CATEGORY_COLORS[key] ?? "#ce5105";
}

function categoryHref(label: string) {
  const key = normalizeKey(label);
  const match = RUBRIQUES.find((item) => normalizeKey(item.label) === key);
  return match?.href ?? "/actualites";
}

function hotPercent(views: number | undefined) {
  if (!views || views <= 100) return 0;
  return Math.max(0, Math.min(100, Math.round((views / 2000) * 100)));
}

function uniqueStories(stories: TopStory[]) {
  const seen = new Set<string>();
  const out: TopStory[] = [];
  for (const story of stories) {
    const id = String(story.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(story);
  }
  return out;
}

function CategoryBadge({
  label,
  une = false,
}: {
  label: string;
  une?: boolean;
}) {
  return (
    <Link
      href={une ? categoryHref(label) : categoryHref(label)}
      className={une ? "opt-top__badge opt-top__badge--une" : "opt-top__badge"}
      style={une ? undefined : { background: categoryColor(label) }}
    >
      {une ? "A LA UNE" : label}
    </Link>
  );
}

function StoryMeta({ story, onGreen = false }: { story: TopStory; onGreen?: boolean }) {
  if (onGreen) {
    return (
      <p className="opt-top__meta opt-top__meta--on-green">
        {story.author ? (
          <span className="opt-top__author">
            {story.authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.authorAvatarUrl} alt="" className="opt-top__avatar" />
            ) : null}
            Par <span>{story.author}</span>
          </span>
        ) : null}
        {story.dateLabel ? <span className="opt-top__date">{story.dateLabel}</span> : null}
      </p>
    );
  }

  return (
    <p className="opt-top__meta">
      {story.author ? <span>Par {story.author}</span> : null}
      {story.dateLabel ? <span className="opt-top__date">{story.dateLabel}</span> : null}
    </p>
  );
}

function LeadStory({ story }: { story: TopStory }) {
  const href = articleHref(story);

  return (
    <article className="opt-top__lead">
      <div className="opt-top__lead-media">
        <Link href={href} className="opt-top__media-link" aria-label={story.titre}>
          <CoverImage src={story.cover} className="opt-top__cover" />
        </Link>
        <ArticleThumbSponsor sponsor={story.sponsor} />
        {story.category ? (
          <div className="opt-top__badges">
            <CategoryBadge label={story.category} />
            <CategoryBadge label={story.category} une />
          </div>
        ) : null}
      </div>
      <div className="opt-top__lead-copy">
        <h2 className="opt-top__lead-title">
          <Link href={href}>{story.titre}</Link>
        </h2>
        {story.excerpt ? <p className="opt-top__lead-excerpt">{story.excerpt}</p> : null}
        <StoryMeta story={story} onGreen />
      </div>
    </article>
  );
}

function SideStory({
  story,
  area,
}: {
  story: TopStory;
  area: (typeof SIDE_AREAS)[number];
}) {
  const href = articleHref(story);
  const score = hotPercent(story.viewCount);

  return (
    <article className={`opt-top__card opt-top__card--${area}`}>
      <div className="opt-top__card-media">
        <Link href={href} className="opt-top__media-link" aria-label={story.titre}>
          <CoverImage src={story.cover} className="opt-top__cover" />
        </Link>
        <ArticleThumbSponsor sponsor={story.sponsor} compact />
        {story.category ? (
          <div className="opt-top__badges">
            <CategoryBadge label={story.category} />
          </div>
        ) : null}
        <ViewProgress percent={score} className="opt-top__donut" />
      </div>
      <h3 className="opt-top__card-title">
        <Link href={href}>{story.titre}</Link>
      </h3>
      <StoryMeta story={story} />
    </article>
  );
}

/** Première section accueil — grand article et quatre cartes. */
export function TopStories({
  featured = DEMO_FEATURED,
}: {
  featured?: TopStory[];
} = {}) {
  const stories = uniqueStories(featured);
  const lead = stories[0];
  if (!lead) return null;

  const side = uniqueStories([...stories.slice(1), ...DEMO_TOP_GRID]).slice(0, 4);

  return (
    <section className="opt-top" aria-label="À la une">
      <div className="opt-top__grid">
        <LeadStory story={lead} />
        {side.map((story, index) => {
          const area = SIDE_AREAS[index] ?? "d";
          const card = <SideStory key={story.id} story={story} area={area} />;
          // 4ᵉ carte (bas droite) : alterne article / pub « Article, à lire aussi »
          if (index === 3) {
            return (
              <TopCardAdSwap key={story.id} area={area}>
                <SideStory story={story} area={area} />
              </TopCardAdSwap>
            );
          }
          return card;
        })}
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEMO_FOR_YOU, type RubriqueStory, type TopStory } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { RUBRIQUES } from "@/lib/rubriques";
import { CoverImage } from "@/components/site/cover-image";
import { AdSlot } from "@/components/site/ad-slot";
import { ViewProgress } from "@/components/site/view-progress";
import "./home-for-you.css";

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
  if (!views || views <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((views / 2000) * 100)));
}

function CategoryBadge({ label }: { label: string }) {
  return (
    <Link
      href={categoryHref(label)}
      className="opt-fy__badge"
      style={{ background: categoryColor(label) }}
    >
      {label}
    </Link>
  );
}

function Donut({ percent }: { percent: number }) {
  return <ViewProgress percent={percent} className="opt-fy__donut" />;
}

function LeadStory({ story }: { story: TopStory }) {
  const href = articleHref(story);
  return (
    <article className="opt-fy__lead">
      <div className="opt-fy__lead-media">
        <Link href={href} className="opt-fy__media-link" aria-label={story.titre}>
          <CoverImage src={story.cover} className="opt-fy__cover" />
        </Link>
        {story.category ? <CategoryBadge label={story.category} /> : null}
      </div>
      <h3 className="opt-fy__lead-title">
        <Link href={href}>{story.titre}</Link>
      </h3>
      {story.excerpt ? <p className="opt-fy__excerpt">{story.excerpt}</p> : null}
      <p className="opt-fy__meta">
        {story.author ? (
          <span className="opt-fy__author">
            {story.authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.authorAvatarUrl} alt="" className="opt-fy__avatar" />
            ) : null}
            Par <span>{story.author}</span>
          </span>
        ) : null}
        <time>{story.dateLabel}</time>
      </p>
    </article>
  );
}

function MiniStory({ story }: { story: TopStory }) {
  const href = articleHref(story);
  return (
    <article className="opt-fy__mini">
      <Link href={href} className="opt-fy__mini-media" aria-label={story.titre}>
        <CoverImage src={story.cover} className="opt-fy__cover" />
      </Link>
      <div className="opt-fy__mini-copy">
        {story.category ? (
          <Link
            href={categoryHref(story.category)}
            className="opt-fy__kicker"
            style={{ borderBottomColor: categoryColor(story.category) }}
          >
            {story.category}
          </Link>
        ) : null}
        <h3 className="opt-fy__mini-title">
          <Link href={href}>{story.titre}</Link>
        </h3>
        <p className="opt-fy__date">{story.dateLabel}</p>
      </div>
    </article>
  );
}

function MustStory({ story, index }: { story: RubriqueStory; index: number }) {
  const href = articleHref(story);
  return (
    <article className="opt-fy__must">
      <div className="opt-fy__must-media">
        <Link href={href} className="opt-fy__media-link" aria-label={story.titre}>
          <CoverImage src={story.cover} className="opt-fy__cover" />
        </Link>
        {story.category ? <CategoryBadge label={story.category} /> : null}
        <Donut percent={hotPercent(story.viewCount)} />
      </div>
      <div className="opt-fy__must-copy">
        <span className="opt-fy__num" aria-hidden>
          {index}
        </span>
        <h3 className="opt-fy__must-title">
          <Link href={href}>{story.titre}</Link>
        </h3>
      </div>
    </article>
  );
}

export function HomeForYou({
  stories = DEMO_FOR_YOU,
  mustRead,
  children,
}: {
  stories?: TopStory[];
  mustRead: RubriqueStory[];
  children?: ReactNode;
}) {
  const items = (stories.length > 0 ? stories : DEMO_FOR_YOU).slice(0, 5);
  const lead = items[0];
  const rest = items.slice(1, 5);
  const side = mustRead.slice(0, 2);
  if (!lead) return null;

  return (
    <section className="opt-fy" aria-label="Juste pour vous">
      <div className="opt-fy__grid">
        <div className="opt-fy__main">
          <header className="opt-fy__head">
            <h2 className="opt-fy__title">
              <span className="opt-fy__mark" aria-hidden />
              <span>
                Juste <em>pour vous</em>
              </span>
            </h2>
            <Link href="/actualites" className="opt-fy__more">
              <span>En savoir plus</span>
              <span className="opt-fy__more-icon" aria-hidden>
                <ArrowRight size={12} strokeWidth={2.4} />
              </span>
            </Link>
          </header>
          <div className="opt-fy__body">
            <LeadStory story={lead} />
            <div className="opt-fy__list">
              {rest.map((story) => (
                <MiniStory key={story.id} story={story} />
              ))}
            </div>
          </div>
          {children}
        </div>
        {side.length > 0 ? (
          <aside className="opt-fy__side" aria-label="À ne pas manquer">
            <AdSlot
              format="large_portrait"
              emplacement="pub-body-sidebar-1"
              rotateMs={10000}
            />
            <header className="opt-fy__head">
              <h2 className="opt-fy__title">
                <span className="opt-fy__mark" aria-hidden />
                <span>À ne pas manquer</span>
              </h2>
            </header>
            <div className="opt-fy__musts">
              {side.map((story, index) => (
                <MustStory key={story.id} story={story} index={index + 1} />
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

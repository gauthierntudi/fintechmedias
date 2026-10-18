import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CoverImage } from "@/components/site/cover-image";
import { articleHref } from "@/lib/home-articles";
import type { RubriqueStory } from "@/lib/legacy-demo";
import { ViewProgress } from "@/components/site/view-progress";
import "./home-grid-posts.css";

function hotPercent(views: number | undefined) {
  if (!views || views <= 100) return 0;
  return Math.max(0, Math.min(100, Math.round((views / 2000) * 100)));
}

function Card({
  story,
  color,
  categoryHref,
}: {
  story: RubriqueStory;
  color: string;
  categoryHref: string;
}) {
  const href = articleHref(story);
  const percent = hotPercent(story.viewCount);
  return (
    <article className="opt-grid__card">
      <div className="opt-grid__media">
        <Link href={href} className="opt-grid__media-link" aria-label={story.titre}>
          <CoverImage src={story.cover} className="opt-grid__cover" />
        </Link>
        {story.category ? (
          <Link href={categoryHref} className="opt-grid__badge" style={{ background: color }}>
            {story.category}
          </Link>
        ) : null}
        <ViewProgress percent={percent} className="opt-grid__donut" />
      </div>
      <h3 className="opt-grid__title">
        <Link href={href}>{story.titre}</Link>
      </h3>
      <p className="opt-grid__meta">
        <span>Par {story.author}</span>
        {story.dateLabel ? <time>{story.dateLabel}</time> : null}
      </p>
    </article>
  );
}

export function HomeGridPosts({
  title,
  href,
  color,
  stories,
  embedded = false,
}: {
  title: string;
  href: string;
  color: string;
  stories: RubriqueStory[];
  embedded?: boolean;
}) {
  const items = stories.slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section
      className={embedded ? "opt-grid opt-grid--embedded" : "opt-grid"}
      aria-label={title}
    >
      <div className="opt-grid__inner">
        <header className="opt-grid__head">
          <h2 className="opt-grid__heading" style={{ color }}>
            <span className="opt-grid__mark" style={{ background: color }} aria-hidden />
            <span>{title}</span>
          </h2>
          <Link href={href} className="opt-grid__more">
            <span>En savoir plus</span>
            <span className="opt-grid__more-icon" aria-hidden>
              <ArrowRight size={12} strokeWidth={2.4} />
            </span>
          </Link>
        </header>
        <div className="opt-grid__list">
          {items.map((story) => (
            <Card key={story.id} story={story} color={color} categoryHref={href} />
          ))}
        </div>
      </div>
    </section>
  );
}

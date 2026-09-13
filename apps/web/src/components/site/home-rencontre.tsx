import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  DEMO_INSPIRATIONNEL_FEATURED,
  DEMO_INSPIRATIONNEL_GRID,
  type RubriqueSplitStory,
} from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import { RUBRIQUE_BY_SLUG } from "@/lib/rubriques";
import "./home-rencontre.css";

const RUBRIQUE = RUBRIQUE_BY_SLUG["rencontre-avec"];

function readingMinutes(story: RubriqueSplitStory) {
  const words = `${story.titre} ${story.excerpt ?? ""}`
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.min(12, Math.max(3, Math.round(words / 40) + 3));
}

function formatViews(count?: number) {
  if (typeof count !== "number" || count < 0) return null;
  return `${new Intl.NumberFormat("fr-FR").format(count)} vue${count > 1 ? "s" : ""}`;
}

function SponsorLine({ story }: { story: RubriqueSplitStory }) {
  if (!story.sponsor?.name && !story.sponsor?.logoUrl) return null;
  return (
    <p className="opt-renc__sponsor">
      <span>Sponsorisé Par</span>
      {story.sponsor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.sponsor.logoUrl} alt="" />
      ) : null}
    </p>
  );
}

function Meta({ story }: { story: RubriqueSplitStory }) {
  const views = formatViews(story.viewCount);
  return (
    <p className="opt-renc__meta">
      <span>{story.dateLabel}</span>
      <span aria-hidden>·</span>
      <span>{readingMinutes(story)} min de lecture</span>
      {views ? (
        <>
          <span aria-hidden>·</span>
          <span>{views}</span>
        </>
      ) : null}
    </p>
  );
}

export function HomeRencontre({
  featured = DEMO_INSPIRATIONNEL_FEATURED,
  items = DEMO_INSPIRATIONNEL_GRID.slice(0, 3),
}: {
  featured?: RubriqueSplitStory;
  items?: RubriqueSplitStory[];
} = {}) {
  const list = items.slice(0, 3);

  return (
    <section className="opt-renc" aria-labelledby="opt-renc-title">
      <div className="opt-renc__inner">
        <header className="opt-renc__head">
          <h2 id="opt-renc-title" className="opt-renc__title">
            {RUBRIQUE.label}
          </h2>
          <Link href={RUBRIQUE.href} className="opt-renc__all">
            Toutes les rencontres
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
        </header>

        <div className="opt-renc__layout">
          <article className="opt-renc__featured">
            <Link href={articleHref(featured)} className="opt-renc__featured-media">
              <CoverImage src={featured.cover} />
              {featured.sponsor?.name || featured.sponsor?.logoUrl ? (
                <span className="opt-renc__featured-sponsor">
                  <em>Sponsorisé Par</em>
                  {featured.sponsor.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featured.sponsor.logoUrl}
                      alt={featured.sponsor.name}
                    />
                  ) : null}
                </span>
              ) : null}
            </Link>
            <p className="opt-renc__cat">{featured.category}</p>
            <h3 className="opt-renc__featured-title">
              <Link href={articleHref(featured)} title={featured.titre}>
                {featured.titre}
              </Link>
            </h3>
            {featured.excerpt ? (
              <p className="opt-renc__excerpt">{featured.excerpt}</p>
            ) : null}
            <Meta story={featured} />
            <Link href={articleHref(featured)} className="opt-renc__read">
              Lire la rencontre
              <ArrowRight size={15} strokeWidth={2} aria-hidden />
            </Link>
          </article>

          <ul className="opt-renc__list">
            {list.map((story) => (
              <li key={story.id} className="opt-renc__item">
                <Link href={articleHref(story)} className="opt-renc__thumb">
                  <CoverImage src={story.cover} />
                </Link>
                <div className="opt-renc__item-body">
                  <SponsorLine story={story} />
                  <p className="opt-renc__cat">{story.category}</p>
                  <h3 className="opt-renc__item-title">
                    <Link href={articleHref(story)} title={story.titre}>
                      {story.titre}
                    </Link>
                  </h3>
                  <Meta story={story} />
                  <Link href={articleHref(story)} className="opt-renc__read">
                    Lire la rencontre
                    <ArrowRight size={15} strokeWidth={2} aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

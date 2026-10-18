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

const RUBRIQUE = RUBRIQUE_BY_SLUG.interview;
const ACCENT = "#0457d3";

function Byline({ story, onPanel = false }: { story: RubriqueSplitStory; onPanel?: boolean }) {
  return (
    <p className={onPanel ? "opt-split__byline opt-split__byline--panel" : "opt-split__byline"}>
      <span className="opt-split__author">
        {onPanel && story.authorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.authorAvatarUrl} alt="" className="opt-split__avatar" />
        ) : null}
        <span>Par {story.author}</span>
      </span>
      {story.dateLabel ? <time>{story.dateLabel}</time> : null}
    </p>
  );
}

export function HomeRencontre({
  featured = DEMO_INSPIRATIONNEL_FEATURED,
  items = DEMO_INSPIRATIONNEL_GRID.slice(0, 3),
  embedded = false,
}: {
  featured?: RubriqueSplitStory;
  items?: RubriqueSplitStory[];
  embedded?: boolean;
} = {}) {
  const list = items.slice(0, 3);
  const featureHref = articleHref(featured);

  return (
    <section
      className={embedded ? "opt-renc opt-renc--embedded" : "opt-renc"}
      aria-labelledby="opt-renc-title"
    >
      <div className="opt-renc__inner">
        <header className="opt-split__head">
          <h2 id="opt-renc-title" className="opt-split__heading" style={{ color: ACCENT }}>
            <span className="opt-split__mark" style={{ background: ACCENT }} aria-hidden />
            <span>{RUBRIQUE.label}</span>
          </h2>
          <Link href={RUBRIQUE.href} className="opt-split__more">
            <span>En savoir plus</span>
            <span className="opt-split__more-icon" aria-hidden>
              <ArrowRight size={12} strokeWidth={2.4} />
            </span>
          </Link>
        </header>

        <article className="opt-split__feature">
          <Link href={featureHref} className="opt-split__feature-media" aria-label={featured.titre}>
            <CoverImage src={featured.cover} />
          </Link>
          <div className="opt-split__copy">
            <Link href={RUBRIQUE.href} className="opt-split__badge" style={{ background: ACCENT }}>
              {featured.category || RUBRIQUE.label}
            </Link>
            <h3 className="opt-split__feature-title">
              <Link href={featureHref}>{featured.titre}</Link>
            </h3>
            {featured.excerpt ? <p className="opt-split__excerpt">{featured.excerpt}</p> : null}
            <Byline story={featured} onPanel />
          </div>
        </article>

        {list.length > 0 ? (
          <div className="opt-split__scroller">
            <div className="opt-split__grid" role="list">
              {list.map((story) => {
                const href = articleHref(story);
                return (
                  <article key={story.id} className="opt-split__card" role="listitem">
                    <div className="opt-split__card-media">
                      <Link href={href} className="opt-split__card-link" aria-label={story.titre}>
                        <CoverImage src={story.cover} />
                      </Link>
                      <Link
                        href={RUBRIQUE.href}
                        className="opt-split__badge"
                        style={{ background: ACCENT }}
                      >
                        {story.category || RUBRIQUE.label}
                      </Link>
                    </div>
                    <h3 className="opt-split__card-title">
                      <Link href={href}>{story.titre}</Link>
                    </h3>
                    <Byline story={story} />
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

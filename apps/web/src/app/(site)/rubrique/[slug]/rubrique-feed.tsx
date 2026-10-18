"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  articlesPublicApi,
  type PublicArticleCard,
} from "@/lib/api";
import { CoverImage } from "@/components/site/cover-image";
import { ViewProgress } from "@/components/site/view-progress";
import { ArticleThumbSponsor } from "@/components/site/article-thumb-sponsor";
import { VideoPlay } from "@/components/site/video-play";
import { isVideoArticle, RUBRIQUES } from "@/lib/rubriques";
import { AdSlot } from "@/components/site/ad-slot";
import { Fragment } from "react";

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

function moreHeading(slug: string, label: string, video: boolean) {
  const name = label.trim().toLowerCase();
  if (name === "interview" || slug === "interview") return "Nos autres interviews";
  if (
    name === "portrait" ||
    name === "édito" ||
    name === "edito" ||
    slug === "portrait"
  ) {
    return "Nos autres éditos";
  }
  if (video) return "Nos autres vidéos";
  return "Nos autres articles";
}

function hotPercent(views: number | undefined) {
  if (!views || views <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((views / 2000) * 100)));
}

const BATCH = 8;

type Props = {
  /** Rubrique (`decryptages`…) ou fil global (`actualites`). */
  categorySlug: string;
  categoryLabel: string;
  initialItems: PublicArticleCard[];
  mostRead: PublicArticleCard[];
  total: number;
  /** Nombre d’articles déjà affichés dans le pack du haut (ex. 5). */
  packCount: number;
  showHeading: boolean;
  /** Si true, charge via `/articles/feed` (toutes actualités). */
  globalFeed?: boolean;
  video?: boolean;
};

export function RubriqueFeed({
  categorySlug,
  categoryLabel,
  initialItems,
  mostRead,
  total,
  packCount,
  showHeading,
  globalFeed = false,
  video = false,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loaded = packCount + items.length;
  const done = exhausted || loaded >= total;
  const hasFeed = items.length > 0 || !done;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const skip = packCount + items.length;
      const res = globalFeed
        ? await articlesPublicApi.feed({ take: BATCH, skip })
        : await articlesPublicApi.byCategory(categorySlug, {
            take: BATCH,
            skip,
          });
      const seen = new Set(items.map((a) => a.id));
      const next = res.items.filter((a) => !seen.has(a.id));
      if (next.length === 0 || skip + res.items.length >= res.total) {
        setExhausted(true);
      }
      if (next.length) {
        setItems((prev) => [...prev, ...next]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger la suite",
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [categorySlug, done, globalFeed, items.length, packCount]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, loadMore]);

  if (!hasFeed && mostRead.length === 0) return null;

  return (
    <section
      className="opt-rubrique__more"
      aria-labelledby={showHeading ? "opt-rubrique-more" : undefined}
    >
      {showHeading ? (
        <h2 id="opt-rubrique-more" className="opt-rubrique__more-title">
          {moreHeading(categorySlug, categoryLabel, video)}
        </h2>
      ) : null}

      <div className="opt-rubrique__more-layout">
        <div className="opt-rubrique__feed">
          {items.map((item, index) => (
            <Fragment key={item.id}>
              <FeedRow article={item} />
              {index === 3 ? (
                <AdSlot
                  format="paysage_small"
                  emplacement="pub-body-1"
                  rotateMs={10000}
                />
              ) : null}
            </Fragment>
          ))}

          {!done ? (
            <div
              ref={sentinelRef}
              className="opt-rubrique__feed-sentinel"
              aria-hidden
            />
          ) : null}

          {!done ? (
            <div
              ref={sentinelRef}
              className="opt-rubrique__feed-sentinel"
              aria-hidden
            />
          ) : null}

          {loading ? (
            <div
              className="opt-rubrique__feed-skel"
              aria-busy="true"
              aria-label="Chargement"
              role="status"
            >
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="opt-rubrique__feed-skel-row">
                  <span className="opt-rubrique__feed-skel-media" />
                  <span className="opt-rubrique__feed-skel-body">
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--title" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--excerpt" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--excerpt-short" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--meta" />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="opt-rubrique__feed-status opt-rubrique__feed-status--error">
              {error}{" "}
              <button
                type="button"
                className="opt-rubrique__feed-retry"
                onClick={() => void loadMore()}
              >
                Réessayer
              </button>
            </p>
          ) : null}

          {done && items.length > 0 ? (
            <p className="opt-rubrique__feed-end" role="status">
              Vous êtes à jour
            </p>
          ) : null}
        </div>

        {mostRead.length > 0 ? (
          <aside className="opt-rubrique__popular" aria-label="À ne pas manquer">
            <AdSlot
              format="rectangle"
              emplacement="pub-body-sidebar-2"
              rotateMs={10000}
            />
            <h2 className="opt-rubrique__popular-title">
              <span className="opt-rubrique__popular-mark" aria-hidden />
              <span>À ne pas manquer</span>
            </h2>
            <div className="opt-rubrique__popular-list">
              {mostRead.slice(0, 2).map((item, i) => (
                <MustCard key={item.id} article={item} index={i + 1} />
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function MustCard({
  article,
  index,
}: {
  article: PublicArticleCard;
  index: number;
}) {
  const href = `/article/${encodeURIComponent(article.slug)}`;
  const score = hotPercent(article.viewCount);
  const label = article.categoryLabel;

  return (
    <article className="opt-rubrique__must">
      <div className="opt-rubrique__must-media">
        <Link href={href} className="opt-rubrique__must-cover" aria-label={article.title}>
          {article.coverUrl ? (
            <CoverImage src={article.coverUrl} />
          ) : (
            <span className="opt-rubrique__ph" aria-hidden />
          )}
        </Link>
        {label ? (
          <Link
            href={categoryHref(label)}
            className="opt-rubrique__must-badge"
            style={{ background: categoryColor(label) }}
          >
            {label}
          </Link>
        ) : null}
        <ViewProgress percent={score} className="opt-rubrique__must-donut" />
      </div>
      <div className="opt-rubrique__must-copy">
        <span className="opt-rubrique__must-num" aria-hidden>
          {index}
        </span>
        <h3 className="opt-rubrique__must-title">
          <Link href={href}>{article.title}</Link>
        </h3>
      </div>
    </article>
  );
}

function FeedRow({
  article,
}: {
  article: PublicArticleCard;
}) {
  const showPlay = isVideoArticle(article);

  return (
    <article className="opt-rubrique__feed-row">
      <Link
        href={`/article/${encodeURIComponent(article.slug)}`}
        className="opt-rubrique__feed-link"
      >
        <span className="opt-rubrique__feed-media">
          {article.coverUrl ? (
            <CoverImage src={article.coverUrl} />
          ) : (
            <span className="opt-rubrique__ph" aria-hidden />
          )}
          <ArticleThumbSponsor sponsor={article.sponsor} compact />
          {showPlay ? (
            <VideoPlay size={18} className="opt-video-play--sm" />
          ) : null}
        </span>
        <span className="opt-rubrique__feed-body">
          <span className="opt-rubrique__feed-title">{article.title}</span>
          {article.excerpt ? (
            <span className="opt-rubrique__feed-excerpt">{article.excerpt}</span>
          ) : null}
          <span className="opt-rubrique__feed-meta">
            <span>{article.categoryLabel}</span>
            {article.dateLabel ? (
              <time className="opt-rubrique__feed-date">{article.dateLabel}</time>
            ) : null}
          </span>
        </span>
      </Link>
    </article>
  );
}

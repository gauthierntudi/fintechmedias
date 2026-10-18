"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdSlot } from "@/components/site/ad-slot";
import { ArticleThumbSponsor, type ThumbSponsor } from "@/components/site/article-thumb-sponsor";
import { VideoPlay } from "@/components/site/video-play";

export type SimilarArticleCard = {
  id: string;
  href: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  categoryLabel: string;
  categoryColor: string;
  authorName: string;
  dateLabel: string;
  publishedAt: string | null;
  video: boolean;
  sponsor: ThumbSponsor;
};

const MOBILE_MQ = "(max-width: 720px)";

export function SimilarArticles({ items }: { items: SimilarArticleCard[] }) {
  const [hasAd, setHasAd] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const showAd = hasAd && !isMobile;
  const articles = showAd ? items.slice(0, 3) : items.slice(0, 4);
  const [first, ...rest] = articles;

  return (
    <div className="opt-article__more-scroller">
      <div className="opt-article__more-grid">
        {first ? <SimilarCard item={first} /> : null}
        {!isMobile ? (
          <AdSlot
            format="rectangle"
            emplacement="pub-sidebar-1"
            rotateMs={10000}
            card
            onAvailability={setHasAd}
          />
        ) : null}
        {rest.map((item) => (
          <SimilarCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function SimilarCard({ item }: { item: SimilarArticleCard }) {
  return (
    <Link href={item.href} className="opt-article__more-card">
      <span
        className={`opt-article__more-thumb${
          item.video ? " opt-article__more-thumb--video" : ""
        }`}
      >
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverUrl} alt="" />
        ) : null}
        {item.categoryLabel ? (
          <span
            className="opt-article__more-cat"
            style={{ background: item.categoryColor }}
          >
            {item.categoryLabel}
          </span>
        ) : null}
        <ArticleThumbSponsor sponsor={item.sponsor} compact />
        {item.video ? <VideoPlay size={14} className="opt-video-play--xs" /> : null}
      </span>
      <span className="opt-article__more-meta">
        <span className="opt-article__more-card-title">{item.title}</span>
        {item.excerpt ? (
          <span className="opt-article__more-excerpt">{item.excerpt}</span>
        ) : null}
        {item.authorName || item.dateLabel ? (
          <span className="opt-article__more-byline">
            {item.authorName ? <span>Par {item.authorName}</span> : <span />}
            {item.dateLabel ? (
              <time dateTime={item.publishedAt ?? undefined}>{item.dateLabel}</time>
            ) : null}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

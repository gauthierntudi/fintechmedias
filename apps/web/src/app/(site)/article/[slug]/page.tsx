import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articlesPublicApi, type PublicArticleCard } from "@/lib/api";
import {
  absoluteMediaUrl,
  getSiteUrl,
  plainDescription,
} from "@/lib/site-url";
import {
  isShortRubrique,
  isVideoArticle,
  legacyCategorySlug,
  RUBRIQUE_BY_SLUG,
} from "@/lib/rubriques";
import { ArticleBody } from "./article-body";
import { VideoPlay } from "@/components/site/video-play";
import { HlsPlayer } from "@/components/site/hls-player";
import { ArticleMagazineFloat } from "./article-magazine-float";
import { ArticleShare } from "@/components/site/article-share";
import { AdSlot } from "@/components/site/ad-slot";
import { SimilarArticles } from "./similar-articles";
import "./article.css";
import { preconnect, preload } from "react-dom";
import { BRAND } from "@/lib/brand";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const article = await articlesPublicApi.bySlug(slug);
    if (!article.isPublished) {
      return { title: "Article", robots: { index: false, follow: false } };
    }
    if (isShortRubrique(article.category)) {
      return { title: "Short", robots: { index: false, follow: false } };
    }

    const title = article.title;
    const description =
      plainDescription(article.excerpt) ??
      plainDescription(article.content) ??
      `Article ${BRAND.name}`;
    const image = absoluteMediaUrl(article.coverUrl);
    const url = `${getSiteUrl()}/article/${encodeURIComponent(article.slug)}`;
    const authors = article.author?.name ? [article.author.name] : undefined;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        locale: "fr_FR",
        siteName: BRAND.name,
        title,
        description,
        url,
        publishedTime: article.publishedAt ?? undefined,
        modifiedTime: article.updatedAt ?? undefined,
        authors,
        section: article.category ?? undefined,
        images: image
          ? [
              {
                url: image,
                alt: article.coverCaption?.trim() || title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return { title: "Article" };
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  let article;
  try {
    article = await articlesPublicApi.bySlug(slug);
  } catch {
    notFound();
  }

  if (!article.isPublished) notFound();
  if (isShortRubrique(article.category)) notFound();

  let related: PublicArticleCard[] = [];
  try {
    const res = await articlesPublicApi.related(slug, 4);
    related = res.items;
  } catch {
    related = [];
  }

  const cover = article.coverUrl;
  const video = isVideoArticle(article);
  const hlsUrl = article.videoHlsUrl?.trim() || null;
  const poster = article.videoPosterUrl || cover;
  if (hlsUrl && /\.m3u8(?:$|\?|#)/i.test(hlsUrl)) {
    try {
      const origin = new URL(hlsUrl).origin;
      preconnect(origin, { crossOrigin: "anonymous" });
      preload(hlsUrl, { as: "fetch", crossOrigin: "anonymous" });
    } catch {
      /* URL CDN invalide */
    }
  }
  if (poster) {
    preload(poster, { as: "image" });
  }
  const category = categoryPresentation(article.category);
  const categoryLabel = category.label;
  const dateLabel = article.publishedAt
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(article.publishedAt))
    : null;
  const shareUrl = `${getSiteUrl()}/article/${encodeURIComponent(article.slug)}`;
  const shareBar = <ArticleShare url={shareUrl} title={article.title} />;

  const minutes = article.readingMinutes ?? 1;
  const viewsLabel = `${(article.viewCount ?? 0).toLocaleString("fr-FR")} vues`;
  const youtube = article.youtubeUrl?.trim() || null;
  const overlay = Boolean(cover) && !hlsUrl && !youtube && !video;

  const badge = categoryLabel ? (
    <Link
      href={category.href}
      className="opt-article__badge"
      style={{ background: category.color }}
    >
      {categoryLabel}
    </Link>
  ) : null;
  const aside = (
    <span className="opt-article__meta-aside">
      {dateLabel ? <span>{dateLabel}</span> : null}
      <span>{minutes} min de lecture</span>
      <span>{viewsLabel}</span>
    </span>
  );
  const crumbs = (
    <nav className="opt-article__crumbs" aria-label="Fil d’Ariane">
      <Link href="/">Accueil</Link>
      {categoryLabel ? (
        <>
          <span aria-hidden>/</span>
          <Link href={category.href}>{categoryLabel}</Link>
        </>
      ) : null}
    </nav>
  );
  const details = (
    <>
      {overlay ? null : crumbs}
      {article.excerpt ? (
        <p className="opt-article__excerpt">{article.excerpt}</p>
      ) : null}
      <div className="opt-article__meta">
        {article.author?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.author.avatarUrl}
            alt=""
            className="opt-article__meta-avatar"
          />
        ) : null}
        {article.author?.name ? (
          <span className="opt-article__meta-author">
            Par {article.author.name}
          </span>
        ) : null}
        {overlay ? null : aside}
        {shareBar}
      </div>
    </>
  );
  const copy = (
    <div className="opt-article__head">
      {badge}
      <h1 className="opt-article__title">{article.title}</h1>
      {overlay ? null : details}
    </div>
  );

  const media = hlsUrl ? (
    <figure className="opt-article__cover">
      <div className="opt-article__cover-media">
        <HlsPlayer
          src={hlsUrl}
          poster={poster}
          title={article.title}
          accent={category.tone === "gold" ? "gold" : "red"}
          durationSec={article.videoDurationSec}
        />
      </div>
      {article.coverCaption?.trim() ? (
        <figcaption className="opt-article__caption">
          {article.coverCaption.trim()}
        </figcaption>
      ) : null}
    </figure>
  ) : youtube ? (
    <figure className="opt-article__cover">
      <div className="opt-article__player">
        <iframe
          src={youtube}
          title={article.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </figure>
  ) : cover ? (
    <figure className="opt-article__cover">
      <div className="opt-article__cover-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={article.coverCaption?.trim() || ""} />
        {video ? <VideoPlay size={28} /> : null}
      </div>
      {video &&
      (article.videoStatus === "PENDING" ||
        article.videoStatus === "PROCESSING") ? (
        <figcaption className="opt-article__caption">
          Vidéo en préparation — le lecteur s’affichera dès que le
          transcodage HLS est terminé.
        </figcaption>
      ) : video && article.videoStatus === "FAILED" ? (
        <figcaption className="opt-article__caption">
          Le transcodage de la vidéo a échoué. Réessayez depuis l’admin.
        </figcaption>
      ) : article.coverCaption?.trim() ? (
        <figcaption className="opt-article__caption">
          {article.coverCaption.trim()}
        </figcaption>
      ) : null}
    </figure>
  ) : null;

  return (
    <>
      <AdSlot format="paysage_small" emplacement="pub-body-1" rotateMs={10000} />
      <article className={`opt-article${video ? " opt-article--video" : ""}`}>
        {overlay && cover ? (
          <header className="opt-article__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={article.coverCaption?.trim() || ""} />
            <div className="opt-article__hero-shade" />
            {crumbs}
            <div className="opt-article__hero-copy">
              <div className="opt-article__hero-kicker">
                {badge}
                {aside}
              </div>
              <h1 className="opt-article__title">{article.title}</h1>
              {article.coverCaption?.trim() ? (
                <p className="opt-article__hero-caption">
                  {article.coverCaption.trim()}
                </p>
              ) : null}
            </div>
          </header>
        ) : null}
        <div className="opt-article__inner">
          {overlay ? (
            <div className="opt-article__lead">{details}</div>
          ) : (
            <>
              {video || youtube || hlsUrl ? media : null}
              {copy}
              {!video && !youtube && !hlsUrl ? media : null}
            </>
          )}
          <ArticleBody
            slug={article.slug}
            locked={Boolean(article.locked)}
            priceCents={article.priceCents ?? null}
            blocks={article.blocks}
          />
          <AdSlot format="paysage_medium" emplacement="pub-body-2" rotateMs={10000} />
          {article.tags && article.tags.length > 0 ? (
            <ul className="opt-article__tags">
              {article.tags.map((tag) => (
                <li key={tag}>
                  <Link href={`/recherche?q=${encodeURIComponent(tag)}`}>{tag}</Link>
                </li>
              ))}
            </ul>
          ) : null}

          {article.sponsor?.name || article.sponsor?.logoUrl ? (
            <div className="opt-article__footer">
              <p className="opt-article__sponsor">
                <span className="opt-article__sponsor-label">
                  Sponsorisé Par
                </span>
                {article.sponsor.url &&
                /^https?:\/\//i.test(article.sponsor.url) ? (
                  <a
                    className="opt-article__sponsor-link"
                    href={article.sponsor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {article.sponsor.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={article.sponsor.logoUrl}
                        alt={article.sponsor.name}
                      />
                    ) : (
                      <span>{article.sponsor.name}</span>
                    )}
                  </a>
                ) : article.sponsor.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.sponsor.logoUrl}
                    alt={article.sponsor.name}
                  />
                ) : (
                  <span>{article.sponsor.name}</span>
                )}
              </p>
              {shareBar}
            </div>
          ) : (
            shareBar
          )}

          {article.previous || article.next ? (
            <nav className="opt-article__nav" aria-label="Articles précédent et suivant">
              {article.previous ? (
                <Link
                  href={`/article/${encodeURIComponent(article.previous.slug)}`}
                  className="opt-article__nav-card"
                >
                  {article.previous.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.previous.coverUrl} alt="" />
                  ) : null}
                  <span>
                    <small>Article précédent</small>
                    {article.previous.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {article.next ? (
                <Link
                  href={`/article/${encodeURIComponent(article.next.slug)}`}
                  className="opt-article__nav-card opt-article__nav-card--next"
                >
                  {article.next.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.next.coverUrl} alt="" />
                  ) : null}
                  <span>
                    <small>Article suivant</small>
                    {article.next.title}
                  </span>
                </Link>
              ) : null}
            </nav>
          ) : null}

        </div>
        {related.length > 0 ? (
          <section
            className="opt-article__more"
            aria-labelledby="opt-article-more"
          >
            <div className="opt-article__more-inner">
              <h2 id="opt-article-more" className="opt-article__more-title">
                Articles similaires
              </h2>
              <SimilarArticles
                items={related.slice(0, 4).map((item) => {
                  const rubrique = categoryPresentation(item.category);
                  return {
                    id: item.id,
                    href: `/article/${encodeURIComponent(item.slug)}`,
                    title: item.title,
                    excerpt: item.excerpt,
                    coverUrl: item.coverUrl,
                    categoryLabel: rubrique.label,
                    categoryColor: rubrique.color,
                    authorName: item.authorName,
                    dateLabel: item.dateLabel,
                    publishedAt: item.publishedAt,
                    video: isVideoArticle(item),
                    sponsor: item.sponsor
                      ? {
                          name: item.sponsor.name,
                          logoUrl: item.sponsor.logoUrl ?? null,
                        }
                      : null,
                  };
                })}
              />
            </div>
          </section>
        ) : null}
      </article>

      {article.magazine ? (
        <ArticleMagazineFloat magazine={article.magazine} />
      ) : null}
      <AdSlot format="portrait" emplacement="pub-float" variant="float" />
    </>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  actualites: "#ed2228",
  interview: "#0457d3",
  economie: "#ce5105",
  politique: "#e6a406",
  international: "#09b960",
  portrait: "#6709dc",
  entreprise: "#626a6b",
  events: "#2b3a6c",
};

function categoryPresentation(raw: string | null) {
  const slug = raw ? (legacyCategorySlug(raw) ?? raw.trim().toLowerCase()) : "";
  const rubrique = slug ? RUBRIQUE_BY_SLUG[slug] : undefined;
  return {
    label: rubrique?.label || raw || "",
    href: rubrique?.href ?? (slug ? `/rubrique/${encodeURIComponent(slug)}` : "/actualites"),
    color: CATEGORY_COLORS[rubrique?.slug ?? slug] ?? "#ce5105",
    tone: rubrique?.tone ?? "red",
  };
}

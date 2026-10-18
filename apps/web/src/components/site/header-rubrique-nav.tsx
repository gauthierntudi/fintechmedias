"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { articlesPublicApi, type PublicArticleCard } from "@/lib/api";
import { articleHref } from "@/lib/home-articles";
import {
  DEMO_DOSSIERS,
  DEMO_INSPIRATIONNEL_FEATURED,
  DEMO_INSPIRATIONNEL_GRID,
  DEMO_STARTUP_FEATURED,
  DEMO_STARTUP_GRID,
  DEMO_ZOOM_FEATURED,
  DEMO_ZOOM_GRID,
} from "@/lib/legacy-demo";
import { FLAGSHIP_RUBRIQUE_SLUGS, RUBRIQUES } from "@/lib/rubriques";
import { ThemeToggle } from "./theme-toggle";

const FLAGSHIP = new Set<string>(FLAGSHIP_RUBRIQUE_SLUGS);

const FEATURED = {
  href: "/kiosque",
  label: "Magazine",
};

function navIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MegaItem = {
  id: string;
  href: string;
  title: string;
  cover: string | null;
  category: string;
  dateLabel: string;
};

function previewOf(
  feed: Awaited<ReturnType<typeof articlesPublicApi.home>>,
  slug: string,
): PublicArticleCard[] {
  const list =
    slug === "actualites"
      ? (feed.actualites ?? feed.ecosystemePme)
      : slug === "interview"
        ? (feed.interview ?? feed.rencontreAvec)
        : slug === "economie"
          ? (feed.economie ?? feed.innovation)
          : slug === "politique"
            ? feed.politique
            : [];
  return (list ?? []).slice(0, 4);
}

function fromApi(items: PublicArticleCard[], label: string): MegaItem[] {
  return items.slice(0, 4).map((article) => ({
    id: article.id,
    href: articleHref(article),
    title: article.title,
    cover: article.coverUrl,
    category: article.categoryLabel || label,
    dateLabel: article.dateLabel,
  }));
}

/** Aperçu local tant que Postgres n’a pas les articles Fintech. */
function rubriqueOf(slug: string) {
  return RUBRIQUES.find((item) => item.slug === slug);
}

function demoItems(slug: string, label: string, href: string): MegaItem[] {
  const dates = ["10 oct. 2026", "9 oct. 2026", "7 oct. 2026", "6 oct. 2026"];
  const stories =
    slug === "interview"
      ? [DEMO_INSPIRATIONNEL_FEATURED, ...DEMO_INSPIRATIONNEL_GRID]
      : slug === "politique"
        ? [DEMO_STARTUP_FEATURED, ...DEMO_STARTUP_GRID]
        : slug === "economie"
          ? [DEMO_ZOOM_FEATURED, ...DEMO_ZOOM_GRID]
          : DEMO_DOSSIERS.map((item, index) => ({
              ...item,
              dateLabel: dates[index] ?? "",
            }));

  return stories.slice(0, 4).map((item) => ({
    id: String(item.id),
    href,
    title: item.titre,
    cover: item.cover,
    category: label,
    dateLabel: "dateLabel" in item ? item.dateLabel : "",
  }));
}

/** Navigation des rubriques, avec aperçu des 4 derniers articles sur les rubriques phares. */
export function HeaderRubriqueNav({ hidden = false }: { hidden?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, MegaItem[]>>(() => {
    const next: Record<string, MegaItem[]> = {};
    for (const slug of FLAGSHIP_RUBRIQUE_SLUGS) {
      const rubrique = rubriqueOf(slug);
      next[slug] = demoItems(slug, rubrique?.label ?? slug, rubrique?.href ?? `/rubrique/${slug}`);
    }
    return next;
  });
  const closeTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    articlesPublicApi
      .home()
      .then((feed) => {
        if (cancelled) return;
        const next: Record<string, MegaItem[]> = {};
        for (const slug of FLAGSHIP_RUBRIQUE_SLUGS) {
          const rubrique = rubriqueOf(slug);
          const label = rubrique?.label ?? slug;
          const href = rubrique?.href ?? `/rubrique/${slug}`;
          const live = fromApi(previewOf(feed, slug), label);
          next[slug] = live.length > 0 ? live : demoItems(slug, label, href);
        }
        setPreviews(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function closeNow() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(null);
  }

  function show(slug: string) {
    if (!FLAGSHIP.has(slug)) {
      closeNow();
      return;
    }
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(slug);
  }

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 140);
  }

  const panelItems = open ? (previews[open] ?? []) : [];
  const openRubrique = RUBRIQUES.find((item) => item.slug === open);

  return (
    <nav
      ref={rootRef}
      className="opt-header__nav"
      aria-label="Rubriques"
      aria-hidden={hidden}
      onMouseLeave={scheduleClose}
    >
      <ul className="opt-header__nav-list">
        {RUBRIQUES.map((item) => {
          const active = navIsActive(pathname, item.href);
          const flagship = FLAGSHIP.has(item.slug);
          return (
            <li
              key={item.href}
              onMouseEnter={() => show(item.slug)}
              onFocus={() => show(item.slug)}
            >
              <Link
                href={item.href}
                className={active || open === item.slug ? "is-active" : undefined}
                aria-current={active ? "page" : undefined}
                aria-expanded={flagship ? open === item.slug : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="opt-header__nav-sep" aria-hidden onMouseEnter={closeNow} />
        <li onMouseEnter={closeNow}>
          <Link
            href={FEATURED.href}
            className={navIsActive(pathname, FEATURED.href) ? "is-active" : undefined}
            aria-current={navIsActive(pathname, FEATURED.href) ? "page" : undefined}
          >
            {FEATURED.label}
          </Link>
        </li>
        <li className="opt-header__nav-switch" onMouseEnter={closeNow}>
          <ThemeToggle />
        </li>
      </ul>

      {openRubrique && panelItems.length > 0 ? (
        <div
          className="opt-mega"
          role="region"
          aria-label={openRubrique.label}
          onMouseEnter={() => show(openRubrique.slug)}
        >
          <ul className="opt-mega__grid">
            {panelItems.map((article) => (
              <li key={article.id}>
                <Link href={article.href} className="opt-mega__card">
                  <span className="opt-mega__thumb">
                    {article.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={article.cover} alt="" />
                    ) : null}
                  </span>
                  <span className="opt-mega__text">
                    <span className="opt-mega__kicker">{article.category}</span>
                    <span className="opt-mega__title">{article.title}</span>
                    {article.dateLabel ? (
                      <span className="opt-mega__date">{article.dateLabel}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

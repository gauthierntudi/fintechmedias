"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEMO_FEATURED, type TopStory } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import { ArticleThumbSponsor } from "@/components/site/article-thumb-sponsor";
import "./top-stories.css";

const AUTO_MS = 7000;

function readingMinutes(story: TopStory) {
  const words = `${story.titre} ${story.excerpt ?? ""}`
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.min(12, Math.max(3, Math.round(words / 40) + 3));
}

function uniqueStories(featured: TopStory[]) {
  const seen = new Set<string>();
  const out: TopStory[] = [];
  for (const story of featured) {
    const id = String(story.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(story);
  }
  return out;
}

function FeaturedSlide({ story }: { story: TopStory }) {
  const href = articleHref(story);

  return (
    <article className="opt-top__slide">
      <div className="opt-top__media">
        <CoverImage src={story.cover} className="opt-top__cover" />
        <div className="opt-top__shade" aria-hidden />
        <ArticleThumbSponsor sponsor={story.sponsor} />
      </div>

      <div className="opt-top__copy">
        <div className="opt-top__copy-inner">
          {story.category ? (
            <p className="opt-top__eyebrow">{story.category}</p>
          ) : null}
          <h2 className="opt-top__title">
            <Link href={href} title={story.titre}>
              {story.titre}
            </Link>
          </h2>
          {story.excerpt ? (
            <p className="opt-top__excerpt">{story.excerpt}</p>
          ) : null}
          <Link href={href} className="opt-top__read">
            Lire l&apos;article
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function FeaturedSlider({ stories }: { stories: TopStory[] }) {
  const n = stories.length;
  const multi = n > 1;
  const trackStories = multi
    ? [stories[n - 1], ...stories, stories[0]]
    : stories;

  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slideW, setSlideW] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const skipClickRef = useRef(false);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    axis: null as null | "x" | "y",
  });
  const [dragX, setDragX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const realIndex = multi ? (pos - 1 + n) % n : 0;
  const current = stories[realIndex] ?? stories[0];

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => setSlideW(el.clientWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!multi || busy) return;
      setBusy(true);
      setAnimate(true);
      setPos((p) => p + dir);
    },
    [multi, busy],
  );

  const jumpTo = useCallback((target: number) => {
    setAnimate(false);
    setPos(target);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true);
        setBusy(false);
      });
    });
  }, []);

  const onTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.target !== trackRef.current) return;
      if (e.propertyName !== "transform") return;
      if (!multi) return;

      if (pos === n + 1) {
        jumpTo(1);
      } else if (pos === 0) {
        jumpTo(n);
      } else {
        setBusy(false);
      }
    },
    [jumpTo, multi, n, pos],
  );

  useEffect(() => {
    if (!multi || paused || busy) return;
    const id = window.setInterval(() => go(1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [multi, paused, busy, go, pos]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !multi) return;
    const blockScroll = (e: Event) => {
      if (dragRef.current.axis === "x") e.preventDefault();
    };
    el.addEventListener("touchmove", blockScroll, { passive: false });
    el.addEventListener("pointermove", blockScroll, { passive: false });
    return () => {
      el.removeEventListener("touchmove", blockScroll);
      el.removeEventListener("pointermove", blockScroll);
    };
  }, [multi]);

  const endDrag = useCallback(
    (clientX: number) => {
      const d = dragRef.current;
      const dx = clientX - d.startX;
      const wasSwipe = d.axis === "x";
      d.pointerId = -1;
      d.axis = null;
      setSwiping(false);
      setPaused(false);
      if (!wasSwipe) {
        setDragX(0);
        return;
      }
      const threshold = Math.max(48, slideW * 0.16);
      if (dx <= -threshold) {
        skipClickRef.current = true;
        setAnimate(true);
        setDragX(0);
        go(1);
      } else if (dx >= threshold) {
        skipClickRef.current = true;
        setAnimate(true);
        setDragX(0);
        go(-1);
      } else {
        setAnimate(true);
        setDragX(0);
      }
    },
    [go, slideW],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!multi || busy) return;
      if (e.pointerType === "mouse") return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        axis: null,
      };
      setPaused(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [busy, multi],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.axis === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        setAnimate(false);
        setSwiping(true);
      }
    }
    if (d.axis !== "x") return;
    e.preventDefault();
    setDragX(dx);
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current.pointerId !== e.pointerId) return;
      endDrag(e.clientX);
    },
    [endDrag],
  );

  const offsetPx = slideW > 0 ? -(pos * slideW) + dragX : 0;
  const minutes = current ? readingMinutes(current) : 4;

  return (
    <div
      className={`opt-top__slider${paused ? " is-paused" : ""}${swiping ? " is-swiping" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onClickCapture={(e) => {
        if (!skipClickRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        skipClickRef.current = false;
      }}
    >
      <div
        className="opt-top__slider-viewport"
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={trackRef}
          className={`opt-top__slider-track${animate ? "" : " is-instant"}`}
          style={{
            transform:
              slideW > 0
                ? `translate3d(${offsetPx}px, 0, 0)`
                : `translate3d(-${pos * 100}%, 0, 0)`,
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {trackStories.map((story, i) => (
            <div
              className="opt-top__slider-slide"
              key={`${story.id}-${i}`}
              aria-hidden={i !== pos}
              style={
                slideW > 0
                  ? {
                      width: slideW,
                      minWidth: slideW,
                      maxWidth: slideW,
                      flexBasis: slideW,
                    }
                  : undefined
              }
            >
              <FeaturedSlide story={story} />
            </div>
          ))}
        </div>
      </div>

      <div className="opt-top__bar">
        {multi ? (
          <div className="opt-top__ticks" aria-hidden>
            {stories.map((story, i) => (
              <span
                key={story.id}
                className={`opt-top__tick${i === realIndex ? " is-active" : ""}`}
              >
                {i === realIndex ? (
                  <span
                    key={`${story.id}-${pos}`}
                    className="opt-top__tick-fill"
                    style={{ animationDuration: `${AUTO_MS}ms` }}
                  />
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <div className="opt-top__meta-row">
          <dl className="opt-top__facts">
            <div>
              <dt>Publié le</dt>
              <dd>{current?.dateLabel ?? "—"}</dd>
            </div>
            <div>
              <dt>Rubrique</dt>
              <dd>{current?.category ?? "—"}</dd>
            </div>
            <div>
              <dt>Temps de lecture</dt>
              <dd>{minutes} min</dd>
            </div>
          </dl>

          {multi ? (
            <div className="opt-top__arrows">
              <button
                type="button"
                className="opt-top__arrow"
                aria-label="Article précédent"
                disabled={busy}
                onClick={() => go(-1)}
              >
                <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                className="opt-top__arrow"
                aria-label="Article suivant"
                disabled={busy}
                onClick={() => go(1)}
              >
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Première section accueil — héros plein écran. */
export function TopStories({
  featured = DEMO_FEATURED,
}: {
  featured?: TopStory[];
} = {}) {
  const stories = useMemo(() => uniqueStories(featured), [featured]);

  if (!stories.length) return null;

  return (
    <section className="opt-top" aria-label="À la une">
      <FeaturedSlider stories={stories} />
    </section>
  );
}

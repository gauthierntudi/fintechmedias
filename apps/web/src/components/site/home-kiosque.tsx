"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, FreeMode } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { DEMO_DOSSIERS } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import { RUBRIQUE_BY_SLUG } from "@/lib/rubriques";

import "swiper/css";
import "swiper/css/free-mode";
import "./home-kiosque.css";

const FALLBACK_COVER = "/legacy/articles/1591545644.png";

export type HomeStoriesItem = {
  id: string | number;
  slug?: string;
  titre: string;
  cover: string;
  dateLabel: string;
  videoHlsUrl?: string | null;
  videoPosterUrl?: string | null;
};

const RUBRIQUE = RUBRIQUE_BY_SLUG["ecosysteme-pme"];

const DEMO_ITEMS: HomeStoriesItem[] = DEMO_DOSSIERS.map((s) => ({
  id: s.id,
  slug: s.slug,
  titre: s.titre,
  cover: s.cover,
  dateLabel: "",
}));

/** Carrousel Écosystème PME. */
export function HomeKiosque({
  items: incoming,
}: {
  items?: HomeStoriesItem[];
} = {}) {
  const items = incoming && incoming.length > 0 ? incoming : DEMO_ITEMS;
  const swiperRef = useRef<SwiperType | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(items.length > 1);

  const syncNav = (swiper: SwiperType) => {
    setCanPrev(!swiper.isBeginning);
    setCanNext(!swiper.isEnd);
  };

  return (
    <section className="opt-kiosque" aria-labelledby="opt-kiosque-title">
      <div className="opt-kiosque__inner">
        <header className="opt-kiosque__head">
          <div className="opt-kiosque__head-text">
            <h2 id="opt-kiosque-title" className="opt-kiosque__title">
              <Link href={RUBRIQUE.href} className="opt-kiosque__logo-link">
                {RUBRIQUE.label}
              </Link>
            </h2>
            <p className="opt-kiosque__lead">{RUBRIQUE.blurb}</p>
          </div>
          <div className="opt-kiosque__head-actions">
            <div
              className="opt-kiosque__nav"
              role="group"
              aria-label={`Parcourir ${RUBRIQUE.label}`}
            >
              <button
                type="button"
                className="opt-kiosque__nav-btn"
                aria-label="Précédent"
                disabled={!canPrev}
                onClick={() => swiperRef.current?.slidePrev()}
              >
                <ChevronLeft size={20} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="opt-kiosque__nav-btn"
                aria-label="Suivant"
                disabled={!canNext}
                onClick={() => swiperRef.current?.slideNext()}
              >
                <ChevronRight size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <Link href={RUBRIQUE.href} className="opt-kiosque__all">
              Tous les articles
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </header>

        <div className="opt-kiosque__slider">
          <Swiper
            className="opt-kiosque__swiper"
            modules={[FreeMode, A11y]}
            slidesPerView={2.4}
            spaceBetween={12}
            grabCursor
            freeMode={{
              enabled: true,
              sticky: true,
              momentumRatio: 0.65,
              momentumVelocityRatio: 0.75,
            }}
            speed={480}
            watchOverflow
            breakpoints={{
              576: {
                slidesPerView: 3.5,
                spaceBetween: 14,
              },
              992: {
                slidesPerView: 5.4,
                spaceBetween: 16,
              },
            }}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
              syncNav(swiper);
            }}
            onSlideChange={syncNav}
            onReachBeginning={syncNav}
            onReachEnd={syncNav}
            onFromEdge={syncNav}
            onResize={syncNav}
          >
            {items.map((story) => (
              <SwiperSlide key={story.id} className="opt-kiosque__item">
                <Link
                  href={articleHref(story)}
                  className="opt-kiosque__card"
                  draggable={false}
                >
                  <div className="opt-kiosque__cover-wrap">
                    <CoverImage
                      src={story.cover || FALLBACK_COVER}
                      className="opt-kiosque__cover"
                    />
                  </div>
                  <div className="opt-kiosque__meta">
                    <div className="opt-kiosque__meta-top">
                      <h3 className="opt-kiosque__name">{story.titre}</h3>
                      <span className="opt-kiosque__date">{story.dateLabel}</span>
                    </div>
                  </div>
                </Link>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
}

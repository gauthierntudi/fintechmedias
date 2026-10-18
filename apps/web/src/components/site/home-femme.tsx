"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay, Pagination } from "swiper/modules";
import { DEMO_GAME_FEATURED, type RubriqueSplitStory } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import { ArticleThumbSponsor } from "@/components/site/article-thumb-sponsor";
import { RUBRIQUE_BY_SLUG } from "@/lib/rubriques";
import { HomeFemmeCta } from "./home-femme-cta";

import "swiper/css";
import "swiper/css/pagination";
import "./home-femme.css";

const RUBRIQUE = RUBRIQUE_BY_SLUG.portrait;

export function HomeFemme({
  stories = [DEMO_GAME_FEATURED],
}: {
  stories?: RubriqueSplitStory[];
} = {}) {
  const slides = (stories.length > 0 ? stories : [DEMO_GAME_FEATURED]).slice(0, 5);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <section className="opt-femme" aria-label={RUBRIQUE.label}>
      <div className="opt-femme__hero">
        <Swiper
          className="opt-femme__swiper"
          modules={[Autoplay, Pagination, A11y]}
          slidesPerView={1}
          speed={650}
          loop={slides.length > 1}
          grabCursor
          autoplay={
            reduceMotion || slides.length < 2
              ? false
              : {
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }
          }
          pagination={
            slides.length > 1
              ? {
                  clickable: true,
                  bulletClass: "opt-femme__bullet",
                  bulletActiveClass: "is-active",
                }
              : false
          }
        >
          {slides.map((story) => (
            <SwiperSlide key={story.id} className="opt-femme__slide">
              <div className="opt-femme__media" aria-hidden>
                <CoverImage src={story.cover} />
                <div className="opt-femme__shade" />
                <ArticleThumbSponsor sponsor={story.sponsor} />
              </div>
              <div className="opt-femme__copy">
                <p className="opt-femme__cat">{RUBRIQUE.label}</p>
                <h2 className="opt-femme__title">
                  <Link href={articleHref(story)} title={story.titre}>
                    {story.titre}
                  </Link>
                </h2>
                {story.excerpt ? (
                  <p className="opt-femme__excerpt">{story.excerpt}</p>
                ) : (
                  <p className="opt-femme__excerpt">{RUBRIQUE.blurb}</p>
                )}
                <Link href={RUBRIQUE.href} className="opt-femme__explore">
                  Explorer la rubrique
                  <ArrowRight size={16} strokeWidth={2} aria-hidden />
                </Link>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <HomeFemmeCta />
    </section>
  );
}

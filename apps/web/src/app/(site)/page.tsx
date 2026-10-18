import { Suspense } from "react";
import { TopStories } from "@/components/site/top-stories";
import { HomeForYou } from "@/components/site/home-for-you";
import { HomeGridPosts } from "@/components/site/home-grid-posts";
import { HomeKiosque } from "@/components/site/home-kiosque";
import { HomeRencontre } from "@/components/site/home-rencontre";
import {
  HomeRubrique,
  HomeRubriqueSuite,
} from "@/components/site/home-rubrique";
import { HomeNewsletter } from "@/components/site/home-newsletter";
import { HomeFemme } from "@/components/site/home-femme";
import { HomeSkeleton } from "@/components/site/home-skeleton";
import { MagazinePromoFloat } from "@/components/site/magazine-promo-float";
import { HomeVideoAd } from "@/components/site/home-video-ad";
import { AdSlot } from "@/components/site/ad-slot";
import {
  articlesPublicApi,
  homeVideoPublicApi,
  magazinesPublicApi,
} from "@/lib/api";
import { buildHomeArticlesView, selectForYou } from "@/lib/home-articles";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

/** Accueil — articles + magazines dynamiques (API) avec repli démo */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [feedResult, latestResult, videoResult] = await Promise.allSettled([
    articlesPublicApi.home(),
    magazinesPublicApi.latest(),
    homeVideoPublicApi.active(),
  ]);

  const feed = feedResult.status === "fulfilled" ? feedResult.value : null;

  const latestMagazine =
    latestResult.status === "fulfilled" ? latestResult.value : null;

  const homeVideo =
    videoResult.status === "fulfilled" ? videoResult.value.video : null;

  const articles = buildHomeArticlesView(feed);
  const seed = Number((await headers()).get("x-fy-seed")) || 1;

  return (
    <>
      <AdSlot format="paysage_large" emplacement="pub-header" rotateMs={15000} />
      <TopStories featured={articles.featured} />
      <AdSlot format="paysage_small" emplacement="pub-body-1" rotateMs={20000} />
      <HomeForYou
        stories={selectForYou(feed, seed)}
        mustRead={[
          articles.aNePasManquerFeatured,
          ...articles.aNePasManquerList,
        ].slice(0, 2)}
      >
        <HomeGridPosts
          title="Actualités"
          href="/rubrique/actualites"
          color="#ed2228"
          stories={articles.ecosystemePmeStories}
          embedded
        />
        <AdSlot format="paysage_medium" emplacement="pub-body-2" rotateMs={10000} />
        <HomeRencontre
          featured={articles.rencontreFeatured}
          items={articles.rencontreGrid}
          embedded
        />
      </HomeForYou>
      <HomeVideoAd video={homeVideo} />
      <HomeKiosque
        rubriqueSlug="economie"
        items={articles.innovationStories.map((s) => ({
          id: s.id,
          slug: s.slug,
          titre: s.titre,
          cover: s.cover,
          dateLabel: s.dateLabel,
          sponsor: s.sponsor,
        }))}
      />
      <HomeRubrique
        primary={{
          title: "Politique",
          href: "/rubrique/politique",
          titleClass: "opt-rub__title--red",
          dotClass: "opt-rub__dot--red",
          featured: articles.entreprendreFeatured,
          grid: articles.entreprendreGrid,
        }}
        sidebar={{
          title: "Les plus vus",
          titleClass: "opt-rub__title--navy",
          dotClass: "opt-rub__dot--navy",
          featured: articles.plusVusFeatured,
          list: articles.plusVusList,
        }}
      />
      <HomeNewsletter />
      <HomeRubriqueSuite
        primary={{
          title: "Int’l",
          href: "/rubrique/international",
          titleClass: "opt-rub__title--teal",
          dotClass: "opt-rub__dot--teal",
          moreLabel: "Toute la rubrique",
          featured: articles.expertFeatured,
          grid: articles.expertGrid,
        }}
        sidebar={{
          title: "À ne pas manquer",
          titleClass: "opt-rub__title--navy",
          dotClass: "opt-rub__dot--navy",
          featured: articles.aNePasManquerFeatured,
          list: articles.aNePasManquerList,
        }}
      />
      <AdSlot format="paysage_small" emplacement="pub-body-3" rotateMs={25000} />
      <HomeFemme stories={articles.femmeSlides} />
      <HomeKiosque
        rubriqueSlug="events"
        items={articles.eventsStories.map((s) => ({
          id: s.id,
          slug: s.slug,
          titre: s.titre,
          cover: s.cover,
          dateLabel: s.dateLabel,
          sponsor: s.sponsor,
        }))}
      />
      {latestMagazine ? (
        <MagazinePromoFloat
          magazine={latestMagazine}
          eyebrow="Nouveau numéro"
          showDelayMs={2500}
        />
      ) : null}
    </>
  );
}

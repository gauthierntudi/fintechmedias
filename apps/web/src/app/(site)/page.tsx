import { Suspense } from "react";
import { TopStories } from "@/components/site/top-stories";
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
import { articlesPublicApi, magazinesPublicApi } from "@/lib/api";
import { buildHomeArticlesView } from "@/lib/home-articles";

/** Accueil — articles + magazines dynamiques (API) avec repli démo */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [feedResult, latestResult] = await Promise.allSettled([
    articlesPublicApi.home(),
    magazinesPublicApi.latest(),
  ]);

  const feed = feedResult.status === "fulfilled" ? feedResult.value : null;

  const latestMagazine =
    latestResult.status === "fulfilled" ? latestResult.value : null;

  const articles = buildHomeArticlesView(feed);

  return (
    <>
      <TopStories featured={articles.featured} grid={articles.topGrid} />
      <HomeKiosque
        items={articles.ecosystemePmeStories.map((s) => ({
          id: s.id,
          slug: s.slug,
          titre: s.titre,
          cover: s.cover,
          dateLabel: s.dateLabel,
        }))}
      />
      <HomeRencontre
        featured={articles.rencontreFeatured}
        items={articles.rencontreGrid}
      />
      <HomeRubrique
        primary={{
          title: "Entreprendre",
          href: "/rubrique/entreprendre",
          titleClass: "opt-rub__title--red",
          dotClass: "opt-rub__dot--red",
          featured: articles.entreprendreFeatured,
          grid: articles.entreprendreGrid,
        }}
        sidebar={{
          title: "Juste pour toi",
          titleClass: "opt-rub__title--navy",
          dotClass: "opt-rub__dot--navy",
          featured: articles.plusVusFeatured,
          list: articles.plusVusList,
        }}
      />
      <HomeNewsletter />
      <HomeRubriqueSuite
        primary={{
          title: "Qu'en dit l'expert",
          href: "/rubrique/qu-en-dit-l-expert",
          titleClass: "opt-rub__title--teal",
          dotClass: "opt-rub__dot--teal",
          moreLabel: "Toute la rubrique",
          video: true,
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
      <HomeFemme featured={articles.femmeFeatured} />
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

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEMO_GAME_FEATURED, type RubriqueSplitStory } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import { RUBRIQUE_BY_SLUG } from "@/lib/rubriques";
import { HomeFemmeCta } from "./home-femme-cta";
import "./home-femme.css";

const RUBRIQUE = RUBRIQUE_BY_SLUG.femme;

export function HomeFemme({
  featured = DEMO_GAME_FEATURED,
}: {
  featured?: RubriqueSplitStory;
} = {}) {
  return (
    <section className="opt-femme" aria-labelledby="opt-femme-title">
      <div className="opt-femme__hero">
        <div className="opt-femme__media" aria-hidden>
          <CoverImage src={featured.cover} />
          <div className="opt-femme__shade" />
        </div>
        <div className="opt-femme__copy">
          <p className="opt-femme__cat">{RUBRIQUE.label}</p>
          <h2 id="opt-femme-title" className="opt-femme__title">
            <Link href={articleHref(featured)} title={featured.titre}>
              {featured.titre}
            </Link>
          </h2>
          {featured.excerpt ? (
            <p className="opt-femme__excerpt">{featured.excerpt}</p>
          ) : (
            <p className="opt-femme__excerpt">{RUBRIQUE.blurb}</p>
          )}
          <Link href={RUBRIQUE.href} className="opt-femme__explore">
            Explorer la rubrique
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
      <HomeFemmeCta />
    </section>
  );
}

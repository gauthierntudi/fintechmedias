import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import "@/components/site/legal-doc.css";
import "./about.css";

export const metadata: Metadata = {
  title: "Qui sommes-nous",
  description:
    "Fintech Médias, plateforme d’actualités et d’analyses sur la fintech, les services financiers numériques et l’innovation.",
};

export default function QuiSommesNousPage() {
  return (
    <section className="opt-about">
      <header className="opt-about__hero" aria-labelledby="opt-about-title">
        <img
          className="opt-about__hero-img"
          src="/legacy/img/17099.jpg"
          alt=""
        />
        <div className="opt-about__hero-shade" aria-hidden />
        <div className="opt-about__hero-copy">
          <p className="opt-about__kicker">Qui sommes-nous</p>
          <h1 id="opt-about-title" className="opt-about__title">
            L’information qui va
            <br />
            plus loin
          </h1>
          <p className="opt-about__lead">
            Nous racontons la fintech, les paiements et la finance numérique —
            et ce qu’ils changent pour les gens.
          </p>
          <Link className="opt-about__cta" href="/rubrique/actualites">
            Lire les actualités
          </Link>
        </div>
      </header>

      <article className="opt-legal">
        <div className="opt-legal__container">
          <div className="opt-legal__body">
            <p>
              <strong>{BRAND.name}</strong> est une plateforme d’actualités et
              d’analyses dédiée à l’écosystème fintech, aux services financiers
              numériques et à l’innovation technologique.
            </p>
            <p>
              Nous informons, analysons et décryptons les évolutions du secteur
              financier à l’ère du digital : fintech, banques, mobile money,
              paiements électroniques, crypto-actifs, régulation et transformation
              numérique. Notre objectif est d’offrir une information fiable,
              accessible et à forte valeur ajoutée pour les professionnels,
              entrepreneurs, investisseurs et décideurs.
            </p>

            <h2>Notre vision</h2>
            <p>
              Devenir une référence de l’information fintech, en Afrique et à
              l’international, en mettant en lumière les innovations, les acteurs
              clés et les dynamiques qui transforment la finance.
            </p>

            <h2>Nos valeurs</h2>
            <ul className="opt-about__values">
              <li className="opt-about__value opt-about__value--ink">
                <strong>Crédibilité.</strong> Une information vérifiée, rigoureuse
                et indépendante.
              </li>
              <li className="opt-about__value opt-about__value--green">
                <strong>Innovation.</strong> Une attention constante aux nouvelles
                technologies et aux modèles financiers émergents.
              </li>
              <li className="opt-about__value opt-about__value--mist">
                <strong>Pédagogie.</strong> Rendre la fintech et la finance
                numérique compréhensibles.
              </li>
              <li className="opt-about__value opt-about__value--slate">
                <strong>Écosystème.</strong> Valoriser les acteurs, les initiatives
                et les collaborations qui font avancer le secteur.
              </li>
            </ul>

            <p>
              Le site publie aussi un kiosque de magazines numériques, en accès
              gratuit, à l’unité ou via abonnement.
            </p>
            <p>
              Pour une question, une collaboration éditoriale ou un partenariat,{" "}
              <Link href="/contact">écrivez-nous</Link>.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}

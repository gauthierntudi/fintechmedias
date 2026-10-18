import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { ContactFaq } from "./contact-faq";
import GlobeStudy from "@/components/originkit/ui/globe-study";
import "./contact.css";

export const metadata: Metadata = {
  title: "Nous contactez",
  description: `Écrire à ${BRAND.name} — ${BRAND.tagline}.`,
};

export default function ContactPage() {
  return (
    <section className="opt-contact" aria-labelledby="opt-contact-title">
      <header className="opt-contact__hero">
        <img
          className="opt-contact__hero-img"
          src="/legacy/img/46003.jpg"
          alt=""
        />
        <div className="opt-contact__hero-shade" aria-hidden />
        <div className="opt-contact__hero-copy">
          <p className="opt-contact__kicker">Écrivez-nous</p>
          <h1 id="opt-contact-title" className="opt-contact__title">
            Nous sommes là
            <br />
            pour vous aider
          </h1>
          <p className="opt-contact__lead">
            Rédaction, partenariats, abonnements ou kiosque : un message
            suffit. Nous le lisons, et nous vous répondons.
          </p>
        </div>
      </header>

      <section className="opt-contact__alert" aria-labelledby="opt-contact-alert">
        <div className="opt-contact__alert-art" aria-hidden>
          <GlobeStudy
            background="#000000"
            baseColor="#4ed319"
            phrase="fintech médias"
            density={72}
            glyphSize={140}
            globe={{ radius: 150 }}
            pointer={{ zoom: 0 }}
            style={{ minWidth: 0, minHeight: 0, width: "100%", height: "100%" }}
          />
        </div>
        <div className="opt-contact__alert-copy">
          <h2 id="opt-contact-alert">
            Vous avez repéré
            <br />
            quelque chose ?
          </h2>
          <p>
            Une arnaque, une pratique douteuse, un fait que la rédaction doit
            connaître : écrivez-nous. Nous vérifions chaque signalement.
          </p>
          <a className="opt-contact__alert-cta" href={`mailto:${BRAND.email}`}>
            Écrire à la rédaction
          </a>
        </div>
      </section>

      <ContactFaq />
    </section>
  );
}

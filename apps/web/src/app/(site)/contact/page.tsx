import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { ContactDetails } from "@/components/site/contact-details";
import { ContactForm } from "./contact-form";
import "./contact.css";

export const metadata: Metadata = {
  title: "Nous contactez",
  description: `Écrire à ${BRAND.name} — ${BRAND.tagline}.`,
};

export default function ContactPage() {
  return (
    <section className="opt-contact" aria-labelledby="opt-contact-title">
      <div className="opt-contact__inner">
        <header className="opt-contact__hero">
          <p className="opt-contact__kicker">{BRAND.name}</p>
          <h1 id="opt-contact-title" className="opt-contact__title">
            Nous contactez
          </h1>
          <p className="opt-contact__lead">
            Rédaction, partenariats, kiosque : écrivez-nous. {BRAND.tagline}.
          </p>
        </header>

        <div className="opt-contact__layout">
          <aside className="opt-contact__aside">
            <ContactDetails />
          </aside>

          <div className="opt-contact__main">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}

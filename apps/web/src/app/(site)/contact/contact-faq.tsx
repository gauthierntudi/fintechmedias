"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BRAND } from "@/lib/brand";

const ITEMS = [
  {
    q: "J’ai perdu l’accès à mon compte",
    a: (
      <>
        Connectez-vous avec l’adresse utilisée à l’inscription. Si le mot de
        passe ne passe plus,{" "}
        <Link href="/mot-de-passe-oublie">réinitialisez-le</Link>. Sinon,{" "}
        <Link href="/connexion">ouvrez la page de connexion</Link>.
      </>
    ),
  },
  {
    q: "J’ai oublié mon mot de passe",
    a: (
      <>
        Un code vous est envoyé par e-mail pour en choisir un nouveau.{" "}
        <Link href="/mot-de-passe-oublie">Réinitialiser le mot de passe</Link>.
      </>
    ),
  },
  {
    q: "Je ne retrouve plus l’adresse utilisée à l’inscription",
    a: (
      <>
        Écrivez-nous l’adresse actuelle, et si vous les avez le nom du compte
        ou un reçu. Nous cherchons le compte de notre côté.{" "}
        <a href={`mailto:${BRAND.email}`}>Écrire à la rédaction</a>.
      </>
    ),
  },
  {
    q: "Mon abonnement ou un achat n’apparaît pas",
    a: (
      <>
        Vérifiez que vous êtes connecté avec le compte qui a payé. L’abonnement
        est dans <Link href="/mon-abonnement">Mon abonnement</Link>, les
        magazines à l’unité dans <Link href="/mes-achats">Mes achats</Link>.
      </>
    ),
  },
] as const;

export function ContactFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="opt-contact__faq" aria-labelledby="opt-contact-faq">
      <h2 id="opt-contact-faq">Retrouver l’accès à votre compte</h2>
      <ul>
        {ITEMS.map((item, index) => {
          const expanded = open === index;
          return (
            <li key={item.q}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : index)}
              >
                <span>{item.q}</span>
                <span
                  className={`opt-contact__faq-plus${expanded ? " is-open" : ""}`}
                  aria-hidden
                >
                  <Plus size={16} strokeWidth={2.4} />
                </span>
              </button>
              {expanded ? (
                <div className="opt-contact__faq-answer">{item.a}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

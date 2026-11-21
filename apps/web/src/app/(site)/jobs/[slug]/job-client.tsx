"use client";

import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { jobsPublicApi } from "@/lib/api";

/** Compte une vue par affichage (une seule fois, même en Strict Mode). */
export function JobViewTracker({ slug }: { slug: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === slug) return;
    sent.current = slug;
    void jobsPublicApi.trackView(slug).catch(() => undefined);
  }, [slug]);
  return null;
}

/**
 * Bouton « Postuler » : ouvre le formulaire externe (ou l’e-mail) et compte
 * le clic sans bloquer l’ouverture si la statistique échoue.
 */
export function JobApplyButton({
  slug,
  href,
  label = "Postuler",
}: {
  slug: string;
  href: string;
  label?: string;
}) {
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="opt-job-cta"
      onClick={() => {
        void jobsPublicApi.applyClick(slug).catch(() => undefined);
      }}
    >
      <Send size={17} strokeWidth={2.2} aria-hidden />
      {label}
    </a>
  );
}

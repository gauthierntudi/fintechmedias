"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { adsPublicApi, type PublicAd } from "@/lib/api";
import "./ad-slot.css";

export type AdFormat =
  | "rectangle"
  | "portrait"
  | "large_portrait"
  | "large_rectangle"
  | "paysage_small"
  | "paysage_medium"
  | "paysage_large";

export type AdPlace =
  | "pub-header"
  | "pub-body-1"
  | "pub-body-2"
  | "pub-body-3"
  | "pub-body-sidebar-1"
  | "pub-body-sidebar-2"
  | "pub-sidebar-1"
  | "pub-footer"
  | "pub-float"
  | "pub-modal"
  | "modal-popup";

type Props = {
  format: AdFormat;
  emplacement: AdPlace;
  /** Rotation, comme `data-rotate` sur l’ancien site. */
  rotateMs?: number;
  variant?: "banner" | "float";
  /** Titre et bouton sous l’image, dans une grille d’articles. */
  card?: boolean;
  /** Préviens le parent dès qu’une campagne est disponible, ou non. */
  onAvailability?: (available: boolean) => void;
};

export function AdSlot({
  format,
  emplacement,
  rotateMs = 15000,
  variant = "banner",
  card = false,
  onAvailability,
}: Props) {
  const [ad, setAd] = useState<PublicAd | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const seen = useRef<number[]>([]);
  const current = useRef<number | null>(null);
  const onAvailabilityRef = useRef(onAvailability);
  onAvailabilityRef.current = onAvailability;

  useEffect(() => {
    let cancel = false;

    async function load() {
      try {
        const res = await adsPublicApi.pick(format, emplacement, seen.current);
        if (cancel) return;
        if (!res.ad) {
          if (current.current == null) onAvailabilityRef.current?.(false);
          return;
        }
        onAvailabilityRef.current?.(true);
        if (res.ad.id === current.current) return;
        current.current = res.ad.id;
        seen.current = [...seen.current, res.ad.id].slice(-12);
        setAd(res.ad);
      } catch {
        if (current.current == null) onAvailabilityRef.current?.(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), rotateMs);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [format, emplacement, rotateMs]);

  if (!ad || dismissed) return null;

  const media = (
    <a
      className="opt-ad__link"
      href={ad.href}
      target="_blank"
      rel="sponsored noopener noreferrer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ad.imageUrl} alt={ad.title} />
      <p className="opt-ad__label">Publicité</p>
    </a>
  );

  if (variant === "float") {
    return (
      <aside className={`opt-ad opt-ad--float opt-ad--${format}`} aria-label="Publicité">
        <button
          type="button"
          className="opt-ad__close"
          aria-label="Fermer la publicité"
          onClick={() => setDismissed(true)}
        >
          <X size={14} strokeWidth={2.4} />
        </button>
        {media}
      </aside>
    );
  }

  return (
    <aside
      className={`opt-ad opt-ad--${format}${
        emplacement === "pub-footer" ? " opt-ad--before-footer" : ""
      }`}
      aria-label="Publicité"
    >
      {media}
      {card ? (
        <div className="opt-ad__copy">
          <p className="opt-ad__title">{ad.title}</p>
          <div className="opt-ad__actions">
            <a
              className="opt-ad__cta"
              href={ad.href}
              target="_blank"
              rel="sponsored noopener noreferrer"
            >
              En savoir plus
            </a>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

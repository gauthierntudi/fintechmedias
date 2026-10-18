"use client";

import { BookOpen } from "lucide-react";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";

type Props = {
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  seed: string;
  isLatest?: boolean;
  canRead?: boolean;
};

const BADGE_PALETTE = [
  { background: "#4ed319", color: "#111111" },
  { background: "#111111", color: "#ffffff" },
  { background: "#3aaa12", color: "#111111" },
  { background: "#1a1a1a", color: "#ffffff" },
] as const;

function badgeColorsFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

function resolveSrc(coverUrl: string | null) {
  return coverUrl || "/legacy/covers/1591457791.jpg";
}

export function MagazineCover({
  title,
  issueNumber,
  coverUrl,
  seed,
  isLatest = false,
  canRead = true,
}: Props) {
  const src = resolveSrc(coverUrl);
  const badge = badgeColorsFromSeed(seed);

  return (
    <div className="opt-mags__cover">
      {issueNumber ? (
        <span
          className="opt-mags__numero"
          style={{ background: badge.background, color: badge.color }}
        >
          #{issueNumber}
        </span>
      ) : null}
      {isLatest ? <span className="opt-mags__tag">Nouveau</span> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        title={title}
        loading="lazy"
        width={300}
        height={400}
      />
      <span className="opt-mags__overlay" aria-hidden>
        <span className="opt-mags__overlay-cta">
          <BookOpen size={15} strokeWidth={2.25} aria-hidden />
          {canRead ? "Lire" : SUBSCRIPTIONS_ENABLED ? "S’abonner" : "Voir"}
        </span>
      </span>
    </div>
  );
}

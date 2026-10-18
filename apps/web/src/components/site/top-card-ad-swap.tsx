"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdSlot } from "@/components/site/ad-slot";

const SWAP_MS = 10000;

/**
 * Carte hero (À la une) : l’article et la pub « Article, à lire aussi »
 * occupent le même emplacement, chacun à son tour.
 */
export function TopCardAdSwap({
  area,
  children,
}: {
  area: "a" | "b" | "c" | "d";
  children: ReactNode;
}) {
  const [hasAd, setHasAd] = useState(false);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    if (!hasAd) return;
    const id = window.setInterval(() => {
      setShowAd((current) => !current);
    }, SWAP_MS);
    return () => window.clearInterval(id);
  }, [hasAd]);

  const adVisible = hasAd && showAd;

  return (
    <div className={`opt-top__slot opt-top__slot--${area} opt-top__slot-swap`}>
      <div hidden={adVisible}>{children}</div>
      <div hidden={!adVisible}>
        <AdSlot
          format="rectangle"
          emplacement="pub-sidebar-1"
          rotateMs={SWAP_MS}
          card
          onAvailability={setHasAd}
        />
      </div>
    </div>
  );
}

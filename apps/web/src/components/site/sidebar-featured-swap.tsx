"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdSlot } from "@/components/site/ad-slot";

const SWAP_MS = 10000;

/**
 * Sidebar 2 : l’article en une et la publicité occupent le même cadre,
 * chacun à son tour.
 */
export function SidebarFeaturedSwap({ children }: { children: ReactNode }) {
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
    <div className="opt-rub__side-swap">
      <div hidden={adVisible}>{children}</div>
      <div hidden={!adVisible}>
        <AdSlot
          format="rectangle"
          emplacement="pub-body-sidebar-2"
          rotateMs={SWAP_MS}
          onAvailability={setHasAd}
        />
      </div>
    </div>
  );
}

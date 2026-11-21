"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

/**
 * Met à jour l’URL sans recharger la page : `useSearchParams` suit le
 * changement, la liste se recharge côté client, le défilement ne bouge pas.
 */
export function softNavigate(href: string, scrollToId?: string) {
  const current = location.pathname + location.search;
  if (href !== current) {
    window.history.pushState({ __keepScroll: true }, "", href);
  }
  if (scrollToId) {
    document
      .getElementById(scrollToId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/** Lien de filtre : clic simple sans rechargement, Ctrl/⌘-clic natif. */
export function SoftLink({
  href,
  scrollToId,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  scrollToId?: string;
}) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        e.preventDefault();
        softNavigate(href, scrollToId);
      }}
    />
  );
}

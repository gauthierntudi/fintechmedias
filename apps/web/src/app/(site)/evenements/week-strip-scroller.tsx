"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Liste défilable de la barre-semaine : au rendu, recentre le jour marqué
 * `data-focus` (utile sur mobile où tous les jours ne tiennent pas).
 */
export function WeekStripScroller({
  focus,
  children,
}: {
  focus: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    // Centre la plage des jours d’événements (ou le jour choisi) si elle
    // tient dans la largeur visible, sinon le jour central seul.
    const span = [...list.querySelectorAll<HTMLElement>("[data-span]")];
    const focusEl = list.querySelector<HTMLElement>("[data-focus]");
    let els = span.length ? span : focusEl ? [focusEl] : [];
    const left = (e: HTMLElement[]) => Math.min(...e.map((x) => x.offsetLeft));
    const right = (e: HTMLElement[]) =>
      Math.max(...e.map((x) => x.offsetLeft + x.offsetWidth));
    if (
      els.length > 1 &&
      right(els) - left(els) > list.clientWidth &&
      focusEl
    ) {
      els = [focusEl];
    }
    if (!els.length) return;
    const l = left(els);
    list.scrollLeft = l - (list.clientWidth - (right(els) - l)) / 2;
  }, [focus]);

  return (
    <ol ref={ref} className="opt-ev-week__days">
      {children}
    </ol>
  );
}

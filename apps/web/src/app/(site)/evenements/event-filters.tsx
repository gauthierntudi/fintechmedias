"use client";

import { citySlug, eventsHref } from "./events-query";
import { softNavigate } from "./soft-link";

type Props = {
  cities: string[];
  city: string;
  format: string;
  when: "upcoming" | "past";
  /** Jour et semaine de la barre-semaine, conservés au changement de filtre. */
  date?: string;
  week?: string;
};

/** Filtres ville / format — URL partageable, mise à jour sans rechargement. */
export function EventFilters({
  cities,
  city,
  format,
  when,
  date,
  week,
}: Props) {
  function go(next: { city?: string; format?: string }) {
    softNavigate(
      eventsHref({
        when: when === "past" && !date ? "past" : undefined,
        city: next.city ?? city,
        format: next.format ?? format,
        week,
        date,
      }),
    );
  }

  return (
    <div className="opt-ev__filters">
      <label>
        <span className="sr-only">Ville</span>
        <select value={city} onChange={(e) => go({ city: e.target.value })}>
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c} value={citySlug(c)}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Format</span>
        <select value={format} onChange={(e) => go({ format: e.target.value })}>
          <option value="">Présentiel et en ligne</option>
          <option value="IN_PERSON">Présentiel</option>
          <option value="ONLINE">En ligne</option>
        </select>
      </label>
    </div>
  );
}

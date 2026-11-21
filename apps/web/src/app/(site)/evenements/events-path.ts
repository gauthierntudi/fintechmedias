/**
 * Filtres de /evenements ⇄ chemin lisible (partagé serveur / client / middleware).
 *
 *   /evenements/ville-kinshasa/en-ligne/semaine-2026-11-16
 *   /evenements/passes/jour-2027-03-18
 */
import type { EventFormatName } from "@/lib/api";
import { isYmd, mondayOf } from "@/lib/events";

export type EventsQuery = {
  when: "upcoming" | "past";
  /** Slug de ville (« kinshasa »). */
  city?: string;
  format?: EventFormatName;
  page: number;
  /** Jour choisi dans la barre-semaine (YYYY-MM-DD). */
  date?: string;
  /** Lundi de la semaine affichée, si choisie explicitement. */
  week?: string;
};

type ParamSource =
  URLSearchParams | Record<string, string | string[] | undefined>;

function read(src: ParamSource, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = src instanceof URLSearchParams ? src.get(key) : src[key];
    const s = Array.isArray(v) ? v[0] : v;
    if (s?.trim()) return s.trim();
  }
  return undefined;
}

/** « Lubumbashi », « Kinshasa – Gombe » → « lubumbashi », « kinshasa-gombe ». */
export function citySlug(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const FORMAT_SLUGS: Record<"IN_PERSON" | "ONLINE", string> = {
  IN_PERSON: "presentiel",
  ONLINE: "en-ligne",
};

function formatFromParam(v: string | undefined): EventFormatName | undefined {
  if (!v) return undefined;
  for (const [key, slug] of Object.entries(FORMAT_SLUGS)) {
    if (v === slug || v === key) return key as EventFormatName;
  }
  return undefined;
}

/**
 * Chemin de filtres → état ; null si un segment n’est pas un filtre
 * (→ fiche d’événement).
 */
export function parseEventsPath(segments: string[]): EventsQuery | null {
  const q: EventsQuery = { when: "upcoming", page: 1 };
  for (const raw of segments) {
    let seg: string;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (!seg) continue;
    let m: RegExpMatchArray | null;
    if (seg === "passes") q.when = "past";
    else if (seg === "en-ligne" || seg === "presentiel") {
      q.format = formatFromParam(seg);
    } else if ((m = seg.match(/^ville-([a-z0-9-]+)$/))) q.city = m[1];
    else if ((m = seg.match(/^jour-(\d{4}-\d{2}-\d{2})$/)) && isYmd(m[1])) {
      q.date = m[1];
    } else if (
      (m = seg.match(/^semaine-(\d{4}-\d{2}-\d{2})$/)) &&
      isYmd(m[1])
    ) {
      q.week = mondayOf(m[1]);
    } else if ((m = seg.match(/^page-(\d{1,4})$/))) q.page = Math.max(1, +m[1]);
    else return null;
  }
  return q;
}

/**
 * Lit l’état : `f` (chemin réécrit par le middleware), sinon les anciens
 * paramètres (?city=…, ?ville=…) encore acceptés.
 */
export function parseEventsQuery(src: ParamSource): EventsQuery {
  const f = read(src, "f");
  if (f) {
    const parsed = parseEventsPath(f.split("/"));
    if (parsed) return parsed;
  }
  const date = read(src, "jour", "date");
  const week = read(src, "semaine", "week");
  const statut = read(src, "statut", "when");
  const city = read(src, "ville", "city");
  return {
    when: statut === "passes" || statut === "past" ? "past" : "upcoming",
    city: city ? citySlug(city) || undefined : undefined,
    format: formatFromParam(read(src, "format")),
    page: Math.max(1, Number(read(src, "page")) || 1),
    date: isYmd(date) ? date : undefined,
    week: isYmd(week) ? mondayOf(week) : undefined,
  };
}

/** État → chemin (la semaine est implicite quand un jour est choisi). */
export function eventsHref(params: {
  when?: string;
  city?: string;
  format?: string;
  date?: string;
  week?: string;
  page?: number;
}): string {
  const parts: string[] = [];
  if (params.city) parts.push(`ville-${citySlug(params.city)}`);
  const format = formatFromParam(params.format);
  if (format && format in FORMAT_SLUGS) {
    parts.push(FORMAT_SLUGS[format as keyof typeof FORMAT_SLUGS]);
  }
  if (params.when === "past") parts.push("passes");
  if (params.date) parts.push(`jour-${params.date}`);
  else if (params.week) parts.push(`semaine-${params.week}`);
  if (params.page && params.page > 1) parts.push(`page-${params.page}`);
  return parts.length ? `/evenements/${parts.join("/")}` : "/evenements";
}

/** URL canonique d’un état (sert aussi de clé de cache). */
export function eventsQueryHref(q: EventsQuery): string {
  return eventsHref({
    when: q.when === "past" && !q.date ? "past" : undefined,
    city: q.city,
    format: q.format,
    date: q.date,
    week: q.week,
    page: q.page,
  });
}

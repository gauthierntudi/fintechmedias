import type {
  EventFormatName,
  EventPrice,
  EventTypeName,
} from "@/lib/api";

export const EVENT_TYPE_LABELS: Record<EventTypeName, string> = {
  CONFERENCE: "Conférence",
  SUMMIT: "Summit",
  MEETUP: "Rencontre",
  WEBINAR: "Webinaire",
  WORKSHOP: "Atelier",
  OTHER: "Événement",
};

export const EVENT_FORMAT_LABELS: Record<EventFormatName, string> = {
  IN_PERSON: "Présentiel",
  ONLINE: "En ligne",
  HYBRID: "Hybride",
};

export const EVENT_CURRENCIES = ["USD", "CDF", "EUR", "XAF", "XOF"] as const;

const TZ = "Africa/Kinshasa";

function sameDay(a: Date, b: Date): boolean {
  const f = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, dateStyle: "short" }).format(d);
  return f(a) === f(b);
}

/** « 12 déc. 2026 » ou « 12 – 14 déc. 2026 ». */
export function formatEventDateRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const day = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (!endsAt) return day.format(start);
  const end = new Date(endsAt);
  if (sameDay(start, end)) return day.format(start);
  const short = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  });
  return `${short.format(start)} – ${day.format(end)}`;
}

/** « 09:00 – 17:30 » (heure de Kinshasa) si l’événement tient sur un jour. */
export function formatEventTimeRange(startsAt: string, endsAt: string | null): string | null {
  const t = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  const start = new Date(startsAt);
  if (!endsAt) return t.format(start);
  const end = new Date(endsAt);
  if (!sameDay(start, end)) return null;
  return `${t.format(start)} – ${t.format(end)}`;
}

/**
 * Date mise en avant sur la fiche : grand chiffre + ligne mois/année.
 * « 18 – 19 » / « mars 2027 » ; « 30 mars – 2 avr. » / « 2027 » ; etc.
 */
export function eventDateDisplay(
  startsAt: string,
  endsAt: string | null,
): { big: string; small: string; weekday?: string } {
  const f = (d: Date, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...o }).format(d);
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const monthYear = (d: Date) => f(d, { month: "long", year: "numeric" });
  if (!end || sameDay(start, end)) {
    // Un seul jour : le jour de la semaine permet un affichage « calendrier ».
    return {
      big: f(start, { day: "numeric" }),
      small: monthYear(start),
      weekday: f(start, { weekday: "long" }),
    };
  }
  const sameMonth = monthYear(start) === monthYear(end);
  if (sameMonth) {
    return {
      big: `${f(start, { day: "numeric" })} – ${f(end, { day: "numeric" })}`,
      small: monthYear(start),
    };
  }
  const sameYear = f(start, { year: "numeric" }) === f(end, { year: "numeric" });
  return {
    big: `${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short" })}`,
    small: sameYear
      ? f(start, { year: "numeric" })
      : `${f(start, { year: "numeric" })} – ${f(end, { year: "numeric" })}`,
  };
}

/** Heures de début / fin (Kinshasa), même sur plusieurs jours. */
export function eventHours(startsAt: string, endsAt: string | null): string {
  const t = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  const start = t.format(new Date(startsAt));
  return endsAt ? `${start} – ${t.format(new Date(endsAt))}` : start;
}

/** Bloc calendrier : jour et mois courts. */
export function eventDateBadge(startsAt: string): { day: string; month: string } {
  const d = new Date(startsAt);
  return {
    day: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit" }).format(d),
    month: new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, month: "short" })
      .format(d)
      .replace(".", ""),
  };
}

export function formatPrice(p: EventPrice): string {
  if (p.amount === 0) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: Number.isInteger(p.amount) ? 0 : 2,
  }).format(p.amount);
}

export function eventIsPast(startsAt: string, endsAt: string | null): boolean {
  const ref = endsAt ? new Date(endsAt) : new Date(startsAt);
  if (!endsAt) ref.setUTCHours(23, 59, 59, 999);
  return ref.getTime() < Date.now();
}

export function eventPlaceLabel(e: {
  format: EventFormatName;
  city: string | null;
  country: string | null;
  venueName?: string | null;
}): string {
  if (e.format === "ONLINE") return "En ligne";
  const place = [e.city, e.country].filter(Boolean).join(", ");
  if (e.format === "HYBRID") return place ? `${place} + en ligne` : "Hybride";
  return place || e.venueName || "Lieu à confirmer";
}

// ─── Jours civils (YYYY-MM-DD, heure de Kinshasa) ─────────────────────────

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(v: string | undefined): v is string {
  if (!v) return false;
  const m = YMD_RE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === v;
}

/** Jour civil à Kinshasa d’un instant. */
export function ymdInTz(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);
}

function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(ymd: string, n: number): string {
  const d = ymdToUtc(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine contenant `ymd`. */
export function mondayOf(ymd: string): string {
  const dow = (ymdToUtc(ymd).getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(ymd, -dow);
}

/** Libellés d’un jour pour la barre-semaine : « lun. », « 18 », « mars 2027 ». */
export function ymdLabels(ymd: string): {
  weekday: string;
  day: string;
  month: string;
  long: string;
} {
  const d = ymdToUtc(ymd);
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...o }).format(d);
  return {
    weekday: f({ weekday: "short" }).replace(/\.$/, ""),
    day: f({ day: "numeric" }),
    month: f({ month: "long", year: "numeric" }),
    long: f({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  };
}

// ─── Couleur de la charte d’un événement ───────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Mélange vers `target` (0 = couleur, 1 = cible) jusqu’au contraste visé. */
function adjustForContrast(
  rgb: [number, number, number],
  target: [number, number, number],
  bgLum: number,
  min: number,
): string {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const mix = rgb.map((v, i) => Math.round(v + (target[i] - v) * t)) as [
      number,
      number,
      number,
    ];
    if (contrast(luminance(mix), bgLum) >= min || t >= 1) {
      return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return `#${target.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Variables CSS de la fiche pour la couleur de charte : accent, texte posé
 * sur l’accent, et variantes « encre » lisibles sur fond clair / sombre.
 */
export function eventThemeVars(hex: string | null | undefined): Record<string, string> | null {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return null;
  const lum = luminance(rgb);
  return {
    "--ev-accent": hex!.toLowerCase(),
    "--ev-accent-on": contrast(lum, 0) >= contrast(lum, 1) ? "#111111" : "#ffffff",
    // texte accent sur fond blanc (≥ 4.5:1) et sur fond sombre (#111, ≥ 4.5:1)
    "--ev-theme-ink-light": adjustForContrast(rgb, [0, 0, 0], 1, 4.5),
    "--ev-theme-ink-dark": adjustForContrast(rgb, [255, 255, 255], luminance([17, 17, 17]), 4.5),
  };
}

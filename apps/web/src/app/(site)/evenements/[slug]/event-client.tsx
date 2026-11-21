"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Ticket } from "lucide-react";
import { eventsPublicApi } from "@/lib/api";

/** Compte une vue par affichage (une seule fois, même en Strict Mode). */
export function EventViewTracker({ slug }: { slug: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === slug) return;
    sent.current = slug;
    void eventsPublicApi.trackView(slug).catch(() => undefined);
  }, [slug]);
  return null;
}

/**
 * Lien billetterie externe : ouvre le site de l’organisateur et compte le clic
 * (sans bloquer l’ouverture si la statistique échoue).
 */
export function EventTicketButton({
  slug,
  href,
  compact = false,
  label = "Billetterie",
}: {
  slug: string;
  href: string;
  compact?: boolean;
  label?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`opt-ev-cta${compact ? " opt-ev-cta--compact" : ""}`}
      onClick={() => {
        void eventsPublicApi.ticketClick(slug).catch(() => undefined);
      }}
    >
      <Ticket size={18} aria-hidden />
      {label}
    </a>
  );
}

/* ── Ajouter au calendrier ─────────────────────────────────────────── */

type CalendarEvent = {
  slug: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  url: string;
};

/** Sans heure de fin, on bloque 2 h dans l’agenda. */
function calendarEnd(e: CalendarEvent): Date {
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : null;
  return end && end > start ? end : new Date(start.getTime() + 2 * 3600_000);
}

/** 2027-03-18T08:00:00.000Z → 20270318T080000Z */
function compactUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function googleCalendarUrl(e: CalendarEvent): string {
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${compactUtc(new Date(e.startsAt))}/${compactUtc(calendarEnd(e))}`,
    details: [e.description, e.url].filter(Boolean).join("\n\n"),
    location: e.location,
    ctz: "Africa/Kinshasa",
  });
  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}

function outlookCalendarUrl(e: CalendarEvent): string {
  const qs = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.startsAt).toISOString(),
    enddt: calendarEnd(e).toISOString(),
    body: [e.description, e.url].filter(Boolean).join("\n\n"),
    location: e.location,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${qs.toString()}`;
}

function icsEscape(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsContent(e: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fintech Medias//Evenements//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.slug}@fintechmedias.com`,
    `DTSTAMP:${compactUtc(new Date())}`,
    `DTSTART:${compactUtc(new Date(e.startsAt))}`,
    `DTEND:${compactUtc(calendarEnd(e))}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.description ? `DESCRIPTION:${icsEscape(`${e.description}\n\n${e.url}`)}` : `DESCRIPTION:${icsEscape(e.url)}`,
    e.location ? `LOCATION:${icsEscape(e.location)}` : "",
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

function saveIcs(event: CalendarEvent) {
  const blob = new Blob([icsContent(event)], {
    type: "text/calendar;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${event.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Agendas affichés directement (sans menu) : Google, Outlook, fichier .ics. */
export function EventCalendarLinks({ event }: { event: CalendarEvent }) {
  return (
    <div className="opt-ev-callinks">
      <p className="opt-ev-callinks__label">
        <CalendarPlus size={15} aria-hidden /> Ajouter à mon agenda
      </p>
      <div className="opt-ev-callinks__row">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
          Google
        </a>
        <a href={outlookCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
          Outlook
        </a>
        <button type="button" onClick={() => saveIcs(event)} title="Fichier .ics (Apple Calendrier, Outlook bureau…)">
          Apple / .ics
        </button>
      </div>
    </div>
  );
}

/* ── Compte à rebours ──────────────────────────────────────────────── */

const KINSHASA_MS = 3600_000;

/** Numéro de jour calendaire à Kinshasa (UTC+1). */
function kinshasaDay(d: Date): number {
  return Math.floor((d.getTime() + KINSHASA_MS) / 86_400_000);
}

function countdownLabel(startsAt: string, endsAt: string | null, now: Date): string | null {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (now >= start) {
    if (end && now <= end) return "En cours";
    if (!end && kinshasaDay(now) === kinshasaDay(start)) return "Aujourd’hui";
    return null;
  }
  const days = kinshasaDay(start) - kinshasaDay(now);
  if (days <= 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  if (days < 60) return `Dans ${days} jours`;
  const months = Math.round(days / 30.4);
  return `Dans ${months} mois`;
}

/** Calculé côté navigateur (évite une valeur figée par le cache serveur). */
export function EventCountdown({
  startsAt,
  endsAt,
}: {
  startsAt: string;
  endsAt: string | null;
}) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setLabel(countdownLabel(startsAt, endsAt, new Date()));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [startsAt, endsAt]);
  if (!label) return null;
  return (
    <span className={`opt-ev-tag opt-ev-tag--countdown${label === "En cours" ? " is-live" : ""}`}>
      {label}
    </span>
  );
}

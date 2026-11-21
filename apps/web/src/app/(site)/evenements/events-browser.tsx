"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, X } from "lucide-react";
import { eventIsPast, ymdLabels } from "@/lib/events";
import { EventCard } from "./event-card";
import { EventFilters } from "./event-filters";
import {
  EVENTS_PAGE_SIZE,
  STRIP_RADIUS,
  eventsHref,
  eventsQueryHref,
  loadEvents,
  parseEventsPath,
  parseEventsQuery,
  type EventsResult,
} from "./events-query";
import { SoftLink } from "./soft-link";
import { WeekStrip } from "./week-strip";

/**
 * Agenda filtrable : l’URL reste la source de vérité (partageable, bouton
 * retour), mais changer de filtre, de jour ou de page ne recharge pas la
 * page — les données sont chargées côté client.
 */
export function EventsBrowser({
  initialHref,
  initial,
  today,
}: {
  initialHref: string;
  initial: EventsResult;
  today: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filtres dans le chemin (/evenements/ville-kinshasa/en-ligne), sinon
  // anciens paramètres (?city=…) réécrits ensuite.
  const q = useMemo(() => {
    const segments = pathname
      .replace(/^\/evenements\/?/, "")
      .split("/")
      .filter(Boolean);
    return (
      (segments.length ? parseEventsPath(segments) : null) ??
      parseEventsQuery(new URLSearchParams(searchParams.toString()))
    );
  }, [pathname, searchParams]);
  const href = eventsQueryHref(q);

  // Ancienne URL (?city=…, ?contract=…) → forme lisible, sans nouvelle entrée d’historique.
  useEffect(() => {
    if (location.pathname + location.search !== href) {
      window.history.replaceState(
        { ...history.state, __keepScroll: true },
        "",
        href,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cache = useRef(new Map<string, EventsResult>([[initialHref, initial]]));
  const [shown, setShown] = useState({ href: initialHref, result: initial });

  useEffect(() => {
    const hit = cache.current.get(href);
    if (hit) {
      setShown({ href, result: hit });
      return;
    }
    let cancelled = false;
    loadEvents(q, today).then((result) => {
      if (result.data) cache.current.set(href, result);
      if (!cancelled) setShown({ href, result });
    });
    return () => {
      cancelled = true;
    };
    // `q` est entièrement décrit par `href`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, today]);

  const loading = shown.href !== href;
  const { data, eventDays, weekStart } = shown.result;
  const { when, city, format, date, page } = q;

  const pageCount = data
    ? Math.max(1, Math.ceil(data.total / EVENTS_PAGE_SIZE))
    : 1;
  const base = {
    when: when === "past" && !date ? "past" : undefined,
    city,
    format,
    date,
    week: q.week,
  };
  const weekHref = (next: { week?: string; date?: string }) =>
    eventsHref({
      when: base.when,
      city,
      format,
      week: next.week,
      date: next.date,
    });

  return (
    <>
      <div className="opt-ev__toolbar">
        <nav className="opt-ev__tabs" aria-label="Période">
          <SoftLink
            href={eventsHref({ city, format })}
            className={!date && when === "upcoming" ? "is-active" : undefined}
            aria-current={!date && when === "upcoming" ? "page" : undefined}
          >
            À venir
          </SoftLink>
          <SoftLink
            href={eventsHref({ city, format, when: "past" })}
            className={!date && when === "past" ? "is-active" : undefined}
            aria-current={!date && when === "past" ? "page" : undefined}
          >
            Passés
          </SoftLink>
        </nav>
        <EventFilters
          cities={data?.cities ?? []}
          city={city ?? ""}
          format={format ?? ""}
          when={when}
          date={date}
          week={base.week}
        />
        <WeekStrip
          weekStart={weekStart}
          eventDays={eventDays}
          selected={date}
          today={today}
          radius={STRIP_RADIUS}
          hrefFor={weekHref}
        />
      </div>

      {date ? (
        <p className="opt-ev__active-date">
          <CalendarDays size={16} strokeWidth={2} aria-hidden />
          <span>
            Événements du <strong>{ymdLabels(date).long}</strong>
          </span>
          <SoftLink href={weekHref({ week: weekStart })}>
            <X size={14} strokeWidth={2.4} aria-hidden />
            Effacer
          </SoftLink>
        </p>
      ) : null}

      <div
        id="opt-ev-results"
        className={`opt-ev__results${loading ? " is-loading" : ""}`}
        aria-busy={loading}
      >
        {data === null ? (
          <p className="opt-ev__empty">
            Les événements sont momentanément indisponibles. Réessayez dans un
            instant.
          </p>
        ) : data.items.length === 0 ? (
          <div className="opt-ev__empty">
            <CalendarDays size={28} strokeWidth={1.6} aria-hidden />
            <p>
              {date
                ? "Aucun événement ce jour-là pour ces critères."
                : when === "upcoming"
                  ? "Aucun événement à venir pour ces critères."
                  : "Aucun événement passé pour ces critères."}
            </p>
            {city || format || date ? (
              <SoftLink href={eventsHref({ when: base.when })}>
                Effacer les filtres
              </SoftLink>
            ) : null}
          </div>
        ) : (
          <ul className="opt-ev__grid">
            {data.items.map((event) => (
              <li key={event.id}>
                <EventCard
                  event={event}
                  past={eventIsPast(event.startsAt, event.endsAt)}
                />
              </li>
            ))}
          </ul>
        )}

        {data && pageCount > 1 ? (
          <nav className="opt-ev__pager" aria-label="Pagination">
            {page > 1 ? (
              <SoftLink
                href={eventsHref({ ...base, page: page - 1 })}
                scrollToId="opt-ev-results"
              >
                ← Précédent
              </SoftLink>
            ) : (
              <span />
            )}
            <span>
              Page {page} / {pageCount}
            </span>
            {page < pageCount ? (
              <SoftLink
                href={eventsHref({ ...base, page: page + 1 })}
                scrollToId="opt-ev-results"
              >
                Suivant →
              </SoftLink>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </>
  );
}

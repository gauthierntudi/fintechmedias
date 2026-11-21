import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, mondayOf, ymdLabels } from "@/lib/events";
import { SoftLink } from "./soft-link";
import { WeekStripScroller } from "./week-strip-scroller";

type Props = {
  /** Lundi de la semaine affichée (YYYY-MM-DD). */
  weekStart: string;
  /** Jours ayant au moins un événement (filtres ville/format appliqués). */
  eventDays: string[];
  /** Jour sélectionné, s’il y en a un. */
  selected?: string;
  today: string;
  /**
   * Jours « fictifs » de chaque côté du jour central (jour choisi, sinon
   * milieu des jours d’événements) — garde les événements au centre.
   */
  radius?: number;
  /** Construit l’URL en conservant les autres filtres. */
  hrefFor: (next: { week?: string; date?: string }) => string;
};

/**
 * Barre-semaine de l’agenda : 7 jours défilables horizontalement, jours
 * d’événements en couleur accent, flèches pour changer de semaine.
 */
export function WeekStrip({
  weekStart,
  eventDays,
  selected,
  today,
  radius = 6,
  hrefFor,
}: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const withEvents = new Set(eventDays);
  const first = ymdLabels(days[0]).month;
  const last = ymdLabels(days[6]).month;
  const title =
    first === last ? first : `${first.replace(/ \d{4}$/, "")} – ${last}`;
  const count = days.filter((d) => withEvents.has(d)).length;
  const weekEvents = days.filter((d) => withEvents.has(d));
  const focus =
    selected && selected >= days[0] && selected <= days[6]
      ? selected
      : weekEvents.length
        ? // milieu de la plage d’événements de la semaine
          addDays(
            weekEvents[0],
            Math.floor(
              (Date.parse(weekEvents[weekEvents.length - 1]) -
                Date.parse(weekEvents[0])) /
                86_400_000 /
                2,
            ),
          )
        : today >= days[0] && today <= days[6]
          ? today
          : days[3];
  // Fenêtre centrée sur `focus` ; avec radius ≥ 6 elle couvre toute la semaine.
  const strip = Array.from({ length: radius * 2 + 1 }, (_, i) =>
    addDays(focus, i - radius),
  );

  return (
    <section className="opt-ev-week" aria-label="Semaine">
      <div className="opt-ev-week__head">
        <p className="opt-ev-week__title">
          {title}
          <span>
            {count === 0
              ? "Aucun événement cette semaine"
              : `${count} jour${count > 1 ? "s" : ""} avec événement`}
          </span>
        </p>
        <div className="opt-ev-week__nav">
          {today < weekStart || today > days[6] ? (
            <SoftLink
              href={hrefFor({ week: mondayOf(today) })}
              className="opt-ev-week__today"
            >
              Aujourd’hui
            </SoftLink>
          ) : null}
          <SoftLink
            href={hrefFor({ week: addDays(weekStart, -7) })}
            className="opt-ev-week__arrow"
            aria-label="Semaine précédente"
          >
            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
          </SoftLink>
          <SoftLink
            href={hrefFor({ week: addDays(weekStart, 7) })}
            className="opt-ev-week__arrow"
            aria-label="Semaine suivante"
          >
            <ChevronRight size={18} strokeWidth={2.2} aria-hidden />
          </SoftLink>
        </div>
      </div>

      <WeekStripScroller focus={`${weekStart}:${focus}`}>
        {strip.map((ymd) => {
          const l = ymdLabels(ymd);
          const has = withEvents.has(ymd);
          const isSel = ymd === selected;
          const outside = ymd < days[0] || ymd > days[6];
          const cls = [
            "opt-ev-day",
            outside && "is-outside",
            has && "has-event",
            isSel && "is-selected",
            ymd === today && "is-today",
          ]
            .filter(Boolean)
            .join(" ");
          const inner = (
            <>
              <span className="opt-ev-day__wd">{l.weekday}</span>
              <span className="opt-ev-day__num">{l.day}</span>
              <span className="opt-ev-day__dot" aria-hidden />
            </>
          );
          return (
            <li
              key={ymd}
              data-focus={ymd === focus ? "" : undefined}
              data-span={(selected ? isSel : has && !outside) ? "" : undefined}
            >
              {has || outside ? (
                <SoftLink
                  href={
                    outside
                      ? hrefFor({
                          week: mondayOf(ymd),
                          date: has ? ymd : undefined,
                        })
                      : hrefFor({
                          week: weekStart,
                          date: isSel ? undefined : ymd,
                        })
                  }
                  className={cls}
                  aria-current={isSel ? "date" : undefined}
                  aria-label={`${l.long}${isSel ? " (sélectionné)" : ""}${!has ? ", semaine voisine" : ""}`}
                >
                  {inner}
                </SoftLink>
              ) : (
                <span className={cls} aria-label={`${l.long}, aucun événement`}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </WeekStripScroller>
    </section>
  );
}

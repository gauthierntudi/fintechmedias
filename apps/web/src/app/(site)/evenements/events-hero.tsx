import Link from "next/link";
import type { PublicEventCard } from "@/lib/api";
import { EVENT_TYPE_LABELS, eventDateBadge } from "@/lib/events";

/**
 * Éventail de cartes : centre horizontal (% de la scène), décalage vertical,
 * rotation, taille (px à l’échelle 1). La 4ᵉ carte est au centre.
 */
const SLOTS = [
  { x: 15, y: 58, r: -9, s: 214 },
  { x: 26, y: 8, r: -6, s: 204 },
  { x: 37, y: 34, r: -3, s: 192 },
  { x: 48.5, y: 28, r: 0, s: 196 },
  { x: 59.5, y: 18, r: 3, s: 204 },
  { x: 70.5, y: 26, r: 5, s: 204 },
  { x: 82, y: 12, r: 8, s: 226 },
] as const;

/** Affiches décoratives quand il y a moins de 7 événements. */
const POSTERS = [
  { label: "Summit", sub: "Paiements", tone: "lime" },
  { label: "Webinaire", sub: "Open banking", tone: "ink" },
  { label: "Rencontre", sub: "Startups", tone: "paper" },
  { label: "Atelier", sub: "Mobile money", tone: "forest" },
  { label: "Conférence", sub: "Régulation", tone: "sun" },
  { label: "Masterclass", sub: "Crédit", tone: "mint" },
  { label: "Meetup", sub: "Investisseurs", tone: "ink" },
] as const;

const EVENT_TONES = ["forest", "ink", "lime", "sun", "mint", "paper"] as const;

function EventPoster({ event, i }: { event: PublicEventCard; i: number }) {
  const badge = eventDateBadge(event.startsAt);
  return (
    <span
      className={`opt-ev-fan__poster is-${EVENT_TONES[i % EVENT_TONES.length]}`}
    >
      <span className="opt-ev-fan__poster-kicker">
        {EVENT_TYPE_LABELS[event.type]}
      </span>
      <strong>{event.title}</strong>
      <span className="opt-ev-fan__poster-date">
        {badge.day} {badge.month}
        {event.city ? ` · ${event.city}` : ""}
      </span>
    </span>
  );
}

export function EventsHero({ events }: { events: PublicEventCard[] }) {
  // Les événements avec visuel d’abord, au centre de l’éventail.
  const real = [...events]
    .sort((a, b) => Number(!!b.coverUrl) - Number(!!a.coverUrl))
    .slice(0, SLOTS.length);
  const order = [3, 4, 2, 5, 1, 6, 0];
  const bySlot = new Map<number, PublicEventCard>();
  real.forEach((e, i) => bySlot.set(order[i], e));

  const city = events.find((e) => e.city)?.city ?? "Kinshasa";
  const type = events[0] ? EVENT_TYPE_LABELS[events[0].type] : "Summit";

  return (
    <header className="opt-ev-fan">
      <h1>
        L’agenda de la <span>fintech</span> africaine.
      </h1>

      <div className="opt-ev-fan__stage">
        <span className="opt-ev-fan__bubble is-left" aria-hidden>
          #{city.replace(/\s+/g, "")}
        </span>
        <span className="opt-ev-fan__bubble is-right" aria-hidden>
          #{type.replace(/\s+/g, "")}
        </span>

        {SLOTS.map((slot, i) => {
          const event = bySlot.get(i);
          const style = {
            "--x": `${slot.x}%`,
            "--y": slot.y,
            "--r": `${slot.r}deg`,
            "--size": slot.s,
            zIndex: i + 1,
          } as React.CSSProperties;

          if (event) {
            return (
              <Link
                key={event.id}
                href={`/evenements/${encodeURIComponent(event.slug)}`}
                className={`opt-ev-fan__card opt-ev-fan__card--${i + 1}`}
                style={style}
                aria-label={event.title}
              >
                {event.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.coverUrl} alt="" />
                ) : (
                  <EventPoster event={event} i={i} />
                )}
              </Link>
            );
          }

          const p = POSTERS[i];
          return (
            <span
              key={`poster-${i}`}
              className={`opt-ev-fan__card opt-ev-fan__card--${i + 1}`}
              style={style}
              aria-hidden
            >
              <span className={`opt-ev-fan__poster is-${p.tone}`}>
                <span className="opt-ev-fan__poster-kicker">{p.sub}</span>
                <strong>{p.label}</strong>
                <span className="opt-ev-fan__poster-mark" />
              </span>
            </span>
          );
        })}
      </div>

      <p className="opt-ev-fan__lead">
        Conférences, summits, rencontres et webinaires : retrouvez les
        rendez-vous qui font bouger la fintech et réservez votre place.
      </p>
    </header>
  );
}

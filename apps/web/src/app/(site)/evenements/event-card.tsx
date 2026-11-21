import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import type { PublicEventCard } from "@/lib/api";
import {
  EVENT_FORMAT_LABELS,
  EVENT_TYPE_LABELS,
  eventDateBadge,
  eventPlaceLabel,
  formatEventDateRange,
  formatPrice,
} from "@/lib/events";

export function EventCard({
  event,
  past,
}: {
  event: PublicEventCard;
  past: boolean;
}) {
  const badge = eventDateBadge(event.startsAt);
  const href = `/evenements/${encodeURIComponent(event.slug)}`;
  const [mainPrice, ...otherPrices] = event.minPrices.map(formatPrice);
  const priceHint = [
    ...otherPrices,
    event.hasFreeTier ? "option gratuite" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={`opt-ev-card${past ? " is-past" : ""}`}>
      <Link
        href={href}
        className="opt-ev-card__media"
        tabIndex={-1}
        aria-hidden
      >
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className="opt-ev-card__placeholder">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
        )}
        <span className="opt-ev-card__date">
          <strong>{badge.day}</strong>
          <span>{badge.month}</span>
        </span>
      </Link>
      <div className="opt-ev-card__body">
        <p className="opt-ev-card__tags">
          <span className="opt-ev-tag opt-ev-tag--type">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <span
            className={`opt-ev-tag opt-ev-tag--${event.format.toLowerCase()}`}
          >
            {EVENT_FORMAT_LABELS[event.format]}
          </span>
        </p>
        <h2 className="opt-ev-card__title">
          <Link href={href}>{event.title}</Link>
        </h2>
        {event.summary ? (
          <p className="opt-ev-card__summary">{event.summary}</p>
        ) : null}
        <ul className="opt-ev-card__meta">
          <li>
            <CalendarDays size={15} strokeWidth={2} aria-hidden />
            {formatEventDateRange(event.startsAt, event.endsAt)}
          </li>
          <li>
            <MapPin size={15} strokeWidth={2} aria-hidden />
            {eventPlaceLabel(event)}
          </li>
        </ul>
        <div className="opt-ev-card__footer">
          {past ? (
            <span className="opt-ev-card__price is-muted">
              Événement terminé
            </span>
          ) : event.isFree ? (
            <span className="opt-ev-card__price">
              <Ticket size={15} strokeWidth={2} aria-hidden />
              <strong>Gratuit</strong>
            </span>
          ) : mainPrice ? (
            <span className="opt-ev-card__price" title={priceHint || undefined}>
              <Ticket size={15} strokeWidth={2} aria-hidden />
              <span>
                <span>
                  Dès <strong>{mainPrice}</strong>
                </span>
                {priceHint ? <small>{priceHint}</small> : null}
              </span>
            </span>
          ) : (
            <span />
          )}
          <Link
            href={href}
            className="opt-ev-card__cta"
            tabIndex={-1}
            aria-hidden
          >
            {past ? "Revoir" : "Détails"}
            <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

import Link from "next/link";
import QRCode from "qrcode";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Globe, MapPin, Ticket } from "lucide-react";
import {
  eventsPublicApi,
  type EventProgrammeItem,
  type PublicEventDetail,
} from "@/lib/api";
import {
  EVENT_FORMAT_LABELS,
  EVENT_TYPE_LABELS,
  eventIsPast,
  eventPlaceLabel,
  formatEventDateRange,
  formatEventTimeRange,
  formatPrice,
  eventDateDisplay,
  eventHours,
  eventThemeVars,
} from "@/lib/events";
import { BRAND } from "@/lib/brand";
import { absoluteMediaUrl, getSiteUrl, plainDescription } from "@/lib/site-url";
import { ArticleShare } from "@/components/site/article-share";
import {
  EventCalendarLinks,
  EventTicketButton,
  EventViewTracker,
} from "./event-client";
import "../events.css";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<PublicEventDetail | null> {
  try {
    return await eventsPublicApi.bySlug(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await load(slug);
  if (!event) return { title: "Événement", robots: { index: false } };
  const description =
    plainDescription(event.summary) ??
    plainDescription(event.description) ??
    `${EVENT_TYPE_LABELS[event.type]} ${BRAND.name}`;
  const url = `${getSiteUrl()}/evenements/${encodeURIComponent(event.slug)}`;
  const image = absoluteMediaUrl(event.coverUrl);
  return {
    title: event.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: BRAND.name,
      title: event.title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

function formatDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupProgramme(items: EventProgrammeItem[]) {
  const groups: { day: string | null; items: EventProgrammeItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.day === item.day) last.items.push(item);
    else groups.push({ day: item.day, items: [item] });
  }
  return groups;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

/** JSON-LD schema.org/Event pour les moteurs de recherche. */
function eventJsonLd(event: PublicEventDetail) {
  const attendanceMode = {
    IN_PERSON: "https://schema.org/OfflineEventAttendanceMode",
    ONLINE: "https://schema.org/OnlineEventAttendanceMode",
    HYBRID: "https://schema.org/MixedEventAttendanceMode",
  }[event.format];
  const physical =
    event.format !== "ONLINE"
      ? {
          "@type": "Place",
          name: event.venueName ?? event.city ?? undefined,
          address:
            [event.venueAddress, event.city, event.country]
              .filter(Boolean)
              .join(", ") || undefined,
        }
      : null;
  const virtual =
    event.format !== "IN_PERSON" && event.onlineUrl
      ? { "@type": "VirtualLocation", url: event.onlineUrl }
      : null;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: plainDescription(event.summary ?? event.description, 300),
    startDate: event.startsAt,
    endDate: event.endsAt ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: attendanceMode,
    location: [physical, virtual].filter(Boolean),
    image: absoluteMediaUrl(event.coverUrl),
    organizer: { "@type": "Organization", name: event.organizer ?? BRAND.name },
    performer: event.speakers.map((s) => ({ "@type": "Person", name: s.name })),
    offers: event.ticketTiers.flatMap((t) =>
      t.prices.map((p) => ({
        "@type": "Offer",
        name: t.name,
        price: p.amount,
        priceCurrency: p.currency,
        url: event.ticketUrl ?? undefined,
      })),
    ),
  };
}

/** Fonds des portraits d’intervenants (visibles avec les photos détourées). */
const SPEAKER_TILES = [
  "#1f8fb3",
  "#e8772e",
  "#7cb518",
  "#f2a900",
  "#d62839",
  "#6a2c91",
];

/** Mention sous « En ligne » : la plateforme si on la reconnaît. */
function onlinePlatformNote(url: string | null): string {
  const platforms: [RegExp, string][] = [
    [/zoom\.(us|com)$/, "Zoom"],
    [/teams\.(microsoft|live)\.com$/, "Microsoft Teams"],
    [/meet\.google\.com$/, "Google Meet"],
    [/(youtube\.com|youtu\.be)$/, "YouTube"],
    [/(facebook\.com|fb\.watch)$/, "Facebook Live"],
    [/linkedin\.com$/, "LinkedIn Live"],
    [/webex\.com$/, "Webex"],
    [/x\.com$|twitter\.com$/, "X"],
  ];
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const hit = platforms.find(([re]) => re.test(host));
      if (hit) return `en direct sur ${hit[1]}`;
    } catch {}
  }
  return "lien d’accès communiqué aux inscrits";
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await load(slug);
  if (!event) notFound();

  const past = eventIsPast(event.startsAt, event.endsAt);
  const time = formatEventTimeRange(event.startsAt, event.endsAt);
  const dateDisplay = eventDateDisplay(event.startsAt, event.endsAt);
  const hours = eventHours(event.startsAt, event.endsAt);
  const paragraphs = (event.description ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const programme = groupProgramme(event.programme);
  const showOnline = event.format !== "IN_PERSON" && Boolean(event.onlineUrl);
  const showVenue =
    event.format !== "ONLINE" &&
    Boolean(event.venueName || event.venueAddress || event.city);
  const themeVars = eventThemeVars(event.themeColor) as CSSProperties | null;
  const pageUrl = `${getSiteUrl()}/evenements/${encodeURIComponent(event.slug)}`;
  let ticketHost: string | null = null;
  try {
    ticketHost = event.ticketUrl
      ? new URL(event.ticketUrl).hostname.replace(/^www\./, "")
      : null;
  } catch {
    ticketHost = null;
  }
  // QR du bandeau : billetterie si disponible, sinon la fiche elle-même.
  const qrTarget = !past && event.ticketUrl ? event.ticketUrl : pageUrl;
  let qrSvg: string | null = null;
  try {
    qrSvg = await QRCode.toString(qrTarget, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    });
  } catch {
    qrSvg = null;
  }
  const calendarLocation =
    event.format === "ONLINE"
      ? (event.onlineUrl ?? "En ligne")
      : [event.venueName, event.venueAddress, event.city, event.country]
          .filter(Boolean)
          .join(", ");

  return (
    <main
      className={`opt-ev opt-ev--detail${themeVars ? " opt-ev--themed" : ""}`}
      style={themeVars ?? undefined}
    >
      <EventViewTracker slug={event.slug} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventJsonLd(event)).replace(/</g, "\\u003c"),
        }}
      />

      <Link href="/evenements" className="opt-ev__back">
        <ArrowLeft size={16} aria-hidden /> Tous les événements
      </Link>

      <header className={`opt-ev-hero${event.coverUrl ? " has-cover" : ""}`}>
        <div className="opt-ev-hero__text">
          <div className="opt-ev-hero__intro">
            <p className="opt-ev-card__tags">
              <span className="opt-ev-tag opt-ev-tag--type">
                {EVENT_TYPE_LABELS[event.type]}
              </span>
              <span
                className={`opt-ev-tag opt-ev-tag--${event.format.toLowerCase()}`}
              >
                {EVENT_FORMAT_LABELS[event.format]}
              </span>
              {past ? (
                <span className="opt-ev-tag opt-ev-tag--past">Terminé</span>
              ) : null}
            </p>
            <h1>{event.title}</h1>
            {event.summary ? (
              <p className="opt-ev-hero__summary">{event.summary}</p>
            ) : null}
            {event.organizer || event.coOrganizers.length ? (
              <ul className="opt-ev-orgs" aria-label="Organisation">
                {event.organizer ? (
                  <li>
                    <OrgItem
                      name={event.organizer}
                      role="Organisateur"
                      logoUrl={event.organizerLogoUrl}
                      logoBg={event.organizerLogoBg}
                    />
                  </li>
                ) : null}
                {event.coOrganizers.map((o) => (
                  <li key={o.id}>
                    <OrgItem
                      name={o.name}
                      role="Co-organisateur"
                      logoUrl={o.logoUrl}
                      logoBg={o.logoBg}
                      url={o.url}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <aside className="opt-ev-book" aria-label="Participer">
          <div className="opt-ev-book__main">
            {past ? (
              <p className="opt-ev-book__note">
                Cet événement est terminé. Revivez-le à travers le programme et
                les intervenants ci-dessous.
              </p>
            ) : (
              <>
                {event.ticketUrl ? (
                  <div className="opt-ev-book__ticket">
                    <EventTicketButton
                      slug={event.slug}
                      href={event.ticketUrl}
                      label="Réserver ma place"
                    />
                    {ticketHost ? (
                      <small>
                        Billetterie externe · {ticketHost}
                        <ExternalLink size={12} aria-hidden />
                      </small>
                    ) : null}
                  </div>
                ) : null}
                <EventCalendarLinks
                  event={{
                    slug: event.slug,
                    title: event.title,
                    description:
                      plainDescription(
                        event.summary ?? event.description,
                        400,
                      ) ?? "",
                    location: calendarLocation,
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                    url: pageUrl,
                  }}
                />
              </>
            )}
          </div>
          <div className="opt-ev-book__tear" aria-hidden />
          <div className="opt-ev-book__stub">
            <div className="opt-ev-share">
              <ArticleShare url={pageUrl} title={event.title} />
            </div>
          </div>
        </aside>

        <dl className="opt-ev-band">
          <div className="opt-ev-band__cell">
            <dt>Date</dt>
            {dateDisplay.weekday ? (
              <dd className="opt-ev-band__day">
                <strong className="opt-ev-band__day-num">
                  {dateDisplay.big}
                </strong>
                <span className="opt-ev-band__day-text">
                  <span>{dateDisplay.weekday}</span>
                  <span>{dateDisplay.small}</span>
                </span>
              </dd>
            ) : (
              <dd>
                <strong>{dateDisplay.big}</strong>
                <strong>{dateDisplay.small}</strong>
              </dd>
            )}
          </div>
          <div className="opt-ev-band__cell">
            <dt>Horaires</dt>
            <dd>
              <strong>{hours}</strong>
              <small>({time ? "" : "chaque jour, "}heure de Kinshasa)</small>
            </dd>
          </div>
          <div className="opt-ev-band__cell opt-ev-band__cell--place">
            <dt>Lieu</dt>
            <dd>
              <strong>
                {event.format === "ONLINE"
                  ? "En ligne"
                  : (event.venueName ?? eventPlaceLabel(event))}
              </strong>
              {event.format === "ONLINE" ? (
                <small>({onlinePlatformNote(event.onlineUrl)})</small>
              ) : event.venueName ? (
                <small>({eventPlaceLabel(event)})</small>
              ) : null}
            </dd>
          </div>
          {qrSvg ? (
            <div className="opt-ev-band__qr">
              <dt>QR code</dt>
              <dd>
                <span
                  className="opt-ev-band__qr-code"
                  role="img"
                  aria-label={
                    qrTarget === pageUrl
                      ? "QR code vers cette page"
                      : "QR code vers la billetterie"
                  }
                  // SVG généré côté serveur par qrcode (aucune donnée utilisateur)
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <small>
                  {qrTarget === pageUrl
                    ? "Scannez pour ouvrir"
                    : "Scannez pour réserver"}
                </small>
              </dd>
            </div>
          ) : null}
        </dl>

        {event.coverUrl ? (
          <figure className="opt-ev-hero__cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.coverUrl} alt="" />
          </figure>
        ) : null}
      </header>

      <div className="opt-ev-layout">
        <div className="opt-ev-layout__main">
          {paragraphs.length ? (
            <section className="opt-ev-section">
              <h2>À propos</h2>
              <div className="opt-ev-prose">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ) : null}

          {programme.length ? (
            <section className="opt-ev-section">
              <h2>Programme</h2>
              {programme.map((group, gi) => (
                <div key={gi} className="opt-ev-programme">
                  {group.day ? (
                    <h3 className="opt-ev-programme__day">
                      {formatDay(group.day)}
                    </h3>
                  ) : null}
                  <ol>
                    {group.items.map((item, i) => (
                      <li key={i}>
                        <span className="opt-ev-programme__time">
                          {item.time}
                          {item.endTime ? ` – ${item.endTime}` : ""}
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          {item.description ? <p>{item.description}</p> : null}
                          {item.speakers.length ? (
                            <p className="opt-ev-programme__speakers">
                              {item.speakers.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>
          ) : null}

          {event.speakers.length ? (
            <section className="opt-ev-section">
              <h2>Intervenants</h2>
              <ul className="opt-ev-speakers">
                {event.speakers.map((s, i) => (
                  <li
                    key={s.id}
                    style={{
                      ["--tile" as string]:
                        SPEAKER_TILES[i % SPEAKER_TILES.length],
                    }}
                  >
                    <figure className="opt-ev-speakers__tile">
                      {s.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photoUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="opt-ev-speakers__initials" aria-hidden>
                          {initials(s.name)}
                        </span>
                      )}
                      <figcaption>
                        <strong>{s.name}</strong>
                        {s.role || s.organization ? (
                          <span>
                            {[s.role, s.organization]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </figcaption>
                    </figure>
                    {s.bio ? <p>{s.bio}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {event.sponsors.length ? (
            <section className="opt-ev-section">
              <h2>Sponsors et partenaires</h2>
              <ul className="opt-ev-sponsors">
                {event.sponsors.map((s) => {
                  const inner = (
                    <>
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt={s.name} loading="lazy" />
                      ) : (
                        <strong>{s.name}</strong>
                      )}
                      {s.tier ? <span>{s.tier}</span> : null}
                    </>
                  );
                  return (
                    <li key={s.id} title={s.name}>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                        >
                          {inner}
                        </a>
                      ) : (
                        <div>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="opt-ev-layout__side">
          {showVenue ? (
            <section className="opt-ev-box">
              <h2>
                <MapPin size={15} aria-hidden /> Lieu
              </h2>
              {event.venueName ? <strong>{event.venueName}</strong> : null}
              {event.venueAddress ? <p>{event.venueAddress}</p> : null}
              <p>{[event.city, event.country].filter(Boolean).join(", ")}</p>
              {event.mapUrl ? (
                <>
                  <div
                    className="opt-ev-book__tear opt-ev-box__tear"
                    aria-hidden
                  />
                  <a
                    className="opt-ev-box__link"
                    href={event.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir sur la carte <ExternalLink size={13} aria-hidden />
                  </a>
                </>
              ) : null}
            </section>
          ) : null}

          {showOnline ? (
            <section className="opt-ev-box">
              <h2>
                <Globe size={15} aria-hidden /> En ligne
              </h2>
              <p>L’événement est retransmis en ligne.</p>
              <div className="opt-ev-book__tear opt-ev-box__tear" aria-hidden />
              <a
                className="opt-ev-box__link"
                href={event.onlineUrl!}
                target="_blank"
                rel="noopener noreferrer"
              >
                Accéder au lien <ExternalLink size={13} aria-hidden />
              </a>
            </section>
          ) : null}

          {event.ticketTiers.length ? (
            <section className="opt-ev-box">
              <h2>
                <Ticket size={15} aria-hidden /> Billets
              </h2>
              <ul className="opt-ev-tiers">
                {event.ticketTiers.map((t) => (
                  <li key={t.id}>
                    <div>
                      <strong>{t.name}</strong>
                      {t.description ? <p>{t.description}</p> : null}
                    </div>
                    <span className="opt-ev-tiers__prices">
                      {t.prices.length
                        ? t.prices.map((p) => (
                            <span key={p.currency}>{formatPrice(p)}</span>
                          ))
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="opt-ev-book__tear opt-ev-box__tear" aria-hidden />
              {event.ticketUrl && !past ? (
                <EventTicketButton
                  slug={event.slug}
                  href={event.ticketUrl}
                  compact
                />
              ) : (
                <p className="opt-ev-box__note">
                  Tarifs donnés à titre indicatif.
                </p>
              )}
            </section>
          ) : event.ticketUrl && !past ? (
            <section className="opt-ev-box">
              <h2>
                <Ticket size={15} aria-hidden /> Billetterie
              </h2>
              <EventTicketButton
                slug={event.slug}
                href={event.ticketUrl}
                compact
              />
            </section>
          ) : null}

          {event.ticketUrl && !past ? (
            <p className="opt-ev-box__note">
              <ExternalLink size={13} aria-hidden /> La billetterie est gérée
              par l’organisateur sur un site externe.
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

/** Organisateur : logo (sur pastille blanche) + nom ; lien externe si fourni. */
function OrgItem({
  name,
  role,
  logoUrl,
  logoBg,
  url,
}: {
  name: string;
  role: string;
  logoUrl: string | null;
  /** Fond détecté sur le logo — remplace la pastille blanche */
  logoBg?: string | null;
  url?: string | null;
}) {
  const inner = (
    <>
      {logoUrl ? (
        <span
          className="opt-ev-orgs__logo"
          style={
            logoBg ? { background: logoBg, borderColor: logoBg } : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" loading="lazy" />
        </span>
      ) : null}
      <span className="opt-ev-orgs__text">
        <span className="opt-ev-orgs__name">{name}</span>
        <small>{role}</small>
      </span>
    </>
  );
  return url ? (
    <a
      className="opt-ev-orgs__item"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
    </a>
  ) : (
    <span className="opt-ev-orgs__item">{inner}</span>
  );
}

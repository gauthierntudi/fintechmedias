import type { Metadata } from "next";
import { eventsPublicApi } from "@/lib/api";
import { ymdInTz } from "@/lib/events";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { EventsBrowser } from "./events-browser";
import { EventsHero } from "./events-hero";
import { eventsQueryHref, loadEvents, parseEventsQuery } from "./events-query";
import "./events.css";

export const metadata: Metadata = {
  title: "Événements",
  description: `Conférences, summits, rencontres et webinaires ${BRAND.name} : l’agenda de la fintech en Afrique.`,
  alternates: { canonical: `${getSiteUrl()}/evenements` },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = parseEventsQuery(await searchParams);
  const today = ymdInTz(new Date());

  const [initial, heroEvents] = await Promise.all([
    loadEvents(q, today),
    // Cartes du hero : à venir d’abord, complétées par les événements passés.
    Promise.all([
      eventsPublicApi.list({ when: "upcoming", take: 7 }).catch(() => null),
      eventsPublicApi.list({ when: "past", take: 7 }).catch(() => null),
    ]).then(([up, past]) =>
      [...(up?.items ?? []), ...(past?.items ?? [])].slice(0, 7),
    ),
  ]);

  return (
    <main className="opt-ev">
      <EventsHero events={heroEvents} />
      <EventsBrowser
        initialHref={eventsQueryHref(q)}
        initial={initial}
        today={today}
      />
    </main>
  );
}

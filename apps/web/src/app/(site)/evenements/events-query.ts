/**
 * Filtres de /evenements ⇄ URL, et chargement des données — partagés entre
 * le rendu serveur (première page) et la navigation client (sans rechargement).
 */
import { eventsPublicApi, type PublicEventListResponse } from "@/lib/api";
import { addDays, mondayOf, ymdInTz } from "@/lib/events";
import type { EventsQuery } from "./events-path";

export {
  citySlug,
  eventsHref,
  eventsQueryHref,
  parseEventsPath,
  parseEventsQuery,
  type EventsQuery,
} from "./events-path";

export const EVENTS_PAGE_SIZE = 12;
/** Jours « fictifs » de part et d’autre du jour central de la barre-semaine. */
export const STRIP_RADIUS = 6;

export type EventsResult = {
  data: PublicEventListResponse | null;
  eventDays: string[];
  weekStart: string;
};

export async function loadEvents(
  q: EventsQuery,
  today: string,
): Promise<EventsResult> {
  const data = await eventsPublicApi
    .list({
      when: q.when,
      city: q.city,
      format: q.format,
      date: q.date,
      take: EVENTS_PAGE_SIZE,
      skip: (q.page - 1) * EVENTS_PAGE_SIZE,
    })
    .catch((): PublicEventListResponse | null => null);

  // Semaine affichée : celle du jour choisi, sinon ?week, sinon celle du
  // premier événement de la liste (pour ne pas ouvrir sur une semaine vide).
  const weekStart = mondayOf(
    q.date ??
      q.week ??
      (data?.items[0] ? ymdInTz(data.items[0].startsAt) : today),
  );

  const eventDays = await eventsPublicApi
    .days({
      // Semaine + jours « fictifs » voisins (voir WeekStrip).
      from: addDays(weekStart, -STRIP_RADIUS),
      to: addDays(weekStart, 6 + STRIP_RADIUS),
      city: q.city,
      format: q.format,
    })
    .then((r) => r.days)
    .catch((): string[] => []);

  return { data, eventDays, weekStart };
}

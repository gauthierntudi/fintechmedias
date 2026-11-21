import { AdminEventStatsView } from "./stats-view";

export default async function AdminEventStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { eventId } = await searchParams;
  return <AdminEventStatsView eventId={eventId?.trim() || undefined} />;
}

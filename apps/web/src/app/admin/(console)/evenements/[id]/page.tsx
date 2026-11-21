import { AdminEventForm } from "@/components/admin/admin-event-form";

export default async function AdminEventEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEventForm key={id} eventId={id} />;
}

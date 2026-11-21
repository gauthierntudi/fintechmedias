import { AdminJobForm } from "@/components/admin/admin-job-form";

export default async function AdminJobEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminJobForm key={id} jobId={id} />;
}

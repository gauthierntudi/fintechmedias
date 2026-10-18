import { redirect } from "next/navigation";
import type { PublicPlan } from "@/lib/api";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";
import AbonnementClient from "./abonnement-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function loadPlans(): Promise<PublicPlan[]> {
  try {
    const res = await fetch(`${API_URL}/api/plans`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PublicPlan[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function AbonnementPage() {
  if (!SUBSCRIPTIONS_ENABLED) redirect("/");

  const initialPlans = await loadPlans();

  return <AbonnementClient initialPlans={initialPlans} />;
}

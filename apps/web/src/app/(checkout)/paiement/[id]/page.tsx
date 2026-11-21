import type { Metadata } from "next";
import PaiementClient from "./paiement-client";
import "./paiement.css";

export const metadata: Metadata = {
  title: "Paiement sécurisé",
  description: "Réglez votre commande Fintech Médias par Mobile Money.",
  robots: { index: false, follow: false },
};

export default async function PaiementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaiementClient id={id} />;
}

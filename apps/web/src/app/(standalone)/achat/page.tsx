import type { Metadata } from "next";
import AchatClient from "./achat-client";

export const metadata: Metadata = {
  title: "Acheter un numéro — Fintech Médias",
  description: "Achetez un numéro du magazine en accès immédiat.",
};

export default function AchatPage() {
  return <AchatClient />;
}

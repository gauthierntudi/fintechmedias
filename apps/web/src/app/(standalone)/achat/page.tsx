import type { Metadata } from "next";
import AchatClient from "./achat-client";

export const metadata: Metadata = {
  title: "Acheter un numéro — L'Entrevue",
  description: "Achetez un numéro de L'Entrevue en accès immédiat.",
};

export default function AchatPage() {
  return <AchatClient />;
}

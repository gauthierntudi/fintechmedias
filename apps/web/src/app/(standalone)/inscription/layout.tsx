import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Inscription",
  description: `Créez un compte ${BRAND.magazineName} — ${BRAND.tagline}. Magazine, portraits et enquêtes.`,
};

export default function InscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

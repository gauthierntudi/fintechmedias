import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Désinscription newsletter",
  robots: { index: false, follow: false },
};

export default function NewsletterUnsubscribeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

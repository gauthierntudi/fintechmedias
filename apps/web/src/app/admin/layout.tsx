import type { Metadata } from "next";
import { AdminAuthProvider } from "@/components/admin/admin-auth-provider";
import { BRAND } from "@/lib/brand";
import "../admin-ui.css";

export const metadata: Metadata = {
  title: `Admin · ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}

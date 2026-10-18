import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Familjen_Grotesk } from "next/font/google";
import { preconnect } from "react-dom";
import { Providers } from "@/components/providers";
import { BRAND, BRAND_META_DESCRIPTION } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { isSiteTheme, SITE_THEME_KEY } from "@/lib/site-theme";
import "./globals.css";

/** Identité typographique L'Entrevue — corps et titres. */
const fontEntrevue = Familjen_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-familjen",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND_META_DESCRIPTION,
  icons: {
    icon: [
            { url: BRAND.icon, type: "image/png", sizes: "328x304" },
    ],
    apple: BRAND.icon,
    shortcut: BRAND.icon,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: BRAND.name,
    title: BRAND.name,
    description: BRAND_META_DESCRIPTION,
    images: [
      {
        url: BRAND.icon,
        width: 328,
        height: 304,
        alt: BRAND.name,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: BRAND.name,
    description: BRAND_META_DESCRIPTION,
    images: [BRAND.icon],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  preconnect("https://cdn.entrevue.com", { crossOrigin: "anonymous" });
  const raw = (await cookies()).get(SITE_THEME_KEY)?.value;
  const theme = isSiteTheme(raw) ? raw : "light";

  return (
    <html
      lang="fr"
      className={fontEntrevue.variable}
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <body className={fontEntrevue.className} suppressHydrationWarning>
        <Providers initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  );
}

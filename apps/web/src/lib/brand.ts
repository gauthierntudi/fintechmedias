/** Identité publique — source unique pour le site, l’admin et les e-mails. */

export const BRAND = {
  /** Nom affiché sur la plateforme. */
  name: "L'Entrevue",
  /** Nom sans article (mentions légales, staff). */
  shortName: "Entrevue",
  legalName: "Entrevue",
  /** Titre du magazine (kiosque). */
  magazineName: "L'Entrevue",
  tagline: "Autour de l’entrepreneuriat",
  taglineShort: "Autour de l’entrepreneuriat",
  description: "L'Entrevue — Autour de l’entrepreneuriat.",
  domain: "lentrevuemag.com",
  siteUrl: "https://lentrevuemag.com",
  email: "contact@lentrevuemag.com",
  infoEmail: "info@lentrevuemag.com",
  phone: "+243 813 212 772",
  address: "8 Avenue Kalemie, Kinshasa-Gombe",
  /** Logo noir — fonds clairs */
  logo: "/brand/logo-Lentrevue-mail.png",
  /** Logo — fonds sombres (header dark, footer) */
  logoOnDark: "/brand/logo-Lentrevue.png",
  icon: "/brand/favicon.jpg",
  colors: {
    black: "#111111",
    red: "#e42320",
    white: "#ffffff",
    /** Alias — anciens tokens navy / bleu / or. */
    navy: "#111111",
    blue: "#111111",
    gold: "#e42320",
  },
} as const;

export const BRAND_META_DESCRIPTION = BRAND.description;

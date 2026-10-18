/** Identité publique — source unique pour le site, l’admin et les e-mails. */

export const BRAND = {
  /** Nom affiché sur la plateforme. */
  name: "Fintech Médias",
  /** Nom sans article (mentions légales, staff). */
  shortName: "Fintech Médias",
  legalName: "Fintech Médias",
  /** Titre du magazine (kiosque). */
  magazineName: "Fintech Médias",
  tagline: "Guide dans l’univers de la FinTech en Afrique.",
  taglineShort: "La FinTech en Afrique",
  description:
    "Fintech Médias — information économique, fintech et magazines numériques.",
  domain: "fintechmedias.cd",
  siteUrl: "https://fintechmedias.cd",
  email: "contact@fintechmedias.cd",
  infoEmail: "contact@fintechmedias.cd",
  phone: "+243 816 712 981",
  address: "République démocratique du Congo",
  /** Logo — mode clair */
  logo: "/brand/logo-fintech-light.png",
  /** Logo — fonds sombres (header dark, footer) */
  logoOnDark: "/brand/logo-fintech.png",
  icon: "/brand/icon.png",
  colors: {
    black: "#111111",
    red: "#4ed319",
    white: "#ffffff",
    /** Alias — anciens tokens navy / bleu / or. */
    navy: "#111111",
    blue: "#111111",
    gold: "#4ed319",
  },
} as const;

export const BRAND_META_DESCRIPTION = BRAND.description;

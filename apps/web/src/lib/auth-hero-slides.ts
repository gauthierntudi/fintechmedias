/** Pool d’images / copy — login abonné + admin (fenêtre de 3, rotation à chaque cycle). */
export type AuthHeroSlide = {
  cover: string;
  title: string;
  lead: string;
};

export const AUTH_HERO_POOL: readonly AuthHeroSlide[] = [
  {
    cover: "/legacy/img/s1.jpg",
    title: "Fintech Médias",
    lead: "Actualités, interviews et le magazine — à lire sur tous vos écrans.",
  },
  {
    cover: "/legacy/img/s2.jpg",
    title: "Économie",
    lead: "Marchés, politiques économiques et signaux à suivre.",
  },
  {
    cover: "/legacy/img/s3.jpg",
    title: "Entreprise",
    lead: "Sociétés, levées, produits et stratégies.",
  },
  {
    cover: "/legacy/img/s4.jpg",
    title: "Interview",
    lead: "Entretiens avec celles et ceux qui font la fintech africaine.",
  },
  {
    cover: "/legacy/img/s5.jpg",
    title: "Le kiosque",
    lead: "Le magazine numérique, à lire sur tous vos écrans.",
  },
  {
    cover: "/legacy/img/s6.jpeg",
    title: "Édito",
    lead: "La voix de la rédaction sur l’actualité finance et fintech.",
  },
];

/** Nombre de slides visibles dans le diaporama. */
export const AUTH_HERO_VISIBLE = 3;

/** Fenêtre de `count` slides à partir de `offset` (boucle sur le pool). */
export function heroWindow(
  offset: number,
  count = AUTH_HERO_VISIBLE,
  pool: readonly AuthHeroSlide[] = AUTH_HERO_POOL,
): AuthHeroSlide[] {
  const n = pool.length;
  if (n === 0) return [];
  const start = ((offset % n) + n) % n;
  return Array.from({ length: Math.min(count, n) }, (_, i) => {
    return pool[(start + i) % n]!;
  });
}

/** Prochain offset après un cycle complet des 3 slides. */
export function nextHeroOffset(
  offset: number,
  poolLength = AUTH_HERO_POOL.length,
): number {
  return (offset + AUTH_HERO_VISIBLE) % poolLength;
}

/** Offset précédent (navigation manuelle). */
export function prevHeroOffset(
  offset: number,
  poolLength = AUTH_HERO_POOL.length,
): number {
  return (offset - AUTH_HERO_VISIBLE + poolLength * 10) % poolLength;
}

/** @deprecated utiliser AUTH_HERO_POOL + heroWindow */
export const AUTH_HERO_SLIDES = AUTH_HERO_POOL;

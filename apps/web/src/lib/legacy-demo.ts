/** Contenu démo — articles homepage (en attendant l’API). */

export type TopStory = {
  id: string | number;
  slug?: string;
  titre: string;
  excerpt?: string;
  cover: string;
  category: string;
  categoryTone: "red" | "blue" | "teal" | "dark" | "gold";
  author: string;
  authorAvatarUrl?: string | null;
  dateLabel: string;
  featured?: boolean;
  /** Vues — pastille % du hero si > 100. */
  viewCount?: number;
  sponsor?: { name: string; logoUrl: string | null } | null;
};

export type DemoMagazine = {
  id: number;
  titre: string;
  numero: string;
  cover: string;
  price: string;
  bgColor: string;
  themeColor: string;
  dateLabel: string;
  sommaire: { label: string; puce: string; text: string }[];
};

export const DEMO_FEATURED: TopStory[] = [
  {
    id: 1,
    titre:
      "Réforme de l’enseignement de base : ce que change la rentrée en RDC",
    excerpt:
      "Programmes, formation des enseignants et infrastructures : les mesures qui redessinent l’école congolaise cette année.",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Entreprendre",
    categoryTone: "red",
    author: "Fintech Médias",
    dateLabel: "24 juil. 2026",
    featured: true,
  },
  {
    id: 10,
    titre:
      "Cartographie scolaire : où manquent encore les salles de classe",
    excerpt:
      "Données provinciales, ratios élèves-enseignant et écarts urbains-ruraux pour décider là où l’investissement compte.",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Écosystème PME",
    categoryTone: "blue",
    author: "Fintech Médias",
    dateLabel: "23 juil. 2026",
    featured: true,
  },
  {
    id: 11,
    titre:
      "L’école de Kasumbalesa qui a fait de la cour un laboratoire",
    excerpt:
      "Un établissement frontalier transforme contraintes et inventivité en parcours d’apprentissage. Reportage.",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Rencontre Avec",
    categoryTone: "gold",
    author: "Fintech Médias",
    dateLabel: "22 juil. 2026",
    featured: true,
  },
];

export const DEMO_TOP_GRID: TopStory[] = [
  {
    id: 3,
    titre: "Débat : gratuité scolaire, bilan et angles morts",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Qu'en dit l'expert",
    categoryTone: "teal",
    author: "Fintech Médias",
    dateLabel: "23 juil. 2026",
    viewCount: 160,
  },
  {
    id: 5,
    titre: "Portrait : la directrice qui a rouvert trois écoles à Goma",
    cover: "/legacy/articles/1591545644.png",
    category: "Rencontre Avec",
    categoryTone: "gold",
    author: "Fintech Médias",
    dateLabel: "21 juil. 2026",
    viewCount: 200,
  },
  {
    id: 2,
    titre: "Budget éducation : ce que disent vraiment les chiffres 2026",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Écosystème PME",
    categoryTone: "blue",
    author: "Fintech Médias",
    dateLabel: "24 juil. 2026",
  },
  {
    id: 4,
    titre: "Kinshasa : les cantines scolaires qui tiennent encore",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Entreprendre",
    categoryTone: "red",
    author: "Fintech Médias",
    dateLabel: "22 juil. 2026",
  },
];

/** Juste pour vous — 1 grand article + 4 cartes, repli tant que l’API est vide. */
export const DEMO_FOR_YOU: TopStory[] = [
  {
    id: 101,
    titre:
      "Dédollarisation : sous-traitants miniers payés en francs congolais, ce que la BCC impose désormais",
    excerpt:
      "La réforme du change engagée en octobre 2026 vise à mieux capter les devises minières et à imposer la monnaie nationale dans les paiements locaux.",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Économie",
    categoryTone: "gold",
    author: "Fintech Médias",
    dateLabel: "14 oct. 2026",
  },
  {
    id: 102,
    titre:
      "Paiements numériques africains, Mastercard alerte sur le risque qui menace les 1 500 milliards",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Économie",
    categoryTone: "gold",
    author: "Fintech Médias",
    dateLabel: "14 oct. 2026",
  },
  {
    id: 103,
    titre:
      "Le Gabon veut moderniser son économie par le paiement digital, le test sera celui du terrain",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Actualités",
    categoryTone: "red",
    author: "Fintech Médias",
    dateLabel: "10 oct. 2026",
  },
  {
    id: 104,
    titre:
      "Mobile money : voici pourquoi la BCEAO autorise désormais des soldes deux fois plus élevés",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Économie",
    categoryTone: "gold",
    author: "Fintech Médias",
    dateLabel: "10 oct. 2026",
  },
  {
    id: 105,
    titre:
      "La BCC rémunère les réserves en francs, mais est-ce suffisant pour convaincre les banques ?",
    cover: "/legacy/articles/1591545644.png",
    category: "Actualités",
    categoryTone: "red",
    author: "Fintech Médias",
    dateLabel: "9 oct. 2026",
  },
];

export const DEMO_BREAKING = [...DEMO_FEATURED, ...DEMO_TOP_GRID.slice(0, 2)];

export const DEMO_MAGAZINES: DemoMagazine[] = [
  {
    id: 1,
    titre: "Fintech Médias #42",
    numero: "42",
    cover: "/legacy/covers/1591457791.jpg",
    price: "5",
    bgColor: "#111111",
    themeColor: "#4ed319",
    dateLabel: "juil. 2024",
    sommaire: [
      {
        label: "Entreprendre",
        puce: "/legacy/img/puce1.png",
        text: "L’actualité éducative",
      },
      {
        label: "Écosystème PME",
        puce: "/legacy/img/puce2.png",
        text: "Données & analyses",
      },
      {
        label: "Rencontre Avec",
        puce: "/legacy/img/puce3.png",
        text: "Parcours qui inspirent",
      },
      {
        label: "Qu'en dit l'expert",
        puce: "/legacy/img/puce4.png",
        text: "Voix d’experts",
      },
    ],
  },
  {
    id: 2,
    titre: "Fintech Médias #41",
    numero: "41",
    cover: "/legacy/covers/1592973573.jpg",
    price: "5",
    bgColor: "#111111",
    themeColor: "#ffffff",
    dateLabel: "juin 2024",
    sommaire: [],
  },
  {
    id: 3,
    titre: "Fintech Médias #40",
    numero: "40",
    cover: "/legacy/covers/1592973638.jpg",
    price: "5",
    bgColor: "#4ed319",
    themeColor: "#4ed319",
    dateLabel: "mai 2024",
    sommaire: [],
  },
  {
    id: 4,
    titre: "Fintech Médias #39",
    numero: "39",
    cover: "/legacy/covers/1592975124.jpg",
    price: "5",
    bgColor: "#111111",
    themeColor: "#4ed319",
    dateLabel: "avr. 2024",
    sommaire: [],
  },
  {
    id: 5,
    titre: "Fintech Médias #38",
    numero: "38",
    cover: "/legacy/covers/1592975318.jpg",
    price: "5",
    bgColor: "#111111",
    themeColor: "#4ed319",
    dateLabel: "mars 2024",
    sommaire: [],
  },
  {
    id: 6,
    titre: "Fintech Médias #37",
    numero: "37",
    cover: "/legacy/covers/1592975407.jpg",
    price: "5",
    bgColor: "#111111",
    themeColor: "#4ed319",
    dateLabel: "févr. 2024",
    sommaire: [],
  },
];

export const DEMO_PLAN = {
  price: "120",
  description:
    "Accès illimité à tous les numéros digitaux pendant 12 mois.",
  name: "Annuel",
};

/** Décryptages (après kiosque — une seule catégorie, cat. 3 legacy) */
export type DossierCard = {
  id: string | number;
  slug?: string;
  titre: string;
  cover: string;
};

export const DEMO_DOSSIERS: DossierCard[] = [
  {
    id: 21,
    titre: "Taux d’achèvement : le fossé entre provinces",
    cover: "/legacy/articles/1591543587.jpg",
  },
  {
    id: 22,
    titre: "Enseignants : effectifs, formation et vacances de postes",
    cover: "/legacy/articles/1591543622.jpg",
  },
  {
    id: 23,
    titre: "Infrastructures scolaires : l’état des lieux 2026",
    cover: "/legacy/articles/1591545854.jpg",
  },
  {
    id: 24,
    titre: "Filles à l’école : progrès, ruptures et leviers",
    cover: "/legacy/articles/1591543645.jpg",
  },
  {
    id: 25,
    titre: "Financement de l’éducation : qui paie quoi ?",
    cover: "/legacy/articles/1591545644.png",
  },
];

/** Fil info (actualités rapides) */
export const DEMO_FIL_INFO = [
  {
    id: 31,
    titre:
      "Rentrée scolaire : calendrier, manuels et points de tension dans les provinces",
  },
  {
    id: 32,
    titre:
      "Qu'en dit l'expert : deux inspecteurs, une même question sur l’évaluation des élèves",
  },
  {
    id: 33,
    titre: "Une école de Bukavu qui a fait de la lecture un rite quotidien",
  },
  {
    id: 34,
    titre: "Fintech Médias : le dossier bimestriel sur la formation des maîtres",
  },
  {
    id: 35,
    titre:
      "Écosystème PME : ce que révèlent les derniers taux de scolarisation",
  },
];

/** Start-up (après fil info — cat. 6 legacy) */
export type RubriqueStory = {
  id: string | number;
  slug?: string;
  titre: string;
  cover: string;
  category: string;
  author: string;
  authorAvatarUrl?: string | null;
  dateLabel: string;
  tagTone?: "red" | "blue" | "teal" | "dark" | "gold" | "orange" | "yellow";
  videoHlsUrl?: string | null;
  videoPosterUrl?: string | null;
  videoStatus?: "NONE" | "PENDING" | "PROCESSING" | "READY" | "FAILED";
  viewCount?: number;
  sponsor?: { name: string; logoUrl: string | null } | null;
};

export const DEMO_STARTUP_FEATURED: RubriqueStory = {
  id: 41,
  titre:
    "Start-up : comment scaler un produit fintech au Congo sans perdre le cap",
  cover: "/legacy/articles/1591543622.jpg",
  category: "Entreprendre",
  author: "Fintech Médias",
  dateLabel: "18 juil. 2026",
  tagTone: "red",
};

export const DEMO_STARTUP_GRID: RubriqueStory[] = [
  {
    id: 42,
    titre: "Incubateurs à Kinshasa : qui tire vraiment le marché ?",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Entreprendre",
    author: "Fintech Médias",
    dateLabel: "16 juil. 2026",
    tagTone: "red",
  },
  {
    id: 43,
    titre: "API ouvertes et mobile money : la nouvelle bataille des opérateurs",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Entreprendre",
    author: "Fintech Médias",
    dateLabel: "14 juil. 2026",
    tagTone: "red",
  },
  {
    id: 44,
    titre: "Levées de fonds : ce que révèlent les derniers tours régionaux",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Entreprendre",
    author: "Fintech Médias",
    dateLabel: "12 juil. 2026",
    tagTone: "red",
  },
  {
    id: 45,
    titre: "Talents tech : comment retenir les profils qui partent",
    cover: "/legacy/articles/1591545644.png",
    category: "Entreprendre",
    author: "Fintech Médias",
    dateLabel: "10 juil. 2026",
    tagTone: "red",
  },
];

/** Les plus vus (sidebar) */
export const DEMO_PLUS_VUS_FEATURED: RubriqueStory = {
  id: 51,
  titre:
    "Leadership et transformation digitale : les nouvelles routes du pouvoir",
  cover: "/legacy/articles/1591543587.jpg",
  category: "Qu'en dit l'expert",
  author: "Fintech Médias",
  dateLabel: "18 juil. 2026",
  tagTone: "teal",
};

export const DEMO_PLUS_VUS_LIST: RubriqueStory[] = [
  {
    id: 52,
    titre: "Décryptage : les nouvelles routes du commerce régional",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Écosystème PME",
    author: "Fintech Médias",
    dateLabel: "2 juil. 2026",
  },
  {
    id: 53,
    titre: "Zoom : l’écosystème entrepreneurial sous tension à Kinshasa",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Qu'en dit l'expert",
    author: "Fintech Médias",
    dateLabel: "28 juin 2026",
  },
];

/** Inspirationnel — featured split + grille 3 (après Start-up) */
export type RubriqueSplitStory = RubriqueStory & {
  excerpt?: string;
};

export const DEMO_INSPIRATIONNEL_FEATURED: RubriqueSplitStory = {
  id: 61,
  titre:
    "Inspirationnel : le parcours d’un top manager qui change la donne à Kinshasa",
  excerpt:
    "De la salle de réunion aux terrains d’innovation, un leadership qui inspire une génération d’entrepreneurs congolais…",
  cover: "/legacy/articles/1591545644.png",
  category: "Rencontre Avec",
  author: "Fintech Médias",
  dateLabel: "21 juil. 2026",
  tagTone: "gold",
};

export const DEMO_INSPIRATIONNEL_GRID: RubriqueSplitStory[] = [
  {
    id: 62,
    titre:
      "Game changers : les acteurs qui redessinent le marché régional",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Rencontre Avec",
    author: "Fintech Médias",
    dateLabel: "21 juil. 2026",
    tagTone: "gold",
  },
  {
    id: 63,
    titre: "Entrevue croisée : finance et innovation, deux visions pour Kinshasa",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Rencontre Avec",
    author: "Fintech Médias",
    dateLabel: "20 juil. 2026",
    tagTone: "gold",
  },
  {
    id: 64,
    titre:
      "Leadership : comment transformer une organisation sans perdre ses équipes",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Rencontre Avec",
    author: "Fintech Médias",
    dateLabel: "18 juil. 2026",
    tagTone: "gold",
  },
];

/** Zoom (après newsletter — layout featured + grille 2×2) */
export const DEMO_ZOOM_FEATURED: RubriqueStory = {
  id: 71,
  titre: "Zoom : l’écosystème entrepreneurial sous tension à Kinshasa",
  cover: "/legacy/articles/1591545854.jpg",
  category: "Qu'en dit l'expert",
  author: "Fintech Médias",
  dateLabel: "19 juil. 2026",
  tagTone: "teal",
};

export const DEMO_ZOOM_GRID: RubriqueStory[] = [
  {
    id: 72,
    titre: "Zoom industrie : ce que changent les nouvelles zones économiques",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Qu'en dit l'expert",
    author: "Fintech Médias",
    dateLabel: "17 juil. 2026",
    tagTone: "teal",
  },
  {
    id: 73,
    titre: "Zoom retail : la bataille des enseignes pour le client digital",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Qu'en dit l'expert",
    author: "Fintech Médias",
    dateLabel: "15 juil. 2026",
    tagTone: "teal",
  },
  {
    id: 74,
    titre: "Zoom énergie : les opérateurs face à la demande urbaine",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Qu'en dit l'expert",
    author: "Fintech Médias",
    dateLabel: "13 juil. 2026",
    tagTone: "teal",
  },
  {
    id: 75,
    titre: "Zoom logistique : corridors et délais, le vrai coût du commerce",
    cover: "/legacy/articles/1591545644.png",
    category: "Qu'en dit l'expert",
    author: "Fintech Médias",
    dateLabel: "11 juil. 2026",
    tagTone: "teal",
  },
];

/** Game Changers (sous Zoom — layout split) */
export const DEMO_GAME_FEATURED: RubriqueSplitStory = {
  id: 81,
  titre: "Game changers : les acteurs qui redessinent le marché régional",
  excerpt:
    "Portraits et trajectoires de ceux qui imposent un nouveau tempo à l’économie congolaise…",
  cover: "/legacy/articles/1591543587.jpg",
  category: "Femme",
  author: "Fintech Médias",
  dateLabel: "20 juil. 2026",
  tagTone: "dark",
};

export const DEMO_GAME_GRID: RubriqueSplitStory[] = [
  {
    id: 82,
    titre: "Celle qui a digitalisé une chaîne d’approvisionnement entière",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Fintech Médias",
    author: "Fintech Médias",
    dateLabel: "18 juil. 2026",
    tagTone: "dark",
  },
  {
    id: 83,
    titre: "Le fonds qui misé tôt sur les scale-ups d’Afrique centrale",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Fintech Médias",
    author: "Fintech Médias",
    dateLabel: "16 juil. 2026",
    tagTone: "dark",
  },
  {
    id: 84,
    titre: "Une marque locale devenue référence continentale",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Fintech Médias",
    author: "Fintech Médias",
    dateLabel: "14 juil. 2026",
    tagTone: "dark",
  },
];

/** Sidebar block 2 — À ne pas manquer */
export const DEMO_A_NE_PAS_MANQUER_FEATURED: RubriqueStory = {
  id: 91,
  titre: "Grandes entrevues : vision d’un dirigeant sur la décennie à venir",
  cover: "/legacy/articles/1591545644.png",
  category: "Qu'en dit l'expert",
  author: "Fintech Médias",
  dateLabel: "22 juil. 2026",
  tagTone: "teal",
  viewCount: 200,
};

export const DEMO_A_NE_PAS_MANQUER_LIST: RubriqueStory[] = [
  {
    id: 92,
    titre: "Édito : ce que 2026 change vraiment pour les décideurs",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Entreprendre",
    author: "Fintech Médias",
    dateLabel: "21 juil. 2026",
    viewCount: 60,
  },
  {
    id: 93,
    titre: "Entrevue croisée : deux générations, une même ambition",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Qu'en dit l'expert",
    author: "Fintech Médias",
    dateLabel: "19 juil. 2026",
  },
];


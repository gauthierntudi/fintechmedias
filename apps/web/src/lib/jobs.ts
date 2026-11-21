import type {
  JobCompanySectorName,
  JobContractTypeName,
  JobWorkModeName,
} from "@/lib/api";

/** Secteurs de l’annuaire des entreprises fintech. */
export const JOB_COMPANY_SECTOR_LABELS: Record<JobCompanySectorName, string> = {
  PAYMENTS: "Paiements & mobile money",
  BANKING: "Banque & néobanque",
  MICROFINANCE: "Microfinance & inclusion",
  LENDING: "Crédit & financement",
  INSURTECH: "Assurtech",
  WEALTH: "Épargne & investissement",
  CRYPTO: "Crypto & blockchain",
  INFRASTRUCTURE: "Infrastructure & API",
  REGTECH: "Regtech & conformité",
  OTHER: "Autre",
};

export const JOB_CONTRACT_LABELS: Record<JobContractTypeName, string> = {
  CDI: "CDI",
  CDD: "CDD",
  INTERNSHIP: "Stage",
  FREELANCE: "Freelance",
  CONSULTANCY: "Consultance",
  APPRENTICESHIP: "Alternance",
  VOLUNTEER: "Bénévolat",
  OTHER: "Autre",
};

export const JOB_WORK_MODE_LABELS: Record<JobWorkModeName, string> = {
  ON_SITE: "Sur site",
  REMOTE: "Télétravail",
  HYBRID: "Hybride",
};

/** Correspondance schema.org/JobPosting › employmentType. */
export const JOB_SCHEMA_EMPLOYMENT: Record<JobContractTypeName, string> = {
  CDI: "FULL_TIME",
  CDD: "TEMPORARY",
  INTERNSHIP: "INTERN",
  FREELANCE: "CONTRACTOR",
  CONSULTANCY: "CONTRACTOR",
  APPRENTICESHIP: "INTERN",
  VOLUNTEER: "VOLUNTEER",
  OTHER: "OTHER",
};

const TZ = "Africa/Kinshasa";

/** Jour civil (Kinshasa) « YYYY-MM-DD ». */
function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** « 30 nov. 2026 » */
export function formatJobDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** « 30 novembre 2026 » */
export function formatJobDateLong(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Jours restants avant la date limite (0 = aujourd’hui, < 0 = passée). */
export function jobDaysLeft(deadline: string, now = new Date()): number {
  const a = Date.parse(`${ymd(now)}T00:00:00Z`);
  const b = Date.parse(`${ymd(new Date(deadline))}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type JobDeadlineState = {
  label: string;
  tone: "open" | "soon" | "last" | "closed" | "none";
};

/** Étiquette d’urgence : « Plus que 3 jours », « Dernier jour », « Clôturée ». */
export function jobDeadlineState(
  deadline: string | null,
  isOpen: boolean,
): JobDeadlineState {
  if (!isOpen) return { label: "Clôturée", tone: "closed" };
  if (!deadline) return { label: "Sans date limite", tone: "none" };
  const left = jobDaysLeft(deadline);
  if (left <= 0) return { label: "Dernier jour", tone: "last" };
  if (left === 1) return { label: "Clôture demain", tone: "soon" };
  if (left <= 7) return { label: `${left} jours`, tone: "soon" };
  return { label: `${left} jours`, tone: "open" };
}

/** « il y a 3 jours » pour la date de publication. */
export function jobPublishedAgo(iso: string | null): string | null {
  if (!iso) return null;
  const days = -jobDaysLeft(iso);
  if (days <= 0) return "Publiée aujourd’hui";
  if (days === 1) return "Publiée hier";
  if (days < 30) return `Publiée il y a ${days} jours`;
  return `Publiée le ${formatJobDate(iso)}`;
}

export function jobLocationsLabel(
  locations: string[],
  workMode: JobWorkModeName,
): string {
  if (!locations.length) {
    return workMode === "REMOTE" ? "Télétravail" : "Lieu à préciser";
  }
  if (locations.length <= 2) return locations.join(" · ");
  return `${locations[0]} +${locations.length - 1} lieux`;
}

export function companyInitials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

export type JobDescriptionBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] };

const BULLET = /^\s*(?:[-•*–]|\d+[.)])\s+/;

/**
 * Description en texte simple → blocs : paragraphes (ligne vide), listes
 * (lignes « - », « • » ou « 1. ») et intertitres (ligne courte finissant par « : »).
 */
export function parseJobDescription(raw: string | null): JobDescriptionBlock[] {
  if (!raw?.trim()) return [];
  const blocks: JobDescriptionBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "ul", items: list });
    list = [];
  };

  for (const rawLine of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (BULLET.test(line)) {
      flushPara();
      list.push(line.replace(BULLET, ""));
      continue;
    }
    if (line.length <= 80 && /:$/.test(line) && !para.length) {
      flushList();
      blocks.push({ type: "h", text: line.replace(/\s*:$/, "") });
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

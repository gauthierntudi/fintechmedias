/**
 * Filtres de /jobs ⇄ chemin lisible (partagé serveur / client / middleware).
 *
 *   /jobs/cdi-cdd/teletravail/secteur-paiements/lieu-kinshasa/page-2
 */
import type {
  JobCompanySectorName,
  JobContractTypeName,
  JobListParams,
  JobWorkModeName,
} from "@/lib/api";

export const JOBS_PAGE_SIZE = 15;

export type JobsQueryState = {
  when: "open" | "closed";
  q: string;
  location: string;
  sector: JobCompanySectorName | "";
  contract: JobContractTypeName[];
  mode: JobWorkModeName[];
  sort: "recent" | "deadline";
};

export const EMPTY_JOBS_QUERY: JobsQueryState = {
  when: "open",
  q: "",
  location: "",
  sector: "",
  contract: [],
  mode: [],
  sort: "recent",
};

const CONTRACT_SLUGS: Record<JobContractTypeName, string> = {
  CDI: "cdi",
  CDD: "cdd",
  INTERNSHIP: "stage",
  FREELANCE: "freelance",
  CONSULTANCY: "consultance",
  APPRENTICESHIP: "alternance",
  VOLUNTEER: "benevolat",
  OTHER: "autre",
};

const MODE_SLUGS: Record<JobWorkModeName, string> = {
  ON_SITE: "sur-site",
  REMOTE: "teletravail",
  HYBRID: "hybride",
};

const SECTOR_SLUGS: Record<JobCompanySectorName, string> = {
  PAYMENTS: "paiements",
  BANKING: "banque",
  MICROFINANCE: "microfinance",
  LENDING: "credit",
  INSURTECH: "assurtech",
  WEALTH: "epargne",
  CRYPTO: "crypto",
  INFRASTRUCTURE: "infrastructure",
  REGTECH: "regtech",
  OTHER: "autre",
};

/** slug (ou ancienne valeur « CDI ») → clé d’énumération. */
function fromSlug<T extends string>(
  map: Record<T, string>,
  raw: string,
): T | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  for (const [key, slug] of Object.entries(map) as [T, string][]) {
    if (slug === v || key.toLowerCase() === v) return key;
  }
  return undefined;
}

function fromSlugs<T extends string>(
  map: Record<T, string>,
  raw: string | undefined,
): T[] {
  if (!raw) return [];
  const out = raw
    .split(",")
    .map((x) => fromSlug(map, x))
    .filter((x): x is T => Boolean(x));
  return [...new Set(out)];
}

type ParamSource =
  URLSearchParams | Record<string, string | string[] | undefined>;

function read(src: ParamSource, ...keys: string[]): string | undefined {
  for (const k of keys) {
    let v: string | string[] | null | undefined;
    if (src instanceof URLSearchParams) {
      const all = src.getAll(k);
      v = all.length > 1 ? all : all[0];
    } else {
      v = src[k];
    }
    const s = Array.isArray(v) ? v.join(",") : v;
    if (s?.trim()) return s.trim();
  }
  return undefined;
}

/** « Kinshasa — Gombe » → « kinshasa-gombe » (même règle que l’API). */
export function placeSlug(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CONTRACT_BY_SLUG = new Map(
  (Object.entries(CONTRACT_SLUGS) as [JobContractTypeName, string][]).map(
    ([k, v]) => [v, k],
  ),
);

/** « cdi-cdd » → [CDI, CDD] ; null si un morceau n’est pas un contrat. */
function contractsFromSegment(seg: string): JobContractTypeName[] | null {
  const out: JobContractTypeName[] = [];
  for (const part of seg.split("-")) {
    const c = CONTRACT_BY_SLUG.get(part);
    if (!c) return null;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** « teletravail-sur-site » → [REMOTE, ON_SITE] ; null sinon. */
function modesFromSegment(seg: string): JobWorkModeName[] | null {
  const out: JobWorkModeName[] = [];
  let rest = seg;
  while (rest) {
    const hit = (
      Object.entries(MODE_SLUGS) as [JobWorkModeName, string][]
    ).find(([, slug]) => rest === slug || rest.startsWith(`${slug}-`));
    if (!hit) return null;
    if (!out.includes(hit[0])) out.push(hit[0]);
    rest = rest.slice(hit[1].length + 1);
  }
  return out.length ? out : null;
}

/**
 * Chemin de filtres → état. Chaque segment est un filtre nommé :
 *   /jobs/cdi-cdd/teletravail/secteur-paiements/lieu-kinshasa
 *   /jobs/recherche-risque+crédit/cloturees/tri-date-limite/page-2
 * Renvoie null si un segment n’est pas un filtre (→ fiche d’offre).
 */
export function parseJobsPath(
  segments: string[],
): { state: JobsQueryState; page: number } | null {
  const state: JobsQueryState = { ...EMPTY_JOBS_QUERY, contract: [], mode: [] };
  let page = 1;
  for (const raw of segments) {
    let seg: string;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (!seg) continue;
    let m: RegExpMatchArray | null;
    if (seg === "cloturees") state.when = "closed";
    else if (seg === "tri-date-limite") state.sort = "deadline";
    else if ((m = seg.match(/^page-(\d{1,4})$/))) page = Math.max(1, +m[1]);
    else if ((m = seg.match(/^secteur-([a-z0-9-]+)$/))) {
      const sector = fromSlug(SECTOR_SLUGS, m[1]);
      if (!sector) return null;
      state.sector = sector;
    } else if ((m = seg.match(/^lieu-([a-z0-9-]+)$/))) state.location = m[1];
    else if ((m = seg.match(/^recherche-([^]+)$/))) {
      state.q = m[1].replace(/\+/g, " ").trim();
    } else {
      const contracts = contractsFromSegment(seg);
      const modes = contracts ? null : modesFromSegment(seg);
      if (contracts) state.contract = contracts;
      else if (modes) state.mode = modes;
      else return null;
    }
  }
  return { state, page };
}

/**
 * Lit l’état : `f` (chemin réécrit par le middleware), sinon les anciens
 * paramètres (?contrat=…, ?contract=…) encore acceptés.
 */
export function parseJobsQuery(src: ParamSource): {
  state: JobsQueryState;
  page: number;
} {
  const f = read(src, "f");
  if (f) {
    const parsed = parseJobsPath(f.split("/"));
    if (parsed) return parsed;
  }
  const statut = read(src, "statut", "when");
  const tri = read(src, "tri", "sort");
  const sector = fromSlug(SECTOR_SLUGS, read(src, "secteur", "sector") ?? "");
  const location = read(src, "lieu", "location");
  return {
    state: {
      when: statut === "cloturees" || statut === "closed" ? "closed" : "open",
      q: read(src, "q") ?? "",
      location: location ? placeSlug(location) : "",
      sector: sector ?? "",
      contract: fromSlugs(CONTRACT_SLUGS, read(src, "contrat", "contract")),
      mode: fromSlugs(MODE_SLUGS, read(src, "mode")),
      sort: tri === "date-limite" || tri === "deadline" ? "deadline" : "recent",
    },
    page: Math.max(1, Number(read(src, "page")) || 1),
  };
}

/** Recherche libre lisible dans un segment (espaces → +, accents gardés). */
function encQ(v: string): string {
  return encodeURIComponent(v.trim().replace(/\s+/g, "+")).replace(/%2B/g, "+");
}

/** État → chemin : /jobs/cdi-cdd/teletravail/secteur-paiements/page-2 */
export function jobsHref(state: Partial<JobsQueryState>, page = 1): string {
  const parts: string[] = [];
  if (state.q?.trim()) parts.push(`recherche-${encQ(state.q)}`);
  if (state.contract?.length) {
    parts.push(state.contract.map((c) => CONTRACT_SLUGS[c]).join("-"));
  }
  if (state.mode?.length) {
    parts.push(state.mode.map((m) => MODE_SLUGS[m]).join("-"));
  }
  if (state.sector) parts.push(`secteur-${SECTOR_SLUGS[state.sector]}`);
  if (state.location) parts.push(`lieu-${placeSlug(state.location)}`);
  if (state.when === "closed") parts.push("cloturees");
  if (state.sort === "deadline") parts.push("tri-date-limite");
  if (page > 1) parts.push(`page-${page}`);
  return parts.length ? `/jobs/${parts.join("/")}` : "/jobs";
}

export function jobsListParams(
  state: JobsQueryState,
  page: number,
): JobListParams {
  return {
    when: state.when,
    q: state.q || undefined,
    location: state.location || undefined,
    sector: state.sector ? [state.sector] : undefined,
    contract: state.contract,
    mode: state.mode,
    sort: state.sort,
    take: JOBS_PAGE_SIZE,
    skip: (page - 1) * JOBS_PAGE_SIZE,
  };
}

export function hasJobsFilters(state: JobsQueryState): boolean {
  return Boolean(
    state.q ||
    state.location ||
    state.sector ||
    state.contract.length ||
    state.mode.length,
  );
}

/** Pages affichées : 1 … 4 5 6 … 12 */
export function jobsPageItems(page: number, count: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let i = 1; i <= count; i++) {
    if (i === 1 || i === count || Math.abs(i - page) <= 1) out.push(i);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

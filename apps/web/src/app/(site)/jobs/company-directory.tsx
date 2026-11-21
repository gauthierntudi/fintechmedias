"use client";

import { useMemo, useState } from "react";
import { Building2, Globe, MapPin, Search } from "lucide-react";
import type { JobCompanySectorName, PublicJobCompany } from "@/lib/api";
import { JOB_COMPANY_SECTOR_LABELS } from "@/lib/jobs";
import { JobLogo } from "./job-row";

const VISIBLE = 8;

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path
        fill="currentColor"
        d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65l.05-.04ZM14.1 5.83c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.67 1.37-.58.67-1.1 1.76-.96 2.79 1.02.08 2.06-.52 2.69-1.27Z"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
      <path
        fill="currentColor"
        d="M4.2 2.4c-.2.2-.3.6-.3 1v17.2c0 .4.1.8.3 1l9.7-9.6-9.7-9.6Zm10.9 10.8 2.6 2.6-11.5 6.6c-.3.2-.7.2-1 .1l9.9-9.3Zm0-2.4L5.2 1.5c.3-.1.7-.1 1 .1l11.5 6.6-2.6 2.6Zm3.9-1.8 2.9 1.7c.8.5.8 1.7 0 2.2l-2.9 1.7-2.8-2.8 2.8-2.8Z"
      />
    </svg>
  );
}

/** Annuaire Fintech fintech qui recrutent sur Fintech Médias. */
export function CompanyDirectory({
  companies,
}: {
  companies: PublicJobCompany[];
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<JobCompanySectorName | "">("");
  const [expanded, setExpanded] = useState(false);

  const sectors = useMemo(() => {
    const set = new Set<JobCompanySectorName>();
    for (const c of companies) if (c.sector) set.add(c.sector);
    return [...set].sort((a, b) =>
      JOB_COMPANY_SECTOR_LABELS[a].localeCompare(
        JOB_COMPANY_SECTOR_LABELS[b],
        "fr",
      ),
    );
  }, [companies]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return companies.filter(
      (c) =>
        (!sector || c.sector === sector) &&
        (!q || normalize(`${c.name} ${c.headquarters ?? ""}`).includes(q)),
    );
  }, [companies, query, sector]);

  const filtering = Boolean(query || sector);
  const shown = expanded || filtering ? filtered : filtered.slice(0, VISIBLE);
  const hidden = filtered.length - shown.length;

  return (
    <section className="opt-job-dir" aria-labelledby="job-dir-title">
      <header className="opt-job-dir__head">
        <Building2 size={18} aria-hidden />
        <div>
          <h2 id="job-dir-title">Annuaire Fintech</h2>
          <p>
            {companies.length} entreprise{companies.length > 1 ? "s" : ""}{" "}
            fintech
          </p>
        </div>
      </header>

      {companies.length > 6 || sectors.length > 1 ? (
        <div className="opt-job-dir__tools">
          {companies.length > 6 ? (
            <label className="opt-job-dir__search">
              <Search size={15} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom ou ville"
                aria-label="Rechercher une entreprise"
              />
            </label>
          ) : null}
          {sectors.length > 1 ? (
            <select
              className="opt-job-dir__sector"
              value={sector}
              onChange={(e) =>
                setSector(e.target.value as JobCompanySectorName | "")
              }
              aria-label="Secteur"
            >
              <option value="">Tous les secteurs</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {JOB_COMPANY_SECTOR_LABELS[s]}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {shown.length ? (
        <ul className="opt-job-dir__list">
          {shown.map((c) => (
            <li key={c.slug} className="opt-job-dir__item">
              <JobLogo name={c.name} url={c.logoUrl} bg={c.logoBg} size="sm" />
              <div className="opt-job-dir__body">
                <strong className="opt-job-dir__name">{c.name}</strong>
                {c.headquarters ? (
                  <span className="opt-job-dir__hq">
                    <MapPin size={12} aria-hidden />
                    {c.headquarters}
                  </span>
                ) : null}
              </div>
              {c.url || c.appStoreUrl || c.playStoreUrl ? (
                <span className="opt-job-dir__links">
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Site web de ${c.name} (${host(c.url)})`}
                      title={host(c.url)}
                    >
                      <Globe size={14} aria-hidden />
                    </a>
                  ) : null}
                  {c.appStoreUrl ? (
                    <a
                      href={c.appStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${c.name} sur l’App Store`}
                      title="App Store"
                    >
                      <AppleIcon />
                    </a>
                  ) : null}
                  {c.playStoreUrl ? (
                    <a
                      href={c.playStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${c.name} sur Google Play`}
                      title="Google Play"
                    >
                      <PlayIcon />
                    </a>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="opt-job-dir__empty">Aucune entreprise trouvée.</p>
      )}

      {hidden > 0 ? (
        <button
          type="button"
          className="opt-job-dir__more"
          onClick={() => setExpanded(true)}
        >
          Voir les {filtered.length} entreprises
        </button>
      ) : null}
    </section>
  );
}

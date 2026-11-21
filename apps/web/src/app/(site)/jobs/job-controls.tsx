"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import type {
  JobCompanySectorName,
  JobContractTypeName,
  JobWorkModeName,
  PublicJobListResponse,
} from "@/lib/api";
import {
  JOB_COMPANY_SECTOR_LABELS,
  JOB_CONTRACT_LABELS,
  JOB_WORK_MODE_LABELS,
} from "@/lib/jobs";
import { placeSlug, type JobsQueryState } from "./jobs-query";

export type JobsPatch = Partial<JobsQueryState>;

/** Barre de recherche : mots-clés, lieu, secteur. */
export function JobSearchBar({
  state,
  locations,
  onChange: go,
}: {
  state: JobsQueryState;
  locations: string[];
  onChange: (patch: JobsPatch) => void;
}) {
  const [q, setQ] = useState(state.q);
  const [location, setLocation] = useState(state.location);
  const [sector, setSector] = useState(state.sector);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go({ q, location, sector });
  }

  // Valeur = slug du lieu (celui de l’URL), libellé = nom affiché.
  const locationOptions = locations.map((l) => ({
    value: placeSlug(l),
    label: l,
  }));
  if (location && !locationOptions.some((o) => o.value === location)) {
    locationOptions.unshift({ value: location, label: location });
  }
  const dirty = Boolean(q || location || sector);

  return (
    <form className="opt-jobs-search" role="search" onSubmit={onSubmit}>
      <label className="opt-jobs-search__field opt-jobs-search__field--q">
        <Search size={17} aria-hidden />
        <span className="sr-only">Poste ou mot-clé</span>
        <input
          type="search"
          value={q}
          placeholder="Poste, entreprise ou mot-clé"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <label
        className={`opt-jobs-search__field opt-jobs-search__field--pick${location ? " is-set" : ""}`}
        title="Lieu"
      >
        <MapPin size={17} aria-hidden />
        <span className="sr-only">Lieu</span>
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">Tous les lieux</option>
          {locationOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label
        className={`opt-jobs-search__field opt-jobs-search__field--pick${sector ? " is-set" : ""}`}
        title="Secteur"
      >
        <Building2 size={17} aria-hidden />
        <span className="sr-only">Secteur</span>
        <select
          value={sector}
          onChange={(e) =>
            setSector(e.target.value as JobCompanySectorName | "")
          }
        >
          <option value="">Tous les secteurs</option>
          {(
            Object.keys(JOB_COMPANY_SECTOR_LABELS) as JobCompanySectorName[]
          ).map((k) => (
            <option key={k} value={k}>
              {JOB_COMPANY_SECTOR_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <div className="opt-jobs-search__actions">
        {dirty ? (
          <button
            type="button"
            className="opt-jobs-search__clear"
            aria-label="Effacer la recherche"
            onClick={() => {
              setQ("");
              setLocation("");
              setSector("");
              go({ q: "", location: "", sector: "" });
            }}
          >
            <X size={16} aria-hidden />
            <span>Effacer</span>
          </button>
        ) : null}
        <button
          type="submit"
          className="opt-jobs-search__submit"
          aria-label="Rechercher"
        >
          <Search size={18} aria-hidden />
          <span>Rechercher</span>
        </button>
      </div>
    </form>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/** Colonne de filtres : statut, type de contrat, mode de travail. */
export function JobFilterPanel({
  state,
  facets,
  total,
  loading = false,
  onChange: go,
}: {
  state: JobsQueryState;
  facets: PublicJobListResponse["facets"];
  total?: number;
  loading?: boolean;
  onChange: (patch: JobsPatch) => void;
}) {
  const active = state.contract.length + state.mode.length;
  const [open, setOpen] = useState(false);
  // Groupe masqué s’il n’a aucune option à proposer (ex. aucune offre clôturée).
  const showContract =
    state.contract.length > 0 ||
    Object.values(facets?.contract ?? {}).some((n) => n > 0);
  const showMode =
    state.mode.length > 0 ||
    Object.values(facets?.mode ?? {}).some((n) => n > 0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Panneau ouvert : Échap ferme, la page ne défile plus ; fermé si on repasse en multi-colonnes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 992px)");
    const onMq = () => mq.matches && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  // Rendu deux fois (colonne desktop / panneau mobile) : noms de radio distincts.
  const body = (variant: string) => (
    <>
      <fieldset className="opt-jobs-filter__group">
        <legend>Statut</legend>
        {(
          [
            ["open", "Offres ouvertes"],
            ["closed", "Clôturées"],
          ] as const
        ).map(([v, l]) => (
          <label key={v} className="opt-jobs-filter__option is-switch">
            <span>{l}</span>
            <input
              type="radio"
              className="opt-jobs-switch"
              name={`job-when-${variant}`}
              checked={state.when === v}
              onChange={() => go({ when: v })}
            />
          </label>
        ))}
      </fieldset>

      {showContract ? (
        <fieldset className="opt-jobs-filter__group">
          <legend>Type de contrat</legend>
          {(Object.keys(JOB_CONTRACT_LABELS) as JobContractTypeName[]).map(
            (k) => {
              const n = facets?.contract[k] ?? 0;
              const checked = state.contract.includes(k);
              if (!n && !checked) return null;
              return (
                <label key={k} className="opt-jobs-filter__option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => go({ contract: toggle(state.contract, k) })}
                  />
                  <span>{JOB_CONTRACT_LABELS[k]}</span>
                  <small>{n}</small>
                </label>
              );
            },
          )}
        </fieldset>
      ) : null}

      {showMode ? (
        <fieldset className="opt-jobs-filter__group">
          <legend>Mode de travail</legend>
          {(Object.keys(JOB_WORK_MODE_LABELS) as JobWorkModeName[]).map((k) => {
            const n = facets?.mode[k] ?? 0;
            const checked = state.mode.includes(k);
            if (!n && !checked) return null;
            return (
              <label key={k} className="opt-jobs-filter__option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => go({ mode: toggle(state.mode, k) })}
                />
                <span>{JOB_WORK_MODE_LABELS[k]}</span>
                <small>{n}</small>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {active ? (
        <button
          type="button"
          className="opt-jobs-filter__reset"
          onClick={() => go({ contract: [], mode: [] })}
        >
          Réinitialiser les filtres
        </button>
      ) : null}
    </>
  );

  return (
    <>
      <section className="opt-jobs-filter opt-jobs-filter--desktop">
        <h2>Filtres</h2>
        {body("d")}
      </section>
      {/* Une colonne : bouton + panneau latéral */}
      <button
        type="button"
        className="opt-jobs-filter opt-jobs-filter--mobile"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={16} aria-hidden />
        Filtres
        {active ? (
          <span className="opt-jobs-filter__badge">{active}</span>
        ) : null}
      </button>
      {mounted
        ? createPortal(
            <div
              className={`opt-jobs-drawer${open ? " is-open" : ""}`}
              aria-hidden={!open}
            >
              <div
                className="opt-jobs-drawer__backdrop"
                onClick={() => setOpen(false)}
              />
              <aside
                className="opt-jobs-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-label="Filtres"
                inert={!open}
              >
                <header className="opt-jobs-drawer__head">
                  <h2>
                    Filtres
                    {active ? (
                      <span className="opt-jobs-filter__badge">{active}</span>
                    ) : null}
                  </h2>
                  <button
                    type="button"
                    className="opt-jobs-drawer__close"
                    aria-label="Fermer les filtres"
                    onClick={() => setOpen(false)}
                  >
                    <X size={20} aria-hidden />
                  </button>
                </header>
                <div className="opt-jobs-drawer__body">{body("m")}</div>
                <footer className="opt-jobs-drawer__foot">
                  <button
                    type="button"
                    className="opt-jobs-drawer__apply"
                    onClick={() => setOpen(false)}
                  >
                    {loading || total === undefined
                      ? "Voir les offres"
                      : `Voir ${total} offre${total > 1 ? "s" : ""}`}
                  </button>
                </footer>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function JobSort({
  state,
  onChange: go,
}: {
  state: JobsQueryState;
  onChange: (patch: JobsPatch) => void;
}) {
  return (
    <label className="opt-jobs-sort">
      <span>Trier par</span>
      <select
        value={state.sort}
        onChange={(e) => go({ sort: e.target.value as JobsQueryState["sort"] })}
      >
        <option value="recent">Plus récentes</option>
        <option value="deadline">Date limite proche</option>
      </select>
    </label>
  );
}

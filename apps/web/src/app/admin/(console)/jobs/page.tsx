"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminJobsApi,
  type AdminJob,
  type AdminJobListResponse,
  type JobStatusName,
} from "@/lib/api";
import {
  JOB_CONTRACT_LABELS,
  JOB_WORK_MODE_LABELS,
  companyInitials,
  formatJobDate,
  jobLocationsLabel,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

const TAKE = 15;

function formatCount(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export default function AdminJobsPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminJobListResponse | null>(null);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [status, setStatus] = useState<JobStatusName | "">("");
  const [when, setWhen] = useState<"open" | "closed" | "">("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminJob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminJobsApi.list({ q, status, when, take: TAKE, skip }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement offres",
      );
    } finally {
      setLoading(false);
    }
  }, [q, status, when, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSkip(0);
    setQ(qDraft.trim());
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await adminJobsApi.remove(pendingDelete.id);
      toast.success("Offre supprimée");
      setPendingDelete(null);
      if ((data?.items.length ?? 0) <= 1 && skip > 0) {
        setSkip(Math.max(0, skip - TAKE));
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec suppression");
    } finally {
      setDeleting(false);
    }
  }

  const items = data?.items ?? [];
  const summary = data?.summary;

  const kpis = summary
    ? [
        {
          key: "all",
          label: "Total",
          value: summary.total,
          color: "teal",
          active: !status && !when,
          onSelect: () => {
            setStatus("");
            setWhen("");
            setSkip(0);
          },
        },
        {
          key: "open",
          label: "Ouvertes (publiées)",
          value: summary.open,
          color: "green",
          active: status === "PUBLISHED" && when === "open",
          onSelect: () => {
            setStatus("PUBLISHED");
            setWhen("open");
            setSkip(0);
          },
        },
        {
          key: "published",
          label: "Publiées",
          value: summary.published,
          color: "blue",
          active: status === "PUBLISHED" && !when,
          onSelect: () => {
            setStatus("PUBLISHED");
            setWhen("");
            setSkip(0);
          },
        },
        {
          key: "drafts",
          label: "Brouillons",
          value: summary.drafts,
          color: "gold",
          active: status === "DRAFT",
          onSelect: () => {
            setStatus("DRAFT");
            setWhen("");
            setSkip(0);
          },
        },
      ]
    : [];

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Jobs</h1>
          <p>
            Offres d’emploi relayées sur le site — la candidature se fait sur le
            formulaire du recruteur.
          </p>
        </div>
        <div className="admin-article-page__header-actions">
          <Link href="/admin/jobs/entreprises" className="admin-dash__btn">
            <Building2 size={16} aria-hidden /> Annuaire Fintech
          </Link>
          <Link
            href="/admin/jobs/nouveau"
            className="admin-dash__btn admin-dash__btn--primary"
          >
            <Plus size={16} aria-hidden /> Nouvelle offre
          </Link>
        </div>
      </header>

      {summary ? (
        <section
          className="admin-dash__kpis-row"
          aria-label="Statistiques offres"
          style={{ ["--kpi-count" as string]: "4" }}
        >
          {kpis.map((card) => (
            <article
              key={card.key}
              role="button"
              tabIndex={0}
              aria-pressed={card.active}
              className={cn(
                "snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid",
                `admin-dash__kpi-vivid--${card.color}`,
                card.active && "admin-dash__kpi-vivid--active",
              )}
              onClick={card.onSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  card.onSelect();
                }
              }}
            >
              <p className="snow-dash__kpi-label">{card.label}</p>
              <p className="snow-dash__kpi-value">{formatCount(card.value)}</p>
            </article>
          ))}
        </section>
      ) : null}

      <form className="admin-dash__filters" onSubmit={onSearch}>
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            type="search"
            placeholder="Poste, entreprise, lieu…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={status}
            onChange={(e) => {
              setSkip(0);
              setStatus(e.target.value as JobStatusName | "");
            }}
          >
            <option value="">Tous</option>
            <option value="PUBLISHED">Publiées</option>
            <option value="DRAFT">Brouillons</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Candidatures</span>
          <select
            value={when}
            onChange={(e) => {
              setSkip(0);
              setWhen(e.target.value as "open" | "closed" | "");
            }}
          >
            <option value="">Toutes</option>
            <option value="open">Ouvertes</option>
            <option value="closed">Clôturées</option>
          </select>
        </label>
        <button
          type="submit"
          className="admin-dash__btn admin-dash__btn--primary"
        >
          Filtrer
        </button>
      </form>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Offre</th>
              <th>Contrat</th>
              <th>Lieux</th>
              <th>Date limite</th>
              <th>Statut</th>
              <th>Vues</th>
              <th>Clics « Postuler »</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-dash__muted">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-dash__muted">
                  Aucune offre.{" "}
                  <Link href="/admin/jobs/nouveau">Créer la première</Link>
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  className="admin-dash__table-row--click"
                  onClick={() => router.push(`/admin/jobs/${row.id}`)}
                >
                  <td>
                    <div className="admin-sub__user">
                      <span
                        className="admin-mag__thumb admin-job__logo-thumb"
                        aria-hidden
                        style={
                          row.companyLogoUrl && row.companyLogoBg
                            ? { background: row.companyLogoBg }
                            : undefined
                        }
                      >
                        {row.companyLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.companyLogoUrl} alt="" />
                        ) : (
                          <span className="admin-mag__thumb-empty">
                            {companyInitials(row.companyName)}
                          </span>
                        )}
                      </span>
                      <div className="admin-sub__user-meta">
                        <strong>{row.title}</strong>
                        <span className="admin-dash__muted">
                          {row.companyName}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {JOB_CONTRACT_LABELS[row.contractType]}
                    <span className="admin-dash__muted">
                      {" "}
                      · {JOB_WORK_MODE_LABELS[row.workMode]}
                    </span>
                  </td>
                  <td>{jobLocationsLabel(row.locations, row.workMode)}</td>
                  <td>
                    {row.deadline ? formatJobDate(row.deadline) : "—"}
                    {!row.isOpen ? (
                      <span className="admin-dash__muted"> · clôturée</span>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={
                        row.status === "PUBLISHED"
                          ? "admin-mag__badge admin-mag__badge--on"
                          : "admin-mag__badge admin-sub__badge--pending"
                      }
                    >
                      {row.status === "PUBLISHED" ? "Publiée" : "Brouillon"}
                    </span>
                  </td>
                  <td>{formatCount(row.viewCount)}</td>
                  <td>
                    {row.applyUrl || row.applyEmail
                      ? formatCount(row.applyClicks)
                      : "—"}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="admin-dash__row-actions">
                      <Link
                        href={`/admin/jobs/${row.id}`}
                        className="admin-dash__icon-action admin-dash__icon-action--edit"
                        aria-label="Modifier"
                        title="Modifier"
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </Link>
                      {row.status === "PUBLISHED" ? (
                        <a
                          href={`/jobs/${row.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-dash__icon-action"
                          aria-label="Voir sur le site"
                          title="Voir sur le site"
                        >
                          <ExternalLink size={16} strokeWidth={2} />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="admin-dash__icon-action admin-dash__icon-action--delete"
                        aria-label="Supprimer"
                        title="Supprimer"
                        onClick={() => setPendingDelete(row)}
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        total={data?.total ?? 0}
        take={TAKE}
        skip={skip}
        onSkipChange={setSkip}
      />

      <AdminModal
        open={Boolean(pendingDelete)}
        title="Supprimer l’offre"
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
      >
        <div className="admin-delete-confirm">
          <div className="admin-delete-confirm__icon" aria-hidden>
            <Trash2 size={22} strokeWidth={2} />
          </div>
          <p className="admin-delete-confirm__lead">
            Cette action est <strong>définitive</strong> : l’offre et ses
            statistiques seront supprimées.
          </p>
          {pendingDelete ? (
            <div className="admin-delete-confirm__target">
              <span className="admin-delete-confirm__label">Offre</span>
              <strong className="admin-delete-confirm__title">
                {pendingDelete.title}
              </strong>
              <span className="admin-delete-confirm__slug">
                {pendingDelete.companyName}
              </span>
            </div>
          ) : null}
          <div className="admin-delete-confirm__actions">
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--cancel-vivid"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--danger-vivid"
              disabled={deleting}
              onClick={() => void confirmRemove()}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              {deleting ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}

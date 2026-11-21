"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { BarChart3, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminEventsApi,
  type AdminEvent,
  type AdminEventListResponse,
  type EventStatusName,
} from "@/lib/api";
import {
  EVENT_FORMAT_LABELS,
  EVENT_TYPE_LABELS,
  eventIsPast,
  eventPlaceLabel,
  formatEventDateRange,
} from "@/lib/events";
import { cn } from "@/lib/utils";

const TAKE = 15;

function formatCount(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export default function AdminEventsPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminEventListResponse | null>(null);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [status, setStatus] = useState<EventStatusName | "">("");
  const [when, setWhen] = useState<"upcoming" | "past" | "">("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await adminEventsApi.list({ q, status, when, take: TAKE, skip }),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement événements",
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
      await adminEventsApi.remove(pendingDelete.id);
      toast.success("Événement supprimé");
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
          key: "upcoming",
          label: "À venir (publiés)",
          value: summary.upcoming,
          color: "green",
          active: status === "PUBLISHED" && when === "upcoming",
          onSelect: () => {
            setStatus("PUBLISHED");
            setWhen("upcoming");
            setSkip(0);
          },
        },
        {
          key: "published",
          label: "Publiés",
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
          <h1>Événements</h1>
          <p>
            Conférences, summits, rencontres et webinaires — fiches
            informatives, sans vente de billets.
          </p>
        </div>
        <div className="admin-article-page__header-actions">
          <Link href="/admin/evenements/statistiques" className="admin-dash__btn">
            <BarChart3 size={16} aria-hidden /> Statistiques
          </Link>
          <Link
            href="/admin/evenements/nouveau"
            className="admin-dash__btn admin-dash__btn--primary"
          >
            <Plus size={16} aria-hidden /> Nouvel événement
          </Link>
        </div>
      </header>

      {summary ? (
        <section
          className="admin-dash__kpis-row"
          aria-label="Statistiques événements"
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
            placeholder="Titre, ville, organisateur…"
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
              setStatus(e.target.value as EventStatusName | "");
            }}
          >
            <option value="">Tous</option>
            <option value="PUBLISHED">Publiés</option>
            <option value="DRAFT">Brouillons</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Période</span>
          <select
            value={when}
            onChange={(e) => {
              setSkip(0);
              setWhen(e.target.value as "upcoming" | "past" | "");
            }}
          >
            <option value="">Toutes</option>
            <option value="upcoming">À venir</option>
            <option value="past">Passés</option>
          </select>
        </label>
        <button type="submit" className="admin-dash__btn admin-dash__btn--primary">
          Filtrer
        </button>
      </form>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Événement</th>
              <th>Date</th>
              <th>Lieu</th>
              <th>Statut</th>
              <th>Vues</th>
              <th>Clics billetterie</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-dash__muted">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-dash__muted">
                  Aucun événement.{" "}
                  <Link href="/admin/evenements/nouveau">Créer le premier</Link>
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const past = eventIsPast(row.startsAt, row.endsAt);
                return (
                  <tr
                    key={row.id}
                    className="admin-dash__table-row--click"
                    onClick={() => router.push(`/admin/evenements/${row.id}`)}
                  >
                    <td>
                      <div className="admin-sub__user">
                        <span
                          className="admin-mag__thumb admin-mag__thumb--landscape"
                          aria-hidden
                        >
                          {row.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.coverUrl} alt="" />
                          ) : (
                            <span className="admin-mag__thumb-empty">—</span>
                          )}
                        </span>
                        <div className="admin-sub__user-meta">
                          <strong>{row.title}</strong>
                          <span className="admin-dash__muted">
                            {EVENT_TYPE_LABELS[row.type]} ·{" "}
                            {EVENT_FORMAT_LABELS[row.format]}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {formatEventDateRange(row.startsAt, row.endsAt)}
                      {past ? (
                        <span className="admin-dash__muted"> · passé</span>
                      ) : null}
                    </td>
                    <td>{eventPlaceLabel(row)}</td>
                    <td>
                      <span
                        className={
                          row.status === "PUBLISHED"
                            ? "admin-mag__badge admin-mag__badge--on"
                            : "admin-mag__badge admin-sub__badge--pending"
                        }
                      >
                        {row.status === "PUBLISHED" ? "Publié" : "Brouillon"}
                      </span>
                    </td>
                    <td>{formatCount(row.viewCount)}</td>
                    <td>
                      {row.ticketUrl ? formatCount(row.ticketClicks) : "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="admin-dash__row-actions">
                        <Link
                          href={`/admin/evenements/${row.id}`}
                          className="admin-dash__icon-action admin-dash__icon-action--edit"
                          aria-label="Modifier"
                          title="Modifier"
                        >
                          <Pencil size={16} strokeWidth={2} />
                        </Link>
                        <Link
                          href={`/admin/evenements/statistiques?eventId=${row.id}`}
                          className="admin-dash__icon-action"
                          aria-label="Statistiques"
                          title="Statistiques"
                        >
                          <BarChart3 size={16} strokeWidth={2} />
                        </Link>
                        {row.status === "PUBLISHED" ? (
                          <a
                            href={`/evenements/${row.slug}`}
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
                );
              })
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
        title="Supprimer l’événement"
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
      >
        <div className="admin-delete-confirm">
          <div className="admin-delete-confirm__icon" aria-hidden>
            <Trash2 size={22} strokeWidth={2} />
          </div>
          <p className="admin-delete-confirm__lead">
            Cette action est <strong>définitive</strong> : la fiche et ses
            statistiques seront supprimées.
          </p>
          {pendingDelete ? (
            <div className="admin-delete-confirm__target">
              <span className="admin-delete-confirm__label">Événement</span>
              <strong className="admin-delete-confirm__title">
                {pendingDelete.title}
              </strong>
              <span className="admin-delete-confirm__slug">
                {formatEventDateRange(pendingDelete.startsAt, pendingDelete.endsAt)}
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

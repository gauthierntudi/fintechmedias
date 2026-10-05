"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Ban,
  BarChart3,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminNewsletterApi,
  type AdminNewsletterSendItem,
  type AdminNewsletterSendStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TAKE = 20;

const STATUS_LABEL: Record<AdminNewsletterSendStatus, string> = {
  PENDING: "En attente",
  SENDING: "En cours",
  SENT: "Envoyé",
  SKIPPED: "Ignoré",
  FAILED: "Échec",
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

type KpiCard = {
  key: string;
  label: string;
  value: string;
  color: "teal" | "green" | "gold" | "coral" | "blue" | "violet";
  icon: LucideIcon;
  active: boolean;
  interactive: boolean;
  onSelect?: () => void;
};

function statusClass(status: AdminNewsletterSendStatus): string {
  if (status === "SENT") return "admin-mag__badge";
  if (status === "FAILED") return "admin-mag__badge admin-sub__badge--expired";
  if (status === "PENDING" || status === "SENDING")
    return "admin-mag__badge admin-sub__badge--pending";
  return "admin-mag__badge";
}

export default function AdminNewsletterReportPage() {
  const [items, setItems] = useState<AdminNewsletterSendItem[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [status, setStatus] = useState<"" | AdminNewsletterSendStatus>("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    pending: number;
    sending: number;
    sent: number;
    skipped: number;
    failed: number;
    outbox: {
      dailyLimit: number;
      sentToday: number;
      remainingToday: number;
      sendingEnabled?: boolean;
    };
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminNewsletterApi.listSends({
        q: q || undefined,
        status: status || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement des envois",
      );
    } finally {
      setLoading(false);
    }
  }, [q, status, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSkip(0);
    setQ(qDraft.trim());
  }

  const outbox = summary?.outbox;
  const sendingEnabled = outbox?.sendingEnabled === true;
  const totalQueued = summary
    ? summary.pending +
      summary.sending +
      summary.sent +
      summary.skipped +
      summary.failed
    : 0;

  function selectStatus(next: "" | AdminNewsletterSendStatus): void {
    setSkip(0);
    setStatus(next);
  }

  const cards: KpiCard[] = [
    {
      key: "total",
      label: "Total",
      value: summary ? formatCount(totalQueued) : "—",
      color: "teal",
      icon: Mail,
      active: status === "",
      interactive: true,
      onSelect: () => selectStatus(""),
    },
    {
      key: "sent",
      label: "Envoyés",
      value: summary ? formatCount(summary.sent) : "—",
      color: "green",
      icon: CheckCircle2,
      active: status === "SENT",
      interactive: true,
      onSelect: () => selectStatus("SENT"),
    },
    {
      key: "pending",
      label: "En attente",
      value: summary ? formatCount(summary.pending) : "—",
      color: "gold",
      icon: Clock3,
      active: status === "PENDING",
      interactive: true,
      onSelect: () => selectStatus("PENDING"),
    },
    {
      key: "failed",
      label: "Échecs",
      value: summary ? formatCount(summary.failed) : "—",
      color: "coral",
      icon: Ban,
      active: status === "FAILED",
      interactive: true,
      onSelect: () => selectStatus("FAILED"),
    },
    {
      key: "today",
      label: "Aujourd’hui",
      value: outbox
        ? `${formatCount(outbox.sentToday)}/${formatCount(outbox.dailyLimit)}`
        : "—",
      color: "blue",
      icon: BarChart3,
      active: false,
      interactive: false,
    },
    {
      key: "remaining",
      label: "Restant aujourd’hui",
      value: outbox ? formatCount(outbox.remainingToday) : "—",
      color: "violet",
      icon: Inbox,
      active: false,
      interactive: false,
    },
  ];

  return (
    <div>
      <header className="admin-dash__header">
        <div>
          <h1>Rapport emailing</h1>
          <p className="admin-dash__muted">
            Chaque nouvel article publié crée un e-mail par inscrit actif. Le
            mail met en avant cet article, plus jusqu’à 3 autres textes récents
            (4 au total). Envois{" "}
            <strong>{sendingEnabled ? "activés" : "en pause"}</strong>
            {summary?.sending
              ? ` · ${formatCount(summary.sending)} en cours`
              : ""}
            .
          </p>
        </div>
        <div className="admin-dash__header-actions">
          <Link href="/admin/newsletter" className="admin-dash__btn">
            Inscriptions
          </Link>
        </div>
      </header>

      <section
        className="admin-dash__kpis-row"
        aria-label="Statistiques emailing"
        style={{ ["--kpi-count" as string]: String(cards.length) }}
      >
        {cards.map((card) => (
          <article
            key={card.key}
            role={card.interactive ? "button" : undefined}
            tabIndex={card.interactive ? 0 : undefined}
            aria-pressed={card.interactive ? card.active : undefined}
            className={cn(
              "snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid",
              `admin-dash__kpi-vivid--${card.color}`,
              card.active && "admin-dash__kpi-vivid--active",
            )}
            onClick={card.interactive ? card.onSelect : undefined}
            onKeyDown={
              card.interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      card.onSelect?.();
                    }
                  }
                : undefined
            }
          >
            <p className="snow-dash__kpi-label">
              <card.icon size={14} strokeWidth={2} aria-hidden /> {card.label}
            </p>
            <p className="snow-dash__kpi-value">{card.value}</p>
          </article>
        ))}
      </section>

      <form className="admin-dash__filters" onSubmit={onSearch}>
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            type="search"
            placeholder="E-mail ou titre d’article…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | AdminNewsletterSendStatus);
              setSkip(0);
            }}
          >
            <option value="">Tous</option>
            <option value="SENT">Envoyés</option>
            <option value="PENDING">En attente</option>
            <option value="SENDING">En cours</option>
            <option value="FAILED">Échecs</option>
            <option value="SKIPPED">Ignorés</option>
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
              <th>Destinataire</th>
              <th>Article</th>
              <th>Statut</th>
              <th>Envoyé le</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Aucun envoi pour ce filtre. Les mails test ne figurent pas
                  ici.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.email}</strong>
                  </td>
                  <td>
                    {row.article.slug ? (
                      <Link
                        href={`/article/${encodeURIComponent(row.article.slug)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.article.title}
                      </Link>
                    ) : (
                      row.article.title
                    )}
                  </td>
                  <td>
                    <span className={statusClass(row.status)}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    {row.status === "FAILED" && row.lastError ? (
                      <p className="admin-dash__muted" title={row.lastError}>
                        {row.lastError}
                      </p>
                    ) : null}
                  </td>
                  <td className="admin-dash__muted">
                    {formatWhen(row.sentAt)}
                  </td>
                  <td className="admin-dash__muted">
                    {formatWhen(row.createdAt)}
                    {row.attempts > 0 ? ` · ${row.attempts} essai(s)` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        total={total}
        take={TAKE}
        skip={skip}
        onSkipChange={setSkip}
      />
    </div>
  );
}

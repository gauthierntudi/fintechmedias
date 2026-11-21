"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import {
  adminEventsApi,
  type AdminEventStats,
} from "@/lib/api";
import { formatEventDateRange } from "@/lib/events";

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

export function AdminEventStatsView({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<AdminEventStats | null>(null);
  const [all, setAll] = useState<AdminEventStats["events"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminEventsApi.stats(eventId),
      eventId ? adminEventsApi.stats() : Promise.resolve(null),
    ])
      .then(([scoped, global]) => {
        if (cancelled) return;
        setStats(scoped);
        setAll((global ?? scoped).events);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Erreur statistiques"),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const current = eventId ? stats?.events[0] : undefined;
  const max = useMemo(
    () => Math.max(1, ...(stats?.series ?? []).map((d) => d.views)),
    [stats],
  );

  return (
    <div className="admin-event-stats">
      <header className="admin-dash__header">
        <div>
          <Link href="/admin/evenements" className="admin-article-page__back">
            <ArrowLeft size={16} aria-hidden /> Retour aux événements
          </Link>
          <h1>Statistiques événements</h1>
          <p>
            Visibilité des fiches : vues et clics vers la billetterie externe.
          </p>
        </div>
        <label className="admin-dash__field admin-event-stats__picker">
          <span>Événement</span>
          <select
            value={eventId ?? ""}
            onChange={(e) =>
              router.push(
                e.target.value
                  ? `/admin/evenements/statistiques?eventId=${e.target.value}`
                  : "/admin/evenements/statistiques",
              )
            }
          >
            <option value="">Tous les événements</option>
            {all.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading && !stats ? (
        <p className="admin-dash__muted">Chargement…</p>
      ) : stats ? (
        <>
          {current ? (
            <p className="admin-event-stats__scope">
              <strong>{current.title}</strong> ·{" "}
              {formatEventDateRange(current.startsAt, null)}
              {current.city ? ` · ${current.city}` : ""} ·{" "}
              <Link href={`/admin/evenements/${current.id}`}>Modifier</Link>
            </p>
          ) : null}

          <section
            className="admin-dash__kpis-row"
            style={{ ["--kpi-count" as string]: "4" }}
            aria-label="Totaux"
          >
            {[
              { label: "Vues (total)", value: stats.totals.views, color: "teal" },
              { label: "Vues (30 j)", value: stats.totals.views30d, color: "green" },
              {
                label: "Clics billetterie (total)",
                value: stats.totals.ticketClicks,
                color: "blue",
              },
              {
                label: "Clics billetterie (30 j)",
                value: stats.totals.ticketClicks30d,
                color: "violet",
              },
            ].map((k) => (
              <article
                key={k.label}
                className={`snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid admin-dash__kpi-vivid--${k.color}`}
              >
                <p className="snow-dash__kpi-label">{k.label}</p>
                <p className="snow-dash__kpi-value">{fmt(k.value)}</p>
              </article>
            ))}
          </section>

          <section className="admin-dash__panel admin-event-stats__chart">
            <div className="admin-dash__panel-head">
              <h2>30 derniers jours</h2>
              <span className="admin-event-stats__legend">
                <i className="is-views" /> Vues <i className="is-clicks" /> Clics
                billetterie
              </span>
            </div>
            <div
              className="admin-event-stats__bars"
              role="img"
              aria-label={`Vues sur 30 jours : ${fmt(stats.totals.views30d)}`}
            >
              {stats.series.map((d) => (
                <div
                  key={d.day}
                  className="admin-event-stats__bar"
                  title={`${dayLabel(d.day)} — ${fmt(d.views)} vue(s), ${fmt(d.ticketClicks)} clic(s)`}
                >
                  <span
                    className="is-views"
                    style={{ height: `${(d.views / max) * 100}%` }}
                  />
                  <span
                    className="is-clicks"
                    style={{ height: `${(d.ticketClicks / max) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="admin-event-stats__axis" aria-hidden>
              <span>{dayLabel(stats.series[0]!.day)}</span>
              <span>{dayLabel(stats.series[stats.series.length - 1]!.day)}</span>
            </div>
          </section>

          {!eventId ? (
            <div className="admin-dash__table-wrap">
              <table className="admin-dash__table">
                <thead>
                  <tr>
                    <th>Événement</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Vues</th>
                    <th>Clics billetterie</th>
                    <th>Taux de clic</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.events.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-dash__muted">
                        Aucun événement.
                      </td>
                    </tr>
                  ) : (
                    stats.events.map((e) => (
                      <tr
                        key={e.id}
                        className="admin-dash__table-row--click"
                        onClick={() =>
                          router.push(`/admin/evenements/statistiques?eventId=${e.id}`)
                        }
                      >
                        <td>
                          <strong>{e.title}</strong>
                        </td>
                        <td>{formatEventDateRange(e.startsAt, null)}</td>
                        <td>{e.status === "PUBLISHED" ? "Publié" : "Brouillon"}</td>
                        <td>{fmt(e.views)}</td>
                        <td>{e.hasTicketing ? fmt(e.ticketClicks) : "—"}</td>
                        <td>{e.hasTicketing ? `${e.clickRate} %` : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

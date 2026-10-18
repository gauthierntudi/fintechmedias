"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { AdminDatePicker } from "@/components/admin/admin-date-picker";
import { AdminModal } from "@/components/admin/admin-modal";
import { ImageCropper } from "@/components/site/avatar-cropper";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import {
  adminAdsApi,
  type AdminAd,
  type AdminAdRate,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TAKE = 12;

const PLACEMENTS: { value: string; label: string; dimensions: string }[] = [
  { value: "pub-header", label: "Header", dimensions: "3456×502" },
  { value: "pub-body-1", label: "Corps 1", dimensions: "1456×180" },
  { value: "pub-body-2", label: "Corps 2", dimensions: "1920×400" },
  { value: "pub-body-3", label: "Corps 3", dimensions: "1456×180" },
  { value: "pub-body-sidebar-1", label: "Sidebar 1", dimensions: "768×1024" },
  { value: "pub-body-sidebar-2", label: "Sidebar 2", dimensions: "672×400" },
  { value: "pub-sidebar-1", label: "Article, à lire aussi", dimensions: "672×560" },
  { value: "pub-footer", label: "Pied de page", dimensions: "3456×502" },
  { value: "pub-float", label: "Flottant", dimensions: "512×562" },
  { value: "pub-modal", label: "Fenêtre modale", dimensions: "1024×768" },
];

const FORMAT_LABEL: Record<string, string> = {
  RECTANGLE: "Rectangle",
  PORTRAIT: "Portrait",
  LARGE_PORTRAIT: "Grand portrait",
  LARGE_RECTANGLE: "Grand rectangle",
  PAYSAGE_SMALL: "Paysage étroit",
  PAYSAGE_MEDIUM: "Paysage moyen",
  PAYSAGE_LARGE: "Paysage large",
};

const VALIDATION_LABEL: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validée",
  REJECTED: "Refusée",
};

const PAYMENT_LABEL: Record<string, string> = {
  FREE: "Gratuit",
  PAID: "Payée",
  PENDING: "Paiement en attente",
};

const DIFFUSION_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ENDED: "Terminée",
};

function placementLabel(value: string | null) {
  if (!value) return "Sans emplacement";
  return PLACEMENTS.find((item) => item.value === value)?.label ?? value;
}

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function isPast(iso: string) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return iso < `${now.getFullYear()}-${month}-${day}`;
}

function localDay(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function statusClass(kind: string) {
  if (kind === "APPROVED" || kind === "ACTIVE" || kind === "PAID" || kind === "FREE") {
    return "admin-ads__status admin-ads__status--ok";
  }
  if (kind === "PENDING") return "admin-ads__status admin-ads__status--wait";
  return "admin-ads__status admin-ads__status--no";
}

export default function AdminAdsPage() {
  const { admin } = useAdminAuth();
  const canLock = admin?.role === "SUPERADMIN";
  const [tab, setTab] = useState<"campaigns" | "rates">("campaigns");
  const [items, setItems] = useState<AdminAd[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    pending: 0,
    approved: 0,
    active: 0,
    revenue: 0,
  });
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [validation, setValidation] = useState("");
  const [payment, setPayment] = useState("");
  const [diffusion, setDiffusion] = useState("");
  const [placement, setPlacement] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminAd | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminAd | null>(null);
  const [refusing, setRefusing] = useState<AdminAd | null>(null);
  const [reason, setReason] = useState("");
  const [rates, setRates] = useState<AdminAdRate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAdsApi.list({
        q: q || undefined,
        validation: validation || undefined,
        payment: payment || undefined,
        diffusion: diffusion || undefined,
        placement: placement || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [diffusion, payment, placement, q, skip, validation]);

  const loadRates = useCallback(async () => {
    try {
      const res = await adminAdsApi.rates();
      setRates(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tarifs indisponibles");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "rates") void loadRates();
  }, [loadRates, tab]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setSkip(0);
    setQ(qDraft.trim());
  }

  async function run(task: () => Promise<void>, success: string) {
    setSaving(true);
    try {
      await task();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setSaving(false);
    }
  }

  const cards = [
    { label: "En attente", value: String(summary.pending), color: "gold" },
    { label: "Validées", value: String(summary.approved), color: "green" },
    { label: "En diffusion", value: String(summary.active), color: "teal" },
    { label: "Recettes", value: money(summary.revenue), color: "blue" },
  ];

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Publicité</h1>
          <p>
            Campagnes des emplacements du site. Celles dont la période est
            passée restent dans cette liste, sans s’afficher sur le site.
          </p>
        </div>
      </header>

      <div className="admin-ads__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "campaigns"}
          className={cn(
            "admin-dash__btn",
            tab === "campaigns" && "admin-dash__btn--primary",
          )}
          onClick={() => setTab("campaigns")}
        >
          Campagnes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rates"}
          className={cn(
            "admin-dash__btn",
            tab === "rates" && "admin-dash__btn--primary",
          )}
          onClick={() => setTab("rates")}
        >
          Tarifs
        </button>
        {tab === "campaigns" ? (
          <button
            type="button"
            className="admin-dash__btn admin-dash__btn--primary admin-ads__create"
            onClick={() => setEditing("new")}
          >
            <Plus size={16} aria-hidden /> Nouvelle publicité
          </button>
        ) : null}
      </div>

      {tab === "campaigns" ? (
        <>
          <section className="admin-dash__kpis-row" aria-label="Synthèse publicitaire">
            {cards.map((card) => (
              <article
                key={card.label}
                className={cn(
                  "snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid",
                  `admin-dash__kpi-vivid--${card.color}`,
                )}
              >
                <p className="snow-dash__kpi-label">{card.label}</p>
                <p className="snow-dash__kpi-value">{card.value}</p>
              </article>
            ))}
          </section>

          <form className="admin-dash__filters admin-ads__filters" onSubmit={onSearch}>
            <label className="admin-dash__field">
              <span>Recherche</span>
              <input
                type="search"
                placeholder="Titre…"
                value={qDraft}
                onChange={(event) => setQDraft(event.target.value)}
              />
            </label>
            <label className="admin-dash__field">
              <span>Validation</span>
              <select
                value={validation}
                onChange={(event) => {
                  setSkip(0);
                  setValidation(event.target.value);
                }}
              >
                <option value="">Toutes</option>
                <option value="PENDING">En attente</option>
                <option value="APPROVED">Validées</option>
                <option value="REJECTED">Refusées</option>
              </select>
            </label>
            <label className="admin-dash__field">
              <span>Paiement</span>
              <select
                value={payment}
                onChange={(event) => {
                  setSkip(0);
                  setPayment(event.target.value);
                }}
              >
                <option value="">Tous</option>
                <option value="FREE">Gratuit</option>
                <option value="PAID">Payées</option>
                <option value="PENDING">En attente</option>
              </select>
            </label>
            <label className="admin-dash__field">
              <span>Diffusion</span>
              <select
                value={diffusion}
                onChange={(event) => {
                  setSkip(0);
                  setDiffusion(event.target.value);
                }}
              >
                <option value="">Toutes</option>
                <option value="ACTIVE">Actives</option>
                <option value="INACTIVE">Inactives</option>
                <option value="ENDED">Terminées</option>
              </select>
            </label>
            <label className="admin-dash__field">
              <span>Emplacement</span>
              <select
                value={placement}
                onChange={(event) => {
                  setSkip(0);
                  setPlacement(event.target.value);
                }}
              >
                <option value="">Tous</option>
                {PLACEMENTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
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
                  <th>Campagne</th>
                  <th>Emplacement</th>
                  <th>Période</th>
                  <th>Statut</th>
                  <th>Mesures</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-dash__muted">
                      Chargement…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-dash__muted">
                      Aucune publicité.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="admin-sub__user">
                          <span className="admin-mag__thumb" aria-hidden>
                            {row.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.imageUrl} alt="" />
                            ) : (
                              <span className="admin-mag__thumb-empty">—</span>
                            )}
                          </span>
                          <div className="admin-sub__user-meta">
                            <strong>{row.title}</strong>
                            <span className="admin-dash__muted">
                              {FORMAT_LABEL[row.format] ?? row.format}
                              {row.isLocked ? " · verrouillée" : ""}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{placementLabel(row.placement)}</td>
                      <td>
                        <div className="admin-ads__period">
                          <span>
                            {formatDay(row.startsOn)} – {formatDay(row.endsOn)}
                          </span>
                          {isPast(row.endsOn) ? (
                            <span className="admin-ads__status admin-ads__status--wait">
                              Passée
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="admin-ads__statuses">
                          <span className={statusClass(row.validationStatus)}>
                            {VALIDATION_LABEL[row.validationStatus]}
                          </span>
                          <span className={statusClass(row.diffusionStatus)}>
                            {DIFFUSION_LABEL[row.diffusionStatus]}
                          </span>
                          <span className={statusClass(row.paymentStatus)}>
                            {PAYMENT_LABEL[row.paymentStatus]}
                          </span>
                        </div>
                        {row.refusalReason ? (
                          <p className="admin-dash__muted">{row.refusalReason}</p>
                        ) : null}
                      </td>
                      <td>
                        {row.impressions} vues
                        <br />
                        {row.clicks} clics
                        <br />
                        {money(row.amountPaid)}
                      </td>
                      <td>
                        <div className="admin-ads__actions">
                          {row.validationStatus === "PENDING" ? (
                            <button
                              type="button"
                              className="admin-dash__icon-action admin-dash__icon-action--publish"
                              aria-label="Valider"
                              title="Valider"
                              disabled={saving}
                              onClick={() =>
                                void run(
                                  () => adminAdsApi.validate(row.id).then(() => undefined),
                                  "Publicité validée",
                                )
                              }
                            >
                              <Check size={16} strokeWidth={2} />
                            </button>
                          ) : null}
                          {row.validationStatus !== "REJECTED" ? (
                            <button
                              type="button"
                              className="admin-dash__icon-action admin-dash__icon-action--disable"
                              aria-label="Refuser"
                              title="Refuser"
                              disabled={saving}
                              onClick={() => {
                                setReason("");
                                setRefusing(row);
                              }}
                            >
                              <X size={16} strokeWidth={2} />
                            </button>
                          ) : null}
                          {row.diffusionStatus === "ACTIVE" ? (
                            <button
                              type="button"
                              className="admin-dash__icon-action admin-dash__icon-action--unpublish"
                              aria-label="Mettre en pause"
                              title="Mettre en pause"
                              disabled={saving}
                              onClick={() =>
                                void run(
                                  () => adminAdsApi.deactivate(row.id).then(() => undefined),
                                  "Diffusion mise en pause",
                                )
                              }
                            >
                              <Pause size={16} strokeWidth={2} />
                            </button>
                          ) : row.validationStatus === "APPROVED" ? (
                            <button
                              type="button"
                              className="admin-dash__icon-action admin-dash__icon-action--enable"
                              aria-label="Activer"
                              title="Activer"
                              disabled={saving}
                              onClick={() =>
                                void run(
                                  () => adminAdsApi.activate(row.id).then(() => undefined),
                                  "Diffusion activée",
                                )
                              }
                            >
                              <Play size={16} strokeWidth={2} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="admin-dash__icon-action admin-dash__icon-action--edit"
                            aria-label="Modifier"
                            title="Modifier"
                            onClick={() => setEditing(row)}
                          >
                            <Pencil size={16} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="admin-dash__icon-action admin-dash__icon-action--delete"
                            aria-label="Supprimer"
                            title="Supprimer"
                            disabled={saving}
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
            total={total}
            take={TAKE}
            skip={skip}
            onSkipChange={setSkip}
          />
        </>
      ) : (
        <RatesTable
          rates={rates}
          saving={saving}
          onSave={(id, input) =>
            run(async () => {
              await adminAdsApi.updateRate(id, input);
              await loadRates();
            }, "Tarif enregistré")
          }
        />
      )}

      {editing ? (
        <AdFormModal
          key={editing === "new" ? "new" : editing.id}
          open
          initial={editing === "new" ? null : editing}
          canLock={canLock}
          saving={saving}
          onClose={() => {
            if (!saving) setEditing(null);
          }}
          onSubmit={async (values) => {
            setSaving(true);
            try {
              const payload = {
                title: values.title,
                placement: values.placement,
                targetUrl: values.targetUrl,
                startsOn: values.startsOn,
                endsOn: values.endsOn,
                ...(canLock ? { isLocked: values.isLocked } : {}),
              };
              const saved =
                editing === "new"
                  ? await adminAdsApi.create(payload)
                  : await adminAdsApi.update(editing.id, payload);
              if (values.file) {
                await adminAdsApi.uploadImage(saved.id, values.file);
              }
              toast.success(
                editing === "new" ? "Publicité créée" : "Publicité mise à jour",
              );
              setEditing(null);
              await load();
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Enregistrement impossible",
              );
            } finally {
              setSaving(false);
            }
          }}
        />
      ) : null}

      <AdminModal
        open={Boolean(refusing)}
        title="Refuser la publicité"
        onClose={() => {
          if (!saving) setRefusing(null);
        }}
      >
        <form
          className="admin-ads__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!refusing) return;
            void run(async () => {
              await adminAdsApi.refuse(refusing.id, reason.trim());
              setRefusing(null);
            }, "Publicité refusée");
          }}
        >
          <label className="admin-dash__field">
            <span>Motif</span>
            <textarea
              required
              minLength={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Expliquez le refus"
            />
          </label>
          <div className="admin-delete-confirm__actions">
            <button
              type="button"
              className="admin-dash__btn"
              disabled={saving}
              onClick={() => setRefusing(null)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-dash__btn admin-dash__btn--primary"
              disabled={saving}
            >
              Refuser
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(pendingDelete)}
        title="Supprimer la publicité"
        onClose={() => {
          if (!saving) setPendingDelete(null);
        }}
      >
        <div className="admin-delete-confirm">
          <p className="admin-delete-confirm__lead">
            Cette campagne sera retirée des emplacements du site.
          </p>
          {pendingDelete ? (
            <strong className="admin-delete-confirm__title">{pendingDelete.title}</strong>
          ) : null}
          <div className="admin-delete-confirm__actions">
            <button
              type="button"
              className="admin-dash__btn"
              disabled={saving}
              onClick={() => setPendingDelete(null)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--danger"
              disabled={saving}
              onClick={() => {
                if (!pendingDelete) return;
                void run(async () => {
                  await adminAdsApi.remove(pendingDelete.id);
                  setPendingDelete(null);
                }, "Publicité supprimée");
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}

function RatesTable({
  rates,
  saving,
  onSave,
}: {
  rates: AdminAdRate[];
  saving: boolean;
  onSave: (
    id: string,
    input: Pick<AdminAdRate, "price7Days" | "price15Days" | "price30Days">,
  ) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, AdminAdRate>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(rates.map((row) => [row.id, row])));
  }, [rates]);

  return (
    <div className="admin-dash__table-wrap">
      <table className="admin-dash__table">
        <thead>
          <tr>
            <th>Format</th>
            <th>Dimensions</th>
            <th>7 jours</th>
            <th>15 jours</th>
            <th>30 jours</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 ? (
            <tr>
              <td colSpan={6} className="admin-dash__muted">
                Aucun tarif.
              </td>
            </tr>
          ) : (
            rates.map((row) => {
              const draft = drafts[row.id] ?? row;
              return (
                <tr key={row.id}>
                  <td>{FORMAT_LABEL[row.format] ?? row.format}</td>
                  <td>{row.dimensions}</td>
                  {(["price7Days", "price15Days", "price30Days"] as const).map((field) => (
                    <td key={field}>
                      <input
                        className="admin-ads__price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft[field]}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setDrafts((current) => ({
                            ...current,
                            [row.id]: {
                              ...(current[row.id] ?? row),
                              [field]: Number.isFinite(next) ? next : 0,
                            },
                          }));
                        }}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="admin-dash__btn admin-dash__btn--primary"
                      disabled={saving}
                      onClick={() =>
                        onSave(row.id, {
                          price7Days: draft.price7Days,
                          price15Days: draft.price15Days,
                          price30Days: draft.price30Days,
                        })
                      }
                    >
                      Enregistrer
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function parseFrame(dimensions: string) {
  const match = dimensions.match(/(\d+)\s*[×x]\s*(\d+)/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height, aspect: width / height };
}

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}

function matchesFrame(
  size: { width: number; height: number },
  frame: { aspect: number },
) {
  if (!size.width || !size.height) return false;
  const ratio = size.width / size.height;
  return Math.abs(ratio - frame.aspect) / frame.aspect < 0.02;
}

function AdImageDrop({
  preview,
  fileName,
  dimensions,
  onFile,
  onCrop,
}: {
  preview: string | null;
  fileName: string | null;
  dimensions: string;
  onFile: (file: File) => void;
  onCrop?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(next: File | null) {
    if (!next) return;
    const okType =
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(next.type) ||
      /\.(jpe?g|png|webp|gif)$/i.test(next.name);
    if (!okType) {
      toast.error("Formats acceptés : JPG, PNG, WEBP, GIF");
      return;
    }
    if (next.size > 8_000_000) {
      toast.error("L’image dépasse 8 Mo");
      return;
    }
    onFile(next);
  }

  return (
    <div className="admin-ads__drop-wrap">
    <div
      className={cn(
        "admin-ads__drop",
        dragging && "is-active",
        preview && "is-filled",
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        take(event.dataTransfer.files?.[0] ?? null);
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={preview ? "Remplacer l’image" : "Ajouter une image"}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="admin-ads__drop-input"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          take(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="admin-ads__drop-preview" src={preview} alt="" />
      ) : (
        <span className="admin-ads__drop-empty">
          <ImagePlus strokeWidth={1.6} aria-hidden />
          <strong>{dragging ? "Déposez le visuel" : "Glissez le visuel ici"}</strong>
          <span>ou cliquez pour parcourir</span>
        </span>
      )}
      <span className="admin-ads__drop-meta">
        {fileName ? fileName : preview ? "Cliquer ou déposer pour remplacer" : "JPG, PNG, WEBP ou GIF · 8 Mo max"}
        {dimensions ? ` · ${dimensions}` : ""}
      </span>
    </div>
    {onCrop ? (
      <button type="button" className="admin-ads__drop-crop" onClick={onCrop}>
        Rogner
      </button>
    ) : null}
    </div>
  );
}

function AdFormModal({
  open,
  initial,
  canLock,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: AdminAd | null;
  canLock: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    placement: string;
    targetUrl: string;
    startsOn: string;
    endsOn: string;
    isLocked: boolean;
    file: File | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [placement, setPlacement] = useState(initial?.placement ?? "pub-header");
  const [targetUrl, setTargetUrl] = useState(initial?.targetUrl ?? "https://");
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? localDay());
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? localDay(7));
  const [isLocked, setIsLocked] = useState(initial?.isLocked ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const hint = PLACEMENTS.find((item) => item.value === placement);
  const frame = parseFrame(hint?.dimensions ?? "");

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function applyFile(next: File) {
    setFile(next);
    setPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  }

  function openCrop(next: File) {
    setCropSrc((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  }

  async function considerFile(next: File) {
    if (!frame || next.type === "image/gif") {
      applyFile(next);
      return;
    }
    try {
      const size = await readImageSize(next);
      if (matchesFrame(size, frame)) {
        applyFile(next);
        return;
      }
    } catch {
      /* le recadrage reste disponible */
    }
    openCrop(next);
  }

  return (
    <>
    <AdminModal
      open={open}
      wide
      title={initial ? "Modifier la publicité" : "Nouvelle publicité"}
      onClose={onClose}
    >
      <form
        className="admin-ads__form admin-ads__form--split"
        onSubmit={(event) => {
          event.preventDefault();
          if (!initial && !file) {
            toast.error("Choisissez une image");
            return;
          }
          void onSubmit({
            title: title.trim(),
            placement,
            targetUrl: targetUrl.trim(),
            startsOn,
            endsOn,
            isLocked,
            file,
          });
        }}
      >
        <div className="admin-ads__fields">
        <label className="admin-dash__field">
          <span>Titre</span>
          <input
            required
            minLength={2}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="admin-ads__pair">
          <label className="admin-dash__field">
            <span>Emplacement</span>
            <select
              required
              value={placement}
              onChange={(event) => setPlacement(event.target.value)}
            >
              {PLACEMENTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {hint ? (
              <span className="admin-dash__muted">Visuel {hint.dimensions}</span>
            ) : null}
          </label>
          <label className="admin-dash__field">
            <span>URL de destination</span>
            <input
              required
              type="url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
            />
          </label>
        </div>
        <div className="admin-ads__dates">
          <div className="admin-dash__field">
            <span>Début</span>
            <AdminDatePicker
              label="Début"
              value={startsOn}
              max={endsOn || undefined}
              clearable={false}
              hideLabel
              onChange={(next) => {
                if (next) setStartsOn(next);
              }}
            />
          </div>
          <div className="admin-dash__field">
            <span>Fin</span>
            <AdminDatePicker
              label="Fin"
              value={endsOn}
              min={startsOn || undefined}
              clearable={false}
              hideLabel
              onChange={(next) => {
                if (next) setEndsOn(next);
              }}
            />
          </div>
        </div>
        {canLock ? (
          <label className="admin-dash__switch">
            <span className="admin-dash__switch-label">
              Verrouiller cet emplacement pour cette publicité uniquement
            </span>
            <span className="admin-dash__switch-control">
              <input
                type="checkbox"
                className="admin-dash__switch-input"
                checked={isLocked}
                onChange={(event) => setIsLocked(event.target.checked)}
              />
              <span className="admin-dash__switch-track" aria-hidden />
            </span>
          </label>
        ) : null}
        <div className="admin-dash__field">
          <span>{initial ? "Remplacer l’image" : "Image"}</span>
          <AdImageDrop
            preview={preview}
            fileName={file?.name ?? null}
            dimensions={hint?.dimensions ?? ""}
            onFile={(next) => {
              void considerFile(next);
            }}
            onCrop={file ? () => openCrop(file) : undefined}
          />
        </div>
        </div>
        <div className="admin-delete-confirm__actions">
          <button type="button" className="admin-dash__btn" disabled={saving} onClick={onClose}>
            Annuler
          </button>
          <button
            type="submit"
            className="admin-dash__btn admin-dash__btn--primary"
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </AdminModal>
    {frame ? (
      <ImageCropper
        open={Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        aspect={frame.aspect}
        cropShape="rect"
        wide={frame.aspect > 1}
        output="auto"
        maxWidth={frame.width}
        maxHeight={frame.height}
        maxBytes={8_000_000}
        filePrefix="publicite"
        title="Recadrer le visuel"
        description={`Cadrez l’image au format ${hint?.dimensions ?? ""}.`}
        confirmLabel="Utiliser ce cadrage"
        onCancel={() => setCropSrc(null)}
        onConfirm={(cropped) => {
          applyFile(cropped);
          setCropSrc(null);
        }}
      />
    ) : null}
    </>
  );
}

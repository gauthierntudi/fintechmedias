"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminStatusOffersApi,
  type AdminStatusOffer,
  type AdminStatusOfferInput,
  type AdminStatusPass,
  type StatusOfferKind,
} from "@/lib/api";

const PASS_TAKE = 15;

type OfferDraft = {
  kind: StatusOfferKind;
  label: string;
  description: string;
  price: string;
  currency: string;
  statusLifetimeHours: number;
  quota: string;
  periodDays: string;
  isActive: boolean;
  sortOrder: string;
};

const LIFETIME_OPTIONS = [
  { value: 12, label: "12 heures" },
  { value: 24, label: "24 heures" },
  { value: 48, label: "48 heures" },
  { value: 72, label: "3 jours" },
  { value: 168, label: "7 jours" },
];

function emptyDraft(kind: StatusOfferKind): OfferDraft {
  return {
    kind,
    label: kind === "PASS" ? "Forfait Statuts" : "Publication unique",
    description: "",
    price: "",
    currency: "USD",
    statusLifetimeHours: 24,
    quota: kind === "PASS" ? "10" : "",
    periodDays: kind === "PASS" ? "30" : "",
    isActive: true,
    sortOrder: "0",
  };
}

function draftFrom(offer: AdminStatusOffer): OfferDraft {
  return {
    kind: offer.kind,
    label: offer.label,
    description: offer.description ?? "",
    price: String(offer.priceCents / 100),
    currency: offer.currency,
    statusLifetimeHours: offer.statusLifetimeHours,
    quota: offer.quota != null ? String(offer.quota) : "",
    periodDays: offer.periodDays != null ? String(offer.periodDays) : "",
    isActive: offer.isActive,
    sortOrder: String(offer.sortOrder),
  };
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function lifetimeLabel(hours: number): string {
  return hours % 24 === 0 && hours >= 48 ? `${hours / 24} j` : `${hours} h`;
}

export default function AdminStatusOffersPage() {
  const [offers, setOffers] = useState<AdminStatusOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminStatusOffer | "new" | null>(
    null,
  );
  const [draft, setDraft] = useState<OfferDraft>(emptyDraft("SINGLE"));
  const [passes, setPasses] = useState<AdminStatusPass[]>([]);
  const [passTotal, setPassTotal] = useState(0);
  const [passSkip, setPassSkip] = useState(0);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      setOffers((await adminStatusOffersApi.list()).items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPasses = useCallback(async () => {
    try {
      const res = await adminStatusOffersApi.passes({
        take: PASS_TAKE,
        skip: passSkip,
      });
      setPasses(res.items);
      setPassTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur forfaits");
    }
  }, [passSkip]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  useEffect(() => {
    void loadPasses();
  }, [loadPasses]);

  function openNew(kind: StatusOfferKind) {
    setDraft(emptyDraft(kind));
    setEditing("new");
  }

  function openEdit(offer: AdminStatusOffer) {
    setDraft(draftFrom(offer));
    setEditing(offer);
  }

  function patch(next: Partial<OfferDraft>) {
    setDraft((d) => ({ ...d, ...next }));
  }

  async function save() {
    const priceCents = Math.round(Number(draft.price.replace(",", ".")) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      toast.error("Prix invalide");
      return;
    }
    const isPass = draft.kind === "PASS";
    const periodDays = draft.periodDays ? Number(draft.periodDays) : null;
    if (isPass && !periodDays) {
      toast.error("Durée du forfait requise");
      return;
    }
    const input: AdminStatusOfferInput = {
      label: draft.label.trim(),
      description: draft.description.trim() || null,
      priceCents,
      currency: draft.currency.trim().toUpperCase() || "USD",
      statusLifetimeHours: draft.statusLifetimeHours,
      isActive: draft.isActive,
      sortOrder: Number(draft.sortOrder) || 0,
      ...(isPass
        ? { quota: draft.quota ? Number(draft.quota) : null, periodDays }
        : {}),
    };
    setSaving(true);
    try {
      if (editing === "new") {
        await adminStatusOffersApi.create({ ...input, kind: draft.kind });
        toast.success("Offre créée");
      } else if (editing) {
        await adminStatusOffersApi.update(editing.id, input);
        toast.success("Offre mise à jour");
      }
      setEditing(null);
      await loadOffers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    } finally {
      setSaving(false);
    }
  }

  async function remove(offer: AdminStatusOffer) {
    setSaving(true);
    try {
      const res = await adminStatusOffersApi.remove(offer.id);
      toast.success(
        res.deactivated
          ? "Offre déjà utilisée : désactivée (historique conservé)"
          : "Offre supprimée",
      );
      await loadOffers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    } finally {
      setSaving(false);
    }
  }

  const isPass = draft.kind === "PASS";

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <Link href="/admin/statuts" className="admin-dash__muted">
            <ArrowLeft size={14} aria-hidden /> Statuts
          </Link>
          <h1>Tarifs des statuts</h1>
          <p>
            Prix des statuts publiés par les abonnés : publication unique ou
            forfait (quota de statuts sur une période). Les statuts de
            l’équipe restent gratuits.
          </p>
        </div>
        <div className="admin-dash__row-actions">
          <button
            type="button"
            className="admin-dash__btn"
            onClick={() => openNew("SINGLE")}
          >
            <Plus size={16} aria-hidden /> Publication unique
          </button>
          <button
            type="button"
            className="admin-dash__btn admin-dash__btn--primary"
            onClick={() => openNew("PASS")}
          >
            <Plus size={16} aria-hidden /> Forfait
          </button>
        </div>
      </header>

      <div className="admin-status-offers">
        <div className="admin-dash__table-wrap">
          <table className="admin-dash__table">
            <thead>
              <tr>
                <th>Offre</th>
                <th>Type</th>
                <th>Prix</th>
                <th>Durée d’un statut</th>
                <th>Forfait</th>
                <th>Utilisation</th>
                <th>État</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && offers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-dash__muted">
                    Chargement…
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-dash__muted">
                    Aucune offre : les abonnés ne peuvent pas encore publier
                    de statut.
                  </td>
                </tr>
              ) : (
                offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <strong>{offer.label}</strong>
                      {offer.description ? (
                        <div className="admin-dash__muted">
                          {offer.description}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {offer.kind === "PASS" ? "Forfait" : "Publication unique"}
                    </td>
                    <td>{formatPrice(offer.priceCents, offer.currency)}</td>
                    <td>{lifetimeLabel(offer.statusLifetimeHours)}</td>
                    <td>
                      {offer.kind === "PASS"
                        ? `${offer.quota ?? "∞"} statuts · ${offer.periodDays} j`
                        : "—"}
                    </td>
                    <td>
                      {offer.kind === "PASS"
                        ? `${offer.passCount ?? 0} forfait(s)`
                        : `${offer.statusCount ?? 0} statut(s)`}
                    </td>
                    <td>
                      <span
                        className={`admin-mag__badge${offer.isActive ? " admin-mag__badge--on" : ""}`}
                      >
                        {offer.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-dash__row-actions">
                        <button
                          type="button"
                          className="admin-dash__icon-action admin-dash__icon-action--edit"
                          aria-label="Modifier"
                          title="Modifier"
                          disabled={saving}
                          onClick={() => openEdit(offer)}
                        >
                          <Pencil size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="admin-dash__icon-action admin-dash__icon-action--delete"
                          aria-label="Supprimer"
                          title="Supprimer (ou désactiver si déjà utilisée)"
                          disabled={saving}
                          onClick={() => void remove(offer)}
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

        <section>
          <h2>Forfaits vendus</h2>
          <div className="admin-dash__table-wrap">
            <table className="admin-dash__table">
              <thead>
                <tr>
                  <th>Abonné</th>
                  <th>Forfait</th>
                  <th>Utilisés</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {passes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-dash__muted">
                      Aucun forfait vendu.
                    </td>
                  </tr>
                ) : (
                  passes.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.subscriber.name}</strong>
                        <div className="admin-dash__muted">
                          {p.subscriber.email}
                        </div>
                      </td>
                      <td>{p.offer?.label ?? "—"}</td>
                      <td>
                        {p.usedCount} / {p.quota ?? "∞"}
                      </td>
                      <td>{formatDate(p.startsAt)}</td>
                      <td>{formatDate(p.expiresAt)}</td>
                      <td>
                        <span
                          className={`admin-mag__badge${p.active ? " admin-mag__badge--on" : " admin-sub__badge--expired"}`}
                        >
                          {p.active ? "Actif" : "Expiré"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AdminPagination
            total={passTotal}
            take={PASS_TAKE}
            skip={passSkip}
            onSkipChange={setPassSkip}
          />
        </section>
      </div>

      <AdminModal
        open={editing !== null}
        title={
          editing === "new"
            ? isPass
              ? "Nouveau forfait"
              : "Nouvelle offre de publication"
            : "Modifier l’offre"
        }
        onClose={() => {
          if (!saving) setEditing(null);
        }}
      >
        <form
          className="admin-status-reject"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="admin-dash__field">
            <span>Nom affiché</span>
            <input
              value={draft.label}
              maxLength={80}
              required
              disabled={saving}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </label>
          <label className="admin-dash__field">
            <span>Description (optionnel)</span>
            <input
              value={draft.description}
              maxLength={300}
              disabled={saving}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
          <div className="admin-status-offers__form">
            <label className="admin-dash__field">
              <span>Prix</span>
              <input
                inputMode="decimal"
                value={draft.price}
                placeholder="5"
                required
                disabled={saving}
                onChange={(e) => patch({ price: e.target.value })}
              />
            </label>
            <label className="admin-dash__field">
              <span>Devise</span>
              <select
                value={draft.currency}
                disabled={saving}
                onChange={(e) => patch({ currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
            </label>
            <label className="admin-dash__field">
              <span>Durée d’un statut</span>
              <select
                value={draft.statusLifetimeHours}
                disabled={saving}
                onChange={(e) =>
                  patch({ statusLifetimeHours: Number(e.target.value) })
                }
              >
                {LIFETIME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {isPass ? (
              <>
                <label className="admin-dash__field">
                  <span>Statuts inclus (vide = illimité)</span>
                  <input
                    inputMode="numeric"
                    value={draft.quota}
                    disabled={saving}
                    onChange={(e) => patch({ quota: e.target.value })}
                  />
                </label>
                <label className="admin-dash__field">
                  <span>Validité (jours)</span>
                  <input
                    inputMode="numeric"
                    value={draft.periodDays}
                    required
                    disabled={saving}
                    onChange={(e) => patch({ periodDays: e.target.value })}
                  />
                </label>
              </>
            ) : null}
            <label className="admin-dash__field">
              <span>Ordre</span>
              <input
                inputMode="numeric"
                value={draft.sortOrder}
                disabled={saving}
                onChange={(e) => patch({ sortOrder: e.target.value })}
              />
            </label>
          </div>
          <label className="admin-status-form__check">
            <input
              type="checkbox"
              checked={draft.isActive}
              disabled={saving}
              onChange={(e) => patch({ isActive: e.target.checked })}
            />
            Proposée aux abonnés
          </label>
          <div className="admin-sponsor-form__actions">
            <button
              type="button"
              className="admin-dash__btn"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
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
    </>
  );
}

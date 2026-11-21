"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { AdminModal } from "@/components/admin/admin-modal";
import { ImageCropper } from "@/components/site/avatar-cropper";
import {
  adminJobsApi,
  type AdminJobCompany,
  type JobCompanySectorName,
} from "@/lib/api";
import { JOB_COMPANY_SECTOR_LABELS, companyInitials } from "@/lib/jobs";

type Draft = {
  name: string;
  url: string;
  sector: JobCompanySectorName | "";
  headquarters: string;
  appStoreUrl: string;
  playStoreUrl: string;
};

function toDraft(c: AdminJobCompany): Draft {
  return {
    name: c.name,
    url: c.url ?? "",
    sector: c.sector ?? "",
    headquarters: c.headquarters ?? "",
    appStoreUrl: c.appStoreUrl ?? "",
    playStoreUrl: c.playStoreUrl ?? "",
  };
}

const opt = (v: string) => v.trim() || null;

/** Annuaire Fintech fintech — fiches créées à l’ajout des offres. */
export default function AdminJobCompaniesPage() {
  const [items, setItems] = useState<AdminJobCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminJobCompany | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await adminJobsApi.companies()).items);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement annuaire",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? items.filter((c) =>
          `${c.name} ${c.headquarters ?? ""}`.toLowerCase().includes(needle),
        )
      : items;
  }, [items, q]);

  function open(c: AdminJobCompany) {
    setEditing(c);
    setDraft(toDraft(c));
  }

  function close() {
    if (saving || uploading || cropSrc) return;
    setEditing(null);
    setDraft(null);
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function replace(updated: AdminJobCompany) {
    setItems((list) =>
      list.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
    );
    setEditing((e) => (e ? { ...e, ...updated } : e));
  }

  /** Fichier choisi → recadrage carré avant envoi. */
  function pickLogo(file: File | null) {
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast.error("Formats acceptés : JPG, PNG, WEBP");
      return;
    }
    if (file.size > 8_000_000) {
      toast.error("Image trop lourde (8 Mo max)");
      return;
    }
    setCropSrc((src) => {
      if (src) URL.revokeObjectURL(src);
      return URL.createObjectURL(file);
    });
  }

  function closeCrop() {
    setCropSrc((src) => {
      if (src) URL.revokeObjectURL(src);
      return null;
    });
  }

  function confirmCrop(file: File) {
    closeCrop();
    void onLogo(file);
  }

  async function onLogo(file: File | null) {
    if (!file || !editing) return;
    setUploading(true);
    try {
      replace(await adminJobsApi.uploadCompanyLogo(editing.id, file));
      toast.success("Logo mis à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec envoi du logo");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !draft) return;
    if (!draft.name.trim()) {
      toast.error("Indiquez le nom de l’entreprise");
      return;
    }
    setSaving(true);
    try {
      replace(
        await adminJobsApi.updateCompany(editing.id, {
          name: draft.name.trim(),
          url: opt(draft.url),
          sector: draft.sector || null,
          headquarters: opt(draft.headquarters),
          appStoreUrl: opt(draft.appStoreUrl),
          playStoreUrl: opt(draft.playStoreUrl),
        }),
      );
      toast.success("Fiche enregistrée");
      setEditing(null);
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <Link href="/admin/jobs" className="admin-article-page__back">
            <ArrowLeft size={16} aria-hidden />
            Retour aux offres
          </Link>
          <h1>Annuaire Fintech</h1>
          <p>
            Fiches créées automatiquement à l’ajout d’une offre. Seules les
            entreprises ayant une offre publiée apparaissent sur le site.
          </p>
        </div>
      </header>

      <div className="admin-dash__filters">
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            type="search"
            placeholder="Nom, ville…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Secteur</th>
              <th>Siège</th>
              <th>Liens</th>
              <th>Offres</th>
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
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-dash__muted">
                  Aucune entreprise.
                </td>
              </tr>
            ) : (
              shown.map((c) => (
                <tr
                  key={c.id}
                  className="admin-dash__table-row--click"
                  onClick={() => open(c)}
                >
                  <td>
                    <div className="admin-sub__user">
                      <span
                        className="admin-mag__thumb admin-job__logo-thumb"
                        aria-hidden
                        style={
                          c.logoUrl && c.logoBg
                            ? { background: c.logoBg }
                            : undefined
                        }
                      >
                        {c.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logoUrl} alt="" />
                        ) : (
                          <span className="admin-mag__thumb-empty">
                            {companyInitials(c.name)}
                          </span>
                        )}
                      </span>
                      <div className="admin-sub__user-meta">
                        <strong>{c.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.sector ? (
                      JOB_COMPANY_SECTOR_LABELS[c.sector]
                    ) : (
                      <span className="admin-dash__muted">À compléter</span>
                    )}
                  </td>
                  <td>
                    {c.headquarters ?? (
                      <span className="admin-dash__muted">—</span>
                    )}
                  </td>
                  <td>
                    {[
                      c.url ? "Site" : null,
                      c.appStoreUrl ? "App Store" : null,
                      c.playStoreUrl ? "Play Store" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || (
                      <span className="admin-dash__muted">—</span>
                    )}
                  </td>
                  <td>{c.jobs ?? 0}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="admin-dash__row-actions">
                      <button
                        type="button"
                        className="admin-dash__icon-action admin-dash__icon-action--edit"
                        aria-label="Modifier"
                        title="Modifier"
                        onClick={() => open(c)}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={Boolean(editing && draft)}
        title="Fiche entreprise"
        wide
        onClose={close}
      >
        {editing && draft ? (
          <form className="admin-dash__form" onSubmit={onSubmit}>
            <div className="admin-job__company">
              <div className="admin-dash__field admin-job__logo">
                <span className="admin-job__logo-head">Logo</span>
                <AdminDropzone
                  accept="image/jpeg,image/png,image/webp"
                  label={
                    uploading
                      ? "Envoi…"
                      : editing.logoUrl
                        ? "Remplacer le logo"
                        : "Déposer le logo"
                  }
                  hint="JPG, PNG ou WEBP — carré, 400 × 400 conseillé"
                  variant="image"
                  thumbRatio="square"
                  previewUrl={editing.logoUrl}
                  onFile={pickLogo}
                />
              </div>
              <div className="admin-job__company-fields">
                <label className="admin-dash__field">
                  <span>Nom</span>
                  <input
                    value={draft.name}
                    maxLength={160}
                    disabled={saving}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </label>
                <label className="admin-dash__field">
                  <span>Site web</span>
                  <input
                    type="url"
                    value={draft.url}
                    disabled={saving}
                    placeholder="https://…"
                    onChange={(e) => set("url", e.target.value)}
                  />
                </label>
                <label className="admin-dash__field">
                  <span>Secteur</span>
                  <select
                    value={draft.sector}
                    disabled={saving}
                    onChange={(e) =>
                      set("sector", e.target.value as JobCompanySectorName | "")
                    }
                  >
                    <option value="">Non précisé</option>
                    {(
                      Object.keys(
                        JOB_COMPANY_SECTOR_LABELS,
                      ) as JobCompanySectorName[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {JOB_COMPANY_SECTOR_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-dash__field">
                  <span>Siège</span>
                  <input
                    value={draft.headquarters}
                    maxLength={160}
                    disabled={saving}
                    placeholder="Ex. Kinshasa, RDC"
                    onChange={(e) => set("headquarters", e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="admin-dash__form-grid">
              <label className="admin-dash__field">
                <span>Lien App Store (si disponible)</span>
                <input
                  type="url"
                  value={draft.appStoreUrl}
                  disabled={saving}
                  placeholder="https://apps.apple.com/…"
                  onChange={(e) => set("appStoreUrl", e.target.value)}
                />
              </label>
              <label className="admin-dash__field">
                <span>Lien Play Store (si disponible)</span>
                <input
                  type="url"
                  value={draft.playStoreUrl}
                  disabled={saving}
                  placeholder="https://play.google.com/store/apps/…"
                  onChange={(e) => set("playStoreUrl", e.target.value)}
                />
              </label>
            </div>
            <p className="admin-dash__muted">
              Le nom, le logo et le site sont aussi mis à jour sur les{" "}
              {editing.jobs ?? 0} offre{(editing.jobs ?? 0) > 1 ? "s" : ""} de
              l’entreprise.
            </p>
            <div className="admin-delete-confirm__actions">
              <button
                type="button"
                className="admin-dash__btn admin-dash__btn--cancel-vivid"
                disabled={saving}
                onClick={close}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="admin-dash__btn admin-dash__btn--primary"
                disabled={saving || uploading}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        ) : null}
      </AdminModal>

      <ImageCropper
        open={Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        aspect={1}
        cropShape="rect"
        output="auto"
        minZoom={0.3}
        title="Recadrer le logo"
        description="Dézoomez pour faire tenir tout le logo dans le carré — il s’affiche sur fond blanc."
        confirmLabel="Valider"
        busyLabel="Recadrage…"
        filePrefix="entreprise"
        maxWidth={400}
        maxHeight={400}
        maxBytes={500_000}
        onCancel={closeCrop}
        onConfirm={confirmCrop}
      />
    </>
  );
}

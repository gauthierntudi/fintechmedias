"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ExternalLink, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import {
  adminHomeVideosApi,
  type AdminHomeVideo,
  type AdminHomeVideoInput,
} from "@/lib/api";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

type FormState = {
  youtubeId: string;
  title: string;
  subtitle: string;
  websiteUrl: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  youtubeId: "",
  title: "",
  subtitle: "",
  websiteUrl: "",
  isActive: true,
};

function toForm(row: AdminHomeVideo): FormState {
  return {
    youtubeId: row.youtubeId,
    title: row.title,
    subtitle: row.subtitle,
    websiteUrl: row.websiteUrl ?? "",
    isActive: row.isActive,
  };
}

export default function AdminHomeVideoPage() {
  const [items, setItems] = useState<AdminHomeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminHomeVideo | "new" | null>(null);
  const [draft, setDraft] = useState<FormState>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<AdminHomeVideo | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminHomeVideosApi.list();
      setItems(res.items);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement vidéos",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setDraft(EMPTY);
    setEditing("new");
  }

  function openEdit(row: AdminHomeVideo) {
    setDraft(toForm(row));
    setEditing(row);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const input: AdminHomeVideoInput = {
        youtubeId: draft.youtubeId.trim(),
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        websiteUrl: draft.websiteUrl.trim() || null,
        isActive: draft.isActive,
      };
      if (editing === "new") {
        await adminHomeVideosApi.create(input);
        toast.success("Vidéo ajoutée");
      } else if (editing) {
        await adminHomeVideosApi.update(editing.id, input);
        toast.success("Vidéo mise à jour");
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(row: AdminHomeVideo) {
    try {
      await adminHomeVideosApi.toggle(row.id);
      toast.success(row.isActive ? "Vidéo désactivée" : "Vidéo activée");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    }
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await adminHomeVideosApi.remove(pendingDelete.id);
      setPendingDelete(null);
      toast.success("Vidéo supprimée");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec suppression",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Vidéo accueil</h1>
          <p>
            Section YouTube promo de la page d’accueil (legacy{" "}
            <code>home_video</code>). La plus récente active est affichée.
          </p>
        </div>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          onClick={openNew}
        >
          <Plus size={16} aria-hidden /> Nouvelle vidéo
        </button>
      </header>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Aperçu</th>
              <th>Titre</th>
              <th>YouTube</th>
              <th>Statut</th>
              <th>Créée</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Chargement…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6}>Aucune vidéo.</td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <img
                      src={`https://i.ytimg.com/vi/${row.youtubeId}/mqdefault.jpg`}
                      alt=""
                      width={120}
                      height={68}
                      style={{
                        borderRadius: 6,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </td>
                  <td>
                    <strong>{row.title}</strong>
                    {row.subtitle ? (
                      <div className="admin-dash__muted">{row.subtitle}</div>
                    ) : null}
                  </td>
                  <td>
                    <a
                      href={`https://www.youtube.com/watch?v=${row.youtubeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-dash__link"
                    >
                      {row.youtubeId} <ExternalLink size={12} aria-hidden />
                    </a>
                  </td>
                  <td>
                    <span
                      className={
                        row.isActive
                          ? "admin-ads__status admin-ads__status--ok"
                          : "admin-ads__status admin-ads__status--no"
                      }
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>
                    <div className="admin-dash__row-actions">
                      <button
                        type="button"
                        className="admin-dash__icon-btn"
                        title="Activer / désactiver"
                        onClick={() => void onToggle(row)}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        type="button"
                        className="admin-dash__icon-btn"
                        title="Modifier"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="admin-dash__icon-btn"
                        title="Supprimer"
                        onClick={() => setPendingDelete(row)}
                      >
                        <Trash2 size={16} />
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
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing === "new" ? "Nouvelle vidéo" : "Modifier la vidéo"}
      >
        <form className="admin-dash__form" onSubmit={onSubmit}>
          <label className="admin-dash__field">
            <span>YouTube ID ou URL</span>
            <input
              required
              value={draft.youtubeId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, youtubeId: e.target.value }))
              }
              placeholder="8lJ9J3cRb9A ou https://youtu.be/…"
            />
          </label>
          <label className="admin-dash__field">
            <span>Titre</span>
            <input
              required
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
            />
          </label>
          <label className="admin-dash__field">
            <span>Sous-titre</span>
            <textarea
              rows={3}
              value={draft.subtitle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, subtitle: e.target.value }))
              }
            />
          </label>
          <label className="admin-dash__field">
            <span>Lien « En savoir plus »</span>
            <input
              type="url"
              value={draft.websiteUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, websiteUrl: e.target.value }))
              }
              placeholder="https://…"
            />
          </label>
          <label className="admin-dash__switch">
            <span className="admin-dash__switch-meta">
              <span className="admin-dash__switch-label">Active</span>
              <span className="admin-dash__switch-hint">
                Affichée sur l’accueil si c’est la plus récente active
              </span>
            </span>
            <span className="admin-dash__switch-control">
              <input
                type="checkbox"
                className="admin-dash__switch-input"
                checked={draft.isActive}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, isActive: e.target.checked }))
                }
              />
              <span className="admin-dash__switch-track" aria-hidden />
            </span>
          </label>
          <div className="admin-dash__form-actions">
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

      <AdminModal
        open={pendingDelete !== null}
        onClose={() => !saving && setPendingDelete(null)}
        title="Supprimer la vidéo ?"
      >
        <p>
          Supprimer « {pendingDelete?.title} » ? Cette action est irréversible.
        </p>
        <div className="admin-dash__form-actions">
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
            className="admin-dash__btn admin-dash__btn--primary"
            disabled={saving}
            onClick={() => void confirmRemove()}
          >
            Supprimer
          </button>
        </div>
      </AdminModal>
    </>
  );
}

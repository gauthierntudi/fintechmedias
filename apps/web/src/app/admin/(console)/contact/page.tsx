"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, MailOpen, MapPin } from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminContactApi,
  adminSettingsApi,
  type AdminContactMessage,
  type SiteContactSettings,
} from "@/lib/api";

const TAKE = 15;

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminContactPage() {
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState<SiteContactSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<AdminContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [readFilter, setReadFilter] = useState<"" | "1" | "0">("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminContactMessage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminSettingsApi
      .getContact()
      .then((res) => {
        if (cancelled) return;
        setAddress(res.address);
        setEmail(res.email);
        setPhone(res.phone);
        setSaved(res);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Impossible de charger les coordonnées",
        );
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminContactApi.list({
        q: q || undefined,
        read: readFilter || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setUnread(res.summary.unread);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement des messages",
      );
    } finally {
      setLoading(false);
    }
  }, [q, readFilter, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    !!saved &&
    (address.trim() !== saved.address ||
      email.trim() !== saved.email ||
      phone.trim() !== saved.phone);

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminSettingsApi.updateContact({
        address: address.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setAddress(res.address);
      setEmail(res.email);
      setPhone(res.phone);
      setSaved(res);
      setSettingsOpen(false);
      toast.success("Coordonnées enregistrées");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer",
      );
    } finally {
      setSaving(false);
    }
  }

  function openSettings() {
    if (saved) {
      setAddress(saved.address);
      setEmail(saved.email);
      setPhone(saved.phone);
    }
    setSettingsOpen(true);
  }

  function closeSettings() {
    if (saving) return;
    if (saved) {
      setAddress(saved.address);
      setEmail(saved.email);
      setPhone(saved.phone);
    }
    setSettingsOpen(false);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSkip(0);
    setQ(qDraft.trim());
  }

  async function openMessage(row: AdminContactMessage) {
    setSelected(row);
    if (row.isRead) return;
    try {
      const updated = await adminContactApi.setRead(row.id, true);
      setSelected(updated);
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUnread((n) => Math.max(0, n - 1));
    } catch {
      /* lecture optionnelle */
    }
  }

  return (
    <div>
      <header className="admin-dash__header">
        <div>
          <h1>Contact</h1>
          <p className="admin-dash__muted">
            Messages reçus via le formulaire — <strong>{unread}</strong> non
            lus
          </p>
        </div>
        <button
          type="button"
          className="admin-dash__cta"
          onClick={openSettings}
          disabled={settingsLoading}
        >
          <MapPin className="h-4 w-4" strokeWidth={2} aria-hidden />
          Coordonnées
        </button>
      </header>

      <form className="admin-dash__filters" onSubmit={onSearch}>
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            type="search"
            placeholder="Nom, e-mail, sujet…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={readFilter}
            onChange={(e) => {
              setReadFilter(e.target.value as "" | "1" | "0");
              setSkip(0);
            }}
          >
            <option value="">Tous</option>
            <option value="0">Non lus</option>
            <option value="1">Lus</option>
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
              <th>Expéditeur</th>
              <th>Sujet</th>
              <th>Statut</th>
              <th>Reçu le</th>
              <th>Actions</th>
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
                  Aucun message pour ce filtre.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="admin-sub__user-meta">
                      <strong>{row.name}</strong>
                      <span className="admin-dash__muted">{row.email}</span>
                    </div>
                  </td>
                  <td>{row.subject || "—"}</td>
                  <td>
                    <span
                      className={
                        row.isRead
                          ? "admin-mag__badge"
                          : "admin-mag__badge admin-sub__badge--pending"
                      }
                    >
                      {row.isRead ? "Lu" : "Non lu"}
                    </span>
                  </td>
                  <td className="admin-dash__muted">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td>
                    <div className="admin-dash__row-actions">
                      <button
                        type="button"
                        className="admin-dash__icon-btn"
                        onClick={() => void openMessage(row)}
                        aria-label="Lire le message"
                      >
                        <Eye className="h-4 w-4" strokeWidth={2} />
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

      <AdminModal
        open={settingsOpen}
        title="Coordonnées publiques"
        onClose={closeSettings}
      >
        <form className="admin-dash__form" onSubmit={onSaveSettings}>
          <label className="admin-dash__field">
            <span>Adresse</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={settingsLoading || saving}
              required
            />
          </label>
          <label className="admin-dash__field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={settingsLoading || saving}
              required
            />
          </label>
          <label className="admin-dash__field">
            <span>Téléphone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={settingsLoading || saving}
              required
            />
          </label>
          <button
            type="submit"
            className="admin-dash__btn admin-dash__btn--primary"
            disabled={settingsLoading || saving || !dirty}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(selected)}
        title={selected?.subject || "Message"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="admin-dash__form">
            <p>
              <strong>{selected.name}</strong>
              <br />
              <a href={`mailto:${selected.email}`}>{selected.email}</a>
            </p>
            <p className="admin-dash__muted">{formatWhen(selected.createdAt)}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{selected.message}</p>
            <p>
              <MailOpen className="h-4 w-4" strokeWidth={2} aria-hidden />{" "}
              {selected.isRead ? "Marqué comme lu" : "Non lu"}
            </p>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}

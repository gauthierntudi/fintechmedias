"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  ExternalLink,
  ImagePlus,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { AdminDatePicker } from "@/components/admin/admin-date-picker";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { AdminSponsorPicker } from "@/components/admin/admin-sponsor-picker";
import { AdminTimePicker } from "@/components/admin/admin-time-picker";
import { ImageCropper } from "@/components/site/avatar-cropper";
import {
  adminEventsApi,
  adminSponsorsApi,
  type AdminEvent,
  type AdminEventInput,
  type AdminSponsor,
  type EventFormatName,
  type EventStatusName,
  type EventTypeName,
} from "@/lib/api";
import {
  EVENT_CURRENCIES,
  EVENT_FORMAT_LABELS,
  EVENT_TYPE_LABELS,
  eventThemeVars,
} from "@/lib/events";

/** Les dates saisies sont en heure de Kinshasa (UTC+1, sans heure d’été). */
const KINSHASA_OFFSET = "+01:00";

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}:00${KINSHASA_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** `YYYY-MM-DDTHH:mm` → [date, heure] (parties vides si absentes). */
function splitLocal(value: string): [string, string] {
  const [date = "", time = ""] = value.split("T");
  return [date, time];
}

function joinLocal(date: string, time: string): string {
  return date || time ? `${date}T${time}` : "";
}

/** Même règle que l’API (events.service › slugify). */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Couleurs proposées pour la charte d’un événement. */
const THEME_PRESETS = [
  "#4ed319",
  "#0f62fe",
  "#7c3aed",
  "#e11d48",
  "#f59e0b",
  "#111827",
] as const;

type ProgrammeRow = {
  key: string;
  day: string;
  time: string;
  endTime: string;
  title: string;
  description: string;
  speakers: string;
};

type SpeakerRow = {
  key: string;
  id: string;
  name: string;
  role: string;
  organization: string;
  bio: string;
  photoKey: string | null;
  photoUrl: string | null;
};

type TierRow = {
  key: string;
  id: string;
  name: string;
  description: string;
  prices: Record<string, string>;
};

type SponsorRow = { sponsorId: string; tier: string };

type CoOrganizerRow = {
  key: string;
  id: string;
  name: string;
  url: string;
  logoKey: string | null;
  logoUrl: string | null;
  /** Fond détecté sur le logo à l’upload */
  logoBg: string | null;
};

type FormState = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  type: EventTypeName;
  format: EventFormatName;
  status: EventStatusName;
  startsAt: string;
  endsAt: string;
  organizer: string;
  organizerLogoKey: string | null;
  organizerLogoUrl: string | null;
  organizerLogoBg: string | null;
  coOrganizers: CoOrganizerRow[];
  city: string;
  country: string;
  venueName: string;
  venueAddress: string;
  mapUrl: string;
  onlineUrl: string;
  ticketUrl: string;
  /** #RRGGBB, vide = couleur du site */
  themeColor: string;
  programme: ProgrammeRow[];
  speakers: SpeakerRow[];
  tiers: TierRow[];
  sponsors: SponsorRow[];
};

function emptyForm(): FormState {
  return {
    title: "",
    slug: "",
    summary: "",
    description: "",
    type: "CONFERENCE",
    format: "IN_PERSON",
    status: "DRAFT",
    startsAt: "",
    endsAt: "",
    organizer: "Fintech Médias",
    organizerLogoKey: null,
    organizerLogoUrl: null,
    organizerLogoBg: null,
    coOrganizers: [],
    city: "Kinshasa",
    country: "RD Congo",
    venueName: "",
    venueAddress: "",
    mapUrl: "",
    onlineUrl: "",
    ticketUrl: "",
    themeColor: "",
    programme: [],
    speakers: [],
    tiers: [],
    sponsors: [],
  };
}

function fromEvent(e: AdminEvent): FormState {
  return {
    title: e.title,
    slug: e.slug,
    summary: e.summary ?? "",
    description: e.description ?? "",
    type: e.type,
    format: e.format,
    status: e.status,
    startsAt: isoToLocalInput(e.startsAt),
    endsAt: isoToLocalInput(e.endsAt),
    organizer: e.organizer ?? "",
    organizerLogoKey: e.organizerLogoKey,
    organizerLogoUrl: e.organizerLogoUrl,
    organizerLogoBg: e.organizerLogoBg ?? null,
    coOrganizers: e.coOrganizers.map((o) => ({
      key: uid(),
      id: o.id,
      name: o.name,
      url: o.url ?? "",
      logoKey: o.logoKey,
      logoUrl: o.logoUrl,
      logoBg: o.logoBg ?? null,
    })),
    city: e.city ?? "",
    country: e.country ?? "",
    venueName: e.venueName ?? "",
    venueAddress: e.venueAddress ?? "",
    mapUrl: e.mapUrl ?? "",
    onlineUrl: e.onlineUrl ?? "",
    ticketUrl: e.ticketUrl ?? "",
    themeColor: e.themeColor ?? "",
    programme: e.programme.map((p) => ({
      key: uid(),
      day: p.day ?? "",
      time: p.time,
      endTime: p.endTime ?? "",
      title: p.title,
      description: p.description ?? "",
      speakers: p.speakers.join(", "),
    })),
    speakers: e.speakers.map((s) => ({
      key: uid(),
      id: s.id,
      name: s.name,
      role: s.role ?? "",
      organization: s.organization ?? "",
      bio: s.bio ?? "",
      photoKey: s.photoKey,
      photoUrl: s.photoUrl,
    })),
    tiers: e.ticketTiers.map((t) => ({
      key: uid(),
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      prices: Object.fromEntries(
        t.prices.map((p) => [p.currency, String(p.amount)]),
      ),
    })),
    sponsors: e.sponsors.map((s) => ({ sponsorId: s.id, tier: s.tier ?? "" })),
  };
}

/** Lignes ajoutées puis laissées vides : ignorées à l’enregistrement. */
function isBlankProgramme(p: ProgrammeRow): boolean {
  return !p.title.trim() && !p.description.trim() && !p.speakers.trim();
}

function isBlankSpeaker(s: SpeakerRow): boolean {
  return (
    !s.name.trim() &&
    !s.role.trim() &&
    !s.organization.trim() &&
    !s.bio.trim() &&
    !s.photoKey
  );
}

function isBlankTier(t: TierRow): boolean {
  return (
    !t.name.trim() &&
    !t.description.trim() &&
    Object.values(t.prices).every((v) => !v?.trim())
  );
}

function toInput(form: FormState): AdminEventInput | string {
  const title = form.title.trim();
  if (title.length < 2) return "Le titre est obligatoire.";
  const startsAt = localInputToIso(form.startsAt);
  if (!startsAt) return "La date de début est obligatoire.";
  const endsAt = form.endsAt ? localInputToIso(form.endsAt) : null;
  if (form.endsAt && !endsAt) {
    return "Fin : indiquez la date et l’heure, ou laissez les deux vides.";
  }
  if (endsAt && endsAt < startsAt) return "La fin doit être après le début.";

  const programme = form.programme.filter((p) => !isBlankProgramme(p));
  const speakers = form.speakers.filter((sp) => !isBlankSpeaker(sp));
  const tierRows = form.tiers.filter((t) => !isBlankTier(t));

  for (const [i, p] of programme.entries()) {
    if (!p.title.trim())
      return `Programme : intitulé manquant (ligne ${i + 1}).`;
    if (!/^\d{2}:\d{2}$/.test(p.time)) {
      return `Programme : heure de début manquante (ligne ${i + 1}).`;
    }
  }
  for (const [i, s] of speakers.entries()) {
    if (!s.name.trim()) return `Intervenant ${i + 1} : nom manquant.`;
  }
  const tiers = [];
  for (const [i, t] of tierRows.entries()) {
    if (!t.name.trim()) return `Billet ${i + 1} : nom manquant.`;
    const prices = [];
    for (const currency of EVENT_CURRENCIES) {
      const raw = t.prices[currency]?.trim().replace(",", ".");
      if (!raw) continue;
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        return `Billet « ${t.name} » : prix ${currency} invalide.`;
      }
      prices.push({ currency, amount });
    }
    tiers.push({
      id: t.id,
      name: t.name.trim(),
      description: t.description.trim() || null,
      prices,
    });
  }

  const opt = (v: string) => v.trim() || null;
  return {
    title,
    slug: form.slug.trim() || undefined,
    summary: opt(form.summary),
    description: opt(form.description),
    type: form.type,
    format: form.format,
    status: form.status,
    startsAt,
    endsAt,
    organizer: opt(form.organizer),
    organizerLogoKey: form.organizerLogoKey,
    organizerLogoBg: form.organizerLogoKey ? form.organizerLogoBg : null,
    coOrganizers: form.coOrganizers
      .filter((o) => o.name.trim())
      .map((o) => ({
        id: o.id,
        name: o.name.trim(),
        url: opt(o.url),
        logoKey: o.logoKey,
        logoBg: o.logoKey ? o.logoBg : null,
      })),
    city: form.format === "ONLINE" ? null : opt(form.city),
    country: form.format === "ONLINE" ? null : opt(form.country),
    venueName: form.format === "ONLINE" ? null : opt(form.venueName),
    venueAddress: form.format === "ONLINE" ? null : opt(form.venueAddress),
    mapUrl: form.format === "ONLINE" ? null : opt(form.mapUrl),
    onlineUrl: form.format === "IN_PERSON" ? null : opt(form.onlineUrl),
    ticketUrl: opt(form.ticketUrl),
    themeColor: /^#[0-9a-f]{6}$/i.test(form.themeColor)
      ? form.themeColor
      : null,
    programme: programme.map((p) => ({
      day: p.day || null,
      time: p.time,
      endTime: p.endTime || null,
      title: p.title.trim(),
      description: opt(p.description),
      speakers: p.speakers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    })),
    speakers: speakers.map((s) => ({
      id: s.id,
      name: s.name.trim(),
      role: opt(s.role),
      organization: opt(s.organization),
      bio: opt(s.bio),
      photoKey: s.photoKey,
    })),
    ticketTiers: tiers,
    sponsors: form.sponsors.map((s) => ({
      sponsorId: s.sponsorId,
      tier: opt(s.tier),
    })),
  };
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function AdminEventForm({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(eventId);
  const [form, setForm] = useState<FormState>(emptyForm);
  /** Création : le slug suit le titre tant qu’il n’a pas été modifié à la main. */
  const [slugAuto, setSlugAuto] = useState(!isEdit);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<AdminSponsor[]>([]);
  const [uploadingSpeaker, setUploadingSpeaker] = useState<string | null>(null);
  /** "main" (organisateur) ou clé de ligne co-organisateur en cours d’upload */
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const [logoCrop, setLogoCrop] = useState<{
    target: string;
    src: string;
  } | null>(null);
  const [speakerCrop, setSpeakerCrop] = useState<{
    key: string;
    src: string;
  } | null>(null);

  useEffect(() => {
    void adminSponsorsApi
      .list({ take: 200 })
      .then((res) => setSponsors(res.items))
      .catch(() => setSponsors([]));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    adminEventsApi
      .get(eventId)
      .then((e) => {
        if (cancelled) return;
        setEvent(e);
        setForm(fromEvent(e));
        setCoverPreview(e.coverUrl);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "Événement introuvable",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickCover(file: File | null) {
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast.error("Formats acceptés : JPG, PNG, WEBP");
      return;
    }
    if (file.size > 8_000_000) {
      toast.error("Image trop lourde (8 Mo max)");
      return;
    }
    if (coverCropSrc) URL.revokeObjectURL(coverCropSrc);
    setCoverCropSrc(URL.createObjectURL(file));
  }

  function closeCoverCrop() {
    setCoverCropSrc((src) => {
      if (src) URL.revokeObjectURL(src);
      return null;
    });
  }

  function confirmCoverCrop(file: File) {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    closeCoverCrop();
  }

  function pickSpeakerPhoto(key: string, file: File | null) {
    if (!file || !eventId) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast.error("Formats acceptés : JPG, PNG, WEBP");
      return;
    }
    if (speakerCrop) URL.revokeObjectURL(speakerCrop.src);
    setSpeakerCrop({ key, src: URL.createObjectURL(file) });
  }

  function closeSpeakerCrop() {
    setSpeakerCrop((c) => {
      if (c) URL.revokeObjectURL(c.src);
      return null;
    });
  }

  async function uploadSpeakerPhoto(key: string, file: File) {
    if (!eventId) return;
    setUploadingSpeaker(key);
    try {
      const res = await adminEventsApi.uploadImage(eventId, file);
      setForm((f) => ({
        ...f,
        speakers: f.speakers.map((s) =>
          s.key === key ? { ...s, photoKey: res.key, photoUrl: res.url } : s,
        ),
      }));
      closeSpeakerCrop();
      toast.success("Photo ajoutée — pensez à enregistrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l’upload");
    } finally {
      setUploadingSpeaker(null);
    }
  }

  /** Logo d’organisateur : recadrage rond, transparence PNG conservée. */
  function pickOrganizerLogo(target: string, file: File | null) {
    if (!file || !eventId) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast.error("Formats acceptés : JPG, PNG, WEBP");
      return;
    }
    if (logoCrop) URL.revokeObjectURL(logoCrop.src);
    setLogoCrop({ target, src: URL.createObjectURL(file) });
  }

  function closeLogoCrop() {
    setLogoCrop((c) => {
      if (c) URL.revokeObjectURL(c.src);
      return null;
    });
  }

  async function uploadOrganizerLogo(target: string, file: File) {
    if (!eventId) return;
    setUploadingLogo(target);
    try {
      const res = await adminEventsApi.uploadImage(eventId, file);
      setForm((f) =>
        target === "main"
          ? {
              ...f,
              organizerLogoKey: res.key,
              organizerLogoUrl: res.url,
              organizerLogoBg: res.bg ?? null,
            }
          : {
              ...f,
              coOrganizers: f.coOrganizers.map((o) =>
                o.key === target
                  ? {
                      ...o,
                      logoKey: res.key,
                      logoUrl: res.url,
                      logoBg: res.bg ?? null,
                    }
                  : o,
              ),
            },
      );
      closeLogoCrop();
      toast.success("Logo ajouté — pensez à enregistrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l’upload");
    } finally {
      setUploadingLogo(null);
    }
  }

  function setCoOrganizer(key: string, patch: Partial<CoOrganizerRow>) {
    set(
      "coOrganizers",
      form.coOrganizers.map((o) => (o.key === key ? { ...o, ...patch } : o)),
    );
  }

  function logoPicker(
    target: string,
    url: string | null,
    label: string,
    bg?: string | null,
  ) {
    return (
      <label
        className={`admin-event__logo${eventId ? "" : " is-disabled"}`}
        title={eventId ? label : "Enregistrez d’abord l’événement"}
        style={url && bg ? { background: bg } : undefined}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" />
        ) : (
          <ImagePlus size={20} aria-hidden />
        )}
        {uploadingLogo === target ? <span>…</span> : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!eventId || saving || uploadingLogo !== null}
          className="sr-only"
          aria-label={label}
          onChange={(e) => {
            pickOrganizerLogo(target, e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
    );
  }

  async function save() {
    const input = toInput(form);
    if (typeof input === "string") {
      toast.error(input);
      return;
    }
    setSaving(true);
    try {
      let saved: AdminEvent;
      if (eventId) {
        saved = await adminEventsApi.update(eventId, input);
      } else {
        saved = await adminEventsApi.create(input);
      }
      if (coverFile) {
        saved = await adminEventsApi.uploadCover(saved.id, coverFile);
        setCoverFile(null);
      }
      toast.success(isEdit ? "Événement enregistré" : "Événement créé");
      if (!isEdit) {
        router.replace(`/admin/evenements/${saved.id}`);
        return;
      }
      setEvent(saved);
      setForm(fromEvent(saved));
      setCoverPreview(saved.coverUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer",
      );
    } finally {
      setSaving(false);
    }
  }

  const sponsorById = useMemo(
    () => new Map(sponsors.map((s) => [s.id, s])),
    [sponsors],
  );

  const [startDate, startTime] = splitLocal(form.startsAt);
  const [endDate, endTime] = splitLocal(form.endsAt);
  const showVenue = form.format !== "ONLINE";
  const showOnline = form.format !== "IN_PERSON";

  return (
    <div className="admin-article-page admin-event-page">
      <header className="admin-dash__header">
        <div>
          <Link href="/admin/evenements" className="admin-article-page__back">
            <ArrowLeft size={16} aria-hidden />
            Retour aux événements
          </Link>
          <h1>{isEdit ? "Modifier l’événement" : "Nouvel événement"}</h1>
          <p>
            Fiche informative : programme, intervenants, lieu, billets et
            sponsors. Aucune vente sur le site.
          </p>
        </div>
        <div className="admin-article-page__header-actions">
          {event?.status === "PUBLISHED" ? (
            <a
              href={`/evenements/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-dash__btn"
            >
              <ExternalLink size={15} aria-hidden /> Voir
            </a>
          ) : null}
          {event ? (
            <Link
              href={`/admin/evenements/statistiques?eventId=${event.id}`}
              className="admin-dash__btn"
            >
              <BarChart3 size={15} aria-hidden /> Stats
            </Link>
          ) : null}
          <button
            type="button"
            className="admin-dash__btn admin-dash__btn--primary"
            disabled={saving || loading}
            onClick={() => void save()}
          >
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </header>

      {loading ? (
        <p className="admin-dash__muted">Chargement…</p>
      ) : (
        <div className="admin-article__blocks admin-article__blocks--page">
          {/* ── Informations ───────────────────────────── */}
          <section className="admin-article__block" aria-labelledby="ev-info">
            <div className="admin-article__block-head">
              <h2 id="ev-info" className="admin-article__block-title">
                Informations
              </h2>
              <p className="admin-article__block-hint">
                Titre, type, statut et présentation
              </p>
            </div>
            <div className="admin-dash__form">
              <label className="admin-dash__field">
                <span>Titre</span>
                <input
                  value={form.title}
                  disabled={saving}
                  maxLength={240}
                  placeholder="Ex. Fintech Summit Kinshasa 2027"
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({
                      ...f,
                      title,
                      slug: slugAuto ? slugify(title) : f.slug,
                    }));
                  }}
                />
              </label>
              <div className="admin-dash__form-grid">
                <label className="admin-dash__field">
                  <span>Type</span>
                  <select
                    value={form.type}
                    disabled={saving}
                    onChange={(e) =>
                      set("type", e.target.value as EventTypeName)
                    }
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-dash__field">
                  <span>Statut</span>
                  <select
                    value={form.status}
                    disabled={saving}
                    onChange={(e) =>
                      set("status", e.target.value as EventStatusName)
                    }
                  >
                    <option value="DRAFT">Brouillon (non visible)</option>
                    <option value="PUBLISHED">Publié</option>
                  </select>
                </label>
              </div>
              <label className="admin-dash__field">
                <span>Accroche</span>
                <textarea
                  rows={2}
                  maxLength={600}
                  value={form.summary}
                  disabled={saving}
                  placeholder="Une ou deux phrases affichées sur la carte et en tête de fiche."
                  onChange={(e) => set("summary", e.target.value)}
                />
              </label>
              <label className="admin-dash__field">
                <span>Description</span>
                <textarea
                  rows={8}
                  value={form.description}
                  disabled={saving}
                  placeholder="Présentation complète. Laissez une ligne vide entre les paragraphes."
                  onChange={(e) => set("description", e.target.value)}
                />
              </label>
              <div className="admin-dash__form-grid">
                <div className="admin-dash__field admin-event__slug">
                  <label htmlFor="ev-slug">
                    Slug (URL)
                    {slugAuto ? (
                      <em className="admin-event__slug-badge">auto</em>
                    ) : null}
                  </label>
                  <div className="admin-event__slug-input">
                    <input
                      id="ev-slug"
                      value={form.slug}
                      disabled={saving}
                      spellCheck={false}
                      autoCapitalize="off"
                      placeholder="Généré depuis le titre"
                      onChange={(e) => {
                        setSlugAuto(false);
                        set("slug", e.target.value);
                      }}
                      onBlur={() => set("slug", slugify(form.slug))}
                    />
                    {slugify(form.title) &&
                    form.slug !== slugify(form.title) ? (
                      <button
                        type="button"
                        className="admin-event__slug-reset"
                        disabled={saving}
                        title="Recalculer depuis le titre"
                        aria-label="Recalculer le slug depuis le titre"
                        onClick={() => {
                          set("slug", slugify(form.title));
                          if (!isEdit) setSlugAuto(true);
                        }}
                      >
                        <RefreshCw size={14} strokeWidth={2.2} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <small className="admin-event__slug-preview">
                    /evenements/
                    <strong>
                      {slugify(form.slug) || slugify(form.title) || "…"}
                    </strong>
                  </small>
                  {isEdit &&
                  event &&
                  slugify(form.slug) &&
                  slugify(form.slug) !== event.slug ? (
                    <small className="admin-event__slug-warn">
                      L’ancienne adresse /evenements/{event.slug} ne
                      fonctionnera plus.
                    </small>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* ── Visuel ─────────────────────────────────── */}
          <section className="admin-article__block" aria-labelledby="ev-cover">
            <div className="admin-article__block-head">
              <h2 id="ev-cover" className="admin-article__block-title">
                Visuel
              </h2>
              <p className="admin-article__block-hint">
                Image 16:9 (1600 × 900 conseillé) — carte et en-tête de fiche
              </p>
            </div>
            <AdminDropzone
              accept="image/jpeg,image/png,image/webp"
              label="Déposer le visuel"
              hint="JPG, PNG ou WEBP — 8 Mo max"
              variant="image"
              thumbRatio="wide"
              fileName={coverFile?.name ?? null}
              previewUrl={coverPreview}
              onFile={pickCover}
            />
            <div className="admin-event-theme">
              <div className="admin-event-theme__head">
                <span>
                  Couleur de la charte
                  <span className="admin-event__optional">Optionnel</span>
                </span>
                <small>
                  Accent de la fiche publique (boutons, liens, puces). Vide =
                  couleur du site.
                </small>
              </div>
              <div className="admin-event-theme__controls">
                <input
                  type="color"
                  aria-label="Choisir la couleur"
                  value={
                    /^#[0-9a-f]{6}$/i.test(form.themeColor)
                      ? form.themeColor
                      : "#4ed319"
                  }
                  disabled={saving}
                  onChange={(e) => set("themeColor", e.target.value)}
                />
                <input
                  type="text"
                  className="admin-event-theme__hex"
                  aria-label="Code hexadécimal"
                  value={form.themeColor}
                  placeholder="#4ed319"
                  maxLength={7}
                  disabled={saving}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    set("themeColor", v && !v.startsWith("#") ? `#${v}` : v);
                  }}
                />
                <div
                  className="admin-event-theme__presets"
                  role="group"
                  aria-label="Couleurs suggérées"
                >
                  {THEME_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      aria-label={`Utiliser ${c}`}
                      aria-pressed={form.themeColor.toLowerCase() === c}
                      style={{ background: c }}
                      disabled={saving}
                      onClick={() => set("themeColor", c)}
                    />
                  ))}
                </div>
                {form.themeColor ? (
                  <button
                    type="button"
                    className="admin-event-theme__reset"
                    disabled={saving}
                    onClick={() => set("themeColor", "")}
                  >
                    Couleur du site
                  </button>
                ) : null}
              </div>
              {form.themeColor && !/^#[0-9a-f]{6}$/i.test(form.themeColor) ? (
                <p className="admin-event-theme__error">
                  Format attendu : #RRGGBB
                </p>
              ) : (
                <div
                  className="admin-event-theme__preview"
                  style={{
                    ["--theme" as string]: form.themeColor || "#4ed319",
                    ["--theme-on" as string]:
                      eventThemeVars(form.themeColor || "#4ed319")?.[
                        "--ev-accent-on"
                      ] ?? "#111111",
                  }}
                >
                  <span className="admin-event-theme__pill">Summit</span>
                  <span className="admin-event-theme__btn">Billetterie</span>
                  <span className="admin-event-theme__link">
                    Voir sur la carte →
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* ── Date & lieu ────────────────────────────── */}
          <section className="admin-article__block" aria-labelledby="ev-when">
            <div className="admin-article__block-head">
              <h2 id="ev-when" className="admin-article__block-title">
                Date et lieu
              </h2>
              <p className="admin-article__block-hint">
                Heures en heure de Kinshasa (UTC+1)
              </p>
            </div>
            <div className="admin-dash__form">
              <div className="admin-dash__form-grid">
                <div className="admin-dash__field">
                  <span>Début</span>
                  <div className="admin-event__datetime">
                    <AdminDatePicker
                      hideLabel
                      label="Date de début"
                      value={startDate}
                      clearable={false}
                      onChange={(d) =>
                        set("startsAt", joinLocal(d, startTime || "09:00"))
                      }
                    />
                    <AdminTimePicker
                      hideLabel
                      label="Heure de début"
                      value={startTime}
                      clearable={false}
                      disabled={saving}
                      onChange={(t) => set("startsAt", joinLocal(startDate, t))}
                    />
                  </div>
                </div>
                <div className="admin-dash__field">
                  <span>Fin (optionnel)</span>
                  <div className="admin-event__datetime">
                    <AdminDatePicker
                      hideLabel
                      label="Date de fin"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(d) =>
                        set("endsAt", d ? joinLocal(d, endTime || "18:00") : "")
                      }
                    />
                    <AdminTimePicker
                      hideLabel
                      label="Heure de fin"
                      value={endTime}
                      disabled={saving}
                      onChange={(t) =>
                        set(
                          "endsAt",
                          joinLocal(endDate || (t ? startDate : ""), t),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
              <label className="admin-dash__field">
                <span>Format</span>
                <select
                  value={form.format}
                  disabled={saving}
                  onChange={(e) =>
                    set("format", e.target.value as EventFormatName)
                  }
                >
                  {Object.entries(EVENT_FORMAT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {showVenue ? (
                <>
                  <div className="admin-dash__form-grid">
                    <label className="admin-dash__field">
                      <span>Ville</span>
                      <input
                        value={form.city}
                        disabled={saving}
                        onChange={(e) => set("city", e.target.value)}
                      />
                    </label>
                    <label className="admin-dash__field">
                      <span>Pays</span>
                      <input
                        value={form.country}
                        disabled={saving}
                        onChange={(e) => set("country", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="admin-dash__form-grid">
                    <label className="admin-dash__field">
                      <span>Nom du lieu</span>
                      <input
                        value={form.venueName}
                        disabled={saving}
                        placeholder="Ex. Pullman Kinshasa Grand Hotel"
                        onChange={(e) => set("venueName", e.target.value)}
                      />
                    </label>
                    <label className="admin-dash__field">
                      <span>Adresse</span>
                      <input
                        value={form.venueAddress}
                        disabled={saving}
                        onChange={(e) => set("venueAddress", e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="admin-dash__field">
                    <span>Lien carte (Google Maps…)</span>
                    <input
                      type="url"
                      value={form.mapUrl}
                      disabled={saving}
                      placeholder="https://maps.google.com/…"
                      onChange={(e) => set("mapUrl", e.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {showOnline ? (
                <label className="admin-dash__field">
                  <span>Lien en ligne (Zoom, YouTube…)</span>
                  <input
                    type="url"
                    value={form.onlineUrl}
                    disabled={saving}
                    placeholder="https://…"
                    onChange={(e) => set("onlineUrl", e.target.value)}
                  />
                </label>
              ) : null}
            </div>
          </section>

          {/* ── Programme ──────────────────────────────── */}
          <section className="admin-article__block" aria-labelledby="ev-prog">
            <div className="admin-article__block-head">
              <h2 id="ev-prog" className="admin-article__block-title">
                Programme
                <span className="admin-event__optional">Optionnel</span>
              </h2>
              <p className="admin-article__block-hint">
                Trié automatiquement par jour puis par heure
              </p>
            </div>
            <div className="admin-event__rows">
              {form.programme.map((row, i) => (
                <div key={row.key} className="admin-event__row">
                  <div className="admin-dash__form-grid admin-event__grid-4">
                    <div className="admin-dash__field">
                      <span>Jour (multi-jours)</span>
                      <AdminDatePicker
                        hideLabel
                        label="Jour"
                        value={row.day}
                        min={startDate || undefined}
                        max={endDate || undefined}
                        onChange={(d) =>
                          set(
                            "programme",
                            form.programme.map((p) =>
                              p.key === row.key ? { ...p, day: d } : p,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="admin-dash__field">
                      <span>Début</span>
                      <AdminTimePicker
                        hideLabel
                        label="Heure de début"
                        value={row.time}
                        clearable={false}
                        disabled={saving}
                        onChange={(t) =>
                          set(
                            "programme",
                            form.programme.map((p) =>
                              p.key === row.key ? { ...p, time: t } : p,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="admin-dash__field">
                      <span>Fin</span>
                      <AdminTimePicker
                        hideLabel
                        label="Heure de fin"
                        value={row.endTime}
                        disabled={saving}
                        onChange={(t) =>
                          set(
                            "programme",
                            form.programme.map((p) =>
                              p.key === row.key ? { ...p, endTime: t } : p,
                            ),
                          )
                        }
                      />
                    </div>
                    <RowActions
                      index={i}
                      count={form.programme.length}
                      disabled={saving}
                      onMove={(d) =>
                        set("programme", move(form.programme, i, d))
                      }
                      onRemove={() =>
                        set(
                          "programme",
                          form.programme.filter((p) => p.key !== row.key),
                        )
                      }
                    />
                  </div>
                  <label className="admin-dash__field">
                    <span>Intitulé</span>
                    <input
                      value={row.title}
                      disabled={saving}
                      placeholder="Ex. Panel — Mobile money et inclusion"
                      onChange={(e) =>
                        set(
                          "programme",
                          form.programme.map((p) =>
                            p.key === row.key
                              ? { ...p, title: e.target.value }
                              : p,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="admin-dash__form-grid">
                    <label className="admin-dash__field">
                      <span>Détail</span>
                      <input
                        value={row.description}
                        disabled={saving}
                        onChange={(e) =>
                          set(
                            "programme",
                            form.programme.map((p) =>
                              p.key === row.key
                                ? { ...p, description: e.target.value }
                                : p,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="admin-dash__field">
                      <span>Intervenants (séparés par des virgules)</span>
                      <input
                        value={row.speakers}
                        disabled={saving}
                        onChange={(e) =>
                          set(
                            "programme",
                            form.programme.map((p) =>
                              p.key === row.key
                                ? { ...p, speakers: e.target.value }
                                : p,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="admin-dash__btn"
                disabled={saving}
                onClick={() =>
                  set("programme", [
                    ...form.programme,
                    {
                      key: uid(),
                      day: form.programme.at(-1)?.day ?? "",
                      time: "",
                      endTime: "",
                      title: "",
                      description: "",
                      speakers: "",
                    },
                  ])
                }
              >
                <Plus size={15} aria-hidden /> Ajouter un créneau
              </button>
            </div>
          </section>

          {/* ── Organisateurs ───────────────────────────── */}
          <section
            className="admin-article__block"
            aria-labelledby="ev-organizers"
          >
            <div className="admin-article__block-head">
              <h2 id="ev-organizers" className="admin-article__block-title">
                Organisateurs
              </h2>
              <p className="admin-article__block-hint">
                {eventId
                  ? "Logo carré ou PNG transparent conseillé — recadré en rond"
                  : "Les logos s’ajoutent après la première création"}
              </p>
            </div>
            <div className="admin-event__rows">
              <div className="admin-event__row admin-event__organizer">
                {logoPicker(
                  "main",
                  form.organizerLogoUrl,
                  "Logo de l’organisateur",
                  form.organizerLogoBg,
                )}
                <div className="admin-dash__form-grid">
                  <label className="admin-dash__field">
                    <span>Organisateur principal</span>
                    <input
                      value={form.organizer}
                      disabled={saving}
                      onChange={(e) => set("organizer", e.target.value)}
                    />
                  </label>
                  {form.organizerLogoKey ? (
                    <div className="admin-event__organizer-actions">
                      <button
                        type="button"
                        className="admin-dash__btn"
                        disabled={saving}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            organizerLogoKey: null,
                            organizerLogoUrl: null,
                            organizerLogoBg: null,
                          }))
                        }
                      >
                        <Trash2 size={14} aria-hidden /> Retirer le logo
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              {form.coOrganizers.map((row, i) => (
                <div
                  key={row.key}
                  className="admin-event__row admin-event__organizer"
                >
                  {logoPicker(
                    row.key,
                    row.logoUrl,
                    `Logo de ${row.name || "ce co-organisateur"}`,
                    row.logoBg,
                  )}
                  <div className="admin-dash__form-grid admin-event__grid-co">
                    <label className="admin-dash__field">
                      <span>Co-organisateur</span>
                      <input
                        value={row.name}
                        disabled={saving}
                        onChange={(e) =>
                          setCoOrganizer(row.key, { name: e.target.value })
                        }
                      />
                    </label>
                    <label className="admin-dash__field">
                      <span>Site web (optionnel)</span>
                      <input
                        value={row.url}
                        disabled={saving}
                        inputMode="url"
                        placeholder="https://"
                        onChange={(e) =>
                          setCoOrganizer(row.key, { url: e.target.value })
                        }
                      />
                    </label>
                    <RowActions
                      index={i}
                      count={form.coOrganizers.length}
                      disabled={saving}
                      onMove={(d) =>
                        set("coOrganizers", move(form.coOrganizers, i, d))
                      }
                      onRemove={() =>
                        set(
                          "coOrganizers",
                          form.coOrganizers.filter((o) => o.key !== row.key),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="admin-dash__btn"
                disabled={saving || form.coOrganizers.length >= 12}
                onClick={() =>
                  set("coOrganizers", [
                    ...form.coOrganizers,
                    {
                      key: uid(),
                      id: uid(),
                      name: "",
                      url: "",
                      logoKey: null,
                      logoUrl: null,
                      logoBg: null,
                    },
                  ])
                }
              >
                <Plus size={15} aria-hidden /> Ajouter un co-organisateur
              </button>
            </div>
          </section>

          {/* ── Intervenants ───────────────────────────── */}
          <section
            className="admin-article__block"
            aria-labelledby="ev-speakers"
          >
            <div className="admin-article__block-head">
              <h2 id="ev-speakers" className="admin-article__block-title">
                Intervenants
                <span className="admin-event__optional">Optionnel</span>
              </h2>
              <p className="admin-article__block-hint">
                {eventId
                  ? "Portrait 3:5 — PNG détouré conseillé"
                  : "Les photos s’ajoutent après la première création"}
              </p>
            </div>
            <div className="admin-event__rows">
              {form.speakers.map((row, i) => (
                <div
                  key={row.key}
                  className="admin-event__row admin-event__speaker"
                >
                  <label
                    className={`admin-event__avatar${eventId ? "" : " is-disabled"}`}
                    title={
                      eventId
                        ? "Changer la photo"
                        : "Enregistrez d’abord l’événement"
                    }
                  >
                    {row.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.photoUrl} alt="" />
                    ) : (
                      <ImagePlus size={22} aria-hidden />
                    )}
                    {uploadingSpeaker === row.key ? <span>…</span> : null}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={!eventId || saving || uploadingSpeaker !== null}
                      className="sr-only"
                      onChange={(e) => {
                        pickSpeakerPhoto(row.key, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="admin-dash__form">
                    <div className="admin-dash__form-grid admin-event__grid-4">
                      <label className="admin-dash__field">
                        <span>Nom</span>
                        <input
                          value={row.name}
                          disabled={saving}
                          onChange={(e) =>
                            set(
                              "speakers",
                              form.speakers.map((s) =>
                                s.key === row.key
                                  ? { ...s, name: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="admin-dash__field">
                        <span>Fonction</span>
                        <input
                          value={row.role}
                          disabled={saving}
                          onChange={(e) =>
                            set(
                              "speakers",
                              form.speakers.map((s) =>
                                s.key === row.key
                                  ? { ...s, role: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="admin-dash__field">
                        <span>Organisation</span>
                        <input
                          value={row.organization}
                          disabled={saving}
                          onChange={(e) =>
                            set(
                              "speakers",
                              form.speakers.map((s) =>
                                s.key === row.key
                                  ? { ...s, organization: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </label>
                      <RowActions
                        index={i}
                        count={form.speakers.length}
                        disabled={saving}
                        onMove={(d) =>
                          set("speakers", move(form.speakers, i, d))
                        }
                        onRemove={() =>
                          set(
                            "speakers",
                            form.speakers.filter((s) => s.key !== row.key),
                          )
                        }
                      />
                    </div>
                    <label className="admin-dash__field">
                      <span>Bio courte (facultatif)</span>
                      <input
                        value={row.bio}
                        maxLength={1500}
                        disabled={saving}
                        onChange={(e) =>
                          set(
                            "speakers",
                            form.speakers.map((s) =>
                              s.key === row.key
                                ? { ...s, bio: e.target.value }
                                : s,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="admin-dash__btn"
                disabled={saving}
                onClick={() =>
                  set("speakers", [
                    ...form.speakers,
                    {
                      key: uid(),
                      id: uid(),
                      name: "",
                      role: "",
                      organization: "",
                      bio: "",
                      photoKey: null,
                      photoUrl: null,
                    },
                  ])
                }
              >
                <Plus size={15} aria-hidden /> Ajouter un intervenant
              </button>
            </div>
          </section>

          {/* ── Billets ────────────────────────────────── */}
          <section
            className="admin-article__block"
            aria-labelledby="ev-tickets"
          >
            <div className="admin-article__block-head">
              <h2 id="ev-tickets" className="admin-article__block-title">
                Billets
                <span className="admin-event__optional">Optionnel</span>
              </h2>
              <p className="admin-article__block-hint">
                Catégories et prix affichés à titre informatif — 0 = gratuit,
                vide = devise non proposée
              </p>
            </div>
            <div className="admin-dash__form">
              <label className="admin-dash__field">
                <span>Lien billetterie externe (optionnel)</span>
                <input
                  type="url"
                  value={form.ticketUrl}
                  disabled={saving}
                  placeholder="https://… (site de l’organisateur)"
                  onChange={(e) => set("ticketUrl", e.target.value)}
                />
              </label>
            </div>
            <div className="admin-event__rows">
              {form.tiers.map((row, i) => (
                <div key={row.key} className="admin-event__row">
                  <div className="admin-dash__form-grid">
                    <label className="admin-dash__field">
                      <span>Catégorie</span>
                      <input
                        value={row.name}
                        disabled={saving}
                        placeholder="Ex. Standard, VIP, Étudiant"
                        onChange={(e) =>
                          set(
                            "tiers",
                            form.tiers.map((t) =>
                              t.key === row.key
                                ? { ...t, name: e.target.value }
                                : t,
                            ),
                          )
                        }
                      />
                    </label>
                    <RowActions
                      index={i}
                      count={form.tiers.length}
                      disabled={saving}
                      onMove={(d) => set("tiers", move(form.tiers, i, d))}
                      onRemove={() =>
                        set(
                          "tiers",
                          form.tiers.filter((t) => t.key !== row.key),
                        )
                      }
                    />
                  </div>
                  <label className="admin-dash__field">
                    <span>Ce qui est inclus</span>
                    <input
                      value={row.description}
                      disabled={saving}
                      onChange={(e) =>
                        set(
                          "tiers",
                          form.tiers.map((t) =>
                            t.key === row.key
                              ? { ...t, description: e.target.value }
                              : t,
                          ),
                        )
                      }
                    />
                  </label>
                  <div
                    className="admin-event__prices"
                    role="group"
                    aria-label="Prix par devise"
                  >
                    {EVENT_CURRENCIES.map((currency) => (
                      <label
                        key={currency}
                        className={`admin-event__price${
                          row.prices[currency]?.trim() ? " is-filled" : ""
                        }`}
                      >
                        <span className="admin-event__price-code">
                          {currency}
                        </span>
                        <input
                          inputMode="decimal"
                          size={1}
                          aria-label={`Prix en ${currency}`}
                          value={row.prices[currency] ?? ""}
                          disabled={saving}
                          placeholder="—"
                          onChange={(e) =>
                            set(
                              "tiers",
                              form.tiers.map((t) =>
                                t.key === row.key
                                  ? {
                                      ...t,
                                      prices: {
                                        ...t.prices,
                                        [currency]: e.target.value,
                                      },
                                    }
                                  : t,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="admin-dash__btn"
                disabled={saving}
                onClick={() =>
                  set("tiers", [
                    ...form.tiers,
                    {
                      key: uid(),
                      id: uid(),
                      name: "",
                      description: "",
                      prices: {},
                    },
                  ])
                }
              >
                <Plus size={15} aria-hidden /> Ajouter une catégorie
              </button>
            </div>
          </section>

          {/* ── Sponsors ───────────────────────────────── */}
          <section
            className="admin-article__block"
            aria-labelledby="ev-sponsors"
          >
            <div className="admin-article__block-head">
              <h2 id="ev-sponsors" className="admin-article__block-title">
                Sponsors
                <span className="admin-event__optional">Optionnel</span>
              </h2>
              <p className="admin-article__block-hint">
                Choisissez un sponsor existant ou créez-le ici ·{" "}
                <Link href="/admin/sponsors">Gérer</Link>
              </p>
            </div>
            <div className="admin-event__rows">
              {form.sponsors.map((row, i) => {
                const s = sponsorById.get(row.sponsorId);
                return (
                  <div
                    key={row.sponsorId}
                    className="admin-event__row admin-event__sponsor"
                  >
                    <span
                      className="admin-mag__thumb admin-mag__thumb--square"
                      aria-hidden
                    >
                      {s?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt="" />
                      ) : (
                        <span className="admin-mag__thumb-empty">—</span>
                      )}
                    </span>
                    <strong>{s?.name ?? "Sponsor"}</strong>
                    <label className="admin-dash__field">
                      <span className="sr-only">Niveau</span>
                      <input
                        value={row.tier}
                        disabled={saving}
                        placeholder="Niveau (ex. Gold, Partenaire média)"
                        onChange={(e) =>
                          set(
                            "sponsors",
                            form.sponsors.map((r) =>
                              r.sponsorId === row.sponsorId
                                ? { ...r, tier: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <RowActions
                      index={i}
                      count={form.sponsors.length}
                      disabled={saving}
                      onMove={(d) => set("sponsors", move(form.sponsors, i, d))}
                      onRemove={() =>
                        set(
                          "sponsors",
                          form.sponsors.filter(
                            (r) => r.sponsorId !== row.sponsorId,
                          ),
                        )
                      }
                    />
                  </div>
                );
              })}
              <div className="admin-dash__field admin-event__sponsor-add">
                <span>Ajouter un sponsor</span>
                <AdminSponsorPicker
                  value=""
                  disabled={saving}
                  allowNone={false}
                  placeholder={
                    sponsors.length
                      ? "Choisir ou créer un sponsor…"
                      : "Créer un premier sponsor…"
                  }
                  excludeIds={form.sponsors.map((r) => r.sponsorId)}
                  createdMessage="Sponsor créé et ajouté à l’événement"
                  onCreated={(created) =>
                    setSponsors((prev) =>
                      [
                        created,
                        ...prev.filter((x) => x.id !== created.id),
                      ].sort((a, b) => a.name.localeCompare(b.name, "fr")),
                    )
                  }
                  onChange={(id) => {
                    if (!id) return;
                    setForm((f) =>
                      f.sponsors.some((r) => r.sponsorId === id)
                        ? f
                        : {
                            ...f,
                            sponsors: [
                              ...f.sponsors,
                              { sponsorId: id, tier: "" },
                            ],
                          },
                    );
                  }}
                />
              </div>
            </div>
          </section>

          <div className="admin-article-page__footer-actions">
            <Link href="/admin/evenements" className="admin-dash__btn">
              Annuler
            </Link>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      )}
      <ImageCropper
        open={Boolean(coverCropSrc)}
        imageSrc={coverCropSrc ?? ""}
        aspect={16 / 9}
        cropShape="rect"
        wide
        title="Recadrer le visuel"
        description="Ajustez le cadrage — format 16:9 pour la carte et l’en-tête de la fiche."
        confirmLabel="Valider"
        busyLabel="Recadrage…"
        filePrefix="evenement"
        maxWidth={1920}
        maxHeight={1080}
        maxBytes={5_000_000}
        onCancel={closeCoverCrop}
        onConfirm={confirmCoverCrop}
      />
      {logoCrop ? (
        <ImageCropper
          open
          imageSrc={logoCrop.src}
          busy={uploadingLogo !== null}
          aspect={1}
          cropShape="round"
          output="auto"
          minZoom={0.3}
          title="Recadrer le logo"
          description="Dézoomez pour faire tenir tout le logo dans le rond — il s’affiche sur fond blanc."
          confirmLabel="Valider"
          busyLabel="Envoi…"
          filePrefix="organisateur"
          maxWidth={400}
          maxHeight={400}
          maxBytes={500_000}
          onCancel={closeLogoCrop}
          onConfirm={(file) => uploadOrganizerLogo(logoCrop.target, file)}
        />
      ) : null}
      {speakerCrop ? (
        <ImageCropper
          open
          imageSrc={speakerCrop.src}
          busy={uploadingSpeaker !== null}
          aspect={3 / 5}
          cropShape="rect"
          output="auto"
          title="Recadrer la photo de l’intervenant"
          description="Portrait 3:5, visage dans le tiers haut. Un PNG détouré laisse voir le fond de couleur."
          confirmLabel="Valider"
          busyLabel="Envoi…"
          filePrefix="intervenant"
          maxWidth={600}
          maxHeight={1000}
          maxBytes={900_000}
          onCancel={closeSpeakerCrop}
          onConfirm={(file) => uploadSpeakerPhoto(speakerCrop.key, file)}
        />
      ) : null}
    </div>
  );
}

function RowActions({
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  disabled: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="admin-event__row-actions">
      <button
        type="button"
        className="admin-dash__icon-btn"
        aria-label="Monter"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={15} />
      </button>
      <button
        type="button"
        className="admin-dash__icon-btn"
        aria-label="Descendre"
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={15} />
      </button>
      <button
        type="button"
        className="admin-dash__icon-action admin-dash__icon-action--delete"
        aria-label="Supprimer"
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

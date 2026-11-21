"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import { AdminDatePicker } from "@/components/admin/admin-date-picker";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { AdminRichEditor } from "@/components/admin/admin-rich-editor";
import { ImageCropper } from "@/components/site/avatar-cropper";
import {
  adminJobsApi,
  type AdminJob,
  type AdminJobCompany,
  type AdminJobInput,
  type JobCompanySectorName,
  type JobContractTypeName,
  type JobStatusName,
  type JobWorkModeName,
} from "@/lib/api";
import {
  JOB_COMPANY_SECTOR_LABELS,
  JOB_CONTRACT_LABELS,
  JOB_WORK_MODE_LABELS,
} from "@/lib/jobs";

/** Même règle que l’API (jobs.service › slugify). */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/** ISO (fin de journée Kinshasa) → « YYYY-MM-DD » du même jour à Kinshasa. */
function isoToDay(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
  }).format(new Date(iso));
}

function todayKinshasa(): string {
  return isoToDay(new Date().toISOString());
}

type FormState = {
  title: string;
  slug: string;
  companyName: string;
  companyUrl: string;
  companyLogoKey: string | null;
  /** Fiche annuaire (enregistrés sur l’entreprise) */
  companySector: JobCompanySectorName | "";
  companyHeadquarters: string;
  companyAppStoreUrl: string;
  companyPlayStoreUrl: string;
  contractType: JobContractTypeName;
  workMode: JobWorkModeName;
  status: JobStatusName;
  locations: string[];
  deadline: string;
  description: string;
  applyUrl: string;
  applyEmail: string;
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  companyName: "",
  companyUrl: "",
  companyLogoKey: null,
  companySector: "",
  companyHeadquarters: "",
  companyAppStoreUrl: "",
  companyPlayStoreUrl: "",
  contractType: "CDI",
  workMode: "ON_SITE",
  status: "DRAFT",
  locations: [],
  deadline: "",
  description: "",
  applyUrl: "",
  applyEmail: "",
};

function fromJob(j: AdminJob): FormState {
  return {
    title: j.title,
    slug: j.slug,
    companyName: j.companyName,
    companyUrl: j.companyUrl ?? "",
    companyLogoKey: j.companyLogoKey,
    companySector: "",
    companyHeadquarters: "",
    companyAppStoreUrl: "",
    companyPlayStoreUrl: "",
    contractType: j.contractType,
    workMode: j.workMode,
    status: j.status,
    locations: j.locations,
    deadline: isoToDay(j.deadline),
    description: j.description ?? "",
    applyUrl: j.applyUrl ?? "",
    applyEmail: j.applyEmail ?? "",
  };
}

function opt(v: string): string | null {
  return v.trim() || null;
}

function toInput(
  form: FormState,
  pendingLocation: string,
): AdminJobInput | string {
  if (form.title.trim().length < 2) return "Indiquez l’intitulé du poste";
  if (!form.companyName.trim()) return "Indiquez le nom de l’entreprise";
  const locations = [...form.locations];
  if (pendingLocation.trim()) locations.push(pendingLocation.trim());
  if (!locations.length && form.workMode !== "REMOTE") {
    return "Ajoutez au moins un lieu (ou choisissez « Télétravail »)";
  }
  if (
    form.status === "PUBLISHED" &&
    !form.applyUrl.trim() &&
    !form.applyEmail.trim()
  ) {
    // Autorisé (modalités dans la description), mais on prévient.
    toast.info(
      "Aucun lien ni e-mail de candidature : le bouton Postuler sera masqué.",
    );
  }
  return {
    title: form.title.trim(),
    slug: slugify(form.slug) || undefined,
    companyName: form.companyName.trim(),
    companyUrl: opt(form.companyUrl),
    companyLogoKey: form.companyLogoKey,
    // Vide = inchangé : la fiche se corrige dans « Annuaire Fintech ».
    companySector: form.companySector || undefined,
    companyHeadquarters: opt(form.companyHeadquarters) ?? undefined,
    companyAppStoreUrl: opt(form.companyAppStoreUrl) ?? undefined,
    companyPlayStoreUrl: opt(form.companyPlayStoreUrl) ?? undefined,
    contractType: form.contractType,
    workMode: form.workMode,
    status: form.status,
    locations,
    deadline: form.deadline || null,
    description: opt(form.description),
    applyUrl: opt(form.applyUrl),
    applyEmail: opt(form.applyEmail),
  };
}

export function AdminJobForm({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(jobId);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugAuto, setSlugAuto] = useState(!isEdit);
  const [job, setJob] = useState<AdminJob | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [companies, setCompanies] = useState<AdminJobCompany[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);

  useEffect(() => {
    void adminJobsApi
      .companies()
      .then((res) => setCompanies(res.items))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    setLoading(true);
    adminJobsApi
      .get(jobId)
      .then((j) => {
        if (cancelled) return;
        setJob(j);
        setForm(fromJob(j));
        setLogoPreview(j.companyLogoUrl);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Offre introuvable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const companyByName = useMemo(
    () => new Map(companies.map((c) => [c.name.trim().toLowerCase(), c])),
    [companies],
  );

  /** Champs annuaire vides ← fiche de l’entreprise connue. */
  function withCompany(f: FormState, known: AdminJobCompany): FormState {
    return {
      ...f,
      companySector: f.companySector || (known.sector ?? ""),
      companyHeadquarters: f.companyHeadquarters || (known.headquarters ?? ""),
      companyAppStoreUrl: f.companyAppStoreUrl || (known.appStoreUrl ?? ""),
      companyPlayStoreUrl: f.companyPlayStoreUrl || (known.playStoreUrl ?? ""),
    };
  }

  // Édition : reprend la fiche annuaire de l’entreprise de l’offre.
  const jobCompanyName = job?.companyName;
  useEffect(() => {
    if (!jobCompanyName) return;
    const known = companyByName.get(jobCompanyName.trim().toLowerCase());
    if (known) setForm((f) => withCompany(f, known));
  }, [jobCompanyName, companyByName]);

  /** Entreprise déjà connue : reprend son logo, son site et sa fiche annuaire. */
  function onCompanyName(name: string) {
    const known = companyByName.get(name.trim().toLowerCase());
    setForm((f) => ({
      ...(known ? withCompany(f, known) : f),
      companyName: name,
      companyLogoKey:
        known && !f.companyLogoKey && !logoFile
          ? known.logoKey
          : f.companyLogoKey,
      companyUrl: known && !f.companyUrl ? (known.url ?? "") : f.companyUrl,
    }));
    if (known?.logoUrl && !logoPreview && !logoFile)
      setLogoPreview(known.logoUrl);
  }

  function addLocation(raw: string) {
    const parts = raw
      .split(/[;\n]/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!parts.length) return;
    setForm((f) => {
      const seen = new Set(f.locations.map((l) => l.toLowerCase()));
      const next = [...f.locations];
      for (const p of parts) {
        if (seen.has(p.toLowerCase()) || next.length >= 20) continue;
        seen.add(p.toLowerCase());
        next.push(p);
      }
      return { ...f, locations: next };
    });
    setLocationDraft("");
  }

  function onLocationKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ";") {
      e.preventDefault();
      addLocation(locationDraft);
    } else if (
      e.key === "Backspace" &&
      !locationDraft &&
      form.locations.length
    ) {
      set("locations", form.locations.slice(0, -1));
    }
  }

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
    if (logoCropSrc) URL.revokeObjectURL(logoCropSrc);
    setLogoCropSrc(URL.createObjectURL(file));
  }

  function closeLogoCrop() {
    setLogoCropSrc((src) => {
      if (src) URL.revokeObjectURL(src);
      return null;
    });
  }

  function confirmLogoCrop(file: File) {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    closeLogoCrop();
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    set("companyLogoKey", null);
  }

  async function save() {
    const input = toInput(form, locationDraft);
    if (typeof input === "string") {
      toast.error(input);
      return;
    }
    setSaving(true);
    try {
      let saved: AdminJob = jobId
        ? await adminJobsApi.update(jobId, input)
        : await adminJobsApi.create(input);
      if (logoFile) {
        saved = await adminJobsApi.uploadLogo(saved.id, logoFile);
        setLogoFile(null);
      }
      setLocationDraft("");
      toast.success(isEdit ? "Offre enregistrée" : "Offre créée");
      if (!isEdit) {
        router.replace(`/admin/jobs/${saved.id}`);
        return;
      }
      setJob(saved);
      setForm(fromJob(saved));
      setLogoPreview(saved.companyLogoUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer",
      );
    } finally {
      setSaving(false);
    }
  }

  const deadlineInPast = Boolean(
    form.deadline && form.deadline < todayKinshasa(),
  );

  return (
    <div className="admin-article-page admin-event-page">
      <header className="admin-dash__header">
        <div>
          <Link href="/admin/jobs" className="admin-article-page__back">
            <ArrowLeft size={16} aria-hidden />
            Retour aux offres
          </Link>
          <h1>{isEdit ? "Modifier l’offre" : "Nouvelle offre d’emploi"}</h1>
          <p>
            Poste, entreprise, contrat, lieux et date limite. La candidature se
            fait sur le formulaire externe du recruteur.
          </p>
        </div>
        <div className="admin-article-page__header-actions">
          {job?.status === "PUBLISHED" ? (
            <a
              href={`/jobs/${job.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-dash__btn"
            >
              <ExternalLink size={15} aria-hidden /> Voir
            </a>
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
          {/* ── Poste ──────────────────────────────────── */}
          <section className="admin-article__block" aria-labelledby="job-info">
            <div className="admin-article__block-head">
              <h2 id="job-info" className="admin-article__block-title">
                Poste
              </h2>
              <p className="admin-article__block-hint">
                Intitulé, contrat, statut et description
              </p>
            </div>
            <div className="admin-dash__form">
              <label className="admin-dash__field">
                <span>Intitulé du poste</span>
                <input
                  value={form.title}
                  disabled={saving}
                  maxLength={240}
                  placeholder="Ex. Analyste risque crédit"
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
                  <span>Type de contrat</span>
                  <select
                    value={form.contractType}
                    disabled={saving}
                    onChange={(e) =>
                      set("contractType", e.target.value as JobContractTypeName)
                    }
                  >
                    {Object.entries(JOB_CONTRACT_LABELS).map(([v, l]) => (
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
                      set("status", e.target.value as JobStatusName)
                    }
                  >
                    <option value="DRAFT">Brouillon (non visible)</option>
                    <option value="PUBLISHED">Publiée</option>
                  </select>
                </label>
              </div>
              <div className="admin-dash__field">
                <span>Description de l’offre</span>
                <AdminRichEditor
                  key={jobId ?? "new"}
                  value={form.description}
                  disabled={saving}
                  placeholder="Présentation du poste, missions, profil recherché…"
                  onChange={(html) => set("description", html)}
                />
              </div>
              <div className="admin-dash__field admin-event__slug">
                <label htmlFor="job-slug">
                  Slug (URL)
                  {slugAuto ? (
                    <em className="admin-event__slug-badge">auto</em>
                  ) : null}
                </label>
                <div className="admin-event__slug-input">
                  <input
                    id="job-slug"
                    value={form.slug}
                    disabled={saving}
                    spellCheck={false}
                    autoCapitalize="off"
                    placeholder="Généré depuis l’intitulé"
                    onChange={(e) => {
                      setSlugAuto(false);
                      set("slug", e.target.value);
                    }}
                    onBlur={() => set("slug", slugify(form.slug))}
                  />
                  {slugify(form.title) && form.slug !== slugify(form.title) ? (
                    <button
                      type="button"
                      className="admin-event__slug-reset"
                      disabled={saving}
                      title="Recalculer depuis l’intitulé"
                      aria-label="Recalculer le slug depuis l’intitulé"
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
                  /jobs/
                  <strong>
                    {slugify(form.slug) || slugify(form.title) || "…"}
                  </strong>
                </small>
                {isEdit &&
                job &&
                slugify(form.slug) &&
                slugify(form.slug) !== job.slug ? (
                  <small className="admin-event__slug-warn">
                    L’ancienne adresse /jobs/{job.slug} ne fonctionnera plus.
                  </small>
                ) : null}
              </div>
            </div>
          </section>

          {/* ── Entreprise ─────────────────────────────── */}
          <section
            className="admin-article__block"
            aria-labelledby="job-company"
          >
            <div className="admin-article__block-head">
              <h2 id="job-company" className="admin-article__block-title">
                Entreprise
              </h2>
              <p className="admin-article__block-hint">
                Fiche de l’annuaire des entreprises — créée automatiquement pour
                une nouvelle entreprise
              </p>
            </div>
            <div className="admin-dash__form">
              <div className="admin-job__company">
                <div className="admin-dash__field admin-job__logo">
                  <span className="admin-job__logo-head">
                    Logo
                    {logoPreview ? (
                      <button
                        type="button"
                        className="admin-job__logo-clear"
                        disabled={saving}
                        onClick={clearLogo}
                      >
                        <X size={12} strokeWidth={2.6} aria-hidden /> Retirer
                      </button>
                    ) : null}
                  </span>
                  <AdminDropzone
                    accept="image/jpeg,image/png,image/webp"
                    label={
                      logoPreview ? "Remplacer le logo" : "Déposer le logo"
                    }
                    hint="JPG, PNG ou WEBP — carré, 400 × 400 conseillé"
                    variant="image"
                    thumbRatio="square"
                    previewUrl={logoPreview}
                    fileName={logoFile?.name ?? null}
                    onFile={pickLogo}
                  />
                </div>
                <div className="admin-job__company-fields">
                  <label className="admin-dash__field">
                    <span>Nom de l’entreprise</span>
                    <input
                      value={form.companyName}
                      disabled={saving}
                      maxLength={160}
                      list="job-companies"
                      placeholder="Ex. Rawbank"
                      onChange={(e) => onCompanyName(e.target.value)}
                    />
                    <datalist id="job-companies">
                      {companies.map((c) => (
                        <option key={c.name} value={c.name} />
                      ))}
                    </datalist>
                  </label>
                  <label className="admin-dash__field">
                    <span>Site web (optionnel)</span>
                    <input
                      type="url"
                      value={form.companyUrl}
                      disabled={saving}
                      placeholder="https://…"
                      onChange={(e) => set("companyUrl", e.target.value)}
                    />
                  </label>
                  <label className="admin-dash__field">
                    <span>Secteur</span>
                    <select
                      value={form.companySector}
                      disabled={saving}
                      onChange={(e) =>
                        set(
                          "companySector",
                          e.target.value as JobCompanySectorName | "",
                        )
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
                      value={form.companyHeadquarters}
                      disabled={saving}
                      maxLength={160}
                      placeholder="Ex. Kinshasa, RDC"
                      onChange={(e) =>
                        set("companyHeadquarters", e.target.value)
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="admin-dash__form-grid">
                <label className="admin-dash__field">
                  <span>Lien App Store (si disponible)</span>
                  <input
                    type="url"
                    value={form.companyAppStoreUrl}
                    disabled={saving}
                    placeholder="https://apps.apple.com/…"
                    onChange={(e) => set("companyAppStoreUrl", e.target.value)}
                  />
                </label>
                <label className="admin-dash__field">
                  <span>Lien Play Store (si disponible)</span>
                  <input
                    type="url"
                    value={form.companyPlayStoreUrl}
                    disabled={saving}
                    placeholder="https://play.google.com/store/apps/…"
                    onChange={(e) => set("companyPlayStoreUrl", e.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>

          {/* ── Lieux & date limite ────────────────────── */}
          <section className="admin-article__block" aria-labelledby="job-where">
            <div className="admin-article__block-head">
              <h2 id="job-where" className="admin-article__block-title">
                Lieux et date limite
              </h2>
              <p className="admin-article__block-hint">
                Un ou plusieurs lieux · date limite en heure de Kinshasa
              </p>
            </div>
            <div className="admin-dash__form">
              <div className="admin-dash__field">
                <span>Lieux</span>
                <div className="admin-job__chips">
                  {form.locations.map((l) => (
                    <span key={l} className="admin-job__chip">
                      {l}
                      <button
                        type="button"
                        aria-label={`Retirer ${l}`}
                        disabled={saving}
                        onClick={() =>
                          set(
                            "locations",
                            form.locations.filter((x) => x !== l),
                          )
                        }
                      >
                        <X size={12} strokeWidth={2.6} aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    value={locationDraft}
                    disabled={saving}
                    maxLength={120}
                    placeholder={
                      form.locations.length
                        ? "Ajouter un lieu…"
                        : "Ex. Kinshasa, RDC — Entrée pour ajouter"
                    }
                    onChange={(e) => setLocationDraft(e.target.value)}
                    onKeyDown={onLocationKey}
                    onBlur={() => addLocation(locationDraft)}
                  />
                </div>
              </div>
              <div className="admin-dash__form-grid">
                <label className="admin-dash__field">
                  <span>Mode de travail</span>
                  <select
                    value={form.workMode}
                    disabled={saving}
                    onChange={(e) =>
                      set("workMode", e.target.value as JobWorkModeName)
                    }
                  >
                    {Object.entries(JOB_WORK_MODE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-dash__field">
                  <span>Date limite de candidature</span>
                  <AdminDatePicker
                    hideLabel
                    label="Date limite"
                    value={form.deadline}
                    placeholder="Sans date limite"
                    onChange={(d) => set("deadline", d)}
                  />
                  {deadlineInPast ? (
                    <small className="admin-event__slug-warn">
                      Date passée : l’offre apparaîtra comme clôturée.
                    </small>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* ── Candidature ────────────────────────────── */}
          <section className="admin-article__block" aria-labelledby="job-apply">
            <div className="admin-article__block-head">
              <h2 id="job-apply" className="admin-article__block-title">
                Candidature
              </h2>
              <p className="admin-article__block-hint">
                Lien du formulaire externe (prioritaire) ou e-mail
              </p>
            </div>
            <div className="admin-dash__form">
              <div className="admin-dash__form-grid">
                <label className="admin-dash__field">
                  <span>Lien du formulaire (optionnel)</span>
                  <input
                    type="url"
                    value={form.applyUrl}
                    disabled={saving}
                    placeholder="https://…"
                    onChange={(e) => set("applyUrl", e.target.value)}
                  />
                </label>
                <label className="admin-dash__field">
                  <span>E-mail de candidature (optionnel)</span>
                  <input
                    type="email"
                    value={form.applyEmail}
                    disabled={saving}
                    placeholder="recrutement@entreprise.com"
                    onChange={(e) => set("applyEmail", e.target.value)}
                  />
                </label>
              </div>
              {job ? (
                <p className="admin-dash__muted">
                  {job.viewCount} vue{job.viewCount > 1 ? "s" : ""} ·{" "}
                  {job.applyClicks} clic{job.applyClicks > 1 ? "s" : ""} sur «
                  Postuler »
                </p>
              ) : null}
            </div>
          </section>
        </div>
      )}

      <ImageCropper
        open={Boolean(logoCropSrc)}
        imageSrc={logoCropSrc ?? ""}
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
        onCancel={closeLogoCrop}
        onConfirm={confirmLogoCrop}
      />
    </div>
  );
}

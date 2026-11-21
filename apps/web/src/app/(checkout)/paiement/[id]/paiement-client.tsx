"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Intervalle et durée max d’attente de la validation Mobile Money. */
const POLL_MS = 4000;
const POLL_MAX_MS = 4 * 60 * 1000;

type Kind = "SUBSCRIPTION" | "MAGAZINE" | "ARTICLE" | "STATUS";
type State = "OPEN" | "PAID" | "EXPIRED" | "CANCELLED";

type Checkout = {
  id: string;
  kind: Kind;
  label: string;
  detail: string | null;
  amountCents: number;
  currency: string;
  state: State;
  expiresAt: string;
  paidAt: string | null;
  imageUrl: string | null;
  returnUrl: string | null;
  account: { name: string | null; email: string | null };
  payment: { status: string; phone: string | null } | null;
};

const KIND_LABEL: Record<Kind, string> = {
  SUBSCRIPTION: "Abonnement",
  MAGAZINE: "Magazine",
  ARTICLE: "Article",
  STATUS: "Statut sponsorisé",
};

const SUCCESS_TEXT: Record<Kind, string> = {
  SUBSCRIPTION:
    "Votre abonnement est actif sur toute la plateforme : articles, magazines et vidéos.",
  MAGAZINE: "Le numéro est disponible dans vos achats, sur l’app et le site.",
  ARTICLE: "L’article est débloqué sur votre compte, sur l’app et le site.",
  STATUS:
    "Votre statut est transmis à la rédaction. Il sera publié dès sa validation.",
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  const text = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${text} ${currency.toUpperCase()}`;
}

/** 0812345678 / 812345678 / +243 81… → 243812345678 */
function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `243${digits.slice(1)}`;
  if (digits.length === 9) digits = `243${digits}`;
  return digits;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/checkout/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
  };
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(
      res.status === 429
        ? "Trop de tentatives. Patientez quelques minutes."
        : msg || "Une erreur est survenue. Réessayez.",
    );
  }
  return data as T;
}

export default function PaiementClient({ id }: { id: string }) {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollStart = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await api<Checkout>(encodeURIComponent(id));
      setCheckout(data);
      // Page rouverte pendant une validation en cours
      if (data.state === "OPEN" && data.payment?.status === "PENDING") {
        pollStart.current = Date.now();
        setWaiting(true);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Lien introuvable");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Attente de la validation sur le téléphone
  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const data = await api<Checkout>(
          `${encodeURIComponent(id)}/check`,
          { method: "POST" },
        );
        if (stop) return;
        setCheckout(data);
        const status = data.payment?.status;
        if (data.state !== "OPEN") {
          setWaiting(false);
          return;
        }
        if (status === "FAILED" || status === "CANCELLED") {
          setWaiting(false);
          setError(
            "Le paiement a été refusé ou annulé. Vérifiez votre solde puis réessayez.",
          );
          return;
        }
      } catch {
        // Réseau instable : on retente au prochain tour
      }
      if (Date.now() - pollStart.current > POLL_MAX_MS) {
        setWaiting(false);
        setTimedOut(true);
        return;
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    let timer = window.setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [waiting, id]);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!/^243[0-9]{9}$/.test(normalized)) {
      setError("Entrez un numéro congolais valide, ex. 081 234 5678.");
      return;
    }
    setBusy(true);
    setError(null);
    setTimedOut(false);
    try {
      const data = await api<Checkout>(`${encodeURIComponent(id)}/pay`, {
        method: "POST",
        body: JSON.stringify({ phone: normalized }),
      });
      setCheckout(data);
      if (data.state === "OPEN") {
        pollStart.current = Date.now();
        setWaiting(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paiement impossible");
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setWaiting(false);
    setTimedOut(false);
    setError(null);
  }

  async function checkAgain() {
    pollStart.current = Date.now();
    setTimedOut(false);
    setWaiting(true);
  }

  return (
    <main className="pay">
      <header className="pay__top">
        <a href="/" className="pay__brand" aria-label={BRAND.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logo}
            alt={BRAND.name}
            className="pay__logo pay__logo--light"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logoOnDark}
            alt=""
            aria-hidden
            className="pay__logo pay__logo--dark"
          />
        </a>
        <span className="pay__secure">
          <LockIcon />
          Paiement sécurisé
        </span>
      </header>

      {!checkout && !loadError && (
        <section className="pay__card pay__card--center" aria-busy>
          <span className="pay__spinner" />
        </section>
      )}

      {loadError && (
        <StateCard
          tone="muted"
          title="Lien de paiement introuvable"
          text="Ce lien n’existe pas ou n’est plus valide. Relancez le paiement depuis l’application Fintech Médias."
          action={{ href: "/", label: "Aller sur le site" }}
        />
      )}

      {checkout && (
        <>
          <Summary checkout={checkout} />

          {checkout.state === "PAID" && (
            <StateCard
              tone="success"
              title="Paiement confirmé"
              text={SUCCESS_TEXT[checkout.kind]}
              action={
                checkout.returnUrl
                  ? {
                      href: checkout.returnUrl,
                      label: "Retourner dans l’application",
                    }
                  : { href: "/", label: "Continuer sur le site" }
              }
              hint={
                checkout.returnUrl
                  ? "Vous pouvez aussi fermer cette page et rouvrir l’application."
                  : undefined
              }
            />
          )}

          {(checkout.state === "EXPIRED" ||
            checkout.state === "CANCELLED") && (
            <StateCard
              tone="muted"
              title={
                checkout.state === "EXPIRED"
                  ? "Lien expiré"
                  : "Paiement annulé"
              }
              text="Pour votre sécurité, chaque lien de paiement est valable une heure. Relancez le paiement depuis l’application."
              action={
                checkout.returnUrl
                  ? {
                      href: checkout.returnUrl,
                      label: "Retourner dans l’application",
                    }
                  : { href: "/", label: "Aller sur le site" }
              }
            />
          )}

          {checkout.state === "OPEN" && waiting && (
            <section className="pay__card pay__waiting" aria-live="polite">
              <span className="pay__pulse">
                <PhoneIcon />
              </span>
              <h2>Validez sur votre téléphone</h2>
              <p>
                Une demande de{" "}
                <strong>
                  {formatPrice(checkout.amountCents, checkout.currency)}
                </strong>{" "}
                a été envoyée
                {checkout.payment?.phone
                  ? ` au ${checkout.payment.phone}`
                  : ""}
                . Saisissez votre code PIN Mobile Money pour confirmer.
              </p>
              <div className="pay__progress">
                <span />
              </div>
              <button type="button" className="pay__link" onClick={retry}>
                Je n’ai rien reçu — changer de numéro
              </button>
            </section>
          )}

          {checkout.state === "OPEN" && !waiting && (
            <form className="pay__card pay__form" onSubmit={pay} noValidate>
              <h2>Payer par Mobile Money</h2>
              <div className="pay__operators" aria-label="Opérateurs acceptés">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/mpesa01.jpg" alt="M-Pesa" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/orange3.jpg" alt="Orange Money" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/airtel.jpg" alt="Airtel Money" />
              </div>

              <label className="pay__label" htmlFor="pay-phone">
                Numéro Mobile Money
              </label>
              <div className="pay__field">
                <span className="pay__prefix">+243</span>
                <input
                  id="pay-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="81 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                />
              </div>

              {timedOut && (
                <p className="pay__notice">
                  Pas encore de confirmation. Si vous avez validé, vérifiez
                  dans un instant.{" "}
                  <button
                    type="button"
                    className="pay__link"
                    onClick={checkAgain}
                  >
                    Vérifier à nouveau
                  </button>
                </p>
              )}
              {error && (
                <p className="pay__error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="pay__cta" disabled={busy}>
                {busy ? (
                  <span className="pay__spinner pay__spinner--small" />
                ) : (
                  <>
                    Payer{" "}
                    {formatPrice(checkout.amountCents, checkout.currency)}
                  </>
                )}
              </button>
              <p className="pay__fine">
                Vous recevrez une demande de confirmation sur votre téléphone.
                Aucun montant n’est prélevé sans votre code PIN.
              </p>
            </form>
          )}
        </>
      )}

      <footer className="pay__footer">
        Paiement opéré par FlexPaie · {BRAND.name}
      </footer>
    </main>
  );
}

function Summary({ checkout }: { checkout: Checkout }) {
  return (
    <section className="pay__card pay__summary">
      <div className="pay__item">
        {checkout.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={checkout.imageUrl}
            alt=""
            className={`pay__thumb pay__thumb--${checkout.kind.toLowerCase()}`}
          />
        ) : (
          <span className="pay__thumb pay__thumb--icon">
            <KindIcon kind={checkout.kind} />
          </span>
        )}
        <div className="pay__item-text">
          <span className="pay__eyebrow">{KIND_LABEL[checkout.kind]}</span>
          <h1>{checkout.label}</h1>
          {checkout.detail && <p>{checkout.detail}</p>}
        </div>
      </div>
      <dl className="pay__lines">
        {checkout.account.email && (
          <div>
            <dt>Compte</dt>
            <dd>{checkout.account.email}</dd>
          </div>
        )}
        <div className="pay__total">
          <dt>Total</dt>
          <dd>{formatPrice(checkout.amountCents, checkout.currency)}</dd>
        </div>
      </dl>
    </section>
  );
}

function StateCard({
  tone,
  title,
  text,
  action,
  hint,
}: {
  tone: "success" | "muted";
  title: string;
  text: string;
  action: { href: string; label: string };
  hint?: string;
}) {
  return (
    <section className={`pay__card pay__state pay__state--${tone}`}>
      <span className="pay__state-icon">
        {tone === "success" ? <CheckIcon /> : <ClockIcon />}
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <a className="pay__cta" href={action.href}>
        {action.label}
      </a>
      {hint && <p className="pay__fine">{hint}</p>}
    </section>
  );
}

// ------------------------------------------------------------------ icônes

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function LockIcon() {
  return (
    <Svg>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

function PhoneIcon() {
  return (
    <Svg>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === "SUBSCRIPTION") {
    return (
      <Svg>
        <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
      </Svg>
    );
  }
  if (kind === "STATUS") {
    return (
      <Svg>
        <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
        <path d="M10 9l5 3-5 3z" />
      </Svg>
    );
  }
  return (
    <Svg>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M9 10h6M9 14h6" />
    </Svg>
  );
}

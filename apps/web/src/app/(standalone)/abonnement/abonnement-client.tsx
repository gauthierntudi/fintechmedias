"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { paymentsApi, plansApi, type PublicPlan } from "@/lib/api";
import { cn } from "@/lib/utils";
import "./abonnement.css";

const PLAN_TONES = ["forest", "impact", "ash", "carbon"] as const;

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function durationLabel(days: number): string {
  if (days % 365 === 0) {
    const y = days / 365;
    return y === 1 ? "1 an" : `${y} ans`;
  }
  if (days % 30 === 0) {
    const m = days / 30;
    return m === 1 ? "1 mois" : `${m} mois`;
  }
  return `${days} jours`;
}

/** Retour post-auth avec numéro Mobile Money préservé. */
function abonnementAuthNext(phone: string): string {
  const qs = new URLSearchParams();
  qs.set("pay", "mobile");
  const trimmed = phone.trim();
  if (trimmed) qs.set("phone", trimmed);
  return `/abonnement?${qs.toString()}`;
}

function AbonnementInner({
  initialPlans,
}: {
  initialPlans: PublicPlan[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [plans, setPlans] = useState<PublicPlan[]>(initialPlans);
  const [plansLoading, setPlansLoading] = useState(initialPlans.length === 0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialPlans[0]?.id ?? null,
  );
  const [phone, setPhone] = useState(() => searchParams.get("phone") ?? "");
  const [busy, setBusy] = useState(false);
  const [flexPendingId, setFlexPendingId] = useState<string | null>(null);
  const [flexStatus, setFlexStatus] = useState<
    "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED" | null
  >(null);

  const cancelled = searchParams.get("cancelled") === "1";
  const authNext = useMemo(
    () => abonnementAuthNext(phone),
    [phone],
  );
  const authNextEncoded = encodeURIComponent(authNext);

  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam) setPhone(phoneParam);
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    if (initialPlans.length === 0) setPlansLoading(true);
    void (async () => {
      try {
        const plansRes = await plansApi.list();
        if (!alive) return;
        setPlans(plansRes.items);
        if (plansRes.items[0]) {
          setSelectedPlanId((prev) => prev ?? plansRes.items[0]!.id);
        }
      } catch (err) {
        if (!alive || initialPlans.length > 0) return;
        toast.error(
          err instanceof Error
            ? err.message
            : "Impossible de charger les formules",
        );
      } finally {
        if (alive) setPlansLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialPlans.length]);

  useEffect(() => {
    if (cancelled) {
      toast.info("Paiement annulé — vous pouvez réessayer.");
      router.replace("/abonnement", { scroll: false });
    }
  }, [cancelled, router]);

  // Poll statut DB (webhook). Check FlexPaie seulement après un délai (USSD).
  useEffect(() => {
    if (!flexPendingId) {
      setFlexStatus(null);
      return;
    }
    setFlexStatus("PENDING");
    let stop = false;
    const startedAt = Date.now();
    const CHECK_AFTER_MS = 20_000;
    const CHECK_EVERY_MS = 12_000;
    let lastCheckAt = 0;

    const applyStatus = (
      status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED",
      paymentId: string,
    ) => {
      if (stop) return;
      if (status === "PENDING" || status === "REFUNDED") {
        setFlexStatus(status === "PENDING" ? "PENDING" : status);
        return;
      }
      setFlexStatus(status);
      if (status === "SUCCESS") {
        window.setTimeout(() => {
          if (stop) return;
          setFlexPendingId(null);
          toast.success("Paiement confirmé — abonnement activé");
          router.push(`/abonnement/retour?payment=${paymentId}`);
        }, 700);
        return;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        window.setTimeout(() => {
          if (stop) return;
          setFlexPendingId(null);
          toast.error("Paiement Mobile Money échoué");
        }, 900);
      }
    };

    const tick = async () => {
      try {
        const elapsed = Date.now() - startedAt;
        const dueForCheck =
          elapsed >= CHECK_AFTER_MS &&
          Date.now() - lastCheckAt >= CHECK_EVERY_MS;

        let p;
        if (dueForCheck) {
          lastCheckAt = Date.now();
          p = await paymentsApi.check(flexPendingId);
        } else {
          p = await paymentsApi.get(flexPendingId);
        }
        applyStatus(p.status, p.id);
      } catch {
        /* keep polling */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [flexPendingId, router]);

  useEffect(() => {
    if (!flexPendingId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [flexPendingId]);

  const selected = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  async function startCheckout() {
    if (!user) {
      router.push(`/connexion?next=${authNextEncoded}`);
      return;
    }
    if (!selected) {
      toast.error("Choisissez une formule");
      return;
    }
    setBusy(true);
    try {
      if (!phone.trim()) {
        toast.error("Indiquez votre numéro Mobile Money");
        setBusy(false);
        return;
      }
      const res = await paymentsApi.createFlexpaie(selected.id, phone.trim());
      setFlexPendingId(res.paymentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du paiement");
    } finally {
      setBusy(false);
    }
  }

  function cancelFlexWait() {
    setFlexPendingId(null);
    setFlexStatus(null);
  }

  return (
    <>
      <SiteHeader />
      <div className="opt-abo">
        <main className="opt-abo__shell">
          <header className="opt-abo__intro">
            <p className="opt-abo__eyebrow">Abonnement</p>
            <h1 id="abo-title">
              Lisez partout.
              <br />
              <span className="opt-abo__title-accent">Tout de suite.</span>
            </h1>
            <p className="opt-abo__lead">
              Accès illimité à tous les numéros — activation dès validation
              du paiement.
            </p>
          </header>

          <section className="opt-abo__formules" aria-labelledby="abo-formules">
            <div className="opt-abo__formules-head">
              <h2 id="abo-formules" className="opt-abo__eyebrow">
                Formules
              </h2>
              <p>Quatre durées. Le même accès, dès que le paiement est validé.</p>
            </div>

            {plansLoading ? (
              <p className="opt-abo__muted">
                <Loader2 className="opt-abo__spin" size={18} aria-hidden />
                Chargement des formules…
              </p>
            ) : plans.length === 0 ? (
              <p className="opt-abo__muted">
                Aucune formule active pour le moment.
              </p>
            ) : (
              <ul className="opt-abo__plans" role="list">
                {plans.map((plan, index) => {
                  const active = plan.id === selectedPlanId;
                  const tone = PLAN_TONES[index % PLAN_TONES.length];
                  return (
                    <li key={plan.id}>
                      <button
                        type="button"
                        className={cn(
                          "opt-abo__plan",
                          `opt-abo__plan--${tone}`,
                          active && "opt-abo__plan--active",
                        )}
                        onClick={() => setSelectedPlanId(plan.id)}
                        aria-pressed={active}
                      >
                        <span className="opt-abo__plan-top">
                          <span className="opt-abo__plan-index" aria-hidden>
                            {index + 1}
                          </span>
                          <span
                            className="opt-abo__plan-switch"
                            aria-hidden
                          />
                        </span>
                        <span className="opt-abo__plan-body">
                          <span className="opt-abo__plan-name">{plan.name}</span>
                          <span className="opt-abo__plan-price">
                            {formatMoney(plan.priceCents, plan.currency)}
                            <small> / {durationLabel(plan.durationDays)}</small>
                          </span>
                          {plan.description ? (
                            <span className="opt-abo__plan-desc">
                              {plan.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="opt-abo__lower">
            <section className="opt-abo__pay" aria-labelledby="abo-pay">
              {selected ? (
                <div className="opt-abo__summary" aria-live="polite">
                  <div className="opt-abo__summary-row">
                    <span>{selected.name}</span>
                    <span>
                      {formatMoney(selected.priceCents, selected.currency)}
                    </span>
                  </div>
                  <div className="opt-abo__summary-due">
                    <span>À régler aujourd’hui</span>
                    <strong>
                      {formatMoney(selected.priceCents, selected.currency)}
                    </strong>
                  </div>
                </div>
              ) : null}

              <div className="opt-abo__block">
                <h2 id="abo-pay" className="opt-abo__block-title">
                  Paiement Mobile Money
                </h2>
                <ul className="opt-abo__brands">
                  <li>
                    <img src="/brand/airtel.jpg" alt="Airtel Money" />
                  </li>
                  <li>
                    <img src="/brand/mpesa01.jpg" alt="M-Pesa" />
                  </li>
                  <li>
                    <img src="/brand/orange3.jpg" alt="Orange Money" />
                  </li>
                  <li>
                    <img src="/brand/card.jpg" alt="Visa et Mastercard" />
                  </li>
                </ul>
                <label className="opt-abo__field">
                  <span>Numéro Mobile Money (RDC)</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="2438XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={busy || Boolean(flexPendingId)}
                    autoComplete="tel"
                  />
                </label>
              </div>

              <ul className="opt-abo__perks">
                <li>
                  <Check size={16} strokeWidth={2.5} aria-hidden />
                  Tous les magazines publiés
                </li>
                <li>
                  <Check size={16} strokeWidth={2.5} aria-hidden />
                  Lecture multi-appareils
                </li>
                <li>
                  <Check size={16} strokeWidth={2.5} aria-hidden />
                  Activation immédiate après paiement
                </li>
              </ul>

              <div className="opt-abo__cta-row">
                {!authLoading && user ? (
                  <button
                    type="button"
                    className="opt-abo__cta"
                    disabled={busy || !selected || Boolean(flexPendingId)}
                    onClick={() => void startCheckout()}
                  >
                    {busy ? (
                      <>
                        <Loader2
                          className="opt-abo__spin"
                          size={18}
                          aria-hidden
                        />
                        Préparation…
                      </>
                    ) : (
                      "Confirmer"
                    )}
                  </button>
                ) : (
                  <>
                    <Link
                      href={`/connexion?next=${authNextEncoded}`}
                      className="opt-abo__cta"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href={`/inscription?next=${authNextEncoded}`}
                      className="opt-abo__cta-ghost"
                    >
                      Créer un compte
                    </Link>
                  </>
                )}
              </div>

              <p className="opt-abo__consent">
                En continuant, vous acceptez les{" "}
                <Link href="/conditions-utilisation">
                  conditions d’utilisation
                </Link>{" "}
                et accédez immédiatement à votre abonnement après paiement.
              </p>
            </section>

            <aside className="opt-abo__stage" aria-label="Visuel abonnement">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/legacy/img/13197.jpg"
                alt=""
                className="opt-abo__stage-img"
              />
              <div className="opt-abo__stage-shade" aria-hidden />
              <div className="opt-abo__stage-meta">
                <p className="opt-abo__stage-label">Abonnement</p>
                <p className="opt-abo__stage-title">Tous les numéros</p>
                <p className="opt-abo__stage-note">
                  Lecture illimitée, dès la validation du paiement.
                </p>
              </div>
            </aside>
          </div>
        </main>

      {flexPendingId ? (
        <div
          className="opt-abo-wait"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opt-abo-wait-title"
        >
          <button
            type="button"
            className="opt-abo-wait__backdrop"
            aria-label="Fermer"
            onClick={cancelFlexWait}
          />
          <div className="opt-abo-wait__panel">
            {flexStatus === "SUCCESS" ? (
              <Check
                className="opt-abo-wait__spinner"
                size={36}
                strokeWidth={2.25}
                aria-hidden
              />
            ) : (
              <Loader2
                className="opt-abo__spin opt-abo-wait__spinner"
                size={36}
                aria-hidden
              />
            )}
            <h2 id="opt-abo-wait-title">
              {flexStatus === "SUCCESS"
                ? "Paiement confirmé"
                : flexStatus === "FAILED" || flexStatus === "CANCELLED"
                  ? "Paiement non abouti"
                  : "En attente de validation sur votre téléphone"}
            </h2>
            <p>
              {flexStatus === "SUCCESS"
                ? "Votre abonnement est activé. Redirection…"
                : flexStatus === "FAILED" || flexStatus === "CANCELLED"
                  ? "La transaction Mobile Money a échoué ou a été annulée."
                  : "Confirmez via USSD ou la notification. Cette fenêtre reste ouverte jusqu’à confirmation."}
            </p>
            <p className="opt-abo-wait__status" aria-live="polite">
              Statut :{" "}
              <strong>
                {flexStatus === "SUCCESS"
                  ? "Confirmé"
                  : flexStatus === "FAILED"
                    ? "Échoué"
                    : flexStatus === "CANCELLED"
                      ? "Annulé"
                      : "En attente"}
              </strong>
            </p>
            {flexStatus === "PENDING" || !flexStatus ? (
              <button
                type="button"
                className="opt-abo__cta-ghost"
                onClick={cancelFlexWait}
              >
                Annuler
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
      <SiteFooter />
    </>
  );
}

export default function AbonnementClient({
  initialPlans,
}: {
  initialPlans: PublicPlan[];
}) {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <div className="opt-abo">
            <main className="opt-abo__shell opt-abo__shell--loading">
              <p className="opt-abo__muted">Chargement…</p>
            </main>
          </div>
          <SiteFooter />
        </>
      }
    >
      <AbonnementInner initialPlans={initialPlans}
      />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Check,
  Loader2,
  Smartphone,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import {
  magazinesPublicApi,
  paymentsApi,
  type PublicMagazineDetail,
} from "@/lib/api";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";
import "../abonnement/abonnement.css";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Retour post-auth avec numéro Mobile Money préservé. */
function achatAuthNext(
  magazineId: string | null,
  phone: string,
): string {
  if (!magazineId) return "/kiosque";
  const qs = new URLSearchParams();
  qs.set("magazine", magazineId);
  qs.set("pay", "mobile");
  const trimmed = phone.trim();
  if (trimmed) qs.set("phone", trimmed);
  return `/achat?${qs.toString()}`;
}

function AchatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const magazineId = searchParams.get("magazine")?.trim() || null;

  const [magazine, setMagazine] = useState<PublicMagazineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [canRead, setCanRead] = useState(false);
  const [phone, setPhone] = useState(() => searchParams.get("phone") ?? "");
  const [busy, setBusy] = useState(false);
  const [flexPendingId, setFlexPendingId] = useState<string | null>(null);
  const [flexStatus, setFlexStatus] = useState<
    "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED" | null
  >(null);

  const authNext = useMemo(
    () => achatAuthNext(magazineId, phone),
    [magazineId, phone],
  );
  const authNextEncoded = encodeURIComponent(authNext);

  const priceCents = magazine?.priceCents ?? null;
  const currency = magazine?.currency || "USD";
  const canBuy =
    magazine?.accessType !== "FREE" &&
    typeof priceCents === "number" &&
    priceCents > 0;
  const issueLabel = magazine?.issueNumber
    ? `N° ${magazine.issueNumber}`
    : null;

  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam) setPhone(phoneParam);
  }, [searchParams]);

  useEffect(() => {
    if (!magazineId) {
      router.replace("/kiosque");
      return;
    }

    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const detail = await magazinesPublicApi.get(magazineId);
        if (!alive) return;
        setMagazine(detail);
      } catch (err) {
        if (!alive) return;
        toast.error(
          err instanceof Error ? err.message : "Magazine introuvable",
        );
        router.replace("/kiosque");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [magazineId, router]);

  useEffect(() => {
    if (authLoading || !user || !magazineId) {
      setCanRead(false);
      return;
    }
    let alive = true;
    void magazinesPublicApi
      .read(magazineId)
      .then((session) => {
        if (!alive) return;
        setCanRead(Boolean(session.canRead));
      })
      .catch(() => {
        if (alive) setCanRead(false);
      });
    return () => {
      alive = false;
    };
  }, [authLoading, user, magazineId]);

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
          toast.success("Paiement confirmé — numéro acheté");
          router.push(`/achat/retour?payment=${paymentId}`);
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

  async function startCheckout() {
    if (!magazineId || !magazine) return;
    if (!user) {
      router.push(`/connexion?next=${authNextEncoded}`);
      return;
    }
    if (!canBuy) {
      toast.error("Ce numéro n’est pas disponible à l’achat");
      return;
    }
    setBusy(true);
    try {
      if (!phone.trim()) {
        toast.error("Indiquez votre numéro Mobile Money");
        setBusy(false);
        return;
      }
      const res = await paymentsApi.createFlexpaiePurchase(
        magazineId,
        phone.trim(),
      );
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

  const coverSrc =
    magazine?.coverUrl || "/legacy/img/abonnement.jpg";

  return (
    <>
      <SiteHeader />
      <div className="opt-abo">
        <main className="opt-abo__shell">
          <section className="opt-abo__checkout" aria-labelledby="achat-title">
            <div className="opt-abo__checkout-inner">
              <header className="opt-abo__intro">
                <p className="opt-abo__eyebrow">Achat unitaire</p>
                <h1 id="achat-title">Acheter ce numéro</h1>
                <p className="opt-abo__lead">
                  Accès immédiat à ce magazine uniquement — sans abonnement.
                </p>
              </header>

              {loading ? (
                <p className="opt-abo__muted">
                  <Loader2 className="opt-abo__spin" size={18} aria-hidden />
                  Chargement du numéro…
                </p>
              ) : !magazine ? (
                <p className="opt-abo__muted">Magazine introuvable.</p>
              ) : canRead ? (
                <>
                  <p className="opt-abo__lead" style={{ margin: 0 }}>
                    Vous avez déjà accès à ce numéro.
                  </p>
                  <div className="opt-abo__cta-row">
                    <Link
                      href={`/lecture/${encodeURIComponent(magazine.id)}`}
                      className="opt-abo__cta"
                    >
                      Lire maintenant
                    </Link>
                    <Link
                      href={`/kiosque?magazine=${encodeURIComponent(magazine.id)}`}
                      className="opt-abo__cta-ghost"
                    >
                      Retour au kiosque
                    </Link>
                  </div>
                </>
              ) : !canBuy ? (
                <>
                  <p className="opt-abo__muted">
                    Ce numéro n’est pas proposé à l’achat unitaire.
                  </p>
                  <div className="opt-abo__cta-row">
                    <Link
                      href={SUBSCRIPTIONS_ENABLED ? "/abonnement" : "/kiosque"}
                      className="opt-abo__cta"
                    >
                      {SUBSCRIPTIONS_ENABLED
                        ? "Voir l’abonnement"
                        : "Aller au kiosque"}
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="opt-abo__block">
                    <h2 className="opt-abo__block-title">Numéro</h2>
                    <ul className="opt-abo__plans" role="list">
                      <li>
                        <div
                          className="opt-abo__plan opt-abo__plan--active"
                          role="listitem"
                        >
                          <span className="opt-abo__plan-radio" aria-hidden />
                          <span className="opt-abo__plan-body">
                            <span className="opt-abo__plan-name">
                              {magazine.title}
                            </span>
                            {issueLabel ? (
                              <span className="opt-abo__plan-desc">
                                {issueLabel} · accès permanent
                              </span>
                            ) : (
                              <span className="opt-abo__plan-desc">
                                Accès permanent à ce numéro
                              </span>
                            )}
                          </span>
                          <span className="opt-abo__plan-price">
                            {formatMoney(priceCents!, currency)}
                          </span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="opt-abo__summary" aria-live="polite">
                    <div className="opt-abo__summary-row">
                      <span>Sous-total</span>
                      <span>{formatMoney(priceCents!, currency)}</span>
                    </div>
                    <div className="opt-abo__summary-row">
                      <span>Taxes</span>
                      <span>—</span>
                    </div>
                    <div className="opt-abo__summary-due">
                      <span>À régler aujourd’hui</span>
                      <strong>{formatMoney(priceCents!, currency)}</strong>
                    </div>
                  </div>

                  <div className="opt-abo__block">
                    <h2 className="opt-abo__block-title">Paiement Mobile Money</h2>
                    <p className="opt-abo__muted" style={{ margin: "0 0 0.85rem" }}>
                      <Smartphone size={16} aria-hidden /> FlexPaie — Airtel,
                      Orange, M-Pesa
                    </p>
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
                      Lecture de ce numéro uniquement
                    </li>
                    <li>
                      <Check size={16} strokeWidth={2.5} aria-hidden />
                      Activation immédiate après paiement
                    </li>
                    <li>
                      <Check size={16} strokeWidth={2.5} aria-hidden />
                      Conservé dans Mes achats
                    </li>
                  </ul>

                  <div className="opt-abo__cta-row">
                    {!authLoading && user ? (
                      <button
                        type="button"
                        className="opt-abo__cta"
                        disabled={busy || Boolean(flexPendingId)}
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
                    </Link>
                    .
                    {SUBSCRIPTIONS_ENABLED ? (
                      <>
                        {" "}
                        Préférez un accès illimité ?{" "}
                        <Link href="/abonnement">Voir l’abonnement</Link>.
                      </>
                    ) : null}
                  </p>

                  <p className="opt-abo__secure">
                    Transactions chiffrées et sécurisées
                  </p>
                </>
              )}
            </div>
          </section>

          <aside
            className="opt-abo__stage"
            aria-label={
              magazine ? `Couverture — ${magazine.title}` : "Visuel achat"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverSrc}
              alt=""
              className="opt-abo__stage-img"
            />
            <div className="opt-abo__stage-shade" aria-hidden />
            {magazine ? (
              <div className="opt-abo__stage-meta">
                <p className="opt-abo__stage-label">Numéro sélectionné</p>
                <p className="opt-abo__stage-title">{magazine.title}</p>
                <p className="opt-abo__stage-note">
                  {issueLabel
                    ? `${issueLabel} · achat unitaire`
                    : "Achat unitaire · kiosque numérique"}
                </p>
              </div>
            ) : null}
          </aside>
        </main>

        {flexPendingId ? (
          <div
            className="opt-abo-wait"
            role="dialog"
            aria-modal="true"
            aria-labelledby="opt-achat-wait-title"
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
              <h2 id="opt-achat-wait-title">
                {flexStatus === "SUCCESS"
                  ? "Paiement confirmé"
                  : flexStatus === "FAILED" || flexStatus === "CANCELLED"
                    ? "Paiement non abouti"
                    : "En attente de validation sur votre téléphone"}
              </h2>
              <p>
                {flexStatus === "SUCCESS"
                  ? "Votre numéro est débloqué. Redirection…"
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

export default function AchatClient() {
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
      <AchatInner />
    </Suspense>
  );
}

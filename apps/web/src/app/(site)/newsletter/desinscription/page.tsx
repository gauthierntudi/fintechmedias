"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { newsletterPublicApi } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { LegalDoc } from "@/components/site/legal-doc";

function UnsubscribeBody() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Désinscription en cours…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(
        "Ce lien est incomplet. Utilisez le lien « Se désinscrire » reçu dans l’e-mail.",
      );
      return;
    }
    let cancelled = false;
    void newsletterPublicApi
      .unsubscribe(token)
      .then((res) => {
        if (cancelled) return;
        setStatus("ok");
        setMessage(res.message);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "Impossible de traiter cette désinscription.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <p>{message}</p>
      {status !== "loading" ? (
        <p>
          <Link href="/">{BRAND.name}</Link>
          {" · "}
          <Link href="/confidentialite">Confidentialité</Link>
        </p>
      ) : null}
    </>
  );
}

export default function NewsletterUnsubscribePage() {
  return (
    <LegalDoc
      title="Désinscription newsletter"
      updatedAt="5 octobre 2026"
      current="privacy"
    >
      <Suspense fallback={<p>Désinscription en cours…</p>}>
        <UnsubscribeBody />
      </Suspense>
    </LegalDoc>
  );
}

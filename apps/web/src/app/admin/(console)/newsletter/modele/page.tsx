"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  adminNewsletterApi,
  adminSettingsApi,
  type SiteContactSettings,
  type SiteSocialLink,
} from "@/lib/api";
import {
  buildCampaignMail,
  sampleCampaign,
  type CampaignKind,
} from "@/lib/campaign-mail";

const KINDS: { id: CampaignKind; label: string; hint: string }[] = [
  {
    id: "digest",
    label: "Newsletter",
    hint: "Plusieurs articles, une édition",
  },
  {
    id: "article",
    label: "Nouvel article",
    hint: "Dernier article publié, contact et réseaux issus de la base",
  },
  {
    id: "magazine",
    label: "Nouveau numéro",
    hint: "Annonce kiosque + extraits",
  },
];

export default function AdminNewsletterTemplatePage() {
  const [kind, setKind] = useState<CampaignKind>("article");
  const [contact, setContact] = useState<SiteContactSettings | null>(null);
  const [socials, setSocials] = useState<SiteSocialLink[]>([]);
  const [live, setLive] = useState<{
    subject: string;
    html: string;
    articleTitle: string;
  } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([adminSettingsApi.getContact(), adminSettingsApi.getSocial()])
      .then(([nextContact, nextSocial]) => {
        if (cancelled) return;
        setContact(nextContact);
        setSocials(nextSocial.links ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setContact(null);
          setSocials([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminNewsletterApi
      .preview()
      .then((res) => {
        if (!cancelled) {
          setLive(res);
          setLiveError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLive(null);
        setLiveError(
          err instanceof Error
            ? err.message
            : "Impossible de charger l’aperçu depuis la base.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const campaign = useMemo(() => {
    const base = sampleCampaign(kind, BRAND.siteUrl);
    return {
      ...base,
      contact: contact
        ? {
            email: contact.email,
            phone: contact.phone,
            address: contact.address,
          }
        : undefined,
      socials: socials.map((item) => ({
        label: item.label,
        url: item.url,
        network: item.network,
      })),
    };
  }, [kind, contact, socials]);

  const html =
    kind === "article" && live?.html
      ? live.html
      : buildCampaignMail(campaign);
  const subject =
    kind === "article" && live?.subject ? live.subject : campaign.subject;

  return (
    <div className="admin-mail-preview">
      <header className="admin-dash__header">
        <div>
          <Link href="/admin/newsletter" className="admin-mail-preview__back">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Newsletter
          </Link>
          <h1>Modèle d’emailing</h1>
          <p className="admin-dash__muted">
            Aperçu du dernier article publié. Coordonnées et réseaux : ceux
            enregistrés dans Contact et Réseaux sociaux. Rien n’est envoyé
            depuis cette page.
          </p>
        </div>
      </header>

      <div className="admin-mail-preview__kinds" role="tablist">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={kind === item.id}
            className={
              kind === item.id
                ? "admin-dash__btn admin-dash__btn--primary"
                : "admin-dash__btn"
            }
            onClick={() => setKind(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="admin-dash__muted admin-mail-preview__hint">
        {KINDS.find((item) => item.id === kind)?.hint}. Objet proposé :{" "}
        <strong>{subject}</strong>
        {kind === "article" && liveError ? (
          <>
            {" "}
            — {liveError}
          </>
        ) : null}
      </p>

      <div className="admin-mail-preview__stage">
        <iframe
          title={`Aperçu e-mail ${kind}`}
          className="admin-mail-preview__frame"
          srcDoc={html}
        />
      </div>
    </div>
  );
}

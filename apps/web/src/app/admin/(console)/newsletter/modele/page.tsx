"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BRAND } from "@/lib/brand";
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
    hint: "Un titre, une photo, un bouton",
  },
  {
    id: "magazine",
    label: "Nouveau numéro",
    hint: "Annonce kiosque + extraits",
  },
];

export default function AdminNewsletterTemplatePage() {
  const [kind, setKind] = useState<CampaignKind>("digest");
  const campaign = useMemo(
    () => sampleCampaign(kind, BRAND.siteUrl),
    [kind],
  );
  const html = useMemo(() => buildCampaignMail(campaign), [campaign]);

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
            Aperçu à valider. Rien n’est envoyé depuis cette page — le contenu
            ci-dessous est un exemple, seuls le cadre et la mise en page sont
            figés.
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
        <strong>{campaign.subject}</strong>
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

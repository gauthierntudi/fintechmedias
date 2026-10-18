"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { articlesPublicApi, type AdminArticleBlock } from "@/lib/api";

export function ArticleBody({
  slug,
  locked,
  priceCents,
  blocks,
}: {
  slug: string;
  locked: boolean;
  priceCents: number | null;
  blocks: AdminArticleBlock[];
}) {
  const [state, setState] = useState({ locked, blocks });

  useEffect(() => {
    if (!locked) return;
    let cancel = false;
    articlesPublicApi
      .bySlug(slug)
      .then((article) => {
        if (cancel || article.locked) return;
        setState({ locked: false, blocks: article.blocks });
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [locked, slug]);

  if (state.locked) {
    const price = ((priceCents ?? 100) / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const next = `/article/${encodeURIComponent(slug)}`;
    return (
      <div className="opt-article__body">
        <div
          className="opt-article__html"
          dangerouslySetInnerHTML={{ __html: state.blocks[0]?.content ?? "" }}
        />
        <div className="opt-article__lock">
          <div className="opt-article__lock-card">
            <span className="opt-article__lock-icon" aria-hidden>
              <Lock size={18} strokeWidth={2} />
            </span>
            <h2>Cet article est réservé aux abonnés</h2>
            <p>
              Accédez à l’intégralité de cet article en l’achetant à l’unité
              ou avec un abonnement actif.
            </p>
            <div className="opt-article__lock-actions">
              <Link href={`/connexion?next=${encodeURIComponent(next)}`}>
                Acheter l’article
                <strong>{price} $</strong>
              </Link>
              <Link href="/abonnement">
                S’abonner
                <span>Accès illimité</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="opt-article__body">
      {state.blocks.map((block, i) => (
        <section key={block.id ?? `block-${i}`} className="opt-article__block">
          {block.title ? <h2>{block.title}</h2> : null}
          {block.coverUrl ? (
            <figure className="opt-article__block-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.coverUrl}
                alt={block.coverCaption?.trim() || ""}
                className="opt-article__block-cover"
              />
              {block.coverCaption?.trim() ? (
                <figcaption className="opt-article__caption">
                  {block.coverCaption.trim()}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
          <div
            className="opt-article__html"
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        </section>
      ))}
    </div>
  );
}

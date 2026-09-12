"use client";

import { useCallback, useEffect, useState } from "react";

type ArticleShareProps = {
  url: string;
  title: string;
};

function BiIcon({
  name,
  path,
}: {
  name: string;
  path: string;
}) {
  return (
    <svg
      className={`bi bi-${name}`}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

/** Glyphs Bootstrap Icons (16×16), uniquement sur cette barre. */
const BI = {
  share:
    "M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5m-8.5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
  facebook:
    "M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951",
  twitterX:
    "M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z",
  linkedin:
    "M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z",
  whatsapp:
    "M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.926A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.609-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.941.164-.464.164-.86.114-.941-.049-.08-.182-.133-.38-.232",
  link45:
    "M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287zM6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.10.10.0.2.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z",
  check:
    "M12.736 3.97a.733.733 0 0 1 1.047 0c.275.275.275.722 0 .996L7.462 11.29a.733.733 0 0 1-1.047 0L3.217 8.09a.704.704 0 0 1 0-.996.733.733 0 0 1 1.047 0l2.682 2.68 5.79-5.804z",
} as const;

function shareHref(
  network: "facebook" | "twitter" | "linkedin" | "whatsapp",
  url: string,
  title: string,
) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (network) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "whatsapp":
      return `https://api.whatsapp.com/send?text=${t}%20${u}`;
  }
}

export function ArticleShare({ url, title }: ArticleShareProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && Boolean(navigator.share));
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [url]);

  const nativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, url, text: title });
    } catch {
      /* utilisateur a annulé */
    }
  }, [title, url]);

  return (
    <div className="opt-article__share">
      <p className="opt-article__share-label">Partager</p>
      <ul className="opt-article__share-list">
        {canNativeShare ? (
          <li>
            <button
              type="button"
              className="opt-article__share-btn opt-article__share-btn--native"
              onClick={() => void nativeShare()}
              aria-label="Partager"
            >
              <BiIcon name="share" path={BI.share} />
            </button>
          </li>
        ) : null}
        <li>
          <a
            className="opt-article__share-btn opt-article__share-btn--facebook"
            href={shareHref("facebook", url, title)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Partager sur Facebook"
          >
            <BiIcon name="facebook" path={BI.facebook} />
          </a>
        </li>
        <li>
          <a
            className="opt-article__share-btn opt-article__share-btn--x"
            href={shareHref("twitter", url, title)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Partager sur X"
          >
            <BiIcon name="twitter-x" path={BI.twitterX} />
          </a>
        </li>
        <li>
          <a
            className="opt-article__share-btn opt-article__share-btn--linkedin"
            href={shareHref("linkedin", url, title)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Partager sur LinkedIn"
          >
            <BiIcon name="linkedin" path={BI.linkedin} />
          </a>
        </li>
        <li>
          <a
            className="opt-article__share-btn opt-article__share-btn--whatsapp"
            href={shareHref("whatsapp", url, title)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Partager sur WhatsApp"
          >
            <BiIcon name="whatsapp" path={BI.whatsapp} />
          </a>
        </li>
        <li>
          <button
            type="button"
            className="opt-article__share-btn opt-article__share-btn--link"
            onClick={() => void copyLink()}
            aria-label={copied ? "Lien copié" : "Copier le lien"}
          >
            {copied ? (
              <BiIcon name="check-lg" path={BI.check} />
            ) : (
              <BiIcon name="link-45deg" path={BI.link45} />
            )}
          </button>
        </li>
      </ul>
    </div>
  );
}

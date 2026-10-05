/**
 * Gabarit d’emailing éditorial L'Entrevue.
 * HTML tables + styles inline (Outlook, Gmail, Apple Mail).
 */

export const CAMPAIGN_KINDS = ['digest', 'article', 'magazine'] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

const BLACK = '#111111';
const RED = '#e42320';
const WHITE = '#ffffff';
const PAGE = '#f3f3f3';
const INK = '#111111';
const MUTED = '#5c5c5c';
const LINE = '#e8e8e8';
const FONT = 'Arial,Helvetica,sans-serif';
const DISPLAY = "Georgia,'Times New Roman',Times,serif";

export type CampaignStory = {
  category: string;
  title: string;
  excerpt: string;
  href: string;
  imageUrl?: string;
};

export type CampaignContact = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type CampaignSocialLink = {
  label: string;
  url: string;
  network?: string;
};

export type CampaignMailInput = {
  appUrl: string;
  kind: CampaignKind;
  subject: string;
  preheader: string;
  kicker: string;
  dateLabel: string;
  headline: string;
  lead: string;
  stories: CampaignStory[];
  cta: { label: string; href: string };
  unsubscribeUrl: string;
  contact?: CampaignContact;
  socials?: CampaignSocialLink[];
};

export function isCampaignKind(value: string | undefined): value is CampaignKind {
  return CAMPAIGN_KINDS.includes(value as CampaignKind);
}

const MAX_STORIES = 4;

export function sampleCampaign(
  kind: CampaignKind,
  appUrl: string,
): CampaignMailInput {
  const home = appUrl.replace(/\/$/, '') || 'https://lentrevuemag.com';
  const unsub = `${home}/newsletter/desinscription`;

  const pme: CampaignStory = {
    category: 'Rencontre Avec',
    title:
      'Une PME peut-elle dépendre d’un seul client sans mettre son activité en danger ?',
    excerpt:
      'Décrocher un gros contrat peut transformer une entreprise. Encore faut-il ne pas lui confier toute la maison.',
    href: `${home}/article/une-pme-peut-elle-dependre-d-un-seul-client-sans-mettre-son-activite-en-danger`,
    imageUrl:
      'https://cdn.lentrevuemag.com/articles/cmty4nkvs000eibesef7rl4rb/1789201966500_d31059e5.jpg',
  };

  const daf: CampaignStory = {
    category: "Qu'en dit l'expert",
    title: 'Un directeur financier avant d’en avoir les moyens',
    excerpt:
      'Trésorerie, prévisions, coûts : la fonction financière n’attend pas le premier million pour devenir urgente.',
    href: `${home}/article/pourquoi-votre-entreprise-peut-avoir-besoin-d-un-directeur-financier-avant-d-avoir-les-moyens-d-en-embaucher-un`,
    imageUrl:
      'https://cdn.lentrevuemag.com/articles/cmty366tx0005ibesjilw93u3/1789199475539_39c42017.jpg',
  };

  const associe: CampaignStory = {
    category: 'Entreprendre',
    title: 'Quand le réseau d’un associé ne suffit plus',
    excerpt:
      'Un carnet d’adresses n’est pas une stratégie. Ce qu’il faut exiger d’un partenaire, au-delà des introductions.',
    href: `${home}/rubrique/entreprendre`,
    imageUrl:
      'https://cdn.lentrevuemag.com/articles/cmty4nkvs000eibesef7rl4rb/1789201966500_d31059e5.jpg',
  };

  const digital: CampaignStory = {
    category: 'Innovation',
    title: 'Digitaliser sans brûler la trésorerie',
    excerpt:
      'Outils, priorités et dépenses : comment moderniser l’entreprise sans vider le compte.',
    href: `${home}/rubrique/innovation`,
    imageUrl:
      'https://cdn.lentrevuemag.com/articles/cmty366tx0005ibesjilw93u3/1789199475539_39c42017.jpg',
  };

  const stories = [pme, daf, associe, digital].slice(0, MAX_STORIES);

  if (kind === 'article') {
    return {
      appUrl: home,
      kind,
      subject: `${pme.title} — L'Entrevue`,
      preheader: pme.excerpt,
      kicker: 'Nouvel article',
      dateLabel: 'Octobre 2026',
      headline: pme.title,
      lead: pme.excerpt,
      stories,
      cta: { label: "Lire l'article", href: pme.href },
      unsubscribeUrl: unsub,
    };
  }

  if (kind === 'magazine') {
    return {
      appUrl: home,
      kind,
      subject: "Le nouveau numéro de L'Entrevue est en kiosque",
      preheader: 'Portraits, analyses et outils pour diriger autrement.',
      kicker: 'Kiosque',
      dateLabel: 'Nouveau numéro',
      headline: 'Le magazine du mois est en ligne',
      lead: 'Un numéro à lire comme une conversation : celles et ceux qui entreprennent, les décisions qui pèsent, les relais qui tiennent.',
      stories,
      cta: { label: 'Ouvrir le kiosque', href: `${home}/kiosque` },
      unsubscribeUrl: unsub,
    };
  }

  return {
    appUrl: home,
    kind: 'digest',
    subject: "L'Entrevue — ce que les PME doivent lire maintenant",
    preheader:
      'La une, puis trois autres textes pour piloter sans attendre.',
    kicker: 'La newsletter',
    dateLabel: 'Octobre 2026',
    headline: 'Ce que les PME doivent lire maintenant',
    lead: 'Une lecture en une, trois autres en bas de page — le nécessaire, sans noyer la boîte mail.',
    stories,
    cta: { label: "Lire L'Entrevue", href: home },
    unsubscribeUrl: unsub,
  };
}

export function buildCampaignMail(input: CampaignMailInput): string {
  const home = input.appUrl.replace(/\/$/, '') || 'https://lentrevuemag.com';
  const logo = `${home}/brand/logo-Lentrevue-blanc.png`;
  const stories = input.stories.slice(0, MAX_STORIES);
  const featured = stories[0];
  const rest = stories.slice(1, MAX_STORIES);

  const magazineHero = input.kind === 'magazine' ? magazineMark() : '';
  const featuredHtml = featured ? featuredStory(featured) : '';
  const restHtml = storiesRow(rest);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${esc(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${WHITE};">
          <tr>
            <td style="background:${BLACK};padding:22px 28px 18px;">
              <a href="${esc(home)}" style="text-decoration:none;">
                <img src="${esc(logo)}" alt="L'Entrevue" height="34" style="display:block;height:34px;width:auto;max-width:190px;border:0;outline:none;" />
              </a>
              <p style="margin:10px 0 0;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.62);">Autour de l’entrepreneuriat</p>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${RED};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          ${
            input.kind === 'article'
              ? `<tr>
            <td style="padding:28px 28px 12px;font-family:${FONT};">
              <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${RED};font-weight:700;">
                ${esc(input.kicker)}&nbsp;&nbsp;·&nbsp;&nbsp;<span style="color:${MUTED};font-weight:600;">${esc(input.dateLabel)}</span>
              </p>
            </td>
          </tr>`
              : `<tr>
            <td style="padding:28px 28px 8px;font-family:${FONT};">
              <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${RED};font-weight:700;">
                ${esc(input.kicker)}&nbsp;&nbsp;·&nbsp;&nbsp;<span style="color:${MUTED};font-weight:600;">${esc(input.dateLabel)}</span>
              </p>
              <h1 style="margin:0 0 14px;font-family:${DISPLAY};font-size:28px;line-height:1.22;font-weight:700;color:${INK};">
                ${esc(input.headline)}
              </h1>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${MUTED};">
                ${esc(input.lead)}
              </p>
            </td>
          </tr>`
          }
          ${magazineHero}
          ${featuredHtml}
          ${restHtml}
          <tr>
            <td style="padding:8px 28px 32px;">
              ${button(input.cta.href, input.cta.label)}
            </td>
          </tr>
          ${footerBlock(home, input.unsubscribeUrl, input.contact, input.socials)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function featuredStory(story: CampaignStory): string {
  const img = story.imageUrl
    ? `<a href="${esc(story.href)}" style="text-decoration:none;">
        <img src="${esc(story.imageUrl)}" alt="${esc(story.title)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;outline:none;" />
      </a>`
    : '';
  return `<tr>
    <td style="padding:0 28px 8px;font-family:${FONT};">
      ${img}
      <p style="margin:16px 0 8px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${RED};font-weight:700;">${esc(story.category)}</p>
      <h2 style="margin:0 0 10px;font-family:${DISPLAY};font-size:24px;line-height:1.28;font-weight:700;color:${INK};">
        <a href="${esc(story.href)}" style="color:${INK};text-decoration:none;">${esc(story.title)}</a>
      </h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${MUTED};">${esc(story.excerpt)}</p>
      <p style="margin:0 0 8px;">
        <a href="${esc(story.href)}" style="font-size:14px;font-weight:700;color:${RED};text-decoration:none;">Lire l’article&nbsp;→</a>
      </p>
    </td>
  </tr>`;
}

function storiesRow(stories: CampaignStory[]): string {
  if (stories.length === 0) return '';
  const items = stories.slice(0, 3);
  const n = items.length;
  const inner = 544;
  const gap = 12;
  const colW = Math.floor((inner - gap * (n - 1)) / n);
  const cells = items
    .map((story, i) => {
      const pad = i < n - 1 ? `padding-right:${gap}px;` : '';
      return `<td width="${colW}" valign="top" style="${pad}">${smallCard(story, colW)}</td>`;
    })
    .join('');
  return `<tr>
    <td style="padding:16px 28px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">
        <tr>
          <td style="padding-top:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${cells}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function smallCard(story: CampaignStory, width: number): string {
  const img = story.imageUrl
    ? `<a href="${esc(story.href)}" style="text-decoration:none;">
        <img src="${esc(story.imageUrl)}" alt="" width="${width}" height="110" style="display:block;width:100%;max-width:${width}px;height:110px;object-fit:cover;border:0;outline:none;" />
      </a>`
    : '';
  return `${img}
      <p style="margin:10px 0 6px;font-family:${FONT};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${RED};font-weight:700;">${esc(story.category)}</p>
      <p style="margin:0;font-family:${DISPLAY};font-size:14px;line-height:1.32;color:${INK};">
        <a href="${esc(story.href)}" style="color:${INK};text-decoration:none;">${esc(trimTitle(story.title, 70))}</a>
      </p>`;
}

function trimTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max).replace(/\s+\S*$/, '');
  return `${cut || title.slice(0, max)}…`;
}

function magazineMark(): string {
  return `<tr>
    <td style="padding:0 28px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BLACK};">
        <tr>
          <td align="center" style="padding:36px 24px;">
            <p style="margin:0 0 8px;font-family:${FONT};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${RED};">Magazine</p>
            <p style="margin:0;font-family:${DISPLAY};font-size:32px;line-height:1.15;color:${WHITE};">L'Entrevue</p>
            <p style="margin:10px 0 0;font-family:${FONT};font-size:13px;color:rgba(255,255,255,0.62);">Autour de l’entrepreneuriat</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function contactBlock(contact?: CampaignContact): string {
  const email = contact?.email?.trim();
  const phone = contact?.phone?.trim();
  const address = contact?.address?.trim();
  const lines: string[] = [];
  if (email) {
    lines.push(
      `<a href="mailto:${esc(email)}" style="color:${WHITE};text-decoration:none;">${esc(email)}</a>`,
    );
  }
  if (phone) {
    const tel = phone.replace(/[^\d+]/g, '');
    lines.push(
      `<a href="tel:${esc(tel)}" style="color:${WHITE};text-decoration:none;">${esc(phone)}</a>`,
    );
  }
  const top = lines.length
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.65;color:${WHITE};">${lines.join('<br />')}</p>`
    : '';
  const addr = address
    ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#a3a3a3;">${esc(address)}</p>`
    : '';
  return `${top}${addr}`;
}

function socialsRow(socials?: CampaignSocialLink[]): string {
  const items = (socials ?? []).filter((item) => item.url?.trim());
  if (items.length === 0) return '';
  const cells = items
    .map((item, i) => {
      const pad = i < items.length - 1 ? 'padding:0 14px 0 0;' : 'padding:0;';
      return `<td style="${pad}vertical-align:middle;">
        <a href="${esc(item.url.trim())}" target="_blank" style="display:block;line-height:0;text-decoration:none;">
          ${socialIconSvg(item.network, item.label)}
        </a>
      </td>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
    <tr>
      ${cells}
    </tr>
  </table>`;
}

function socialIconSvg(network: string | undefined, label: string): string {
  const icon = SOCIAL_ICONS[network ?? ''] ?? SOCIAL_ICONS.other;
  const fillRule = icon.fillRule
    ? ` fill-rule="${icon.fillRule}" clip-rule="${icon.fillRule}"`
    : '';
  const paths = icon.paths
    .map((d) => `<path d="${d}"${fillRule} />`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="${WHITE}" role="img" aria-label="${esc(label || 'Réseau social')}" style="display:block;border:0;outline:none;">${paths}</svg>`;
}

const SOCIAL_ICONS: Record<
  string,
  { paths: string[]; fillRule?: 'evenodd' | 'nonzero' }
> = {
  facebook: {
    paths: [
      'M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951',
    ],
  },
  twitter: {
    paths: [
      'M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z',
    ],
  },
  instagram: {
    paths: [
      'M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334',
    ],
  },
  linkedin: {
    paths: [
      'M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z',
    ],
  },
  youtube: {
    paths: [
      'M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z',
    ],
  },
  tiktok: {
    paths: [
      'M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z',
    ],
  },
  whatsapp: {
    paths: [
      'M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232',
    ],
  },
  telegram: {
    fillRule: 'evenodd',
    paths: [
      'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.287 5.906q-1.168.486-4.666 2.01-.567.225-.595.442c-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294q.39.01.868-.32 3.269-2.206 3.374-2.23c.05-.012.12-.026.166.016s.042.12.037.141c-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8 8 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629q.14.092.27.187c.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.4 1.4 0 0 0-.013-.315.34.34 0 0 0-.114-.217.53.53 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09',
    ],
  },
  threads: {
    fillRule: 'evenodd',
    paths: [
      'M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161',
    ],
  },
  other: {
    paths: [
      'M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z',
      'M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z',
    ],
  },
};

function footerBlock(
  home: string,
  unsubscribeUrl: string,
  contact?: CampaignContact,
  socials?: CampaignSocialLink[],
): string {
  const year = new Date().getFullYear();
  const logo = `${home}/brand/logo-Lentrevue-blanc.png`;
  return `<tr>
    <td style="height:4px;background:${RED};font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td style="background:${BLACK};padding:28px 28px 24px;font-family:${FONT};">
      <a href="${esc(home)}" style="text-decoration:none;">
        <img src="${esc(logo)}" alt="L'Entrevue" height="28" style="display:block;height:28px;width:auto;max-width:160px;border:0;outline:none;" />
      </a>
      <p style="margin:10px 0 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.52);">Autour de l’entrepreneuriat</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr>
          <td style="border-top:1px solid #2a2a2a;font-size:0;line-height:0;height:1px;">&nbsp;</td>
        </tr>
      </table>
      ${contactBlock(contact)}
      ${socialsRow(socials)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
        <tr>
          <td style="border-top:1px solid #2a2a2a;font-size:0;line-height:0;height:1px;">&nbsp;</td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;line-height:1.55;color:#8a8a8a;">
        Envoyé aux inscrits de la newsletter L'Entrevue.
      </p>
      <p style="margin:8px 0 0;font-size:11px;line-height:1.55;">
        <a href="${esc(unsubscribeUrl)}" style="color:#d4d4d4;text-decoration:underline;">Se désinscrire</a>
        <span style="color:#3f3f3f;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
        <a href="${esc(home)}/confidentialite" style="color:#d4d4d4;text-decoration:underline;">Confidentialité</a>
        <span style="color:#3f3f3f;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
        <a href="${esc(home)}/conditions-utilisation" style="color:#d4d4d4;text-decoration:underline;">Conditions</a>
      </p>
      <p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:#6b6b6b;">
        © ${year} L'Entrevue. Tous droits réservés.
      </p>
    </td>
  </tr>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:${RED};">
        <a href="${esc(href)}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${WHITE};text-decoration:none;">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

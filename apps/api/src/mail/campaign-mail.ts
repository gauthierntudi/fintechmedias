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

function socialsRow(home: string, socials?: CampaignSocialLink[]): string {
  const items = (socials ?? []).filter(
    (item) => item.url?.trim() && SOCIAL_ICON_FILES[item.network ?? ''],
  );
  if (items.length === 0) return '';
  const cells = items
    .map((item, i) => {
      const pad = i < items.length - 1 ? 'padding:0 14px 0 0;' : 'padding:0;';
      return `<td style="${pad}vertical-align:middle;">
        <a href="${esc(item.url.trim())}" target="_blank" style="display:block;line-height:0;text-decoration:none;">
          ${socialIconImg(home, item.network, item.label)}
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

function socialIconImg(
  home: string,
  network: string | undefined,
  label: string,
): string {
  const file = SOCIAL_ICON_FILES[network ?? ''];
  if (!file) return '';
  const src = `${home.replace(/\/$/, '')}/social-media/${file}`;
  return `<img src="${esc(src)}" width="20" height="20" alt="${esc(label || 'Réseau social')}" style="display:block;width:20px;height:20px;border:0;outline:none;" />`;
}

const SOCIAL_ICON_FILES: Record<string, string> = {
  instagram: 'instagram.png',
  twitter: 'twitter-x.png',
  linkedin: 'linkedin.png',
  youtube: 'youtube.png',
  whatsapp: 'whatsapp.png',
  facebook: 'facebook.png',
  telegram: 'telegram.png',
  tiktok: 'tiktok.png',
  threads: 'threads.png',
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
      ${socialsRow(home, socials)}
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

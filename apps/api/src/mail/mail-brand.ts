/** Logo des e-mails, servi depuis le CDN public (R2). */

const LOGO_KEY = 'brand/logo-fintech.png';
const LOGO_RATIO = 1003 / 2750;

export function mailLogoUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.R2_PUBLIC_URL || env.R2_URL || 'https://cdn.fintechmedias.com')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/$/, '');
  return `${raw}/${LOGO_KEY}`;
}

export function mailLogoImg(width = 232): string {
  const height = Math.max(1, Math.round(width * LOGO_RATIO));
  const src = mailLogoUrl()
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
  return `<img src="${src}" alt="Fintech Médias" width="${width}" height="${height}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;outline:none;" />`;
}

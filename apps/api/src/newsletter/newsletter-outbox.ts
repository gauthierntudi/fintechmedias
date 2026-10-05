import {
  NewsletterOutboxStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  buildCampaignMail,
  type CampaignContact,
  type CampaignSocialLink,
  type CampaignStory,
} from '../mail/campaign-mail';
import {
  categoryDisplay,
  isMobileOnlyCategory,
} from '../articles/categories';

export const NEWSLETTER_DAILY_LIMIT = 70;
export const NEWSLETTER_TZ = 'Africa/Kinshasa';
export const NEWSLETTER_SEND_INTERVAL_MS = 60_000;
/** Première date prise en compte pour les campagnes « nouvel article ». */
export const NEWSLETTER_ARTICLES_SINCE = new Date('2026-09-01T00:00:00+01:00');

export type NewsletterOutboxDb = PrismaClient | Prisma.TransactionClient;

function articleSinceWhere(): Prisma.ArticleWhereInput {
  return {
    OR: [
      { publishedAt: { gte: NEWSLETTER_ARTICLES_SINCE } },
      { publishedAt: null, createdAt: { gte: NEWSLETTER_ARTICLES_SINCE } },
    ],
  };
}

export function articleIsInNewsletterWindow(article: {
  publishedAt: Date | null;
  createdAt: Date;
}): boolean {
  const when = article.publishedAt ?? article.createdAt;
  return when.getTime() >= NEWSLETTER_ARTICLES_SINCE.getTime();
}

export function readDailyLimit(): number {
  const raw = process.env.NEWSLETTER_DAILY_LIMIT?.trim();
  if (!raw) return NEWSLETTER_DAILY_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1
    ? Math.min(Math.floor(n), 500)
    : NEWSLETTER_DAILY_LIMIT;
}

export function startOfZonedDay(timeZone: string, now = new Date()): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  let utc = Date.parse(`${ymd}T00:00:00.000Z`);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const parts = fmt.formatToParts(new Date(utc));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? '0');
    const clock = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    const target = Date.UTC(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(5, 7)) - 1,
      Number(ymd.slice(8, 10)),
      0,
      0,
      0,
    );
    const delta = target - clock;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export async function enqueueArticleNewsletter(
  prisma: NewsletterOutboxDb,
  articleId: string,
): Promise<{ queued: number; skipped: boolean }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      isPublished: true,
      category: true,
      publishedAt: true,
      createdAt: true,
    },
  });
  if (
    !article?.isPublished ||
    isMobileOnlyCategory(article.category) ||
    !articleIsInNewsletterWindow(article)
  ) {
    return { queued: 0, skipped: true };
  }

  const subscribers = await prisma.newsletterSubscription.findMany({
    where: { isActive: true },
    select: { id: true, email: true },
  });
  if (subscribers.length === 0) return { queued: 0, skipped: false };

  const now = new Date();
  let queued = 0;
  const chunk = 400;
  for (let i = 0; i < subscribers.length; i += chunk) {
    const slice = subscribers.slice(i, i + chunk);
    const result = await prisma.newsletterOutbox.createMany({
      data: slice.map((row) => ({
        articleId,
        subscriptionId: row.id,
        email: row.email,
        status: NewsletterOutboxStatus.PENDING,
        updatedAt: now,
      })),
      skipDuplicates: true,
    });
    queued += result.count;
  }
  return { queued, skipped: false };
}

export async function skipPendingForSubscription(
  prisma: NewsletterOutboxDb,
  subscriptionId: string,
): Promise<number> {
  const res = await prisma.newsletterOutbox.updateMany({
    where: {
      subscriptionId,
      status: {
        in: [NewsletterOutboxStatus.PENDING, NewsletterOutboxStatus.SENDING],
      },
    },
    data: {
      status: NewsletterOutboxStatus.SKIPPED,
      lastError: 'subscription_inactive',
    },
  });
  return res.count;
}

export async function outboxSummary(
  prisma: NewsletterOutboxDb,
  opts?: { dailyLimit?: number; timeZone?: string },
) {
  const dailyLimit = opts?.dailyLimit ?? readDailyLimit();
  const timeZone = opts?.timeZone ?? NEWSLETTER_TZ;
  const since = startOfZonedDay(timeZone);
  const [sentToday, sending, pending, failed] = await Promise.all([
    prisma.newsletterOutbox.count({
      where: {
        status: NewsletterOutboxStatus.SENT,
        sentAt: { gte: since },
      },
    }),
    prisma.newsletterOutbox.count({
      where: { status: NewsletterOutboxStatus.SENDING },
    }),
    prisma.newsletterOutbox.count({
      where: { status: NewsletterOutboxStatus.PENDING },
    }),
    prisma.newsletterOutbox.count({
      where: { status: NewsletterOutboxStatus.FAILED },
    }),
  ]);
  return {
    dailyLimit,
    sentToday,
    remainingToday: Math.max(0, dailyLimit - sentToday - sending),
    pending,
    failed,
    sendingEnabled: await isNewsletterSendingEnabled(prisma),
  };
}

export async function isNewsletterSendingEnabled(
  prisma: NewsletterOutboxDb,
): Promise<boolean> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: 'default' },
    select: { newsletterSendingEnabled: true },
  });
  return row?.newsletterSendingEnabled === true;
}

export async function setNewsletterSendingEnabled(
  prisma: NewsletterOutboxDb,
  enabled: boolean,
): Promise<boolean> {
  const row = await prisma.siteSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      newsletterSendingEnabled: enabled,
    },
    update: { newsletterSendingEnabled: enabled },
    select: { newsletterSendingEnabled: true },
  });
  return row.newsletterSendingEnabled;
}

type CampaignMailer = {
  send: (input: {
    to: string;
    subject: string;
    html: string;
    unsubscribeUrl: string;
  }) => Promise<void>;
  appUrl: string;
  apiUrl: string;
  r2PublicUrl: string | null;
};

export async function drainNewsletterOutbox(
  prisma: PrismaClient,
  mailer: CampaignMailer,
): Promise<{
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  remainingQuota: number;
  paused?: boolean;
}> {
  const dailyLimit = readDailyLimit();
  const since = startOfZonedDay(NEWSLETTER_TZ);
  const enabled = await isNewsletterSendingEnabled(prisma);

  if (!enabled) {
    await prisma.newsletterOutbox.updateMany({
      where: { status: NewsletterOutboxStatus.SENDING },
      data: { status: NewsletterOutboxStatus.PENDING },
    });
    const sentToday = await prisma.newsletterOutbox.count({
      where: {
        status: NewsletterOutboxStatus.SENT,
        sentAt: { gte: since },
      },
    });
    return {
      claimed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      remainingQuota: Math.max(0, dailyLimit - sentToday),
      paused: true,
    };
  }

  await prisma.newsletterOutbox.updateMany({
    where: {
      status: NewsletterOutboxStatus.SENDING,
      updatedAt: { lt: new Date(Date.now() - 10 * 60_000) },
    },
    data: { status: NewsletterOutboxStatus.PENDING },
  });

  await prisma.newsletterOutbox.updateMany({
    where: {
      status: NewsletterOutboxStatus.FAILED,
      attempts: { lt: 3 },
      updatedAt: { lt: new Date(Date.now() - 15 * 60_000) },
    },
    data: { status: NewsletterOutboxStatus.PENDING },
  });

  const sentOrSending = await prisma.newsletterOutbox.count({
    where: {
      OR: [
        {
          status: NewsletterOutboxStatus.SENT,
          sentAt: { gte: since },
        },
        { status: NewsletterOutboxStatus.SENDING },
      ],
    },
  });
  const remainingQuota = Math.max(0, dailyLimit - sentOrSending);
  if (remainingQuota === 0) {
    return { claimed: 0, sent: 0, skipped: 0, failed: 0, remainingQuota: 0 };
  }

  const claimedIds = await claimPendingOutbox(prisma, remainingQuota);
  if (claimedIds.length === 0) {
    return { claimed: 0, sent: 0, skipped: 0, failed: 0, remainingQuota };
  }

  const rows = await prisma.newsletterOutbox.findMany({
    where: { id: { in: claimedIds } },
    include: {
      article: {
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: true,
          coverKey: true,
          isPublished: true,
          publishedAt: true,
        },
      },
      subscription: {
        select: {
          id: true,
          email: true,
          isActive: true,
          unsubscribeToken: true,
        },
      },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = claimedIds
    .map((id) => byId.get(id))
    .filter((row): row is (typeof rows)[number] => Boolean(row));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of ordered) {
    if (!row.article.isPublished || !row.subscription.isActive) {
      await prisma.newsletterOutbox.update({
        where: { id: row.id },
        data: {
          status: NewsletterOutboxStatus.SKIPPED,
          lastError: !row.article.isPublished
            ? 'article_unpublished'
            : 'subscription_inactive',
        },
      });
      skipped += 1;
      continue;
    }

    try {
      const htmlInput = await buildArticleCampaignMail(prisma, mailer, row);
      await mailer.send({
        to: row.subscription.email,
        subject: htmlInput.subject,
        html: htmlInput.html,
        unsubscribeUrl: htmlInput.listUnsubscribeUrl,
      });
      await prisma.newsletterOutbox.update({
        where: { id: row.id },
        data: {
          status: NewsletterOutboxStatus.SENT,
          sentAt: new Date(),
          lastError: null,
          attempts: { increment: 1 },
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      await prisma.newsletterOutbox.update({
        where: { id: row.id },
        data: {
          status: NewsletterOutboxStatus.FAILED,
          attempts: { increment: 1 },
          lastError: (err instanceof Error ? err.message : String(err)).slice(
            0,
            400,
          ),
        },
      });
    }
  }

  return {
    claimed: claimedIds.length,
    sent,
    skipped,
    failed,
    remainingQuota: remainingQuota - sent,
  };
}

async function claimPendingOutbox(
  prisma: PrismaClient,
  limit: number,
): Promise<string[]> {
  if (limit < 1) return [];
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH picked AS (
      SELECT o.id
      FROM newsletter_outbox o
      INNER JOIN articles a ON a.id = o."articleId"
      INNER JOIN newsletter_subscriptions s ON s.id = o."subscriptionId"
      WHERE o.status = 'PENDING'::"NewsletterOutboxStatus"
        AND a."isPublished" = true
        AND s."isActive" = true
      ORDER BY a."publishedAt" DESC NULLS LAST, o."createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE OF o SKIP LOCKED
    )
    UPDATE newsletter_outbox AS o
    SET status = 'SENDING'::"NewsletterOutboxStatus",
        "updatedAt" = NOW()
    FROM picked
    WHERE o.id = picked.id
    RETURNING o.id
  `);
  return rows.map((row) => row.id);
}

const ARTICLE_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  coverKey: true,
  publishedAt: true,
} as const;

export type CampaignArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  coverKey: string | null;
  publishedAt: Date | null;
};

const DEFAULT_CONTACT: CampaignContact = {
  address: '8 Avenue Kalemie, Kinshasa-Gombe',
  email: 'contact@lentrevuemag.com',
  phone: '+243 813 212 772',
};

export async function findLatestPublicArticle(
  prisma: NewsletterOutboxDb,
): Promise<CampaignArticle | null> {
  return prisma.article.findFirst({
    where: {
      isPublished: true,
      NOT: { category: 'stu-short' },
      AND: [articleSinceWhere()],
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: ARTICLE_SELECT,
  });
}

export async function composeArticleCampaign(
  prisma: NewsletterOutboxDb,
  article: CampaignArticle,
  opts: {
    appUrl: string;
    r2PublicUrl: string | null;
    unsubscribeUrl: string;
    kicker?: string;
    subjectPrefix?: string;
  },
): Promise<{ subject: string; html: string; unsubscribeUrl: string }> {
  const home = opts.appUrl.replace(/\/$/, '') || 'https://lentrevuemag.com';
  const href = `${home}/article/${encodeURIComponent(article.slug)}`;
  const featured: CampaignStory = {
    category: categoryDisplay(article.category).label,
    title: article.title,
    excerpt:
      article.excerpt?.trim() ||
      'Un nouvel article vient de paraître sur L’Entrevue.',
    href,
    imageUrl: mediaUrl(article.coverKey, opts.r2PublicUrl, home) ?? undefined,
  };

  const related = await prisma.article.findMany({
    where: {
      isPublished: true,
      id: { not: article.id },
      NOT: { category: 'stu-short' },
      AND: [articleSinceWhere()],
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      category: true,
      coverKey: true,
    },
  });

  const stories: CampaignStory[] = [
    featured,
    ...related.map((item) => ({
      category: categoryDisplay(item.category).label,
      title: item.title,
      excerpt: item.excerpt?.trim() || '',
      href: `${home}/article/${encodeURIComponent(item.slug)}`,
      imageUrl: mediaUrl(item.coverKey, opts.r2PublicUrl, home) ?? undefined,
    })),
  ];

  const footer = await loadCampaignFooter(prisma);
  const when = article.publishedAt ?? new Date();
  const subject = `${opts.subjectPrefix ?? ''}${article.title} — L'Entrevue`;
  const html = buildCampaignMail({
    appUrl: home,
    kind: 'article',
    subject,
    preheader: featured.excerpt,
    kicker: opts.kicker ?? 'Nouvel article',
    dateLabel: formatMonthYear(when),
    headline: article.title,
    lead: featured.excerpt,
    stories,
    cta: { label: "Lire l'article", href },
    unsubscribeUrl: opts.unsubscribeUrl,
    contact: footer.contact,
    socials: footer.socials,
  });
  return { subject, html, unsubscribeUrl: opts.unsubscribeUrl };
}

async function loadCampaignFooter(prisma: NewsletterOutboxDb): Promise<{
  contact: CampaignContact;
  socials: CampaignSocialLink[];
}> {
  const row = await prisma.siteSettings.findUnique({
    where: { id: 'default' },
    select: {
      contactAddress: true,
      contactEmail: true,
      contactPhone: true,
      socialLinks: true,
    },
  });
  return {
    contact: {
      address: row?.contactAddress?.trim() || DEFAULT_CONTACT.address,
      email: row?.contactEmail?.trim() || DEFAULT_CONTACT.email,
      phone: row?.contactPhone?.trim() || DEFAULT_CONTACT.phone,
    },
    socials: parseCampaignSocials(row?.socialLinks),
  };
}

function parseCampaignSocials(value: Prisma.JsonValue | undefined | null): CampaignSocialLink[] {
  if (!Array.isArray(value)) return [];
  const out: CampaignSocialLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const url = String(rec.url ?? '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const network = String(rec.network ?? '').trim();
    const label =
      (typeof rec.label === 'string' && rec.label.trim()) ||
      network ||
      'Réseau';
    out.push({
      label,
      url,
      network: network || undefined,
    });
  }
  return out;
}

async function buildArticleCampaignMail(
  prisma: NewsletterOutboxDb,
  mailer: CampaignMailer,
  row: {
    article: CampaignArticle;
    subscription: { unsubscribeToken: string };
  },
): Promise<{
  subject: string;
  html: string;
  unsubscribeUrl: string;
  listUnsubscribeUrl: string;
}> {
  const home = mailer.appUrl.replace(/\/$/, '') || 'https://lentrevuemag.com';
  const unsubscribeUrl = `${home}/newsletter/desinscription?token=${encodeURIComponent(row.subscription.unsubscribeToken)}`;
  const apiHome = mailer.apiUrl.replace(/\/$/, '') || home;
  const listUnsubscribeUrl = `${apiHome}/api/newsletter/unsubscribe?token=${encodeURIComponent(row.subscription.unsubscribeToken)}`;
  const composed = await composeArticleCampaign(prisma, row.article, {
    appUrl: home,
    r2PublicUrl: mailer.r2PublicUrl,
    unsubscribeUrl,
  });
  return {
    ...composed,
    listUnsubscribeUrl,
  };
}

function mediaUrl(
  key: string | null,
  r2PublicUrl: string | null,
  appUrl: string,
): string | null {
  if (!key?.trim()) return null;
  const trimmed = key.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('/')) {
    const base = r2PublicUrl?.replace(/\/$/, '');
    return base ? `${base}/${trimmed.replace(/^\//, '')}` : null;
  }
  return `${appUrl.replace(/\/$/, '')}/legacy/articles/${encodeURIComponent(trimmed)}`;
}

function formatMonthYear(date: Date): string {
  const raw = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: NEWSLETTER_TZ,
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

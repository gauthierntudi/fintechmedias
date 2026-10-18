import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityActorType, Prisma, VideoStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ActivityService } from '../activity/activity.service';
import { NewsletterOutboxService } from '../newsletter/newsletter-outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  headR2Object,
  presignR2PutObject,
  putR2Object,
} from '../storage/r2';
import {
  ArticleBlockInputDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/admin-article.dto';
import {
  ARTICLE_VIDEO_MAX_BYTES,
  CompleteArticleVideoDto,
  PresignArticleVideoDto,
} from './dto/admin-article-video.dto';
import { enqueueArticleVideo } from './video/article-video.queue';
import { videoSourcePrefix } from './video/process-article-video';
import {
  CATEGORY_META,
  FEATURED_TTL_DAYS,
  SHORT_CATEGORY_SLUG,
  categoryDisplay,
  categoryQuerySlugs,
  publicSiteCategorySlugs,
  resolveCategorySlug,
} from './categories';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const BLOCK_SELECT = {
  id: true,
  position: true,
  title: true,
  coverKey: true,
  coverCaption: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArticleBlockSelect;

const MAGAZINE_SUMMARY_SELECT = {
  id: true,
  title: true,
  issueNumber: true,
  coverKey: true,
  publishedAt: true,
  isPublished: true,
  isActive: true,
  theme: true,
} satisfies Prisma.MagazineSelect;

const SPONSOR_SUMMARY_SELECT = {
  id: true,
  name: true,
  logoKey: true,
  url: true,
} satisfies Prisma.SponsorSelect;

const AUTHOR_SUMMARY_SELECT = {
  id: true,
  name: true,
  title: true,
  avatarKey: true,
  adminUserId: true,
} satisfies Prisma.AuthorSelect;

const ARTICLE_SELECT = {
  id: true,
  legacyId: true,
  title: true,
  slug: true,
  content: true,
  excerpt: true,
  coverKey: true,
  coverCaption: true,
  category: true,
  viewCount: true,
  isPublished: true,
  isFeatured: true,
  featuredAt: true,
  authorId: true,
  bylineAuthorId: true,
  magazineId: true,
  sponsorId: true,
  videoSourceKey: true,
  videoHlsKey: true,
  videoPosterKey: true,
  videoStatus: true,
  videoError: true,
  videoDurationSec: true,
  youtubeUrl: true,
  isPaid: true,
  priceCents: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarKey: true,
    },
  },
  bylineAuthor: {
    select: AUTHOR_SUMMARY_SELECT,
  },
  magazine: {
    select: MAGAZINE_SUMMARY_SELECT,
  },
  sponsor: {
    select: SPONSOR_SUMMARY_SELECT,
  },
  blocks: {
    orderBy: { position: 'asc' as const },
    select: BLOCK_SELECT,
  },
  _count: {
    select: { comments: true },
  },
} satisfies Prisma.ArticleSelect;

const PUBLIC_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverKey: true,
  category: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  videoHlsKey: true,
  videoPosterKey: true,
  videoStatus: true,
  videoDurationSec: true,
  author: { select: { name: true, avatarKey: true } },
  bylineAuthor: { select: { name: true, avatarKey: true } },
  sponsor: {
    select: SPONSOR_SUMMARY_SELECT,
  },
} satisfies Prisma.ArticleSelect;

type PublicCardRow = Prisma.ArticleGetPayload<{
  select: typeof PUBLIC_CARD_SELECT;
}>;

function featuredWindowStart(now = new Date()) {
  return new Date(now.getTime() - FEATURED_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function shuffleRows<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = out[i];
    const swap = out[j];
    if (current === undefined || swap === undefined) continue;
    out[i] = swap;
    out[j] = current;
  }
  return out;
}

function pickLatestOnePerSiteCategory(groups: PublicCardRow[][]): PublicCardRow[] {
  const picked = groups
    .map((list) => list[0])
    .filter((row): row is PublicCardRow => Boolean(row));
  const seen = new Set<string>();
  const unique = picked.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  unique.sort((a, b) => {
    const da = (a.publishedAt ?? a.createdAt).getTime();
    const db = (b.publishedAt ?? b.createdAt).getTime();
    return db - da;
  });
  return unique;
}

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
    private readonly newsletterOutbox: NewsletterOutboxService,
  ) {}

  async list(
    filters: {
      q?: string;
      published?: string;
      category?: string;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const q = filters.q?.trim();
    const published = this.parseBool(filters.published);
    const category = filters.category?.trim() || undefined;
    const take = Math.min(Math.max(filters.take ?? 10, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);

    const where: Prisma.ArticleWhereInput = {
      ...(published !== undefined ? { isPublished: published } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { slug: { contains: q } },
              { excerpt: { contains: q } },
              { category: { contains: q } },
              { blocks: { some: { title: { contains: q } } } },
            ],
          }
        : {}),
    };

    const [items, total, summary] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
        select: ARTICLE_SELECT,
      }),
      this.prisma.article.count({ where }),
      this.summaryCounts(),
    ]);

    return {
      items: items.map((a) => this.toAdmin(a)),
      total,
      take,
      skip,
      summary,
    };
  }

  async getById(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: ARTICLE_SELECT,
    });
    if (!article) {
      throw new NotFoundException('Actualité introuvable');
    }
    return this.toAdmin(article);
  }


  private readonly publicCardSelect = PUBLIC_CARD_SELECT;

  private readonly notShort: Prisma.ArticleWhereInput = {
    NOT: { category: SHORT_CATEGORY_SLUG },
  };

  async getHomeFeed() {
    const published: Prisma.ArticleWhereInput = {
      isPublished: true,
      ...this.notShort,
    };

    const featuredSince = featuredWindowStart();
    const missSince = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const [
      featuredRows,
      recent,
      actualites,
      interview,
      economie,
      politique,
      international,
      portrait,
      entreprise,
      events,
      plusVus,
      aNePasManquer,
    ] = await Promise.all([
      this.prisma.article.findMany({
        where: {
          ...published,
          isFeatured: true,
          featuredAt: { gte: featuredSince },
        },
        orderBy: [{ featuredAt: 'desc' }, { publishedAt: 'desc' }],
        take: 60,
        select: this.publicCardSelect,
      }),
      this.prisma.article.findMany({
        where: published,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 16,
        select: this.publicCardSelect,
      }),
      this.byCategory('actualites', 10),
      this.byCategory('interview', 4),
      this.byCategory('economie', 10),
      this.byCategory('politique', 5),
      this.byCategory('international', 5),
      this.byCategory('portrait', 5),
      this.byCategory('entreprise', 5),
      this.byCategory('events', 5),
      this.prisma.article.findMany({
        where: published,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: 3,
        select: this.publicCardSelect,
      }),
      this.prisma.article.findMany({
        where: {
          ...published,
          publishedAt: { gte: missSince },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 3,
        select: this.publicCardSelect,
      }),
    ]);

    const latestBySlug: Record<string, PublicCardRow[]> = {
      actualites,
      interview,
      economie,
      politique,
      international,
      portrait,
      entreprise,
      events,
    };
    const featured: PublicCardRow[] =
      featuredRows.length > 0
        ? shuffleRows(featuredRows)
        : pickLatestOnePerSiteCategory(
            publicSiteCategorySlugs().map((slug) => latestBySlug[slug] ?? []),
          );
    const filInfo = recent.slice(0, 5);
    const featuredIds = new Set(featured.map((a) => a.id));
    const topGridRows =
      featured.length > 1
        ? featured.slice(1, 5)
        : recent.filter((a) => !featuredIds.has(a.id)).slice(0, 4);

    return {
      featured: featured.map((a) => this.toPublicCard(a)),
      topGrid: topGridRows.map((a) => this.toPublicCard(a)),
      actualites: actualites.map((a) => this.toPublicCard(a)),
      interview: interview.map((a) => this.toPublicCard(a)),
      economie: economie.map((a) => this.toPublicCard(a)),
      politique: politique.map((a) => this.toPublicCard(a)),
      international: international.map((a) => this.toPublicCard(a)),
      portrait: portrait.map((a) => this.toPublicCard(a)),
      entreprise: entreprise.map((a) => this.toPublicCard(a)),
      events: events.map((a) => this.toPublicCard(a)),
      filInfo: filInfo.map((a) => this.toPublicCard(a)),
      // Clés historiques lues par l’app mobile encore sur l’ancien découpage.
      ecosystemePme: actualites.map((a) => this.toPublicCard(a)),
      entreprendre: entreprise.map((a) => this.toPublicCard(a)),
      rencontreAvec: interview.map((a) => this.toPublicCard(a)),
      expert: international.map((a) => this.toPublicCard(a)),
      femme: portrait.map((a) => this.toPublicCard(a)),
      innovation: economie.map((a) => this.toPublicCard(a)),
      plusVus: plusVus.map((a) => this.toPublicCard(a)),
      aNePasManquer: aNePasManquer.map((a) => this.toPublicCard(a)),
    };
  }

  /** Derniers articles publiés (footer, widgets). */
  async listRecentPublished(take = 3) {
    const limit = Math.min(Math.max(take, 1), 12);
    const items = await this.prisma.article.findMany({
      where: { isPublished: true, ...this.notShort },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: this.publicCardSelect,
    });
    return {
      items: items.map((a) => this.toPublicCard(a)),
    };
  }

  /** Suggestions aléatoires (header search au focus). */
  async listRandomPublished(take = 10) {
    const limit = Math.min(Math.max(take, 1), 10);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM articles
      WHERE "isPublished" = true
        AND (category IS NULL OR category <> ${SHORT_CATEGORY_SLUG})
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
    if (rows.length === 0) {
      return { items: [] };
    }

    const ids = rows.map((r) => r.id);
    const found = await this.prisma.article.findMany({
      where: { id: { in: ids }, isPublished: true },
      select: this.publicCardSelect,
    });
    const byId = new Map(found.map((a) => [a.id, a]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => this.toPublicCard(a));

    return { items };
  }

  /** Recherche publique — header live (take≤10) ou page résultats (paginée). */
  async searchPublished(
    rawQ: string,
    take = 10,
    rawCategory?: string,
    skip = 0,
  ) {
    const q = rawQ.trim();
    const limit = Math.min(Math.max(take, 1), 24);
    const offset = Math.max(skip, 0);
    if (q.length < 2) {
      return {
        items: [],
        total: 0,
        q,
        category: null as string | null,
        take: limit,
        skip: offset,
      };
    }

    const category = rawCategory
      ? resolveCategorySlug(rawCategory)
      : null;

    const where: Prisma.ArticleWhereInput = {
      isPublished: true,
      ...(category
        ? { category: { in: categoryQuerySlugs(category) } }
        : this.notShort),
      OR: [
        { title: { contains: q } },
        { slug: { contains: q } },
        { excerpt: { contains: q } },
        ...(category
          ? []
          : [{ category: { contains: q } }]),
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: this.publicCardSelect,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      items: items.map((a) => this.toPublicCard(a)),
      total,
      q,
      category,
      take: limit,
      skip: offset,
    };
  }

  /** Classement global des plus lus (sidebar recherche, widgets). */
  async listMostReadPublished(take = 5) {
    const limit = Math.min(Math.max(take, 1), 10);
    const items = await this.prisma.article.findMany({
      where: { isPublished: true, ...this.notShort },
      orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      select: this.publicCardSelect,
    });
    return {
      items: items.map((a) => this.toPublicCard(a)),
    };
  }

  /** Fil d’actualités global (tous les articles publiés, paginé). */
  async listPublishedFeed(take = 12, skip = 0) {
    const limit = Math.min(Math.max(take, 1), 48);
    const offset = Math.max(skip, 0);
    const where: Prisma.ArticleWhereInput = {
      isPublished: true,
      ...this.notShort,
    };

    const [total, items, mostRead] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: this.publicCardSelect,
      }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
        select: this.publicCardSelect,
      }),
    ]);

    return {
      category: 'actualites',
      label: 'Actualités',
      tone: 'red',
      items: items.map((a) => this.toPublicCard(a)),
      mostRead: mostRead.map((a) => this.toPublicCard(a)),
      total,
      take: limit,
      skip: offset,
    };
  }

  /** Catalogue public d’une rubrique (paginé). */
  async listByCategory(rawSlug: string, take = 12, skip = 0) {
    const slug = resolveCategorySlug(rawSlug);
    if (!slug) {
      throw new NotFoundException('Rubrique introuvable');
    }
    const meta = CATEGORY_META[slug]!;
    const limit = Math.min(Math.max(take, 1), 48);
    const offset = Math.max(skip, 0);
    const where = {
      isPublished: true,
      category: { in: categoryQuerySlugs(slug) },
    };

    const [total, items, mostRead] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: this.publicCardSelect,
      }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
        select: this.publicCardSelect,
      }),
    ]);

    return {
      category: slug,
      label: meta.label,
      tone: meta.tone,
      items: items.map((a) => this.toPublicCard(a)),
      mostRead: mostRead.map((a) => this.toPublicCard(a)),
      total,
      take: limit,
      skip: offset,
    };
  }


  /** Autres articles (même rubrique en priorité), hors article courant. */
  async listRelatedPublished(slug: string, take = 6) {
    const limit = Math.min(Math.max(take, 1), 12);
    const current = await this.prisma.article.findFirst({
      where: { slug, isPublished: true },
      select: { id: true, category: true },
    });
    if (!current) {
      return { items: [] };
    }

    const orderBy = [
      { publishedAt: 'desc' as const },
      { createdAt: 'desc' as const },
    ];

    const relatedCategory = current.category
      ? resolveCategorySlug(current.category)
      : null;

    let items = relatedCategory
      ? await this.prisma.article.findMany({
          where: {
            isPublished: true,
            category: { in: categoryQuerySlugs(relatedCategory) },
            id: { not: current.id },
          },
          orderBy,
          take: limit,
          select: this.publicCardSelect,
        })
      : [];

    if (items.length < limit && relatedCategory !== SHORT_CATEGORY_SLUG) {
      const fill = await this.prisma.article.findMany({
        where: {
          isPublished: true,
          ...this.notShort,
          id: { notIn: [current.id, ...items.map((a) => a.id)] },
        },
        orderBy,
        take: limit - items.length,
        select: this.publicCardSelect,
      });
      items = [...items, ...fill];
    }

    return {
      items: items.map((a) => this.toPublicCard(a)),
    };
  }

  async getPublishedSlugByLegacyId(raw: string) {
    const legacyId = Number(raw);
    if (!Number.isInteger(legacyId) || legacyId <= 0) {
      throw new NotFoundException('Article introuvable');
    }
    const article = await this.prisma.article.findFirst({
      where: { legacyId, isPublished: true },
      select: { slug: true },
    });
    if (!article) {
      throw new NotFoundException('Article introuvable');
    }
    return { slug: article.slug };
  }

  async getPublishedBySlug(
    slug: string,
    reader?: { subscriberId?: string | null; staff?: boolean },
  ) {
    const article = await this.prisma.article.findFirst({
      where: { slug, isPublished: true },
      select: ARTICLE_SELECT,
    });
    if (!article) {
      throw new NotFoundException('Article introuvable');
    }
    void this.prisma.article
      .update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => undefined);

    const bodyPlain = htmlToPlain(
      [article.content, ...article.blocks.map((b) => `${b.title ?? ''} ${b.content}`)]
        .filter(Boolean)
        .join(' '),
    );
    const plain = bodyPlain;
    const corpus = [
      article.youtubeUrl,
      article.content,
      ...article.blocks.map((b) => b.content),
    ]
      .filter(Boolean)
      .join('\n');
    const storedVideo = article.youtubeUrl?.trim() ?? '';
    const storedKind = classifyStoredVideo(storedVideo);
    const youtubeUrl =
      storedKind === 'hosted'
        ? null
        : storedKind === 'youtube'
          ? youtubeUrlFromText(storedVideo)
          : youtubeUrlFromText(corpus);
    const hostedVideoUrl =
      storedKind === 'hosted'
        ? storedVideo
        : youtubeUrl
          ? null
          : hostedVideoFromText(corpus);
    const tags = articleTags(article.title, plain);
    const readingMinutes = Math.max(1, Math.ceil(wordCount(plain) / 200));
    const [previous, next] = await this.neighborArticles(article);
    const locked = article.isPaid
      ? !(
          reader?.staff ||
          (await this.readerCanAccessPaidArticle(
            article.id,
            reader?.subscriberId ?? null,
          ))
        )
      : false;

    const view = this.toAdmin(article, { publicMagazineOnly: true });
    const teaser = locked ? `${plain.replace(/\s+/g, ' ').trim().slice(0, 350)}…` : null;

    return {
      ...view,
      youtubeUrl,
      videoHlsUrl: view.videoHlsUrl || hostedVideoUrl,
      tags,
      readingMinutes,
      isPaid: article.isPaid,
      priceCents: article.priceCents ?? 100,
      locked,
      content: teaser ? `<p>${escapeHtml(teaser)}</p>` : view.content,
      blocks: teaser
        ? [
            {
              id: null,
              position: 0,
              title: null,
              coverKey: null,
              coverCaption: null,
              coverUrl: null,
              content: `<p>${escapeHtml(teaser)}</p>`,
              createdAt: view.createdAt,
              updatedAt: view.updatedAt,
            },
          ]
        : view.blocks,
      previous: previous
        ? {
            slug: previous.slug,
            title: previous.title,
            coverUrl: this.resolveMediaUrl(previous.coverKey),
          }
        : null,
      next: next
        ? {
            slug: next.slug,
            title: next.title,
            coverUrl: this.resolveMediaUrl(next.coverKey),
          }
        : null,
    };
  }

  private async neighborArticles(article: {
    id: string;
    publishedAt: Date | null;
    createdAt: Date;
  }) {
    const cursor = article.publishedAt ?? article.createdAt;
    const base = { isPublished: true, ...this.notShort, id: { not: article.id } };
    return Promise.all([
      this.prisma.article.findFirst({
        where: { ...base, publishedAt: { lt: cursor } },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        select: { slug: true, title: true, coverKey: true },
      }),
      this.prisma.article.findFirst({
        where: { ...base, publishedAt: { gt: cursor } },
        orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
        select: { slug: true, title: true, coverKey: true },
      }),
    ]);
  }

  private async readerCanAccessPaidArticle(
    articleId: string,
    subscriberId: string | null,
  ) {
    if (!subscriberId) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [subscription, purchase] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: {
          subscriberId,
          status: 'ACTIVE',
          paymentStatus: 'SUCCESS',
          expiresAt: { gte: today },
        },
        select: { id: true },
      }),
      this.prisma.articlePurchase.findFirst({
        where: {
          subscriberId,
          articleId,
          paymentStatus: 'SUCCESS',
        },
        select: { id: true },
      }),
    ]);
    return Boolean(subscription || purchase);
  }

  private byCategory(category: string, take: number) {
    return this.prisma.article.findMany({
      where: {
        isPublished: true,
        category: { in: categoryQuerySlugs(category) },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      select: this.publicCardSelect,
    });
  }

  private toPublicCard(
    article: Prisma.ArticleGetPayload<{ select: typeof PUBLIC_CARD_SELECT }>,
  ) {
    const meta = categoryDisplay(article.category);
    const when = article.publishedAt ?? article.createdAt;
    const byline = article.bylineAuthor ?? article.author;

    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      coverUrl: this.resolveMediaUrl(article.coverKey),
      category: article.category,
      categoryLabel: meta.label,
      categoryTone: meta.tone,
      authorName: byline?.name?.trim() || 'Fintech Médias',
      authorAvatarUrl: this.resolveMediaUrl(byline?.avatarKey ?? null),
      publishedAt: article.publishedAt?.toISOString() ?? null,
      dateLabel: new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(when),
      viewCount: article.viewCount,
      videoHlsUrl:
        article.videoStatus === 'READY'
          ? this.resolveMediaUrl(article.videoHlsKey)
          : null,
      videoPosterUrl: this.resolveMediaUrl(article.videoPosterKey),
      videoStatus: article.videoStatus,
      videoDurationSec: article.videoDurationSec,
      sponsor: article.sponsor
        ? {
            id: article.sponsor.id,
            name: article.sponsor.name,
            logoUrl: this.resolveMediaUrl(article.sponsor.logoKey),
            url: article.sponsor.url,
          }
        : null,
    };
  }

  async create(dto: CreateArticleDto, actorId: string) {
    const title = dto.title.trim();
    const slug = await this.ensureUniqueSlug(
      dto.slug?.trim() || this.slugify(title),
    );
    const isPublished = Boolean(dto.isPublished);
    const isFeatured = Boolean(dto.isFeatured);
    const blocks = this.normalizeBlocks(dto.blocks);
    const content =
      dto.content?.trim() ||
      this.mirrorContentFromBlocks(blocks) ||
      '';

    const magazineId = await this.resolveMagazineId(dto.magazineId);
    const sponsorId = await this.resolveSponsorId(dto.sponsorId);
    const bylineAuthorId =
      (await this.resolveBylineAuthorId(dto.bylineAuthorId)) ??
      (await this.ensureAuthorIdForAdmin(actorId));

    const created = await this.prisma.$transaction(async (tx) => {
      const article = await tx.article.create({
        data: {
          title,
          slug,
          content,
          excerpt: dto.excerpt.trim(),
          category: dto.category?.trim() || null,
          coverCaption: dto.coverCaption?.trim() || null,
          isPublished,
          isFeatured,
          featuredAt: isFeatured ? new Date() : null,
          publishedAt:
            this.parsePublishedAt(dto.publishedAt) ??
            (isPublished ? new Date() : null),
          authorId: actorId,
          ...(magazineId ? { magazineId } : {}),
          ...(sponsorId ? { sponsorId } : {}),
          ...(bylineAuthorId ? { bylineAuthorId } : {}),
        },
        select: { id: true },
      });

      if (blocks.length > 0) {
        await tx.articleBlock.createMany({
          data: blocks.map((b, i) => ({
            articleId: article.id,
            position: i,
            title: b.title,
            coverCaption: b.coverCaption,
            content: b.content,
          })),
        });
      }

      return tx.article.findUniqueOrThrow({
        where: { id: article.id },
        select: ARTICLE_SELECT,
      });
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_created',
      entity: 'article',
      entityId: created.id,
      meta: {
        title: created.title,
        slug: created.slug,
        isPublished: created.isPublished,
        blocks: created.blocks.length,
      },
    });

    if (created.isPublished) {
      void this.newsletterOutbox.enqueueForArticle(created.id);
    }

    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateArticleDto, actorId: string) {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        isPublished: true,
        publishedAt: true,
        isFeatured: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Actualité introuvable');
    }

    const data: Prisma.ArticleUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.excerpt !== undefined) {
      data.excerpt = dto.excerpt?.trim() || null;
    }
    if (dto.category !== undefined) {
      data.category = dto.category?.trim() || null;
    }
    if (dto.coverCaption !== undefined) {
      data.coverCaption = dto.coverCaption?.trim() || null;
    }
    if (dto.content !== undefined && dto.blocks === undefined) {
      data.content = dto.content;
    }

    if (dto.slug !== undefined) {
      const nextSlug = await this.ensureUniqueSlug(
        dto.slug.trim() || this.slugify(dto.title?.trim() || existing.slug),
        id,
      );
      data.slug = nextSlug;
    }

    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }

    if (dto.publishedAt !== undefined) {
      const parsed = this.parsePublishedAt(dto.publishedAt);
      if (parsed) data.publishedAt = parsed;
      else if (dto.publishedAt === null) data.publishedAt = null;
    } else if (dto.isPublished && !existing.publishedAt) {
      data.publishedAt = new Date();
    }

    if (dto.isFeatured !== undefined) {
      data.isFeatured = dto.isFeatured;
      if (dto.isFeatured && !existing.isFeatured) {
        data.featuredAt = new Date();
      } else if (!dto.isFeatured) {
        data.featuredAt = null;
      }
    }

    if (dto.magazineId !== undefined) {
      const magazineId = await this.resolveMagazineId(dto.magazineId);
      data.magazine = magazineId
        ? { connect: { id: magazineId } }
        : { disconnect: true };
    }

    if (dto.sponsorId !== undefined) {
      const sponsorId = await this.resolveSponsorId(dto.sponsorId);
      data.sponsor = sponsorId
        ? { connect: { id: sponsorId } }
        : { disconnect: true };
    }

    if (dto.bylineAuthorId !== undefined) {
      const bylineAuthorId =
        (await this.resolveBylineAuthorId(dto.bylineAuthorId)) ??
        (await this.ensureAuthorIdForAdmin(actorId));
      data.bylineAuthor = bylineAuthorId
        ? { connect: { id: bylineAuthorId } }
        : { disconnect: true };
    }

    const syncBlocks = dto.blocks !== undefined;
    const blocks = syncBlocks ? this.normalizeBlocks(dto.blocks) : null;

    if (!syncBlocks && Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (syncBlocks && blocks) {
        data.content = this.mirrorContentFromBlocks(blocks);

        const keepIds = blocks
          .map((b) => b.id)
          .filter((blockId): blockId is string => Boolean(blockId));

        await tx.articleBlock.deleteMany({
          where: {
            articleId: id,
            ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
          },
        });

        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]!;
          if (b.id) {
            const owned = await tx.articleBlock.findFirst({
              where: { id: b.id, articleId: id },
              select: { id: true },
            });
            if (!owned) {
              throw new BadRequestException(`Bloc introuvable: ${b.id}`);
            }
            await tx.articleBlock.update({
              where: { id: b.id },
              data: {
                position: i,
                title: b.title,
                coverCaption: b.coverCaption,
                content: b.content,
              },
            });
          } else {
            await tx.articleBlock.create({
              data: {
                articleId: id,
                position: i,
                title: b.title,
                coverCaption: b.coverCaption,
                content: b.content,
              },
            });
          }
        }
      }

      if (Object.keys(data).length > 0) {
        await tx.article.update({ where: { id }, data });
      }

      return tx.article.findUniqueOrThrow({
        where: { id },
        select: ARTICLE_SELECT,
      });
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_updated',
      entity: 'article',
      entityId: updated.id,
      meta: {
        title: updated.title,
        slug: updated.slug,
        isPublished: updated.isPublished,
        blocks: updated.blocks.length,
      },
    });

    if (updated.isPublished && !existing.isPublished) {
      void this.newsletterOutbox.enqueueForArticle(updated.id);
    }

    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        coverKey: true,
        blocks: { select: { coverKey: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Actualité introuvable');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({ where: { articleId: id } });
      await tx.article.delete({ where: { id } });
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_deleted',
      entity: 'article',
      entityId: id,
      meta: {
        title: existing.title,
        slug: existing.slug,
        hadCover: Boolean(existing.coverKey),
        blocks: existing.blocks.length,
      },
    });

    return { ok: true as const };
  }

  async uploadCover(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    this.assertImageFile(file);

    const key = await this.putImage(`articles/${id}`, file);

    const updated = await this.prisma.article.update({
      where: { id },
      data: { coverKey: key },
      select: ARTICLE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_cover_uploaded',
      entity: 'article',
      entityId: id,
      meta: { coverKey: key, size: file.size },
    });

    return this.toAdmin(updated);
  }

  private videoExt(
    filename: string,
    contentType: string | undefined,
  ): 'mp4' | 'mov' | 'webm' | 'm4v' {
    const name = filename.toLowerCase();
    const mime = (contentType ?? '').toLowerCase();
    if (name.endsWith('.mov') || mime.includes('quicktime')) return 'mov';
    if (name.endsWith('.webm') || mime.includes('webm')) return 'webm';
    if (name.endsWith('.m4v') || mime.includes('x-m4v')) return 'm4v';
    if (
      name.endsWith('.mp4') ||
      mime.includes('mp4') ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream' ||
      !mime
    ) {
      return 'mp4';
    }
    throw new BadRequestException(
      'Formats vidéo : MP4, MOV, WEBM (max 500 Mo)',
    );
  }

  async presignVideo(
    id: string,
    dto: PresignArticleVideoDto,
    _actorId: string,
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true, category: true },
    });
    if (!article) throw new NotFoundException('Article introuvable');
    if (dto.size > ARTICLE_VIDEO_MAX_BYTES) {
      throw new BadRequestException('La vidéo dépasse 500 Mo');
    }

    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }

    const ext = this.videoExt(dto.filename, dto.contentType);
    const contentType = contentTypeForExt(ext);
    const key = `${videoSourcePrefix(id)}source.${ext}`;
    const expiresIn = 1800;
    const signed = presignR2PutObject(r2, {
      key,
      contentType,
      expiresInSeconds: expiresIn,
    });

    return {
      key: signed.key,
      uploadUrl: signed.uploadUrl,
      headers: signed.headers,
      expiresIn,
      maxSize: ARTICLE_VIDEO_MAX_BYTES,
    };
  }

  async completeVideo(
    id: string,
    dto: CompleteArticleVideoDto,
    actorId: string,
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true, category: true },
    });
    if (!article) throw new NotFoundException('Article introuvable');

    const key = dto.key.replace(/^\//, '');
    const prefix = videoSourcePrefix(id);
    if (!key.startsWith(prefix) || key.includes('..')) {
      throw new BadRequestException('Clé R2 invalide pour cet article');
    }
    if (dto.size > ARTICLE_VIDEO_MAX_BYTES) {
      throw new BadRequestException('La vidéo dépasse 500 Mo');
    }

    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }

    const meta = await headR2Object(r2, key);
    if (!meta) {
      throw new BadRequestException(
        'Fichier introuvable sur R2 — upload incomplet ?',
      );
    }
    const remoteSize = meta.contentLength ?? 0;
    if (remoteSize <= 0) {
      throw new BadRequestException('Fichier R2 vide');
    }
    if (Math.abs(remoteSize - dto.size) > 1024) {
      throw new BadRequestException(
        `Taille R2 incohérente (${remoteSize} ≠ ${dto.size})`,
      );
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        videoSourceKey: key,
        videoStatus: VideoStatus.PENDING,
        videoError: null,
        videoHlsKey: null,
      },
      select: ARTICLE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_video_uploaded',
      entity: 'article',
      entityId: id,
      meta: { videoSourceKey: key, size: remoteSize },
    });

    void enqueueArticleVideo(id).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[article-video] enqueue failed for ${id}`, err);
    });

    return this.toAdmin(updated);
  }

  async reprocessVideo(id: string, actorId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true, videoSourceKey: true },
    });
    if (!article) throw new NotFoundException('Article introuvable');
    if (!article.videoSourceKey) {
      throw new BadRequestException('Aucune vidéo source à retravailler');
    }

    await this.prisma.article.update({
      where: { id },
      data: {
        videoStatus: VideoStatus.PENDING,
        videoError: null,
      },
    });

    await enqueueArticleVideo(id, { force: true });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_video_reprocess',
      entity: 'article',
      entityId: id,
    });

    return this.getById(id);
  }

  async clearVideo(id: string, actorId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Article introuvable');

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        videoSourceKey: null,
        videoHlsKey: null,
        videoPosterKey: null,
        videoStatus: VideoStatus.NONE,
        videoError: null,
        videoDurationSec: null,
      },
      select: ARTICLE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_video_cleared',
      entity: 'article',
      entityId: id,
    });

    return this.toAdmin(updated);
  }

  async uploadBlockCover(
    articleId: string,
    blockId: string,
    file: UploadFile,
    actorId: string,
  ) {
    const block = await this.prisma.articleBlock.findFirst({
      where: { id: blockId, articleId },
      select: { id: true },
    });
    if (!block) {
      throw new NotFoundException('Bloc introuvable');
    }

    this.assertImageFile(file);
    const key = await this.putImage(`articles/${articleId}/blocks`, file);

    await this.prisma.articleBlock.update({
      where: { id: blockId },
      data: { coverKey: key },
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_block_cover_uploaded',
      entity: 'article',
      entityId: articleId,
      meta: { blockId, coverKey: key, size: file.size },
    });

    return this.getById(articleId);
  }

  private normalizeBlocks(input?: ArticleBlockInputDto[]) {
    if (!input?.length)
      return [] as Array<{
        id?: string;
        title: string | null;
        coverCaption: string | null;
        content: string;
      }>;

    return input.map((b) => ({
      id: b.id?.trim() || undefined,
      title: b.title?.trim() || null,
      coverCaption: b.coverCaption?.trim() || null,
      content: (b.content ?? '').trim(),
    }));
  }

  private mirrorContentFromBlocks(
    blocks: Array<{ title: string | null; content: string }>,
  ): string {
    if (!blocks.length) return '';
    return blocks
      .map((b) => {
        const heading = b.title
          ? `<h2>${escapeHtml(b.title)}</h2>`
          : '';
        return `${heading}${b.content}`.trim();
      })
      .filter(Boolean)
      .join('\n');
  }

  private async summaryCounts() {
    const [total, published, drafts, featured] = await Promise.all([
      this.prisma.article.count(),
      this.prisma.article.count({ where: { isPublished: true } }),
      this.prisma.article.count({ where: { isPublished: false } }),
      this.prisma.article.count({
        where: {
          isFeatured: true,
          featuredAt: { gte: featuredWindowStart() },
        },
      }),
    ]);
    return { total, published, drafts, featured };
  }

  private async ensureUniqueSlug(base: string, excludeId?: string) {
    let slug = this.slugify(base);
    if (!slug) slug = `article-${Date.now()}`;

    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
      const found = await this.prisma.article.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!found || found.id === excludeId) return candidate;
    }
    throw new ConflictException('Impossible de générer un slug unique');
  }

  private parsePublishedAt(raw?: string | null): Date | null {
    if (raw == null || !raw.trim()) return null;
    const value = raw.trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private slugify(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }

  private parseBool(value?: string): boolean | undefined {
    if (value == null || value === '') return undefined;
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'no') return false;
    return undefined;
  }

  private async assertExists(id: string) {
    const found = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Actualité introuvable');
  }

  private assertImageFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > 5_000_000) {
      throw new BadRequestException('La cover dépasse 5 Mo');
    }
    const ok =
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp';
    if (!ok) {
      throw new BadRequestException('Formats cover : JPG, PNG, WEBP');
    }
  }

  private safeExt(
    originalname: string,
    mimetype: string,
    allowed: string[],
  ): string {
    let ext = extname(originalname).toLowerCase().replace('.', '');
    if (!ext || !allowed.includes(ext)) {
      if (mimetype.includes('jpeg') || mimetype.includes('jpg')) ext = 'jpg';
      else if (mimetype.includes('png')) ext = 'png';
      else if (mimetype.includes('webp')) ext = 'webp';
    }
    if (!allowed.includes(ext)) {
      throw new BadRequestException('Extension de fichier non supportée');
    }
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  private async putImage(prefix: string, file: UploadFile) {
    const ext = this.safeExt(file.originalname, file.mimetype, [
      'jpg',
      'jpeg',
      'png',
      'webp',
    ]);
    const key = `${prefix}/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    await this.uploadToR2(key, file, contentTypeForExt(ext));
    return key;
  }

  private async uploadToR2(
    key: string,
    file: UploadFile,
    contentType: string,
  ) {
    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }
    await putR2Object(r2, {
      key,
      body: file.buffer,
      contentType,
    });
  }

  private async resolveMagazineId(
    raw: string | null | undefined,
  ): Promise<string | null> {
    if (raw === undefined) return null;
    if (raw === null || !raw.trim()) return null;
    const id = raw.trim();
    const mag = await this.prisma.magazine.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!mag) {
      throw new BadRequestException('Magazine introuvable');
    }
    return mag.id;
  }

  private async resolveSponsorId(
    raw: string | null | undefined,
  ): Promise<string | null> {
    if (raw === undefined) return null;
    if (raw === null || !raw.trim()) return null;
    const id = raw.trim();
    const sponsor = await this.prisma.sponsor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!sponsor) {
      throw new BadRequestException('Sponsor introuvable');
    }
    return sponsor.id;
  }

  private async resolveBylineAuthorId(
    raw: string | null | undefined,
  ): Promise<string | null> {
    if (raw === undefined) return null;
    if (raw === null || !raw.trim()) return null;
    const id = raw.trim();
    const author = await this.prisma.author.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!author) {
      throw new BadRequestException('Auteur introuvable');
    }
    return author.id;
  }

  private async ensureAuthorIdForAdmin(adminUserId: string): Promise<string> {
    const existing = await this.prisma.author.findUnique({
      where: { adminUserId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        name: true,
        title: true,
        avatarKey: true,
      },
    });
    if (!admin) {
      throw new BadRequestException('Administrateur introuvable');
    }

    const taken = await this.prisma.author.findUnique({
      where: { id: admin.id },
      select: { id: true },
    });

    const created = await this.prisma.author.create({
      data: {
        ...(taken ? {} : { id: admin.id }),
        name: admin.name,
        title: admin.title,
        avatarKey: admin.avatarKey,
        adminUserId: admin.id,
      },
      select: { id: true },
    });
    return created.id;
  }

  private toAdminByline(
    byline: {
      id: string;
      name: string;
      avatarKey: string | null;
    } | null,
    publisher: {
      id: string;
      name: string;
      email: string;
      avatarKey: string | null;
    } | null,
  ) {
    const person = byline ?? publisher;
    if (!person) return null;
    return {
      id: person.id,
      name: person.name,
      email: publisher && person.id === publisher.id ? publisher.email : '',
      avatarUrl: this.resolveMediaUrl(person.avatarKey),
    };
  }

  private toAdmin(
    article: Prisma.ArticleGetPayload<{ select: typeof ARTICLE_SELECT }>,
    opts?: { publicMagazineOnly?: boolean },
  ) {
    const {
      coverKey,
      coverCaption,
      videoSourceKey,
      videoHlsKey,
      videoPosterKey,
      videoStatus,
      _count,
      author,
      bylineAuthor,
      bylineAuthorId,
      blocks,
      magazine,
      magazineId,
      sponsor,
      sponsorId,
      ...rest
    } = article;
    const resolvedBlocks =
      blocks.length > 0
        ? blocks
        : article.content.trim()
          ? [
              {
                id: null as string | null,
                position: 0,
                title: null as string | null,
                coverKey: null as string | null,
                coverCaption: null as string | null,
                coverUrl: null as string | null,
                content: article.content,
                createdAt: article.createdAt.toISOString(),
                updatedAt: article.updatedAt.toISOString(),
              },
            ]
          : [];

    const magazineVisible =
      magazine &&
      (!opts?.publicMagazineOnly ||
        (magazine.isPublished && magazine.isActive));

    return {
      ...rest,
      content: restoreImportedParagraphs(article.content),
      magazineId: magazineVisible
        ? magazineId
        : opts?.publicMagazineOnly
          ? null
          : magazineId,
      sponsorId,
      bylineAuthorId: bylineAuthor?.id ?? bylineAuthorId,
      coverKey,
      coverCaption,
      coverUrl: this.resolveMediaUrl(coverKey),
      videoSourceKey: opts?.publicMagazineOnly ? null : videoSourceKey,
      videoHlsKey,
      videoHlsUrl:
        videoStatus === 'READY' ? this.resolveMediaUrl(videoHlsKey) : null,
      videoPosterKey,
      videoPosterUrl: this.resolveMediaUrl(videoPosterKey),
      videoStatus,
      magazine: magazineVisible
        ? {
            id: magazine.id,
            title: magazine.title,
            issueNumber: magazine.issueNumber,
            coverUrl: this.resolveMediaUrl(magazine.coverKey),
            publishedAt: magazine.publishedAt?.toISOString() ?? null,
            isPublished: magazine.isPublished,
            isActive: magazine.isActive,
            theme: this.parseMagazineTheme(magazine.theme),
          }
        : null,
      sponsor: sponsor
        ? {
            id: sponsor.id,
            name: sponsor.name,
            logoUrl: this.resolveMediaUrl(sponsor.logoKey),
            url: sponsor.url,
          }
        : null,
      blocks:
        blocks.length > 0
          ? blocks.map((b) => ({
              id: b.id,
              position: b.position,
              title: b.title,
              coverKey: b.coverKey,
              coverCaption: b.coverCaption,
              coverUrl: this.resolveMediaUrl(b.coverKey),
              content: restoreImportedParagraphs(b.content),
              createdAt: b.createdAt.toISOString(),
              updatedAt: b.updatedAt.toISOString(),
            }))
          : resolvedBlocks.map((b) => ({
              ...b,
              content: restoreImportedParagraphs(b.content),
            })),
      commentsCount: _count.comments,
      bylineAuthor: bylineAuthor
        ? {
            id: bylineAuthor.id,
            name: bylineAuthor.name,
            title: bylineAuthor.title,
            avatarUrl: this.resolveMediaUrl(bylineAuthor.avatarKey),
            adminUserId: bylineAuthor.adminUserId,
          }
        : null,
      author: this.toAdminByline(bylineAuthor, author),
      publishedAt: article.publishedAt?.toISOString() ?? null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }

  private resolveMediaUrl(key: string | null): string | null {
    if (!key) return null;
    const trimmed = key.trim();
    if (!trimmed) return null;
    // Les clés `uploads/...` passent par le CDN dès que R2 est configuré.
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const r2 = (
      this.config.get<string>('R2_PUBLIC_URL') ||
      this.config.get<string>('R2_URL') ||
      ''
    ).replace(/\/$/, '');
    if (r2 && trimmed.includes('/')) {
      return `${r2}/${trimmed.replace(/^\//, '')}`;
    }
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
      return `/${trimmed.replace(/^\//, '')}`;
    }

    return `/legacy/articles/${encodeURIComponent(trimmed)}`;
  }

  private parseMagazineTheme(raw: Prisma.JsonValue | null): {
    bgColor: string;
    accentColor: string;
  } {
    const fallback = { bgColor: '#111111', accentColor: '#4ed319' };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
    const obj = raw as Record<string, unknown>;
    const bg =
      typeof obj.bgColor === 'string'
        ? obj.bgColor
        : typeof obj.background === 'string'
          ? obj.background
          : fallback.bgColor;
    const accent =
      typeof obj.accentColor === 'string'
        ? obj.accentColor
        : typeof obj.themeColor === 'string'
          ? obj.themeColor
          : typeof obj.accent === 'string'
            ? obj.accent
            : fallback.accentColor;
    return { bgColor: bg, accentColor: accent };
  }
}

const TAG_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car',
  'ce', 'cette', 'ces', 'mon', 'ton', 'son', 'notre', 'votre', 'leur', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on',
  'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'contre', 'vers', 'chez', 'entre',
  'qui', 'que', 'quoi', 'dont', 'où', 'ou', 'si', 'plus', 'moins', 'très', 'tres', 'trop', 'assez',
  'est', 'sont', 'être', 'etre', 'avoir', 'fait', 'faire', 'dit', 'dire', 'peut', 'pouvoir',
  'au', 'aux', 'ne', 'pas', 'non', 'oui', 'bien', 'mal', 'tout', 'tous', 'toute', 'toutes',
  'cela', 'ceci', 'comment', 'quand', 'pourquoi', 'aussi', 'encore', 'déjà', 'deja', 'alors',
  'après', 'apres', 'avant', 'depuis', 'pendant', 'comme', 'même', 'meme', 'autre', 'plusieurs', 'quelques',
  'cette', 'cet', 'dans', 'rdc', 'afin', 'ainsi', 'dont', 'leur', 'leurs',
]);

/** L’import a aplati les lignes vides en doubles espaces, dans un seul <p>. */
function restoreImportedParagraphs(html: string): string {
  const trimmed = html.trim();
  const match = trimmed.match(/^<p>([\s\S]*)<\/p>$/i);
  if (!match) return html;
  const inner = match[1] ?? '';
  if (/<(?:br|p|div|ul|ol|li|blockquote|h[1-6])\b/i.test(inner)) return html;
  if (!/ {2,}/.test(inner)) return html;
  const parts = inner
    .split(/ {2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return html;
  return parts.map((part) => `<p>${part}</p>`).join('\n');
}

function htmlToPlain(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(value: string): number {
  if (!value) return 0;
  return value.split(/\s+/).filter(Boolean).length;
}

function classifyStoredVideo(url: string): 'youtube' | 'hosted' | 'other' {
  if (!url) return 'other';
  if (/youtu\.be|youtube\.com/i.test(url)) return 'youtube';
  if (/\.(?:m3u8|mp4|webm|m4v|mov)(?:$|\?|#)/i.test(url)) return 'hosted';
  return 'other';
}

function hostedVideoFromText(text: string): string | null {
  const match = text.match(
    /https?:\/\/[^\s"'<>]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\?[^\s"'<>]*)?/i,
  );
  return match?.[0] ?? null;
}

function youtubeUrlFromText(text: string): string | null {
  const match = text.match(
    /(?:youtube\.com\/(?:watch\?(?:[^"'&\s]+&)*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function articleTags(title: string, plain: string): string[] {
  const score = new Map<string, number>();
  const add = (word: string, weight: number) => {
    const key = word.toLocaleLowerCase('fr-FR');
    if (key.length < 4 || TAG_STOP_WORDS.has(key) || /^\d+$/.test(key)) return;
    score.set(key, (score.get(key) ?? 0) + weight);
  };
  for (const word of title.toLocaleLowerCase('fr-FR').split(/[^\p{L}\p{N}]+/u)) {
    add(word, 3);
  }
  for (const word of plain.toLocaleLowerCase('fr-FR').split(/[^\p{L}\p{N}]+/u)) {
    add(word, 1);
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1));
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

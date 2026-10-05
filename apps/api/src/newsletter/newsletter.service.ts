import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsletterOutboxStatus, Prisma } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import {
  composeArticleCampaign,
  findLatestPublicArticle,
  outboxSummary,
  setNewsletterSendingEnabled,
  skipPendingForSubscription,
} from './newsletter-outbox';

const NEWSLETTER_TEST_EMAIL = 'gauthierntudi@gmail.com';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async subscribe(dto: SubscribeNewsletterDto) {
    if (!dto.acceptedTerms) {
      throw new BadRequestException(
        'Vous devez accepter les termes et conditions.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const source = (dto.source ?? 'home').trim().slice(0, 64) || 'home';

    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (existing?.isActive) {
      return {
        ok: true as const,
        alreadySubscribed: true as const,
        message: 'Cette adresse est déjà inscrite à la newsletter.',
      };
    }

    if (existing && !existing.isActive) {
      await this.prisma.newsletterSubscription.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          acceptedTerms: true,
          source,
          unsubscribedAt: null,
        },
      });
      void this.mail.sendNewsletterWelcome(email);
      return {
        ok: true as const,
        alreadySubscribed: false as const,
        message: 'Votre inscription a bien été réactivée.',
      };
    }

    await this.prisma.newsletterSubscription.create({
      data: {
        email,
        acceptedTerms: true,
        source,
        isActive: true,
      },
    });

    void this.mail.sendNewsletterWelcome(email);

    return {
      ok: true as const,
      alreadySubscribed: false as const,
      message: 'Merci — votre inscription a bien été prise en compte.',
    };
  }

  async list(opts: {
    q?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(opts.take ?? 20, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);
    const q = opts.q?.trim();

    const where = {
      ...(opts.active === '1'
        ? { isActive: true }
        : opts.active === '0'
          ? { isActive: false }
          : {}),
      ...(q
        ? {
            email: { contains: q, mode: 'insensitive' as const },
          }
        : {}),
    };

    const [total, activeCount, items, outbox] = await Promise.all([
      this.prisma.newsletterSubscription.count({ where }),
      this.prisma.newsletterSubscription.count({ where: { isActive: true } }),
      this.prisma.newsletterSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          email: true,
          isActive: true,
          source: true,
          acceptedTerms: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      outboxSummary(this.prisma),
    ]);

    return {
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
      })),
      total,
      take,
      skip,
      summary: {
        total,
        active: activeCount,
        outbox,
      },
    };
  }

  async listSends(opts: {
    q?: string;
    status?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(opts.take ?? 20, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);
    const q = opts.q?.trim();
    const status = parseOutboxStatus(opts.status);

    const where: Prisma.NewsletterOutboxWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              {
                article: {
                  title: { contains: q, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items, grouped, outbox] = await Promise.all([
      this.prisma.newsletterOutbox.count({ where }),
      this.prisma.newsletterOutbox.findMany({
        where,
        orderBy: [
          { sentAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        take,
        skip,
        select: {
          id: true,
          email: true,
          status: true,
          attempts: true,
          lastError: true,
          sentAt: true,
          createdAt: true,
          article: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.newsletterOutbox.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      outboxSummary(this.prisma),
    ]);

    const byStatus = {
      pending: 0,
      sending: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    };
    for (const row of grouped) {
      const n = row._count._all;
      if (row.status === NewsletterOutboxStatus.PENDING) byStatus.pending = n;
      else if (row.status === NewsletterOutboxStatus.SENDING)
        byStatus.sending = n;
      else if (row.status === NewsletterOutboxStatus.SENT) byStatus.sent = n;
      else if (row.status === NewsletterOutboxStatus.SKIPPED)
        byStatus.skipped = n;
      else if (row.status === NewsletterOutboxStatus.FAILED) byStatus.failed = n;
    }

    return {
      items: items.map((row) => ({
        id: row.id,
        email: row.email,
        status: row.status,
        attempts: row.attempts,
        lastError: row.lastError,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        article: row.article,
      })),
      total,
      take,
      skip,
      summary: {
        ...byStatus,
        outbox,
      },
    };
  }

  async setActive(id: string, isActive: boolean) {
    const row = await this.prisma.newsletterSubscription.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Inscription introuvable');

    const updated = await this.prisma.newsletterSubscription.update({
      where: { id },
      data: {
        isActive,
        unsubscribedAt: isActive ? null : new Date(),
      },
    });

    if (!isActive) {
      await skipPendingForSubscription(this.prisma, updated.id);
    }

    return {
      id: updated.id,
      email: updated.email,
      isActive: updated.isActive,
      unsubscribedAt: updated.unsubscribedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async setSendingEnabled(enabled: boolean) {
    const sendingEnabled = await setNewsletterSendingEnabled(
      this.prisma,
      enabled,
    );
    return {
      sendingEnabled,
      message: sendingEnabled
        ? 'Les envois newsletter sont activés (70 e-mails / jour).'
        : 'Les envois newsletter sont suspendus.',
    };
  }

  async previewCampaign() {
    const appUrl =
      this.config.get<string>('APP_URL')?.replace(/\/$/, '') ||
      'https://lentrevuemag.com';
    const article = await findLatestPublicArticle(this.prisma);
    if (!article) {
      throw new NotFoundException(
        'Aucun article publié pour composer l’aperçu.',
      );
    }
    const campaign = await composeArticleCampaign(this.prisma, article, {
      appUrl,
      r2PublicUrl:
        this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '') || null,
      unsubscribeUrl: `${appUrl}/newsletter/desinscription`,
    });
    return {
      subject: campaign.subject,
      html: campaign.html,
      articleTitle: article.title,
    };
  }

  async sendTest() {
    if (!this.mail.isConfigured) {
      throw new BadRequestException(
        'Envoi indisponible (RESEND_API_KEY manquant).',
      );
    }
    const to =
      this.config.get<string>('NEWSLETTER_TEST_EMAIL')?.trim().toLowerCase() ||
      NEWSLETTER_TEST_EMAIL;
    const appUrl =
      this.config.get<string>('APP_URL')?.replace(/\/$/, '') ||
      'https://lentrevuemag.com';
    const article = await findLatestPublicArticle(this.prisma);
    if (!article) {
      throw new BadRequestException(
        'Aucun article publié pour composer le mail test.',
      );
    }
    const unsubscribeUrl = `${appUrl}/newsletter/desinscription`;
    const campaign = await composeArticleCampaign(this.prisma, article, {
      appUrl,
      r2PublicUrl:
        this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '') || null,
      unsubscribeUrl,
      kicker: 'Test',
      subjectPrefix: '[TEST] ',
    });
    await this.mail.sendCampaign({
      to,
      subject: campaign.subject,
      html: campaign.html,
      unsubscribeUrl: campaign.unsubscribeUrl,
    });
    return {
      ok: true as const,
      to,
      message: `E-mail test envoyé à ${to}.`,
    };
  }

  async unsubscribeByToken(token: string) {
    const value = token.trim();
    if (!value) {
      throw new BadRequestException('Lien de désinscription incomplet.');
    }
    const row = await this.prisma.newsletterSubscription.findUnique({
      where: { unsubscribeToken: value },
    });
    if (!row) {
      throw new NotFoundException('Lien de désinscription invalide.');
    }
    if (!row.isActive) {
      return {
        ok: true as const,
        alreadyUnsubscribed: true as const,
        message: 'Cette adresse est déjà désinscrite.',
      };
    }
    await this.prisma.newsletterSubscription.update({
      where: { id: row.id },
      data: { isActive: false, unsubscribedAt: new Date() },
    });
    await skipPendingForSubscription(this.prisma, row.id);
    return {
      ok: true as const,
      alreadyUnsubscribed: false as const,
      message: 'Vous êtes désinscrit de la newsletter L’Entrevue.',
    };
  }
}

const OUTBOX_STATUSES = new Set<string>(Object.values(NewsletterOutboxStatus));

function parseOutboxStatus(
  value: string | undefined,
): NewsletterOutboxStatus | undefined {
  const raw = value?.trim().toUpperCase();
  if (!raw || !OUTBOX_STATUSES.has(raw)) return undefined;
  return raw as NewsletterOutboxStatus;
}

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NEWSLETTER_SEND_INTERVAL_MS,
  drainNewsletterOutbox,
  enqueueArticleNewsletter,
  outboxSummary,
  skipPendingForSubscription,
} from './newsletter-outbox';

@Injectable()
export class NewsletterOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsletterOutboxService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const disabled =
      this.config.get<string>('NEWSLETTER_SEND_IN_API')?.trim() === '0';
    if (disabled) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, NEWSLETTER_SEND_INTERVAL_MS);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async enqueueForArticle(articleId: string) {
    try {
      const result = await enqueueArticleNewsletter(this.prisma, articleId);
      if (result.skipped) {
        this.logger.log(`Newsletter ignorée pour ${articleId} (non public)`);
        return result;
      }
      this.logger.log(
        `Newsletter: ${result.queued} envoi(s) en file pour ${articleId}`,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Impossible d’enfiler la newsletter pour ${articleId}`,
        err instanceof Error ? err.stack : undefined,
      );
      return { queued: 0, skipped: true };
    }
  }

  skipPendingForSubscription(subscriptionId: string) {
    return skipPendingForSubscription(this.prisma, subscriptionId);
  }

  summary() {
    return outboxSummary(this.prisma);
  }

  private async tick() {
    if (this.draining) return;
    if (!this.mail.isConfigured) return;
    this.draining = true;
    try {
      const result = await drainNewsletterOutbox(this.prisma, {
        send: (input) => this.mail.sendCampaign(input),
        appUrl:
          this.config.get<string>('APP_URL')?.replace(/\/$/, '') ||
          'https://lentrevuemag.com',
        apiUrl:
          this.config.get<string>('API_URL')?.replace(/\/$/, '') ||
          'http://localhost:3001',
        r2PublicUrl:
          this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '') || null,
      });
      if (result.claimed > 0) {
        this.logger.log(
          `Newsletter drain claimed=${result.claimed} sent=${result.sent} skipped=${result.skipped} failed=${result.failed} quotaLeft=${result.remainingQuota}`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Newsletter drain failed',
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      this.draining = false;
    }
  }
}

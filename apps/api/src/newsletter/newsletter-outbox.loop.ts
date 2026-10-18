import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import {
  NEWSLETTER_SEND_INTERVAL_MS,
  drainNewsletterOutbox,
} from './newsletter-outbox';

const prisma = new PrismaClient();

export function startNewsletterOutboxLoop(): { stop: () => void } {
  let draining = false;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const resend = apiKey ? new Resend(apiKey) : null;
  const from =
    process.env.MAIL_FROM?.trim() ||
    'Fintech Médias <noreply@fintechmedias.com>';
  const appUrl =
    process.env.APP_URL?.replace(/\/$/, '') || 'https://lentrevuemag.com';
  const r2PublicUrl =
    process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || null;

  const tick = async () => {
    if (draining) return;
    if (!resend) return;
    draining = true;
    try {
      const result = await drainNewsletterOutbox(prisma, {
        appUrl,
        apiUrl:
          process.env.API_URL?.replace(/\/$/, '') ||
          'https://api.lentrevuemag.com',
        r2PublicUrl,
        send: async (input) => {
          const sent = await resend.emails.send({
            from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            headers: {
              'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          });
          if (sent.error) {
            throw new Error(sent.error.message);
          }
        },
      });
      if (result.claimed > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[newsletter] drain claimed=${result.claimed} sent=${result.sent} skipped=${result.skipped} failed=${result.failed} quotaLeft=${result.remainingQuota}`,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[newsletter] drain failed', err);
    } finally {
      draining = false;
    }
  };

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, NEWSLETTER_SEND_INTERVAL_MS);

  return {
    stop: () => {
      clearInterval(timer);
      void prisma.$disconnect();
    },
  };
}

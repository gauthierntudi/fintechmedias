/**
 * Enfile les campagnes newsletter pour les articles publiés
 * depuis le 1er septembre 2026 (un e-mail par inscrit actif).
 * Les doublons (article × inscrit) sont ignorés.
 *
 * N’envoie rien tout de suite : le worker vide la file (70 / jour)
 * seulement si les envois sont activés en admin.
 *
 * Usage :
 *   pnpm --filter @entrevue/api enqueue:newsletter-since
 *   pnpm --filter @entrevue/api enqueue:newsletter-since -- --dry-run
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import {
  NEWSLETTER_ARTICLES_SINCE,
  enqueueArticleNewsletter,
} from '../src/newsletter/newsletter-outbox';
import { isMobileOnlyCategory } from '../src/articles/categories';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  try {
    const articles = await prisma.article.findMany({
      where: {
        isPublished: true,
        OR: [
          { publishedAt: { gte: NEWSLETTER_ARTICLES_SINCE } },
          {
            publishedAt: null,
            createdAt: { gte: NEWSLETTER_ARTICLES_SINCE },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
    });
    const eligible = articles.filter(
      (row) => !isMobileOnlyCategory(row.category),
    );
    const subscribers = await prisma.newsletterSubscription.count({
      where: { isActive: true },
    });

    console.log(
      `Articles depuis ${NEWSLETTER_ARTICLES_SINCE.toISOString()} : ${eligible.length} (inscrits actifs : ${subscribers})`,
    );
    if (dryRun) {
      for (const row of eligible) {
        const when = row.publishedAt ?? row.createdAt;
        console.log(`  [dry-run] ${when.toISOString().slice(0, 10)}  ${row.title}`);
      }
      return;
    }

    let queued = 0;
    let skipped = 0;
    for (const row of eligible) {
      const result = await enqueueArticleNewsletter(prisma, row.id);
      queued += result.queued;
      if (result.skipped) skipped += 1;
      const when = row.publishedAt ?? row.createdAt;
      console.log(
        `  ${when.toISOString().slice(0, 10)}  +${result.queued}  ${row.title}`,
      );
    }
    console.log(
      `Terminé. ${queued} envoi(s) en file, ${skipped} article(s) ignoré(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

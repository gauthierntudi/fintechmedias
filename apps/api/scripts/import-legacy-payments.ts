/**
 * Importe `paiements` du dump PHP vers Postgres (`payments`).
 *
 * Articles réussis : aussi une ligne `article_purchases` si l’article existe.
 * Un payeur qui n’est que dans le staff reçoit une fiche abonné (mot de passe 0000)
 * pour que le reçu puisse s’y rattacher. Relancer n’écrit pas deux fois la même référence.
 *
 * Usage (depuis fintech-next) :
 *   pnpm --filter @entrevue/api import:payments
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import {
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: true });

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = '0000';

const PLANS = [
  { id: 1, name: 'Hebdomadaire', days: 7, price: 1, description: 'Accès illimité pendant 7 jours' },
  { id: 2, name: 'Mensuel', days: 30, price: 3, description: 'Accès illimité pendant 30 jours' },
  { id: 3, name: 'Annuel', days: 365, price: 20, description: 'Accès illimité pendant 1 an' },
  { id: 4, name: 'Semi Annuel', days: 180, price: 6, description: 'Accès illimité pendant 180 jours' },
] as const;

type Row = Map<string, string | null>;

function sqlLiteral(raw: string): string | null {
  const t = raw.trim();
  if (t.toUpperCase() === 'NULL') return null;
  if (t.startsWith("'") && t.endsWith("'")) {
    return t
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/''/g, "'")
      .replace(/\\\\/g, '\\');
  }
  return t;
}

function splitSqlValues(inner: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuote = false;
  let escape = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (inQuote) {
      if (escape) {
        cur += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        cur += ch;
        escape = true;
        continue;
      }
      if (ch === "'") {
        if (inner[i + 1] === "'") {
          cur += "''";
          i += 1;
          continue;
        }
        inQuote = false;
        cur += ch;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === "'") {
      inQuote = true;
      cur += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function loadInsert(sql: string, table: string): Row[] {
  const insertRe = new RegExp(
    `INSERT\\s+INTO\\s+\`${table}\`\\s*\\(([^)]+)\\)\\s*VALUES\\s*`,
    'gi',
  );
  const rows: Row[] = [];
  let match: RegExpExecArray | null;
  while ((match = insertRe.exec(sql))) {
    const cols = match[1]!.split(',').map((c) => c.trim().replace(/`/g, ''));
    let i = match.index + match[0].length;
    while (i < sql.length) {
      while (i < sql.length && /\s/.test(sql[i]!)) i += 1;
      if (sql[i] !== '(') break;
      let depth = 0;
      let inQuote = false;
      let escape = false;
      const start = i;
      for (; i < sql.length; i++) {
        const ch = sql[i]!;
        if (inQuote) {
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === '\\') {
            escape = true;
            continue;
          }
          if (ch === "'") {
            if (sql[i + 1] === "'") {
              i += 1;
              continue;
            }
            inQuote = false;
          }
          continue;
        }
        if (ch === "'") {
          inQuote = true;
          continue;
        }
        if (ch === '(') depth += 1;
        if (ch === ')') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }
      const values = splitSqlValues(sql.slice(start + 1, i - 1));
      const map: Row = new Map();
      cols.forEach((col, idx) => map.set(col, sqlLiteral(values[idx] ?? 'NULL')));
      rows.push(map);
      while (i < sql.length && /\s/.test(sql[i]!)) i += 1;
      if (sql[i] === ',') {
        i += 1;
        continue;
      }
      break;
    }
  }
  return rows;
}

function dumpPath(): string {
  const fromEnv = process.env.LEGACY_SQL_DUMP?.trim();
  const candidates = [
    fromEnv,
    resolve(process.cwd(), '../../../database/c2666078c_newdb.sql'),
    resolve(process.cwd(), '../../database/c2666078c_newdb.sql'),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`Dump introuvable.\nCherché :\n${candidates.join('\n')}`);
  }
  return found;
}

function parseDate(raw: string | null): Date {
  if (!raw) return new Date();
  const d = new Date(raw.trim().replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function num(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function cents(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function mapStatus(raw: string | null): PaymentStatus {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'reussi':
      return PaymentStatus.SUCCESS;
    case 'echoue':
      return PaymentStatus.FAILED;
    case 'annule':
      return PaymentStatus.CANCELLED;
    default:
      return PaymentStatus.PENDING;
  }
}

function avatarKey(raw: string | null): string | null {
  const t = raw?.trim() ?? '';
  if (!t) return null;
  return t.replace(/^\//, '');
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');

  const source = dumpPath();
  const sql = readFileSync(source, 'utf8');
  const payments = loadInsert(sql, 'paiements');
  const users = loadInsert(sql, 'users');
  const ads = loadInsert(sql, 'publicites');
  const userById = new Map(users.map((row) => [num(row.get('id')), row]));
  const adTitle = new Map(
    ads.map((row) => [num(row.get('id')), (row.get('titre') ?? '').trim()]),
  );

  const articleIds = payments
    .map((row) => num(row.get('actualite_id')))
    .filter((id): id is number => id != null);
  const articles = await prisma.article.findMany({
    where: { legacyId: { in: articleIds } },
    select: { id: true, legacyId: true, title: true },
  });
  const articleByLegacy = new Map(
    articles
      .filter((article) => article.legacyId != null)
      .map((article) => [article.legacyId as number, article]),
  );

  for (const plan of PLANS) {
    const existing = await prisma.plan.findUnique({ where: { legacyId: plan.id } });
    if (existing) continue;
    await prisma.plan.create({
      data: {
        legacyId: plan.id,
        name: plan.name,
        description: plan.description,
        priceCents: plan.price * 100,
        durationDays: plan.days,
        currency: 'USD',
      },
    });
  }
  const plans = await prisma.plan.findMany({
    where: { legacyId: { in: PLANS.map((plan) => plan.id) } },
    select: { id: true, legacyId: true, name: true },
  });
  const planByLegacy = new Map(
    plans
      .filter((plan) => plan.legacyId != null)
      .map((plan) => [plan.legacyId as number, plan]),
  );

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const subscribers = new Map<number, string>();

  async function subscriberId(legacyUserId: number): Promise<string | null> {
    const cached = subscribers.get(legacyUserId);
    if (cached) return cached;
    const found = await prisma.subscriber.findUnique({
      where: { legacyId: legacyUserId },
    });
    if (found) {
      subscribers.set(legacyUserId, found.id);
      return found.id;
    }
    const dumpUser = userById.get(legacyUserId);
    const email = (dumpUser?.get('mail') ?? '').trim().toLowerCase();
    if (!email) return null;
    const byEmail = await prisma.subscriber.findUnique({ where: { email } });
    if (byEmail) {
      if (byEmail.legacyId == null) {
        await prisma.subscriber.update({
          where: { id: byEmail.id },
          data: { legacyId: legacyUserId },
        });
      }
      subscribers.set(legacyUserId, byEmail.id);
      return byEmail.id;
    }
    const created = await prisma.subscriber.create({
      data: {
        legacyId: legacyUserId,
        name: (dumpUser?.get('nom') ?? email).trim().slice(0, 200),
        email,
        phone: dumpUser?.get('telephone')?.trim() || null,
        avatarKey: avatarKey(dumpUser?.get('cover') ?? null),
        passwordHash,
        subscriberCode: dumpUser?.get('num_user')?.trim() || null,
        emailVerifiedAt: parseDate(dumpUser?.get('created_at') ?? null),
        createdAt: parseDate(dumpUser?.get('created_at') ?? null),
      },
    });
    subscribers.set(legacyUserId, created.id);
    console.log(`Fiche abonné ajoutée pour rattacher les reçus : ${email}`);
    return created.id;
  }

  let created = 0;
  let skipped = 0;
  let purchases = 0;

  for (const row of payments) {
    const legacyId = num(row.get('id'));
    const userId = num(row.get('user_id'));
    if (legacyId == null || userId == null) continue;

    const providerRef = (row.get('transaction_id') ?? '').trim() || `legacy-paiement-${legacyId}`;
    const existing = await prisma.payment.findUnique({
      where: {
        provider_providerRef: {
          provider: PaymentProvider.LEGACY,
          providerRef,
        },
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const ownerId = await subscriberId(userId);
    if (!ownerId) {
      console.warn(`Paiement ${legacyId} ignoré : utilisateur ${userId} introuvable`);
      continue;
    }

    const articleLegacyId = num(row.get('actualite_id'));
    const planLegacyId = num(row.get('plan_id'));
    const adLegacyId = num(row.get('publicite_id'));
    const article = articleLegacyId != null ? articleByLegacy.get(articleLegacyId) : undefined;
    const plan = planLegacyId != null ? planByLegacy.get(planLegacyId) : undefined;
    const purpose = articleLegacyId
      ? PaymentPurpose.ARTICLE
      : planLegacyId
        ? PaymentPurpose.SUBSCRIPTION
        : PaymentPurpose.AD;
    const title = article?.title
      || (articleLegacyId != null ? `Article #${articleLegacyId}` : null)
      || plan?.name
      || (adLegacyId != null ? adTitle.get(adLegacyId) || `Publicité #${adLegacyId}` : null);

    const status = mapStatus(row.get('statut'));
    const when = parseDate(row.get('created_at'));
    const updated = parseDate(row.get('updated_at'));

    await prisma.payment.create({
      data: {
        provider: PaymentProvider.LEGACY,
        providerRef,
        amountCents: cents(row.get('montant')),
        currency: 'USD',
        status,
        purpose,
        subscriberId: ownerId,
        planId: plan?.id ?? null,
        metadata: {
          legacyPaymentId: legacyId,
          method: row.get('methode'),
          maxicashRef: row.get('maxicash_transaction_id'),
          title,
          articleLegacyId,
          adLegacyId,
          planLegacyId,
        },
        createdAt: when,
        updatedAt: updated,
      },
    });
    created += 1;

    if (
      purpose === PaymentPurpose.ARTICLE &&
      status === PaymentStatus.SUCCESS &&
      article
    ) {
      await prisma.articlePurchase.upsert({
        where: {
          subscriberId_articleId: {
            subscriberId: ownerId,
            articleId: article.id,
          },
        },
        create: {
          subscriberId: ownerId,
          articleId: article.id,
          amountCents: cents(row.get('montant')),
          currency: 'USD',
          paymentStatus: PaymentStatus.SUCCESS,
          transactionRef: providerRef,
          createdAt: when,
          updatedAt: updated,
        },
        update: {},
      });
      purchases += 1;
    }
  }

  console.log(
    `Paiements lus : ${payments.length} · créés : ${created} · déjà présents : ${skipped} · accès articles : ${purchases}`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

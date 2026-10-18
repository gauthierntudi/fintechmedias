/**
 * Importe `users` du dump PHP vers Postgres.
 * Staff (superadmin, admin, journaliste) → admin_users
 * Lecteurs (user) → subscribers
 *
 * Un e-mail déjà présent n’est pas écrasé : le mot de passe reste,
 * et seuls les champs vides (legacyId, titre, téléphone, avatar) sont remplis.
 * Les nouveaux comptes reçoivent le mot de passe par défaut 0000.
 *
 * Usage (depuis fintech-next) :
 *   pnpm --filter @entrevue/api import:users
 *   pnpm --filter @entrevue/api import:users -- --dry-run
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { AdminRole, PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../src/auth/password.util';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: true });

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_PASSWORD = '0000';

const STAFF_ROLES: Record<string, AdminRole> = {
  superadmin: AdminRole.SUPERADMIN,
  admin: AdminRole.ADMIN,
  journaliste: AdminRole.REDACTEUR,
};

type LegacyUser = {
  id: number;
  name: string;
  title: string | null;
  email: string;
  role: string;
  avatarKey: string | null;
  phone: string | null;
  address: string | null;
  code: string | null;
  isActive: boolean;
  createdAt: Date | null;
};

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

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

function parseCreatedAt(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw.trim().replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function avatarKey(raw: string | null): string | null {
  const t = raw?.trim() ?? '';
  if (!t) return null;
  return t.replace(/^\//, '');
}

function loadUsers(filePath: string): LegacyUser[] {
  const sql = readFileSync(filePath, 'utf8');
  const insertRe = /INSERT\s+INTO\s+`users`\s*\(([^)]+)\)\s*VALUES\s*/gi;
  const rows: LegacyUser[] = [];
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
      const map = new Map<string, string | null>();
      cols.forEach((col, idx) => map.set(col, sqlLiteral(values[idx] ?? 'NULL')));

      const id = Number(map.get('id'));
      const email = (map.get('mail') ?? '').trim().toLowerCase();
      const name = clip(map.get('nom'), 200);
      if (!Number.isFinite(id) || !email || !name) {
        console.warn(`[skip] id=${map.get('id')} — e-mail ou nom invalide`);
      } else {
        rows.push({
          id,
          name,
          title: clip(map.get('Titre'), 200),
          email,
          role: (map.get('role') ?? 'user').trim().toLowerCase(),
          avatarKey: avatarKey(map.get('cover') ?? null),
          phone: clip(map.get('telephone'), 40),
          address: clip(map.get('adresseUser'), 500),
          code: clip(map.get('num_user'), 40),
          isActive: Number(map.get('status') ?? 1) === 1,
          createdAt: parseCreatedAt(map.get('created_at') ?? null),
        });
      }

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
    throw new Error(
      `Dump introuvable. Définis LEGACY_SQL_DUMP.\nCherché :\n${candidates.join('\n')}`,
    );
  }
  return found;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquant');
  }

  const source = dumpPath();
  const rows = loadUsers(source);
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  console.log(`Source : ${source}`);
  console.log(`Comptes lus : ${rows.length}`);
  console.log(`Mode : ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);

  let staffCreated = 0;
  let readersCreated = 0;
  let kept = 0;
  let filled = 0;

  for (const row of rows) {
    const staffRole = STAFF_ROLES[row.role];

    if (staffRole) {
      const existing = await prisma.adminUser.findUnique({
        where: { email: row.email },
      });

      if (existing) {
        const data: {
          legacyId?: number;
          title?: string;
          phone?: string;
          avatarKey?: string;
        } = {};
        if (existing.legacyId == null) data.legacyId = row.id;
        if (!existing.title && row.title) data.title = row.title;
        if (!existing.phone && row.phone) data.phone = row.phone;
        if (!existing.avatarKey && row.avatarKey) data.avatarKey = row.avatarKey;

        if (Object.keys(data).length === 0) {
          kept += 1;
          console.log(`[gardé] admin ${row.email}`);
          continue;
        }

        if (!DRY_RUN) {
          await prisma.adminUser.update({ where: { id: existing.id }, data });
        }
        filled += 1;
        console.log(
          `[complété] admin ${row.email} (${Object.keys(data).join(', ')}) — mot de passe inchangé`,
        );
        continue;
      }

      if (!DRY_RUN) {
        await prisma.adminUser.create({
          data: {
            legacyId: row.id,
            name: row.name,
            email: row.email,
            passwordHash,
            role: staffRole,
            title: row.title,
            phone: row.phone,
            avatarKey: row.avatarKey,
            isActive: row.isActive,
            ...(row.createdAt ? { createdAt: row.createdAt } : {}),
          },
        });
      }
      staffCreated += 1;
      console.log(`[créé] admin ${row.email} · ${staffRole}`);
      continue;
    }

    const existing = await prisma.subscriber.findUnique({
      where: { email: row.email },
    });

    if (existing) {
      const data: {
        legacyId?: number;
        phone?: string;
        address?: string;
        subscriberCode?: string;
        avatarKey?: string;
      } = {};
      if (existing.legacyId == null) data.legacyId = row.id;
      if (!existing.phone && row.phone) data.phone = row.phone;
      if (!existing.address && row.address) data.address = row.address;
      if (!existing.subscriberCode && row.code) data.subscriberCode = row.code;
      if (!existing.avatarKey && row.avatarKey) data.avatarKey = row.avatarKey;

      if (Object.keys(data).length === 0) {
        kept += 1;
        console.log(`[gardé] lecteur ${row.email}`);
        continue;
      }

      if (!DRY_RUN) {
        await prisma.subscriber.update({ where: { id: existing.id }, data });
      }
      filled += 1;
      console.log(
        `[complété] lecteur ${row.email} — mot de passe inchangé`,
      );
      continue;
    }

    if (!DRY_RUN) {
      await prisma.subscriber.create({
        data: {
          legacyId: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          passwordHash,
          address: row.address,
          subscriberCode: row.code,
          avatarKey: row.avatarKey,
          emailVerifiedAt: row.createdAt ?? new Date(),
          isActive: row.isActive,
          ...(row.createdAt ? { createdAt: row.createdAt } : {}),
        },
      });
    }
    readersCreated += 1;
    console.log(`[créé] lecteur ${row.email}`);
  }

  const passwordOk = await verifyPassword(DEFAULT_PASSWORD, passwordHash);
  console.log('\n— Résumé —');
  console.log({
    staffCreated,
    readersCreated,
    filled,
    kept,
    defaultPasswordChecks: passwordOk,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

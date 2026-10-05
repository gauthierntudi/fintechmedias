/**
 * Import des emails `docs/BDD.xlsx` → `newsletter_subscriptions`.
 *
 * N’envoie pas d’e-mail de bienvenue (insert Prisma direct).
 * Les adresses déjà présentes sont ignorées (contrainte unique).
 * Une ligne désinscrite n’est pas réactivée.
 *
 * Usage (depuis la racine) :
 *   pnpm --filter @entrevue/api import:newsletter -- --dry-run
 *   pnpm --filter @entrevue/api import:newsletter
 *   pnpm --filter @entrevue/api import:newsletter -- --file ../../docs/BDD.xlsx
 *
 * Env : DATABASE_URL
 */
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const SOURCE = 'import-bdd-xlsx';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const fileIdx = argv.indexOf('--file');
  const file =
    fileIdx >= 0 && argv[fileIdx + 1] && !argv[fileIdx + 1].startsWith('--')
      ? argv[fileIdx + 1]
      : resolve(process.cwd(), '../../docs/BDD.xlsx');
  return { dryRun, file: resolve(file) };
}

function unzipEntry(xlsxPath: string, entry: string): string {
  return execFileSync('unzip', ['-p', xlsxPath, entry], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractSharedStrings(sstXml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let si: RegExpExecArray | null;
  while ((si = siRe.exec(sstXml))) {
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(si[1]))) {
      parts.push(decodeXml(t[1]));
    }
    out.push(parts.join(''));
  }
  return out;
}

function emailsFromCell(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => EMAIL_RE.test(part));
}

function collectEmails(xlsxPath: string): {
  emails: string[];
  skippedHeader: boolean;
  invalidCells: string[];
} {
  const strings = extractSharedStrings(
    unzipEntry(xlsxPath, 'xl/sharedStrings.xml'),
  );
  const invalidCells: string[] = [];
  const unique = new Set<string>();
  let skippedHeader = false;

  for (const raw of strings) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (/^adresse[-\s]?email$/i.test(trimmed)) {
      skippedHeader = true;
      continue;
    }
    const found = emailsFromCell(trimmed);
    if (found.length === 0) {
      invalidCells.push(trimmed);
      continue;
    }
    if (found.join(' ') !== trimmed.toLowerCase().replace(/[\s,;]+/g, ' ').trim()) {
      // Cellule mixte (ex. deux emails collés) : on garde les emails valides.
    }
    for (const email of found) unique.add(email);
  }

  return {
    emails: [...unique].sort(),
    skippedHeader,
    invalidCells,
  };
}

async function main() {
  const { dryRun, file } = parseArgs(process.argv.slice(2));

  if (!existsSync(file)) {
    throw new Error(`Fichier introuvable: ${file}`);
  }

  const { emails, skippedHeader, invalidCells } = collectEmails(file);
  console.log(`Fichier : ${file}`);
  console.log(`En-tête colonne : ${skippedHeader ? 'adresse-email OK' : 'non trouvé'}`);
  console.log(`Emails uniques extraits : ${emails.length}`);
  if (invalidCells.length) {
    console.log(`Cellules sans email valide (${invalidCells.length}) :`);
    for (const cell of invalidCells) console.log(`  - ${cell}`);
  }

  const existing = await prisma.newsletterSubscription.findMany({
    where: { email: { in: emails } },
    select: { email: true, isActive: true },
  });
  const existingMap = new Map(existing.map((row) => [row.email, row.isActive]));
  const toInsert = emails.filter((email) => !existingMap.has(email));
  const alreadyActive = emails.filter((email) => existingMap.get(email) === true);
  const alreadyInactive = emails.filter((email) => existingMap.get(email) === false);

  console.log(`Déjà inscrites (actives) : ${alreadyActive.length}`);
  console.log(`Déjà présentes mais désinscrites (laissées telles quelles) : ${alreadyInactive.length}`);
  console.log(`À insérer : ${toInsert.length}`);

  if (dryRun) {
    console.log('Dry-run : aucune écriture. Relancer sans --dry-run pour importer.');
    return;
  }

  if (toInsert.length === 0) {
    console.log('Rien à importer.');
    return;
  }

  const result = await prisma.newsletterSubscription.createMany({
    data: toInsert.map((email) => ({
      email,
      acceptedTerms: true,
      isActive: true,
      source: SOURCE,
    })),
    skipDuplicates: true,
  });

  console.log(`Importé : ${result.count} (source=${SOURCE}, sans e-mail de bienvenue).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

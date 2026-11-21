/**
 * Détecte la couleur de fond des logos déjà envoyés (annuaire + offres).
 * Usage : pnpm exec tsx scripts/backfill-logo-bg.ts
 */
import { resolve } from 'path';
import { config } from 'dotenv';
import { PrismaService } from '../src/prisma/prisma.service';
import { detectLogoBackground } from '../src/storage/logo-background';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: true });

const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

async function detect(key: string): Promise<string | null> {
  const url = /^https?:\/\//i.test(key) ? key : `${base}/${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return detectLogoBackground(Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const prisma = new PrismaService();
  const companies = await prisma.jobCompany.findMany({
    where: { logoKey: { not: null } },
  });
  for (const c of companies) {
    const bg = await detect(c.logoKey!);
    await prisma.jobCompany.update({
      where: { id: c.id },
      data: { logoBg: bg },
    });
    await prisma.job.updateMany({
      where: { companyId: c.id, companyLogoKey: c.logoKey },
      data: { companyLogoBg: bg },
    });
    console.log(`${c.name} → ${bg ?? 'blanc (par défaut)'}`);
  }
  const jobs = await prisma.job.findMany({
    where: { companyLogoKey: { not: null }, companyLogoBg: null },
  });
  for (const j of jobs) {
    const bg = await detect(j.companyLogoKey!);
    if (!bg) continue;
    await prisma.job.update({
      where: { id: j.id },
      data: { companyLogoBg: bg },
    });
    console.log(`offre ${j.slug} → ${bg}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

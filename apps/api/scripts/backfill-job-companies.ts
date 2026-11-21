/**
 * Crée les fiches de l’annuaire des entreprises fintech à partir des offres
 * existantes et y rattache chaque offre. Idempotent.
 * Usage : pnpm exec tsx scripts/backfill-job-companies.ts
 */
import { resolve } from 'path';
import { config } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '../src/jobs/jobs.service';
import type { ActivityService } from '../src/activity/activity.service';
import { PrismaService } from '../src/prisma/prisma.service';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: true });

async function main() {
  const prisma = new PrismaService();
  const jobs = new JobsService(
    prisma,
    new ConfigService(),
    {} as ActivityService,
  );
  const rows = await prisma.job.findMany({ where: { companyId: null } });
  for (const row of rows) {
    const linked = await jobs.syncCompany(row);
    console.log(`${row.companyName} → ${linked.companyId}`);
  }
  console.log(`${rows.length} offre(s) rattachée(s)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

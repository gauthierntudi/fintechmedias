/**
 * Détecte la couleur de fond des logos organisateurs / co-organisateurs
 * déjà envoyés sur les événements.
 * Usage : pnpm exec tsx scripts/backfill-event-logo-bg.ts
 */
import { resolve } from 'path';
import { config } from 'dotenv';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { detectLogoBackground } from '../src/storage/logo-background';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: true });

const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

async function detect(key: string): Promise<string | null> {
  const url = /^https?:\/\//i.test(key) ? key : `${base}/${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! ${res.status} ${url}`);
    return null;
  }
  return detectLogoBackground(Buffer.from(await res.arrayBuffer()));
}

type CoOrganizer = { logoKey?: string | null; logoBg?: string | null };

async function main() {
  const prisma = new PrismaService();
  const events = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
      organizer: true,
      organizerLogoKey: true,
      coOrganizers: true,
    },
  });
  for (const ev of events) {
    const co = Array.isArray(ev.coOrganizers)
      ? (ev.coOrganizers as CoOrganizer[])
      : [];
    if (!ev.organizerLogoKey && !co.some((o) => o.logoKey)) continue;

    const organizerLogoBg = ev.organizerLogoKey
      ? await detect(ev.organizerLogoKey)
      : null;
    const coOrganizers: CoOrganizer[] = [];
    for (const o of co) {
      coOrganizers.push({
        ...o,
        logoBg: o.logoKey ? await detect(o.logoKey) : null,
      });
    }
    await prisma.event.update({
      where: { id: ev.id },
      data: {
        organizerLogoBg,
        coOrganizers: coOrganizers as Prisma.InputJsonValue,
      },
    });
    console.log(
      `${ev.title} → organisateur ${organizerLogoBg ?? 'blanc'} ; co-org. ${
        coOrganizers.map((o) => o.logoBg ?? 'blanc').join(', ') || '—'
      }`,
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

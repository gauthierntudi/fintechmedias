/**
 * Ajoute 3 offres d’emploi de démonstration  pour
 * visualiser l’UI de l’onglet Jobs. Usage : pnpm exec tsx scripts/seed-test-jobs.ts
 * Suppression : les slugs commencent tous par « test-job- ».
 */
import { resolve } from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createPrismaD1ProxyAdapterFromEnv } from '../src/d1/prisma-d1-proxy.adapter';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env'), override: true });

const d1 = createPrismaD1ProxyAdapterFromEnv();
const prisma = d1 ? new PrismaClient({ adapter: d1 }) : new PrismaClient();

const endOfDay = (day: string) => new Date(`${day}T23:59:59.999+01:00`);

const jobs = [
  {
    slug: 'responsable-paiements-mobiles',
    title: 'Responsable produit — Paiements mobiles',
    companyName: 'Kivu Pay',
    companyUrl: 'https://example.com',
    contractType: 'CDI',
    workMode: 'HYBRID',
    locations: 'Kinshasa\nLubumbashi',
    deadline: endOfDay('2026-12-15'),
    applyUrl: 'https://example.com/careers/responsable-produit',
    description: `<p>Kivu Pay accélère le déploiement de son portefeuille mobile en RDC et recrute un·e <strong>Responsable produit</strong> pour piloter la feuille de route paiements.</p>
<h2>Vos missions</h2>
<ul><li>Définir la vision produit et prioriser le backlog avec les équipes tech.</li><li>Suivre les indicateurs clés : activation, rétention, volume de transactions.</li><li>Coordonner les intégrations avec les opérateurs télécoms et les banques partenaires.</li></ul>
<h2>Profil recherché</h2>
<ul><li>5 ans d’expérience minimum en gestion de produit, idéalement en fintech.</li><li>Bonne compréhension du <em>mobile money</em> et de la réglementation BCC.</li><li>Français courant, anglais professionnel.</li></ul>
<blockquote>Rejoignez une équipe qui sert déjà plus de 400 000 utilisateurs.</blockquote>`,
  },
  {
    slug: 'analyste-risque-credit',
    title: 'Analyste risque crédit',
    companyName: 'Horizon Bank RDC',
    companyUrl: null,
    contractType: 'CDD',
    workMode: 'ON_SITE',
    locations: 'Kinshasa — Gombe',
    deadline: endOfDay('2026-11-20'),
    applyEmail: 'recrutement@example.com',
    description: `<p>Dans le cadre du renforcement de sa direction des risques, la banque recrute un·e <strong>analyste risque crédit</strong> pour un contrat de 12 mois.</p>
<h3>Responsabilités</h3>
<ol><li>Analyser les dossiers de crédit PME et particuliers.</li><li>Produire les notes de synthèse pour le comité de crédit.</li><li>Suivre le portefeuille et les créances en souffrance.</li></ol>
<p>Envoyez CV et lettre de motivation par e-mail en précisant la référence <u>ARC-2026</u>.</p>`,
  },
  {
    slug: 'stage-developpeur-flutter',
    title: 'Stage — Développeur·se Flutter',
    companyName: 'Fintech Lab Africa',
    companyUrl: 'https://example.org',
    contractType: 'INTERNSHIP',
    workMode: 'REMOTE',
    locations: 'Kinshasa\nGoma\nAbidjan\nDakar',
    deadline: null,
    applyUrl: 'https://example.org/apply/stage-flutter',
    description: `<p>Stage de 6 mois au sein de l’équipe mobile pour contribuer à une application d’épargne collective (<em>likelemba</em> numérique).</p>
<h2>Ce que vous ferez</h2>
<ul><li>Développer de nouveaux écrans en Flutter / Dart.</li><li>Écrire des tests et participer aux revues de code.</li><li>Améliorer l’accessibilité et les performances de l’app.</li></ul>
<p>Plus d’infos sur <a href="https://example.org" target="_blank" rel="noopener noreferrer nofollow">notre site</a>.</p>`,
  },
] as const;

async function main() {
  await prisma.job.deleteMany({ where: { slug: { startsWith: 'test-job-' } } });
  const now = new Date();
  for (const job of jobs) {
    const data = {
      ...job,
      status: 'PUBLISHED' as const,
      publishedAt: now,
    };
    await prisma.job.upsert({
      where: { slug: job.slug },
      create: data,
      update: data,
    });
    console.log(`OK ${job.slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

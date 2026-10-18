/**
 * Envoie publication/uploads vers R2 en gardant la clé `uploads/...`.
 *
 * Usage (depuis apps/api) :
 *   pnpm migrate:uploads-r2
 *   pnpm migrate:uploads-r2 -- --dry-run
 *   pnpm migrate:uploads-r2 -- --force
 */
import { readdir, readFile, stat } from 'fs/promises';
import { extname, join, relative, resolve } from 'path';
import { config } from 'dotenv';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
  r2ObjectExists,
} from '../src/storage/r2';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

async function walk(dir: string): Promise<string[]> {
  const names = await readdir(dir);
  const out: string[] = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      out.push(...(await walk(full)));
      continue;
    }
    if (info.isFile()) out.push(full);
  }
  return out;
}

async function main() {
  const uploadsDir =
    process.env.UPLOADS_DIR?.trim() ||
    resolve(process.cwd(), '../../../publication/uploads');
  const r2 = createR2ClientFromEnv();
  if (!r2) {
    throw new Error(
      'Config R2 incomplète (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT)',
    );
  }

  const files = await walk(uploadsDir);
  console.log('— Uploads → R2 —');
  console.log(`Bucket : ${r2.bucket}`);
  console.log(`CDN    : ${r2.publicUrl || '(non défini)'}`);
  console.log(`Source : ${uploadsDir}`);
  console.log(`Fichiers : ${files.length}`);
  console.log(`Mode   : ${DRY_RUN ? 'dry-run' : FORCE ? 'force' : 'skip existing'}`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  for (const full of files) {
    const rel = relative(uploadsDir, full).split('\\').join('/');
    const key = `uploads/${rel}`;
    try {
      if (!DRY_RUN && !FORCE) {
        const exists = await r2ObjectExists(r2, key);
        if (exists) {
          skipped += 1;
          continue;
        }
      }
      const info = await stat(full);
      if (DRY_RUN) {
        uploaded += 1;
        bytes += info.size;
        continue;
      }
      const body = await readFile(full);
      await putR2Object(r2, {
        key,
        body,
        contentType: contentTypeForExt(extname(full)),
      });
      uploaded += 1;
      bytes += info.size;
      if ((uploaded + skipped) % 25 === 0) {
        console.log(`${uploaded + skipped}/${files.length} — ${key}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[fail] ${key}`, error);
    }
  }

  console.log('\n— Résumé —');
  console.log({
    total: files.length,
    uploaded,
    skipped,
    failed,
    bytes: formatBytes(bytes),
  });
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

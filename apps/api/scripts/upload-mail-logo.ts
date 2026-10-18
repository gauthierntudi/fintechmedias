/**
 * Publie le logo des e-mails sur R2.
 *   pnpm --filter @entrevue/api exec tsx scripts/upload-mail-logo.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { createR2ClientFromEnv, putR2Object } from '../src/storage/r2';

loadEnv({ path: resolve(__dirname, '../../../.env') });

async function main() {
  const r2 = createR2ClientFromEnv();
  if (!r2?.publicUrl) {
    throw new Error('Config R2 incomplète (clés, bucket ou URL publique)');
  }

  const file = resolve(
    __dirname,
    '../../web/public/brand/logo-fintech.png',
  );
  const body = readFileSync(file);
  const key = await putR2Object(r2, {
    key: 'brand/logo-fintech.png',
    body,
    contentType: 'image/png',
    cacheControl: 'public, max-age=86400',
  });
  console.log(`uploaded ${key} (${body.length} bytes)`);
  console.log(`${r2.publicUrl}/${key}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

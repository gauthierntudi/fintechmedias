import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const driver = (process.env.DATABASE_DRIVER ?? '').toLowerCase() || null;
    const d1Proxy = Boolean(process.env.D1_PROXY_URL?.trim());
    const d1Secret = Boolean(process.env.DATA_WORKER_SECRET?.trim());

    let database: 'up' | 'down' = 'down';
    let dbError: string | null = null;
    let d1Http: { ok: boolean; status?: number; error?: string } | null = null;

    if (driver === 'd1' && process.env.D1_PROXY_URL) {
      try {
        const res = await fetch(
          `${process.env.D1_PROXY_URL.replace(/\/$/, '')}/health`,
          {
            headers: process.env.DATA_WORKER_SECRET
              ? { 'x-data-secret': process.env.DATA_WORKER_SECRET }
              : {},
          },
        );
        d1Http = { ok: res.ok, status: res.status };
        if (!res.ok) {
          d1Http.error = (await res.text()).slice(0, 200);
        }
      } catch (err) {
        d1Http = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch (err) {
      database = 'down';
      dbError = err instanceof Error ? err.message : String(err);
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'entrevue-api',
      database,
      driver,
      d1Proxy,
      d1Secret,
      d1Http,
      dbError,
      timestamp: new Date().toISOString(),
    };
  }
}

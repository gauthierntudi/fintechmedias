import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createPrismaD1ProxyAdapterFromEnv } from '../d1/prisma-d1-proxy.adapter';

const RETRY_MS = 15_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private readonly usingD1 =
    (process.env.DATABASE_DRIVER ?? '').toLowerCase() === 'd1';

  constructor() {
    const d1 = createPrismaD1ProxyAdapterFromEnv();
    if (d1) {
      // Prisma 6 : factory passée directement comme `adapter`
      super({ adapter: d1 });
    } else {
      super();
    }
  }

  async onModuleInit() {
    const connected = await this.tryConnect();
    if (!connected) {
      if (this.usingD1) {
        this.logger.error(
          'D1 injoignable (D1_PROXY_URL / DATA_WORKER_SECRET). L’API reste allumée — reconnexion auto.',
        );
      } else {
        this.logger.error(
          'Postgres injoignable (localhost:5433). L’API reste allumée pour éviter un redémarrage en boucle. Lance `pnpm docker:dev` — reconnexion auto toutes les 15s.',
        );
      }
      this.scheduleReconnect();
    } else if (this.usingD1) {
      this.logger.log('Connecté à Cloudflare D1 via data-worker');
    }
  }

  async onModuleDestroy() {
    this.clearReconnect();
    await this.$disconnect();
  }

  private async tryConnect(): Promise<boolean> {
    try {
      await this.$connect();
      if (this.usingD1) {
        await this.$queryRaw`SELECT 1`;
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Connexion ${this.usingD1 ? 'D1' : 'Postgres'} échouée: ${message}`,
      );
      return false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(() => {
      void this.tryConnect().then((ok) => {
        if (!ok) return;
        this.logger.log(
          this.usingD1 ? 'D1 reconnecté' : 'Postgres reconnecté',
        );
        this.clearReconnect();
      });
    }, RETRY_MS);
    this.reconnectTimer.unref();
  }

  private clearReconnect() {
    if (!this.reconnectTimer) return;
    clearInterval(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

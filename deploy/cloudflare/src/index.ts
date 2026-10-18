import { Container, getContainer } from "@cloudflare/containers";

/**
 * Worker passerelle Fintech Médias.
 * - /api/* → Nest (ApiContainer)
 * - reste → Next (WebContainer)
 * - cron → keep-alive WorkerContainer (BullMQ)
 */

type Env = {
  WEB_CONTAINER: DurableObjectNamespace<WebContainer>;
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  WORKER_CONTAINER: DurableObjectNamespace<WorkerContainer>;
  DATA?: Fetcher;
  APP_URL?: string;
  API_URL?: string;
  /** Secrets (wrangler secret put) */
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  DATA_WORKER_SECRET?: string;
  D1_PROXY_URL?: string;
  DATABASE_DRIVER?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_ENDPOINT?: string;
  R2_PUBLIC_URL?: string;
  R2_URL?: string;
  R2_DEFAULT_REGION?: string;
  R2_USE_PATH_STYLE_ENDPOINT?: string;
  FLEXPAIE_MERCHANT?: string;
  FLEXPAIE_TOKEN?: string;
  FLEXPAIE_CALLBACK_URL?: string;
  FLEXPAIE_CURRENCY?: string;
  COOKIE_DOMAIN?: string;
  AVATAR_USE_CDN?: string;
  NEWSLETTER_SEND_IN_API?: string;
};

function pickEnv(
  env: Env,
  keys: (keyof Env)[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = env[key];
    if (typeof v === "string" && v.length > 0) out[key] = v;
  }
  return out;
}

const API_ENV_KEYS = [
  "APP_URL",
  "API_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  // DATABASE_URL : fixé en placeholder sqlite (adaptateur D1) — ne pas écraser
  "REDIS_URL",
  "DATA_WORKER_SECRET",
  "D1_PROXY_URL",
  "DATABASE_DRIVER",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_PUBLIC_URL",
  "R2_URL",
  "R2_DEFAULT_REGION",
  "R2_USE_PATH_STYLE_ENDPOINT",
  "FLEXPAIE_MERCHANT",
  "FLEXPAIE_TOKEN",
  "FLEXPAIE_CALLBACK_URL",
  "FLEXPAIE_CURRENCY",
  "COOKIE_DOMAIN",
  "AVATAR_USE_CDN",
  "NEWSLETTER_SEND_IN_API",
] as const satisfies readonly (keyof Env)[];

export class WebContainer extends Container<Env> {
  defaultPort = 3000;
  sleepAfter = "10m";
  enableInternet = true;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const app = env.APP_URL ?? "https://fintechmedias.com";
    // SSR : même origine (gateway) — pas localhost:3001 dans le container
    this.envVars = {
      NODE_ENV: "production",
      APP_URL: app,
      NEXT_PUBLIC_APP_URL: app,
      API_URL: app,
      NEXT_PUBLIC_API_URL: app,
      API_INTERNAL_URL: app,
    };
  }
}

export class ApiContainer extends Container<Env> {
  defaultPort = 3001;
  sleepAfter = "24h";
  enableInternet = true;
  /** Health Nest (évite le ping générique) */
  pingEndpoint = "localhost/api/health";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.envVars = {
      NODE_ENV: "production",
      APP_ENTRY: "dist/main.js",
      APP_URL: env.APP_URL ?? "https://fintechmedias.com",
      API_URL: env.API_URL ?? "https://api.fintechmedias.com",
      // Prisma sqlite placeholder (requêtes via adaptateur D1 HTTP)
      DATABASE_URL: "file:./d1-placeholder.db",
      DATABASE_DRIVER: env.DATABASE_DRIVER ?? "d1",
      ...pickEnv(env, [...API_ENV_KEYS]),
    };
  }

  override onError(error: unknown) {
    console.error("ApiContainer error:", error);
  }
}

/** Processus BullMQ — pas de trafic HTTP public, pingé par le cron. */
export class WorkerContainer extends Container<Env> {
  defaultPort = 3001;
  sleepAfter = "24h";
  enableInternet = true;
  pingEndpoint = "localhost/api/health";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.envVars = {
      NODE_ENV: "production",
      APP_ENTRY: "dist/worker.js",
      NEWSLETTER_SEND_IN_API: "0",
      APP_URL: env.APP_URL ?? "https://fintechmedias.com",
      API_URL: env.API_URL ?? "https://api.fintechmedias.com",
      DATABASE_URL: "file:./d1-placeholder.db",
      DATABASE_DRIVER: env.DATABASE_DRIVER ?? "d1",
      ...pickEnv(env, [...API_ENV_KEYS]),
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/cf-health") {
      let dataOk: boolean | null = null;
      if (env.DATA) {
        try {
          const res = await env.DATA.fetch("https://data-worker/health");
          dataOk = res.ok;
        } catch {
          dataOk = false;
        }
      }
      return Response.json({
        ok: true,
        service: "fintech-gateway",
        dataWorker: dataOk,
        hasJwt: Boolean(env.JWT_ACCESS_SECRET),
        hasDatabaseUrl: Boolean(env.DATABASE_URL),
      });
    }

    const isApi =
      url.pathname === "/api" || url.pathname.startsWith("/api/");

    const container = isApi
      ? // bump id pour forcer un cold start (nouveaux secrets / image D1)
        getContainer(env.API_CONTAINER, "api-d1-v2")
      : getContainer(env.WEB_CONTAINER, "web-api-url");

    return container.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    try {
      const worker = getContainer(env.WORKER_CONTAINER, "bullmq-d1");
      await worker.fetch("http://worker/api/health");
    } catch (err) {
      console.error("worker keep-alive failed", err);
    }
  },
};

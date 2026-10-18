/**
 * Client HTTP vers le Worker Data (binding D1).
 * À utiliser quand DATABASE_DRIVER=d1 (prod Cloudflare).
 * Le Prisma local (Postgres) reste le défaut en dev.
 */

export type D1QueryResult<T = Record<string, unknown>> = {
  ok: boolean;
  results?: T[];
  error?: string;
  meta?: unknown;
};

export class D1ProxyClient {
  constructor(
    private readonly baseUrl: string,
    private readonly secret?: string,
  ) {}

  private headers(): HeadersInit {
    const h: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.secret) h["x-data-secret"] = this.secret;
    return h;
  }

  async health(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/health`, {
      headers: this.headers(),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean; d1?: boolean };
    return Boolean(body.ok && body.d1);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<D1QueryResult<T>> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/query`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ sql, params }),
    });
    return (await res.json()) as D1QueryResult<T>;
  }
}

export function createD1ProxyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): D1ProxyClient | null {
  if ((env.DATABASE_DRIVER ?? "").toLowerCase() !== "d1") return null;
  const base = env.D1_PROXY_URL?.trim();
  if (!base) return null;
  return new D1ProxyClient(base, env.DATA_WORKER_SECRET?.trim());
}

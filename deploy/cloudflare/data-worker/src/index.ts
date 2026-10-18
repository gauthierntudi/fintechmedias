/**
 * Worker Data — détient le binding D1.
 * L’API Nest / le worker BullMQ l’appellent via service binding (env.DATA)
 * ou via URL publique (D1_PROXY_URL) depuis les Containers.
 *
 * Endpoints :
 *   GET  /health
 *   POST /query   { sql, params? }  — résultats en objets (debug / outils)
 *   POST /raw     { sql, params? }  — format Prisma driver adapter (columns + rows)
 */

export interface Env {
  DB: D1Database;
  DATA_WORKER_SECRET?: string;
}

type QueryBody = {
  sql: string;
  params?: unknown[];
};

function unauthorized(): Response {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function assertSecret(request: Request, env: Env): boolean {
  const expected = env.DATA_WORKER_SECRET?.trim();
  if (!expected) return true;
  return request.headers.get("x-data-secret") === expected;
}

function bind(stmt: D1PreparedStatement, params?: unknown[]) {
  if (Array.isArray(params) && params.length > 0) {
    return stmt.bind(...params);
  }
  return stmt;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!assertSecret(request, env)) return unauthorized();

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      try {
        const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return Response.json({ ok: true, d1: row?.ok === 1 });
      } catch (err) {
        return Response.json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "D1 error",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/query" && request.method === "POST") {
      let body: QueryBody;
      try {
        body = (await request.json()) as QueryBody;
      } catch {
        return Response.json({ ok: false, error: "JSON invalide" }, { status: 400 });
      }
      if (!body.sql?.trim()) {
        return Response.json({ ok: false, error: "sql requis" }, { status: 400 });
      }
      try {
        const result = await bind(env.DB.prepare(body.sql), body.params).all();
        return Response.json({
          ok: true,
          results: result.results,
          meta: result.meta,
          success: result.success,
        });
      } catch (err) {
        return Response.json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Query failed",
          },
          { status: 500 },
        );
      }
    }

    /**
     * Format attendu par Prisma `@prisma/adapter-d1` (HTTP) :
     * { success, result: [{ results: { columns, rows }, meta: { changes } }] }
     */
    if (url.pathname === "/raw" && request.method === "POST") {
      let body: QueryBody;
      try {
        body = (await request.json()) as QueryBody;
      } catch {
        return Response.json(
          { success: false, errors: [{ code: 400, message: "JSON invalide" }], result: [] },
          { status: 400 },
        );
      }
      if (!body.sql?.trim()) {
        return Response.json(
          { success: false, errors: [{ code: 400, message: "sql requis" }], result: [] },
          { status: 400 },
        );
      }
      try {
        const result = await bind(env.DB.prepare(body.sql), body.params).all();
        const objects = (result.results ?? []) as Record<string, unknown>[];
        const columns = objects.length > 0 ? Object.keys(objects[0]) : [];
        const rows = objects.map((row) => columns.map((c) => row[c]));
        return Response.json({
          success: true,
          errors: [],
          messages: [],
          result: [
            {
              results: { columns, rows },
              meta: { changes: result.meta?.changes ?? 0 },
              success: true,
            },
          ],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Query failed";
        return Response.json(
          {
            success: false,
            errors: [{ code: 7500, message }],
            messages: [],
            result: [],
          },
          { status: 500 },
        );
      }
    }

    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  },
};

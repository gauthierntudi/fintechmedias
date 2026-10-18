/**
 * Factory Prisma (sqlite) qui exécute le SQL via le Worker Data `/raw`.
 * Compatible avec le format HTTP de `@prisma/adapter-d1`.
 */
import {
  ColumnTypeEnum,
  Debug,
  DriverAdapterError,
  type ColumnType,
  type ConnectionInfo,
  type IsolationLevel,
  type SqlDriverAdapter,
  type SqlDriverAdapterFactory,
  type SqlQuery,
  type SqlQueryable,
  type SqlResultSet,
  type Transaction,
  type TransactionOptions,
} from "@prisma/driver-adapter-utils";

const debug = Debug("prisma:driver-adapter:d1-proxy");

type RawResult = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{
    results?: { columns?: string[]; rows?: unknown[][] };
    meta?: { changes?: number };
  }>;
};

function inferColumnTypes(
  columnNames: string[],
  rows: unknown[][],
): ColumnType[] {
  return columnNames.map((_, col) => {
    for (const row of rows) {
      const v = row[col];
      if (v === null || v === undefined) continue;
      if (typeof v === "boolean") return ColumnTypeEnum.Boolean;
      if (typeof v === "number") {
        return Number.isInteger(v)
          ? ColumnTypeEnum.Int32
          : ColumnTypeEnum.Double;
      }
      if (typeof v === "bigint") return ColumnTypeEnum.Int64;
      if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
        return ColumnTypeEnum.Bytes;
      }
      if (typeof v === "string") {
        if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return ColumnTypeEnum.DateTime;
        return ColumnTypeEnum.Text;
      }
    }
    return ColumnTypeEnum.Text;
  });
}

function mapRow(row: unknown[], columnTypes: ColumnType[]): unknown[] {
  return row.map((value, i) => {
    if (value === null || value === undefined) return null;
    const t = columnTypes[i];
    if (t === ColumnTypeEnum.Boolean) {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
    }
    if (
      (t === ColumnTypeEnum.Int32 || t === ColumnTypeEnum.Int64) &&
      typeof value === "string" &&
      /^-?\d+$/.test(value)
    ) {
      return t === ColumnTypeEnum.Int64 ? BigInt(value) : Number(value);
    }
    return value;
  });
}

function mapArg(arg: unknown): unknown {
  if (typeof arg === "boolean") return arg ? 1 : 0;
  if (typeof arg === "bigint") return Number(arg);
  if (arg instanceof Date) return arg.toISOString();
  return arg;
}

class D1ProxyQueryable implements SqlQueryable {
  readonly provider = "sqlite" as const;
  readonly adapterName = "fintech-d1-proxy";

  constructor(
    protected readonly baseUrl: string,
    protected readonly secret?: string,
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.secret) h["x-data-secret"] = this.secret;
    return h;
  }

  private async performIO(query: SqlQuery): Promise<{
    columnNames: string[];
    rows: unknown[][];
    affectedRows?: number;
  }> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/raw`;
    const params = query.args.map((arg) => mapArg(arg));

    debug("[performIO] %O", { sql: query.sql, params });

    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ sql: query.sql, params }),
    });

    const body = (await res.json()) as RawResult;
    if (!body.success) {
      const err = body.errors?.[0];
      throw new DriverAdapterError({
        kind: "sqlite",
        extendedCode: err?.code ?? 1,
        message: err?.message ?? `D1 proxy HTTP ${res.status}`,
      });
    }

    const first = body.result?.[0];
    if (!first) {
      throw new DriverAdapterError({
        kind: "sqlite",
        extendedCode: 1,
        message: "D1 proxy: empty result",
      });
    }

    return {
      columnNames: first.results?.columns ?? [],
      rows: first.results?.rows ?? [],
      affectedRows: first.meta?.changes,
    };
  }

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const data = await this.performIO(query);
    if (data.rows.length === 0) {
      return {
        columnNames: data.columnNames,
        columnTypes: data.columnNames.map(() => ColumnTypeEnum.Text),
        rows: [],
      };
    }
    const columnTypes = inferColumnTypes(data.columnNames, data.rows);
    return {
      columnNames: data.columnNames,
      columnTypes,
      rows: data.rows.map((row) => mapRow(row, columnTypes)),
    };
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    const data = await this.performIO(query);
    return data.affectedRows ?? 0;
  }
}

class D1ProxyTransaction extends D1ProxyQueryable implements Transaction {
  constructor(
    baseUrl: string,
    secret: string | undefined,
    readonly options: TransactionOptions,
  ) {
    super(baseUrl, secret);
  }

  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  async createSavepoint(_name: string): Promise<void> {}
  async rollbackToSavepoint(_name: string): Promise<void> {}
  async releaseSavepoint(_name: string): Promise<void> {}
}

class D1ProxyAdapter extends D1ProxyQueryable implements SqlDriverAdapter {
  async executeScript(script: string): Promise<void> {
    await this.executeRaw({ sql: script, args: [], argTypes: [] });
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      maxBindValues: 98,
      supportsRelationJoins: false,
    };
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== "SERIALIZABLE") {
      throw new DriverAdapterError({
        kind: "InvalidIsolationLevel",
        level: isolationLevel,
      });
    }
    return new D1ProxyTransaction(this.baseUrl, this.secret, {
      usePhantomQuery: true,
    });
  }

  async dispose(): Promise<void> {}
}

export class PrismaD1ProxyAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = "sqlite" as const;
  readonly adapterName = "fintech-d1-proxy";

  constructor(
    private readonly baseUrl: string,
    private readonly secret?: string,
  ) {}

  async connect(): Promise<SqlDriverAdapter> {
    return new D1ProxyAdapter(this.baseUrl, this.secret);
  }
}

export function createPrismaD1ProxyAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PrismaD1ProxyAdapterFactory | null {
  if ((env.DATABASE_DRIVER ?? "").toLowerCase() !== "d1") return null;
  const base = env.D1_PROXY_URL?.trim();
  if (!base) return null;
  return new PrismaD1ProxyAdapterFactory(base, env.DATA_WORKER_SECRET?.trim());
}

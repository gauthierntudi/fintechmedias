#!/usr/bin/env node
/**
 * Convertit un export D1 (SQLite) en SQL Postgres pour la base du VPS.
 *
 * Usage :
 *   node deploy/vps/import-d1-to-pg.mjs <d1.sqlite> <pg-columns.json> <out.sql>
 *
 *   - d1.sqlite       : base SQLite chargée depuis `wrangler d1 export`
 *   - pg-columns.json : [{table, column, type}] depuis information_schema (Postgres cible)
 *   - out.sql         : SQL à rejouer avec psql (TRUNCATE + INSERT, une transaction)
 *
 * Les types sont convertis d'après le schéma Postgres cible :
 * booléens 0/1, dates (ms epoch ou texte ISO), JSON texte, enums texte.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";

const [, , sqlitePath, colsPath, outPath] = process.argv;
if (!sqlitePath || !colsPath || !outPath) {
  console.error("usage: import-d1-to-pg.mjs <d1.sqlite> <pg-columns.json> <out.sql>");
  process.exit(1);
}

const db = new DatabaseSync(sqlitePath, { readOnly: true });
const pgCols = JSON.parse(readFileSync(colsPath, "utf8"));

/** table → Map(column → pg type) */
const pgSchema = new Map();
for (const { table, column, type } of pgCols) {
  if (!pgSchema.has(table)) pgSchema.set(table, new Map());
  pgSchema.get(table).set(column, type);
}

const sqliteTables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' AND name <> '_prisma_migrations'",
  )
  .all()
  .map((r) => r.name);

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ident = (s) => `"${s.replace(/"/g, '""')}"`;

function toTimestamp(v) {
  if (typeof v === "number" || typeof v === "bigint") {
    const n = Number(v);
    // Prisma SQLite stocke en ms epoch ; tolère des secondes
    const ms = n < 1e11 ? n * 1000 : n;
    return q(new Date(ms).toISOString());
  }
  const s = String(v);
  if (/^\d+$/.test(s)) return toTimestamp(Number(s));
  return q(s);
}

function convert(v, type) {
  if (v === null || v === undefined) return "NULL";
  switch (type) {
    case "boolean":
      if (typeof v === "string") return /^(1|true|t)$/i.test(v) ? "TRUE" : "FALSE";
      return Number(v) ? "TRUE" : "FALSE";
    case "timestamp without time zone":
    case "timestamp with time zone":
    case "date":
      return toTimestamp(v);
    case "integer":
    case "bigint":
    case "smallint":
    case "numeric":
    case "double precision":
    case "real": {
      // D1 stocke parfois les Decimal Prisma en texte JSON ("0", "12.50")
      const s = String(v).trim().replace(/^"(.*)"$/, "$1");
      if (s === "" || !Number.isFinite(Number(s))) {
        console.warn(`valeur numérique invalide ${JSON.stringify(v)} → NULL`);
        return "NULL";
      }
      return s;
    }
    case "json":
    case "jsonb":
      return `${q(typeof v === "string" ? v : JSON.stringify(v))}::${type}`;
    case "bytea":
      return `'\\x${Buffer.from(v).toString("hex")}'`;
    default:
      // text, varchar, enums (USER-DEFINED) : le cast implicite depuis un littéral suffit
      return q(v);
  }
}

const out = [
  "-- Généré par deploy/vps/import-d1-to-pg.mjs",
  "BEGIN;",
  "SET session_replication_role = replica;",
];

const imported = [];
const tables = sqliteTables.filter((t) => pgSchema.has(t));
const missing = sqliteTables.filter((t) => !pgSchema.has(t));
if (missing.length) console.warn("Tables D1 absentes de Postgres (ignorées):", missing.join(", "));

out.push(`TRUNCATE ${tables.map(ident).join(", ")} CASCADE;`);

for (const table of tables) {
  const cols = pgSchema.get(table);
  const srcCols = db
    .prepare(`PRAGMA table_info(${ident(table)})`)
    .all()
    .map((c) => c.name)
    .filter((c) => cols.has(c));
  const skipped = db
    .prepare(`PRAGMA table_info(${ident(table)})`)
    .all()
    .map((c) => c.name)
    .filter((c) => !cols.has(c));
  if (skipped.length) console.warn(`${table}: colonnes ignorées ${skipped.join(", ")}`);

  const rows = db.prepare(`SELECT ${srcCols.map(ident).join(", ")} FROM ${ident(table)}`).all();
  const colList = srcCols.map(ident).join(", ");
  for (const row of rows) {
    const vals = srcCols.map((c) => convert(row[c], cols.get(c))).join(", ");
    out.push(`INSERT INTO ${ident(table)} (${colList}) VALUES (${vals});`);
  }
  imported.push([table, rows.length]);
}

// Réaligne les séquences (colonnes serial / identity) s'il y en a
out.push(`DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name, pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) IS NOT NULL
  LOOP
    EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, false)', r.seq, r.column_name, r.table_name);
  END LOOP;
END $$;`);

out.push("SET session_replication_role = DEFAULT;", "COMMIT;");
writeFileSync(outPath, out.join("\n") + "\n", "utf8");

let total = 0;
for (const [t, n] of imported) {
  console.log(`${t.padEnd(30)} ${n}`);
  total += n;
}
console.log(`\nTotal: ${total} lignes → ${outPath}`);

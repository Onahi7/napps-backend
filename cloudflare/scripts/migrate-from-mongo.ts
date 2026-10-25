/**
 * Export the existing MongoDB data into D1-compatible SQL.
 *
 *   MONGO_URI="mongodb+srv://..." MONGO_DB=napps \
 *     npm run migrate:mongo
 *
 * Outputs migration.sql in the project root. Apply it with:
 *   npm run db:schema:remote
 *   npx wrangler d1 execute napps --remote --file=./migration.sql
 *
 * Safe to re-run: every insert is INSERT OR IGNORE on the primary key.
 */
import { readFileSync, writeFileSync } from "node:fs";
import dns from "node:dns";
import { MongoClient, ObjectId } from "mongodb";

try {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
} catch {
  /* keep system resolvers */
}

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "napps";

if (!MONGO_URI) {
  console.error("MONGO_URI is required");
  process.exit(1);
}

const TABLE_COLLECTIONS: Record<string, string[]> = {
  users: ["users"],
  proprietors: ["proprietors"],
  schools: ["schools"],
  fees: ["fees", "feeconfigurations", "feeconfigs", "fee_configs"],
  payments: ["payments"],
  levy_payments: ["levypayments", "levy_payments"],
  enrollments: ["enrollments"],
  school_enrollments: ["schoolenrollments", "school_enrollments"],
  announcements: ["announcements"],
  members: ["members"],
  team_members: ["teammembers", "team_members"],
  hero_images: ["heroimages", "hero_images"],
  homepage_content: ["homepagecontents", "homepage_content"],
  page_content: ["pagecontents", "page_content"],
  site_settings: ["sitesettings", "site_settings"],
};

const COLUMN_OVERRIDES: Record<string, Record<string, string>> = {
  proprietors: { school: "school_id" },
  schools: { proprietor: "proprietor_id" },
  payments: { proprietor: "proprietor_id", school: "school_id" },
  levy_payments: { proprietor: "proprietor_id" },
  enrollments: { proprietor: "proprietor_id", school: "school_id" },
  school_enrollments: { school: "school_id" },
};

const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");

function tableColumns(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const pattern = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g;
  for (const match of schema.matchAll(pattern)) {
    const [, table, body] = match;
    const columns = new Set<string>();
    for (const line of body.split("\n")) {
      const column = /^\s{2}(\w+)\s/.exec(line);
      if (!column) continue;
      if (["UNIQUE", "CHECK", "FOREIGN", "PRIMARY"].includes(column[1])) continue;
      columns.add(column[1]);
    }
    map.set(table, columns);
  }
  return map;
}

const COLUMNS = tableColumns();

const snake = (value: string) =>
  value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const client = new MongoClient(MONGO_URI!);
await client.connect();
const db = client.db(MONGO_DB);

const existing = new Set(
  (await db.listCollections().toArray()).map((c) => c.name),
);

const statements: string[] = ["PRAGMA foreign_keys = OFF;"];
const summary: string[] = [];

for (const [table, candidates] of Object.entries(TABLE_COLLECTIONS)) {
  const columns = COLUMNS.get(table);
  if (!columns) {
    console.warn(`skip ${table}: not in schema`);
    continue;
  }
  const collection = candidates.find((name) => existing.has(name));
  if (!collection) {
    summary.push(`${table}: collection not found`);
    continue;
  }

  const docs = await db.collection(collection).find({}).toArray();
  let inserted = 0;
  for (const doc of docs) {
    const row: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(doc)) {
      if (key === "_id" || key === "__v") continue;
      const override = COLUMN_OVERRIDES[table]?.[key];
      const column = override ?? snake(key);
      if (!columns.has(column)) continue;
      row[column] = convert(raw);
    }
    row.id = (doc._id as ObjectId).toHexString();
    const now = new Date().toISOString();
    if (columns.has("created_at") && row.created_at == null) row.created_at = now;
    if (columns.has("updated_at") && row.updated_at == null) row.updated_at = now;

    const keys = Object.keys(row);
    statements.push(
      `INSERT OR IGNORE INTO ${table} (${keys.join(", ")}) VALUES (${keys
        .map((key) => sqlLiteral(row[key]))
        .join(", ")});`,
    );
    inserted += 1;
  }
  summary.push(`${table}: ${inserted} rows from ${collection}`);
}

await client.close();

const output = `${statements.join("\n")}\n`;
writeFileSync(new URL("../migration.sql", import.meta.url), output, "utf8");

console.log(summary.join("\n"));
console.log(`\nWrote migration.sql (${statements.length - 1} inserts)`);

import { nowIso, uuid } from "./http.ts";
import type { AppEnv } from "../env.ts";

type DB = AppEnv["Bindings"]["DB"];

export type Row = Record<string, any>;
export type FieldMap = Record<string, string>;

export interface RowOptions {
  json?: Set<string>;
  bool?: Set<string>;
}

export function toColumns(data: Row, fields: FieldMap, opts: RowOptions = {}) {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(fields)) {
    const value = data[field];
    if (value === undefined) continue;
    columns.push(column);
    if (opts.json?.has(field)) {
      values.push(value == null ? null : JSON.stringify(value));
    } else if (opts.bool?.has(field)) {
      values.push(value ? 1 : 0);
    } else {
      values.push(value ?? null);
    }
  }
  return { columns, values };
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(", ");
}

export async function insertRow(
  db: DB,
  table: string,
  data: Row,
  fields: FieldMap,
  opts: RowOptions = {},
): Promise<Row | null> {
  const payload: Row = { ...data };
  if (!payload.id) payload.id = uuid();
  const timestamp = nowIso();
  if (!payload.createdAt) payload.createdAt = timestamp;
  payload.updatedAt = timestamp;
  const allFields: FieldMap = {
    id: "id",
    ...fields,
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  const { columns, values } = toColumns(payload, allFields, opts);
  await db
    .prepare(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders(values)})`,
    )
    .bind(...values)
    .run();
  return getRow(db, table, String(payload.id));
}

export async function getRow(
  db: DB,
  table: string,
  id: string,
): Promise<Row | null> {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<Row>();
}

export async function updateRow(
  db: DB,
  table: string,
  id: string,
  data: Row,
  fields: FieldMap,
  opts: RowOptions = {},
): Promise<Row | null> {
  const payload: Row = { ...data, updatedAt: nowIso() };
  const allFields: FieldMap = { ...fields, updatedAt: "updated_at" };
  const { columns, values } = toColumns(payload, allFields, opts);
  if (!columns.length) return getRow(db, table, id);
  await db
    .prepare(
      `UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    )
    .bind(...values, id)
    .run();
  return getRow(db, table, id);
}

export async function deleteRow(
  db: DB,
  table: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM ${table} WHERE id = ?`)
    .bind(id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export function pageParams(c: { req: { query: (k: string) => string | undefined } }) {
  const page = Math.max(1, Number(c.req.query("page") || 1));
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") || 10)));
  return { page, limit, offset: (page - 1) * limit };
}

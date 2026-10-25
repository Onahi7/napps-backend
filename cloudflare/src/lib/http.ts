export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const nowIso = () => new Date().toISOString();

export const currentSession = (date = new Date()) => {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

export const uuid = () => crypto.randomUUID();

const JSON_COLUMNS = new Set([
  "roles",
  "app_access",
  "participation_history",
  "dues_declarations",
  "dues_payment_history",
  "chapters",
  "enrollment",
  "images",
  "fee_structure",
  "metadata",
  "virtual_account",
  "webhook_data",
  "split_config",
  "fee_breakdown",
  "wards",
  "enrollment_by_level",
  "gender_breakdown",
  "staff_data",
  "social_media",
  "achievements",
  "qualifications",
  "gallery_urls",
  "gallery_public_ids",
]);

const BOOLEAN_COLUMNS = new Set([
  "is_active",
  "is_email_verified",
  "is_primary",
  "is_recurring",
  "allow_partial_payment",
  "is_manual_school_entry",
  "is_continuation",
  "is_public",
  "is_featured",
  "webhook_received",
  "has_napps_id_card",
  "show_on_all_pages",
  "show_on_portal",
  "is_published",
]);

const toCamel = (key: string) =>
  key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

export function camelizeRow(
  row: Record<string, unknown> | null | undefined,
): Record<string, any> | null {
  if (!row) return null;
  const out: Record<string, any> = {};
  for (const [key, raw] of Object.entries(row)) {
    let value = raw;
    const looksJson =
      typeof value === "string" && /^\s*[[{]/.test(value);
    if ((JSON_COLUMNS.has(key) || looksJson) && typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = key === "chapters" || key === "roles" ? [] : null;
      }
    }
    if (BOOLEAN_COLUMNS.has(key) && (value === 0 || value === 1)) {
      value = value === 1;
    }
    out[toCamel(key)] = value;
  }
  if (out.id) out._id = out.id;
  return out;
}

export function camelizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => camelizeRow(row)).filter(Boolean) as Record<string, any>[];
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const jsonBody = async <T = Record<string, any>>(c: {
  req: { json: () => Promise<unknown> };
}): Promise<T> => {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
};

export async function paginate(
  db: D1DatabaseLike,
  table: string,
  where: string,
  params: unknown[],
  page: number,
  limit: number,
  orderBy = "created_at DESC",
) {
  const offset = (page - 1) * limit;
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM ${table} ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const rows = await db
    .prepare(`SELECT * FROM ${table} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset)
    .all();
  return { rows: rows.results, total: countRow?.total ?? 0 };
}

type D1DatabaseLike = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      first: <T = Record<string, unknown>>() => Promise<T | null>;
      all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
    };
  };
};

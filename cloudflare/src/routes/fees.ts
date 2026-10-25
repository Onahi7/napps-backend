import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { requireRoles } from "../lib/auth.ts";
import { ApiError, camelizeRow, camelizeRows, nowIso } from "../lib/http.ts";

const feeSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().optional(),
  amount: z.number().min(0),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  feeStructure: z.any().optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string().optional(),
  minimumAmount: z.number().optional(),
  maximumAmount: z.number().optional(),
  allowPartialPayment: z.boolean().optional(),
  metadata: z.any().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  paystackSplitCode: z.string().optional(),
  splitCodeDescription: z.string().optional(),
});

const updateFeeSchema = feeSchema.partial();

const FIELD_MAP: Record<string, string> = {
  name: "name",
  code: "code",
  amount: "amount",
  description: "description",
  isActive: "is_active",
  feeStructure: "fee_structure",
  isRecurring: "is_recurring",
  recurringInterval: "recurring_interval",
  dueDate: "due_date",
  status: "status",
  minimumAmount: "minimum_amount",
  maximumAmount: "maximum_amount",
  allowPartialPayment: "allow_partial_payment",
  metadata: "metadata",
  validFrom: "valid_from",
  validUntil: "valid_until",
  paystackSplitCode: "paystack_split_code",
  splitCodeDescription: "split_code_description",
};

const BOOLEAN_FIELDS = new Set([
  "isActive",
  "isRecurring",
  "allowPartialPayment",
]);
const JSON_FIELDS = new Set(["feeStructure", "metadata"]);

function toColumnValue(field: string, value: unknown) {
  if (BOOLEAN_FIELDS.has(field)) return value ? 1 : 0;
  if (JSON_FIELDS.has(field)) return value == null ? null : JSON.stringify(value);
  return value ?? null;
}

async function findByName(
  db: AppEnv["Bindings"]["DB"],
  name: string,
  excludeId?: string,
) {
  const sql = excludeId
    ? "SELECT id FROM fees WHERE lower(name) = lower(?) AND id <> ?"
    : "SELECT id FROM fees WHERE lower(name) = lower(?)";
  const stmt = db.prepare(sql);
  return excludeId ? stmt.bind(name, excludeId).first() : stmt.bind(name).first();
}

async function getFee(db: AppEnv["Bindings"]["DB"], id: string) {
  const row = await db.prepare("SELECT * FROM fees WHERE id = ?").bind(id).first();
  return camelizeRow(row);
}

export const feesRoutes = () =>
  new Hono<AppEnv>()
    .get("/", async (c) => {
      const active = c.req.query("active");
      const sql =
        active === "true"
          ? "SELECT * FROM fees WHERE is_active = 1 ORDER BY created_at DESC"
          : "SELECT * FROM fees ORDER BY created_at DESC";
      const { results } = await c.env.DB.prepare(sql).all();
      return c.json(camelizeRows(results));
    })
    .get("/active", async (c) => {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM fees WHERE is_active = 1 ORDER BY created_at DESC",
      ).all();
      return c.json(camelizeRows(results));
    })
    .get("/stats", requireRoles("admin", "super_admin"), async (c) => {
      const row = await c.env.DB.prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(is_active = 1), 0) AS active,
                COALESCE(SUM(is_active = 0), 0) AS inactive,
                COALESCE(SUM(CASE WHEN is_active = 1 THEN amount ELSE 0 END), 0) AS totalAmount
         FROM fees`,
      ).first<Record<string, number>>();
      return c.json({
        total: row?.total ?? 0,
        active: row?.active ?? 0,
        inactive: row?.inactive ?? 0,
        totalAmount: row?.totalAmount ?? 0,
      });
    })
    .get("/:id", async (c) => {
      const fee = await getFee(c.env.DB, c.req.param("id"));
      if (!fee) {
        throw new ApiError(404, `Fee with ID ${c.req.param("id")} not found`);
      }
      return c.json(fee);
    })
    .post("/", requireRoles("admin", "super_admin"), async (c) => {
      const input = feeSchema.parse(await c.req.json());
      if (await findByName(c.env.DB, input.name)) {
        throw new ApiError(400, "A fee with this name already exists");
      }
      const id = crypto.randomUUID();
      const timestamp = nowIso();
      const columns = ["id"];
      const placeholders = ["?"];
      const values: unknown[] = [id];
      for (const [field, value] of Object.entries(input)) {
        if (value === undefined || field === "isActive") continue;
        columns.push(FIELD_MAP[field]);
        placeholders.push("?");
        values.push(toColumnValue(field, value));
      }
      columns.push("is_active", "created_at", "updated_at");
      placeholders.push("?", "?", "?");
      values.push(
        input.isActive === false ? 0 : 1,
        timestamp,
        timestamp,
      );
      await c.env.DB.prepare(
        `INSERT INTO fees (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
      )
        .bind(...values)
        .run();
      return c.json(await getFee(c.env.DB, id), 201);
    })
    .put("/:id", requireRoles("admin", "super_admin"), async (c) => {
      const id = c.req.param("id");
      const existing = await getFee(c.env.DB, id);
      if (!existing) throw new ApiError(404, `Fee with ID ${id} not found`);
      const input = updateFeeSchema.parse(await c.req.json());
      if (
        input.name &&
        input.name.toLowerCase() !== String(existing.name).toLowerCase() &&
        (await findByName(c.env.DB, input.name, id))
      ) {
        throw new ApiError(400, "A fee with this name already exists");
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const [field, value] of Object.entries(input)) {
        if (value === undefined) continue;
        sets.push(`${FIELD_MAP[field]} = ?`);
        values.push(toColumnValue(field, value));
      }
      if (sets.length) {
        sets.push("updated_at = ?");
        values.push(nowIso(), id);
        await c.env.DB.prepare(
          `UPDATE fees SET ${sets.join(", ")} WHERE id = ?`,
        )
          .bind(...values)
          .run();
      }
      return c.json(await getFee(c.env.DB, id));
    })
    .patch("/:id", requireRoles("admin", "super_admin"), async (c) => {
      const id = c.req.param("id");
      const existing = await getFee(c.env.DB, id);
      if (!existing) throw new ApiError(404, `Fee with ID ${id} not found`);
      const input = updateFeeSchema.parse(await c.req.json());
      if (
        input.name &&
        input.name.toLowerCase() !== String(existing.name).toLowerCase() &&
        (await findByName(c.env.DB, input.name, id))
      ) {
        throw new ApiError(400, "A fee with this name already exists");
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const [field, value] of Object.entries(input)) {
        if (value === undefined) continue;
        sets.push(`${FIELD_MAP[field]} = ?`);
        values.push(toColumnValue(field, value));
      }
      if (sets.length) {
        sets.push("updated_at = ?");
        values.push(nowIso(), id);
        await c.env.DB.prepare(
          `UPDATE fees SET ${sets.join(", ")} WHERE id = ?`,
        )
          .bind(...values)
          .run();
      }
      return c.json(await getFee(c.env.DB, id));
    })
    .delete("/:id", requireRoles("admin", "super_admin"), async (c) => {
      const id = c.req.param("id");
      const result = await c.env.DB.prepare("DELETE FROM fees WHERE id = ?")
        .bind(id)
        .run();
      if (!Number(result.meta.changes ?? 0)) {
        throw new ApiError(404, `Fee with ID ${id} not found`);
      }
      return c.body(null, 204);
    });

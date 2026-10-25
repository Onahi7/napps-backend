import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { ApiError, camelizeRow, jsonBody, nowIso, uuid } from "../lib/http.ts";

type Row = Record<string, any>;

const LEVY_AMOUNT_KOBO = 560000;

const initializeSchema = z.object({
  memberName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  chapter: z.string().trim().min(1),
  schoolName: z.string().trim().min(1),
  isManualSchoolEntry: z.boolean().optional(),
  wards: z.array(z.string()).default([]),
  amount: z.number().positive().optional(),
  proprietorId: z.string().optional(),
  callbackUrl: z.string().optional(),
  isContinuation: z.boolean().optional(),
  previousPaymentReference: z.string().optional(),
  metadata: z.any().optional(),
});

function toLevy(row: any, proprietor?: any) {
  const payment = camelizeRow(row);
  if (!payment) return null;
  payment.proprietorId = proprietor
    ? {
        _id: proprietor.id,
        id: proprietor.id,
        firstName: proprietor.first_name,
        lastName: proprietor.last_name,
        email: proprietor.email,
        phone: proprietor.phone,
      }
    : payment.proprietorId ?? null;
  return payment;
}

async function proprietorFor(db: AppEnv["Bindings"]["DB"], id?: string | null) {
  if (!id) return null;
  return db
    .prepare("SELECT * FROM proprietors WHERE id = ? OR submission_id = ?")
    .bind(id, id)
    .first<Row>();
}

async function latestDuplicate(
  db: AppEnv["Bindings"]["DB"],
  email?: string | null,
  phone?: string | null,
) {
  if (!email && !phone) return null;
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (email) {
    clauses.push("email = ?");
    values.push(email);
  }
  if (phone) {
    clauses.push("phone = ?");
    values.push(phone);
  }
  return db
    .prepare(
      `SELECT * FROM levy_payments WHERE is_active = 1 AND (${clauses.join(" OR ")}) ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(...values)
    .first<Row>();
}

export function levyPaymentsRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/check-duplicate", async (c) => {
    const body = await jsonBody<Row>(c);
    if (!body.email && !body.phone) {
      throw new ApiError(400, "Either email or phone must be provided");
    }
    const existing = await latestDuplicate(c.env.DB, body.email, body.phone);
    if (!existing) return c.json({ isDuplicate: false });
    return c.json({
      isDuplicate: true,
      payment: toLevy(existing),
      canContinue: existing.status !== "success",
    });
  });

  app.get("/schools", async (c) => {
    const chapter = c.req.query("chapter");
    const { results } = chapter
      ? await c.env.DB.prepare(
          "SELECT id, school_name, lga, chapter FROM schools WHERE is_active = 1 AND chapter = ? ORDER BY school_name",
        )
          .bind(chapter)
          .all<Row>()
      : await c.env.DB.prepare(
          "SELECT id, school_name, lga, chapter FROM schools WHERE is_active = 1 ORDER BY school_name",
        ).all<Row>();
    return c.json(
      results.map((s) => ({
        id: s.id,
        name: s.school_name,
        lga: s.lga,
        chapter: s.chapter,
      })),
    );
  });

  app.get("/schools/postgres", async (c) => {
    const chapter = c.req.query("chapter");
    const { results } = chapter
      ? await c.env.DB.prepare(
          "SELECT id, school_name, lga, chapter FROM schools WHERE is_active = 1 AND chapter = ? ORDER BY school_name",
        )
          .bind(chapter)
          .all<Row>()
      : await c.env.DB.prepare(
          "SELECT id, school_name, lga, chapter FROM schools WHERE is_active = 1 ORDER BY school_name",
        ).all<Row>();
    return c.json(
      results.map((s) => ({
        id: s.id,
        name: s.school_name,
        lga: s.lga,
        chapter: s.chapter,
      })),
    );
  });

  app.get("/chapters/postgres", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT DISTINCT chapter FROM schools WHERE chapter IS NOT NULL AND chapter <> '' ORDER BY chapter",
    ).all<{ chapter: string }>();
    return c.json(results.map((r, i) => ({ id: i + 1, name: r.chapter })));
  });

  app.get("/chapters/stats", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT chapter, COUNT(*) AS count FROM schools WHERE chapter IS NOT NULL AND chapter <> '' GROUP BY chapter",
    ).all<{ chapter: string; count: number }>();
    const out: Record<string, number> = {};
    for (const row of results) out[row.chapter] = row.count;
    return c.json(out);
  });

  app.post("/initialize", async (c) => {
    const parsed = initializeSchema.safeParse(await jsonBody<Row>(c));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    const body = parsed.data;

    let proprietor: Row | null = null;
    if (body.proprietorId) {
      proprietor = await proprietorFor(c.env.DB, body.proprietorId);
    } else {
      proprietor = await c.env.DB.prepare(
        "SELECT * FROM proprietors WHERE email = ? OR phone = ? LIMIT 1",
      )
        .bind(body.email, body.phone)
        .first<Row>();
    }

    const duplicate = await latestDuplicate(c.env.DB, body.email, body.phone);
    const amount = body.amount ? Math.round(body.amount * 100) : LEVY_AMOUNT_KOBO;
    const reference = `LEVY_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const receiptNumber = `NAPPS-${new Date().getFullYear()}-${String(
      Math.floor(Math.random() * 10000),
    ).padStart(4, "0")}`;
    const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
    const paymentUrl =
      body.callbackUrl || `${frontendUrl}/payment/simulate?reference=${reference}`;
    const timestamp = nowIso();

    await c.env.DB.prepare(
      `INSERT INTO levy_payments (
        id, proprietor_id, member_name, email, phone, chapter, school_name,
        is_manual_school_entry, wards, amount, status, reference, receipt_number,
        payment_url, payment_method, metadata, is_active, previous_payment_reference,
        is_continuation, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, 'card', ?, 1, ?, ?, ?, ?)`,
    )
      .bind(
        uuid(),
        proprietor?.id ?? null,
        body.memberName,
        body.email,
        body.phone,
        body.chapter,
        body.schoolName,
        body.isManualSchoolEntry ? 1 : 0,
        JSON.stringify(body.wards),
        amount,
        reference,
        receiptNumber,
        paymentUrl,
        JSON.stringify(body.metadata ?? {}),
        body.previousPaymentReference ?? duplicate?.reference ?? null,
        body.isContinuation || Boolean(duplicate) ? 1 : 0,
        timestamp,
        timestamp,
      )
      .run();

    return c.json({ reference, paymentUrl, amount: amount / 100, receiptNumber });
  });

  app.post("/verify", async (c) => {
    const body = await jsonBody<Row>(c);
    if (!body.reference) throw new ApiError(400, "reference is required");
    return verifyLevy(c, body.reference);
  });

  app.get("/verify/:reference", async (c) => verifyLevy(c, c.req.param("reference")));

  app.get("/by-identifier/:identifier", async (c) => {
    const identifier = c.req.param("identifier");
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM levy_payments WHERE ${isEmail ? "email" : "phone"} = ? AND status = 'success' AND is_active = 1 ORDER BY paid_at DESC`,
    )
      .bind(identifier)
      .all<Row>();
    if (!results.length) {
      throw new ApiError(404, "No successful payments found for this identifier");
    }
    const out: Row[] = [];
    for (const row of results) out.push(toLevy(row, await proprietorFor(c.env.DB, row.proprietor_id)) as Row);
    return c.json(out);
  });

  app.get("/stats", async (c) => {
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const clauses = ["is_active = 1"];
    const values: unknown[] = [];
    if (startDate) {
      clauses.push("created_at >= ?");
      values.push(startDate);
    }
    if (endDate) {
      clauses.push("created_at <= ?");
      values.push(endDate);
    }
    const where = clauses.join(" AND ");

    const totals = await c.env.DB.prepare(
      `SELECT COUNT(*) AS totalPayments,
              COALESCE(SUM(amount), 0) AS totalAmount,
              COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS successfulPayments,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingPayments,
              COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedPayments
       FROM levy_payments WHERE ${where}`,
    )
      .bind(...values)
      .first<Row>();
    const chapters = await c.env.DB.prepare(
      `SELECT chapter, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
       FROM levy_payments WHERE ${where} GROUP BY chapter`,
    )
      .bind(...values)
      .all<Row>();
    const statuses = await c.env.DB.prepare(
      `SELECT status, COUNT(*) AS count FROM levy_payments WHERE ${where} GROUP BY status`,
    )
      .bind(...values)
      .all<Row>();

    const paymentsByChapter: Record<string, { count: number; amount: number }> = {};
    for (const row of chapters.results) {
      paymentsByChapter[row.chapter] = { count: row.count, amount: row.amount };
    }
    const paymentsByStatus: Record<string, number> = {};
    for (const row of statuses.results) paymentsByStatus[row.status] = row.count;

    return c.json({
      totalPayments: totals?.totalPayments ?? 0,
      totalAmount: totals?.totalAmount ?? 0,
      totalAmountNaira: Math.round((totals?.totalAmount ?? 0) / 100),
      successfulPayments: totals?.successfulPayments ?? 0,
      pendingPayments: totals?.pendingPayments ?? 0,
      failedPayments: totals?.failedPayments ?? 0,
      paymentsByChapter,
      paymentsByStatus,
    });
  });

  app.get("/", async (c) => {
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 10)));
    const clauses = ["is_active = 1"];
    const values: unknown[] = [];
    for (const key of ["chapter", "status", "email", "phone"] as const) {
      const value = c.req.query(key);
      if (value) {
        clauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (c.req.query("proprietorId")) {
      clauses.push("proprietor_id = ?");
      values.push(c.req.query("proprietorId"));
    }
    if (c.req.query("startDate")) {
      clauses.push("created_at >= ?");
      values.push(c.req.query("startDate"));
    }
    if (c.req.query("endDate")) {
      clauses.push("created_at <= ?");
      values.push(c.req.query("endDate"));
    }
    const where = `WHERE ${clauses.join(" AND ")}`;
    const sortMap: Record<string, string> = {
      createdAt: "created_at",
      paidAt: "paid_at",
      amount: "amount",
      memberName: "member_name",
    };
    const sortColumn = sortMap[c.req.query("sortBy") ?? "createdAt"] ?? "created_at";
    const sortOrder = c.req.query("sortOrder") === "asc" ? "ASC" : "DESC";

    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM levy_payments ${where}`,
    )
      .bind(...values)
      .first<{ total: number }>();
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM levy_payments ${where} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`,
    )
      .bind(...values, limit, (page - 1) * limit)
      .all<Row>();

    const data: Row[] = [];
    for (const row of results) data.push(toLevy(row, await proprietorFor(c.env.DB, row.proprietor_id)) as Row);
    const total = count?.total ?? 0;
    return c.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  app.get("/:reference", async (c) => {
    const reference = c.req.param("reference");
    const payment = await c.env.DB.prepare(
      "SELECT * FROM levy_payments WHERE reference = ?",
    )
      .bind(reference)
      .first<Row>();
    if (!payment) {
      throw new ApiError(404, `Payment with reference ${reference} not found`);
    }
    return c.json(toLevy(payment, await proprietorFor(c.env.DB, payment.proprietor_id)));
  });

  return app;
}

async function verifyLevy(c: Context<AppEnv>, reference: string) {
  const payment = await c.env.DB.prepare(
    "SELECT * FROM levy_payments WHERE reference = ?",
  )
    .bind(reference)
    .first<Row>();
  if (!payment) throw new ApiError(404, "Payment not found");
  if (payment.status === "success") {
    return c.json(toLevy(payment, await proprietorFor(c.env.DB, payment.proprietor_id)));
  }

  const timestamp = nowIso();
  await c.env.DB.prepare(
    "UPDATE levy_payments SET status = 'success', payment_method = 'mock', paid_at = ?, gateway_response = ?, updated_at = ? WHERE id = ?",
  )
    .bind(timestamp, "Simulated payment approved", timestamp, payment.id)
    .run();

  let proprietor = await proprietorFor(c.env.DB, payment.proprietor_id);
  if (!proprietor) {
    proprietor = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE email = ? OR phone = ? LIMIT 1",
    )
      .bind(payment.email, payment.phone)
      .first<Row>();
    if (proprietor) {
      await c.env.DB.prepare(
        "UPDATE levy_payments SET proprietor_id = ?, updated_at = ? WHERE id = ?",
      )
        .bind(proprietor.id, timestamp, payment.id)
        .run();
    }
  }
  if (proprietor) {
    await c.env.DB.prepare(
      "UPDATE proprietors SET payment_status = 'paid', updated_at = ? WHERE id = ?",
    )
      .bind(timestamp, proprietor.id)
      .run();
  }

  const updated = { ...payment, status: "success", payment_method: "mock", paid_at: timestamp };
  return c.json(toLevy(updated, proprietor));
}

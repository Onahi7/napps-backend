import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { requireAuth } from "../lib/auth.ts";
import { sendEmail, paymentConfirmationEmail } from "../lib/email.ts";
import {
  ApiError,
  camelizeRow,
  camelizeRows,
  currentSession,
  jsonBody,
  nowIso,
  parseJson,
} from "../lib/http.ts";

type Row = Record<string, any>;

async function generateRegistrationNumber(db: AppEnv["Bindings"]["DB"]) {
  const year = new Date().getFullYear();
  const { results } = await db
    .prepare("SELECT registration_number FROM proprietors WHERE registration_number LIKE ?")
    .bind(`NAPPS${year}%`)
    .all<{ registration_number: string }>();
  const used = new Set(results.map((r) => r.registration_number));
  let counter = results.length + 1;
  let candidate = `NAPPS${year}${String(counter).padStart(4, "0")}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `NAPPS${year}${String(counter).padStart(4, "0")}`;
  }
  return candidate;
}

async function attachRelations(
  db: AppEnv["Bindings"]["DB"],
  rows: Row[],
): Promise<Row[]> {
  const proprietorIds = [
    ...new Set(rows.map((r) => r.proprietor_id).filter(Boolean)),
  ] as string[];
  const schoolIds = [
    ...new Set(rows.map((r) => r.school_id).filter(Boolean)),
  ] as string[];
  const proprietors = new Map<string, Row>();
  const schools = new Map<string, Row>();

  if (proprietorIds.length > 0) {
    const { results } = await db
      .prepare(
        `SELECT * FROM proprietors WHERE id IN (${proprietorIds
          .map(() => "?")
          .join(",")})`,
      )
      .bind(...proprietorIds)
      .all<Row>();
    for (const row of results) {
      const prop = camelizeRow(row) ?? {};
      prop.fullName = [prop.firstName, prop.middleName, prop.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!Array.isArray(prop.chapters)) prop.chapters = [];
      proprietors.set(String(row.id), prop);
    }
  }

  if (schoolIds.length > 0) {
    const { results } = await db
      .prepare(
        `SELECT * FROM schools WHERE id IN (${schoolIds.map(() => "?").join(",")})`,
      )
      .bind(...schoolIds)
      .all<Row>();
    for (const row of results) {
      schools.set(String(row.id), camelizeRow(row) ?? {});
    }
  }

  return rows.map((row) => ({
    ...row,
    proprietor_id: row.proprietor_id
      ? proprietors.get(String(row.proprietor_id)) ?? null
      : null,
    school_id: row.school_id ? schools.get(String(row.school_id)) ?? null : null,
  }));
}

function serializeVerify(payment: Row, proprietor: Row | null, school: Row | null) {
  const metadata = parseJson<Row>(payment.metadata, {});
  const amount = Number(payment.amount ?? 0) / 100;
  return {
    status: payment.status,
    reference: payment.reference,
    submissionId: metadata.submissionId ?? proprietor?.submission_id ?? null,
    registrationNumber:
      metadata.registrationNumber ?? proprietor?.registration_number ?? "",
    amount,
    paidAt: payment.paid_at ?? null,
    paymentType: payment.payment_type ?? "registration_fee",
    sessionId: metadata.sessionId ?? payment.session_id ?? null,
    renewal: metadata.renewal === true,
    paymentMethod: payment.payment_method ?? null,
    gateway: payment.gateway ?? null,
    simulated:
      metadata.simulated === true ||
      payment.gateway === "mock" ||
      payment.payment_method === "mock",
    fees: metadata.fees ?? [],
    proprietor: proprietor
      ? {
          firstName: proprietor.first_name,
          lastName: proprietor.last_name,
          email: proprietor.email,
          phone: proprietor.phone,
        }
      : null,
    school: school
      ? { schoolName: school.school_name, lga: school.lga }
      : null,
  };
}

export const paymentsRoutes = () => {
  const app = new Hono<AppEnv>();

  app.post("/simulate", async (c) => {
    const body = await jsonBody<Row>(c);
    const reference = body.reference;
    if (!reference) throw new ApiError(400, "reference is required");
    const payment = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE reference = ?",
    )
      .bind(reference)
      .first<Row>();
    if (!payment) {
      const levy = await c.env.DB.prepare(
        "SELECT * FROM levy_payments WHERE reference = ?",
      )
        .bind(reference)
        .first<Row>();
      if (!levy) throw new ApiError(404, "Payment not found");
      if (levy.status === "success") {
        return c.json({
          message: "Payment already completed",
          payment: {
            reference,
            status: "success",
            amount: Number(levy.amount) / 100,
            paidAt: levy.paid_at,
            simulated: true,
            registrationNumber: null,
          },
        });
      }
      const levyTimestamp = nowIso();
      await c.env.DB.prepare(
        "UPDATE levy_payments SET status = 'success', payment_method = 'mock', paid_at = ?, gateway_response = ?, updated_at = ? WHERE id = ?",
      )
        .bind(levyTimestamp, "Simulated payment approved", levyTimestamp, levy.id)
        .run();
      let levyProprietor: Row | null = null;
      if (levy.proprietor_id) {
        levyProprietor = await c.env.DB.prepare(
          "SELECT * FROM proprietors WHERE id = ?",
        )
          .bind(levy.proprietor_id)
          .first<Row>();
      }
      if (!levyProprietor) {
        levyProprietor = await c.env.DB.prepare(
          "SELECT * FROM proprietors WHERE email = ? OR phone = ? LIMIT 1",
        )
          .bind(levy.email, levy.phone)
          .first<Row>();
        if (levyProprietor) {
          await c.env.DB.prepare(
            "UPDATE levy_payments SET proprietor_id = ?, updated_at = ? WHERE id = ?",
          )
            .bind(levyProprietor.id, levyTimestamp, levy.id)
            .run();
        }
      }
      if (levyProprietor) {
        await c.env.DB.prepare(
          "UPDATE proprietors SET payment_status = 'paid', updated_at = ? WHERE id = ?",
        )
          .bind(levyTimestamp, levyProprietor.id)
          .run();
      }
      return c.json({
        message: "Payment simulated successfully",
        payment: {
          reference,
          status: "success",
          amount: Number(levy.amount) / 100,
          paidAt: levyTimestamp,
          transactionId: `SIM_${Date.now()}`,
          simulated: true,
        },
      });
    }

    const proprietor = payment.proprietor_id
      ? await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
          .bind(payment.proprietor_id)
          .first<Row>()
      : null;

    if (payment.status === "success") {
      return c.json({
        message: "Payment already completed",
        payment: {
          reference,
          status: "success",
          amount: Number(payment.amount) / 100,
          paidAt: payment.paid_at,
          simulated: true,
          registrationNumber:
            parseJson<Row>(payment.metadata, {}).registrationNumber ??
            proprietor?.registration_number ??
            null,
        },
      });
    }

    const paymentMeta = parseJson<Row>(payment.metadata, {});
    const isRenewal =
      payment.payment_type === "renewal_dues" || paymentMeta.renewal === true;
    const sessionId = String(
      paymentMeta.sessionId ?? payment.session_id ?? currentSession(),
    );
    const registrationNumber = isRenewal
      ? proprietor?.registration_number ?? null
      : proprietor?.registration_number ||
        (await generateRegistrationNumber(c.env.DB));
    const timestamp = nowIso();
    const amountPaid = Number(payment.amount) / 100;
    const metadata = {
      ...paymentMeta,
      simulated: true,
      simulatedAt: timestamp,
      sessionId,
      registrationNumber,
      cardLast4:
        typeof body.cardNumber === "string"
          ? body.cardNumber.replace(/\s+/g, "").slice(-4)
          : "4242",
      cardHolder: body.cardHolder ?? null,
    };
    const transactionId = `SIM_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;

    await c.env.DB.prepare(
      `UPDATE payments
       SET status = 'success', payment_method = 'mock', gateway = 'mock',
           paystack_transaction_id = ?, paystack_channel = 'simulated_card',
           gateway_response = ?, paid_at = ?, metadata = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        transactionId,
        JSON.stringify({ status: "success", message: "Simulated payment" }),
        timestamp,
        JSON.stringify(metadata),
        timestamp,
        payment.id,
      )
      .run();

    if (proprietor) {
      const history = parseJson<Row[]>(proprietor.dues_payment_history, []);
      const entry = {
        sessionId,
        amountPaid,
        paymentDate: timestamp,
        receiptNumber: reference,
        status: "confirmed",
        gateway: "mock",
        paymentType: isRenewal ? "renewal_dues" : "registration_fee",
        remittanceBreakdown: {
          duesTotal: amountPaid,
          localChapter20Pct: Math.round(amountPaid * 0.2 * 100) / 100,
          stateChapter35Pct: Math.round(amountPaid * 0.35 * 100) / 100,
          zonalChapter20Pct: Math.round(amountPaid * 0.2 * 100) / 100,
          nationalSecretariat25Pct: Math.round(amountPaid * 0.25 * 100) / 100,
          processedAt: timestamp,
          gateway: "mock",
        },
      };
      const nextHistory = history.filter(
        (item) => String(item?.sessionId ?? "") !== sessionId,
      );
      nextHistory.push(entry);

      if (isRenewal) {
        await c.env.DB.prepare(
          `UPDATE proprietors
           SET last_payment_date = ?, last_renewed_session = ?, payment_status = 'paid',
               clearing_status = 'cleared', total_amount_due = 0, is_active = 1,
               dues_payment_history = ?, updated_at = ?
           WHERE id = ?`,
        )
          .bind(
            timestamp,
            sessionId,
            JSON.stringify(nextHistory),
            timestamp,
            proprietor.id,
          )
          .run();
      } else {
        await c.env.DB.prepare(
          `UPDATE proprietors
           SET registration_number = ?, submission_status = 'submitted', submission_date = ?,
               registration_status = 'approved', approval_status = 'approved',
               clearing_status = 'cleared', total_amount_due = 0, payment_status = 'paid',
               payment_method = 'mock', is_active = 1, last_payment_date = ?,
               last_renewed_session = ?, dues_payment_history = ?, updated_at = ?
           WHERE id = ?`,
        )
          .bind(
            registrationNumber,
            proprietor.submission_status === "submitted"
              ? proprietor.submission_date ?? timestamp
              : timestamp,
            timestamp,
            sessionId,
            JSON.stringify(nextHistory),
            timestamp,
            proprietor.id,
          )
          .run();
      }

      const email = paymentConfirmationEmail({
        name: [proprietor.first_name, proprietor.last_name].filter(Boolean).join(" "),
        amount: amountPaid,
        reference,
        registrationNumber,
      });
      email.to = proprietor.email;
      const sending = sendEmail(c.env, email).catch(() => undefined);
      try {
        c.executionCtx.waitUntil(sending);
      } catch {
        await sending;
      }
    }

    return c.json({
      message: "Payment simulated successfully",
      payment: {
        reference,
        status: "success",
        amount: amountPaid,
        paidAt: timestamp,
        transactionId,
        simulated: true,
        registrationNumber,
      },
    });
  });

  app.post("/webhook", async (c) => {
    const body = await jsonBody<Row>(c);
    const data = body.data ?? body;
    const reference =
      data?.reference ?? data?.tx_ref ?? body?.reference ?? body?.tx_ref;
    if (!reference) return c.json({ status: "ignored" });
    const payment = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE reference = ? OR paystack_reference = ?",
    )
      .bind(reference, reference)
      .first<Row>();
    if (!payment) return c.json({ status: "ignored" });
    const successful =
      body.event === "charge.success" ||
      body.event === "charge.completed" ||
      body.status === "successful" ||
      body.status === "success";
    await c.env.DB.prepare(
      "UPDATE payments SET status = ?, webhook_received = 1, webhook_data = ?, updated_at = ? WHERE id = ?",
    )
      .bind(
        successful ? "success" : "failed",
        JSON.stringify(body),
        nowIso(),
        payment.id,
      )
      .run();
    return c.json({ status: "ok" });
  });

  app.get("/stats", requireAuth, async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS successful,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
              COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) AS totalAmount
       FROM payments`,
    ).first<Row>();
    return c.json({
      total: row?.total ?? 0,
      successful: row?.successful ?? 0,
      pending: row?.pending ?? 0,
      failed: row?.failed ?? 0,
      totalAmount: Number(row?.totalAmount ?? 0) / 100,
    });
  });

  app.get("/fidelity/status/:reference", async (c) => {
    const payment = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE reference = ?",
    )
      .bind(c.req.param("reference"))
      .first<Row>();
    if (!payment) throw new ApiError(404, "Payment not found");
    return c.json({
      status: payment.status,
      isCleared: payment.status === "success",
      virtualAccount: parseJson<Row | null>(payment.virtual_account, null),
    });
  });

  app.post("/initiate-lookup-payment", async (c) => {
    const body = await jsonBody<Row>(c);
    const identifier = body.submissionId ?? body.proprietorId ?? body.id;
    if (!identifier) throw new ApiError(400, "submissionId is required");
    const proprietor = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE submission_id = ? OR id = ?",
    )
      .bind(identifier, identifier)
      .first<Row>();
    if (!proprietor) throw new ApiError(404, "Proprietor not found");
    if (proprietor.clearing_status === "cleared") {
      throw new ApiError(400, "Dues already cleared for this proprietor");
    }
    let amount = Number(body.amount ?? proprietor.total_amount_due ?? 0);
    if (!amount) {
      const fee = await c.env.DB.prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM fees WHERE is_active = 1",
      ).first<{ total: number }>();
      amount = Number(fee?.total ?? 0) || 14500;
    }
    const reference = `MOCK_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    await c.env.DB.prepare(
      `INSERT INTO payments (id, proprietor_id, school_id, payment_type, amount, currency, status, payment_method, gateway, reference, description, email, metadata, created_at, updated_at)
       VALUES (?, ?, ?, 'dues', ?, 'NGN', 'pending', 'mock', 'mock', ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        proprietor.id,
        proprietor.school_id,
        Math.round(amount * 100),
        reference,
        "Proprietor dues payment",
        proprietor.email ?? body.email ?? null,
        JSON.stringify({ submissionId: proprietor.submission_id, gateway: "mock", channel: "mock_card" }),
        timestamp,
        timestamp,
      )
      .run();
    return c.json({
      reference,
      amount,
      status: "pending",
      gateway: "mock",
      paymentUrl: `${c.env.FRONTEND_URL || "http://localhost:5173"}/payment/simulate?reference=${reference}`,
    });
  });

  app.get("/verify/:reference", async (c) => {
    const reference = c.req.param("reference");
    const payment = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE reference = ? OR paystack_reference = ?",
    )
      .bind(reference, reference)
      .first<Row>();
    if (!payment) {
      const levy = await c.env.DB.prepare(
        "SELECT * FROM levy_payments WHERE reference = ?",
      )
        .bind(reference)
        .first<Row>();
      if (!levy) throw new ApiError(404, "Payment not found");
      let levyProprietor: Row | null = null;
      if (levy.proprietor_id) {
        levyProprietor = await c.env.DB.prepare(
          "SELECT * FROM proprietors WHERE id = ?",
        )
          .bind(levy.proprietor_id)
          .first<Row>();
      }
      return c.json({
        status: levy.status === "processing" ? "pending" : levy.status,
        reference: levy.reference,
        submissionId: null,
        registrationNumber: "",
        amount: Number(levy.amount) / 100,
        paidAt: levy.paid_at ?? null,
        paymentType: "levy",
        paymentMethod: levy.payment_method,
        gateway: "mock",
        simulated: true,
        fees: [],
        proprietor: {
          firstName: levy.member_name,
          lastName: "",
          email: levy.email,
          phone: levy.phone,
        },
        school: levy.school_name ? { schoolName: levy.school_name, lga: null } : null,
      });
    }
    const proprietor = payment.proprietor_id
      ? await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
          .bind(payment.proprietor_id)
          .first<Row>()
      : null;
    const school = payment.school_id
      ? await c.env.DB.prepare("SELECT * FROM schools WHERE id = ?")
          .bind(payment.school_id)
          .first<Row>()
      : null;
    return c.json(serializeVerify(payment, proprietor, school));
  });

  app.get("/", requireAuth, async (c) => {
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 20)));
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (c.req.query("status")) {
      clauses.push("status = ?");
      values.push(c.req.query("status"));
    }
    if (c.req.query("proprietorId")) {
      clauses.push("proprietor_id = ?");
      values.push(c.req.query("proprietorId"));
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM payments ${where}`,
    )
      .bind(...values)
      .first<{ total: number }>();
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM payments ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...values, limit, (page - 1) * limit)
      .all<Row>();
    const total = count?.total ?? 0;
    return c.json({
      data: camelizeRows(await attachRelations(c.env.DB, results)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  app.post("/initialize", async (c) => {
    throw new ApiError(
      400,
      "Live payment gateways are disabled. Use the mock payment flow from registration.",
    );
  });

  app.post("/fidelity/initialize", async (c) => {
    throw new ApiError(
      400,
      "Fidelity integration is disabled. Use the mock payment flow from registration.",
    );
  });

  app.post("/fidelity/initiate-lookup", async (c) => {
    throw new ApiError(
      400,
      "Fidelity integration is disabled. Use the mock payment flow from registration.",
    );
  });

  app.post("/fidelity/webhook", async (c) => {
    return c.json({ received: true, ignored: true });
  });

  app.post("/verify", async (c) => {
    const body = await jsonBody<{ reference?: string }>(c);
    if (!body.reference) throw new ApiError(400, "reference is required");
    const payment = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE reference = ? OR paystack_reference = ?",
    )
      .bind(body.reference, body.reference)
      .first<Row>();
    if (payment) {
      const proprietor = payment.proprietor_id
        ? await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
            .bind(payment.proprietor_id)
            .first<Row>()
        : null;
      const school = payment.school_id
        ? await c.env.DB.prepare("SELECT * FROM schools WHERE id = ?")
            .bind(payment.school_id)
            .first<Row>()
        : null;
      return c.json(serializeVerify(payment, proprietor, school));
    }
    const levy = await c.env.DB.prepare("SELECT * FROM levy_payments WHERE reference = ?")
      .bind(body.reference)
      .first<Row>();
    if (!levy) throw new ApiError(404, "Payment not found");
    return c.json(camelizeRow(levy));
  });

  app.get("/health/status", (c) =>
    c.json({ status: "healthy", gateway: "mock", liveGateways: false, timestamp: nowIso() }),
  );

  app.get("/reference/:reference", requireAuth, async (c) => {
    const payment = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE reference = ? OR paystack_reference = ?",
    )
      .bind(c.req.param("reference"), c.req.param("reference"))
      .first<Row>();
    if (payment) return c.json(camelizeRow(payment));
    const levy = await c.env.DB.prepare("SELECT * FROM levy_payments WHERE reference = ?")
      .bind(c.req.param("reference"))
      .first<Row>();
    if (levy) return c.json(camelizeRow(levy));
    throw new ApiError(404, "Payment not found");
  });

  app.get("/proprietor/:proprietorId", requireAuth, async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE proprietor_id = ? ORDER BY created_at DESC",
    )
      .bind(c.req.param("proprietorId"))
      .all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/school/:schoolId", requireAuth, async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM payments WHERE school_id = ? ORDER BY created_at DESC",
    )
      .bind(c.req.param("schoolId"))
      .all<Row>();
    return c.json(camelizeRows(results));
  });

  app.post("/:id/retry", requireAuth, async (c) => {
    throw new ApiError(400, "Live gateway retries are disabled in mock mode.");
  });

  app.post("/:id/refund", requireAuth, async (c) => {
    throw new ApiError(400, "Refunds are not supported in mock mode.");
  });

  app.patch("/:id", requireAuth, async (c) => {
    const body = await jsonBody<Row>(c);
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const field of ["status", "metadata", "settledAmount", "narration", "description"]) {
      if (body[field] === undefined) continue;
      const column = field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      sets.push(`${column} = ?`);
      values.push(
        field === "metadata" && body[field] != null ? JSON.stringify(body[field]) : body[field],
      );
    }
    if (!sets.length) {
      const existing = await c.env.DB.prepare("SELECT * FROM payments WHERE id = ?")
        .bind(c.req.param("id"))
        .first<Row>();
      if (!existing) throw new ApiError(404, "Payment not found");
      return c.json(camelizeRow(existing));
    }
    const result = await c.env.DB.prepare(
      `UPDATE payments SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`,
    )
      .bind(...values, nowIso(), c.req.param("id"))
      .run();
    if ((result.meta?.changes ?? 0) === 0) throw new ApiError(404, "Payment not found");
    const updated = await c.env.DB.prepare("SELECT * FROM payments WHERE id = ?")
      .bind(c.req.param("id"))
      .first<Row>();
    return c.json(camelizeRow(updated));
  });

  app.delete("/:id", requireAuth, async (c) => {
    const result = await c.env.DB.prepare("DELETE FROM payments WHERE id = ?")
      .bind(c.req.param("id"))
      .run();
    if ((result.meta?.changes ?? 0) === 0) throw new ApiError(404, "Payment not found");
    return c.json({ message: "Payment deleted successfully" });
  });

  app.get("/:id", requireAuth, async (c) => {
    const payment = await c.env.DB.prepare("SELECT * FROM payments WHERE id = ?")
      .bind(c.req.param("id"))
      .first<Row>();
    if (!payment) throw new ApiError(404, "Payment not found");
    const [populated] = await attachRelations(c.env.DB, [payment]);
    return c.json(camelizeRow(populated));
  });

  return app;
};

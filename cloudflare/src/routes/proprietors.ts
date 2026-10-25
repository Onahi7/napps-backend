import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { requireAuth } from "../lib/auth.ts";
import { phoneKey, phoneKeySql } from "../lib/phone.ts";
import {
  ApiError,
  camelizeRow,
  camelizeRows,
  currentSession,
  jsonBody,
  nowIso,
  parseJson,
  uuid,
} from "../lib/http.ts";

type Row = Record<string, any>;

const PROPRIETOR_FIELDS: Record<string, string> = {
  firstName: "first_name",
  middleName: "middle_name",
  lastName: "last_name",
  sex: "sex",
  email: "email",
  phone: "phone",
  lga: "lga",
  passportPhoto: "passport_photo",
  timesParticipated: "times_participated",
  registrationNumber: "registration_number",
  nappsMembershipId: "napps_membership_id",
  schoolId: "school_id",
  submissionId: "submission_id",
  submissionDate: "submission_date",
  submissionStatus: "submission_status",
  registrationStatus: "registration_status",
  approvalStatus: "approval_status",
  nappsRegistered: "napps_registered",
  participationHistory: "participation_history",
  duesDeclarations: "dues_declarations",
  awards: "awards",
  positionHeld: "position_held",
  positionInNapps: "position_in_napps",
  schoolCode: "school_code",
  hasNappsIdCard: "has_napps_id_card",
  nnsuceTimesWritten: "nnsuce_times_written",
  nnsuce2025PupilsCount: "nnsuce2025_pupils_count",
  duesPaymentHistory: "dues_payment_history",
  clearingStatus: "clearing_status",
  totalAmountDue: "total_amount_due",
  lastPaymentDate: "last_payment_date",
  isActive: "is_active",
  paymentStatus: "payment_status",
  paymentMethod: "payment_method",
  approvalEvidence: "approval_evidence",
  reference: "reference",
  pupilsPresentedLastExam: "pupils_presented_last_exam",
  chapters: "chapters",
};

const SCHOOL_FIELDS: Record<string, string> = {
  schoolName: "school_name",
  schoolName2: "school_name2",
  address: "address",
  addressLine2: "address_line2",
  lga: "lga",
  chapter: "chapter",
  aegeLgeaDa: "aege_lgea_da",
  schoolRegistrationStatus: "school_registration_status",
  levelsOfEducation: "levels_of_education",
  schoolCode: "school_code",
  phone: "phone",
  aeqeoZone: "aeqeo_zone",
  yearOfEstablishment: "year_of_establishment",
  yearOfApproval: "year_of_approval",
  typeOfSchool: "type_of_school",
  categoryOfSchool: "category_of_school",
  ownership: "ownership",
  gpsLongitude: "gps_longitude",
  gpsLatitude: "gps_latitude",
  registrationEvidence: "registration_evidence",
  registrationEvidencePhoto: "registration_evidence_photo",
  cacNumber: "cac_number",
  moeRegistrationNumber: "moe_registration_number",
  nnsuceTimesWritten: "nnsuce_times_written",
  nnsucePupilsCount: "nnsuce_pupils_count",
  enrollment: "enrollment",
  totalEnrollment: "total_enrollment",
  isPrimary: "is_primary",
  images: "images",
};

const JSON_FIELDS = new Set([
  "participationHistory",
  "duesDeclarations",
  "duesPaymentHistory",
  "chapters",
  "enrollment",
  "images",
]);
const BOOL_FIELDS = new Set(["hasNappsIdCard", "isActive", "isPrimary"]);

function buildColumns(
  data: Row,
  map: Record<string, string>,
): { columns: string[]; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(map)) {
    const value = data[field];
    if (value === undefined) continue;
    columns.push(column);
    if (JSON_FIELDS.has(field)) {
      values.push(value == null ? null : JSON.stringify(value));
    } else if (BOOL_FIELDS.has(field)) {
      values.push(value ? 1 : 0);
    } else {
      values.push(value ?? null);
    }
  }
  return { columns, values };
}

function normalize(row: Row | null): Row | null {
  const proprietor = camelizeRow(row);
  if (!proprietor) return null;
  proprietor.fullName =
    [proprietor.firstName, proprietor.middleName, proprietor.lastName]
      .filter(Boolean)
      .join(" ") || proprietor.email;
  if (proprietor.schoolId) proprietor.school = proprietor.schoolId;
  return proprietor;
}

async function findProprietorRow(
  db: AppEnv["Bindings"]["DB"],
  idOrSubmission: string,
): Promise<Row | null> {
  return db
    .prepare("SELECT * FROM proprietors WHERE id = ? OR submission_id = ?")
    .bind(idOrSubmission, idOrSubmission)
    .first<Row>();
}

async function findSchool(
  db: AppEnv["Bindings"]["DB"],
  id: string | null | undefined,
) {
  if (!id) return null;
  const row = await db.prepare("SELECT * FROM schools WHERE id = ?").bind(id).first<Row>();
  return camelizeRow(row);
}

async function activeFeeTotal(db: AppEnv["Bindings"]["DB"]) {
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM fees WHERE is_active = 1")
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function activeFees(db: AppEnv["Bindings"]["DB"]) {
  const { results } = await db
    .prepare("SELECT code, name, amount FROM fees WHERE is_active = 1 ORDER BY created_at DESC")
    .all<{ code: string | null; name: string; amount: number }>();
  return results.map((fee) => ({
    code: fee.code ?? undefined,
    name: fee.name,
    amount: Number(fee.amount),
  }));
}

async function findProprietorByIdentifier(
  db: AppEnv["Bindings"]["DB"],
  identifier: string,
) {
  const value = identifier.trim();
  return db
    .prepare(
      `SELECT * FROM proprietors
       WHERE lower(email) = lower(?) OR ${phoneKeySql()} = ? OR registration_number = ?
          OR napps_membership_id = ? OR submission_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(value, phoneKey(value) || value, value, value, value)
    .first<Row>();
}

function duesForSession(history: Row[], sessionId: string) {
  return history.find(
    (entry) =>
      String(entry?.sessionId ?? "") === sessionId &&
      Number(entry?.amountPaid ?? 0) > 0,
  );
}

async function renewalSummary(
  db: AppEnv["Bindings"]["DB"],
  proprietor: Row,
  sessionId: string,
) {
  const history = parseJson<Row[]>(proprietor.dues_payment_history, []);
  const existing = duesForSession(history, sessionId);
  const school = proprietor.school_id
    ? await db
        .prepare("SELECT school_name, lga, chapter FROM schools WHERE id = ?")
        .bind(proprietor.school_id)
        .first<Row>()
    : null;
  const fees = await activeFees(db);
  const total = fees.reduce((sum, fee) => sum + fee.amount, 0) || 14500;
  return {
    sessionId,
    alreadyPaid: Boolean(existing),
    amount: total,
    fees: fees.length ? fees : [{ name: "Annual dues", amount: total }],
    lastRenewedSession: proprietor.last_renewed_session ?? null,
    proprietor: {
      id: proprietor.id,
      _id: proprietor.id,
      fullName: [proprietor.first_name, proprietor.middle_name, proprietor.last_name]
        .filter(Boolean)
        .join(" "),
      registrationNumber: proprietor.registration_number ?? null,
      email: proprietor.email,
      phone: proprietor.phone,
      lga: proprietor.lga,
      schoolName: school?.school_name ?? null,
      chapter: school?.chapter ?? null,
    },
    duesPaymentHistory: history,
    paymentEvidence: parseJson<Row[]>(proprietor.payment_evidence, []),
  };
}

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

function serializeProgress(row: Row, school: Row | null) {
  const proprietor = normalize(row)!;
  const status = proprietor.submissionStatus;
  const currentStep =
    status === "submitted" || status === "processed"
      ? 4
      : status === "step3"
        ? 3
        : status === "step2"
          ? 3
          : 2;
  return {
    proprietor,
    school,
    currentStep,
    isComplete: status === "submitted" || status === "processed",
  };
}

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => {
      const record: Row = {};
      header.forEach((key, index) => {
        record[key.trim()] = (values[index] ?? "").trim();
      });
      return record;
    });
}

const CSV_MAP: Record<string, string> = {
  Name: "fullName",
  Sex: "sex",
  Email: "email",
  "Phone/Mobile": "phone",
  "Name Of School": "schoolName",
  "Name Of School 2": "schoolName2",
  Address: "schoolAddress",
  "Registeration Status": "registrationStatus",
  "Approval Status": "approvalStatus",
  "Are you registered with NAPPs ?": "nappsRegistered",
  tabular_grid: "participationHistoryRaw",
  "How many times your School participated in Napps Nasarawa State Unified Certificate Examination":
    "timesParticipated",
  "Number of Pupils presented in year 2023/2024 NAPPS Nasarawa State certificate examination":
    "pupilsPresentedLastExam",
  "Award given to you / your School by NAPPS for the past four years": "awards",
  "Position Held at NAPPS Level Progressively": "positionHeld",
  firstName: "firstName",
  first_name: "firstName",
  "First Name": "firstName",
  middleName: "middleName",
  middle_name: "middleName",
  "Middle Name": "middleName",
  lastName: "lastName",
  last_name: "lastName",
  "Last Name": "lastName",
  Gender: "sex",
  sex: "sex",
  gender: "sex",
  email: "email",
  "Email Address": "email",
  Phone: "phone",
  phone: "phone",
  "Phone Number": "phone",
};

function mapCsvRecord(record: Row): Row {
  const mapped: Row = {};
  for (const [csvKey, dbKey] of Object.entries(CSV_MAP)) {
    let value = record[csvKey];
    if (value === undefined || value === "" || value === null) continue;
    if (dbKey === "email" && value.toLowerCase().includes("blank")) continue;
    if (csvKey === "Name" && dbKey === "fullName") {
      const parts = String(value).trim().split(/\s+/);
      if (parts.length >= 3) {
        mapped.firstName = parts[0];
        mapped.middleName = parts.slice(1, -1).join(" ");
        mapped.lastName = parts[parts.length - 1];
      } else if (parts.length === 2) {
        mapped.firstName = parts[0];
        mapped.lastName = parts[1];
      } else if (parts.length === 1) {
        mapped.firstName = parts[0];
        mapped.lastName = parts[0];
      }
      continue;
    }
    if (dbKey === "participationHistoryRaw") {
      mapped.participationHistory = String(value)
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }
    if (dbKey === "timesParticipated" || dbKey === "pupilsPresentedLastExam") {
      const parsed = parseInt(String(value), 10);
      mapped[dbKey] = Number.isNaN(parsed) ? 0 : parsed;
      continue;
    }
    if (dbKey === "sex") {
      const normalized = String(value).trim();
      const capitalized =
        normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
      if (["Male", "Female"].includes(capitalized)) mapped.sex = capitalized;
      continue;
    }
    if (dbKey === "nappsRegistered") {
      const normalized = String(value).toLowerCase().trim();
      mapped.nappsRegistered = normalized.includes("certificate")
        ? "Registered with Certificate"
        : normalized.includes("registered") || normalized.includes("yes")
          ? "Registered"
          : "Not Registered";
      continue;
    }
    if (dbKey === "registrationStatus") {
      const normalized = String(value).toLowerCase().trim();
      mapped.registrationStatus =
        normalized.includes("approv") || normalized.includes("registered")
          ? "approved"
        : normalized.includes("reject")
          ? "rejected"
          : normalized.includes("suspend")
            ? "suspended"
            : "pending";
      continue;
    }
    if (dbKey === "approvalStatus") {
      const normalized = String(value).toLowerCase().trim();
      mapped.approvalStatus =
        normalized.includes("evidence") || normalized.includes("approve")
          ? "approved"
          : normalized.includes("reject")
            ? "rejected"
            : "pending";
      continue;
    }
    mapped[dbKey] = value;
  }
  return mapped;
}

export const proprietorsRoutes = () => {
  const app = new Hono<AppEnv>();

  app.post("/registration/step1", async (c) => {
    const data = await jsonBody<Row>(c);
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    if (!email) throw new ApiError(400, "Email is required");
    if (!phone) throw new ApiError(400, "Phone number is required");
    data.email = email;
    data.phone = phone;
    if (data.duesDeclarations !== undefined) {
      data.duesDeclarations = z.array(z.object({
        sessionId: z.string().regex(/^\d{4}\/\d{4}$/),
        level: z.enum(["national", "state", "zonal"]),
        paid: z.literal(true),
      })).parse(data.duesDeclarations);
    }

    const byEmail = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE lower(email) = lower(?)",
    )
      .bind(email)
      .first<Row>();
    const phoneMatches = await c.env.DB.prepare(
      `SELECT * FROM proprietors WHERE ${phoneKeySql()} = ? LIMIT 2`,
    )
      .bind(phoneKey(phone) || phone)
      .all<Row>();
    if (phoneMatches.results.length > 1) {
      throw new ApiError(409, "Multiple existing registrations use this phone number. Use Find Record or contact the secretariat; do not register again.");
    }
    const byPhone = phoneMatches.results[0];

    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      throw new ApiError(
        409,
        "This email and phone number are linked to different registrations",
      );
    }

    const existing = byEmail ?? byPhone;
    const { columns, values } = buildColumns(data, PROPRIETOR_FIELDS);
    const timestamp = nowIso();

    if (existing) {
      if (["submitted", "processed"].includes(existing.submission_status) ||
          existing.registration_number || existing.registration_status?.toLowerCase() === "approved") {
        throw new ApiError(
          409,
          "A proprietor with this email/phone number already exists. Use Find Record to view the existing registration or pay dues.",
        );
      }
      const submissionId = existing.submission_id || crypto.randomUUID();
      const sets = columns.map((column) => `${column} = ?`);
      const params = [...values];
      sets.push(
        "submission_id = ?",
        "updated_at = ?",
      );
      params.push(submissionId, timestamp, existing.id);
      await c.env.DB.prepare(
        `UPDATE proprietors SET ${sets.join(", ")} WHERE id = ?`,
      )
        .bind(...params)
        .run();
      const row = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
        .bind(existing.id)
        .first<Row>();
      return c.json({ submissionId, proprietor: normalize(row) });
    }

    const id = crypto.randomUUID();
    const submissionId = crypto.randomUUID();
    const allColumns = [
      "id",
      ...columns,
      "submission_id",
      "submission_date",
      "submission_status",
      "registration_status",
      "is_active",
      "created_at",
      "updated_at",
    ];
    const allValues = [
      id,
      ...values,
      submissionId,
      timestamp,
      "step1",
      "pending",
      0,
      timestamp,
      timestamp,
    ];
    await c.env.DB.prepare(
      `INSERT INTO proprietors (${allColumns.join(", ")}) VALUES (${allColumns
        .map(() => "?")
        .join(", ")})`,
    )
      .bind(...allValues)
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(id)
      .first<Row>();
    return c.json({ submissionId, proprietor: normalize(row) }, 201);
  });

  app.post("/registration/step2", async (c) => {
    const body = await jsonBody<Row>(c);
    for (const field of ["totalEnrollment", "nnsucePupilsCount", "yearOfEstablishment", "yearOfApproval"]) {
      if (body[field] === "" || body[field] === null) delete body[field];
      else if (body[field] !== undefined) {
        body[field] = z.coerce.number().finite().int().min(0).parse(body[field]);
      }
    }
    const submissionId = body.submissionId;
    if (!submissionId) throw new ApiError(400, "submissionId is required");
    const proprietor = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE submission_id = ?",
    )
      .bind(submissionId)
      .first<Row>();
    if (!proprietor) throw new ApiError(404, "Submission not found");
    if (proprietor.submission_status === "submitted") {
      throw new ApiError(400, "This registration has already been completed");
    }

    const { columns, values } = buildColumns(body, SCHOOL_FIELDS);
    const timestamp = nowIso();
    let schoolId = proprietor.school_id as string | null;

    if (schoolId) {
      if (columns.length) {
        await c.env.DB.prepare(
          `UPDATE schools SET ${columns.map((col) => `${col} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
        )
          .bind(...values, timestamp, schoolId)
          .run();
      }
    } else {
      schoolId = crypto.randomUUID();
      const allColumns = ["id", ...columns, "proprietor_id", "created_at", "updated_at"];
      const allValues = [schoolId, ...values, proprietor.id, timestamp, timestamp];
      await c.env.DB.prepare(
        `INSERT INTO schools (${allColumns.join(", ")}) VALUES (${allColumns
          .map(() => "?")
          .join(", ")})`,
      )
        .bind(...allValues)
        .run();
    }

    const schoolForChapter = await findSchool(c.env.DB, schoolId);
    let chapters: string[] = [];
    try {
      chapters = proprietor.chapters ? JSON.parse(proprietor.chapters) : [];
    } catch {
      chapters = [];
    }
    if (!Array.isArray(chapters) || chapters.length === 0) {
      const fallback = String((schoolForChapter as Row | null)?.chapter ?? "").trim();
      chapters = fallback ? [fallback] : [];
    }

    await c.env.DB.prepare(
      "UPDATE proprietors SET school_id = ?, submission_status = 'step2', chapters = ?, updated_at = ? WHERE id = ?",
    )
      .bind(schoolId, JSON.stringify(chapters), timestamp, proprietor.id)
      .run();

    const updated = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE id = ?",
    )
      .bind(proprietor.id)
      .first<Row>();
    const school = await findSchool(c.env.DB, schoolId);
    return c.json({ proprietor: normalize(updated), school });
  });

  app.post("/registration/evidence", async (c) => {
    const form = await c.req.formData();
    const entry = form.get("file");
    if (!entry || typeof entry === "string") {
      throw new ApiError(400, "No file uploaded");
    }
    const file = entry as unknown as {
      name: string;
      type: string;
      size: number;
      arrayBuffer: () => Promise<ArrayBuffer>;
    };
    const submissionId = String(form.get("submissionId") || "");
    const proprietorId = String(form.get("proprietorId") || "");
    const sessionId = String(form.get("sessionId") || "");
    if (!submissionId && !proprietorId) {
      throw new ApiError(400, "submissionId or proprietorId is required");
    }
    if (!sessionId) throw new ApiError(400, "sessionId is required");
    if (!c.env.BUCKET) {
      throw new ApiError(503, "File storage (R2) is not configured");
    }
    const proprietor = submissionId
      ? await c.env.DB.prepare(
          "SELECT * FROM proprietors WHERE submission_id = ?",
        )
          .bind(submissionId)
          .first<Row>()
      : await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
          .bind(proprietorId)
          .first<Row>();
    if (!proprietor) throw new ApiError(404, "Proprietor not found");
    const evidenceOwner = proprietor.submission_id || proprietor.id;

    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    const fileType = file.type || "";
    if (!allowed.includes(fileType)) {
      throw new ApiError(400, "Only JPG, PNG, WEBP or PDF files are allowed");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new ApiError(400, "File must be 5MB or smaller");
    }

    const safeName = (file.name || "evidence")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-60);
    const key = `evidence/${evidenceOwner}/${Date.now()}-${uuid()}-${safeName}`;
    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: fileType },
    });

    const timestamp = nowIso();
    const origin = new URL(c.req.url).origin;
    const evidence = {
      sessionId,
      fileName: file.name || safeName,
      fileType,
      fileSize: file.size,
      url: `${origin}/api/v1/uploads/${key}`,
      key,
      uploadedAt: timestamp,
    };

    let existing: any[] = [];
    try {
      const parsed = JSON.parse(proprietor.payment_evidence || "[]");
      if (Array.isArray(parsed)) existing = parsed;
    } catch {
      existing = [];
    }
    const list = [
      ...existing.filter(
        (item) => !sessionId || item?.sessionId !== sessionId,
      ),
      evidence,
    ];

    await c.env.DB.prepare(
      "UPDATE proprietors SET payment_evidence = ?, updated_at = ? WHERE id = ?",
    )
      .bind(JSON.stringify(list), timestamp, proprietor.id)
      .run();

    return c.json(
      {
        message: "Payment evidence uploaded successfully",
        evidence,
        paymentEvidence: list,
      },
      201,
    );
  });

  app.get("/renewal/status/:identifier", async (c) => {
    const identifier = decodeURIComponent(c.req.param("identifier"));
    if (!identifier.trim()) throw new ApiError(400, "identifier is required");
    const sessionId = c.req.query("session") || currentSession();
    const proprietor = await findProprietorByIdentifier(c.env.DB, identifier);
    if (!proprietor) {
      throw new ApiError(404, "No registered proprietor found for this identifier");
    }
    return c.json(await renewalSummary(c.env.DB, proprietor, sessionId));
  });

  app.post("/renewal/initialize", async (c) => {
    const body = await jsonBody<Row>(c);
    const identifier = String(body.identifier ?? "").trim();
    if (!identifier) throw new ApiError(400, "identifier is required");
    const sessionId = String(body.sessionId ?? "").trim() || currentSession();
    const proprietor = await findProprietorByIdentifier(c.env.DB, identifier);
    if (!proprietor) {
      throw new ApiError(404, "No registered proprietor found for this identifier");
    }
    if (proprietor.registration_status === "rejected") {
      throw new ApiError(400, "This registration was rejected");
    }
    if (!proprietor.school_id) {
      throw new ApiError(400, "Complete your school information before renewing dues");
    }
    const history = parseJson<Row[]>(proprietor.dues_payment_history, []);
    const paid = duesForSession(history, sessionId);
    if (paid) {
      throw new ApiError(
        409,
        `Dues for the ${sessionId} session have already been paid`,
      );
    }
    const fees = await activeFees(c.env.DB);
    const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0) || 14500;
    const reference = `MOCK_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;
    const timestamp = nowIso();
    const frontendUrl =
      c.env.FRONTEND_URL || "https://portal.nappsnasarawa.com";
    const paymentUrl = `${frontendUrl}/payment/simulate?reference=${reference}`;
    await c.env.DB.prepare(
      `INSERT INTO payments (id, proprietor_id, school_id, payment_type, amount, currency, status, payment_method, gateway, reference, description, email, session_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, 'renewal_dues', ?, 'NGN', 'pending', 'mock', 'mock', ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        proprietor.id,
        proprietor.school_id,
        Math.round(totalAmount * 100),
        reference,
        `Annual dues renewal ${sessionId}`,
        proprietor.email,
        sessionId,
        JSON.stringify({
          submissionId: proprietor.submission_id,
          renewal: true,
          sessionId,
          gateway: "mock",
          channel: "mock_card",
          fees,
        }),
        timestamp,
        timestamp,
      )
      .run();

    return c.json(
      {
        message: "Renewal payment initialized",
        reference,
        sessionId,
        amount: totalAmount,
        gateway: "mock",
        paymentUrl,
        payment: {
          reference,
          amount: totalAmount,
          simulationMode: true,
          paymentUrl,
        },
        proprietor: (await renewalSummary(c.env.DB, proprietor, sessionId))
          .proprietor,
      },
      201,
    );
  });

  app.post("/registration/step3", async (c) => {
    const body = await jsonBody<Row>(c);
    const { submissionId, finalSubmit, ...data } = body;
    if (!submissionId) throw new ApiError(400, "submissionId is required");
    const proprietor = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE submission_id = ?",
    )
      .bind(submissionId)
      .first<Row>();
    if (!proprietor) throw new ApiError(404, "Submission not found");
    if (proprietor.submission_status === "submitted") {
      throw new ApiError(400, "This registration has already been completed");
    }

    const paymentMethod =
      typeof data.paymentMethod === "string" ? data.paymentMethod : "mock";

    if (!finalSubmit) {
      if (!proprietor.school_id) {
        throw new ApiError(
          400,
          "School information must be completed before submitting payment details",
        );
      }
      const baseTotal = await activeFeeTotal(c.env.DB);
      const totalAmount = baseTotal > 0 ? baseTotal : 14500;
      const { results: feeRows } = await c.env.DB.prepare(
        "SELECT code, name, amount FROM fees WHERE is_active = 1 ORDER BY created_at DESC",
      ).all<{ code: string | null; name: string; amount: number }>();
      const fees = feeRows.map((fee) => ({
        code: fee.code ?? undefined,
        name: fee.name,
        amount: fee.amount,
      }));
      const reference = `MOCK_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;
      const timestamp = nowIso();
      const sessionId = currentSession();
      const paymentId = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO payments (id, proprietor_id, school_id, payment_type, amount, currency, status, payment_method, gateway, reference, description, email, session_id, metadata, created_at, updated_at)
         VALUES (?, ?, ?, 'registration_fee', ?, 'NGN', 'pending', 'mock', 'mock', ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          paymentId,
          proprietor.id,
          proprietor.school_id,
          Math.round(totalAmount * 100),
          reference,
          "Proprietor registration and annual dues",
          proprietor.email,
          sessionId,
          JSON.stringify({
            submissionId,
            gateway: "mock",
            channel: "mock_card",
            sessionId,
            fees,
          }),
          timestamp,
          timestamp,
        )
        .run();

      await c.env.DB.prepare(
        "UPDATE proprietors SET payment_method = 'mock', submission_status = 'step3', reference = ?, updated_at = ? WHERE id = ?",
      )
        .bind(reference, timestamp, proprietor.id)
        .run();

      const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
      const paymentUrl = `${frontendUrl}/payment/simulate?reference=${reference}`;
      const updated = await c.env.DB.prepare(
        "SELECT * FROM proprietors WHERE id = ?",
      )
        .bind(proprietor.id)
        .first<Row>();
      return c.json({
        message: "Step 3 saved successfully. Continue to secure payment.",
        proprietor: normalize(updated),
        gateway: "mock",
        reference,
        paymentUrl,
        payment: {
          reference,
          amount: totalAmount,
          simulationMode: true,
          paymentUrl,
        },
      });
    }

    const registrationNumber =
      proprietor.registration_number || (await generateRegistrationNumber(c.env.DB));
    const isPaid = String(data.paymentStatus ?? "").toLowerCase() === "paid";
    const timestamp = nowIso();
    await c.env.DB.prepare(
      `UPDATE proprietors
       SET registration_number = ?, submission_status = 'submitted', submission_date = ?,
           registration_status = ?, payment_status = ?, payment_method = ?, is_active = 1, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        registrationNumber,
        timestamp,
        isPaid ? "approved" : "pending",
        isPaid ? "Paid" : "Pending",
        paymentMethod,
        timestamp,
        proprietor.id,
      )
      .run();
    const updated = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE id = ?",
    )
      .bind(proprietor.id)
      .first<Row>();
    return c.json({ proprietor: normalize(updated), registrationNumber });
  });

  app.get("/registration/:submissionId", async (c) => {
    const row = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE submission_id = ?",
    )
      .bind(c.req.param("submissionId"))
      .first<Row>();
    if (!row) throw new ApiError(404, "Submission not found");
    const school = await findSchool(c.env.DB, row.school_id);
    return c.json(serializeProgress(row, school));
  });

  app.get("/lookup", async (c) => {
    const params = c.req.query();
    const clauses: string[] = [];
    const values: unknown[] = [];
    const addLike = (column: string, value?: string) => {
      if (!value) return;
      clauses.push(`lower(${column}) LIKE lower(?)`);
      values.push(`%${value}%`);
    };
    const addEq = (column: string, value?: string) => {
      if (!value) return;
      clauses.push(`lower(${column}) = lower(?)`);
      values.push(value);
    };

    addEq("email", params.email);
    if (params.phone) {
      clauses.push(`${phoneKeySql()} = ?`);
      values.push(phoneKey(params.phone) || params.phone);
    }
    addEq("registration_number", params.registrationNumber);
    addEq("napps_membership_id", params.nappsMembershipId);
    addLike("first_name", params.firstName);
    addLike("last_name", params.lastName);
    if (params.schoolName) {
      clauses.push("EXISTS (SELECT 1 FROM schools s WHERE (s.id = proprietors.school_id OR s.proprietor_id = proprietors.id) AND lower(s.school_name) LIKE lower(?))");
      values.push(`%${params.schoolName}%`);
    }

    if (params.search) {
      const term = `%${params.search}%`;
      const phoneTerm = phoneKey(params.search);
      clauses.push(
        `(lower(first_name) LIKE lower(?) OR lower(last_name) LIKE lower(?) OR lower(email) LIKE lower(?) OR phone LIKE ? OR lower(coalesce(registration_number,'')) LIKE lower(?) OR EXISTS (SELECT 1 FROM schools s WHERE (s.id = proprietors.school_id OR s.proprietor_id = proprietors.id) AND lower(s.school_name) LIKE lower(?)) OR (${phoneTerm.length >= 10 ? `${phoneKeySql()} = ?` : "0 = ?"}))`,
      );
      values.push(term, term, term, term, term, term, phoneTerm.length >= 10 ? phoneTerm : 1);
    }

    if (!clauses.length) {
      throw new ApiError(
        400,
        "At least one lookup parameter must be provided",
      );
    }

    const { results } = await c.env.DB.prepare(
      `SELECT * FROM proprietors WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(...values)
      .all<Row>();

    const data = await Promise.all(
      results.map(async (row) => {
        const proprietor = normalize(row)!;
        const school = await findSchool(c.env.DB, row.school_id);
        const flattened: Row = {
          ...proprietor,
          schoolName: school?.schoolName,
          schoolAddress: school?.address,
          lga: school?.lga ?? proprietor.lga,
          aeqeoZone: school?.aeqeoZone,
          typeOfSchool: school?.typeOfSchool,
          categoryOfSchool: school?.categoryOfSchool,
          totalEnrollment: school?.totalEnrollment,
          ownership: school?.ownership,
          school: school ?? proprietor.schoolId,
        };
        if (!Array.isArray(flattened.participationHistory)) {
          flattened.participationHistory = [];
        }
        return flattened;
      }),
    );
    return c.json(data);
  });

  app.get("/stats", requireAuth, async (c) => {
    const total = await c.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM proprietors WHERE is_active = 1",
    ).first<{ count: number }>();
    const group = async (column: string) => {
      const { results } = await c.env.DB.prepare(
        `SELECT ${column} AS key, COUNT(*) AS count FROM proprietors WHERE is_active = 1 GROUP BY ${column}`,
      ).all<{ key: string | null; count: number }>();
      return results.reduce<Record<string, number>>((acc, item) => {
        acc[item.key ?? "unknown"] = item.count;
        return acc;
      }, {});
    };
    const { results: chapterRows } = await c.env.DB.prepare(
      `SELECT p.chapters AS chapters, s.chapter AS school_chapter
       FROM proprietors p
       LEFT JOIN schools s ON s.id = p.school_id
       WHERE p.is_active = 1`,
    ).all<{ chapters: string | null; school_chapter: string | null }>();
    const byChapter: Record<string, number> = {};
    for (const row of chapterRows) {
      let chapters: string[] = [];
      try {
        chapters = row.chapters ? JSON.parse(row.chapters) : [];
      } catch {
        chapters = [];
      }
      if (!Array.isArray(chapters) || chapters.length === 0) {
        const fallback = String(row.school_chapter ?? "").trim();
        chapters = fallback ? [fallback] : [];
      }
      if (chapters.length === 0) {
        byChapter["N/A"] = (byChapter["N/A"] ?? 0) + 1;
        continue;
      }
      for (const chapter of chapters) {
        const key = String(chapter ?? "").trim() || "N/A";
        byChapter[key] = (byChapter[key] ?? 0) + 1;
      }
    }
    const amount = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(total_amount_due), 0) AS total FROM proprietors WHERE is_active = 1",
    ).first<{ total: number }>();
    const { results: historyRows } = await c.env.DB.prepare(
      "SELECT dues_payment_history FROM proprietors WHERE is_active = 1",
    ).all<{ dues_payment_history: string | null }>();
    const sessionTotals: Record<
      string,
      { paidCount: number; totalAmount: number }
    > = {};
    let renewedProprietors = 0;
    for (const row of historyRows) {
      const history = parseJson<Row[]>(row.dues_payment_history, []);
      const paidSessions = new Set<string>();
      for (const entry of history) {
        const session = String(entry?.sessionId ?? "").trim();
        const paidAmount = Number(entry?.amountPaid ?? 0);
        if (!session || paidAmount <= 0) continue;
        paidSessions.add(session);
        const bucket =
          sessionTotals[session] ?? { paidCount: 0, totalAmount: 0 };
        bucket.paidCount += 1;
        bucket.totalAmount += paidAmount;
        sessionTotals[session] = bucket;
      }
      if (paidSessions.size > 1) renewedProprietors += 1;
    }
    const bySession = Object.entries(sessionTotals)
      .map(([sessionId, value]) => ({ sessionId, ...value }))
      .sort((a, b) => (a.sessionId < b.sessionId ? 1 : -1));
    return c.json({
      total: total?.count ?? 0,
      byStatus: await group("registration_status"),
      byNappsRegistration: await group("napps_registered"),
      byClearingStatus: await group("clearing_status"),
      byChapter,
      totalAmountDue: amount?.total ?? 0,
      currentSession: currentSession(),
      bySession,
      renewedProprietors,
    });
  });

  app.get("/", async (c) => {
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 10)));
    const sortable: Record<string, string> = {
      firstName: "first_name",
      lastName: "last_name",
      email: "email",
      createdAt: "created_at",
      totalAmountDue: "total_amount_due",
    };
    const sortColumn = sortable[c.req.query("sortBy") ?? "createdAt"] ?? "created_at";
    const sortOrder = c.req.query("sortOrder") === "asc" ? "ASC" : "DESC";

    const clauses: string[] = [];
    const values: unknown[] = [];
    const search = c.req.query("search");
    if (search) {
      const term = `%${search}%`;
      clauses.push(
        "(lower(first_name) LIKE lower(?) OR lower(last_name) LIKE lower(?) OR lower(middle_name) LIKE lower(?) OR lower(email) LIKE lower(?) OR phone LIKE ? OR lower(coalesce(registration_number,'')) LIKE lower(?) OR lower(coalesce(napps_membership_id,'')) LIKE lower(?))",
      );
      values.push(term, term, term, term, term, term, term);
    }
    if (c.req.query("registrationStatus")) {
      clauses.push("registration_status = ?");
      values.push(c.req.query("registrationStatus"));
    }
    if (c.req.query("nappsRegistered")) {
      clauses.push("napps_registered = ?");
      values.push(c.req.query("nappsRegistered"));
    }
    if (c.req.query("clearingStatus")) {
      clauses.push("clearing_status = ?");
      values.push(c.req.query("clearingStatus"));
    }
    if (c.req.query("isActive") !== undefined) {
      clauses.push("is_active = ?");
      values.push(c.req.query("isActive") === "true" ? 1 : 0);
    }
    const chapter = c.req.query("chapter");
    if (chapter && chapter !== "all") {
      clauses.push("chapters LIKE ?");
      values.push(`%"${chapter}"%`);
    }
    const dateFrom = c.req.query("dateFrom");
    const dateTo = c.req.query("dateTo");
    if (dateFrom) {
      clauses.push("created_at >= ?");
      values.push(dateFrom);
    }
    if (dateTo) {
      clauses.push("created_at <= ?");
      values.push(dateTo);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM proprietors ${where}`,
    )
      .bind(...values)
      .first<{ total: number }>();
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM proprietors ${where} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`,
    )
      .bind(...values, limit, (page - 1) * limit)
      .all<Row>();
    const total = count?.total ?? 0;
    return c.json({
      data: results.map((row) => normalize(row)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  app.get("/chapters/available", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT DISTINCT chapter FROM schools WHERE chapter IS NOT NULL AND chapter <> '' ORDER BY chapter",
    ).all<{ chapter: string }>();
    return c.json(results.map((row) => row.chapter));
  });

  app.post("/chapters/bulk-update", requireAuth, async (c) => {
    const body = await jsonBody<Row>(c);
    const updates: Array<{ id: string; chapters: string[] }> =
      body.updates ?? body.proprietors ?? [];
    const timestamp = nowIso();
    for (const item of updates) {
      if (!item?.id) continue;
      await c.env.DB.prepare(
        "UPDATE proprietors SET chapters = ?, updated_at = ? WHERE id = ?",
      )
        .bind(JSON.stringify(item.chapters ?? []), timestamp, item.id)
        .run();
    }
    return c.json({
      message: `Updated chapters for ${updates.length} proprietors`,
      updated: updates.length,
    });
  });

  app.patch("/:id/payment", requireAuth, async (c) => {
    const body = await jsonBody<Row>(c);
    const id = c.req.param("id");
    const existing = await findProprietorRow(c.env.DB, id);
    if (!existing) throw new ApiError(404, "Proprietor not found");

    const sets: string[] = [];
    const values: unknown[] = [];
    const map: Record<string, string> = {
      clearingStatus: "clearing_status",
      totalAmountDue: "total_amount_due",
      paymentMethod: "payment_method",
      lastPaymentDate: "last_payment_date",
      paymentStatus: "payment_status",
    };
    for (const [field, column] of Object.entries(map)) {
      if (body[field] === undefined) continue;
      sets.push(`${column} = ?`);
      values.push(body[field]);
    }
    if (sets.length) {
      sets.push("updated_at = ?");
      values.push(nowIso(), existing.id);
      await c.env.DB.prepare(
        `UPDATE proprietors SET ${sets.join(", ")} WHERE id = ?`,
      )
        .bind(...values)
        .run();
    }
    const row = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(existing.id)
      .first<Row>();
    return c.json({
      message: "Payment status updated successfully",
      proprietor: normalize(row),
    });
  });

  app.patch("/:id/enrollment", requireAuth, async (c) => {
    const body = await jsonBody<Row>(c);
    const id = c.req.param("id");
    const existing = await findProprietorRow(c.env.DB, id);
    if (!existing) throw new ApiError(404, "Proprietor not found");
    const total = Object.entries(body)
      .filter(([key]) => !["id", "_id", "createdAt", "updatedAt"].includes(key))
      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
    await c.env.DB.prepare(
      "UPDATE proprietors SET pupils_presented_last_exam = ?, updated_at = ? WHERE id = ?",
    )
      .bind(total, nowIso(), existing.id)
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(existing.id)
      .first<Row>();
    return c.json({
      message: "Enrollment data updated successfully",
      proprietor: normalize(row),
    });
  });

  app.patch("/:id/chapters", requireAuth, async (c) => {
    const body = await jsonBody<Row>(c);
    const existing = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!existing) throw new ApiError(404, "Proprietor not found");
    const chapters = Array.isArray(body.chapters)
      ? body.chapters
      : body.chapter
        ? [body.chapter]
        : [];
    await c.env.DB.prepare(
      "UPDATE proprietors SET chapters = ?, updated_at = ? WHERE id = ?",
    )
      .bind(JSON.stringify(chapters), nowIso(), existing.id)
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(existing.id)
      .first<Row>();
    return c.json({
      message: "Chapters updated successfully",
      proprietor: normalize(row),
    });
  });

  app.post("/import/csv", requireAuth, async (c) => {
    const form = await c.req.formData();
    const file = form.get("file") as any;
    if (!file || typeof file.text !== "function") {
      throw new ApiError(400, "CSV file is required");
    }
    if (!String(file.name ?? "").toLowerCase().endsWith(".csv")) {
      throw new ApiError(400, "Only CSV files are allowed");
    }
    const skipValidation = String(form.get("skipValidation") ?? "") === "true";
    const updateExisting = String(form.get("updateExisting") ?? "") === "true";
    const records = parseCsv(await file.text());

    const results = {
      totalRecords: records.length,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      errors: [] as Row[],
      warnings: [] as Row[],
      summary: { newRecords: 0, updatedRecords: 0, duplicates: 0 },
    };

    for (let i = 0; i < records.length; i++) {
      const rowNumber = i + 2;
      try {
        const data = mapCsvRecord(records[i]);
        if (!data.email) {
          data.email = `${String(data.firstName ?? "user").toLowerCase()}${rowNumber}@napps-nasarawa.edu.ng`;
        }
        if (!skipValidation) {
          if (!data.firstName) {
            results.errorCount++;
            results.errors.push({ row: rowNumber, field: "firstName", value: data.firstName, message: "First name is required" });
            continue;
          }
          if (!data.lastName) {
            results.errorCount++;
            results.errors.push({ row: rowNumber, field: "lastName", value: data.lastName, message: "Last name is required" });
            continue;
          }
          if (!data.email) {
            results.errorCount++;
            results.errors.push({ row: rowNumber, field: "email", value: data.email, message: "Email is required" });
            continue;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
            results.errorCount++;
            results.errors.push({ row: rowNumber, field: "email", value: data.email, message: "Invalid email format" });
            continue;
          }
          if (!data.phone) {
            results.errorCount++;
            results.errors.push({ row: rowNumber, field: "phone", value: data.phone, message: "Phone number is required" });
            continue;
          }
        }

        const clauses: string[] = ["email = ?"];
        const values: unknown[] = [data.email];
        if (data.phone) {
          clauses.push("phone = ?");
          values.push(data.phone);
        }
        if (data.registrationNumber) {
          clauses.push("registration_number = ?");
          values.push(data.registrationNumber);
        }
        const existing = await c.env.DB.prepare(
          `SELECT * FROM proprietors WHERE ${clauses.join(" OR ")} LIMIT 1`,
        )
          .bind(...values)
          .first<Row>();

        if (existing) {
          if (updateExisting) {
            const { columns, values: updateValues } = buildColumns(data, PROPRIETOR_FIELDS);
            if (columns.length) {
              await c.env.DB.prepare(
                `UPDATE proprietors SET ${columns.map((col) => `${col} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
              )
                .bind(...updateValues, nowIso(), existing.id)
                .run();
            }
            results.summary.updatedRecords++;
            results.successCount++;
          } else {
            results.summary.duplicates++;
            results.skippedCount++;
            results.warnings.push({
              row: rowNumber,
              message: `Proprietor already exists: ${data.email || data.phone}`,
            });
          }
          continue;
        }

        if (!data.registrationNumber) {
          data.registrationNumber = await generateRegistrationNumber(c.env.DB);
        }
        const timestamp = nowIso();
        if (!data.submissionDate) data.submissionDate = timestamp;
        const { columns, values: insertValues } = buildColumns(data, PROPRIETOR_FIELDS);
        await c.env.DB.prepare(
          `INSERT INTO proprietors (id, ${columns.join(", ")}, created_at, updated_at)
           VALUES (?, ${columns.map(() => "?").join(", ")}, ?, ?)`,
        )
          .bind(uuid(), ...insertValues, timestamp, timestamp)
          .run();
        results.summary.newRecords++;
        results.successCount++;
      } catch (error: any) {
        results.errorCount++;
        results.errors.push({
          row: rowNumber,
          field: "general",
          value: records[i],
          message: error?.message || "Unknown error occurred",
        });
      }
    }

    return c.json(results);
  });

  app.get("/monitoring/financial-remittances", async (c) => {
    const totalRegistered = await c.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM proprietors WHERE is_active = 1",
    ).first<{ total: number }>();
    const clearedMembers = await c.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM proprietors WHERE clearing_status = 'cleared' AND is_active = 1",
    ).first<{ total: number }>();
    const activeDues = await activeFeeTotal(c.env.DB);
    const duesPerSchool = activeDues > 0 ? activeDues : 14500;
    const totalCollected = (clearedMembers?.total ?? 0) * duesPerSchool;
    const lgas = [
      "Akwanga", "Awe", "Doma", "Karu", "Keana", "Keffi", "Kokona",
      "Lafia", "Nasarawa", "Nasarawa Eggon", "Obi", "Toto", "Wamba",
    ];

    const lgaBreakdown = [];
    for (const lga of lgas) {
      const registered = await c.env.DB.prepare(
        "SELECT COUNT(*) AS total FROM proprietors WHERE lga = ? AND is_active = 1",
      )
        .bind(lga)
        .first<{ total: number }>();
      const cleared = await c.env.DB.prepare(
        "SELECT COUNT(*) AS total FROM proprietors WHERE lga = ? AND clearing_status = 'cleared' AND is_active = 1",
      )
        .bind(lga)
        .first<{ total: number }>();
      const registeredCount = registered?.total ?? 0;
      const clearedCount = cleared?.total ?? 0;
      const lgaCollected = clearedCount * duesPerSchool;
      lgaBreakdown.push({
        lga,
        coordinator: `Chapter Coordinator (${lga})`,
        registeredSchools: registeredCount,
        clearedSchools: clearedCount,
        pendingSchools: Math.max(0, registeredCount - clearedCount),
        totalCollected: lgaCollected,
        chapterShare20Pct: Math.round(lgaCollected * 0.2),
        stateRemittance35Pct: Math.round(lgaCollected * 0.35),
        zonalRemittance20Pct: Math.round(lgaCollected * 0.2),
        nationalRemittance25Pct: Math.round(lgaCollected * 0.25),
        remittanceStatus: clearedCount > 0 ? "CURRENT_IN_REMITTANCE" : "PENDING_REMITTANCE",
      });
    }

    const total = totalRegistered?.total ?? 0;
    const cleared = clearedMembers?.total ?? 0;
    return c.json({
      overview: {
        totalSchoolsRegistered: total,
        totalSchoolsCleared: cleared,
        duesPerSchool,
        totalRevenueCollected: totalCollected,
        distributionTotals: {
          localChaptersTotal: Math.round(totalCollected * 0.2),
          stateChapterTotal: Math.round(totalCollected * 0.35),
          zonalChapterTotal: Math.round(totalCollected * 0.2),
          nationalSecretariatTotal: Math.round(totalCollected * 0.25),
        },
        auditTimestamp: nowIso(),
        complianceRate: total > 0 ? `${Math.round((cleared / total) * 100)}%` : "0%",
      },
      lgaBreakdown,
    });
  });

  app.get("/verify-member/:identifier", async (c) => {
    const identifier = c.req.param("identifier");
    const row = await c.env.DB.prepare(
      "SELECT * FROM proprietors WHERE id = ? OR submission_id = ? OR registration_number = ? OR napps_membership_id = ?",
    )
      .bind(identifier, identifier, identifier, identifier)
      .first<Row>();
    if (!row) throw new ApiError(404, "Member not found");
    const proprietor = normalize(row)!;
    return c.json({
      verified: proprietor.registrationStatus === "approved",
      member: {
        fullName: proprietor.fullName,
        registrationNumber: proprietor.registrationNumber,
        nappsMembershipId: proprietor.nappsMembershipId,
        registrationStatus: proprietor.registrationStatus,
        clearingStatus: proprietor.clearingStatus,
        paymentStatus: proprietor.paymentStatus,
        lga: proprietor.lga,
      },
    });
  });

  app.get("/:id/validation-form", async (c) => {
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    const proprietor = normalize(row)!;
    const school = await findSchool(c.env.DB, row.school_id);
    const fees = await activeFeeTotal(c.env.DB);
    return c.json({ proprietor, school, dues: { total: fees } });
  });

  app.put("/:id/validation-form", async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    const { columns, values } = buildColumns(body, PROPRIETOR_FIELDS);
    if (columns.length) {
      await c.env.DB.prepare(
        `UPDATE proprietors SET ${columns.map((col) => `${col} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
      )
        .bind(...values, nowIso(), row.id)
        .run();
    }
    const updated = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(row.id)
      .first<Row>();
    return c.json(normalize(updated));
  });

  app.post("/registration/complete", async (c) => {
    const body = await jsonBody<Row>(c);
    if (!body.submissionId) throw new ApiError(400, "submissionId is required");
    const row = await findProprietorRow(c.env.DB, String(body.submissionId));
    if (!row) throw new ApiError(404, "Registration not found");
    if (row.submission_status === "submitted") {
      throw new ApiError(400, "This registration has already been completed");
    }
    if (!row.school_id) {
      throw new ApiError(400, "School information must be completed before submitting payment details");
    }
    const paymentInfo = (body.paymentInfo || {}) as Row;
    const registrationNumber =
      row.registration_number || (await generateRegistrationNumber(c.env.DB));
    const paid = String(paymentInfo.paymentStatus || "").toLowerCase() === "paid";
    await c.env.DB.prepare(
      `UPDATE proprietors SET registration_number = ?, submission_status = 'submitted',
        submission_date = ?, registration_status = ?, approval_status = ?,
        payment_status = ?, payment_method = COALESCE(?, payment_method), is_active = 1,
        updated_at = ? WHERE id = ?`,
    )
      .bind(
        registrationNumber,
        nowIso(),
        paid ? "approved" : "pending",
        paid ? "approved" : "pending",
        paid ? "Paid" : "Pending",
        paymentInfo.paymentMethod ?? null,
        nowIso(),
        row.id,
      )
      .run();
    const updated = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(row.id)
      .first<Row>();
    return c.json(normalize(updated));
  });

  app.post("/ai-extract-document", async (c) => {
    const data = await jsonBody<{ imageBase64?: string; textSnippet?: string; documentType?: string }>(c);
    let text = (data.textSnippet || "").trim();
    if (!text && data.imageBase64) {
      try {
        const raw = data.imageBase64.replace(/^data:.*?;base64,/, "");
        const binary = atob(raw);
        const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        if (/SCHOOL|NAPPS|LGA|NAME|PHONE/i.test(decoded)) text = decoded;
      } catch {
        text = "";
      }
    }
    if (!text && !data.imageBase64) {
      return c.json({
        success: false,
        message: "No readable document data was uploaded.",
        extractedData: null,
      });
    }
    const nameMatch = text.match(/(?:FULL\s+NAME|PROPRIETOR(?:\s+NAME)?|NAME)\s*[:=-]\s*([^\r\n,;]+)/i);
    const schoolMatch = text.match(/(?:SCHOOL\s+NAME|NAME\s+OF\s+SCHOOL)\s*[:=-]\s*([^\r\n,;]+)/i);
    const addressMatch = text.match(/(?:SCHOOL\s+ADDRESS|ADDRESS)\s*[:=-]\s*([^\r\n,;]+)/i);
    const phoneMatch =
      text.match(/(?:PHONE(?:\s+NO)?|TEL|MOBILE)\s*[:=-]?\s*([0-9\s+()-]{10,15})/i) ||
      text.match(/(?:(?:\+?234)|0)[789][01]\d{8}/);
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
    const yearMatch =
      text.match(/(?:YEAR\s+(?:OF\s+)?ESTABLISHMENT|ESTD?|ESTABLISHED)\s*[:=-]?\s*(\d{4})/i) ||
      text.match(/\b(19\d\d|20\d\d)\b/);
    const lgaMatch = text.match(/(?:L\.?\s*G\.?\s*A\.?|LOCAL\s+GOV(?:ERNMENT)?)\s*[:=-]\s*([A-Za-z\s]+)/i);
    const codeMatch = text.match(/(?:SCHOOL\s+CODE|CODE)\s*[:=-]\s*([A-Za-z0-9/_-]+)/i);
    const extractedName = nameMatch ? nameMatch[1].trim() : "";
    const extractedSchool = schoolMatch ? schoolMatch[1].trim() : "";
    const extractedAddress = addressMatch ? addressMatch[1].trim() : "";
    const extractedPhone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).replace(/\s+/g, "") : "";
    const extractedEmail = emailMatch ? emailMatch[1].trim() : "";
    const extractedYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    const extractedLga = lgaMatch ? lgaMatch[1].trim() : "";
    const extractedCode = codeMatch ? codeMatch[1].trim() : "";
    if (!extractedName && !extractedSchool && !extractedPhone && !extractedEmail && !extractedAddress) {
      return c.json({
        success: false,
        message:
          "Could not detect legible credentials from the uploaded document. Please enter details manually.",
        extractedData: null,
      });
    }
    return c.json({
      success: true,
      message: "Document parsed successfully.",
      extractedData: {
        fullName: extractedName,
        schoolName: extractedSchool,
        address: extractedAddress,
        phone: extractedPhone,
        email: extractedEmail,
        yearOfEstablishment: extractedYear,
        lga: extractedLga,
        schoolCode: extractedCode,
      },
    });
  });

  app.patch("/:id/bulk-update", requireAuth, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    if (body.enrollment) {
      const enrollment = body.enrollment as Row;
      const total = Object.entries(enrollment)
        .filter(([key]) => !key.startsWith("_"))
        .reduce((sum, [, value]) => sum + (typeof value === "number" ? value : Number(value) || 0), 0);
      await c.env.DB.prepare(
        "UPDATE proprietors SET pupils_presented_last_exam = ?, updated_at = ? WHERE id = ?",
      )
        .bind(total, nowIso(), row.id)
        .run();
    }
    if (body.payment) {
      const payment = body.payment as Row;
      const sets: string[] = [];
      const values: unknown[] = [];
      const map: Record<string, string> = {
        clearingStatus: "clearing_status",
        totalAmountDue: "total_amount_due",
        paymentMethod: "payment_method",
        lastPaymentDate: "last_payment_date",
        paymentStatus: "payment_status",
      };
      for (const [field, column] of Object.entries(map)) {
        if (payment[field] !== undefined) {
          sets.push(`${column} = ?`);
          values.push(payment[field]);
        }
      }
      if (sets.length) {
        await c.env.DB.prepare(
          `UPDATE proprietors SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`,
        )
          .bind(...values, nowIso(), row.id)
          .run();
      }
    }
    const updated = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(row.id)
      .first<Row>();
    return c.json({
      message: "Proprietor data updated successfully",
      proprietor: normalize(updated),
    });
  });

  app.get("/:id/id-card", async (c) => {
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    const proprietor = normalize(row)!;
    const school = (await findSchool(c.env.DB, row.school_id)) || {};
    const lga = proprietor.lga || school.lga || "Lafia";
    const lgaPrefix = String(lga).slice(0, 3).toUpperCase();
    let membershipId = proprietor.nappsMembershipId as string | undefined;
    if (!membershipId || !membershipId.startsWith("NAPPS/NAS")) {
      const count = await c.env.DB.prepare(
        "SELECT COUNT(*) AS total FROM proprietors WHERE napps_membership_id IS NOT NULL AND napps_membership_id != ''",
      ).first<{ total: number }>();
      const seq = String((count?.total ?? 0) + 101).padStart(4, "0");
      membershipId = `NAPPS/NAS/2026/${lgaPrefix}/${seq}`;
      await c.env.DB.prepare(
        "UPDATE proprietors SET napps_membership_id = ?, updated_at = ? WHERE id = ?",
      )
        .bind(membershipId, nowIso(), row.id)
        .run();
    }
    const verificationUrl = `https://nappsnasarawa.com/verify?id=${encodeURIComponent(membershipId)}`;
    return c.json({
      membershipId,
      fullName: `${proprietor.firstName || ""} ${proprietor.middleName || ""} ${proprietor.lastName || ""}`.trim(),
      passportPhoto: proprietor.passportPhoto || "",
      schoolName: school.schoolName || "",
      schoolAddress: school.address || "",
      lga: lga || school.lga || "",
      chapter:
        (proprietor.chapters && proprietor.chapters[0]) ||
        school.chapter ||
        (lga ? `${lga} Chapter` : ""),
      issueDate: "01/01/2026",
      expiryDate: "31/12/2026",
      academicSession: "2025/2026",
      clearingStatus: proprietor.clearingStatus || "pending",
      stateChairmanSignature: "State Chairman, NAPPS Nasarawa",
      securityQrPayload: JSON.stringify({
        memId: membershipId,
        name: `${proprietor.firstName || ""} ${proprietor.lastName || ""}`.trim(),
        sch: school.schoolName || "",
        lga: lga || school.lga || "",
        status:
          proprietor.clearingStatus === "cleared" ? "VALID_MEMBER_2026" : "PENDING_CLEARANCE",
        verifyUrl: verificationUrl,
      }),
      verificationUrl,
    });
  });

  app.get("/:id/receipt", async (c) => {
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    const proprietor = normalize(row)!;
    const school = (await findSchool(c.env.DB, row.school_id)) || {};
    const history = Array.isArray(proprietor.duesPaymentHistory)
      ? proprietor.duesPaymentHistory
      : [];
    const lastPaid = [...history]
      .reverse()
      .find((item: any) => Number(item?.amountPaid) > 0);
    let totalDues = lastPaid ? Number(lastPaid.amountPaid) : 0;
    if (!totalDues) totalDues = await activeFeeTotal(c.env.DB);
    if (!totalDues) totalDues = 14500;
    const distribution = {
      localChapter: {
        name: "Local Chapter Share (LGA Chapter)",
        percentage: 20,
        amount: Math.round(totalDues * 0.2),
      },
      stateChapter: {
        name: "NAPPS Nasarawa State Chapter",
        percentage: 35,
        amount: Math.round(totalDues * 0.35),
      },
      zonalChapter: {
        name: "North Central Zonal Chapter",
        percentage: 20,
        amount: Math.round(totalDues * 0.2),
      },
      nationalSecretariat: {
        name: "NAPPS National Secretariat",
        percentage: 25,
        amount: Math.round(totalDues * 0.25),
      },
    };
    return c.json({
      receiptNumber: `REC-NAPPS-2026-${String(row.id).slice(-6).toUpperCase()}`,
      receiptDate: nowIso(),
      academicSession: "2025/2026",
      payerName: `${proprietor.firstName || ""} ${proprietor.lastName || ""}`.trim(),
      email: proprietor.email || "",
      phone: proprietor.phone || "",
      schoolName: school.schoolName || "",
      lga: proprietor.lga || school.lga || "",
      chapter: (proprietor.chapters && proprietor.chapters[0]) || school.chapter || "",
      membershipId:
        proprietor.nappsMembershipId ||
        `NAPPS/NAS/2026/MEM/${String(row.id).slice(-4)}`,
      totalDues,
      totalAmount: totalDues,
      amountInWords:
        totalDues === 11000
          ? "Eleven Thousand Naira Only"
          : totalDues === 14500
            ? "Fourteen Thousand, Five Hundred Naira Only"
            : `${totalDues.toLocaleString("en-NG")} Naira Only`,
      distribution,
      clearingStatus: proprietor.clearingStatus || "pending",
      paymentStatus: proprietor.paymentStatus || "Not Paid",
      issuedBy: "NAPPS Nasarawa State Chapter",
    });
  });

  app.get("/:id", async (c) => {
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, `Proprietor with ID ${c.req.param("id")} not found`);
    const proprietor = normalize(row)!;
    const school = await findSchool(c.env.DB, row.school_id);
    if (school) {
      proprietor.school = school;
      for (const [key, value] of Object.entries(school)) {
        if (proprietor[key] === undefined || proprietor[key] === null) {
          proprietor[key] = value;
        }
      }
    }
    return c.json(proprietor);
  });

  app.patch("/:id", requireAuth, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    const { columns, values } = buildColumns(body, PROPRIETOR_FIELDS);
    if (columns.length) {
      await c.env.DB.prepare(
        `UPDATE proprietors SET ${columns.map((col) => `${col} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
      )
        .bind(...values, nowIso(), row.id)
        .run();
    }
    const updated = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(row.id)
      .first<Row>();
    return c.json(normalize(updated));
  });

  app.patch("/self-update/:id", async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    const { columns, values } = buildColumns(body, PROPRIETOR_FIELDS);
    if (columns.length) {
      await c.env.DB.prepare(
        `UPDATE proprietors SET ${columns.map((col) => `${col} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
      )
        .bind(...values, nowIso(), row.id)
        .run();
    }
    const updated = await c.env.DB.prepare("SELECT * FROM proprietors WHERE id = ?")
      .bind(row.id)
      .first<Row>();
    return c.json(normalize(updated));
  });

  app.delete("/:id", requireAuth, async (c) => {
    const row = await findProprietorRow(c.env.DB, c.req.param("id"));
    if (!row) throw new ApiError(404, "Proprietor not found");
    await c.env.DB.prepare("DELETE FROM proprietors WHERE id = ?").bind(row.id).run();
    return c.json({ message: "Proprietor deleted successfully" });
  });

  return app;
};

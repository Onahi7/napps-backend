import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { requireRoles } from "../lib/auth.ts";
import { ApiError, camelizeRow, camelizeRows, jsonBody, nowIso, uuid } from "../lib/http.ts";

type DB = AppEnv["Bindings"]["DB"];
import {
  deleteRow,
  getRow,
  insertRow,
  pageParams,
  updateRow,
  type FieldMap,
  type Row,
} from "../lib/rows.ts";

const NAPPS_CHAPTERS = [
  "Asakioo",
  "Karu 1",
  "Doma",
  "Karu 2",
  "Mararaba Udege",
  "Masaka Ado",
  "Panda",
  "Akwanga",
  "Lafia A",
  "Shabu",
  "Lafia B",
  "Keffi",
  "Kokona",
  "Mararaba Guruku",
  "Jenkwe",
  "Uke Chapter",
  "Nasarawa Eggon",
  "Nas Poly",
];

const schoolFields: FieldMap = {
  proprietorId: "proprietor_id",
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
  nnsuceTimesWritten: "nnsuce_times_written",
  nnsucePupilsCount: "nnsuce_pupils_count",
  enrollment: "enrollment",
  isPrimary: "is_primary",
  isActive: "is_active",
  images: "images",
};

const schoolJson = new Set(["enrollment", "images"]);
const schoolBool = new Set(["isPrimary", "isActive"]);

const enrollmentFields: FieldMap = {
  schoolId: "school_id",
  proprietorId: "proprietor_id",
  academicYear: "academic_year",
  term: "term",
  enrollmentByLevel: "enrollment_by_level",
  genderBreakdown: "gender_breakdown",
  staffData: "staff_data",
  totalEnrollment: "total_enrollment",
  status: "status",
  submittedAt: "submitted_at",
  verifiedAt: "verified_at",
  verifiedBy: "verified_by",
  remarks: "remarks",
  isActive: "is_active",
};

const enrollmentJson = new Set(["enrollmentByLevel", "genderBreakdown", "staffData"]);
const enrollmentBool = new Set(["isActive"]);

const admin = requireRoles("admin", "super_admin");

async function proprietorSummary(db: DB, id: unknown) {
  if (!id) return null;
  const row = await db
    .prepare(
      "SELECT id, first_name, last_name, email, phone, registration_number FROM proprietors WHERE id = ?",
    )
    .bind(String(id))
    .first<Row>();
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    registrationNumber: row.registration_number,
  };
}

async function withProprietor(db: DB, row: Row | null) {
  const out = camelizeRow(row);
  if (!out) return null;
  out.proprietorId = await proprietorSummary(db, row!.proprietor_id);
  return out;
}

async function withSchoolAndProprietor(db: DB, row: Row | null) {
  const out = camelizeRow(row);
  if (!out) return null;
  out.proprietorId = await proprietorSummary(db, row!.proprietor_id);
  if (row!.school_id) {
    const school = await getRow(db, "schools", String(row!.school_id));
    out.schoolId = school
      ? {
          _id: school.id,
          id: school.id,
          schoolName: school.school_name,
          address: school.address,
          proprietorId: school.proprietor_id,
        }
      : null;
  }
  return out;
}

export function schoolsRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    if (!body.proprietorId) throw new ApiError(400, "proprietorId is required");
    const proprietor = await getRow(c.env.DB, "proprietors", String(body.proprietorId));
    if (!proprietor) throw new ApiError(404, "Proprietor not found");

    const chapters = Array.isArray(proprietor.chapters)
      ? proprietor.chapters
      : typeof proprietor.chapters === "string"
        ? JSON.parse(proprietor.chapters || "[]")
        : [];
    if (!body.chapter && chapters.length) body.chapter = chapters[0];
    if (body.chapter && !NAPPS_CHAPTERS.includes(body.chapter)) {
      throw new ApiError(
        400,
        `Invalid chapter: ${body.chapter}. Must be one of: ${NAPPS_CHAPTERS.join(", ")}`,
      );
    }
    if (body.isPrimary) {
      await c.env.DB.prepare(
        "UPDATE schools SET is_primary = 0, updated_at = ? WHERE proprietor_id = ?",
      )
        .bind(nowIso(), String(body.proprietorId))
        .run();
    }
    const row = await insertRow(c.env.DB, "schools", body, schoolFields, {
      json: schoolJson,
      bool: schoolBool,
    });
    if (row && (!proprietor.school_id || body.isPrimary)) {
      await c.env.DB.prepare("UPDATE proprietors SET school_id = ?, updated_at = ? WHERE id = ?")
        .bind(String(row.id), nowIso(), String(body.proprietorId))
        .run();
    }
    return c.json(await withProprietor(c.env.DB, row), 201);
  });

  app.get("/", async (c) => {
    const { page, limit, offset } = pageParams(c);
    const clauses: string[] = [];
    const params: unknown[] = [];
    const search = c.req.query("search");
    if (search) {
      clauses.push(
        "(school_name LIKE ? OR school_name2 LIKE ? OR address LIKE ? OR address_line2 LIKE ?)",
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    const filters: Array<[string, string]> = [
      ["proprietorId", "proprietor_id"],
      ["lga", "lga"],
      ["aeqeoZone", "aeqeo_zone"],
      ["typeOfSchool", "type_of_school"],
      ["categoryOfSchool", "category_of_school"],
    ];
    for (const [query, column] of filters) {
      const value = c.req.query(query);
      if (value) {
        clauses.push(`${column} LIKE ?`);
        params.push(`%${value}%`);
      }
    }
    for (const [query, column] of [
      ["isActive", "is_active"],
      ["isPrimary", "is_primary"],
    ] as Array<[string, string]>) {
      const value = c.req.query(query);
      if (value !== undefined) {
        clauses.push(`${column} = ?`);
        params.push(value === "true" || value === "1" ? 1 : 0);
      }
    }
    const sortMap: Record<string, string> = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      schoolName: "school_name",
      lga: "lga",
    };
    const sortBy = sortMap[c.req.query("sortBy") || "createdAt"] || "created_at";
    const sortOrder = c.req.query("sortOrder") === "asc" ? "ASC" : "DESC";
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const count = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM schools ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const rows = await c.env.DB.prepare(
      `SELECT * FROM schools ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all<Row>();
    const data = await Promise.all(rows.results.map((row) => withProprietor(c.env.DB, row)));
    const total = count?.total ?? 0;
    return c.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  app.get("/stats", async (c) => {
    const db = c.env.DB;
    const count = async (sql: string) => {
      const row = await db.prepare(sql).first<{ total: number }>();
      return row?.total ?? 0;
    };
    const [totalSchools, activeSchools] = await Promise.all([
      count("SELECT COUNT(*) AS total FROM schools"),
      count("SELECT COUNT(*) AS total FROM schools WHERE is_active = 1"),
    ]);
    const grouped = async (column: string) => {
      const { results } = await db
        .prepare(
          `SELECT ${column} AS key, COUNT(*) AS total FROM schools WHERE is_active = 1 AND ${column} IS NOT NULL AND ${column} != '' GROUP BY ${column}`,
        )
        .all<{ key: string; total: number }>();
      return Object.fromEntries(results.map((r) => [r.key, r.total]));
    };
    const year = await db
      .prepare(
        "SELECT AVG(year_of_establishment) AS avgYear FROM schools WHERE is_active = 1 AND year_of_establishment IS NOT NULL",
      )
      .first<{ avgYear: number | null }>();
    return c.json({
      totalSchools,
      activeSchools,
      schoolsByLGA: await grouped("lga"),
      schoolsByType: await grouped("type_of_school"),
      schoolsByCategory: await grouped("category_of_school"),
      averageYearEstablished: Math.round(year?.avgYear || 0),
    });
  });

  app.get("/proprietor/:proprietorId", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM schools WHERE proprietor_id = ? ORDER BY is_primary DESC, created_at ASC",
    )
      .bind(c.req.param("proprietorId"))
      .all<Row>();
    const data = await Promise.all(results.map((row) => withProprietor(c.env.DB, row)));
    return c.json(data);
  });

  app.post("/enrollments", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    if (!body.schoolId) throw new ApiError(400, "schoolId is required");
    if (!body.proprietorId) throw new ApiError(400, "proprietorId is required");
    const school = await getRow(c.env.DB, "schools", String(body.schoolId));
    if (!school) throw new ApiError(404, "School not found");
    const proprietor = await getRow(c.env.DB, "proprietors", String(body.proprietorId));
    if (!proprietor) throw new ApiError(404, "Proprietor not found");
    const existing = await c.env.DB.prepare(
      "SELECT id FROM enrollments WHERE school_id = ? AND academic_year = ? AND term = ?",
    )
      .bind(String(body.schoolId), String(body.academicYear), String(body.term))
      .first<Row>();
    if (existing) {
      throw new ApiError(
        409,
        `Enrollment already exists for ${body.academicYear} - ${body.term} term`,
      );
    }
    const row = await insertRow(c.env.DB, "enrollments", body, enrollmentFields, {
      json: enrollmentJson,
      bool: enrollmentBool,
    });
    return c.json(await withSchoolAndProprietor(c.env.DB, row), 201);
  });

  app.get("/enrollments", async (c) => {
    const { page, limit, offset } = pageParams(c);
    const clauses: string[] = [];
    const params: unknown[] = [];
    for (const [query, column] of [
      ["schoolId", "school_id"],
      ["proprietorId", "proprietor_id"],
      ["academicYear", "academic_year"],
      ["term", "term"],
      ["status", "status"],
    ] as Array<[string, string]>) {
      const value = c.req.query(query);
      if (value) {
        clauses.push(`${column} = ?`);
        params.push(value);
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const count = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM enrollments ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const rows = await c.env.DB.prepare(
      `SELECT * FROM enrollments ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all<Row>();
    const data = await Promise.all(rows.results.map((row) => withSchoolAndProprietor(c.env.DB, row)));
    const total = count?.total ?? 0;
    return c.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  app.get("/enrollments/stats", async (c) => {
    const academicYear = c.req.query("academicYear");
    const where = academicYear ? "WHERE is_active = 1 AND academic_year = ?" : "WHERE is_active = 1";
    const params = academicYear ? [academicYear] : [];
    const db = c.env.DB;
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS total FROM enrollments ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const terms = await db
      .prepare(`SELECT term AS key, COUNT(*) AS total FROM enrollments ${where} GROUP BY term`)
      .bind(...params)
      .all<{ key: string; total: number }>();
    const statuses = await db
      .prepare(`SELECT status AS key, COUNT(*) AS total FROM enrollments ${where} GROUP BY status`)
      .bind(...params)
      .all<{ key: string; total: number }>();
    const { results } = await db
      .prepare(`SELECT total_enrollment, gender_breakdown, staff_data, enrollment_by_level FROM enrollments ${where}`)
      .bind(...params)
      .all<Row>();
    let totalStudents = 0;
    let male = 0;
    let female = 0;
    let teaching = 0;
    let nonTeaching = 0;
    let qualified = 0;
    let unqualified = 0;
    const levelDistribution: Record<string, number> = {};
    for (const row of results) {
      totalStudents += Number(row.total_enrollment || 0);
      const gender = row.gender_breakdown
        ? typeof row.gender_breakdown === "string"
          ? JSON.parse(row.gender_breakdown)
          : row.gender_breakdown
        : {};
      male += Number(gender.male || 0);
      female += Number(gender.female || 0);
      const staff = row.staff_data
        ? typeof row.staff_data === "string"
          ? JSON.parse(row.staff_data)
          : row.staff_data
        : {};
      teaching += Number(staff.teachingStaff || 0);
      nonTeaching += Number(staff.nonTeachingStaff || 0);
      qualified += Number(staff.qualifiedTeachers || 0);
      unqualified += Number(staff.unqualifiedTeachers || 0);
      const levels = row.enrollment_by_level
        ? typeof row.enrollment_by_level === "string"
          ? JSON.parse(row.enrollment_by_level)
          : row.enrollment_by_level
        : {};
      for (const [level, count] of Object.entries(levels)) {
        levelDistribution[level] = (levelDistribution[level] || 0) + Number(count || 0);
      }
    }
    return c.json({
      totalEnrollments: totalRow?.total ?? 0,
      totalStudents,
      enrollmentsByTerm: Object.fromEntries(terms.results.map((r) => [r.key, r.total])),
      enrollmentsByStatus: Object.fromEntries(statuses.results.map((r) => [r.key, r.total])),
      genderBreakdown: { male, female },
      staffSummary: {
        totalTeachingStaff: teaching,
        totalNonTeachingStaff: nonTeaching,
        qualifiedTeachers: qualified,
        unqualifiedTeachers: unqualified,
      },
      levelDistribution,
    });
  });

  app.get("/enrollments/:id", async (c) => {
    const row = await getRow(c.env.DB, "enrollments", c.req.param("id"));
    if (!row) throw new ApiError(404, `Enrollment with ID ${c.req.param("id")} not found`);
    return c.json(await withSchoolAndProprietor(c.env.DB, row));
  });

  app.patch("/enrollments/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await updateRow(c.env.DB, "enrollments", c.req.param("id"), body, enrollmentFields, {
      json: enrollmentJson,
      bool: enrollmentBool,
    });
    if (!row) throw new ApiError(404, `Enrollment with ID ${c.req.param("id")} not found`);
    return c.json(await withSchoolAndProprietor(c.env.DB, row));
  });

  app.post("/enrollments/:id/submit", admin, async (c) => {
    const row = await getRow(c.env.DB, "enrollments", c.req.param("id"));
    if (!row) throw new ApiError(404, `Enrollment with ID ${c.req.param("id")} not found`);
    if (row.status !== "draft") throw new ApiError(400, "Only draft enrollments can be submitted");
    await c.env.DB.prepare(
      "UPDATE enrollments SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?",
    )
      .bind(nowIso(), nowIso(), c.req.param("id"))
      .run();
    return c.json(await withSchoolAndProprietor(c.env.DB, await getRow(c.env.DB, "enrollments", c.req.param("id"))));
  });

  app.delete("/enrollments/:id", admin, async (c) => {
    const removed = await deleteRow(c.env.DB, "enrollments", c.req.param("id"));
    if (!removed) throw new ApiError(404, `Enrollment with ID ${c.req.param("id")} not found`);
    return c.json({ message: "Enrollment deleted successfully" });
  });

  app.get("/:id", async (c) => {
    const row = await getRow(c.env.DB, "schools", c.req.param("id"));
    if (!row) throw new ApiError(404, `School with ID ${c.req.param("id")} not found`);
    return c.json(await withProprietor(c.env.DB, row));
  });

  app.patch("/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const existing = await getRow(c.env.DB, "schools", c.req.param("id"));
    if (!existing) throw new ApiError(404, `School with ID ${c.req.param("id")} not found`);
    if (body.isPrimary) {
      await c.env.DB.prepare(
        "UPDATE schools SET is_primary = 0, updated_at = ? WHERE proprietor_id = ? AND id != ?",
      )
        .bind(nowIso(), String(existing.proprietor_id), c.req.param("id"))
        .run();
    }
    const row = await updateRow(c.env.DB, "schools", c.req.param("id"), body, schoolFields, {
      json: schoolJson,
      bool: schoolBool,
    });
    return c.json(await withProprietor(c.env.DB, row));
  });

  app.delete("/:id", admin, async (c) => {
    const enrollmentCount = await c.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM enrollments WHERE school_id = ?",
    )
      .bind(c.req.param("id"))
      .first<{ total: number }>();
    if ((enrollmentCount?.total ?? 0) > 0) {
      throw new ApiError(
        400,
        "Cannot delete school with existing enrollment records. Please archive enrollments first.",
      );
    }
    const removed = await deleteRow(c.env.DB, "schools", c.req.param("id"));
    if (!removed) throw new ApiError(404, `School with ID ${c.req.param("id")} not found`);
    return c.json({ message: "School deleted successfully" });
  });

  return app;
}

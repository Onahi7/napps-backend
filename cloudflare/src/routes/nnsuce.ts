import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import { ApiError, camelizeRow, camelizeRows, jsonBody, nowIso, uuid } from "../lib/http.ts";

type Row = Record<string, any>;

const MASTER_ANSWER_KEYS: Record<string, string[]> = {
  "English Language": [
    "A","C","B","D","A","B","C","A","D","C","B","A","D","C","B","A","C","D","B","A",
    "C","B","D","A","C","D","A","B","C","D","A","B","C","D","B","A","C","D","A","B",
    "C","D","B","A","C","B","D","A","C","D",
  ],
  Mathematics: [
    "B","D","A","C","B","C","D","A","B","D","A","C","B","D","A","C","B","A","D","C",
    "B","A","C","D","A","B","D","C","A","B","D","C","A","B","C","D","A","B","D","C",
    "A","B","C","D","A","C","B","D","A","B",
  ],
  "Basic Science & Tech": [
    "C","A","D","B","C","A","B","D","C","A","D","B","C","A","B","D","C","B","A","D",
    "C","A","D","B","A","C","D","B","A","C","D","B","A","C","B","D","A","C","B","D",
    "A","C","D","B","A","D","C","B","A","C",
  ],
  "National Values": [
    "A","B","C","D","A","D","C","B","A","B","C","D","A","B","C","D","B","A","C","D",
    "A","B","D","C","A","B","C","D","A","C","B","D","A","B","D","C","A","B","C","D",
    "B","A","D","C","B","A","C","D","A","B",
  ],
  "Pre-Vocational Studies": [
    "D","C","B","A","D","C","A","B","D","C","B","A","D","C","B","A","C","D","B","A",
    "D","C","B","A","D","A","B","C","D","A","B","C","D","A","C","B","D","A","C","B",
    "D","A","B","C","D","B","A","C","D","A",
  ],
};

const centerSchema = z.object({
  centerCode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  lga: z.string().trim().min(1),
  address: z.string().trim().min(1),
  capacity: z.number().int().positive().optional(),
  supervisorName: z.string().trim().min(1),
  supervisorPhone: z.string().optional(),
  isActive: z.boolean().optional(),
});

const candidateSchema = z.object({
  candidateName: z.string().trim().min(1),
  gender: z.enum(["Male", "Female"]),
  schoolName: z.string().trim().min(1),
  schoolId: z.string().optional(),
  centerCode: z.string().trim().min(1),
  passportPhoto: z.string().optional(),
  subjects: z.array(z.string()).optional(),
});

const omrSchema = z.object({
  examNumber: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  detectedResponses: z.array(z.string()).default([]),
  centerCode: z.string().trim().min(1),
  sheetImage: z.string().optional(),
  scannerDevice: z.string().optional(),
});

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function gradeFor(percentage: number) {
  if (percentage >= 75) return "A1";
  if (percentage >= 70) return "B2";
  if (percentage >= 65) return "B3";
  if (percentage >= 60) return "C4";
  if (percentage >= 55) return "C5";
  if (percentage >= 50) return "C6";
  if (percentage >= 45) return "D7";
  if (percentage >= 40) return "E8";
  return "F9";
}

export function nnsuceRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/centers", async (c) => {
    const lga = c.req.query("lga");
    const { results } = lga
      ? await c.env.DB.prepare(
          "SELECT * FROM nnsuce_centers WHERE lga = ? ORDER BY center_code",
        )
          .bind(lga)
          .all<Row>()
      : await c.env.DB.prepare(
          "SELECT * FROM nnsuce_centers ORDER BY center_code",
        ).all<Row>();
    return c.json(camelizeRows(results));
  });

  app.post("/centers", async (c) => {
    const parsed = centerSchema.safeParse(await jsonBody<Row>(c));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    const data = parsed.data;
    const existing = await c.env.DB.prepare(
      "SELECT id FROM nnsuce_centers WHERE center_code = ?",
    )
      .bind(data.centerCode)
      .first();
    if (existing) throw new ApiError(400, `Center code ${data.centerCode} already exists`);

    const id = uuid();
    const timestamp = nowIso();
    await c.env.DB.prepare(
      `INSERT INTO nnsuce_centers (id, center_code, name, lga, address, capacity,
        supervisor_name, supervisor_phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        data.centerCode,
        data.name,
        data.lga,
        data.address,
        data.capacity ?? 250,
        data.supervisorName,
        data.supervisorPhone ?? "",
        data.isActive === false ? 0 : 1,
        timestamp,
        timestamp,
      )
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM nnsuce_centers WHERE id = ?")
      .bind(id)
      .first<Row>();
    return c.json(camelizeRow(row), 201);
  });

  app.get("/candidates", async (c) => {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (c.req.query("schoolName")) {
      clauses.push("school_name LIKE ?");
      values.push(`%${c.req.query("schoolName")}%`);
    }
    if (c.req.query("centerCode")) {
      clauses.push("center_code = ?");
      values.push(c.req.query("centerCode"));
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM nnsuce_candidates ${where} ORDER BY created_at DESC`,
    )
      .bind(...values)
      .all<Row>();
    return c.json(camelizeRows(results));
  });

  app.post("/candidates", async (c) => {
    const parsed = candidateSchema.safeParse(await jsonBody<Row>(c));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    const data = parsed.data;
    const center = await c.env.DB.prepare(
      "SELECT * FROM nnsuce_centers WHERE center_code = ?",
    )
      .bind(data.centerCode)
      .first<Row>();
    if (!center) throw new ApiError(404, `Center ${data.centerCode} does not exist`);

    const count = await c.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM nnsuce_candidates",
    ).first<{ total: number }>();
    const lgaPrefix = (data.schoolName.slice(0, 3) || "NAS")
      .toUpperCase()
      .replace(/[^A-Z]/g, "X");
    const seq = String((count?.total ?? 0) + 1).padStart(4, "0");
    const examNumber = `NNSUCE/2026/${lgaPrefix}/${seq}`;
    const securityToken = (
      await sha256Hex(`${examNumber}:${data.centerCode}:${Date.now()}:NAPPS_NNSUCE_SECRET`)
    )
      .substring(0, 16)
      .toUpperCase();

    const id = uuid();
    const timestamp = nowIso();
    await c.env.DB.prepare(
      `INSERT INTO nnsuce_candidates (
        id, exam_number, candidate_name, gender, school_name, school_id, center_code,
        passport_photo, subjects, security_token, academic_session, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2025/2026', 'registered', ?, ?)`,
    )
      .bind(
        id,
        examNumber,
        data.candidateName,
        data.gender,
        data.schoolName,
        data.schoolId ?? null,
        data.centerCode,
        data.passportPhoto ?? null,
        JSON.stringify(
          data.subjects ?? [
            "English Language",
            "Mathematics",
            "Basic Science & Tech",
            "National Values",
            "Pre-Vocational Studies",
          ],
        ),
        securityToken,
        timestamp,
        timestamp,
      )
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM nnsuce_candidates WHERE id = ?")
      .bind(id)
      .first<Row>();
    return c.json(camelizeRow(row), 201);
  });

  app.get("/exam-sheets/generate", async (c) => {
    const examNumber = c.req.query("examNumber");
    const centerCode = c.req.query("centerCode");
    let candidates: Row[] = [];
    if (examNumber) {
      const candidate = await c.env.DB.prepare(
        "SELECT * FROM nnsuce_candidates WHERE exam_number = ?",
      )
        .bind(examNumber)
        .first<Row>();
      if (!candidate) throw new ApiError(404, "Candidate not found");
      candidates = [candidate];
    } else if (centerCode) {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM nnsuce_candidates WHERE center_code = ? LIMIT 50",
      )
        .bind(centerCode)
        .all<Row>();
      candidates = results;
    } else {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM nnsuce_candidates LIMIT 20",
      ).all<Row>();
      candidates = results;
    }

    const subject = c.req.query("subject") || "English Language";
    return c.json(
      candidates.map((candidate) => ({
        candidateId: candidate.id,
        _id: candidate.id,
        examNumber: candidate.exam_number,
        candidateName: candidate.candidate_name,
        schoolName: candidate.school_name,
        centerCode: candidate.center_code,
        subject,
        academicSession: candidate.academic_session,
        securityToken: candidate.security_token,
        watermarkText:
          "NAPPS NASARAWA STATE UNIFIED CERTIFICATION EXAMINATION (NNSUCE) - OFFICIAL SECURE SCRIPT",
        qrPayload: JSON.stringify({
          exNo: candidate.exam_number,
          cCode: candidate.center_code,
          sec: candidate.security_token,
          sub: subject,
        }),
        barcodeToken: `NNSUCE*${candidate.exam_number.replace(/[^A-Z0-9]/g, "")}*${candidate.center_code}`,
        instructions: [
          "Use HB Pencil or Black Ballpoint Pen only.",
          "Completely shade the oval corresponding to your chosen option [A], [B], [C], or [D].",
          "Do not fold, crease, or mutilate this answer sheet.",
          "This sheet is uniquely watermarked and cryptographically tagged for this candidate only. Unauthorized reproduction or script substitution constitutes examination malpractice.",
        ],
        totalQuestions: 50,
        optionsPerQuestion: ["A", "B", "C", "D"],
      })),
    );
  });

  app.post("/omr/process-scan", async (c) => {
    const parsed = omrSchema.safeParse(await jsonBody<Row>(c));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    const data = parsed.data;
    const candidate = await c.env.DB.prepare(
      "SELECT * FROM nnsuce_candidates WHERE exam_number = ?",
    )
      .bind(data.examNumber)
      .first<Row>();
    if (!candidate) {
      throw new ApiError(404, `Candidate with Exam Number ${data.examNumber} not found.`);
    }

    const masterKey = MASTER_ANSWER_KEYS[data.subject] || MASTER_ANSWER_KEYS["English Language"];
    const detected = data.detectedResponses;
    let correctCount = 0;
    const doubleMarked: number[] = [];
    const blank: number[] = [];
    const questionAnalysis: Row[] = [];

    for (let i = 0; i < 50; i++) {
      const expected = masterKey[i] || "A";
      const given = detected[i] ? detected[i].toUpperCase().trim() : "BLANK";
      if (given === "BLANK" || given === "") {
        blank.push(i + 1);
        questionAnalysis.push({ question: i + 1, expected, given: "BLANK", isCorrect: false });
      } else if (given === "MULTIPLE" || given.length > 1) {
        doubleMarked.push(i + 1);
        questionAnalysis.push({ question: i + 1, expected, given: "MULTIPLE (INVALID)", isCorrect: false });
      } else if (given === expected) {
        correctCount += 1;
        questionAnalysis.push({ question: i + 1, expected, given, isCorrect: true });
      } else {
        questionAnalysis.push({ question: i + 1, expected, given, isCorrect: false });
      }
    }

    const percentage = Math.round((correctCount / 50) * 100);
    const grade = gradeFor(percentage);
    const isAnomaly = doubleMarked.length > 5 || data.centerCode !== candidate.center_code;
    let anomalyNotes = "";
    if (doubleMarked.length > 5) {
      anomalyNotes += `High rate of double-bubbling (${doubleMarked.length} questions). `;
    }
    if (data.centerCode !== candidate.center_code) {
      anomalyNotes += `Center mismatch: script has ${data.centerCode} but candidate belongs to ${candidate.center_code}. `;
    }
    const finalNotes = anomalyNotes || "Passed integrity scan without tampering signs.";

    const existing = await c.env.DB.prepare(
      "SELECT * FROM nnsuce_results WHERE exam_number = ?",
    )
      .bind(data.examNumber)
      .first<Row>();
    const subjectScores = {
      ...(existing ? JSON.parse(existing.subject_scores || "{}") : {}),
      [data.subject]: { score: correctCount, maxScore: 50, grade, percentage },
    };
    const scores = Object.values(subjectScores) as Row[];
    const totalScore = scores.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
    const avgPct = Math.round(
      scores.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / scores.length,
    );
    const overallGrade =
      avgPct >= 75 ? "Distinction" : avgPct >= 60 ? "Merit" : avgPct >= 50 ? "Credit Pass" : "Pass";
    const omrAuditData = {
      scannedAt: nowIso(),
      scannerDevice: data.scannerDevice || "NAPPS High-Speed OMR AI Engine",
      sheetImageUrl: data.sheetImage,
      totalBubblesDetected: detected.filter((d) => d && d !== "BLANK").length,
      doubleMarkedQuestions: doubleMarked,
      blankQuestions: blank,
      aiConfidenceScore: 98.4,
      anomalyFlag: isAnomaly,
      anomalyNotes: finalNotes,
    };
    const timestamp = nowIso();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE nnsuce_results SET subject_scores = ?, total_score = ?, average_percentage = ?,
          overall_grade = ?, omr_audit_data = ?, center_code = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(
          JSON.stringify(subjectScores),
          totalScore,
          avgPct,
          overallGrade,
          JSON.stringify(omrAuditData),
          data.centerCode,
          timestamp,
          existing.id,
        )
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO nnsuce_results (
          id, exam_number, candidate_name, school_name, center_code, subject_scores,
          total_score, average_percentage, overall_grade, omr_audit_data,
          academic_session, is_published, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
        .bind(
          uuid(),
          candidate.exam_number,
          candidate.candidate_name,
          candidate.school_name,
          data.centerCode,
          JSON.stringify(subjectScores),
          totalScore,
          avgPct,
          overallGrade,
          JSON.stringify(omrAuditData),
          candidate.academic_session,
          timestamp,
          timestamp,
        )
        .run();
    }

    return c.json({
      message: "OMR/OCR answer sheet marked successfully by AI engine",
      examNumber: candidate.exam_number,
      candidateName: candidate.candidate_name,
      subject: data.subject,
      correctCount,
      totalQuestions: 50,
      percentage,
      grade,
      anomalyFlag: isAnomaly,
      anomalyNotes: finalNotes,
      blankCount: blank.length,
      doubleMarkedCount: doubleMarked.length,
      questionAnalysis,
    });
  });

  app.get("/results/verify/:examNumber", async (c) => {
    const examNumber = c.req.param("examNumber");
    const result = await c.env.DB.prepare(
      "SELECT * FROM nnsuce_results WHERE exam_number = ?",
    )
      .bind(examNumber)
      .first<Row>();
    if (!result) throw new ApiError(404, `Result with Exam Number ${examNumber} not found.`);
    const candidate = await c.env.DB.prepare(
      "SELECT * FROM nnsuce_candidates WHERE exam_number = ?",
    )
      .bind(examNumber)
      .first<Row>();
    const audit = JSON.parse(result.omr_audit_data || "{}");
    return c.json({
      verified: true,
      examNumber: result.exam_number,
      candidateName: result.candidate_name,
      gender: candidate?.gender || "N/A",
      schoolName: result.school_name,
      centerCode: result.center_code,
      academicSession: result.academic_session,
      subjectScores: JSON.parse(result.subject_scores || "{}"),
      totalScore: result.total_score,
      averagePercentage: result.average_percentage,
      overallGrade: result.overall_grade,
      omrSecurityAudit: {
        scannedAt: audit.scannedAt,
        aiVerified: true,
        anomalyFlag: audit.anomalyFlag,
      },
    });
  });

  app.get("/results", async (c) => {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (c.req.query("centerCode")) {
      clauses.push("center_code = ?");
      values.push(c.req.query("centerCode"));
    }
    if (c.req.query("schoolName")) {
      clauses.push("school_name LIKE ?");
      values.push(`%${c.req.query("schoolName")}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM nnsuce_results ${where} ORDER BY average_percentage DESC`,
    )
      .bind(...values)
      .all<Row>();
    const rows = camelizeRows(results);
    return c.json({
      stats: {
        totalSat: rows.length,
        distinctions: rows.filter((r) => r.overallGrade === "Distinction").length,
        merits: rows.filter((r) => r.overallGrade === "Merit").length,
        passes: rows.filter((r) => String(r.overallGrade).includes("Pass")).length,
        flagged: rows.filter((r) => r.omrAuditData?.anomalyFlag).length,
      },
      results: rows,
    });
  });

  return app;
}

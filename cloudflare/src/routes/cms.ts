import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { requireRoles } from "../lib/auth.ts";
import { ApiError, camelizeRow, camelizeRows, jsonBody, nowIso, uuid } from "../lib/http.ts";

type DB = AppEnv["Bindings"]["DB"];
import { sendEmail } from "../lib/email.ts";
import {
  deleteRow,
  getRow,
  insertRow,
  pageParams,
  updateRow,
  type FieldMap,
  type Row,
} from "../lib/rows.ts";

const contentFields: FieldMap = {
  contentKey: "content_key",
  contentType: "content_type",
  title: "title",
  subtitle: "subtitle",
  content: "content",
  description: "description",
  imageUrl: "image_url",
  imagePublicId: "image_public_id",
  galleryUrls: "gallery_urls",
  galleryPublicIds: "gallery_public_ids",
  isActive: "is_active",
  sortOrder: "sort_order",
  metadata: "metadata",
};

const teamFields: FieldMap = {
  firstName: "first_name",
  lastName: "last_name",
  position: "position",
  department: "department",
  bio: "bio",
  email: "email",
  phone: "phone",
  linkedinUrl: "linkedin_url",
  twitterUrl: "twitter_url",
  profileImageUrl: "profile_image_url",
  profileImagePublicId: "profile_image_public_id",
  category: "category",
  role: "role",
  isActive: "is_active",
  sortOrder: "sort_order",
  joinedDate: "joined_date",
  achievements: "achievements",
  qualifications: "qualifications",
  yearsOfExperience: "years_of_experience",
  specialization: "specialization",
  isFeatured: "is_featured",
  metadata: "metadata",
};

const contentJson = new Set(["content", "galleryUrls", "galleryPublicIds", "metadata"]);
const teamJson = new Set(["achievements", "qualifications", "metadata"]);
const contentBool = new Set(["isActive"]);
const teamBool = new Set(["isActive", "isFeatured"]);

const admin = requireRoles("admin", "super_admin");

function camel(row: Row | null) {
  return camelizeRow(row);
}

async function findContentByKey(db: DB, key: string) {
  return db.prepare("SELECT * FROM homepage_content WHERE content_key = ?").bind(key).first<Row>();
}

async function listContent(db: DB, c: any) {
  const { page, limit, offset } = pageParams(c);
  const clauses: string[] = [];
  const params: unknown[] = [];
  const contentType = c.req.query("contentType");
  const isActive = c.req.query("isActive");
  if (contentType) {
    clauses.push("content_type = ?");
    params.push(contentType);
  }
  if (isActive !== undefined) {
    clauses.push("is_active = ?");
    params.push(isActive === "true" || isActive === "1" ? 1 : 0);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM homepage_content ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `SELECT * FROM homepage_content ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all<Row>();
  const total = count?.total ?? 0;
  return {
    data: camelizeRows(rows.results),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

async function listTeam(db: DB, c: any, forceActive = false) {
  const { page, limit, offset } = pageParams(c);
  const clauses: string[] = [];
  const params: unknown[] = [];
  const category = c.req.query("category");
  const role = c.req.query("role");
  const isActive = c.req.query("isActive");
  const isFeatured = c.req.query("isFeatured");
  if (category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (role) {
    clauses.push("role = ?");
    params.push(role);
  }
  if (forceActive) {
    clauses.push("is_active = 1");
  } else if (isActive !== undefined) {
    clauses.push("is_active = ?");
    params.push(isActive === "true" || isActive === "1" ? 1 : 0);
  }
  if (isFeatured !== undefined) {
    clauses.push("is_featured = ?");
    params.push(isFeatured === "true" || isFeatured === "1" ? 1 : 0);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM team_members ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `SELECT * FROM team_members ${where} ORDER BY sort_order ASC, last_name ASC, first_name ASC LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all<Row>();
  const total = count?.total ?? 0;
  return {
    data: camelizeRows(rows.results),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

function extensionOf(name: string, type: string) {
  const fromName = name.includes(".") ? name.split(".").pop()! : "";
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function storeUpload(c: any, file: File, prefix: string) {
  if (!file) throw new ApiError(400, "No file uploaded");
  if (!file.type.startsWith("image/")) throw new ApiError(400, "Only image files are allowed");
  if (!c.env.BUCKET) throw new ApiError(503, "File storage (R2) is not configured");
  const key = `${prefix}/${Date.now()}-${uuid()}.${extensionOf(file.name || "", file.type)}`;
  await c.env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  const origin = new URL(c.req.url).origin;
  return {
    url: `${origin}/api/v1/uploads/${key}`,
    publicId: key,
    format: file.type,
    size: file.size,
  };
}

export function cmsRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/homepage", async (c) => {
    const db = c.env.DB;
    const [hero, elder, featured, about, gallery] = await Promise.all([
      db
        .prepare("SELECT * FROM homepage_content WHERE content_key = 'hero_section' AND is_active = 1")
        .first<Row>(),
      db
        .prepare("SELECT * FROM team_members WHERE role = 'elder' AND is_active = 1 LIMIT 1")
        .first<Row>(),
      db
        .prepare(
          "SELECT * FROM team_members WHERE is_active = 1 AND is_featured = 1 ORDER BY sort_order ASC, last_name ASC LIMIT 6",
        )
        .all<Row>(),
      db
        .prepare("SELECT * FROM homepage_content WHERE content_key = 'about_section' AND is_active = 1")
        .first<Row>(),
      db
        .prepare(
          "SELECT * FROM homepage_content WHERE content_type = 'gallery' AND is_active = 1 ORDER BY sort_order ASC LIMIT 10",
        )
        .all<Row>(),
    ]);
    return c.json({
      heroSection: camel(hero),
      elderOmaku: camel(elder),
      featuredTeamMembers: camelizeRows(featured.results),
      aboutSection: camel(about),
      gallery: camelizeRows(gallery.results),
    });
  });

  app.get("/team/featured", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM team_members WHERE is_active = 1 AND is_featured = 1 ORDER BY sort_order ASC, last_name ASC LIMIT 6",
    ).all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/team/leadership", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM team_members
       WHERE is_active = 1 AND category IN ('executive', 'board', 'leadership')
       ORDER BY category ASC, sort_order ASC, last_name ASC`,
    ).all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/elder-omaku", async (c) => {
    const row = await c.env.DB.prepare(
      "SELECT * FROM team_members WHERE is_active = 1 AND role = 'elder' LIMIT 1",
    ).first<Row>();
    return c.json(camel(row));
  });

  app.get("/content/:contentKey", async (c) => {
    const row = await findContentByKey(c.env.DB, c.req.param("contentKey"));
    if (!row) {
      throw new ApiError(404, `Homepage content with key '${c.req.param("contentKey")}' not found`);
    }
    return c.json(camel(row));
  });

  app.get("/team/public", async (c) => c.json(await listTeam(c.env.DB, c, true)));

  app.get("/health", (c) =>
    c.json({
      status: "healthy",
      timestamp: nowIso(),
      version: "1.0.0",
      service: "cms",
    }),
  );

  app.post("/admin/content", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    if (!body.contentKey) throw new ApiError(400, "contentKey is required");
    const existing = await findContentByKey(c.env.DB, body.contentKey);
    if (existing) throw new ApiError(400, `Content with key '${body.contentKey}' already exists`);
    const row = await insertRow(c.env.DB, "homepage_content", body, contentFields, {
      json: contentJson,
      bool: contentBool,
    });
    return c.json(camel(row), 201);
  });

  app.get("/admin/content", admin, async (c) => c.json(await listContent(c.env.DB, c)));

  app.get("/admin/content/:id", admin, async (c) => {
    const row = await findContentByKey(c.env.DB, c.req.param("id"));
    if (!row) {
      throw new ApiError(404, `Homepage content with key '${c.req.param("id")}' not found`);
    }
    return c.json(camel(row));
  });

  app.put("/admin/content/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await updateRow(c.env.DB, "homepage_content", c.req.param("id"), body, contentFields, {
      json: contentJson,
      bool: contentBool,
    });
    if (!row) throw new ApiError(404, `Homepage content with ID ${c.req.param("id")} not found`);
    return c.json(camel(row));
  });

  app.delete("/admin/content/:id", admin, async (c) => {
    const removed = await deleteRow(c.env.DB, "homepage_content", c.req.param("id"));
    if (!removed) throw new ApiError(404, `Homepage content with ID ${c.req.param("id")} not found`);
    return c.json({ success: true });
  });

  app.post("/admin/team", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await insertRow(c.env.DB, "team_members", body, teamFields, {
      json: teamJson,
      bool: teamBool,
    });
    return c.json(camel(row), 201);
  });

  app.get("/admin/team", admin, async (c) => c.json(await listTeam(c.env.DB, c)));

  app.get("/admin/team/:id", admin, async (c) => {
    const row = await getRow(c.env.DB, "team_members", c.req.param("id"));
    if (!row) throw new ApiError(404, `Team member with ID ${c.req.param("id")} not found`);
    return c.json(camel(row));
  });

  app.put("/admin/team/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await updateRow(c.env.DB, "team_members", c.req.param("id"), body, teamFields, {
      json: teamJson,
      bool: teamBool,
    });
    if (!row) throw new ApiError(404, `Team member with ID ${c.req.param("id")} not found`);
    return c.json(camel(row));
  });

  app.delete("/admin/team/:id", admin, async (c) => {
    const removed = await deleteRow(c.env.DB, "team_members", c.req.param("id"));
    if (!removed) throw new ApiError(404, `Team member with ID ${c.req.param("id")} not found`);
    return c.json({ success: true });
  });

  app.post("/admin/upload/homepage-image/:contentKey/:imageType", admin, async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") throw new ApiError(400, "No file uploaded");
    const contentKey = c.req.param("contentKey");
    const imageType = c.req.param("imageType");
    const result = await storeUpload(c, file as any, `cms/homepage/${imageType}`);
    const existing = await findContentByKey(c.env.DB, contentKey);
    if (existing) {
      await c.env.DB.prepare(
        "UPDATE homepage_content SET image_url = ?, image_public_id = ?, updated_at = ? WHERE content_key = ?",
      )
        .bind(result.url, result.publicId, nowIso(), contentKey)
        .run();
    }
    return c.json(result, 201);
  });

  app.post("/admin/upload/team-photo/:memberId", admin, async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") throw new ApiError(400, "No file uploaded");
    const memberId = c.req.param("memberId");
    const existing = await getRow(c.env.DB, "team_members", memberId);
    if (!existing) throw new ApiError(404, `Team member with ID ${memberId} not found`);
    if (existing.profile_image_public_id && c.env.BUCKET) {
      await c.env.BUCKET.delete(String(existing.profile_image_public_id));
    }
    const result = await storeUpload(c, file, "cms/team");
    await c.env.DB.prepare(
      "UPDATE team_members SET profile_image_url = ?, profile_image_public_id = ?, updated_at = ? WHERE id = ?",
    )
      .bind(result.url, result.publicId, nowIso(), memberId)
      .run();
    return c.json(result, 201);
  });

  app.post("/admin/send-newsletter", admin, async (c) => {
    const body = await jsonBody<{ recipients?: string[]; title?: string; content?: string; featuredImage?: string }>(c);
    const recipients = body.recipients || [];
    let sent = 0;
    let failed = 0;
    for (const to of recipients) {
      try {
        await sendEmail(c.env, {
          to,
          subject: body.title || "NAPPS Nasarawa Newsletter",
          html: `<h2>${body.title || "NAPPS Nasarawa Newsletter"}</h2>${
            body.featuredImage ? `<img src="${body.featuredImage}" style="max-width:100%" />` : ""
          }<div>${body.content || ""}</div>`,
        });
        sent++;
      } catch {
        failed++;
      }
    }
    return c.json({ sent, failed });
  });

  app.post("/admin/send-event-notification", admin, async (c) => {
    const body = await jsonBody<{
      recipients?: string[];
      eventName?: string;
      eventDate?: string;
      eventLocation?: string;
      description?: string;
      registrationLink?: string;
    }>(c);
    const recipients = body.recipients || [];
    let sent = 0;
    let failed = 0;
    for (const to of recipients) {
      try {
        await sendEmail(c.env, {
          to,
          subject: body.eventName || "NAPPS Nasarawa Event",
          html: `<h2>${body.eventName || "Event"}</h2>
            <p><strong>Date:</strong> ${body.eventDate || ""}</p>
            <p><strong>Location:</strong> ${body.eventLocation || ""}</p>
            <p>${body.description || ""}</p>
            ${body.registrationLink ? `<p><a href="${body.registrationLink}">Register</a></p>` : ""}`,
        });
        sent++;
      } catch {
        failed++;
      }
    }
    return c.json({ sent, failed });
  });

  app.patch("/admin/team/reorder", admin, async (c) => {
    const updates = await jsonBody<Array<{ id: string; sortOrder: number }>>(c);
    for (const item of updates) {
      await c.env.DB.prepare("UPDATE team_members SET sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(item.sortOrder, nowIso(), item.id)
        .run();
    }
    return c.json({ success: true });
  });

  app.patch("/admin/content/reorder", admin, async (c) => {
    const updates = await jsonBody<Array<{ id: string; sortOrder: number }>>(c);
    for (const item of updates) {
      await c.env.DB.prepare(
        "UPDATE homepage_content SET sort_order = ?, updated_at = ? WHERE id = ?",
      )
        .bind(item.sortOrder, nowIso(), item.id)
        .run();
    }
    return c.json({ success: true });
  });

  app.get("/admin/analytics", admin, async (c) => {
    const db = c.env.DB;
    const count = async (sql: string, ...params: unknown[]) => {
      const row = await db.prepare(sql).bind(...params).first<{ total: number }>();
      return row?.total ?? 0;
    };
    const [totalContent, totalTeamMembers, featuredMembers, activeContent] = await Promise.all([
      count("SELECT COUNT(*) AS total FROM homepage_content"),
      count("SELECT COUNT(*) AS total FROM team_members"),
      count("SELECT COUNT(*) AS total FROM team_members WHERE is_featured = 1"),
      count("SELECT COUNT(*) AS total FROM homepage_content WHERE is_active = 1"),
    ]);
    const byType = await db
      .prepare("SELECT content_type AS key, COUNT(*) AS total FROM homepage_content GROUP BY content_type")
      .all<{ key: string; total: number }>();
    const byCategory = await db
      .prepare("SELECT category AS key, COUNT(*) AS total FROM team_members GROUP BY category")
      .all<{ key: string; total: number }>();
    return c.json({
      totalContent,
      totalTeamMembers,
      featuredMembers,
      activeContent,
      contentByType: Object.fromEntries(byType.results.map((r) => [r.key, r.total])),
      membersByCategory: Object.fromEntries(byCategory.results.map((r) => [r.key, r.total])),
    });
  });

  return app;
}

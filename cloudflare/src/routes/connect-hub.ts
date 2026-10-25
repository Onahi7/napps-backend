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
  toColumns,
  updateRow,
  type FieldMap,
  type Row,
} from "../lib/rows.ts";

const heroFields: FieldMap = {
  title: "title",
  description: "description",
  imageUrl: "image_url",
  displayOrder: "display_order",
  isActive: "is_active",
  buttonText: "button_text",
  buttonLink: "button_link",
};

const memberFields: FieldMap = {
  name: "name",
  position: "position",
  bio: "bio",
  imageUrl: "image_url",
  displayOrder: "display_order",
  isActive: "is_active",
  email: "email",
  phone: "phone",
  socialMedia: "social_media",
};

const announcementFields: FieldMap = {
  title: "title",
  message: "message",
  type: "type",
  isActive: "is_active",
  showOnAllPages: "show_on_all_pages",
  showOnPortal: "show_on_portal",
  backgroundColor: "background_color",
  textColor: "text_color",
  startDate: "start_date",
  endDate: "end_date",
  displayOrder: "display_order",
  appScope: "app_scope",
};

const settingFields: FieldMap = {
  settingKey: "setting_key",
  settingValue: "setting_value",
  settingType: "setting_type",
  description: "description",
  isPublic: "is_public",
};

const contentFields: FieldMap = {
  pageName: "page_name",
  sectionName: "section_name",
  contentType: "content_type",
  content: "content",
  isActive: "is_active",
  displayOrder: "display_order",
};

const jsonSets = {
  member: new Set(["socialMedia"]),
};
const boolSets = {
  hero: new Set(["isActive"]),
  member: new Set(["isActive"]),
  announcement: new Set(["isActive", "showOnAllPages", "showOnPortal"]),
  setting: new Set(["isPublic"]),
  content: new Set(["isActive"]),
};

const admin = requireRoles("admin", "super_admin");

function withId(row: Row | null) {
  const out = camelizeRow(row);
  return out;
}

async function listAdmin(
  db: DB,
  table: string,
  c: any,
  searchColumns: string[],
  extraWhere: string[] = [],
  extraParams: unknown[] = [],
) {
  const { page, limit, offset } = pageParams(c);
  const clauses: string[] = [...extraWhere];
  const params: unknown[] = [...extraParams];
  const search = c.req.query("search");
  if (search) {
    clauses.push(`(${searchColumns.map((col) => `${col} LIKE ?`).join(" OR ")})`);
    for (let i = 0; i < searchColumns.length; i++) params.push(`%${search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM ${table} ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `SELECT * FROM ${table} ${where} ORDER BY display_order ASC, created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all<Row>();
  const total = count?.total ?? 0;
  return { data: camelizeRows(rows.results), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function connectHubRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/hero-images", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM hero_images WHERE is_active = 1 ORDER BY display_order ASC",
    ).all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/members", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM members WHERE is_active = 1 ORDER BY display_order ASC",
    ).all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/announcements", async (c) => {
    const now = nowIso();
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM announcements
       WHERE is_active = 1
         AND (start_date IS NULL OR start_date = '' OR start_date <= ?)
         AND (end_date IS NULL OR end_date = '' OR end_date >= ?)
       ORDER BY display_order ASC`,
    )
      .bind(now, now)
      .all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/settings", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM site_settings WHERE is_public = 1 ORDER BY setting_key ASC",
    ).all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/content/:pageName", async (c) => {
    const pageName = c.req.param("pageName");
    const section = c.req.query("section");
    const params: unknown[] = [pageName];
    let sql = "SELECT * FROM page_content WHERE page_name = ? AND is_active = 1";
    if (section) {
      sql += " AND section_name = ?";
      params.push(section);
    }
    sql += " ORDER BY display_order ASC";
    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Row>();
    return c.json(camelizeRows(results));
  });

  app.get("/health", (c) =>
    c.json({
      status: "healthy",
      timestamp: nowIso(),
      version: "1.0.0",
      service: "connect-hub",
    }),
  );

  app.get("/admin/hero-images", admin, async (c) => {
    const isActive = c.req.query("isActive");
    const where: string[] = [];
    const params: unknown[] = [];
    if (isActive !== undefined) {
      where.push("is_active = ?");
      params.push(isActive === "true" || isActive === "1" ? 1 : 0);
    }
    return c.json(await listAdmin(c.env.DB, "hero_images", c, ["title", "description"], where, params));
  });

  app.get("/admin/hero-images/:id", admin, async (c) => {
    const row = await getRow(c.env.DB, "hero_images", c.req.param("id"));
    if (!row) throw new ApiError(404, "Hero image not found");
    return c.json(withId(row));
  });

  app.post("/admin/hero-images", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await insertRow(c.env.DB, "hero_images", body, heroFields, { bool: boolSets.hero });
    return c.json(withId(row), 201);
  });

  app.put("/admin/hero-images/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await updateRow(c.env.DB, "hero_images", c.req.param("id"), body, heroFields, {
      bool: boolSets.hero,
    });
    if (!row) throw new ApiError(404, "Hero image not found");
    return c.json(withId(row));
  });

  app.delete("/admin/hero-images/:id", admin, async (c) => {
    const removed = await deleteRow(c.env.DB, "hero_images", c.req.param("id"));
    if (!removed) throw new ApiError(404, "Hero image not found");
    return c.json({ message: "Hero image deleted successfully" });
  });

  app.get("/admin/members", admin, async (c) => {
    const isActive = c.req.query("isActive");
    const where: string[] = [];
    const params: unknown[] = [];
    if (isActive !== undefined) {
      where.push("is_active = ?");
      params.push(isActive === "true" || isActive === "1" ? 1 : 0);
    }
    return c.json(
      await listAdmin(c.env.DB, "members", c, ["name", "position", "bio"], where, params),
    );
  });

  app.get("/admin/members/:id", admin, async (c) => {
    const row = await getRow(c.env.DB, "members", c.req.param("id"));
    if (!row) throw new ApiError(404, "Member not found");
    return c.json(withId(row));
  });

  app.post("/admin/members", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await insertRow(c.env.DB, "members", body, memberFields, {
      json: jsonSets.member,
      bool: boolSets.member,
    });
    return c.json(withId(row), 201);
  });

  app.put("/admin/members/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await updateRow(c.env.DB, "members", c.req.param("id"), body, memberFields, {
      json: jsonSets.member,
      bool: boolSets.member,
    });
    if (!row) throw new ApiError(404, "Member not found");
    return c.json(withId(row));
  });

  app.delete("/admin/members/:id", admin, async (c) => {
    const removed = await deleteRow(c.env.DB, "members", c.req.param("id"));
    if (!removed) throw new ApiError(404, "Member not found");
    return c.json({ message: "Member deleted successfully" });
  });

  app.get("/admin/announcements", admin, async (c) => {
    const isActive = c.req.query("isActive");
    const where: string[] = [];
    const params: unknown[] = [];
    if (isActive !== undefined) {
      where.push("is_active = ?");
      params.push(isActive === "true" || isActive === "1" ? 1 : 0);
    }
    return c.json(
      await listAdmin(c.env.DB, "announcements", c, ["title", "message"], where, params),
    );
  });

  app.get("/admin/announcements/:id", admin, async (c) => {
    const row = await getRow(c.env.DB, "announcements", c.req.param("id"));
    if (!row) throw new ApiError(404, "Announcement not found");
    return c.json(withId(row));
  });

  app.post("/admin/announcements", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await insertRow(c.env.DB, "announcements", body, announcementFields, {
      bool: boolSets.announcement,
    });
    return c.json(withId(row), 201);
  });

  app.put("/admin/announcements/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await updateRow(
      c.env.DB,
      "announcements",
      c.req.param("id"),
      body,
      announcementFields,
      { bool: boolSets.announcement },
    );
    if (!row) throw new ApiError(404, "Announcement not found");
    return c.json(withId(row));
  });

  app.delete("/admin/announcements/:id", admin, async (c) => {
    const removed = await deleteRow(c.env.DB, "announcements", c.req.param("id"));
    if (!removed) throw new ApiError(404, "Announcement not found");
    return c.json({ message: "Announcement deleted successfully" });
  });

  app.get("/admin/settings", admin, async (c) => {
    const { page, limit, offset } = pageParams(c);
    const search = c.req.query("search");
    const where = search ? "WHERE setting_key LIKE ? OR description LIKE ?" : "";
    const params = search ? [`%${search}%`, `%${search}%`] : [];
    const count = await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM site_settings ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const rows = await c.env.DB.prepare(
      `SELECT * FROM site_settings ${where} ORDER BY setting_key ASC LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all<Row>();
    const total = count?.total ?? 0;
    return c.json({
      data: camelizeRows(rows.results),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });

  app.get("/admin/settings/:key", admin, async (c) => {
    const row = await c.env.DB.prepare("SELECT * FROM site_settings WHERE setting_key = ?")
      .bind(c.req.param("key"))
      .first<Row>();
    if (!row) throw new ApiError(404, "Site setting not found");
    return c.json(withId(row));
  });

  app.post("/admin/settings", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    if (!body.settingKey) throw new ApiError(400, "settingKey is required");
    const existing = await c.env.DB.prepare(
      "SELECT id FROM site_settings WHERE setting_key = ?",
    )
      .bind(body.settingKey)
      .first<Row>();
    if (existing) throw new ApiError(400, `Setting '${body.settingKey}' already exists`);
    const row = await insertRow(c.env.DB, "site_settings", body, settingFields, {
      bool: boolSets.setting,
    });
    return c.json(withId(row), 201);
  });

  app.put("/admin/settings/:key", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const existing = await c.env.DB.prepare("SELECT id FROM site_settings WHERE setting_key = ?")
      .bind(c.req.param("key"))
      .first<Row>();
    if (!existing) throw new ApiError(404, "Site setting not found");
    const row = await updateRow(
      c.env.DB,
      "site_settings",
      String(existing.id),
      body,
      settingFields,
      { bool: boolSets.setting },
    );
    return c.json(withId(row));
  });

  app.delete("/admin/settings/:key", admin, async (c) => {
    const existing = await c.env.DB.prepare("SELECT id FROM site_settings WHERE setting_key = ?")
      .bind(c.req.param("key"))
      .first<Row>();
    if (!existing) throw new ApiError(404, "Site setting not found");
    await deleteRow(c.env.DB, "site_settings", String(existing.id));
    return c.json({ message: "Site setting deleted successfully" });
  });

  app.get("/admin/content", admin, async (c) => {
    const isActive = c.req.query("isActive");
    const where: string[] = [];
    const params: unknown[] = [];
    if (isActive !== undefined) {
      where.push("is_active = ?");
      params.push(isActive === "true" || isActive === "1" ? 1 : 0);
    }
    return c.json(
      await listAdmin(
        c.env.DB,
        "page_content",
        c,
        ["page_name", "section_name", "content"],
        where,
        params,
      ),
    );
  });

  app.get("/admin/content/:id", admin, async (c) => {
    const row = await getRow(c.env.DB, "page_content", c.req.param("id"));
    if (!row) throw new ApiError(404, "Page content not found");
    return c.json(withId(row));
  });

  app.post("/admin/content", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await insertRow(c.env.DB, "page_content", body, contentFields, {
      bool: boolSets.content,
    });
    return c.json(withId(row), 201);
  });

  app.put("/admin/content/:id", admin, async (c) => {
    const body = await jsonBody<Row>(c);
    const row = await updateRow(c.env.DB, "page_content", c.req.param("id"), body, contentFields, {
      bool: boolSets.content,
    });
    if (!row) throw new ApiError(404, "Page content not found");
    return c.json(withId(row));
  });

  app.delete("/admin/content/:id", admin, async (c) => {
    const removed = await deleteRow(c.env.DB, "page_content", c.req.param("id"));
    if (!removed) throw new ApiError(404, "Page content not found");
    return c.json({ message: "Page content deleted successfully" });
  });

  app.get("/admin/analytics", admin, async (c) => {
    const counts = async (table: string, extra = "") => {
      const row = await c.env.DB.prepare(
        `SELECT COUNT(*) AS total FROM ${table} ${extra}`,
      ).first<{ total: number }>();
      return row?.total ?? 0;
    };
    const [
      totalHeroImages,
      activeHeroImages,
      totalMembers,
      activeMembers,
      totalAnnouncements,
      activeAnnouncements,
      totalSettings,
      totalContent,
      activeContent,
    ] = await Promise.all([
      counts("hero_images"),
      counts("hero_images", "WHERE is_active = 1"),
      counts("members"),
      counts("members", "WHERE is_active = 1"),
      counts("announcements"),
      counts("announcements", "WHERE is_active = 1"),
      counts("site_settings"),
      counts("page_content"),
      counts("page_content", "WHERE is_active = 1"),
    ]);
    return c.json({
      heroImages: { total: totalHeroImages, active: activeHeroImages },
      members: { total: totalMembers, active: activeMembers },
      announcements: { total: totalAnnouncements, active: activeAnnouncements },
      settings: { total: totalSettings },
      content: { total: totalContent, active: activeContent },
    });
  });

  app.post("/admin/seed-data", admin, async (c) => {
    const db = c.env.DB;
    const now = nowIso();
    const heroCount = await db.prepare("SELECT COUNT(*) AS total FROM hero_images").first<{ total: number }>();
    if ((heroCount?.total ?? 0) === 0) {
      await db
        .prepare(
          `INSERT INTO hero_images (id, title, description, image_url, display_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .bind(
          uuid(),
          "Welcome to NAPPS Nasarawa Connect",
          "The official community platform for private school proprietors in Nasarawa State.",
          "",
          1,
          now,
          now,
        )
        .run();
    }
    const memberCount = await db.prepare("SELECT COUNT(*) AS total FROM members").first<{ total: number }>();
    if ((memberCount?.total ?? 0) === 0) {
      await db
        .prepare(
          `INSERT INTO members (id, name, position, bio, display_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .bind(
          uuid(),
          "NAPPS Nasarawa Executive",
          "State Executive Council",
          "Serving the interest of private school proprietors across Nasarawa State.",
          1,
          now,
          now,
        )
        .run();
    }
    const announcementCount = await db
      .prepare("SELECT COUNT(*) AS total FROM announcements")
      .first<{ total: number }>();
    if ((announcementCount?.total ?? 0) === 0) {
      await db
        .prepare(
          `INSERT INTO announcements (id, title, message, type, is_active, display_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        )
        .bind(
          uuid(),
          "Welcome to NAPPS Connect",
          "Stay tuned for updates from the Nasarawa State chapter.",
          "info",
          1,
          now,
          now,
        )
        .run();
    }
    const defaultSettings: Array<[string, string, string]> = [
      ["site_name", "NAPPS Nasarawa Connect", "string"],
      ["contact_email", "info@nappsnasarawa.com", "string"],
      ["contact_phone", "+234 800 000 0000", "string"],
    ];
    for (const [key, value, type] of defaultSettings) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO site_settings (id, setting_key, setting_value, setting_type, is_public, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)`,
        )
        .bind(uuid(), key, value, type, now, now)
        .run();
    }
    return c.json({ message: "Initial data seeded successfully" }, 201);
  });

  return app;
}

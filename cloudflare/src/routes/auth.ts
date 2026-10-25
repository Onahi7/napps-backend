import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env.ts";
import {
  buildUserPayload,
  hashPassword,
  requireAuth,
  requireRoles,
  signJwt,
  verifyPassword,
} from "../lib/auth.ts";
import { ApiError, camelizeRow, jsonBody, nowIso } from "../lib/http.ts";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
});

const needsReset = (hash: string | null | undefined) =>
  !hash || !hash.startsWith("pbkdf2$");

async function findUserByEmail(db: AppEnv["Bindings"]["DB"], email: string) {
  return db
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?)")
    .bind(email)
    .first<Record<string, any>>();
}

function publicUser(row: Record<string, any>) {
  const user = camelizeRow(row)!;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName:
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email,
    role: user.role,
    roles: user.roles,
    appAccess: user.appAccess ?? [],
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export const authRoutes = () =>
  new Hono<AppEnv>()
    .post("/admin/login", async (c) => {
      const body = loginSchema.parse(await jsonBody(c));
      const row = await findUserByEmail(c.env.DB, body.email);
      if (!row || !row.is_active) {
        throw new ApiError(401, "Invalid credentials");
      }
      const roles: string[] = row.roles ? JSON.parse(row.roles) : [row.role];
      const adminRoles = new Set(["admin", "super_admin"]);
      if (!adminRoles.has(row.role) && !roles.some((r) => adminRoles.has(r))) {
        throw new ApiError(401, "Invalid credentials");
      }
      if (needsReset(row.password)) {
        throw new ApiError(403, "Password reset required for this account", {
          code: "PASSWORD_RESET_REQUIRED",
        });
      }
      if (!(await verifyPassword(body.password, row.password))) {
        throw new ApiError(401, "Invalid credentials");
      }
      const updatedAt = nowIso();
      await c.env.DB.prepare(
        "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
      )
        .bind(updatedAt, updatedAt, row.id)
        .run();
      const accessToken = await signJwt(
        buildUserPayload({ id: row.id, email: row.email, role: row.role, roles }),
        c.env.JWT_SECRET,
      );
      return c.json({
        access_token: accessToken,
        accessToken,
        token_type: "Bearer",
        expires_in: 604800,
        user: publicUser({ ...row, last_login_at: updatedAt }),
      });
    })
    .post("/login", async (c) => {
      const body = loginSchema.parse(await jsonBody(c));
      const row = await findUserByEmail(c.env.DB, body.email);
      if (!row || !row.is_active) throw new ApiError(401, "Invalid credentials");
      if (needsReset(row.password)) {
        throw new ApiError(403, "Password reset required for this account", {
          code: "PASSWORD_RESET_REQUIRED",
        });
      }
      if (!(await verifyPassword(body.password, row.password))) {
        throw new ApiError(401, "Invalid credentials");
      }
      const roles: string[] = row.roles ? JSON.parse(row.roles) : [row.role];
      const updatedAt = nowIso();
      await c.env.DB.prepare(
        "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
      )
        .bind(updatedAt, updatedAt, row.id)
        .run();
      const accessToken = await signJwt(
        buildUserPayload({ id: row.id, email: row.email, role: row.role, roles }),
        c.env.JWT_SECRET,
      );
      return c.json({
        access_token: accessToken,
        accessToken,
        token_type: "Bearer",
        expires_in: 604800,
        user: publicUser({ ...row, last_login_at: updatedAt }),
      });
    })
    .post("/register", async (c) => {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string().min(6),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          name: z.string().optional(),
        })
        .parse(await jsonBody(c));
      const existing = await findUserByEmail(c.env.DB, body.email);
      if (existing) throw new ApiError(409, "User with this email already exists");
      const id = crypto.randomUUID();
      const timestamp = nowIso();
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, name, first_name, last_name, password, role, roles, app_access, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'user', '["user"]', '[]', 1, ?, ?)`,
      )
        .bind(
          id,
          body.email,
          body.name ?? [body.firstName, body.lastName].filter(Boolean).join(" "),
          body.firstName ?? null,
          body.lastName ?? null,
          await hashPassword(body.password),
          timestamp,
          timestamp,
        )
        .run();
      const accessToken = await signJwt(
        buildUserPayload({ id, email: body.email, role: "user", roles: ["user"] }),
        c.env.JWT_SECRET,
      );
      return c.json(
        { access_token: accessToken, accessToken, token_type: "Bearer", expires_in: 604800 },
        201,
      );
    })
    .get("/profile", requireAuth, async (c) => {
      const user = c.get("user")!;
      const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(user.userId)
        .first<Record<string, any>>();
      if (!row) throw new ApiError(404, "User not found");
      return c.json(publicUser(row));
    })
    .get("/me", requireAuth, async (c) => {
      const user = c.get("user")!;
      const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(user.userId)
        .first<Record<string, any>>();
      if (!row) throw new ApiError(404, "User not found");
      return c.json(publicUser(row));
    })
    .post("/change-password", requireAuth, async (c) => {
      const body = changePasswordSchema.parse(await jsonBody(c));
      const user = c.get("user")!;
      const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(user.userId)
        .first<Record<string, any>>();
      if (!row) throw new ApiError(404, "User not found");
      if (!(await verifyPassword(body.currentPassword, row.password))) {
        throw new ApiError(400, "Current password is incorrect");
      }
      await c.env.DB.prepare(
        "UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
      )
        .bind(await hashPassword(body.newPassword), nowIso(), row.id)
        .run();
      return c.json({ message: "Password changed successfully" });
    })
    .post("/admin/reset-password", requireRoles("admin", "super_admin"), async (c) => {
      const body = resetPasswordSchema.parse(await jsonBody(c));
      const row = await findUserByEmail(c.env.DB, body.email);
      if (!row) throw new ApiError(404, "User not found");
      await c.env.DB.prepare(
        "UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
      )
        .bind(await hashPassword(body.newPassword), nowIso(), row.id)
        .run();
      return c.json({ message: "Password reset successfully" });
    });

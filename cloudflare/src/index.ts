import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env.ts";
import { ApiError } from "./lib/http.ts";
import { authRoutes } from "./routes/auth.ts";
import { feesRoutes } from "./routes/fees.ts";
import { proprietorsRoutes } from "./routes/proprietors.ts";
import { paymentsRoutes } from "./routes/payments.ts";
import { levyPaymentsRoutes } from "./routes/levy-payments.ts";
import { nnsuceRoutes } from "./routes/nnsuce.ts";
import { connectHubRoutes } from "./routes/connect-hub.ts";
import { cmsRoutes } from "./routes/cms.ts";
import { schoolsRoutes } from "./routes/schools.ts";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://nappsnasarawa.com",
  "https://www.nappsnasarawa.com",
  "https://portal.nappsnasarawa.com",
  "https://connect.nappsnasarawa.com",
];

function isAllowedOrigin(origin: string, configured: string | undefined) {
  const extra = (configured ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set([...DEFAULT_ORIGINS, ...extra]);
  if (allowed.has(origin)) return true;
  return /^https:\/\/([a-z0-9-]+\.)*(vercel\.app|netlify\.app|lovable\.dev)$/i.test(
    origin,
  );
}

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const handler = cors({
    origin: (origin) =>
      origin && isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS) ? origin : null,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Accept"],
    maxAge: 86400,
  });
  return handler(c, next);
});

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json(
      { statusCode: error.status, message: error.message, details: error.details },
      error.status as any,
    );
  }
  const name = (error as { name?: string })?.name;
  if (name === "ZodError") {
    const issues = (error as any).issues ?? [];
    const message = issues
      .map((issue: any) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return c.json({ statusCode: 400, message: message || "Validation failed", issues }, 400);
  }
  console.error(error);
  return c.json(
    { statusCode: 500, message: "Internal server error" },
    500,
  );
});

app.notFound((c) =>
  c.json({ statusCode: 404, message: `Cannot ${c.req.method} ${c.req.path}` }, 404),
);

const api = new Hono<AppEnv>();

api.get("/", (c) => c.text("Hello World!"));
api.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

api.route("/auth", authRoutes());
api.route("/fees", feesRoutes());
api.route("/proprietors", proprietorsRoutes());
api.route("/payments", paymentsRoutes());
api.route("/levy-payments", levyPaymentsRoutes());
api.route("/nnsuce", nnsuceRoutes());
api.route("/connect-hub", connectHubRoutes());
api.route("/cms", cmsRoutes());
api.route("/schools", schoolsRoutes());

api.get("/uploads/*", async (c) => {
  if (!c.env.BUCKET) return c.json({ statusCode: 503, message: "File storage is not configured" }, 503);
  const key = c.req.path.replace(/^\/api\/v1\/uploads\//, "");
  if (!key) return c.json({ statusCode: 404, message: "Not found" }, 404);
  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ statusCode: 404, message: "Not found" }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
    },
  });
});

app.get("/api/v1", (c) => c.text("Hello World!"));
app.get("/api/v1/", (c) => c.text("Hello World!"));
app.route("/api/v1", api);

export default app;

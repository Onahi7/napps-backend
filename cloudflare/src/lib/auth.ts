import type { MiddlewareHandler } from "hono";
import type { AppEnv, AuthUser } from "../env.ts";
import { ApiError } from "./http.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const PBKDF2_ITERATIONS = 25000;
const JWT_TTL_SECONDS = 60 * 60 * 24 * 7;

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const keyCache = new Map<string, CryptoKey>();

async function hmacKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  keyCache.set(secret, key);
  return key;
}

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds = JWT_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = bytesToB64url(
    encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const body = bytesToB64url(
    encoder.encode(
      JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }),
    ),
  );
  const data = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(data),
  );
  return `${data}.${bytesToB64url(new Uint8Array(signature))}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<AuthUser> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError(401, "Invalid token");
  const [header, body, signature] = parts;
  const expected = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(`${header}.${body}`),
  );
  const expectedText = bytesToB64url(new Uint8Array(expected));
  if (expectedText !== signature) throw new ApiError(401, "Invalid token");

  let payload: any;
  try {
    payload = JSON.parse(decoder.decode(b64urlToBytes(body)));
  } catch {
    throw new ApiError(401, "Invalid token");
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    throw new ApiError(401, "Token expired");
  }
  return payload as AuthUser;
}

export function buildUserPayload(user: {
  id: string;
  email: string;
  role: string;
  roles?: string[];
}): Record<string, unknown> {
  return {
    sub: user.id,
    userId: user.id,
    email: user.email,
    role: user.role,
    roles: user.roles ?? [user.role],
  };
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64url(salt)}$${bytesToB64url(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts[0] !== "pbkdf2" || parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = b64urlToBytes(parts[2]);
  const expected = parts[3];
  const hash = await derive(password, salt, iterations);
  return bytesToB64url(hash) === expected;
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export function getBearer(c: { req: { header: (name: string) => string | undefined } }) {
  return bearerToken(c.req.header("authorization"));
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getBearer(c);
  if (!token) throw new ApiError(401, "Unauthorized");
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  c.set("user", user);
  await next();
};

export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getBearer(c);
  if (token) {
    try {
      c.set("user", await verifyJwt(token, c.env.JWT_SECRET));
    } catch {
      /* ignore invalid optional token */
    }
  }
  await next();
};

export function requireRoles(
  ...roles: string[]
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getBearer(c);
    if (!token) throw new ApiError(401, "Unauthorized");
    const user = await verifyJwt(token, c.env.JWT_SECRET);
    const userRoles = user.roles?.length ? user.roles : [user.role];
    const allowed = roles.some(
      (role) => userRoles.includes(role) || user.role === role,
    );
    if (!allowed) {
      throw new ApiError(403, "You do not have permission to access this resource");
    }
    c.set("user", user);
    await next();
  };
}

export const isAdminRole = (role: string | undefined) =>
  role === "admin" || role === "super_admin";

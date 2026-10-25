export interface D1Meta {
  changes: number;
  last_row_id: number;
  duration: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpEtag?: string; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

export type Bindings = {
  DB: D1Database;
  BUCKET?: R2Bucket;
  JWT_SECRET: string;
  FRONTEND_URL?: string;
  ALLOWED_ORIGINS?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

export type AuthUser = {
  sub: string;
  userId: string;
  email: string;
  role: string;
  roles: string[];
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    user?: AuthUser;
  };
};

import { DatabaseSync } from "node:sqlite";
import type { D1Database, D1PreparedStatement, D1Result } from "../src/env.ts";

class MemoryStatement implements D1PreparedStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private readonly params: unknown[];

  constructor(db: DatabaseSync, sql: string, params: unknown[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new MemoryStatement(this.db, this.sql, values);
  }

  private statement() {
    return this.db.prepare(this.sql);
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.statement().all(...(this.params as never[])) as T[];
    return {
      results,
      success: true,
      meta: { changes: 0, last_row_id: 0, duration: 0 },
    };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.statement().get(...(this.params as never[])) as
      | T
      | undefined;
    return (row ?? null) as T | null;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = this.statement().run(...(this.params as never[]));
    return {
      results: [] as T[],
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
        duration: 0,
      },
    };
  }
}

export function createMemoryD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  return {
    prepare: (query: string) => new MemoryStatement(db, query),
    batch: async (statements) =>
      Promise.all(statements.map((statement) => statement.run())) as any,
    exec: async (query: string) => {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
  };
}

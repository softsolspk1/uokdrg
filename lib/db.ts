import { Pool, types } from "pg";

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting)
types.setTypeParser(1082, (v) => v);
// NUMERIC -> number
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 20_000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function audit(username: string | null, action: string, entity: string, entityId: number | null, details?: string) {
  await pool.query(
    "INSERT INTO audit_log (username, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
    [username, action, entity, entityId, details ?? null],
  );
}

import { Pool } from "pg";
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function runTx<T>(
  fn: (c: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await c.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    c.release();
  }
}

import type { Pool } from "pg";

export async function ensureSchema(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    await c.query(`
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await c.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        height INTEGER PRIMARY KEY,
        id     TEXT NOT NULL
      );
    `);
    await c.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS blocks_id_uidx ON blocks(id);
    `);

    await c.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id           TEXT PRIMARY KEY,
        block_height INTEGER NOT NULL,
        ord          INTEGER NOT NULL,
        CONSTRAINT fk_tx_block
          FOREIGN KEY (block_height) REFERENCES blocks(height) ON DELETE CASCADE
      );
    `);

    await c.query(`
      CREATE TABLE IF NOT EXISTS outputs (
        tx_id       TEXT    NOT NULL,
        idx         INTEGER NOT NULL,
        address     TEXT    NOT NULL,
        value       INTEGER NOT NULL,
        spent_at_tx TEXT,
        PRIMARY KEY (tx_id, idx),
        CONSTRAINT fk_out_tx
          FOREIGN KEY (tx_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `);

    await c.query(`
      CREATE TABLE IF NOT EXISTS balances (
        address TEXT PRIMARY KEY,
        value   INTEGER NOT NULL DEFAULT 0
      );
    `);

    await c.query(`
      INSERT INTO meta(key, value)
      VALUES ('current_height','0')
      ON CONFLICT (key) DO NOTHING;
    `);

    await c.query("COMMIT");
  } catch (e) {
    try {
      await c.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    c.release();
  }
}

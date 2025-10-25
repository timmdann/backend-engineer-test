import { expect } from "bun:test";
import { Pool } from "pg";
import { createHash } from "crypto";

export const BASE = "http://localhost:3000";

// общий PSQL pool (один на все тесты)
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// безопасное завершение пула (идемпотентно)
let poolEnded = false;
export async function endPool() {
  if (poolEnded) return;
  poolEnded = true;
  try {
    await pool.end();
  } catch {
    // ignore
  }
}

// sha256 + helper для block.id
export const sha256 = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const blockId = (height: number, ...txIds: string[]) =>
  sha256(String(height) + txIds.join("")).toLowerCase();

// Полный ресет состояния индексера (начинаем с height=0)
export async function resetDb() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM outputs");
    await c.query("DELETE FROM transactions");
    await c.query("DELETE FROM blocks");
    await c.query("DELETE FROM balances");
    await c.query(
      `INSERT INTO meta(key, value) VALUES ('current_height','0')
       ON CONFLICT (key) DO UPDATE SET value='0'`
    );
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

// Установить произвольную высоту (для теста лимита отката)
export async function setCurrentHeight(h: number) {
  await pool.query(
    `INSERT INTO meta(key, value) VALUES ('current_height', $1)
     ON CONFLICT (key) DO UPDATE SET value=$1`,
    [String(h)]
  );
}

export async function postBlock(body: any) {
  const r = await fetch(`${BASE}/blocks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

export async function getBalance(address: string) {
  const r = await fetch(`${BASE}/balance/${address}`);
  const j = await r.json();
  return Number(j.balance ?? 0);
}

export async function rollbackTo(height: number) {
  const r = await fetch(`${BASE}/rollback?height=${height}`, {
    method: "POST",
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

// Маленькие ассерты (с короткими сообщениями)
export function expectOk(res: { status: number }) {
  expect(res.status).toBe(200);
}
export function expectBad(res: { status: number }) {
  expect(res.status).toBe(400);
}

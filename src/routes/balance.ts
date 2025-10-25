import type { FastifyInstance } from "fastify";
import { pool } from "../db";

export function registerBalance(app: FastifyInstance) {
  app.get("/balance/:address", async (req) => {
    const { address } = req.params as { address: string };
    const r = await pool.query("SELECT value FROM balances WHERE address=$1", [
      address,
    ]);
    return { address, balance: Number(r.rows[0]?.value ?? 0) };
  });
}

import type { FastifyInstance } from "fastify";
import { runTx } from "../db";
import { rollbackTo } from "../services/rollbackApplier";

export function registerRollback(app: FastifyInstance) {
  app.post("/rollback", async (req, reply) => {
    const target = Number((req.query as any).height);
    if (!Number.isInteger(target) || target < 0) {
      return reply
        .code(400)
        .send({ error: "height must be a non-negative integer" });
    }
    try {
      await runTx((c) => rollbackTo(c, target));
      return { ok: true };
    } catch (e: any) {
      if (String(e.message).startsWith("cannot rollback")) {
        return reply.code(400).send({ error: e.message });
      }
      req.log.error(e);
      return reply.code(500).send({ error: "internal" });
    }
  });
}

import type { FastifyInstance } from "fastify";
import type { Block } from "../types";
import { runTx } from "../db";
import { validateShape, validateBlockId } from "../services/blockValidator";
import { applyBlock } from "../services/blockApplier";

const BAD_PREFIXES = [
  "invalid",
  "input references missing",
  "double spend",
  "input already spent",
  "inputs sum !=",
];

export function registerBlocks(app: FastifyInstance) {
  app.post("/blocks", async (req, reply) => {
    try {
      const body = req.body as Block;
      validateShape(body);
      validateBlockId(body);
      await runTx((c) => applyBlock(c, body));
      return { ok: true };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (BAD_PREFIXES.some((p) => msg.startsWith(p))) {
        req.log.warn({ err: msg }, "user-error");
        return reply.code(400).send({ error: msg });
      }
      req.log.error(e);
      return reply.code(500).send({ error: "internal" });
    }
  });
}

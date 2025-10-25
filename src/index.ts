import Fastify from "fastify";
import { registerBlocks } from "./routes/blocks";
import { registerBalance } from "./routes/balance";
import { registerRollback } from "./routes/rollback";

const fastify = Fastify({ logger: true });

registerBalance(fastify);
registerBlocks(fastify);
registerRollback(fastify);

await fastify.listen({ port: 3000, host: "0.0.0.0" });

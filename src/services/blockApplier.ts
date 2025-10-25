import type { PoolClient } from "pg";
import type { Block } from "../types";

export async function applyBlock(c: PoolClient, block: Block): Promise<void> {
  const hr = await c.query("SELECT value FROM meta WHERE key='current_height'");
  const current = Number(hr.rows[0]?.value ?? "0");
  if (block.height !== current + 1) {
    throw new Error(`invalid height: expected ${current + 1}`);
  }

  const seen = new Set<string>();

  for (const tx of block.transactions) {
    const inputs = tx.inputs ?? [];
    if (inputs.length === 0) continue;

    const cond = inputs
      .map((_, i) => `(tx_id=$${2 * i + 1} AND idx=$${2 * i + 2})`)
      .join(" OR ");
    const params = inputs.flatMap((ref) => [ref.txId, ref.index]);

    const utx = await c.query(
      `SELECT tx_id, idx, address, value, spent_at_tx
         FROM outputs
        WHERE ${cond}
        FOR UPDATE`,
      params
    );

    if (utx.rowCount !== inputs.length) {
      throw new Error("input references missing");
    }

    let sumIn = 0n;
    for (const ref of inputs) {
      const key = `${ref.txId}:${ref.index}`;
      if (seen.has(key)) {
        throw new Error("double spend inside block");
      }
      seen.add(key);

      const row = utx.rows.find(
        (r) => r.tx_id === ref.txId && Number(r.idx) === ref.index
      );
      if (!row) {
        throw new Error("input references missing");
      }
      if (row.spent_at_tx) {
        throw new Error("input already spent");
      }
      sumIn += BigInt(row.value);
    }

    const sumOut = tx.outputs.reduce((a, o) => a + BigInt(o.value), 0n);
    if (sumIn !== sumOut) {
      throw new Error("inputs sum != outputs sum");
    }
  }

  await c.query("INSERT INTO blocks(height, id) VALUES ($1, $2)", [
    block.height,
    block.id.trim().toLowerCase(),
  ]);

  for (let ord = 0; ord < block.transactions.length; ord++) {
    const tx = block.transactions[ord];
    const txId = tx.id.trim();

    await c.query(
      "INSERT INTO transactions(id, block_height, ord) VALUES ($1, $2, $3)",
      [txId, block.height, ord]
    );

    if (tx.inputs.length) {
      const cond = tx.inputs
        .map((_, i) => `(tx_id=$${2 * i + 1} AND idx=$${2 * i + 2})`)
        .join(" OR ");
      const params = tx.inputs.flatMap((ref) => [ref.txId, ref.index]);
      const utx = await c.query(
        `SELECT tx_id, idx, address, value
           FROM outputs
          WHERE ${cond}
          FOR UPDATE`,
        params
      );

      for (const ref of tx.inputs) {
        const row = utx.rows.find(
          (r) => r.tx_id === ref.txId && Number(r.idx) === ref.index
        )!;

        await c.query(
          "UPDATE outputs SET spent_at_tx=$1 WHERE tx_id=$2 AND idx=$3",
          [txId, ref.txId, ref.index]
        );

        await c.query(
          `INSERT INTO balances(address, value) VALUES ($1, $2)
           ON CONFLICT (address) DO UPDATE SET value = balances.value - EXCLUDED.value`,
          [row.address, row.value]
        );
      }
    }

    for (let j = 0; j < tx.outputs.length; j++) {
      const o = tx.outputs[j];

      await c.query(
        "INSERT INTO outputs(tx_id, idx, address, value, spent_at_tx) VALUES ($1, $2, $3, $4, NULL)",
        [txId, j, o.address, o.value]
      );

      await c.query(
        `INSERT INTO balances(address, value) VALUES ($1, $2)
         ON CONFLICT (address) DO UPDATE SET value = balances.value + EXCLUDED.value`,
        [o.address, o.value]
      );
    }
  }

  await c.query("UPDATE meta SET value=$1 WHERE key='current_height'", [
    String(block.height),
  ]);
}

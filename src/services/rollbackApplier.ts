import type { PoolClient } from "pg";

export async function rollbackTo(c: PoolClient, target: number): Promise<void> {
  const hr = await c.query("SELECT value FROM meta WHERE key='current_height'");
  const current = Number(hr.rows[0]?.value ?? "0");

  if (target > current) {
    throw new Error(`cannot rollback to future height ${target}`);
  }
  if (target === current) {
    return;
  }
  const distance = current - target;
  if (distance > 2000) {
    throw new Error(
      `cannot rollback more than 2000 blocks (current=${current}, target=${target}, distance=${distance})`
    );
  }

  const blocks = await c.query(
    "SELECT height FROM blocks WHERE height > $1 AND height <= $2 ORDER BY height DESC",
    [target, current]
  );

  for (const b of blocks.rows) {
    const h = Number(b.height);
    const txs = await c.query(
      "SELECT id FROM transactions WHERE block_height=$1 ORDER BY ord DESC",
      [h]
    );

    for (const t of txs.rows) {
      const txId = t.id as string;
      const created = await c.query(
        "SELECT address, value FROM outputs WHERE tx_id=$1",
        [txId]
      );
      for (const row of created.rows) {
        await c.query(
          "UPDATE balances SET value = value - $1 WHERE address = $2",
          [row.value, row.address]
        );
      }
      await c.query("DELETE FROM outputs WHERE tx_id=$1", [txId]);
      const spent = await c.query(
        "SELECT tx_id, idx, address, value FROM outputs WHERE spent_at_tx=$1",
        [txId]
      );
      for (const row of spent.rows) {
        await c.query(
          "UPDATE outputs SET spent_at_tx=NULL WHERE tx_id=$1 AND idx=$2",
          [row.tx_id, row.idx]
        );
        await c.query(
          "UPDATE balances SET value = value + $1 WHERE address = $2",
          [row.value, row.address]
        );
      }
      await c.query("DELETE FROM transactions WHERE id=$1", [txId]);
    }
    await c.query("DELETE FROM blocks WHERE height=$1", [h]);
  }
  await c.query("UPDATE meta SET value=$1 WHERE key='current_height'", [
    String(target),
  ]);
}

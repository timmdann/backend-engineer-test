import { createHash } from "crypto";
import type { Block } from "../types";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function validateBlockId(b: Block) {
  const concat =
    String(b.height).trim() + b.transactions.map((t) => t.id.trim()).join("");
  const expected = sha256(concat).toLowerCase();
  const provided = (b.id ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided) || provided !== expected) {
    throw new Error("invalid block id (sha256 mismatch)");
  }
}

export function validateShape(b: Block) {
  if (!b || !Number.isInteger(b.height) || b.height <= 0)
    throw new Error("invalid height");
  if (!Array.isArray(b.transactions))
    throw new Error("transactions must be array");
  for (const tx of b.transactions) {
    if (
      !tx?.id ||
      !Array.isArray(tx.inputs) ||
      !Array.isArray(tx.outputs) ||
      tx.outputs.length === 0
    )
      throw new Error("invalid tx");
    for (const o of tx.outputs) {
      if (!o.address || !Number.isInteger(o.value) || o.value <= 0)
        throw new Error("invalid output");
    }
  }
}

import { test, beforeEach, expect } from "bun:test";
import {
  resetDb,
  postBlock,
  getBalance,
  rollbackTo,
  blockId,
  setCurrentHeight,
} from "./testUtils";

beforeEach(async () => {
  await resetDb();
});

async function setupBlock1() {
  const id = blockId(1, "tx1");
  const r = await postBlock({
    id,
    height: 1,
    transactions: [
      { id: "tx1", inputs: [], outputs: [{ address: "addr1", value: 10 }] },
    ],
  });
  expect(r.status).toBe(200);
}

test("invalid block id → 400", async () => {
  await setupBlock1();
  const bad = await postBlock({
    id: "deadbeef",
    height: 2,
    transactions: [
      {
        id: "tx2",
        inputs: [{ txId: "tx1", index: 0 }],
        outputs: [{ address: "addr2", value: 10 }],
      },
    ],
  });
  expect(bad.status).toBe(400);
  expect(await getBalance("addr2")).toBe(0);
});

test("invalid height (not current+1) → 400", async () => {
  await setupBlock1();
  const id = blockId(3, "txX");
  const res = await postBlock({
    id,
    height: 3,
    transactions: [
      { id: "txX", inputs: [], outputs: [{ address: "addr9", value: 1 }] },
    ],
  });
  expect(res.status).toBe(400);
  expect(await getBalance("addr9")).toBe(0);
});

test("inputs sum != outputs sum → 400", async () => {
  await setupBlock1();
  const id = blockId(2, "tx2");
  const res = await postBlock({
    id,
    height: 2,
    transactions: [
      {
        id: "tx2",
        inputs: [{ txId: "tx1", index: 0 }],
        outputs: [{ address: "addr2", value: 7 }],
      },
    ],
  });
  expect(res.status).toBe(400);
  expect(await getBalance("addr2")).toBe(0);
});

test("double spend in the same block → 400", async () => {
  await setupBlock1();
  const id = blockId(2, "txA", "txB");
  const res = await postBlock({
    id,
    height: 2,
    transactions: [
      {
        id: "txA",
        inputs: [{ txId: "tx1", index: 0 }],
        outputs: [{ address: "addr2", value: 10 }],
      },
      {
        id: "txB",
        inputs: [{ txId: "tx1", index: 0 }],
        outputs: [{ address: "addr3", value: 10 }],
      },
    ],
  });
  expect(res.status).toBe(400);
  expect(await getBalance("addr2")).toBe(0);
  expect(await getBalance("addr3")).toBe(0);
});

test("rollback to future height → 400", async () => {
  await setupBlock1();
  const res = await rollbackTo(5);
  expect(res.status).toBe(400);
});

test("rollback more than 2000 blocks → 400", async () => {
  await setCurrentHeight(3005);
  const res = await rollbackTo(1000);
  expect(res.status).toBe(400);
});

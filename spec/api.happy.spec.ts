import { test, beforeAll, expect } from "bun:test";
import {
  resetDb,
  postBlock,
  getBalance,
  rollbackTo,
  blockId,
} from "./testUtils";

beforeAll(async () => {
  await resetDb();
});

test("happy path: blocks 1..4 then rollback to 2", async () => {
  {
    const id = blockId(1, "tx1");
    const res = await postBlock({
      id,
      height: 1,
      transactions: [
        { id: "tx1", inputs: [], outputs: [{ address: "addr1", value: 10 }] },
      ],
    });
    expect(res.status).toBe(200);
    expect(await getBalance("addr1")).toBe(10);
  }

  {
    const id = blockId(2, "tx2");
    const res = await postBlock({
      id,
      height: 2,
      transactions: [
        {
          id: "tx2",
          inputs: [{ txId: "tx1", index: 0 }],
          outputs: [
            { address: "addr2", value: 4 },
            { address: "addr3", value: 6 },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(await getBalance("addr1")).toBe(0);
    expect(await getBalance("addr2")).toBe(4);
    expect(await getBalance("addr3")).toBe(6);
  }

  {
    const id = blockId(3, "tx3");
    const res = await postBlock({
      id,
      height: 3,
      transactions: [
        { id: "tx3", inputs: [], outputs: [{ address: "addr1", value: 5 }] },
      ],
    });
    expect(res.status).toBe(200);
    expect(await getBalance("addr1")).toBe(5);
  }

  {
    const id = blockId(4, "tx4");
    const res = await postBlock({
      id,
      height: 4,
      transactions: [
        {
          id: "tx4",
          inputs: [{ txId: "tx2", index: 1 }],
          outputs: [
            { address: "addr4", value: 2 },
            { address: "addr5", value: 2 },
            { address: "addr6", value: 2 },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(await getBalance("addr3")).toBe(0);
    expect(await getBalance("addr4")).toBe(2);
    expect(await getBalance("addr5")).toBe(2);
    expect(await getBalance("addr6")).toBe(2);
  }

  {
    const res = await rollbackTo(2);
    expect(res.status).toBe(200);
    expect(await getBalance("addr1")).toBe(0);
    expect(await getBalance("addr2")).toBe(4);
    expect(await getBalance("addr3")).toBe(6);
    expect(await getBalance("addr4")).toBe(0);
    expect(await getBalance("addr5")).toBe(0);
    expect(await getBalance("addr6")).toBe(0);
  }
});

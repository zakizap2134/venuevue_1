import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  saveOrder,
  ownOrders,
  submitPending,
  transactionId,
} from "../src/lib/pending.js";
const order = () => ({
  id: transactionId(),
  userId: 42,
  createdAt: new Date().toISOString(),
  state: "PENDING",
  payload: { client_transaction_id: transactionId() },
});
test("pending record survives DB reopen and is scoped to its user", async () => {
  const o = order();
  await saveOrder(o);
  assert.ok((await ownOrders(42)).some((x) => x.id === o.id));
  assert.deepEqual(await ownOrders(99), []);
});
test("network interruption retains the original idempotency key", async () => {
  const o = order();
  await saveOrder(o);
  const n = await submitPending(o, async () => {
    throw new Error("disconnected");
  });
  assert.equal(n.state, "PENDING");
  assert.equal(
    n.payload.client_transaction_id,
    o.payload.client_transaction_id,
  );
});
test("lost response then duplicate success persists authoritative receipt", async () => {
  const o = order();
  await saveOrder(o);
  let n = await submitPending(o, async () => {
    throw new Error("response lost after commit");
  });
  n = await submitPending(n, async (payload) => {
    assert.deepEqual(payload, o.payload);
    return Response.json({ success: true, duplicate: true, order_id: 23 });
  });
  assert.equal(n.state, "CONFIRMED");
  assert.equal(n.receipt.order_id, 23);
  assert.equal(
    (await ownOrders(42)).find((x) => x.id === o.id).state,
    "CONFIRMED",
  );
});
test("stock/price rejection needs review and never automatically retries", async () => {
  const o = order();
  const n = await submitPending(o, async () =>
    Response.json(
      { success: false, error: "Insufficient stock: Milk" },
      { status: 409 },
    ),
  );
  assert.equal(n.state, "REVIEW");
  await submitPending(n, () =>
    assert.fail("Review orders must not auto-submit"),
  );
});
test("expired login preserves pending order for same-user reauthentication", async () => {
  const n = await submitPending(order(), async () =>
    Response.json({ success: false }, { status: 401 }),
  );
  assert.equal(n.state, "PENDING");
});
test("server errors and non-JSON replies retain pending state", async () => {
  for (const response of [
    new Response("bad gateway", { status: 502 }),
    new Response("broken", { status: 200 }),
  ])
    assert.equal(
      (await submitPending(order(), async () => response)).state,
      "PENDING",
    );
});
test("persistence failure cannot falsely mark a queued order confirmed", async () => {
  const o = order();
  await saveOrder(o);
  await assert.rejects(
    submitPending(
      o,
      async () => Response.json({ success: true, order_id: 99 }),
      async () => {
        throw new Error("quota");
      },
    ),
  );
  assert.equal(
    (await ownOrders(42)).find((x) => x.id === o.id).state,
    "PENDING",
  );
});
test("LAN-compatible transaction IDs are unique UUIDv4 values", () => {
  const ids = new Set(Array.from({ length: 1000 }, transactionId));
  assert.equal(ids.size, 1000);
  for (const id of ids)
    assert.match(
      id,
      /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/,
    );
});

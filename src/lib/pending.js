// One IndexedDB record per order; writes resolve only after durable transaction completion.
const DB_NAME = "venuevue-orders-v1";
export function openOrders() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("orders", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transact(mode, operation) {
  const db = await openOrders();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("orders", mode);
      const req = operation(tx.objectStore("orders"));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Order storage failed"));
    });
  } finally {
    db.close();
  }
}
export const saveOrder = (order) =>
  transact("readwrite", (store) => store.put(order));
export const ownOrders = async (userId) =>
  (await transact("readonly", (store) => store.getAll()))
    .filter((o) => o.userId === Number(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export function transactionId() {
  // getRandomValues works on LAN HTTP where crypto.randomUUID may be unavailable.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export async function submitPending(order, send, persist = saveOrder) {
  if (order.state !== "PENDING") return order;
  let next;
  try {
    const response = await send(order.payload);
    const body = await response.json().catch(() => null);
    if (response.ok && body?.success && body.order_id)
      next = {
        ...order,
        state: "CONFIRMED",
        receipt: body,
        message: "Sale confirmed",
      };
    else if (response.status === 401)
      next = {
        ...order,
        message: "Sign in again as the same user to submit this order",
      };
    else if ([400, 403, 409, 422].includes(response.status))
      next = {
        ...order,
        state: "REVIEW",
        message: body?.error ?? "Owner review required",
      };
    else
      next = {
        ...order,
        message: "Confirmation unavailable. Safely retrying the same order.",
      };
  } catch {
    next = {
      ...order,
      message:
        "Host unavailable. Order saved on this device; awaiting confirmation.",
    };
  }
  await persist(next); // If this fails, old PENDING record remains and is safe to replay.
  return next;
}

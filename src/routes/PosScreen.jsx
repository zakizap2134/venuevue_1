import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import SaleReceipt from "../components/SaleReceipt";
import { useAuth } from "../context/AuthContext";
import {
  ownOrders,
  saveOrder,
  submitPending,
  transactionId,
} from "../lib/pending";
import { getTabletId } from "../lib/tablet";
const money = (n) => `₱${Number(n).toFixed(2)}`;
export default function PosScreen() {
  const { user, fetchWithAuth } = useAuth();
  const [variants, setVariants] = useState([]),
    [cart, setCart] = useState([]),
    [cash, setCash] = useState(""),
    [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]),
    [receipt, setReceipt] = useState(null),
    [message, setMessage] = useState("Connecting to local host…"),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const sending = useRef(false),
    charging = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refreshOrders = useCallback(async () => {
    const rows = await ownOrders(user.user_id);
    if (alive.current) setOrders(rows);
    return rows;
  }, [user.user_id]);
  const loadMenu = useCallback(async () => {
    try {
      const r = await fetchWithAuth("/backend/api.php?action=catalogue", {
        signal: AbortSignal.timeout(8000),
      });
      const b = await r.json();
      if (!r.ok || !b.success) throw new Error(b.error);
      if (alive.current) {
        setVariants(b.variants);
        setConnected(true);
        setMessage("Connected to local host");
      }
    } catch {
      if (alive.current) {
        setConnected(false);
        setMessage(
          "Host unavailable. Saved orders will retry; stock is checked on confirmation.",
        );
      }
    }
  }, [fetchWithAuth]);
  const retry = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      const rows = await refreshOrders();
      for (const order of rows.filter((o) => o.state === "PENDING")) {
        if (!alive.current) break;
        const next = await submitPending(order, (payload) =>
          fetchWithAuth("/backend/sync.php", {
            method: "POST",
            json: payload,
            signal: AbortSignal.timeout(10000),
          }),
        );
        if (alive.current && next.receipt) setReceipt(next.receipt);
      }
      await refreshOrders();
      await loadMenu();
    } catch (e) {
      if (alive.current)
        setMessage(
          `Order storage error: ${e.message}. Do not clear browser data.`,
        );
    } finally {
      sending.current = false;
    }
  }, [fetchWithAuth, refreshOrders, loadMenu]);
  useEffect(() => {
    retry();
    const timer = setInterval(retry, 15000);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", retry);
    };
  }, [retry]);
  const total = cart.reduce(
      (sum, l) => sum + Math.round(Number(l.price) * 100) * l.quantity,
      0,
    ),
    cashCents = Math.round(Number(cash) * 100);
  const add = (v) => {
    setConfirm(false);
    setCart((old) => {
      const line = old.find((l) => l.id === v.id);
      if (line)
        return old.map((l) =>
          l.id === v.id ? { ...l, quantity: Math.min(100, l.quantity + 1) } : l,
        );
      return [...old, { ...v, quantity: 1 }];
    });
  };
  const charge = async () => {
    if (
      charging.current ||
      !cart.length ||
      cashCents < total ||
      !/^\d+(\.\d{1,2})?$/.test(cash)
    )
      return;
    charging.current = true;
    setBusy(true);
    try {
      const id = transactionId();
      const order = {
        id,
        userId: Number(user.user_id),
        createdAt: new Date().toISOString(),
        state: "PENDING",
        message: "Awaiting host confirmation",
        payload: {
          client_transaction_id: id,
          tablet_id: getTabletId(),
          order: { cash_tendered: cash },
          items: cart.map((l) => ({
            variant_id: Number(l.id),
            quantity: l.quantity,
            expected_price: String(l.price),
          })),
        },
      };
      await saveOrder(order); // Never send before local persistence succeeds.
      setCart([]);
      setCash("");
      setConfirm(false);
      setReceipt(null);
      await refreshOrders();
      await retry();
    } catch (e) {
      setMessage(
        `Unable to save order: ${e.message}. No new sale was submitted.`,
      );
    } finally {
      setBusy(false);
      charging.current = false;
    }
  };
  const dismiss = async (order) => {
    await saveOrder({
      ...order,
      state: "RESOLVED",
      message: "Reviewed; rejected sale was not committed.",
    });
    await refreshOrders();
  };
  const products = [...new Set(variants.map((v) => v.product_name))].filter(
    (n) => n.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <AppShell>
      <div className="vv-workspace">
        <div className="vv-heading">
          <div>
            <p className="vv-muted">TRAVELBEAN MNL</p>
            <h1>Register</h1>
          </div>
          <button onClick={retry} disabled={busy}>
            Refresh / retry pending
          </button>
        </div>
        <p role="status" className={connected ? "vv-notice" : "vv-warning"}>
          {message}
        </p>
        <div className="vv-pos">
          <section>
            <label className="vv-field">
              Find a drink
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu"
              />
            </label>
            {!variants.length && (
              <p className="vv-card">
                No menu loaded. The owner must create products, variants and
                recipes in Management.
              </p>
            )}
            <div className="vv-menu">
              {products.map((name) => (
                <article className="vv-card" key={name}>
                  <h2>{name}</h2>
                  <div className="vv-choices">
                    {variants
                      .filter((v) => v.product_name === name)
                      .map((v) => (
                        <button
                          key={v.id}
                          disabled={v.available_count < 1 || busy}
                          onClick={() => add(v)}
                          aria-label={`Add ${name} ${v.size} ${v.temperature}`}
                        >
                          <strong>
                            {v.size} · {{ S: 12, M: 16, L: 22 }[v.size]} oz{" "}
                            {v.temperature === "NA" ? "" : v.temperature}
                          </strong>
                          <span>{money(v.price)}</span>
                          <small>
                            {v.available_count < 1
                              ? "Unavailable"
                              : `${v.available_count} available`}
                          </small>
                        </button>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <aside className="vv-cart vv-card">
            <h2>Current order</h2>
            {!cart.length && <p>Select a size to add a drink.</p>}
            {cart.map((l) => (
              <div key={l.id} className="vv-cart-line">
                <strong>
                  {l.product_name} {l.size}{" "}
                  {l.temperature === "NA" ? "" : l.temperature}
                </strong>
                <p>{money(l.price)} each</p>
                <div className="vv-choices">
                  <button
                    aria-label={`Decrease ${l.product_name} ${l.size}`}
                    disabled={busy}
                    onClick={() => {
                      setConfirm(false);
                      setCart(
                        cart
                          .map((x) =>
                            x.id === l.id
                              ? { ...x, quantity: x.quantity - 1 }
                              : x,
                          )
                          .filter((x) => x.quantity > 0),
                      );
                    }}
                  >
                    −
                  </button>
                  <span>{l.quantity}</span>
                  <button
                    aria-label={`Increase ${l.product_name} ${l.size}`}
                    disabled={busy || l.quantity >= 100}
                    onClick={() => add(l)}
                  >
                    +
                  </button>
                  <b>
                    {money(
                      (Math.round(Number(l.price) * 100) * l.quantity) / 100,
                    )}
                  </b>
                </div>
              </div>
            ))}
            <h2>Total {money(total / 100)}</h2>
            <p>Includes 12% VAT. Final stock and price confirmed by host.</p>
            <label className="vv-field">
              Cash received
              <input
                inputMode="decimal"
                value={cash}
                disabled={busy}
                onChange={(e) => {
                  setCash(e.target.value);
                  setConfirm(false);
                }}
                placeholder="0.00"
              />
            </label>
            <p>Change: {money(Math.max(0, (cashCents - total) / 100))}</p>
            {confirm ? (
              <div className="vv-warning">
                <p>Confirm cash of {money(cashCents / 100)} for this order?</p>
                <button className="vv-primary" disabled={busy} onClick={charge}>
                  Confirm sale
                </button>
                <button disabled={busy} onClick={() => setConfirm(false)}>
                  Back
                </button>
              </div>
            ) : (
              <button
                className="vv-primary"
                disabled={
                  busy ||
                  !cart.length ||
                  cashCents < total ||
                  !/^\d+(\.\d{1,2})?$/.test(cash)
                }
                onClick={() => setConfirm(true)}
              >
                Charge
              </button>
            )}
          </aside>
        </div>
        <SaleReceipt sale={receipt} />
        <section className="vv-card">
          <h2>My orders on this device</h2>
          <p>
            Pending is not a completed sale. Keep this browser’s data until
            orders are confirmed or reviewed.
          </p>
          {orders.slice(0, 30).map((o) => (
            <article className="vv-order" key={o.id}>
              <strong>
                {o.state} ·{" "}
                {new Date(o.createdAt).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </strong>
              <p>{o.message}</p>
              {o.state === "CONFIRMED" && (
                <button onClick={() => setReceipt(o.receipt)}>
                  View confirmation #{o.receipt.order_id}
                </button>
              )}
              {o.state === "REVIEW" && (
                <>
                  <p>
                    Check the message and menu before creating a corrected
                    order. This rejected submission is preserved.
                  </p>
                  <button
                    onClick={() =>
                      dismiss(o).catch((e) => setMessage(e.message))
                    }
                  >
                    Mark reviewed
                  </button>
                </>
              )}
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

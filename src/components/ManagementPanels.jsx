import { useEffect, useState } from "react";
import SaleReceipt from "./SaleReceipt";
const money = (v) => `₱${Number(v ?? 0).toFixed(2)}`;
export function DashboardPanel({ request }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [sale, setSale] = useState(null);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await request("/backend/api.php?action=dashboard"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [request]);
  return (
    <section aria-busy={loading}>
      <div className="vv-heading">
        <h2>Today’s overview</h2>
        <button onClick={load} disabled={loading}>
          Refresh overview
        </button>
      </div>
      {loading && <p role="status">Loading dashboard…</p>}
      {error && (
        <p role="alert" className="vv-warning">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>As of {data.server_time} · Manila time</p>
          <div className="vv-forms">
            {[
              ["Confirmed sales", data.totals.count],
              ["Gross sales", money(data.totals.gross)],
              ["VATable sales", money(data.totals.net)],
              ["VAT (12%)", money(data.totals.vat)],
            ].map(([label, value]) => (
              <article className="vv-card" key={label}>
                <h3>{label}</h3>
                <strong className="vv-metric">{value}</strong>
              </article>
            ))}
          </div>
          <section className="vv-card">
            <h2>Low-stock alerts</h2>
            {!data.low_stock.length ? (
              <p>No active ingredients are at or below their threshold.</p>
            ) : (
              <ul>
                {data.low_stock.map((i) => (
                  <li key={i.ingredient_id}>
                    <strong>{i.ingredient_name}</strong>: {i.eligible_stock}{" "}
                    {i.unit} eligible · threshold {i.minimum_stock}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="vv-card vv-scroll">
            <h2>Ingredient stock</h2>
            {!data.ingredients.length ? (
              <p>No ingredients yet. Add one in Inventory.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>On hand</th>
                    <th>Eligible</th>
                    <th>Waste due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ingredients.map((i) => (
                    <tr key={i.ingredient_id}>
                      <td>{i.ingredient_name}</td>
                      <td>
                        {i.current_stock} {i.unit}
                      </td>
                      <td>{i.eligible_stock}</td>
                      <td>{i.waste_due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="vv-card">
            <h2>Recent confirmed sales</h2>
            {!data.recent_sales.length ? (
              <p>No confirmed sales today.</p>
            ) : (
              data.recent_sales.map((s) => (
                <button
                  className="vv-sale-link"
                  key={s.order_id}
                  onClick={() => setSale(s)}
                >
                  #{s.order_id} · {s.sale_at} · {money(s.total_gross)}
                </button>
              ))
            )}
          </section>
          <SaleReceipt sale={sale} />
        </>
      )}
    </section>
  );
}
export function BatchPanel({ data, save, busy }) {
  const [filter, setFilter] = useState(""),
    [showEmpty, setShowEmpty] = useState(false);
  const ingredient = (id) =>
    data.ingredients.find((i) => Number(i.ingredient_id) === Number(id))
      ?.ingredient_name ?? id;
  const batches = data.batches.filter(
    (b) =>
      (showEmpty || Number(b.remaining_qty) > 0) &&
      `${ingredient(b.ingredient_id)} ${b.reference} ${b.supplier ?? ""} ${b.lot_reference ?? ""}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  return (
    <section className="vv-card">
      <h2>Stock batches</h2>
      <label className="vv-field">
        Find ingredient, supplier or lot
        <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={showEmpty}
          onChange={(e) => setShowEmpty(e.target.checked)}
        />{" "}
        Include exhausted batches
      </label>
      {!batches.length ? (
        <p>No batches match. Receive stock in Inventory to create one.</p>
      ) : (
        <div className="vv-scroll">
          <table>
            <thead>
              <tr>
                <th>Batch / ingredient</th>
                <th>Supplier / lot</th>
                <th>Received</th>
                <th>Remaining</th>
                <th>Sealed</th>
                <th>Opened</th>
                <th>Expires</th>
                <th>Status / edit</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    #{b.id} · {ingredient(b.ingredient_id)}
                    <br />
                    {b.reference}
                  </td>
                  <td>
                    {b.supplier || "—"} / {b.lot_reference || "—"}
                  </td>
                  <td>{b.received_qty}</td>
                  <td>{b.remaining_qty}</td>
                  <td>{b.qty_sealed}</td>
                  <td>{b.qty_opened}</td>
                  <td>{b.expiration_date || "N/A"}</td>
                  <td>
                    {Number(b.quarantined)
                      ? "Quarantined"
                      : b.expiration_date &&
                          b.expiration_date < data.server_time.slice(0, 10)
                        ? "Expired"
                        : "Active"}
                    <details>
                      <summary>Correct batch details</summary>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          save("batch_update", {
                            ...Object.fromEntries(
                              new FormData(e.currentTarget),
                            ),
                            id: b.id,
                          });
                        }}
                      >
                        <label className="vv-field">
                          Reference
                          <input
                            name="reference"
                            defaultValue={b.reference}
                            required
                            maxLength="100"
                          />
                        </label>
                        <label className="vv-field">
                          Supplier
                          <input
                            name="supplier"
                            defaultValue={b.supplier ?? ""}
                            maxLength="100"
                          />
                        </label>
                        <label className="vv-field">
                          Lot reference
                          <input
                            name="lot_reference"
                            defaultValue={b.lot_reference ?? ""}
                            maxLength="100"
                          />
                        </label>
                        <label className="vv-field">
                          Expiration
                          <input
                            name="expiration_date"
                            type="date"
                            defaultValue={b.expiration_date ?? ""}
                          />
                        </label>
                        <label className="vv-field">
                          Quarantine
                          <select
                            name="quarantined"
                            defaultValue={String(b.quarantined)}
                          >
                            <option value="0">No</option>
                            <option value="1">
                              Yes — block all sales from this batch
                            </option>
                          </select>
                        </label>
                        <label className="vv-field">
                          Correction reason
                          <input name="reason" required maxLength="255" />
                        </label>
                        <p>
                          Quantity corrections use waste or adjustments in
                          Inventory. Opened use-by times remain unchanged.
                        </p>
                        <button disabled={busy}>Save batch correction</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export function AuditPanel({ request }) {
  const [kind, setKind] = useState("audit"),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState({ search: "", from: "", to: "" }),
    [applied, setApplied] = useState({ search: "", from: "", to: "" }),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setData(null);
    request(
      "/backend/api.php?" +
        new URLSearchParams({ action: "history", kind, page, ...applied }),
    )
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [request, kind, page, applied]);
  return (
    <section className="vv-card" aria-busy={loading}>
      <h2>Audit and stock history</h2>
      <form
        className="vv-recipe"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied({ ...filter });
        }}
      >
        <label className="vv-field">
          History
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="audit">Audit events</option>
            <option value="movements">Stock movements</option>
          </select>
        </label>
        <label className="vv-field">
          Actor / action / reason
          <input
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
        </label>
        {["from", "to"].map((key) => (
          <label className="vv-field" key={key}>
            {key === "from" ? "From" : "Through"}
            <input
              type="date"
              value={filter[key]}
              onChange={(e) => setFilter({ ...filter, [key]: e.target.value })}
            />
          </label>
        ))}
        <button disabled={loading}>Apply filters</button>
      </form>
      {loading && <p role="status">Loading history…</p>}
      {error && (
        <p role="alert" className="vv-warning">
          {error}
        </p>
      )}
      {data && (
        <>
          {!data.rows.length ? (
            <p>No history matches these filters.</p>
          ) : (
            <div className="vv-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.created_at}</td>
                      <td>
                        {r.username ?? "System"}{" "}
                        {r.user_id ? `(#${r.user_id})` : ""}
                      </td>
                      <td>{r.action ?? r.transaction_type}</td>
                      <td>
                        {kind === "audit" ? (
                          <details>
                            <summary>View details</summary>
                            <pre className="vv-audit-details">
                              {r.details || "No additional details"}
                            </pre>
                          </details>
                        ) : (
                          <>
                            {r.quantity_delta} · Ingredient #{r.ingredient_id} ·
                            Batch #{r.batch_id ?? "—"} / Container #
                            {r.container_id ?? "—"}
                            <br />
                            {r.reason}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="vv-choices">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.max(1, data.pages)} · {data.total} records
            </span>
            <button
              disabled={page >= data.pages || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

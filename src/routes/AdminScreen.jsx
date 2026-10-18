import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import SaleReceipt from "../components/SaleReceipt";
import { useAuth } from "../context/AuthContext";
import {
  DashboardPanel,
  BatchPanel,
  AuditPanel,
} from "../components/ManagementPanels";
import BackupPanel from "../components/BackupPanel";
import ThemeToggle from "../components/ThemeToggle";
function Field({ label, ...props }) {
  return (
    <label className="vv-field">
      {label}
      <input {...props} />
    </label>
  );
}
function Select({ label, children, ...props }) {
  return (
    <label className="vv-field">
      {label}
      <select {...props}>{children}</select>
    </label>
  );
}
function Form({ title, onSubmit, children, busy }) {
  return (
    <form
      className="vv-card"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          Object.fromEntries(new FormData(e.currentTarget)),
          e.currentTarget,
        );
      }}
    >
      <h2>{title}</h2>
      {children}
      <button className="vv-primary" disabled={busy}>
        Save
      </button>
    </form>
  );
}
const money = (n) => `₱${Number(n ?? 0).toFixed(2)}`;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default function AdminScreen() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState(null),
    [tab, setTab] = useState("Overview"),
    [message, setMessage] = useState("Loading…"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [reportLoading, setReportLoading] = useState(false),
    [report, setReport] = useState(null),
    [dates, setDates] = useState({ from: today(), to: today() }),
    [receipt, setReceipt] = useState(null),
    [code, setCode] = useState(null),
    [recipeVariant, setRecipeVariant] = useState(""),
    [rows, setRows] = useState([{ ingredient_id: "", qty: "" }]);
  const saving = useRef(false);
  const request = useCallback(
    async (url, options = {}) => {
      const r = await fetchWithAuth(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(15000),
      });
      const b = await r.json().catch(() => null);
      if (!b)
        throw new Error(
          `Server returned an unreadable response (HTTP ${r.status}). Try again.`,
        );
      if (!r.ok || !b.success) throw new Error(b.error ?? "Request failed");
      return b;
    },
    [fetchWithAuth],
  );
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await request("/backend/api.php?action=management"));
      setMessage("Management data refreshed");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const loadReport = async () => {
    setReportLoading(true);
    setError("");
    setReport(null);
    setReceipt(null);
    try {
      setReport(
        await request(
          `/backend/api.php?action=sales&from=${dates.from}&to=${dates.to}`,
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setReportLoading(false);
    }
  };
  useEffect(() => {
    if (tab === "Sales") loadReport();
  }, [tab]);
  const save = async (action, values, form) => {
    if (saving.current) return;
    saving.current = true;
    setError("");
    setMessage("Saving…");
    setBusy(true);
    try {
      const result = await request("/backend/api.php", {
        method: "POST",
        json: { ...values, action },
      });
      if (result.recovery_code) setCode(result.recovery_code);
      form?.reset();
      await refresh();
      setMessage("Saved successfully");
      return result;
    } catch (e) {
      setError(e.message);
      setMessage("");
    } finally {
      setBusy(false);
      saving.current = false;
    }
  };
  const exportCSV = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetchWithAuth(
        `/backend/api.php?action=export&from=${dates.from}&to=${dates.to}`,
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? "Export failed");
      }
      const u = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = u;
      a.download = `venuevue-${dates.from}-${dates.to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
      setMessage("CSV export downloaded");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const ingredientName = (id) =>
    data?.ingredients.find((i) => Number(i.ingredient_id) === Number(id))
      ?.ingredient_name ?? id;
  const remove = (kind, id) => {
    if (
      window.confirm(
        "Delete this unused record? Referenced records must be archived using Active = No.",
      )
    )
      save(`delete_${kind}`, { id });
  };
  const variantName = (v) =>
    `${data?.products.find((p) => Number(p.product_id) === Number(v.product_id))?.product_name} ${v.size} ${v.temperature}`;
  const chooseRecipe = (id) => {
    setRecipeVariant(id);
    const current = data.recipes
      .filter((r) => Number(r.variant_id) === Number(id))
      .map((r) => ({ ingredient_id: String(r.ingredient_id), qty: r.qty }));
    setRows(current.length ? current : [{ ingredient_id: "", qty: "" }]);
  };
  return (
    <AppShell>
      <div className="vv-workspace">
        <div className="vv-heading">
          <div>
            <p className="vv-muted">OWNER / ADMIN</p>
            <h1>Management</h1>
          </div>
          <button onClick={refresh} disabled={loading || busy}>
            Refresh
          </button>
        </div>
        <p className="vv-notice" role="status">
          {message}
        </p>
        {error && (
          <p role="alert" className="vv-warning">
            {error}
          </p>
        )}
        {loading && <p role="status">Loading management records…</p>}
        <nav className="vv-tabs" aria-label="Management sections">
          {[
            "Overview",
            "Inventory",
            "Batches",
            "Catalogue",
            "Recipes",
            "Sales",
            "Staff & recovery",
            "Audit",
            "Backup & restore",
            "Settings",
          ].map((t) => (
            <button
              aria-current={t === tab ? "page" : undefined}
              onClick={() => setTab(t)}
              key={t}
              disabled={busy}
            >
              {t}
            </button>
          ))}
        </nav>
        {data && (
          <>
            {tab === "Settings" && (
              <section className="vv-card">
                <h2>Workstation settings</h2>
                <p>TravelBean MNL · Powered by VenueVue</p>
                <h3>Display preference</h3>
                <p>Choose light or dark mode for this browser. This does not change other workstations.</p>
                <ThemeToggle />
                <h3>Account and data controls</h3>
                <p>Use Staff &amp; recovery to manage staff access and your recovery code. Use Backup &amp; restore for manual database snapshots.</p>
                <p className="vv-muted">Cash payments · VAT-inclusive menu prices · Manila time. Business rules are not editable here.</p>
              </section>
            )}
            {tab === "Overview" && <DashboardPanel request={request} />}
            {tab === "Batches" && (
              <BatchPanel data={data} save={save} busy={busy} />
            )}
            {tab === "Backup & restore" && <BackupPanel request={request} />}
            {tab === "Inventory" && (
              <>
                {data.ingredients.some((i) => Number(i.waste_due) > 0) && (
                  <p className="vv-warning">
                    Expired stock needs waste entry. It is already blocked from
                    sales; record its disposal below.
                  </p>
                )}
                <section className="vv-card vv-scroll">
                  <h2>Ingredients</h2>
                  {!data.ingredients.length && (
                    <p>
                      No ingredients yet. Create your first ingredient below.
                    </p>
                  )}
                  <table>
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Unit</th>
                        <th>On hand</th>
                        <th>Eligible</th>
                        <th>Threshold</th>
                        <th>Waste due</th>
                        <th>Unallocated</th>
                        <th>Opened hours</th>
                        <th>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ingredients.map((i) => (
                        <tr key={i.ingredient_id}>
                          <td>
                            {i.ingredient_name}
                            {!Number(i.is_active) && " (inactive)"}
                          </td>
                          <td>{i.unit}</td>
                          <td>{i.current_stock}</td>
                          <td
                            className={
                              Number(i.eligible_stock) <=
                              Number(i.minimum_stock)
                                ? "vv-low"
                                : ""
                            }
                          >
                            {i.eligible_stock}
                          </td>
                          <td>{i.minimum_stock}</td>
                          <td>{i.waste_due}</td>
                          <td>{i.unallocated_stock}</td>
                          <td>{i.opened_shelf_life_hours ?? "N/A"}</td>
                          <td>
                            <details>
                              <summary>Edit</summary>
                              <Form
                                title={i.ingredient_name}
                                busy={busy}
                                onSubmit={(v) =>
                                  save("ingredient", {
                                    ...v,
                                    id: i.ingredient_id,
                                  })
                                }
                              >
                                <Field
                                  label="Name"
                                  name="name"
                                  defaultValue={i.ingredient_name}
                                  required
                                />
                                <Select
                                  label="Base unit"
                                  name="unit"
                                  defaultValue={i.unit}
                                >
                                  <option>g</option>
                                  <option>mL</option>
                                  <option>units</option>
                                </Select>
                                <Field
                                  label="Low-stock threshold"
                                  name="minimum_stock"
                                  defaultValue={i.minimum_stock}
                                  required
                                />
                                <Field
                                  label="Opened shelf life (hours; blank = N/A)"
                                  name="opened_shelf_life_hours"
                                  defaultValue={i.opened_shelf_life_hours ?? ""}
                                />
                                <Select
                                  label="Active"
                                  name="is_active"
                                  defaultValue={String(i.is_active)}
                                >
                                  <option value="1">Yes</option>
                                  <option value="0">No</option>
                                </Select>
                              </Form>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  remove("ingredient", i.ingredient_id)
                                }
                              >
                                Delete unused ingredient
                              </button>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Unallocated legacy stock cannot be sold until reconciled
                    into known containers. Physical on-hand includes expired
                    stock until waste is recorded.
                  </p>
                </section>
                <div className="vv-forms">
                  <Form
                    title="New ingredient"
                    busy={busy}
                    onSubmit={(v, f) => save("ingredient", v, f)}
                  >
                    <Field label="Name" name="name" required />
                    <Select label="Base unit" name="unit">
                      <option>g</option>
                      <option>mL</option>
                      <option>units</option>
                    </Select>
                    <Field
                      label="Low-stock threshold"
                      name="minimum_stock"
                      defaultValue="0"
                      required
                    />
                    <Select
                      label="Opened shelf life"
                      name="opened_shelf_life_hours"
                    >
                      <option value="">
                        Not applicable (cups, lids, straws)
                      </option>
                      <option value="48">Fresh milk · 48 hours</option>
                      <option value="72">Plant milk · 72 hours</option>
                      <option value="720">Syrup / sauce · 720 hours</option>
                      <option value="168">Beans / hopper · 168 hours</option>
                    </Select>
                  </Form>
                  <Form
                    title="Receive stock / positive adjustment"
                    busy={busy}
                    onSubmit={(v, f) => save(v.kind, v, f)}
                  >
                    <Select label="Type" name="kind">
                      <option value="restock">Delivery</option>
                      <option value="adjust_in">
                        Authorized positive adjustment
                      </option>
                      <option value="reconcile">
                        Allocate existing legacy stock (no increase)
                      </option>
                    </Select>
                    <Select label="Ingredient" name="ingredient_id" required>
                      <option value="">Select ingredient</option>
                      {data.ingredients.map((i) => (
                        <option key={i.ingredient_id} value={i.ingredient_id}>
                          {i.ingredient_name} ({i.unit})
                        </option>
                      ))}
                    </Select>
                    <Field
                      label="Delivery reference / adjustment reason"
                      name="reference"
                      required
                    />
                    <Field
                      label="Supplier (optional)"
                      name="supplier"
                      maxLength="100"
                    />
                    <Field
                      label="Lot reference (optional)"
                      name="lot_reference"
                      maxLength="100"
                    />
                    <Field
                      label="Number of sealed containers"
                      name="container_count"
                      type="number"
                      min="1"
                      max="1000"
                      required
                    />
                    <Field
                      label="Quantity per container (base unit)"
                      name="quantity_per_container"
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                    />
                    <Field
                      label="Expiration date (required for perishable stock)"
                      name="expiration_date"
                      type="date"
                    />
                    <p>
                      Enter each delivery/expiration date separately. A milk
                      carton or bean hopper is one container.
                    </p>
                  </Form>
                  <Form
                    title="Record waste / negative adjustment"
                    busy={busy}
                    onSubmit={(v, f) => save(v.kind, v, f)}
                  >
                    <Select label="Type" name="kind">
                      <option value="waste">Waste</option>
                      <option value="adjust_out">
                        Authorized negative adjustment
                      </option>
                    </Select>
                    <Select label="Container" name="container_id" required>
                      <option value="">Select container</option>
                      {data.containers.map((c) => (
                        <option key={c.id} value={c.id}>
                          #{c.id} {ingredientName(c.ingredient_id)} ·{" "}
                          {c.remaining_qty} ·{" "}
                          {c.eligible ? "eligible" : "blocked"}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label="Quantity (base unit)"
                      name="qty"
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                    />
                    <Field label="Reason" name="reason" required />
                  </Form>
                </div>
                <section className="vv-card vv-scroll">
                  <h2>Batch containers</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Container / delivery</th>
                        <th>Ingredient</th>
                        <th>Remaining</th>
                        <th>Expiration</th>
                        <th>Opened</th>
                        <th>Use by</th>
                        <th>Eligibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.containers.map((c) => (
                        <tr key={c.id}>
                          <td>
                            #{c.id} / {c.reference}
                          </td>
                          <td>{ingredientName(c.ingredient_id)}</td>
                          <td>{c.remaining_qty}</td>
                          <td>{c.expiration_date ?? "N/A"}</td>
                          <td>{c.opened_at ?? "Sealed"}</td>
                          <td>{c.use_by ?? "N/A"}</td>
                          <td>{c.eligible ? "Eligible" : "Blocked"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </>
            )}
            {tab === "Catalogue" && (
              <>
                <div className="vv-forms">
                  <Form
                    title="Create product"
                    busy={busy}
                    onSubmit={(v, f) => save("product", v, f)}
                  >
                    <Field label="Product name" name="name" required />
                    <Field
                      label="Category"
                      name="category"
                      defaultValue="Coffee"
                      required
                    />
                  </Form>
                  <Form
                    title="Create size / temperature variant"
                    busy={busy}
                    onSubmit={(v, f) => save("variant", v, f)}
                  >
                    <Select label="Product" name="product_id" required>
                      <option value="">Select product</option>
                      {data.products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name}
                        </option>
                      ))}
                    </Select>
                    <Select label="Size" name="size">
                      <option value="S">S · 12 oz</option>
                      <option value="M">M · 16 oz</option>
                      <option value="L">L · 22 oz</option>
                    </Select>
                    <Select label="Temperature" name="temperature">
                      <option value="NA">Not applicable</option>
                      <option value="HOT">Hot</option>
                      <option value="ICED">Iced</option>
                    </Select>
                    <Field label="Unique SKU" name="sku" required />
                    <Field
                      label="VAT-inclusive price"
                      name="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </Form>
                </div>
                <section className="vv-card">
                  <h2>Products and variants</h2>
                  {!data.products.length && (
                    <p>
                      No products yet. Create a product, add sizes, and define a
                      recipe.
                    </p>
                  )}
                  {data.products.map((p) => (
                    <details key={p.product_id}>
                      <summary>
                        {p.product_name} ·{" "}
                        {Number(p.is_active) ? "Active" : "Inactive"}
                      </summary>
                      <Form
                        title="Edit product"
                        busy={busy}
                        onSubmit={(v) =>
                          save("product", { ...v, id: p.product_id })
                        }
                      >
                        <Field
                          label="Name"
                          name="name"
                          defaultValue={p.product_name}
                        />
                        <Field
                          label="Category"
                          name="category"
                          defaultValue={p.category}
                        />
                        <Select
                          label="Active"
                          name="is_active"
                          defaultValue={String(p.is_active)}
                        >
                          <option value="1">Yes</option>
                          <option value="0">No</option>
                        </Select>
                      </Form>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove("product", p.product_id)}
                      >
                        Delete unused product
                      </button>
                      {data.variants
                        .filter((v) => v.product_id === p.product_id)
                        .map((v) => (
                          <Form
                            key={v.id}
                            title={`${v.size} ${v.temperature}`}
                            busy={busy}
                            onSubmit={(f) => save("variant", { ...v, ...f })}
                          >
                            <Select
                              label="Size"
                              name="size"
                              defaultValue={v.size}
                            >
                              <option value="S">S · 12 oz</option>
                              <option value="M">M · 16 oz</option>
                              <option value="L">L · 22 oz</option>
                            </Select>
                            <Select
                              label="Temperature"
                              name="temperature"
                              defaultValue={v.temperature}
                            >
                              <option value="NA">Not applicable</option>
                              <option value="HOT">Hot</option>
                              <option value="ICED">Iced</option>
                            </Select>
                            <Field
                              label="SKU"
                              name="sku"
                              defaultValue={v.sku}
                            />
                            <Field
                              label="Price"
                              name="price"
                              defaultValue={v.price}
                            />
                            <Select
                              label="Active"
                              name="is_active"
                              defaultValue={String(v.is_active)}
                            >
                              <option value="1">Yes</option>
                              <option value="0">No</option>
                            </Select>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => remove("variant", v.id)}
                            >
                              Delete unused variant
                            </button>
                          </Form>
                        ))}
                    </details>
                  ))}
                </section>
              </>
            )}
            {tab === "Recipes" && (
              <section className="vv-card">
                <h2>Explicit recipe per variant</h2>
                <Select
                  label="Variant"
                  value={recipeVariant}
                  onChange={(e) => chooseRecipe(e.target.value)}
                >
                  <option value="">Select a variant</option>
                  {data.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {variantName(v)}
                    </option>
                  ))}
                </Select>
                {rows.map((r, index) => (
                  <div className="vv-recipe" key={index}>
                    <Select
                      label="Ingredient"
                      value={r.ingredient_id}
                      onChange={(e) =>
                        setRows(
                          rows.map((x, i) =>
                            i === index
                              ? { ...x, ingredient_id: e.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="">Select</option>
                      {data.ingredients.map((i) => (
                        <option value={i.ingredient_id} key={i.ingredient_id}>
                          {i.ingredient_name} ({i.unit})
                        </option>
                      ))}
                    </Select>
                    <Field
                      label="Quantity per drink"
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={r.qty}
                      onChange={(e) =>
                        setRows(
                          rows.map((x, i) =>
                            i === index ? { ...x, qty: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <button
                      onClick={() =>
                        setRows(rows.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setRows([...rows, { ingredient_id: "", qty: "" }])
                  }
                >
                  Add ingredient
                </button>
                <button
                  className="vv-primary"
                  disabled={busy || !recipeVariant}
                  onClick={() =>
                    (rows.length ||
                      window.confirm(
                        "Clear this recipe? This variant will be unavailable until a recipe is saved.",
                      )) &&
                    save("recipe", { variant_id: recipeVariant, rows })
                  }
                >
                  Save recipe
                </button>
                <p>
                  Include the correct cup, lid, ice and straw quantities for
                  this variant. No size multipliers or substitutions.
                </p>
              </section>
            )}
            {tab === "Sales" && (
              <>
                <section className="vv-card">
                  <h2>Daily / period sales</h2>
                  <div className="vv-recipe">
                    <Field
                      label="From (Manila)"
                      type="date"
                      value={dates.from}
                      onChange={(e) =>
                        setDates({ ...dates, from: e.target.value })
                      }
                    />
                    <Field
                      label="Through (Manila)"
                      type="date"
                      value={dates.to}
                      onChange={(e) =>
                        setDates({ ...dates, to: e.target.value })
                      }
                    />
                    <button
                      disabled={reportLoading || busy}
                      onClick={loadReport}
                    >
                      Load report
                    </button>
                    <button
                      disabled={reportLoading || busy}
                      onClick={exportCSV}
                    >
                      Export CSV
                    </button>
                    <button
                      disabled={!report || reportLoading}
                      onClick={() => window.print()}
                    >
                      Print report
                    </button>
                  </div>
                  {reportLoading && <p role="status">Loading sales report…</p>}
                  {report && (
                    <>
                      <h3>
                        {report.from === report.to
                          ? "Daily summary (Z-reading)"
                          : "Period report"}
                      </h3>
                      <p>
                        {report.from} through {report.to} ·{" "}
                        {report.totals.count} confirmed sales
                      </p>
                      {!report.sales.length && (
                        <p>No confirmed sales in this period.</p>
                      )}
                      <dl className="vv-totals">
                        <dt>Gross</dt>
                        <dd>{money(report.totals.gross)}</dd>
                        <dt>VATable Sales</dt>
                        <dd>{money(report.totals.net)}</dd>
                        <dt>Output VAT / remittance figure</dt>
                        <dd>{money(report.totals.vat)}</dd>
                        <dt>VAT-Exempt / Zero-Rated</dt>
                        <dd>₱0.00 / ₱0.00</dd>
                      </dl>
                      <p>
                        Stored sale-time VAT. Legacy sales without VAT snapshots
                        are excluded. This is a project summary, not a certified
                        fiscal Z-reading.
                      </p>
                      <div className="vv-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Sale</th>
                              <th>Time</th>
                              <th>Gross</th>
                              <th>Net</th>
                              <th>VAT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.sales.map((s) => (
                              <tr key={s.order_id}>
                                <td>
                                  <button onClick={() => setReceipt(s)}>
                                    #{s.order_id}
                                  </button>
                                </td>
                                <td>{s.sale_at}</td>
                                <td>{money(s.total_gross)}</td>
                                <td>{money(s.total_net)}</td>
                                <td>{money(s.total_vat)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
                <SaleReceipt sale={receipt} />
              </>
            )}
            {tab === "Staff & recovery" && (
              <>
                <div className="vv-forms">
                  <Form
                    title="Create Barista account"
                    busy={busy}
                    onSubmit={(v, f) => save("staff_create", v, f)}
                  >
                    <Field
                      label="Username"
                      name="username"
                      autoComplete="off"
                      required
                    />
                    <Field
                      label="Password (12+ characters)"
                      name="password"
                      type="password"
                      minLength="12"
                      autoComplete="new-password"
                      required
                    />
                  </Form>
                  <Form
                    title="Reset Barista password"
                    busy={busy}
                    onSubmit={(v, f) => save("staff_reset", v, f)}
                  >
                    <Select label="Barista" name="user_id" required>
                      <option value="">Select Barista</option>
                      {data.staff.map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.username}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label="New password"
                      name="password"
                      type="password"
                      minLength="12"
                      autoComplete="new-password"
                      required
                    />
                    <p>
                      All sessions for this Barista will be revoked. Pending
                      orders remain on their device.
                    </p>
                  </Form>
                  <Form
                    title="Issue / replace owner recovery code"
                    busy={busy}
                    onSubmit={(v, f) => save("recovery_issue", v, f)}
                  >
                    <Field
                      label="Current owner password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                    <p>
                      Replaces any previous code. Store it offline. Recovery
                      requires this code and access to the host’s command line.
                    </p>
                  </Form>
                </div>
                {code && (
                  <section className="vv-warning">
                    <h2>Store this code offline now</h2>
                    <code>{code}</code>
                    <p>
                      It is shown only in this session. Run the documented
                      recover_owner.php tool on the host if you lose access.
                    </p>
                    <button onClick={() => setCode(null)}>
                      I stored it; hide code
                    </button>
                  </section>
                )}
              </>
            )}
            {tab === "Audit" && <AuditPanel request={request} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

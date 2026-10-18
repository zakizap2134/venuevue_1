const money = (value) => `₱${Number(value ?? 0).toFixed(2)}`;
export default function SaleReceipt({ sale }) {
  if (!sale) return null;
  return (
    <section className="vv-card" aria-label="Sale receipt">
      <p className="vv-receipt-brand">TravelBean MNL</p>
      <h2>Sale #{sale.order_id} confirmed</h2>
      <p>{sale.sale_at} · Cash</p>
      <div className="vv-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Gross</th>
              <th>Net</th>
              <th>VAT</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((line, i) => (
              <tr key={i}>
                <td>{line.variant_label}</td>
                <td>{line.quantity}</td>
                <td>{money(line.line_gross)}</td>
                <td>{money(line.line_net)}</td>
                <td>{money(line.line_vat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="vv-totals">
        <dt>VATable Sales</dt>
        <dd>{money(sale.total_net)}</dd>
        <dt>VAT (12%)</dt>
        <dd>{money(sale.total_vat)}</dd>
        <dt>VAT-Exempt</dt>
        <dd>₱0.00</dd>
        <dt>Zero-Rated</dt>
        <dd>₱0.00</dd>
        <dt>Total</dt>
        <dd>{money(sale.total_gross)}</dd>
        <dt>Cash received</dt>
        <dd>{money(sale.cash_tendered)}</dd>
        <dt>Change</dt>
        <dd>{money(sale.change_due)}</dd>
      </dl>
      <p className="vv-muted">Project sale confirmation · TravelBean MNL</p>
    </section>
  );
}

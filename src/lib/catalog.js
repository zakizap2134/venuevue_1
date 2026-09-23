/**
 * VenueVue 2.3 - display-only demo catalogue.
 *
 * Every figure in this file is a hard-coded sample used by the dashboard
 * showcase and by the register layout. Nothing here is fetched from the API and
 * nothing the UI does with it is written back:
 *
 *   - the dashboard is a layout preview, so its tiles and feed are static; and
 *   - the register keeps its cart in component state, because checkout is not
 *     wired up yet.
 *
 * The live menu lives in the `products` and `recipe_items` tables. When the
 * register is connected it must post to backend/sync.php, which re-prices every
 * line from the database and refuses any client-supplied amount - so the
 * `price` values below are for display only and are never authoritative.
 */

/**
 * Inventory status vocabulary, shared by every screen so a stock pill always
 * looks the same.
 *
 * The status hexes (#6B8F71 / #E9A23B / #D96868) are swatch colours: as body
 * text they fall short of 4.5:1, so they are only ever used as fills - the dot
 * and the badge border. The label itself sits in --color-on-panel on
 * --color-panel, which clears the bar in both themes.
 */
export const STOCK_STATES = {
  IN: { label: 'In Stock', dot: 'bg-stock-in', border: 'border-stock-in/70' },
  LOW: { label: 'Low Stock', dot: 'bg-stock-low', border: 'border-stock-low/70' },
  OUT: { label: 'Out of Stock', dot: 'bg-stock-out', border: 'border-stock-out/70' },
};

/** Tolerant lookup: an unknown status can never blank out or crash a card. */
export const stockState = (key) => STOCK_STATES[key] ?? STOCK_STATES.IN;

/**
 * Payment badge tones, keyed by the method name stored on an order.
 *
 * Same discipline as the stock pills: the accent carries the dot and the
 * border, the text stays in a token that is legible on a panel.
 */
export const PAYMENT_TONES = {
  Cash: { dot: 'bg-stock-in', border: 'border-stock-in/70' },
  GCash: { dot: 'bg-info', border: 'border-info/70' },
  Card: { dot: 'bg-accent', border: 'border-accent/70' },
};

/** Category tabs in display order. 'All' must stay first - it is the default. */
export const CATEGORIES = ['All', 'Hot Coffee', 'Iced Coffee', 'Non-Coffee', 'Pastry'];

/** The demo menu. `stock` is a STOCK_STATES key. */
export const DEMO_CATALOG = [
  { id: 'iscl', name: 'Iced Salted Caramel Latte', category: 'Iced Coffee', price: 190, stock: 'LOW' },
  { id: 'amer', name: 'Americano', category: 'Hot Coffee', price: 150, stock: 'IN' },
  { id: 'span', name: 'Spanish Latte', category: 'Iced Coffee', price: 180, stock: 'IN' },
  { id: 'carm', name: 'Caramel Macchiato', category: 'Hot Coffee', price: 200, stock: 'OUT' },
  { id: 'matc', name: 'Matcha Latte', category: 'Non-Coffee', price: 185, stock: 'IN' },
  { id: 'choc', name: 'Iced Chocolate', category: 'Non-Coffee', price: 175, stock: 'LOW' },
  { id: 'flat', name: 'Flat White', category: 'Hot Coffee', price: 165, stock: 'IN' },
  { id: 'cros', name: 'Butter Croissant', category: 'Pastry', price: 120, stock: 'IN' },
];

/** Recently completed orders - the dashboard ticker. */
export const DEMO_ORDERS = [
  {
    id: '1042',
    total: 290,
    method: 'Cash',
    ago: '2 mins ago',
    items: 'Iced Salted Caramel Latte ×1 · Americano ×1',
  },
  {
    id: '1041',
    total: 150,
    method: 'GCash',
    ago: '6 mins ago',
    items: 'Americano ×1',
  },
  {
    id: '1040',
    total: 520,
    method: 'Card',
    ago: '9 mins ago',
    items: 'Spanish Latte ×2 · Butter Croissant ×1',
    flag: 'Restock flagged',
  },
  {
    id: '1039',
    total: 190,
    method: 'Cash',
    ago: '14 mins ago',
    items: 'Iced Salted Caramel Latte ×1',
    flag: 'Restock flagged',
  },
  {
    id: '1038',
    total: 360,
    method: 'GCash',
    ago: '18 mins ago',
    items: 'Matcha Latte ×1 · Iced Chocolate ×1',
  },
];

/** The event currently pinned to the venue - shown as a header badge. */
export const ACTIVE_EVENT = {
  name: 'Acoustic Night',
  detail: 'Friday · doors 6:00 PM · 120 seats',
};

/**
 * Headline figures for the dashboard metric cards.
 *
 * `totalOrders` is a transaction count rather than a peso amount so the
 * dashboard can derive an average ticket instead of hard-coding one, and
 * `revenueDeltaPct` is the day-on-day move shown beside today's takings.
 */
export const DEMO_METRICS = {
  revenueToday: 18450,
  revenueDeltaPct: 12.4,
  totalOrders: 142,
};

/**
 * Bestselling drinks, best-first - the dashboard's "Popular Drinks" grid.
 *
 * Pastries are filtered out because the section is a drinks rail, and the three
 * names the design calls out (Iced Salted Caramel Latte, Americano, Spanish
 * Latte) are the first three entries of DEMO_CATALOG.
 */
export const DEMO_POPULAR_DRINKS = DEMO_CATALOG.filter(
  (item) => item.category !== 'Pastry',
).slice(0, 6);

/**
 * Everything the owner has to restock, split the way the alert card shows it.
 *
 * Derived from the catalogue so the badge can never drift away from the tiles
 * it is summarising.
 *
 * @param {Array<{ stock: string }>} [catalog]
 * @returns {{ low: number, out: number, total: number }}
 */
export function stockAlerts(catalog = DEMO_CATALOG) {
  const count = (key) => catalog.filter((item) => item.stock === key).length;
  const low = count('LOW');
  const out = count('OUT');

  return { low, out, total: low + out };
}

/**
 * Apply the dashboard/register search box and category tab to the demo menu.
 * Kept here so the two screens filter identically.
 */
export function filterCatalog(catalog, query, category) {
  const needle = query.trim().toLowerCase();

  return catalog.filter((item) => {
    const inCategory = category === 'All' || item.category === category;
    const matches =
      needle.length === 0 ||
      item.name.toLowerCase().includes(needle) ||
      item.category.toLowerCase().includes(needle);

    return inCategory && matches;
  });
}

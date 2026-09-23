/**
 * VenueVue 2.3 - register screen (/pos).
 *
 * Two-pane workstation: the menu rail with its search and category tabs on the
 * left, the running order on the right. AppShell is asked for an unpadded body
 * so the panes can own the full viewport height.
 *
 * LAYOUT ONLY. The cart is real component state, but nothing is sent anywhere:
 * `Checkout` is deliberately inert because the real transaction has to post to
 * backend/sync.php, which re-prices every line from the database and refuses a
 * client-supplied amount (see the note at the top of src/lib/catalog.js). Until
 * that is wired, the prices below are for display only and are never
 * authoritative.
 *
 * Colour comes from the semantic tokens in src/index.css, so light and dark are
 * both covered without a single `dark:` variant.
 */

import { useState } from 'react';

import AppShell from '../components/AppShell';
import StatusPill from '../components/StatusPill';
import StockBadge from '../components/StockBadge';
import { CATEGORIES, DEMO_CATALOG, filterCatalog } from '../lib/catalog';
import { peso } from '../lib/format';

/* -------------------------------------------------------------------------- */
/* Menu                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A menu tile. Out-of-stock drinks cannot be added to the order.
 *
 * A drink already on the order is painted in the palette's violet "selected /
 * highlight" colour - both the border and a corner chip - so the tile the next
 * tap will bump is obvious without counting cart lines.
 *
 * Hover lifts and rings the tile instead of washing its background: a
 * translucent `bg-accent/10` replaces the opaque `bg-panel` and composites over
 * the page, which is dark in the dark theme, dropping `text-on-panel` to ~1.4:1.
 */
function MenuTile({ item, inCart, qty, onAdd }) {
  const soldOut = item.stock === 'OUT';

  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      disabled={soldOut}
      aria-label={soldOut ? `${item.name} - out of stock` : `Add ${item.name} to the order`}
      className={[
        'relative flex h-full min-h-36 flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left',
        'transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-surface',
        soldOut ? 'cursor-not-allowed border-line bg-panel opacity-60' : '',
        !soldOut && inCart
          ? 'border-accent bg-panel ring-2 ring-accent/40'
          : !soldOut
            ? 'border-line bg-panel enabled:hover:-translate-y-0.5 enabled:hover:border-accent enabled:hover:shadow-lg enabled:hover:shadow-accent/25 enabled:active:scale-[0.98]'
            : '',
      ].join(' ')}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="rounded-full bg-latte px-3 py-1 text-xs font-semibold text-on-latte">
          {item.category}
        </span>

        {inCart && (
          <StatusPill tone="accent" dot={false} className="text-xs">
            In order · ×{qty}
          </StatusPill>
        )}
      </span>

      <span className="text-lg font-bold leading-snug text-on-panel">{item.name}</span>

      <span className="mt-auto flex w-full flex-wrap items-center justify-between gap-2">
        <span className="text-xl font-bold text-brand">{peso.format(item.price)}</span>
        <StockBadge state={item.stock} className="text-xs" />
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                        */
/* -------------------------------------------------------------------------- */

const stepperClass =
  'grid h-12 min-h-12 w-12 min-w-12 place-items-center rounded-lg border-2 border-line ' +
  'bg-panel text-xl font-bold text-on-panel transition-colors ' +
  'enabled:hover:border-info-strong enabled:hover:bg-info/25 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-panel ' +
  'disabled:cursor-not-allowed disabled:text-disabled';

/** One cart line: quantity steppers on the left, money on the right. */
function CartLine({ line, onChangeQty }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="text-lg font-semibold text-on-panel">{line.name}</p>
        <p className="text-lg font-bold text-on-panel">{peso.format(line.price * line.qty)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeQty(line.id, -1)}
            aria-label={`Remove one ${line.name}`}
            className={stepperClass}
          >
            −
          </button>

          <span className="w-10 text-center text-lg font-bold text-on-panel">{line.qty}</span>

          <button
            type="button"
            onClick={() => onChangeQty(line.id, 1)}
            aria-label={`Add one ${line.name}`}
            className={stepperClass}
          >
            +
          </button>

          <button
            type="button"
            onClick={() => onChangeQty(line.id, -line.qty)}
            aria-label={`Remove ${line.name} from the order`}
            className={`${stepperClass} ml-2`}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-on-panel-muted">{peso.format(line.price)} each</p>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                      */
/* -------------------------------------------------------------------------- */

export default function PosScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [lines, setLines] = useState([]);

  const items = filterCatalog(DEMO_CATALOG, query, category);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  /** Add one of `item`, merging into the existing line when there is one. */
  const addItem = (item) => {
    setLines((current) => {
      if (current.some((line) => line.id === item.id)) {
        return current.map((line) =>
          line.id === item.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }

      return [...current, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  /** `delta` may take a line to zero, which drops it from the order. */
  const changeQty = (id, delta) => {
    setLines((current) =>
      current.flatMap((line) => {
        if (line.id !== id) {
          return [line];
        }

        const qty = line.qty + delta;
        return qty > 0 ? [{ ...line, qty }] : [];
      }),
    );
  };

  return (
    <AppShell padded={false}>
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ------------------------------------------------------------ */}
        {/* Menu rail                                                     */}
        {/* ------------------------------------------------------------ */}
        <section
          aria-labelledby="menu-heading"
          className="flex flex-1 flex-col gap-4 p-4 sm:p-6"
        >
          <div>
            <h1 id="menu-heading" className="text-3xl font-bold tracking-tight text-on-surface">
              Register
            </h1>
            <p className="mt-1 text-lg text-on-surface-muted">
              Build an order, then take payment. Checkout is not wired up yet.
            </p>
          </div>

          <div>
            <label htmlFor="menu-search" className="sr-only">
              Search the menu
            </label>
            <input
              id="menu-search"
              type="search"
              autoComplete="off"
              placeholder="Search drinks and pastries…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="block h-14 min-h-12 w-full rounded-xl border-2 border-line bg-panel px-4 text-lg text-on-panel shadow-sm transition-colors placeholder:text-on-panel-muted/60 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand focus:ring-inset"
            />
          </div>

          {/* Category tabs. Scroll sideways rather than wrap, so the rail keeps
              its height on a portrait tablet. The selected tab is the primary
              coffee-brown fill; the rest take the sky-blue hover. */}
          <div
            role="group"
            aria-label="Menu category"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {CATEGORIES.map((name) => {
              const isActive = name === category;

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCategory(name)}
                  aria-pressed={isActive}
                  className={[
                    'h-12 min-h-12 shrink-0 rounded-xl border-2 px-5 text-base font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-surface',
                    isActive
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-line bg-panel text-on-panel hover:border-brand hover:bg-latte hover:text-on-latte',
                  ].join(' ')}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {items.length > 0 ? (
            <div className="grid gap-4 pb-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((item) => {
                const line = lines.find((entry) => entry.id === item.id);

                return (
                  <MenuTile
                    key={item.id}
                    item={item}
                    inCart={Boolean(line)}
                    qty={line?.qty ?? 0}
                    onAdd={addItem}
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-panel p-6 text-lg text-on-panel-muted">
              {query.trim()
                ? `Nothing on the menu matches “${query.trim()}”.`
                : 'Nothing on the menu in this category yet.'}
            </p>
          )}
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Order panel                                                   */}
        {/* ------------------------------------------------------------ */}
        <aside
          aria-labelledby="order-heading"
          className="flex w-full flex-col border-t border-line bg-panel lg:w-96 lg:border-l lg:border-t-0"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id="order-heading" className="text-xl font-bold text-on-panel">
              Current Order
            </h2>
            <button
              type="button"
              onClick={() => setLines([])}
              disabled={lines.length === 0}
              className="h-12 min-h-12 rounded-xl border-2 border-line px-4 text-base font-semibold text-on-panel transition-colors enabled:hover:border-info-strong enabled:hover:bg-info/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-panel disabled:cursor-not-allowed disabled:text-disabled"
            >
              Clear
            </button>
          </div>

          {lines.length > 0 ? (
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {lines.map((line) => (
                <CartLine key={line.id} line={line} onChangeQty={changeQty} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl bg-latte text-on-latte"
                aria-hidden="true"
              >
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4.5 9h12v4.5a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5V9Z" />
                  <path d="M16.5 10.5h1.75a2.25 2.25 0 0 1 0 4.5H16.5" />
                  <path d="M8.5 3.5V6M12 2.5V6" />
                </svg>
              </span>
              <p className="text-lg font-semibold text-on-panel">No items yet</p>
              <p className="text-base text-on-panel-muted">
                Tap a drink or a pastry to start the order.
              </p>
            </div>
          )}

          <div className="border-t border-line px-5 py-4">
            <div className="flex items-center justify-between text-base text-on-panel-muted">
              <span>Items</span>
              <span className="font-semibold text-on-panel">{itemCount}</span>
            </div>

            <div className="mt-2 flex items-center justify-between text-2xl font-bold text-on-panel">
              <span>Total</span>
              <span>{peso.format(total)}</span>
            </div>

            {/* Full-strength brand fill so the action reads as the primary
                control on the screen. It is `disabled` because the real
                transaction has to post to backend/sync.php, which re-prices
                every line server-side; the sub-label says so rather than
                relying on a dimmed opacity that would undercut it. */}
            <button
              type="button"
              disabled
              className="mt-4 flex h-16 min-h-12 w-full cursor-not-allowed flex-col items-center justify-center rounded-xl bg-brand shadow-lg shadow-brand/20"
            >
              <span className="text-xl font-bold text-on-brand">Charge</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-on-brand/80">
                Not wired up yet
              </span>
            </button>

            <p className="mt-3 text-sm text-on-panel-muted">
              When this is wired, the order posts to backend/sync.php, which re-prices every
              line from the database.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

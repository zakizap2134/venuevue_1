/**
 * VenueVue 2.3 - shared dashboard (/dashboard).
 *
 * The operational overview for both roles: a row of headline metrics, a POS
 * quick-view (bestselling drinks beside the live order feed) and a touch-first
 * action bar.
 *
 * LAYOUT PREVIEW. Every figure comes from src/lib/catalog.js, which is
 * display-only sample data - this screen reads nothing from the API and writes
 * nothing back. Tapping a drink tile highlights it and does no more than that;
 * the register owns the cart.
 *
 * Colour comes from the semantic tokens in src/index.css, so light and dark are
 * both covered without a single `dark:` variant. Status hexes are used as fills
 * (dots, borders, washes) only, because as body text they miss 4.5:1 - see the
 * note at the top of src/lib/catalog.js.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import AppShell from '../components/AppShell';
import LogoPlaceholder from '../components/LogoPlaceholder';
import StatusPill from '../components/StatusPill';
import StockBadge from '../components/StockBadge';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import {
  ACTIVE_EVENT,
  DEMO_METRICS,
  DEMO_ORDERS,
  DEMO_POPULAR_DRINKS,
  PAYMENT_TONES,
  filterCatalog,
  stockAlerts,
} from '../lib/catalog';
import { peso } from '../lib/format';
import { VENUE_NETWORK } from '../lib/operations';

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

/** One stroke weight and one viewBox for every glyph on the screen. */
function Icon({ children, className = 'h-6 w-6' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const revenueIcon = (
  <Icon>
    <path d="M7 20V4h5.5a4.5 4.5 0 0 1 0 9H7" />
    <path d="M4 13h9M4 17h9" />
  </Icon>
);

const eventIcon = (
  <Icon>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 11h18" />
  </Icon>
);

const ordersIcon = (
  <Icon>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </Icon>
);

const alertIcon = (
  <Icon>
    <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M10.5 20a1.5 1.5 0 0 0 3 0" />
  </Icon>
);

const registerIcon = (
  <Icon>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
  </Icon>
);

/* -------------------------------------------------------------------------- */
/* Metric cards                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One headline figure.
 *
 * The icon sits in a translucent wash of the accent so the glyph itself can stay
 * in --color-on-panel: that is legible on every wash in both themes, which the
 * accent hexes on their own are not.
 */
function MetricCard({ label, value, hint, icon, wash }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border-2 border-line bg-panel p-5 shadow-md shadow-brand/5 transition-shadow hover:shadow-lg hover:shadow-brand/10">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-on-panel-muted">
          {label}
        </h3>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${wash}`}>
          {icon}
        </span>
      </div>

      <p className="text-3xl font-bold leading-tight text-on-panel">{value}</p>

      {hint && <p className="text-sm text-on-panel-muted">{hint}</p>}
    </article>
  );
}

/** Today's restock count, drawn in the low-stock palette. */
function AlertCount({ total }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-2 border-stock-low bg-stock-low/15 px-4 py-1 text-2xl font-bold text-on-panel">
      <span className="h-2.5 w-2.5 rounded-full bg-stock-low" aria-hidden="true" />
      {total}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* POS quick-view                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A touchable product tile. Disabled when the drink is off the menu, selected
 * state painted in the violet accent - the palette's "selected / highlight".
 *
 * The hover lifts the tile and rings it violet rather than washing the
 * background: a translucent `bg-accent/10` would *replace* the opaque
 * `bg-panel`, so it would composite over the page - dark in the dark theme -
 * and leave the charcoal `text-on-panel` at about 1.4:1.
 */
function DrinkTile({ item, isHighlighted, onHighlight }) {
  const soldOut = item.stock === 'OUT';

  return (
    <button
      type="button"
      onClick={() => onHighlight(item.id)}
      disabled={soldOut}
      aria-pressed={isHighlighted}
      className={[
        'flex h-full min-h-40 flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-surface',
        soldOut
          ? 'cursor-not-allowed border-line bg-panel opacity-60'
          : 'active:scale-[0.98]',
        !soldOut && isHighlighted
          ? 'border-accent bg-panel ring-2 ring-accent/40'
          : !soldOut
            ? 'border-line bg-panel hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-accent/25'
            : '',
      ].join(' ')}
    >
      <span className="rounded-full bg-latte px-3 py-1 text-sm font-semibold text-on-latte">
        {item.category}
      </span>

      <span className="text-xl font-bold leading-snug text-on-panel">{item.name}</span>

      {/* mt-auto pins the price + stock row to the bottom of every tile, so the
          row stays level across a grid of differently-wrapping names. */}
      <span className="mt-auto flex w-full flex-wrap items-center justify-between gap-3">
        <span className="text-2xl font-bold text-brand">{peso.format(item.price)}</span>
        <StockBadge state={item.stock} />
      </span>
    </button>
  );
}

/**
 * `Order #1042 · ₱290.00 · Cash · 2 mins ago`, one line per completed order.
 *
 * The payment badge keeps the accent on the dot and the border, with the label
 * in a panel-legible token, and a ticket that drained a low item carries the
 * amber restock pill.
 */
function OrderRow({ order }) {
  const tone = PAYMENT_TONES[order.method] ?? PAYMENT_TONES.Cash;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4">
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-on-panel">
            Order #{order.id}
          </span>
          {order.items && (
            <span className="block truncate text-sm text-on-panel-muted">{order.items}</span>
          )}
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-lg font-bold text-on-panel">{peso.format(order.total)}</span>
        <span
          className={`inline-flex min-h-8 items-center rounded-full border-2 bg-panel px-3 py-1 text-sm font-semibold text-on-panel ${tone.border}`}
        >
          {order.method}
        </span>
        {order.flag && <StatusPill tone="low">{order.flag}</StatusPill>}
        <span className="min-w-24 text-right text-sm text-on-panel-muted">{order.ago}</span>
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick navigation                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Only the register has a route today, so the other two are rendered as
 * disabled buttons with a "Soon" chip rather than as links that would bounce
 * the user straight back here.
 */
const QUICK_ACTIONS = [
  { label: 'Go to Register', to: '/pos', icon: registerIcon },
  { label: 'Restock List', soon: true },
  { label: 'Export Reports', soon: true },
];

function QuickAction({ action }) {
  // The two shells are fully opaque and differ only in fill, so the inactive
  // actions stay legible on the card behind them instead of relying on a
  // translucent brand wash that muddies both themes.
  const shell =
    'flex h-16 min-h-12 w-full items-center justify-between gap-3 rounded-xl px-5 text-lg font-bold ' +
    'transition-colors focus:outline-none focus:ring-4 focus:ring-info-strong';

  if (action.to) {
    return (
      <Link
        to={action.to}
        className={`${shell} bg-brand text-on-brand shadow-md shadow-brand/10 enabled:hover:bg-info enabled:hover:text-on-panel`}
      >
        <span className="flex items-center gap-3">
          {action.icon}
          {action.label}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled
      className={`${shell} cursor-not-allowed border-2 border-dashed border-line bg-panel text-on-panel-muted`}
    >
      {action.label}
      <span className="rounded-full bg-latte px-3 py-1 text-xs font-semibold uppercase tracking-wide text-on-latte">
        Soon
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                      */
/* -------------------------------------------------------------------------- */

const TODAY_FORMAT = new Intl.DateTimeFormat('en-PH', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export default function DashboardScreen() {
  const { user } = useAuth();

  // Display-only selection: the accent ring is the whole feature.
  const [highlighted, setHighlighted] = useState(null);
  const [query, setQuery] = useState('');

  const alerts = stockAlerts();
  const averageTicket = DEMO_METRICS.revenueToday / DEMO_METRICS.totalOrders;

  // The header search narrows the popular grid in place, through the same
  // helper the register uses, so both screens match a substring identically.
  const visibleDrinks = useMemo(
    () => filterCatalog(DEMO_POPULAR_DRINKS, query, 'All'),
    [query],
  );

  return (
    <AppShell>
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ---------------------------------------------------------------- */}
      <header className="rounded-3xl bg-brand p-6 shadow-xl shadow-brand/20 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <LogoPlaceholder
              tone="brand"
              size="lg"
              subtitle="Point of sale · front counter"
            />

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-on-brand sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-1 text-lg text-on-brand/80">
              Signed in as{' '}
              <span className="font-semibold text-on-brand">{user?.username}</span>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              {TODAY_FORMAT.format(new Date())}
            </p>
          </div>

          {/* Venue identity + device controls. Both pills use the latte fill
              rather than a translucent status wash: over the coffee-brown band a
              /15 wash stays dark, and the label would have gone dark on dark. */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone="latte" dot={false} className="h-12">
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Active event: <strong className="font-bold">{ACTIVE_EVENT.name}</strong>
            </StatusPill>

            <StatusPill tone="latte" dot={false} className="h-12">
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
                <path d="M12 20h.01" />
              </svg>
              Hotspot{' '}
              <code className="font-mono text-base font-bold">{VENUE_NETWORK.host}</code>
            </StatusPill>

            <ThemeToggle tone="brand" />
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Top metric cards                                               */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="metrics-heading" className="mt-8">
        <h2 id="metrics-heading" className="sr-only">
          Today at a glance
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Today's Revenue"
            value={peso.format(DEMO_METRICS.revenueToday)}
            hint={
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-stock-in"
                  aria-hidden="true"
                />
                +{DEMO_METRICS.revenueDeltaPct}% vs. yesterday
              </span>
            }
            icon={revenueIcon}
            wash="bg-latte text-on-latte"
          />

          <MetricCard
            label="Active Event"
            value={ACTIVE_EVENT.name}
            hint={ACTIVE_EVENT.detail}
            icon={eventIcon}
            wash="bg-accent/20 text-on-panel"
          />

          <MetricCard
            label="Total Orders"
            value={DEMO_METRICS.totalOrders}
            hint={`Average ticket ${peso.format(averageTicket)}`}
            icon={ordersIcon}
            wash="bg-info/20 text-on-panel"
          />

          <MetricCard
            label="Low Stock Alerts"
            value={<AlertCount total={alerts.total} />}
            hint={`${alerts.low} low · ${alerts.out} out of stock`}
            icon={alertIcon}
            wash="bg-stock-low/20 text-on-panel"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. POS quick-view                                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {/* Popular drinks -------------------------------------------------- */}
        <section aria-labelledby="popular-heading" className="xl:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="popular-heading" className="text-2xl font-bold text-on-surface">
                Popular Drinks
              </h2>
              <p className="text-base text-on-surface-muted">
                Bestsellers today. Tap a tile to highlight it - checkout happens on the
                register.
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              {/* Search / filter. It narrows the Popular Drinks grid in place, so
                  the field is a working filter rather than decoration. h-12 keeps
                  it on the 48px touch grid. */}
              <div className="relative w-full sm:w-64">
                <svg
                  className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-panel-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>

                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search popular drinks"
                  placeholder="Search popular drinks…"
                  className="h-12 w-full rounded-xl border-2 border-line bg-panel pl-11 pr-4 text-base text-on-panel placeholder:text-on-panel-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand focus:ring-inset"
                />
              </div>

              <span className="rounded-full bg-latte px-3 py-1 text-sm font-semibold text-on-latte">
                {query.trim()
                  ? `${visibleDrinks.length} matching`
                  : `Top ${DEMO_POPULAR_DRINKS.length}`}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDrinks.map((item) => (
              <DrinkTile
                key={item.id}
                item={item}
                isHighlighted={highlighted === item.id}
                onHighlight={(id) =>
                  setHighlighted((current) => (current === id ? null : id))
                }
              />
            ))}
          </div>

          {visibleDrinks.length === 0 && (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center text-base font-medium text-on-surface-muted">
              Nothing on the popular list matches “{query.trim()}”.
            </p>
          )}
        </section>

        {/* Live order feed ------------------------------------------------- */}
        <section aria-labelledby="feed-heading">
          <h2 id="feed-heading" className="text-2xl font-bold text-on-surface">
            Live Order Feed
          </h2>
          <p className="text-base text-on-surface-muted">Most recent completed tickets.</p>

          <div className="mt-4 overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-md shadow-brand/5">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-on-panel-muted">
                Completed
              </span>

              <StatusPill tone="in">Live</StatusPill>
            </div>
            <ul className="divide-y divide-line">
              {DEMO_ORDERS.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Quick navigation bar                                           */}
      {/* ---------------------------------------------------------------- */}
      <nav
        aria-label="Quick actions"
        className="mt-10 rounded-2xl border-2 border-line bg-panel p-4 shadow-md shadow-brand/5 sm:p-5"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-panel-muted">
          Quick Actions
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <QuickAction key={action.label} action={action} />
          ))}
        </div>
      </nav>

      <p className="mt-6 text-sm text-on-surface-muted">
        Sample data for layout review. Live figures appear once the register posts to
        backend/sync.php.
      </p>
    </AppShell>
  );
}

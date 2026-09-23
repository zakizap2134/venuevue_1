/**
 * VenueVue 2.3 - inventory status pill.
 *
 * Shared by the dashboard cards and the register tiles so one status always
 * looks the same in both places. `state` is a STOCK_STATES key; an unknown key
 * falls back to "In Stock" rather than rendering nothing.
 *
 * The badge paints its own --color-panel background, so it is safe to drop onto
 * a latte card or a plain panel without the fill blending into either one.
 */

import { stockState } from '../lib/catalog';

export default function StockBadge({ state, text, className = '' }) {
  const styles = stockState(state);

  return (
    <span
      className={
        'inline-flex min-h-8 items-center gap-2 rounded-full border-2 bg-panel px-3 py-1 ' +
        `text-sm font-semibold text-on-panel ${styles.border} ${className}`
      }
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
      {text ?? styles.label}
    </span>
  );
}

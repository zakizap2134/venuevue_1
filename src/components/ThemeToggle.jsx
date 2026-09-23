/**
 * VenueVue 2.3 - light / dark switch.
 *
 * A 56px square target, so it clears the 48px touch floor on a tablet without
 * crowding the header. `tone` picks the palette for the surface it sits on:
 * 'brand' for the coffee-brown header bar, 'surface' for a page background.
 */

import { useTheme } from '../context/ThemeContext';

/** Both icons are decorative; the button carries the accessible name. */
function SunIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
    </svg>
  );
}

export default function ThemeToggle({ tone = 'surface', className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  /**
   * `brand` sits on the coffee-brown bar, `panel` on an opaque light panel, and
   * `page` directly on `bg-surface`. The two page-level tones hover to an opaque
   * sky-blue fill, because a translucent `bg-info/25` would replace the button's
   * own `bg-panel` and composite over the page - dark in the dark theme - under
   * `text-on-panel`. Each tone also rings with the token that is visible against
   * what is actually behind it.
   */
  const toneClass = {
    brand: 'border-on-brand/40 text-on-brand hover:border-info hover:bg-info/40 focus-visible:ring-info',
    panel: 'border-line bg-panel text-on-panel hover:border-info hover:bg-info focus-visible:ring-on-panel/60',
    surface:
      'border-line bg-panel text-on-panel hover:border-info hover:bg-info focus-visible:ring-on-surface',
  }[tone];

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className={`inline-flex h-14 min-h-12 w-14 min-w-12 items-center justify-center rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 ${toneClass} ${className}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

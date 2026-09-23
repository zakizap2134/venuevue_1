/**
 * Shared header for the signed-in screens.
 *
 * Reads its data straight from the auth context, so it always reflects the
 * session the router is enforcing - no props to thread through. The band uses
 * the coffee-brown --color-brand token, which is high-contrast in both themes,
 * so it needs no `dark:` variants.
 *
 * Everything on this bar sits on a dark fill, so every interactive state is
 * painted for a dark fill and nothing else: hover is the sky-blue accent wash
 * with the label lifted to full cream strength, focus is a sky-blue ring, and the
 * current section is marked with the violet accent. That is the one place the
 * accent hexes are safe to use at full strength - on coffee brown the violet
 * clears 3:1 as an indicator, and on a white panel the same hex would not.
 */

import { NavLink } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import LogoPlaceholder from './LogoPlaceholder';
import StatusPill from './StatusPill';
import ThemeToggle from './ThemeToggle';

/** One 20px glyph per destination, drawn in currentColor. */
const NAV_ICONS = {
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
      <path d="M9.5 12.5l2 2 3.5-4" />
    </>
  ),
};

/** Every destination the signed-in shell exposes, in nav order. */
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: NAV_ICONS.grid },
  { to: '/pos', label: 'Register', icon: NAV_ICONS.receipt },
  { to: '/admin', label: 'Back Office', icon: NAV_ICONS.shield, ownerOnly: true },
];

export default function SessionBar() {
  const { user, logout } = useAuth();

  // The back office is OWNER-only, so hide its tab from baristas instead of
  // offering a link that would bounce them straight back.
  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || user?.role === 'OWNER');

  const controlRing = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-info';

  return (
    <header className="sticky top-0 z-30 border-b border-on-brand/15 bg-brand px-4 py-3 shadow-lg sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Brand lockup plus the role badge. The pair is one flex group with
            `mr-auto`, so it holds the left edge and the controls stay on the
            right at every width; the role pill is the status read-out that used
            to be buried in the subtitle. */}
        <div className="mr-auto flex min-w-0 flex-wrap items-center gap-3">
          <LogoPlaceholder tone="brand" size="md" subtitle={user?.username} />

          <StatusPill
            tone="latte"
            dot={false}
            className="uppercase tracking-wide"
          >
            {user?.role ?? 'guest'}
          </StatusPill>
        </div>

        {/* On narrow screens the nav drops to its own full-width row so three
            48px tabs cannot crush each other in portrait; from `lg` it sits
            inline between the lockup and the controls. */}
        <nav
          aria-label="Signed-in sections"
          className="order-3 flex w-full flex-wrap items-center gap-2 lg:order-2 lg:w-auto"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex h-14 min-h-12 items-center gap-2.5 rounded-xl border-2 px-5 text-base font-semibold',
                  'transition-colors',
                  controlRing,
                  isActive
                    ? 'border-accent bg-accent/30 text-on-brand'
                    : 'border-transparent text-on-brand/80 hover:border-info/60 hover:bg-info/40 hover:text-on-brand',
                ].join(' ')
              }
            >
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
                {item.icon}
              </svg>

              {item.label}
            </NavLink>
          ))}
        </nav>

        <ThemeToggle tone="brand" className="order-2 lg:order-3" />

        <button
          type="button"
          onClick={logout}
          className={`order-2 h-14 min-h-12 rounded-xl border-2 border-on-brand/40 px-6 text-lg font-semibold text-on-brand transition-colors hover:border-info hover:bg-info/40 lg:order-4 ${controlRing}`}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

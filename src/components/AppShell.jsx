/**
 * VenueVue 2.3 - signed-in page shell.
 *
 * Wraps every authenticated screen so the header, the page background and the
 * content container are defined exactly once. Screens pass only their content.
 *
 * There is deliberately no width cap anywhere in here: the column is `w-full`
 * with breakpoint-driven padding, so the layout keeps expanding on a 27"
 * back-office monitor instead of stranding a fixed-width column in the middle.
 * Screens control their own internal grids from there.
 *
 * `padded` is off for screens that need to own the full viewport height, such
 * as the register's two-pane layout.
 */

import SessionBar from './SessionBar';

export default function AppShell({ children, padded = true, className = '' }) {
  const padding = padded ? 'px-4 py-6 sm:px-6 lg:px-8 xl:px-10' : '';

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface">
      <SessionBar />
      <main className={`flex w-full flex-1 flex-col ${padding} ${className}`}>{children}</main>
    </div>
  );
}

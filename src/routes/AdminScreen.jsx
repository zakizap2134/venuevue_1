/**
 * VenueVue 2.3 - OWNER console (/admin).
 *
 * The back office view: who is signed in on this terminal, what the audit trail
 * recorded today, and the query that produces those rows. Reached only through
 * <RequireRole role="OWNER">.
 *
 * PRESENTATIONAL. The audit rows come from src/lib/operations.js and mirror the
 * shape of the `audit_logs` table, but nothing here reads or writes it - the
 * viewer is a layout preview until it is pointed at an endpoint. The same file
 * holds the hotspot address and the register route, which are configuration
 * rather than anything the page could detect.
 *
 * Colour comes from the semantic tokens in src/index.css, so light and dark are
 * both covered without a single `dark:` variant. Status hexes are fills (dots,
 * borders, washes); every label sits in an on-* partner - see the note at the top
 * of src/components/StatusPill.jsx.
 */

import { Link } from 'react-router-dom';

import AppShell from '../components/AppShell';
import CodeBlock from '../components/CodeBlock';
import LogoPlaceholder from '../components/LogoPlaceholder';
import StatusPill from '../components/StatusPill';
import ThemeToggle from '../components/ThemeToggle';
import { ROLE_ROUTES, useAuth } from '../context/AuthContext';
import {
  AUDIT_QUERY,
  DEMO_AUDIT_EVENTS,
  REGISTER_ROUTE,
  VENUE_NETWORK,
  auditSummary,
} from '../lib/operations';
import { getTabletId } from '../lib/tablet';

/* -------------------------------------------------------------------------- */
/* Access panel                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One labelled value in the access panel.
 *
 * The panel sits on the coffee-brown band, so the value is always an opaque
 * latte pill: a translucent status wash would stay dark there and leave the
 * label dark on dark.
 */
function AccessField({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-on-brand/80">
        {label}
      </dt>
      <dd className="mt-2 flex min-w-0 flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit summary                                                               */
/* -------------------------------------------------------------------------- */

/** One headline count above the audit table. */
function StatCard({ label, value, hint, tone }) {
  return (
    <article className="flex h-full flex-col gap-2 rounded-2xl border-2 border-line bg-panel p-5 shadow-md shadow-brand/5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-on-panel-muted">
        {label}
      </h3>
      <p className="flex items-center gap-3 text-3xl font-bold leading-tight text-on-panel">
        <span className={`h-3 w-3 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
        {value}
      </p>
      <p className="text-sm text-on-panel-muted">{hint}</p>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                      */
/* -------------------------------------------------------------------------- */

export default function AdminScreen() {
  const { user } = useAuth();

  const summary = auditSummary();
  const tabletId = getTabletId();

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
              Back Office
            </h1>
            <p className="mt-1 text-lg text-on-surface-muted">
              Owner console - reports, staff and the audit trail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone="neutral">Read-only preview</StatusPill>
            <ThemeToggle />
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* System access panel                                               */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="access-heading"
          className="rounded-3xl bg-brand p-6 shadow-xl shadow-brand/20 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="min-w-0">
              <LogoPlaceholder tone="brand" size="lg" subtitle="Owner console" />

              <h2 id="access-heading" className="mt-5 text-2xl font-bold text-on-brand">
                System access
              </h2>
              <p className="mt-1 max-w-prose text-base text-on-brand/80">
                This terminal holds an {user?.role} session. The register is a separate
                route, so the floor keeps selling while the back office is open.
              </p>
            </div>

            <dl className="grid w-full gap-5 sm:grid-cols-2 lg:w-auto lg:min-w-[28rem]">
              <AccessField label="Active session">
                <StatusPill tone="latte" dot={false}>
                  {user?.role}
                </StatusPill>
                <span className="text-sm text-on-brand/80">signed in as {user?.username}</span>
              </AccessField>

              <AccessField label="Current route">
                <StatusPill as="code" tone="latte" dot={false} className="font-mono">
                  {ROLE_ROUTES[user?.role] ?? '/admin'}
                </StatusPill>
              </AccessField>

              <AccessField label="Register route">
                <StatusPill as="code" tone="latte" dot={false} className="font-mono">
                  {REGISTER_ROUTE}
                </StatusPill>
                <span className="text-sm text-on-brand/80">
                  where a BARISTA session lands
                </span>
              </AccessField>

              <AccessField label="Tablet">
                <StatusPill as="code" tone="latte" dot={false} className="font-mono">
                  {tabletId}
                </StatusPill>
                <span className="text-sm text-on-brand/80">injected automatically</span>
              </AccessField>
            </dl>
          </div>

          <p className="mt-6 border-t border-on-brand/20 pt-4 text-sm text-on-brand/80">
            {VENUE_NETWORK.label}: tablets reach this console at{' '}
            <code className="font-mono text-on-brand">
              {VENUE_NETWORK.host}:{VENUE_NETWORK.port}
            </code>{' '}
            - no internet connection involved.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Audit summary                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="sr-only">
            Audit summary
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Audit events today"
              value={summary.total}
              hint="Logins, syncs, stock warnings and order commits"
              tone="bg-accent"
            />
            <StatCard
              label="Orders committed"
              value={summary.commits}
              hint="Posted through backend/sync.php"
              tone="bg-info"
            />
            <StatCard
              label="Refused or failed"
              value={summary.denied}
              hint="RBAC denials and failed logins"
              tone="bg-stock-out"
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Security and audit feed                                           */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="audit-heading"
          className="overflow-hidden rounded-2xl border-2 border-line bg-panel shadow-md shadow-brand/5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-5">
            <div>
              <h2 id="audit-heading" className="text-2xl font-bold text-on-panel">
                Security &amp; audit feed
              </h2>
              <p className="text-base text-on-panel-muted">
                Newest first. Sample rows in the shape of the audit_logs table.
              </p>
            </div>

            <StatusPill tone="in">Append-only</StatusPill>
          </div>

          {/* The table is wider than a portrait tablet, so it scrolls sideways
              rather than crushing the detail column. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">Recent audit events, newest first</caption>

              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-panel-muted"
                  >
                    Time
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-panel-muted"
                  >
                    Event
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-panel-muted"
                  >
                    Actor
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-panel-muted"
                  >
                    IP address
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-panel-muted"
                  >
                    Detail
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {DEMO_AUDIT_EVENTS.map((event) => (
                  <tr key={event.id} className="transition-colors hover:bg-latte/20">
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-on-panel">
                      {event.at}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={event.tone} className="whitespace-nowrap font-mono">
                        {event.action}
                      </StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-on-panel">
                      {event.actor}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-on-panel-muted">
                      {event.ip}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-panel-muted">{event.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Query reference                                                   */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="query-heading">
          <h2 id="query-heading" className="text-2xl font-bold text-on-surface">
            Query reference
          </h2>
          <p className="mt-1 max-w-prose text-base text-on-surface-muted">
            The statement behind the table above. The audit trail is append-only, so this
            is a read that can be run as-is against the VenueVue database.
          </p>

          <CodeBlock
            code={AUDIT_QUERY}
            title="Audit trail - today's events"
            caption="read-only"
            collapsible
            defaultOpen={false}
            className="mt-4"
          />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Footer navigation                                                 */}
        {/* ---------------------------------------------------------------- */}
        <p className="text-base text-on-surface-muted">
          Back to the operational overview on the{' '}
          <Link
            to="/dashboard"
            className="rounded font-semibold text-on-surface underline decoration-2 underline-offset-4 transition-colors hover:text-link focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-surface"
          >
            dashboard
          </Link>
          , or open the{' '}
          <Link
            to={REGISTER_ROUTE}
            className="rounded font-semibold text-on-surface underline decoration-2 underline-offset-4 transition-colors hover:text-link focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-surface"
          >
            register
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
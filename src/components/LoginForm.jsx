/**
 * VenueVue 2.3 - Tablet login screen (React 19 + Tailwind CSS 4).
 *
 * Sized for POS hardware: every interactive element clears the 48px touch-
 * target floor, and type stays large and high-contrast. From `lg` up the page
 * becomes a two-pane split - a brand panel plus the form column - so a
 * landscape tablet or desktop monitor is filled rather than showing one
 * narrow centred card. A successful sign-in routes the user by role -
 * BARISTA -> /pos, OWNER -> /admin.
 *
 * There is no tablet field. AuthContext injects getTabletId() into the auth.php
 * payload (see src/lib/tablet.js), so staff neither see nor type a device id.
 *
 * Colour comes from the semantic tokens in src/index.css, so this screen
 * follows the light / dark palette without any `dark:` variants.
 *
 * Requires react-router-dom v6/v7 for navigation and AuthProvider higher in
 * the tree.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROLE_ROUTES, useAuth } from '../context/AuthContext';
import { getTabletId } from '../lib/tablet';
import LogoPlaceholder from './LogoPlaceholder';
import StatusPill from './StatusPill';
import ThemeToggle from './ThemeToggle';

/**
 * Reused for every input: 56px tall, large type, and a solid brand focus ring.
 * The ring is inset on purpose: an outer ring is painted on whatever sits behind
 * the field, which on a dark page makes the coffee-brown halo disappear.
 */
const inputClass =
  'block w-full h-14 min-h-12 px-4 text-lg text-on-panel ' +
  'bg-panel border-2 rounded-xl shadow-sm transition-colors ' +
  'placeholder:text-on-panel-muted/60 ' +
  'focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand focus:ring-inset ' +
  'disabled:bg-disabled/30 disabled:text-disabled';

/** Reused for every label. */
const labelClass = 'block mb-2 text-base font-semibold text-on-panel';

export default function LoginForm() {
  const { login, isLoading, error, clearError, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const usernameRef = useRef(null);

  const [form, setForm] = useState({ username: '', password: '' });

  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState({});

  /** Send the user to their role's landing page. */
  const routeByRole = (role) => navigate(ROLE_ROUTES[role] ?? '/', { replace: true });

  // Auto-redirect whenever the context becomes authenticated - this covers
  // both the post-login state and an already-signed-in page load.
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      routeByRole(user.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, navigate]);

  // Tablets open straight onto the username field.
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const updateField = (name) => (event) => {
    setForm((previous) => ({ ...previous, [name]: event.target.value }));
    setValidation((previous) => ({ ...previous, [name]: undefined }));
    if (error) clearError();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Client-side guard so one empty field does not cost a round trip.
    const problems = {};
    if (!form.username.trim()) problems.username = 'Enter your username.';
    if (!form.password) problems.password = 'Enter your password.';

    setValidation(problems);
    if (Object.keys(problems).length > 0) return;

    try {
      // No tablet argument: the context injects the device id for us.
      const signedInUser = await login(form.username, form.password);
      routeByRole(signedInUser.role);
    } catch {
      // The failure is already surfaced through the auth context's `error`.
    }
  };

  const disabled = isLoading;

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center bg-surface lg:flex-row lg:items-stretch">
      {/* Kept off the panels so the theme can be changed before signing in. */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Fluid brand panel. It only appears from `lg` up, where there is spare
          width to spend; below that the login card stays a centred column. */}
      <section className="hidden w-full flex-col justify-center gap-6 bg-brand px-10 py-16 lg:flex lg:w-2/5 xl:w-1/2">
        <LogoPlaceholder tone="brand" size="lg" showWordmark={false} />

        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-brand xl:text-5xl">
            VenueVue
          </h1>
          <p className="mt-3 text-lg text-on-brand/80 xl:text-xl">
            Offline point of sale for the venue floor. Everything runs on the shop LAN -
            no internet connection required.
          </p>
        </div>

        <p className="text-base font-semibold text-on-brand/80">
          Sign in to your workstation
        </p>
      </section>

      <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 lg:px-10 lg:py-16">
        {/* ---------------------------------------------------------------- */}
        {/* Header (narrow screens only - the brand panel replaces it at `lg`) */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-8 w-full max-w-md text-center lg:hidden">
          <LogoPlaceholder
            tone="panel"
            size="lg"
            showWordmark={false}
            className="mb-4 justify-center"
          />

          <h1 className="text-3xl font-bold tracking-tight text-on-surface">VenueVue</h1>
          <p className="mt-2 text-lg text-on-surface-muted">Sign in to your workstation</p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Card                                                              */}
        {/* ---------------------------------------------------------------- */}
        <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-latte bg-panel shadow-2xl shadow-brand/10">
          {/* Latte rule across the top of the card - the one flourish that makes
              the form read as a coffee-shop counter card rather than a plain
              panel. */}
          <div className="h-2 w-full bg-latte" aria-hidden="true" />

          <div className="p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-on-panel">Sign in</h2>
                <p className="mt-1 text-base text-on-panel-muted">
                  Use your VenueVue staff account.
                </p>
              </div>

              {/* The device id is never typed: this pill reports the value
                  localStorage already holds, which auth.php and sync.php are
                  stamped with automatically. */}
              <StatusPill
                as="code"
                tone="latte"
                dot={false}
                className="font-mono text-xs"
                title="Assigned to this tablet automatically"
              >
                {getTabletId()}
              </StatusPill>
            </div>

            {/* Server / network error banner. */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-6 flex min-h-12 items-center gap-3 rounded-xl border-2 border-stock-out bg-stock-out/15 px-4 py-3"
              >
                <svg
                  className="h-6 w-6 flex-shrink-0 text-stock-out"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {/* The out-of-stock hex is a fill colour, not a text colour: it
                    carries the icon and the border while the message itself stays
                    in --color-on-panel, which is legible in both themes. */}
                <p className="text-base font-semibold text-on-panel">{error}</p>
              </div>
            )}

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* ---------------------------------------------------------- */}
            {/* Username                                                     */}
            {/* ---------------------------------------------------------- */}
            <div>
              <label htmlFor="username" className={labelClass}>
                Username
              </label>
              <input
                ref={usernameRef}
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="barista"
                value={form.username}
                onChange={updateField('username')}
                disabled={disabled}
                aria-invalid={Boolean(validation.username)}
                aria-describedby={validation.username ? 'username-error' : undefined}
                className={`${inputClass} ${
                  validation.username
                    ? 'border-stock-out focus:ring-stock-out'
                    : 'border-line focus:border-brand'
                }`}
              />
              {validation.username && (
                <p
                  id="username-error"
                  className="mt-2 flex items-center gap-2 text-base font-semibold text-on-panel"
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-stock-out" aria-hidden="true" />
                  {validation.username}
                </p>
              )}
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Password (with show / hide toggle)                           */}
            {/* ---------------------------------------------------------- */}
            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={updateField('password')}
                  disabled={disabled}
                  aria-invalid={Boolean(validation.password)}
                  aria-describedby={validation.password ? 'password-error' : undefined}
                  className={`${inputClass} pr-16 ${
                    validation.password
                      ? 'border-stock-out focus:ring-stock-out'
                      : 'border-line focus:border-brand'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  disabled={disabled}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-14 min-h-12 items-center justify-center rounded-r-xl text-on-panel-muted transition-colors hover:bg-info/25 hover:text-on-panel focus:outline-none focus:ring-4 focus:ring-brand"
                >
                  {showPassword ? (
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
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-8-10-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
                    </svg>
                  ) : (
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
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {validation.password && (
                <p
                  id="password-error"
                  className="mt-2 flex items-center gap-2 text-base font-semibold text-on-panel"
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-stock-out" aria-hidden="true" />
                  {validation.password}
                </p>
              )}
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Submit                                                       */}
            {/* ---------------------------------------------------------- */}
            <button
              type="submit"
              disabled={disabled}
              className="flex h-16 min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-brand px-6 text-xl font-bold text-on-brand shadow-lg shadow-brand/20 transition-colors duration-200 enabled:hover:bg-info enabled:hover:text-on-panel focus:outline-none focus:ring-4 focus:ring-info-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-6 w-6 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          </div>
        </div>

        <p className="mt-6 w-full max-w-md text-center text-sm text-on-surface-muted">
          VenueVue POS 2.3 · self-hosted · runs on the shop LAN
        </p>
      </div>
    </main>
  );
}

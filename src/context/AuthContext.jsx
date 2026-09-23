/**
 * VenueVue 2.3 - Authentication context (React 19).
 *
 * Exposes the module-wide auth state plus the helpers the rest of the POS shell
 * needs to sign in, sign out and call the self-hosted PHP API:
 *
 *   const { user, isAuthenticated, isLoading, login, logout, fetchWithAuth } = useAuth();
 *
 * The Bearer token is persisted to localStorage so a tablet keeps its session
 * across page reloads. Treat that as a trade-off: the app is served on a closed
 * LAN from a single trusted origin, which is the only reason this is acceptable.
 *
 * No cloud / no Supabase - everything talks to the local XAMPP stack.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { getTabletId, withTabletId } from '../lib/tablet';

/** localStorage keys - namespaced so they never collide with other apps on the tablet. */
const TOKEN_STORAGE_KEY = 'venuevue.auth.token';
const USER_STORAGE_KEY = 'venuevue.auth.user';

/** Bearer tokens are 64 lowercase hex characters (bin2hex(random_bytes(32))). */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Base URL of the self-hosted PHP API. In production the shell and the API are
 * both served from http://192.168.137.1, so an empty value (same-origin) is the
 * correct default. Set VITE_API_BASE_URL in .env only when the Vite dev server
 * runs on a different port than Apache.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Role -> landing route, mirrored by the login screen. */
export const ROLE_ROUTES = {
  BARISTA: '/pos',
  OWNER: '/admin',
};

const AuthContext = createContext(null);

/* -------------------------------------------------------------------------- */
/* localStorage helpers                                                        */
/* -------------------------------------------------------------------------- */

function readStoredToken() {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    // Guard against corrupted / tampered storage: a token of the wrong shape
    // is treated as "not signed in".
    return TOKEN_PATTERN.test(token ?? '') ? token : null;
  } catch {
    return null;
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    const user = raw ? JSON.parse(raw) : null;

    if (user && typeof user === 'object' && ROLE_ROUTES[user.role]) {
      return user;
    }

    return null;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    /* Storage may be unavailable (private mode, disabled cookies) - ignore. */
  }
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Wraps the application and provides auth state to every descendant.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(readStoredUser);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // A session counts as authenticated only when *both* halves are present and
  // well-formed - never trust the token alone.
  const isAuthenticated = Boolean(token && user?.role && TOKEN_PATTERN.test(token));

  /**
   * Persist both halves of the session, or clear them when called with nulls.
   */
  const persist = useCallback((nextToken, nextUser) => {
    try {
      if (nextToken && nextUser) {
        localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        clearStoredSession();
      }
    } catch {
      /* Non-fatal: an unpersisted session simply will not survive a reload. */
    }
  }, []);

  /**
   * Authenticate against /backend/auth.php.
   *
   * The device identifier is injected automatically, because the UI no longer
   * exposes a tablet field: getTabletId() reads VENUEVUE_TABLET_ID from
   * localStorage and provisions 'T-01' on a device that has never been set up.
   *
   * @param {string} username
   * @param {string} password
   * @param {string} [tabletId] Optional override, for tooling only.
   * @returns {Promise<{user_id: number, username: string, role: string}>}
   *          The authenticated user; rejects with an Error on failure.
   */
  const login = useCallback(
    async (username, password, tabletId) => {
      setIsLoading(true);
      setError(null);

      const deviceId = tabletId?.trim() || getTabletId();

      try {
        const response = await fetch(`${API_BASE_URL}/backend/auth.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password,
            tablet_id: deviceId,
          }),
        });

        // 204/empty bodies and non-JSON error pages degrade to null safely.
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? `Sign-in failed (HTTP ${response.status}).`);
        }

        if (!TOKEN_PATTERN.test(payload.token)) {
          // Never store something the API did not actually issue.
          throw new Error('Malformed session token received from the server.');
        }

        const nextUser = {
          user_id: Number(payload.user?.user_id),
          username: String(payload.user?.username ?? ''),
          role: payload.user?.role,
        };

        if (!ROLE_ROUTES[nextUser.role]) {
          throw new Error(`Unsupported role received: ${String(payload.user?.role)}.`);
        }

        setToken(payload.token);
        setUser(nextUser);
        persist(payload.token, nextUser);

        return nextUser;
      } catch (loginError) {
        // Wipe any half-valid state so the tablet lands back on the login screen.
        setToken(null);
        setUser(null);
        clearStoredSession();

        const message =
          loginError instanceof Error && loginError.message
            ? loginError.message
            : 'Unable to reach the server. Check the network and try again.';

        setError(message);
        throw loginError;
      } finally {
        setIsLoading(false);
      }
    },
    [persist],
  );

  /**
   * Clear the local session. The token stays valid server-side until it lapses
   * (24h) - pair with a /backend/logout.php endpoint if you need immediate
   * server-side revocation.
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setError(null);
    clearStoredSession();
  }, []);

  /**
   * fetch() wrapper that attaches the Bearer token and handles session expiry.
   *
   * @param {string} url
   * @param {RequestInit & { json?: unknown }} [options] `json` is encoded as the body.
   * @returns {Promise<Response>}
   */
  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      if (!token) {
        throw new Error('Not signed in.');
      }

      const { json, ...rest } = options;
      const headers = new Headers(rest.headers ?? {});
      headers.set('Authorization', `Bearer ${token}`);

      if (json !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...rest,
        headers,
        // Stamping every JSON body here is what makes the device identifier
        // automatic rather than a rule each caller has to remember: sync.php
        // requires tablet_id and rejects a payload without one. An explicit
        // tablet_id inside `json` still wins (see lib/tablet.js).
        body: json !== undefined ? JSON.stringify(withTabletId(json)) : rest.body,
      });

      // A 401 from any endpoint means the session is gone: drop it locally so
      // the app routes back to the login screen instead of retrying forever.
      if (response.status === 401) {
        setToken(null);
        setUser(null);
        setError('Your session has expired. Please sign in again.');
        clearStoredSession();
      }

      return response;
    },
    [token],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      error,
      login,
      logout,
      fetchWithAuth,
      clearError: () => setError(null),
    }),
    [user, token, isAuthenticated, isLoading, error, login, logout, fetchWithAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Consume the auth context. Must be rendered inside <AuthProvider>.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth() must be used inside an <AuthProvider>.');
  }

  return context;
}

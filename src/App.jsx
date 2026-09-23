/**
 * VenueVue 2.3 - route table.
 *
 *   /login      -> LoginForm             (public)
 *   /dashboard  -> shared dashboard      (BARISTA + OWNER)
 *   /pos        -> register screen       (BARISTA + OWNER)
 *   /admin      -> back-office screen    (OWNER only)
 *   *           -> role-aware redirect
 *
 * LoginForm already redirects to ROLE_ROUTES[role] once the context reports an
 * authenticated session, so these guards are the second line of defence: they
 * stop anyone from reaching a screen by typing its URL.
 */

import { Navigate, Route, Routes } from 'react-router-dom';

import LoginForm from './components/LoginForm';
import { ROLE_ROUTES, useAuth } from './context/AuthContext';
import AdminScreen from './routes/AdminScreen';
import DashboardScreen from './routes/DashboardScreen';
import PosScreen from './routes/PosScreen';

/**
 * Allow a route only when the signed-in user holds one of the required roles.
 * Unauthenticated -> /login. Wrong role -> that user's own landing page.
 *
 * @param {{ role: string | string[], children: React.ReactNode }} props
 */
function RequireRole({ role, children }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const allowed = Array.isArray(role) ? role : [role];

  if (!allowed.includes(user.role)) {
    return <Navigate to={ROLE_ROUTES[user.role] ?? '/login'} replace />;
  }

  return children;
}

/** Send the visitor wherever their role belongs. */
export function LandingRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={ROLE_ROUTES[user.role] ?? '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />

      {/* Shared landing page - both roles see the same operational overview. */}
      <Route
        path="/dashboard"
        element={
          <RequireRole role={['BARISTA', 'OWNER']}>
            <DashboardScreen />
          </RequireRole>
        }
      />

      {/* The register is a shared workstation: an owner covering a shift needs
          it too, so this is no longer barista-only. /admin stays OWNER-only. */}
      <Route
        path="/pos"
        element={
          <RequireRole role={['BARISTA', 'OWNER']}>
            <PosScreen />
          </RequireRole>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireRole role="OWNER">
            <AdminScreen />
          </RequireRole>
        }
      />

      {/* '/', unknown paths and stray deep links all resolve by role. */}
      <Route path="*" element={<LandingRedirect />} />
    </Routes>
  );
}

/**
 * VenueVue 2.3 - application entry point.
 *
 * Provider order matters:
 *   BrowserRouter -> ThemeProvider -> AuthProvider -> App
 *
 * LoginForm and the route guards call useNavigate(), so the router has to be
 * the outermost provider. ThemeProvider only touches <html>, so it is free to
 * sit anywhere inside the router; AuthProvider must wrap App so every route can
 * reach useAuth().
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

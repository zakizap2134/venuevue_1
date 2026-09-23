import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// VenueVue 2.3 dev server.
//
// The `/backend` proxy is what makes this work on a LAN with no CORS setup:
// the browser only ever talks to http://<host>:5173, and Vite forwards
// /backend/* to the PHP API on 127.0.0.1:8000. Because every request is
// same-origin, AuthContext's default of an empty VITE_API_BASE_URL is correct
// and the browser never issues a pre-flight.
//
// In production Apache serves BOTH the built assets and the PHP from
// http://192.168.137.1, so the same same-origin assumption holds and the proxy
// is not involved at all.
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    // 0.0.0.0 so POS tablets on the LAN can reach the dev server, not just
    // this machine. Use http://192.168.137.1:5173 from a tablet.
    host: true,
    port: 5173,

    proxy: {
      '/backend': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
//
// The dev server proxies /api and /uploads to the API so the client can use
// relative (same-origin) URLs in development. Point VITE_API_URL at the API
// origin when it is not running on the proxied port, or when previewing a
// deployed client.
const env = loadEnv('dev', process.cwd(), '')
const proxyTarget = (env.VITE_API_URL as string | undefined)?.trim().length
  ? (env.VITE_API_URL as string).replace(/\/+$/, '')
  : 'http://localhost:3001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Same-origin API access during development (D-01): without this, a bare
      // `fetch('/api/...')` in the client would hit the Vite dev server, which
      // would return the app's HTML instead of the API response.
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      // Auth routes (/auth/login, /auth/register, /auth/verify-email, /auth/me)
      // must also be proxied so they reach the Express backend, not Vite.
      '/auth': {
        target: proxyTarget,
        changeOrigin: true,
      },
      // Preview/server-hosted images are only accessible with a token, which
      // the client includes as a query parameter; the proxy just forwards it.
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})

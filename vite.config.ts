/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

/**
 * Vite copies every VITE_* variable into the bundle, used or not. A production build
 * must therefore never see an App Check debug token: anyone could read it from the
 * public site and call Gemini as this app. `.env.production` blanks both settings;
 * this check catches a token set some other way (shell, `.env.production.local`).
 */
function noAppCheckDebugInProduction(): Plugin {
  return {
    name: 'nysus:no-appcheck-debug-in-production',
    apply: 'build',
    config(_config, { mode }) {
      if (mode !== 'production') return
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      if (env.VITE_APPCHECK_DEBUG_TOKEN?.trim() || env.VITE_APPCHECK_DEBUG === 'true') {
        throw new Error(
          'Refusing to build: VITE_APPCHECK_DEBUG / VITE_APPCHECK_DEBUG_TOKEN is set for a production build. ' +
            'The token would be published inside the site. Remove it from your shell or .env.production.local.',
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), noAppCheckDebugInProduction()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    // Tests must load the browser build of @firebase/ai: its Node build has no
    // on-device (Chrome Prompt API) adapter, so hybrid routing could not be exercised.
    alias: { '@firebase/ai': fileURLToPath(new URL('./node_modules/@firebase/ai/dist/esm/index.esm.js', import.meta.url)) },
    server: { deps: { inline: [/firebase/] } },
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}', 'tests/eval/**/*.test.{ts,tsx}'],
  },
})

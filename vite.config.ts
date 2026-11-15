/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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

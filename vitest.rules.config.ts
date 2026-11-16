import { defineConfig } from 'vitest/config'

/** Firestore security rules tests: Node environment, against the emulator started by `npm run test:rules`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20_000,
    // Both files share one emulator database and clear it between tests.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
})

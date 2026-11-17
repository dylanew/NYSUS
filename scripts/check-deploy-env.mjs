// Run by `npm run deploy` before building. Checks the values a hosted NYSUS needs,
// so a deploy never publishes a site that silently runs without Firebase.
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), 'VITE_')
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY',
]
const missing = required.filter((key) => !env[key]?.trim())

if (missing.length > 0) {
  console.error('\nCannot deploy: these values are missing from .env.local:\n')
  for (const key of missing) console.error(`  - ${key}`)
  console.error('\nCopy them from the Firebase console (see docs/DEPLOYMENT.md), then run `npm run deploy` again.\n')
  process.exit(1)
}

console.log(`Deploying NYSUS for Firebase project "${env.VITE_FIREBASE_PROJECT_ID}".`)

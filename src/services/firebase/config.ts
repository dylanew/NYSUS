import { z } from 'zod'
import type { FirebaseOptions } from 'firebase/app'

/**
 * Firebase web config is read from Vite env vars (see .env.example).
 * Nothing here is hard-coded: if a value is missing the app runs in
 * "not configured" mode and the AI features explain what is needed.
 */
const firebaseEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  VITE_FIREBASE_APP_ID: z.string().min(1),
})

export const REQUIRED_FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export interface AppCheckEnv {
  recaptchaEnterpriseSiteKey: string | null
  debug: boolean
}

export type FirebaseConfigResult =
  | { ok: true; options: FirebaseOptions; appCheck: AppCheckEnv; cloudModel: string | null }
  | { ok: false; missing: string[] }

type Env = Record<string, string | boolean | undefined>

const blankToUndefined = (env: Env): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined]),
  )

export function readFirebaseConfig(env: Env = import.meta.env): FirebaseConfigResult {
  const clean = blankToUndefined(env)
  const parsed = firebaseEnvSchema.safeParse(clean)
  if (!parsed.success) {
    const missing = REQUIRED_FIREBASE_ENV.filter((key) => !clean[key])
    return { ok: false, missing }
  }
  const e = parsed.data
  return {
    ok: true,
    options: {
      apiKey: e.VITE_FIREBASE_API_KEY,
      authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: e.VITE_FIREBASE_PROJECT_ID,
      storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: e.VITE_FIREBASE_APP_ID,
    },
    appCheck: {
      recaptchaEnterpriseSiteKey: clean.VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY ?? null,
      debug: clean.VITE_APPCHECK_DEBUG === 'true',
    },
    cloudModel: clean.VITE_GEMINI_CLOUD_MODEL ?? null,
  }
}

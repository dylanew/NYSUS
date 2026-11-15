import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'
import { readFirebaseConfig, type FirebaseConfigResult } from './config'

declare global {
  // Read by the App Check SDK when the debug provider is enabled.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined
}

export interface FirebaseServices {
  app: FirebaseApp
  appCheck: AppCheck | null
  appCheckMode: 'recaptcha-enterprise' | 'debug' | 'disabled'
  cloudModel: string | null
}

let cached: { config: FirebaseConfigResult; services: FirebaseServices | null } | null = null

/**
 * Initialises Firebase once. Returns null services (with the reason in
 * `config`) when env vars are missing, so the UI can show setup guidance
 * instead of crashing.
 */
export function getFirebase(): { config: FirebaseConfigResult; services: FirebaseServices | null } {
  if (cached) return cached
  const config = readFirebaseConfig()
  if (!config.ok) {
    cached = { config, services: null }
    return cached
  }

  const app = initializeApp(config.options)
  let appCheck: AppCheck | null = null
  let appCheckMode: FirebaseServices['appCheckMode'] = 'disabled'

  // Debug provider is dev-only; import.meta.env.DEV is false in production builds.
  if (import.meta.env.DEV && config.appCheck.debug) {
    // A console-generated token (VITE_APPCHECK_DEBUG_TOKEN) avoids hunting for the auto-generated one in DevTools.
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = config.appCheck.debugToken ?? true
    appCheckMode = 'debug'
  }
  if (config.appCheck.recaptchaEnterpriseSiteKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(config.appCheck.recaptchaEnterpriseSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
    if (appCheckMode !== 'debug') appCheckMode = 'recaptcha-enterprise'
  } else {
    appCheckMode = 'disabled'
  }

  cached = { config, services: { app, appCheck, appCheckMode, cloudModel: config.cloudModel } }
  return cached
}

export interface AppCheckClaims {
  appId: string | null
  audience: string[]
  expiresAt: string | null
}

export type AppCheckProbe =
  | { ok: true; mode: FirebaseServices['appCheckMode']; claims: AppCheckClaims | null; cloud: string }
  | { ok: false; reason: string }

/** Decodes the non-secret claims of an App Check JWT (app, audience, expiry) for diagnostics. */
export function decodeAppCheckClaims(token: string): AppCheckClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string; aud?: string[] | string; exp?: number }
    return {
      appId: json.sub ?? null,
      audience: Array.isArray(json.aud) ? json.aud : json.aud ? [json.aud] : [],
      expiresAt: json.exp ? new Date(json.exp * 1000).toISOString() : null,
    }
  } catch {
    return null
  }
}

/** Asks App Check for a token right now, so setup problems surface before an AI request fails with a bare 401. */
export async function probeAppCheck(): Promise<AppCheckProbe> {
  const { services } = getFirebase()
  if (!services) return { ok: false, reason: 'Firebase is not configured.' }
  if (!services.appCheck) return { ok: false, reason: 'App Check is not initialised: VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY is missing.' }
  let token: string
  try {
    token = (await getToken(services.appCheck, true)).token
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
  const claims = decodeAppCheckClaims(token)

  // Send that exact token to the AI Logic endpoint with a tiny request, bypassing the AI SDK,
  // to tell "App Check token rejected by AI Logic" apart from "SDK sent a different token".
  const { options } = services.app
  const model = services.cloudModel ?? 'gemini-3.5-flash-lite'
  const url = `https://firebasevertexai.googleapis.com/v1beta/projects/${options.projectId}/models/${model}:generateContent`
  let cloud: string
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey ?? '', 'X-Firebase-AppCheck': token },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }] }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    cloud = res.ok ? 'Direct AI Logic call succeeded' : `Direct AI Logic call failed: ${res.status} ${body.error?.message ?? ''}`
  } catch (err) {
    cloud = `Direct AI Logic call failed: ${err instanceof Error ? err.message : String(err)}`
  }
  return { ok: true, mode: services.appCheckMode, claims, cloud }
}

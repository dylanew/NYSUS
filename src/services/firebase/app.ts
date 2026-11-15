import { initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'
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
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true
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

import { describe, expect, it } from 'vitest'
import { readFirebaseConfig } from '../../src/services/firebase/config'

const full = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
}

describe('readFirebaseConfig', () => {
  it('reports exactly which required values are missing', () => {
    const r = readFirebaseConfig({ VITE_FIREBASE_API_KEY: 'key', VITE_FIREBASE_PROJECT_ID: '  ' })
    expect(r).toEqual({ ok: false, missing: ['VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'] })
  })

  it('builds options and App Check settings when complete', () => {
    const r = readFirebaseConfig({ ...full, VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: 'site', VITE_APPCHECK_DEBUG: 'true' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.options.projectId).toBe('demo')
    expect(r.appCheck).toEqual({ recaptchaEnterpriseSiteKey: 'site', debug: true })
    expect(r.cloudModel).toBeNull()
  })

  it('treats App Check as off when no site key is given', () => {
    const r = readFirebaseConfig(full)
    expect(r.ok && r.appCheck.recaptchaEnterpriseSiteKey).toBeNull()
  })
})

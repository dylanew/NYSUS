# Architecture

Single-page React 19 + TypeScript (strict) app built with Vite 8 and Tailwind CSS 4. No custom backend: Firebase services and local application logic only.

```
src/
  app/          router + route table
  components/
    layout/     AppLayout (sidebar / mobile nav), Wordmark, nav items
    ai/         DiscoveryPrompt, InferenceBadge, PreferenceResult, DeviceModelStatus
  hooks/        usePreferenceExtraction, useOnDeviceModel
  pages/        HomePage, SettingsPage, PlaceholderPage (later phases)
  services/
    firebase/   config.ts (env → validated options), app.ts (initializeApp + App Check)
    ai/         firebaseAI.ts, hybridInference.ts, schemas.ts, prompts.ts,
                inferenceMetadata.ts, onDeviceAvailability.ts
tests/
  unit/         pure logic
  integration/  services + components, including the real firebase/ai SDK with faked Chrome/network
```

## Principles
- **No invented config.** Firebase options come only from `VITE_*` env vars, validated with Zod. Missing values put the app in a clearly-labelled unconfigured mode instead of crashing.
- **Services own logic, components render.** `extractPreferences()` takes its models as dependencies, so it is testable without Firebase.
- **Lazy, singleton initialisation** of the Firebase app, App Check and AI models.

## Planned additions (later phases)
`services/catalogue`, `services/recommendations`, `services/playback`, `services/diagnostics`, `services/ai/cloudAssistant.ts`, `data/catalogue.ts`, `data/demoScenarios.ts`, Recharts dashboards, Firestore persistence.

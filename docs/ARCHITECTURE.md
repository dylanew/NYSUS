# Architecture

Single-page React 19 + TypeScript (strict) app built with Vite 8 and Tailwind CSS 4. No custom backend: Firebase services and local application logic only.

```
src/
  app/          router + route table
  components/
    layout/     AppLayout (sidebar / mobile nav), Wordmark, nav items
    ai/         DiscoveryPrompt, InferenceBadge, PreferenceResult, DeviceModelStatus
    media/      MediaCard, Artwork (generated), WatchlistButton, FilterChips
  data/         catalogue.ts (48 curated films and series)
  hooks/        useAiDeps, useDiscovery, useOnDeviceModel, useWatchlist
  pages/        Home, Discover, Watchlist, Title, Settings, Placeholder (later phases)
  types/        media.ts
  services/
    firebase/   config.ts (env → validated options), app.ts (initializeApp + App Check)
    ai/         firebaseAI.ts, hybridInference.ts, schemas.ts, prompts.ts,
                inferenceMetadata.ts, onDeviceAvailability.ts, errors.ts
    catalogue/  vocabulary.ts (controlled tags + synonyms), catalogue.ts (lookup, "like X" detection)
    recommendations/
                discover.ts (Journey A pipeline), guards.ts, ranking.ts, keywordExtraction.ts
    watchlist/  watchlistStore.ts (localStorage, swappable for Firestore in Phase 5)
tests/
  unit/         pure logic
  integration/  services + components, including the real firebase/ai SDK with faked Chrome/network
  eval/         discovery evaluation set (recorded live model outputs → expected recommendations)

## Journey A pipeline
request → `extractPreferences` (hybrid AI, or keyword fallback if AI is unavailable)
→ `sanitisePreferences` (drop what the request doesn't support)
→ `findMentionedTitle` ("like Interstellar")
→ `rankTitles` (hard filters, weighted scores, explanations from metadata)
```

## Principles
- **No invented config.** Firebase options come only from `VITE_*` env vars, validated with Zod. Missing values put the app in a clearly-labelled unconfigured mode instead of crashing.
- **Services own logic, components render.** `extractPreferences()` takes its models as dependencies, so it is testable without Firebase.
- **Lazy, singleton initialisation** of the Firebase app, App Check and AI models.

## Planned additions (later phases)
`services/playback`, `services/diagnostics`, `services/ai/cloudAssistant.ts`, `data/demoScenarios.ts`, Recharts dashboards, Firestore persistence.

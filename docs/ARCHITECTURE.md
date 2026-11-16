# Architecture

Single-page React 19 + TypeScript (strict) app built with Vite 8 and Tailwind CSS 4. No custom backend: Firebase services and local application logic only.

```
src/
  app/          router + route table
  components/
    layout/     AppLayout (sidebar / mobile nav), Wordmark, nav items
    ai/         DiscoveryPrompt, InferenceBadge, PreferenceResult, DeviceModelStatus
    media/      MediaCard, Artwork (generated), WatchlistButton, FilterChips
  data/         catalogue.ts (48 curated films and series), demoScenarios.ts (network scenarios, bitrate ladder)
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
    playback/   engine.ts (deterministic simulator), metrics.ts, playerStore.ts (app-wide timer)
    diagnostics/ buffering.ts (stall analysis), findings.ts (rule-based health findings)
tests/
  unit/         pure logic
  integration/  services + components, including the real firebase/ai SDK with faked Chrome/network
  eval/         discovery evaluation set (recorded live model outputs → expected recommendations)

## Playback simulation (Journey B)
`PlaybackEngine.tick()` advances one simulated second: read the scenario's network sample → download (throughput ÷ bitrate seconds of video, 12 s buffer cap) → play or stall → adaptive bitrate (EWMA estimate, 0.8 safety down, 0.6 hysteresis up) → record events. Network "noise" is a hash of (scenario, second), so identical actions always give identical telemetry. The store only decides how often to tick (1×–10×), and "Simulate 30 s" calls the same tick 30 times.

**Live mode** (`scenario: 'live'`): `services/network/liveProbe.ts` runs a monitor that, every 2 s, times a download from `speed.cloudflare.com/__down` (size adapts to about 400 ms, 100 kB to 3 MB) and a `no-cors` request to the selected service's website favicon. The store hands the latest reading to `engine.setLiveSample()` before each tick, so the same engine, metrics and findings run on real numbers. In live mode, speed is pinned to 1× and skip is disabled. The monitor only runs while live playback needs data, a failed download counts as zero throughput (an outage), and it stops at 150 MB. The Service response check on the Player page times each service's website once cold and three times warm. These are website round trips, not video-server health, and the UI says so.

Telemetry is a typed event log (`types/playback.ts`) with stable ids (`s1-e42`). All metrics and findings are pure functions of that log.

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
`services/diagnostics`, `services/ai/cloudAssistant.ts`, `data/demoScenarios.ts`, Recharts dashboards, Firestore persistence.

# Architecture

Single-page React 19 + TypeScript (strict) app built with Vite 8 and Tailwind CSS 4. No custom backend: Firebase services and local application logic only.

```
src/
  app/          router, route table (pages load lazily, with error boundaries), background.ts
  components/
    layout/     AppLayout (top nav), Wordmark, nav items, RouteError, PageLoading
    account/    AccountMenu, GuestWelcome, storage status wording
    ai/         DiscoveryPrompt, InferenceBadge, PreferenceResult, DeviceModelStatus
    media/      MediaCard, Artwork (generated), WatchlistButton, FilterChips
    assistant/  AssistantChat, AssistantDrawer (on every page), ToolActivityList,
                DiagnosticReportCard, RecommendationStrip, MessageText
  data/         catalogue.ts (48 curated films and series), demoScenarios.ts (network scenarios, bitrate ladder), demoProfile.ts
  hooks/        useAiDeps, useDiscovery, useOnDeviceModel, useWatchlist, useAccount, useStore
  pages/        Home, Discover, Watchlist, Title, Settings, Placeholder (later phases)
  types/        media.ts
  services/
    firebase/   config.ts (env → validated options), app.ts (initializeApp + App Check), auth.ts (anonymous + Google)
    ai/         firebaseAI.ts, hybridInference.ts, schemas.ts, prompts.ts,
                inferenceMetadata.ts, onDeviceAvailability.ts, errors.ts,
                cloudAssistant.ts (validated function-calling loop)
    catalogue/  vocabulary.ts (controlled tags + synonyms), catalogue.ts (lookup, "like X" detection)
    recommendations/
                discover.ts (Journey A pipeline), guards.ts, ranking.ts, keywordExtraction.ts
    watchlist/  watchlistStore.ts (local copy + change events for sync)
    preferences/ preferencesStore.ts (structured interests from discovery)
    persistence/ remoteRepo.ts (interface), firestoreRepo.ts, cloudSync.ts (merge + write-through)
    account/    accountStore.ts (guest / Google, sign-in, sign-out, delete my data, demo profile)
    playback/   engine.ts (deterministic simulator), metrics.ts, playerStore.ts (app-wide timer),
                sessionHistory.ts (session records + recorder)
    diagnostics/ buffering.ts (stall analysis), findings.ts (rule-based health findings)
    assistant/  context.ts (what tools may read), toolSchemas.ts (declarations + Zod), tools.ts,
                grounding.ts (answer checks), assistantStore.ts (app-wide conversation)
tests/
  unit/         pure logic
  integration/  services + components, including the real firebase/ai SDK with faked Chrome/network
  eval/         discovery evaluation set (recorded live model outputs → expected recommendations)
  rules/        Firestore security rules + repository, against the emulator
  e2e/          Playwright: the spec 11.3 journey with a scripted model, phone layout

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

## Journey C: assistant
question → `AssistantConversation.send` → Gemini (cloud) picks tools → validate → run deterministic tool on the live player/watchlist stores → function responses → Gemini answers → grounding check → message with tool activity, report card, recommendation cards and checked citations. The drawer (every page), the Assistant page, *Ask why it's buffering* on the Player and *Ask the assistant to investigate* on Stream Health share one conversation.

## Accounts and persistence (Phase 5)

**Guest by default.** Nobody has to sign in. On first load the app signs in anonymously with Firebase Auth, which gives the guest a private Firestore space; if anonymous sign-in is disabled (or Firebase isn't configured) the guest's data stays in this browser. *Continue with Google* links the guest to Google (same uid, so the data simply stays), or, if that Google account already exists, signs in to it and merges the guest's data in. Signing out clears this browser's copy (the account keeps it) and starts a fresh guest. *Delete my saved data* clears it everywhere. *Load demo profile* fills the watchlist with a ready-made taste so judges see personal recommendations at once. Demo titles belong to guest mode: the app remembers which titles the demo added (not ones the guest already had), tags them *Demo* on the Watchlist, and removes them before *Continue with Google*, so only what the guest added themselves moves to the Google account. If sign-in is cancelled they come back. Google users can't load the demo.

**Local-first sync.** The watchlist, preferences and session-history stores keep a localStorage copy that the UI reads synchronously. `cloudSync` attaches to the signed-in uid: it loads the account's documents, merges them with the device copy (newest change per item wins; nothing is dropped), writes back what the account lacked, then writes every local change through as a single-document write. A failed write is shown in the account menu and never blocks the UI. Firebase Auth and Firestore load after the first screen.

```
users/{uid}/watchlist/{titleId}          { titleId, addedAt, watched, updatedAt }
users/{uid}/preferences/profile          { interests: [{ at, genres, moods, themes, contentType, source }], updatedAt }
users/{uid}/playbackSessions/{recordId}  summary metrics, notable events, ≤60 thinned samples
```

The spec suggested top-level `playbackSessions/` and `diagnosticReports/`. Sessions live under the user instead, so one ownership rule covers everything. Diagnostic reports aren't stored: they are recomputed from the session by the deterministic tools, and the spec asks not to store unnecessary conversation data. Discovery preferences are stored as the structured labels the model extracted, never the request text.

**Rules** (`firestore.rules`): default deny; a user can only touch `users/{their uid}/…`; every write must have exactly the fields the app writes, with types, id/slug formats, sane timestamps and size caps (12 interests, 210 events). Tested against the emulator in `tests/rules/`.

**Session recording.** `recordSessions` watches the player and saves the current session when it pauses, ends or errors, when a new session replaces it, at most every 10 s otherwise, and when the tab is hidden. Sessions under 5 s of playback aren't kept. Home shows them under *Continue watching*.

## Hosting (Phase 6)
A static build on Firebase Hosting (`firebase.json` → `hosting`): `dist/` is served with every path rewritten to `index.html`, hashed `/assets/**` cached for a year and everything else `no-cache`. Build-time config comes from `.env.local`; `.env.production` blanks the App Check debug settings because Vite inlines every `VITE_*` value into the bundle, and `vite.config.ts` refuses a production build that still has a debug token. `npm run deploy` checks the required values (`scripts/check-deploy-env.mjs`), builds and deploys Hosting only. Steps: [DEPLOYMENT.md](DEPLOYMENT.md).

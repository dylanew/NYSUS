# Testing

`npm test` runs Vitest (jsdom). No test makes a network call or needs credentials.

| Suite | Covers |
|---|---|
| `tests/unit/schemas.test.ts` | Zod validation of model output: fences, invalid JSON, ranges, enums, inverted periods |
| `tests/unit/firebaseConfig.test.ts` | Env → Firebase options; exact list of missing values; App Check settings |
| `tests/unit/inferenceMetadata.test.ts` | Badge wording never claims local unless the SDK said `on_device`; Prompt API probing |
| `tests/integration/hybridInference.test.ts` | `extractPreferences` with fake models: on-device, cloud fallback, on-device failure retry, missing source, input limits |
| `tests/integration/firebaseSdkHybrid.test.ts` | **Real `firebase/ai` SDK** with a faked `window.LanguageModel` and `fetch`: on-device routing passes our schema as `responseConstraint`; `downloadable` and no-Prompt-API cases go to `gemini-3.5-flash-lite` with `responseJsonSchema` |
| `tests/unit/catalogue.test.ts` | Catalogue integrity (size, unique ids, controlled vocabulary), synonyms, "like X" detection |
| `tests/unit/guards.test.ts` | Time-cue detection; dropping invented release periods (the live Gemini Nano case) and unsupported exclusions |
| `tests/unit/ranking.test.ts` | Determinism, explanations, hard filters, similarity, era decay and hard filter, taste profile |
| `tests/unit/keywordAndWatchlist.test.ts` | Keyword fallback; watchlist persistence, corrupt and blocked storage |
| `tests/integration/discover.test.ts` | Journey A end to end with fake models: guard notes, reference titles, labelled keyword fallback |
| `tests/integration/DiscoverPage.test.tsx` | Search → explained results → add to watchlist → mark watched; filter browsing |
| `tests/unit/playbackEngine.test.ts` | Scenario determinism and shape; engine behaviour per scenario (no stalls / occasional / frequent / error + recovery); fixed 1080p vs auto; pause; ending |
| `tests/unit/playbackMetrics.test.ts` | Metrics on a hand-built timeline (state split, ratio, averages, frequency, windows, empty session); stall analysis; findings |
| `tests/integration/player.test.tsx` | Player store timer and speed; Player → Stream Health journey through an interruption |
| `tests/unit/liveProbe.test.ts` | Live probe on a fake network: throughput maths, no-cors service pings, unreachable services, monitor interval, adaptive size, offline → zero throughput, data budget; engine fed live samples |
| `tests/integration/player.test.tsx` (live) | Live mode measures before play, pins speed to 1×, blocks skip, feeds readings to the engine, notes service changes, stops measuring on pause |
| `tests/unit/assistantTools.test.ts` | The six tools on deterministic scenarios (spec 6.5): stable is healthy, poor links stalls to low throughput with event ids, unstable is identified as inconsistent, an error is reported with its time; no-session answers; period comparison; live data labelled as the viewer's connection, never the service; catalogue results only real titles |
| `tests/unit/assistantValidation.test.ts` | Exactly six declarations, matching Zod keys; unknown tools rejected; undeclared, wrong-type and out-of-range args rejected; grounding accepts tool figures (with rounding/unit conversion) and flags invented ids and figures |
| `tests/integration/cloudAssistant.test.ts` | The loop with a scripted Gemini: tools run and results go back as function responses; rejections reported to the model; model-call and tool-call limits; timeout restores the conversation; history rebuilt without dangling calls |
| `tests/integration/cloudAssistantSdk.test.ts` | **Real `firebase/ai` SDK** with faked `fetch`: tools, system prompt and AUTO mode in the request; function response in the second request; cloud even when the Prompt API is available |
| `tests/integration/AssistantChat.test.tsx` | Chat UI: real tool activity rows, report card, checked citations, recommendation cards, invented-id warning, rules-only mode without Firebase; Stream Health → drawer → investigation of the app's player session |
| `tests/eval/discoveryEval.test.ts` | Evaluation set: 6 requests (3 with recorded live model output) with expected and forbidden recommendations |

## Evaluation
`tests/eval/discoveryEval.test.ts` checks the deterministic half of discovery: given what a model extracted, do the top results match intent? Three cases use model outputs recorded in the live runs below; three are hand-written.

**Limitations:** six cases is a smoke test, not a benchmark. Expected titles are one person's judgement. Live extraction quality (what the models return for a request) is not covered automatically because tests must not depend on live Gemini responses; it is checked manually and logged below. Building it out to cover more prompts was the first eval finding: it exposed weak era and length handling, which led to stated periods becoming hard filters and "short" being weighted properly.

## Manual verification of live hybrid inference
Automated tests cannot prove Gemini Nano runs on a given machine. With `.env.local` configured:
1. Chrome 139+ desktop, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, restart.
2. Home → *Prepare on-device model*, wait for "On-device model ready".
3. Submit a request; badge should read *Processed on your device*.
4. In another browser (or with the flag off) the same request should read *Local model unavailable — using cloud fallback*.

A Playwright suite is planned for Phase 5. For Phase 4, the Player → *Ask why it's buffering* → drawer journey was run in Chromium against the dev server with Firebase's endpoint intercepted (scripted Gemini replies, real SDK and tools): 4 model calls, 4 tool calls, report and citations rendered. RTL integration tests cover the same journey in CI.

### Results
| Date | Environment | Path | Result |
|---|---|---|---|
| 15 Nov 2026 | macOS, Chrome desktop, Prompt API flag on, App Check debug token | On-device (`on_device`) | Correct structured preferences for "A psychological thriller with a clever plot from the last ten years" (genre, mood, theme, 2016–2026, film). First request 25.6 s, which includes loading the model into memory. |
| 15 Nov 2026 | Same, model warm | On-device | "A short, light-hearted series I can finish this weekend": first attempt failed validation (`releaseAfter: 0`), fixed in prompt v2 + schema. Retry 7.6 s, correct mood/type but **invented a 2020–2027 release period** the request never stated. Extraction quality to be addressed with the Phase 2 evaluation set. |
| 15 Nov 2026 | macOS Safari (no Prompt API) | Cloud fallback | Request failed in the browser with `Error fetching from …: Type error` (fetch never completed). Same endpoint probed with curl: CORS preflight allows `localhost:5173`, API is enabled, and App Check enforcement answers `401 Firebase App Check token is invalid`, so the backend is configured correctly; the failure is Safari-side. Added a *Cloud only* toggle so the cloud path can be tested in Chrome. |
| 15 Nov 2026 | macOS Chrome, *Cloud only* (`ONLY_IN_CLOUD`), App Check enforced with console-generated debug token | Cloud (`in_cloud`, gemini-3.5-flash-lite) | After switching to limited-use App Check tokens: "Something like Interstellar, but darker and more suspenseful" → science fiction / dark, suspenseful / space exploration, 1.4 s. Standard tokens had been rejected with `401 App Check token is invalid`. |

**Phase 1 completion condition met:** a structured prompt goes through Firebase AI Logic and the UI shows the actual inference source, verified live for both on-device and cloud.

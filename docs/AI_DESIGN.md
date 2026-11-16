# AI design

## Workflow A — hybrid preference extraction (implemented)

`src/services/ai/firebaseAI.ts` creates two models from the same `AI` instance (Gemini Developer API backend):

| Model | Mode | Purpose |
|---|---|---|
| `hybrid` | `InferenceMode.PREFER_ON_DEVICE` | Normal path. Chrome Prompt API when available, else cloud Gemini. |
| `cloudOnly` | `InferenceMode.ONLY_IN_CLOUD` | Retry only if the on-device call itself throws (see "SDK behaviour"). |

Both use one plain JSON Schema (`preferenceJsonSchema`):
- on-device: `onDeviceParams.promptOptions.responseConstraint`
- cloud: `inCloudParams.generationConfig.responseJsonSchema` with `responseMimeType: application/json`

The model's output is then validated with Zod (`viewerPreferencesSchema`). Invalid output is an error, never silently accepted.

`hybridInference.extractPreferences()` records an `InferenceRecord`: the SDK-reported `inferenceSource` (`on_device` / `in_cloud`), the Chrome model availability at request time, any on-device error, latency and prompt version. The UI badge (`InferenceBadge`) is derived from that record:
- *Processed on your device* — only when the SDK reported `on_device`
- *Processed using cloud AI*
- *Local model unavailable / not ready — using cloud fallback*
- *On-device model failed — used cloud AI*

If the SDK ever returns no source, we throw rather than guess.

## Verified SDK behaviour (firebase@13.3.0, checked 15 Nov 2026)

Checked against the [hybrid docs](https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference), [configuration options](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options), [structured output](https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output) and the installed SDK source:

- `InferenceSource` values are lowercase strings `"on_device"` / `"in_cloud"` (the docs prose says `ON_DEVICE`/`IN_CLOUD`, which are the constant names).
- Default hybrid cloud model is `gemini-3.5-flash-lite`; override with `VITE_GEMINI_CLOUD_MODEL`.
- `PREFER_ON_DEVICE` falls back to cloud when Chrome reports anything other than `available`, or when the request isn't on-device compatible. **It does not fall back if the on-device prompt throws** — hence the `cloudOnly` retry.
- If the model is `downloadable`/`downloading`, `PREFER_ON_DEVICE` does not wait; it uses the cloud. `initializeDeviceModel()` starts the download and **must be called from a user gesture**.
- On-device supports single-turn text (and JPEG/PNG input), structured output, max ~9,216 tokens. No multi-turn chat and no function calling — confirming the spec's split: workflow B must be cloud-only.
- Firebase console AI monitoring does not show on-device requests.
- The Node build of `@firebase/ai` has no on-device adapter; tests alias the browser build.

## Risks and outdated assumptions

| Risk | Impact | Mitigation |
|---|---|---|
| App Check is **mandatory** for AI Logic from 2 Nov 2026 (already in force). | Without it, every cloud call fails. | reCAPTCHA Enterprise + dev debug token wired in `services/firebase/app.ts`. Needs keys from the project owner. |
| Standard (1-hour) App Check tokens rejected by AI Logic with `401 Firebase App Check token is invalid`, although the token's app and audience were correct (seen live). | Every cloud call fails. | `getAI(..., { useLimitedUseAppCheckTokens: true })` (replay-protected tokens). Settings → *Test App Check* compares both token types against the endpoint. |
| Judges' browsers mostly won't have Gemini Nano ready (Chrome 139+ desktop, flag, multi-GB download). | Most demos will show cloud fallback. | Honest badge; "Prepare on-device model" button; record demo video on a prepared machine. |
| Chrome Prompt API honours JSON Schema loosely; small model may produce weaker extractions. | Lower-quality preferences on-device. | Simple schema (no nulls/unions), Zod validation, low temperature in cloud, evaluation set in Phase 2. |
| `firebase` and Prompt API are fast-moving. | API shape drift. | Pinned via lockfile; SDK-level integration test catches routing changes. |
| Spec example uses `releasePeriod: { after, before: null }`. | Nullables are poorly supported by the on-device constraint. | Flattened to optional `releaseAfter` / `releaseBefore`. |

## From preferences to recommendations (Phase 2)

The model only extracts preferences. Everything after that is deterministic TypeScript:

1. **Vocabulary mapping** (`catalogue/vocabulary.ts`): "sci-fi" → *science fiction*, "feel-good" → *heartwarming*, "clever plot" → *complex plot*. Neighbouring moods ("tense" for "suspenseful") count as half matches.
2. **Guards** (`recommendations/guards.ts`). These never add preferences, only remove unsupported ones:
   - A release period is kept only if the request contains a time cue ("recent", "90s", "last ten years"…). Gemini Nano invented *2020–2027* for "a short, light-hearted series I can finish this weekend" in live testing.
   - Future years are dropped; excluded genres are kept only if the request rules something out ("not", "without"…).
   - Each removal is shown to the user as a note.
3. **Ranking** (`recommendations/ranking.ts`): weighted components (genre 0.3, mood 0.25, theme 0.15, similarity to a named title 0.3, era 0.25, length 0.25, taste profile 0.15). Only components the viewer expressed take part, and weights are renormalised. Hard filters: content type, excluded genres, the named title itself, and a stated period when at least three titles satisfy it. Era or length alone never qualifies a title.
4. **Explanations** are assembled from the components that matched, using catalogue metadata only, e.g. *"Recommended because it's science fiction and the mood is tense."*
5. **Fallback:** if Firebase is not configured or both AI paths fail, `keywordExtraction.ts` spots vocabulary terms in the text. Results are labelled *AI unavailable — matched by keywords* with the reason.

Prompt v3 adds a `length` field (short / long / any), so "finish this weekend" survives extraction.

## Telemetry the assistant will use (Phase 3)
Phase 3 built the deterministic layer the Phase 4 tools will wrap. The model will never calculate these numbers:
- `computeMetrics(session, window?)` gives `get_playback_metrics` and `compare_network_conditions` (time windows).
- `analyseBuffering(session)` gives `analyse_buffering`: each stall with its event ids, duration, throughput vs bitrate, latency and *observations* phrased as correlations.
- In live mode the same functions run on real measurements of the viewer's connection, so the assistant can explain a real stall. It must still describe service latency as website response time, not server health.
- `healthFindings(session)` gives the rule-based baseline that `generate_diagnostic_report` must stay consistent with.

## Workflow B — cloud assistant (Phase 4)

`createAssistantModel()` (`services/ai/firebaseAI.ts`) builds an `ONLY_IN_CLOUD` Gemini model with the six tool declarations, `FunctionCallingMode.AUTO` and the system prompt `ASSISTANT_SYSTEM` (`prompts.ts`, version `assistant-v1`). Model: `VITE_GEMINI_ASSISTANT_MODEL`, else the hybrid cloud model (`gemini-3.5-flash-lite` by default). It is never routed on-device: Gemini Nano has no multi-turn chat or function calling, and an SDK-level test proves the Prompt API is not touched even when it reports `available`.

### Tools (`services/assistant/`)
| Tool | Wraps | Returns |
|---|---|---|
| `search_catalogue` | keyword vocabulary + `findMentionedTitle` + `rankTitles` (+ watchlist taste profile) | Only real catalogue titles, with the criteria each matched and the app's 0–100 match score |
| `get_viewer_preferences` | `buildProfile` over the watchlist | Top genres, moods, decades, watched titles, watchlist, title in the player |
| `get_playback_metrics` | `computeMetrics` (optionally the last N seconds) | Buffering time/ratio/frequency, throughput average/range/variability, bitrate, latency, errors and quality changes with event ids |
| `analyse_buffering` | `analyseBuffering` | Each stall: start/end ids, time, duration, throughput vs bitrate, latency, related events, factors; plus cross-stall patterns |
| `compare_network_conditions` | `computeMetrics` per period | Periods split at network-condition changes (else halves, or fixed windows) and best vs worst differences |
| `generate_diagnostic_report` | `healthFindings` + rules | Summary, most likely explanation (flagged when it is a correlation), observed/calculated evidence with ids, confidence and why, actions, limitations |

Tools receive a `ToolContext` (session, player settings, watchlist, catalogue) and nothing else: no Firestore, no fetch, no player controls. Every tool result carries a `dataSource` (`simulated`, `live`, `mixed`). Live notes say latency is the service's public website and throughput comes from Cloudflare, and that NYSUS cannot diagnose that service itself.

Diagnosis rules worth knowing: "unstable" means throughput fell below the bitrate and *recovered* (above the bitrate and at least 1.2 Mbps) two or more times; one drop that stays low is "poor". If even 360p needs more than the throughput measured around the stalls, the report says lowering quality will not fix it rather than recommending 360p.

### The loop (`services/ai/cloudAssistant.ts`)
We run function calling ourselves (no `functionReference`, so the SDK never executes anything):
1. `chat.sendMessage(text)`; the SDK keeps history, including Gemini 3 thought signatures.
2. For each `functionCall`: reject unknown names, validate args with strict Zod schemas (`toolSchemas.ts`), run the deterministic tool, catch errors. Problems go back to the model as `{ error }` so it can recover; nothing throws past the loop.
3. Send all `functionResponse` parts back in one message and repeat.

Limits per viewer message: 6 model calls, 10 tool executions, 60 s (an `AbortSignal` cancels the HTTP request). If a turn is cut short, the chat is rebuilt from the pre-turn history plus a plain user/model text pair, so the next request never carries a dangling function call. Errors and timeouts restore the pre-turn history.

### Grounding
- The diagnostic report card and recommendation cards render tool output directly, not the model's wording.
- `grounding.ts` checks the final answer: event ids it cites that no tool returned, and figures with units (%, Mbps, kbps, ms, s) that match no tool value (allowing rounding and kbps↔Mbps, ms↔s). Both are shown to the viewer in red/amber; cited ids that check out are listed with their event descriptions.
- A reply that used no tools says so.
- Tool activity rows are emitted by the loop as each call starts and finishes.
- Without Firebase, *Run diagnosis without AI* runs the same three tools directly and labels the result *Rules-based diagnosis, no AI*.

The conversation lives in memory only (spec 9.2: do not store unnecessary conversation data).

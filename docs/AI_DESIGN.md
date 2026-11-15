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
| Judges' browsers mostly won't have Gemini Nano ready (Chrome 139+ desktop, flag, multi-GB download). | Most demos will show cloud fallback. | Honest badge; "Prepare on-device model" button; record demo video on a prepared machine. |
| Chrome Prompt API honours JSON Schema loosely; small model may produce weaker extractions. | Lower-quality preferences on-device. | Simple schema (no nulls/unions), Zod validation, low temperature in cloud, evaluation set in Phase 2. |
| `firebase` and Prompt API are fast-moving. | API shape drift. | Pinned via lockfile; SDK-level integration test catches routing changes. |
| Spec example uses `releasePeriod: { after, before: null }`. | Nullables are poorly supported by the on-device constraint. | Flattened to optional `releaseAfter` / `releaseBefore`. |

## Workflow B — cloud assistant (Phase 4, not started)
Will use a separate `ONLY_IN_CLOUD`-style cloud model with `tools: [{ functionDeclarations }]`, a bounded function-calling loop with Zod-validated arguments, and deterministic tool implementations.

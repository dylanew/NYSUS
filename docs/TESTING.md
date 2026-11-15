# Testing

`npm test` runs Vitest (jsdom). No test makes a network call or needs credentials.

| Suite | Covers |
|---|---|
| `tests/unit/schemas.test.ts` | Zod validation of model output: fences, invalid JSON, ranges, enums, inverted periods |
| `tests/unit/firebaseConfig.test.ts` | Env → Firebase options; exact list of missing values; App Check settings |
| `tests/unit/inferenceMetadata.test.ts` | Badge wording never claims local unless the SDK said `on_device`; Prompt API probing |
| `tests/integration/hybridInference.test.ts` | `extractPreferences` with fake models: on-device, cloud fallback, on-device failure retry, missing source, input limits |
| `tests/integration/firebaseSdkHybrid.test.ts` | **Real `firebase/ai` SDK** with a faked `window.LanguageModel` and `fetch`: on-device routing passes our schema as `responseConstraint`; `downloadable` and no-Prompt-API cases go to `gemini-3.5-flash-lite` with `responseJsonSchema` |
| `tests/integration/DiscoveryPrompt.test.tsx` | UI shows extracted preferences and the honest source label; unconfigured state |

## Manual verification of live hybrid inference
Automated tests cannot prove Gemini Nano runs on a given machine. With `.env.local` configured:
1. Chrome 139+ desktop, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, restart.
2. Home → *Prepare on-device model*, wait for "On-device model ready".
3. Submit a request; badge should read *Processed on your device*.
4. In another browser (or with the flag off) the same request should read *Local model unavailable — using cloud fallback*.

Playwright end-to-end tests are planned once the Phase 2–4 user journeys exist.

### Results
| Date | Environment | Path | Result |
|---|---|---|---|
| 15 Nov 2026 | macOS, Chrome desktop, Prompt API flag on, App Check debug token | On-device (`on_device`) | Correct structured preferences for "A psychological thriller with a clever plot from the last ten years" (genre, mood, theme, 2016–2026, film). First request 25.6 s, which includes loading the model into memory. |

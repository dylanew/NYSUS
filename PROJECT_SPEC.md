# NYSUS — Project specification (summary)

The full build specification lives in the project thread; this file records the parts that drive engineering decisions.

## Proposition
NYSUS answers two connected questions: *what should I watch?* and *is my viewing experience working?* It combines natural-language discovery and recommendations with a simulated player whose telemetry a cloud AI assistant can investigate using tools.

## AI split
| Workflow | Runs on | Used for |
|---|---|---|
| A. Hybrid inference | Firebase AI Logic `PREFER_ON_DEVICE` (Chrome Prompt API, cloud Gemini fallback) | Single-turn structured extraction: preferences, moods, genres |
| B. Cloud assistant | Firebase AI Logic, cloud Gemini with function calling | Multi-turn chat, tool calls, diagnostic reports |
| Deterministic code | TypeScript | Telemetry, metrics, anomaly detection, ranking |

The inference source shown in the UI must come from the SDK's `response.inferenceSource`, never be assumed.

## Phases (deadline 30 Nov 2026, 22:00 GMT)
1. **Foundation and hybrid inference** — scaffold, shell, Firebase + App Check, real hybrid call with source shown. *(done)*
2. Entertainment discovery — catalogue, ranking, explanations, watchlist. *(done)*
3. Streaming player and telemetry — live network measurement and deterministic scenarios, metrics, charts. *(done)*
4. Agentic assistant — six tools, validated function-calling loop, grounded reports. *(built; needs a live check against Gemini)*
5. Persistence and polish — guest mode/auth, Firestore, responsive UI. *(done: anonymous guest + Google, Firestore with tested rules, lazy pages, Playwright journey)*
6. Deployment and submission — Firebase Hosting, docs, demo video, Devpost. *(config, docs, video script and Devpost draft done: [DEPLOYMENT.md](docs/DEPLOYMENT.md), [DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md), [DEVPOST.md](docs/DEVPOST.md); deploy, fresh-browser test, recording and submission are the owner's steps)*

## Non-goals for the MVP
Real streaming-service integrations, real video backend, complex ML recommenders, multiple autonomous agents, social features, payments.

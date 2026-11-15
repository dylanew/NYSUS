# NYSUS

An AI-powered streaming companion: personalised entertainment discovery plus intelligent (simulated) playback diagnostics. Built for the Firebase #BuildHybridAI hackathon.

> Status: **Phase 2 — entertainment discovery.** Describe what you want to watch; Firebase AI Logic hybrid inference extracts structured preferences on-device (Chrome's built-in model) or in the cloud (Gemini) and shows which one actually ran. Deterministic ranking then recommends titles from a 48-title demo catalogue, explains each match, and lets you build a watchlist. Without Firebase, discovery falls back to clearly labelled keyword matching.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web app config (see below)
npm run dev                  # http://localhost:5173
```

Without `.env.local` the app still runs; AI features explain what is missing.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and production build |
| `npm test` | Vitest unit + integration tests (no network, no credentials) |
| `npm run lint` | oxlint |

## Firebase setup

1. Create a Firebase project and register a **Web app**.
2. In the console, open **AI Logic** and enable the **Gemini Developer API** provider.
3. Set up **App Check** with a **reCAPTCHA Enterprise** key for the web app, and make sure the Firebase AI Logic API shows as *Enforced* (enforcement is mandatory from 2 Nov 2026).
4. Copy the web app config and site key into `.env.local` (see `.env.example`).
5. For local development set `VITE_APPCHECK_DEBUG=true`, load the app, copy the debug token the SDK prints in the console, and register it under App Check → Apps → *Manage debug tokens*. Never commit it.

## Seeing on-device inference

On-device inference needs **Chrome 139+ on desktop** with `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` enabled and enough free disk for the model download. On the Home page, the status line shows whether the model is ready; click **Prepare on-device model** to start the download. Until it is ready, requests fall back to the cloud and are labelled that way.

## Documentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — product spec summary and phase plan
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/AI_DESIGN.md](docs/AI_DESIGN.md) — hybrid inference design, verified SDK behaviour, risks
- [docs/TESTING.md](docs/TESTING.md)

## Licence

Apache 2.0 — see [LICENSE](LICENSE).

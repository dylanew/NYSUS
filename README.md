# NYSUS

An AI-powered streaming companion: personalised entertainment discovery plus playback diagnostics driven by live measurements of your own connection or by scripted scenarios. Built for the Firebase #BuildHybridAI hackathon.

> Status: **Phase 5 — persistence and polish.** No account needed: you start as a guest (an anonymous Firebase account with a private Firestore space, or just this browser if that's off) and can *Load demo profile* for instant personal recommendations. *Continue with Google* keeps your watchlist, taste and playback sessions across devices. Everything is saved to Firestore under strict, emulator-tested security rules. Pages load lazily with error boundaries, and a Playwright suite runs the full spec journey with a scripted model.
>
> Phase 4 — agentic streaming assistant. Ask "why does my stream keep buffering?" from any page (the *Ask NYSUS* button), the Player or Stream Health. Gemini in the cloud, through Firebase AI Logic, decides which of six app tools to call; the app validates and runs them on the real session telemetry and shows each call as it happens. Answers cite event ids, a diagnostic report card shows the deterministic findings, and invented ids or figures are flagged. Without Firebase, the same tools run as a labelled rules-based diagnosis.
>
> Phase 3: Pick a title and either measure your **live connection** (real download speed via Cloudflare's public speed-test endpoint, plus response time to a chosen streaming service's website: Netflix, Prime Video, Disney+, YouTube, Apple TV+ or BBC iPlayer) or pick a scripted condition (stable, unstable, poor, interruption). A player model then buffers, switches quality and fails as a real player would. Live mode runs in real time and uses data, capped at 150 MB per run. It cannot see any service's own video servers, which no service exposes. Stream Health charts the telemetry and lists rule-based findings with event IDs as evidence.
>
> Phase 2: Describe what you want to watch; Firebase AI Logic hybrid inference extracts structured preferences on-device (Chrome's built-in model) or in the cloud (Gemini) and shows which one actually ran. Deterministic ranking then recommends titles from a 48-title demo catalogue, explains each match, and lets you build a watchlist. Without Firebase, discovery falls back to clearly labelled keyword matching.

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
| `npm run test:rules` | Firestore rules + repository tests on the emulator (needs Java) |
| `npm run test:e2e` | Playwright end-to-end suite with a scripted model |
| `npm run lint` | oxlint |

## Firebase setup

1. Create a Firebase project and register a **Web app**.
2. In the console, open **AI Logic** and enable the **Gemini Developer API** provider.
3. Set up **App Check** with a **reCAPTCHA Enterprise** key for the web app, and make sure the Firebase AI Logic API shows as *Enforced* (enforcement is mandatory from 2 Nov 2026).
4. Copy the web app config and site key into `.env.local` (see `.env.example`).
5. **Authentication → Sign-in method:** enable **Anonymous** (gives guests a private cloud space; without it guests are saved in the browser only) and **Google** (optional sign-in). Under **Settings → Authorised domains**, `localhost` is there by default; add your hosting domain when you deploy.
6. **Firestore Database → Create database** (production mode, a region near you). Then deploy the rules from this repo: `npx firebase login`, `npx firebase use --add` (pick the project), `npx firebase deploy --only firestore:rules`. Optionally enforce App Check for Cloud Firestore under **App Check → APIs** once the app works with it.
7. For local development set `VITE_APPCHECK_DEBUG=true`, load the app, copy the debug token the SDK prints in the console, and register it under App Check → Apps → *Manage debug tokens*. Never commit it.

## Seeing on-device inference

On-device inference needs **Chrome 139+ on desktop** with `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` enabled and enough free disk for the model download. On the Home page, the status line shows whether the model is ready; click **Prepare on-device model** to start the download. Until it is ready, requests fall back to the cloud and are labelled that way.

## Documentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — product spec summary and phase plan
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/AI_DESIGN.md](docs/AI_DESIGN.md) — hybrid inference, the cloud assistant's tools and loop, verified SDK behaviour, risks
- [docs/TESTING.md](docs/TESTING.md)

## Licence

Apache 2.0 — see [LICENSE](LICENSE).

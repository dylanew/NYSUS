# Devpost submission draft

Copy each section into the matching Devpost field. Check the hackathon's official rules page for any extra questions (for example, which Firebase products you used) and answer them from the *Built with* list below. Replace anything in **[brackets]**.

---

**Project name:** NYSUS

**Tagline / elevator pitch** (Devpost limit is 200 characters):

> An AI streaming companion that knows what you want to watch and why it won't play: hybrid on-device/cloud discovery, plus a Gemini agent that diagnoses buffering from real telemetry.

**Links**

- Live demo: https://nysus-6411b.web.app
- Code: https://github.com/dylanew/NYSUS (Apache 2.0)
- Video: **[YouTube link]**

---

## Inspiration

Every streaming app is good at one question, *what should I watch?*, and silent on the next one: *why does it keep buffering?* When playback breaks, you get a spinner and a guess. We wanted one companion that understood both the viewer and the viewing experience, and the hackathon's hybrid AI theme fitted that split naturally: quick, private understanding of what you want on your own device, and deeper investigation in the cloud.

## What it does

**Discover.** Type what you're in the mood for, like *"something like Interstellar, but darker and more suspenseful"*. Firebase AI Logic's hybrid inference turns it into structured preferences (genres, moods, themes, era, length), on your device with Chrome's built-in Gemini Nano when it's available, or with cloud Gemini when it isn't. A badge shows where it actually ran, taken from the SDK's own `inferenceSource`. Deterministic ranking then recommends titles from a curated 48-title catalogue, and every recommendation explains why it matched. Build a watchlist; your taste shapes *Recommended for you*.

**Watch.** A simulated player, styled as a retro TV, streams with a real adaptive-bitrate model: a buffer, quality switches, stalls, errors and recovery. Pick a reproducible scenario (stable, unstable, poor, interruption), or **Live** mode, which measures your actual download speed and a streaming service's website response time and feeds those numbers into the same engine.

**Investigate.** Ask *"why does my stream keep buffering?"* from anywhere. A Gemini agent with function calling picks from six app tools (catalogue search, viewer preferences, playback metrics, buffering analysis, network comparison, diagnostic report). You watch each tool call happen. The answer separates what was observed from what's likely, cites the exact telemetry events, and comes with a report card rendered straight from tool output. If the model ever quotes an event id or a figure that no tool returned, NYSUS flags it in red.

**Stream Health** charts the session and lists rule-based findings, so you can check the agent's work. Everyone starts as a guest with a private, cloud-saved space; *Continue with Google* keeps it across devices.

## How we built it

React 19 and TypeScript (strict) on Vite, Tailwind CSS 4 and Recharts, with no custom backend: Firebase and application code only.

The AI is split deliberately in three:

1. **Hybrid inference (Workflow A).** Firebase AI Logic in `PREFER_ON_DEVICE` mode does single-turn structured extraction. One JSON Schema goes to both paths: as `responseConstraint` for the Chrome Prompt API and `responseJsonSchema` for cloud Gemini. Zod validates every response.
2. **Cloud agent (Workflow B).** An `ONLY_IN_CLOUD` Gemini model with six function declarations. We run the loop ourselves: unknown tools are rejected, arguments are validated with strict Zod schemas, and each turn is capped at 6 model calls, 10 tool runs and 60 seconds. Tools only see a read-only context: no network, no database, no player controls.
3. **Deterministic TypeScript** for everything numeric: ranking and explanations, the playback engine (a seeded, reproducible simulation), metrics, stall analysis and health findings. The model never calculates a number it reports.

Firebase services: **AI Logic** (Gemini Developer API, hybrid and cloud), **App Check** with reCAPTCHA Enterprise (mandatory for AI Logic), **Authentication** (anonymous guests linked to Google), **Cloud Firestore** with local-first sync and strict per-user security rules, and **Hosting**.

Testing: 180 Vitest unit and integration tests, including the real `firebase/ai` SDK against a faked Chrome Prompt API and network to prove the routing; Firestore rules tests on the emulator; a Playwright journey that runs the spec's full story with a scripted model driving the real tool loop; and a small discovery evaluation set built from recorded live model outputs.

## Challenges we ran into

- **What "hybrid" really does.** We read the SDK source: `PREFER_ON_DEVICE` falls back to the cloud when the local model isn't ready, but not when an on-device prompt throws. We added a cloud retry for that case and made the badge report every path honestly.
- **App Check.** AI Logic enforces App Check, and our standard tokens were rejected with *401 token is invalid* even though their claims were correct. Switching to limited-use (replay-protected) tokens fixed it; a *Test App Check* button in Settings compares both.
- **A small model inventing things.** Gemini Nano added a 2020–2027 release period to a request that never mentioned dates. Rather than trust the model, guards now drop any preference the request doesn't support, and tell the user.
- **Grounding an agent.** Getting the model to call tools was easy; stopping it from adding a plausible number was harder. We check every cited id and figure against the tool results.
- **Being honest about live data.** No streaming service exposes its video servers, so live mode measures the viewer's connection and a service's public website, and the app and the agent both say exactly that.

## Accomplishments that we're proud of

- Genuine hybrid inference, verified live on both paths, with a badge that can't lie.
- An agent whose every number traces back to code and every claim to an event id.
- Reproducible playback problems that make the demo reliable, plus a live mode on real measurements.
- No sign-up for judges, yet data saved securely in Firestore.
- A test suite that exercises the real Firebase SDK without depending on live Gemini.

## What we learned

On-device models are best at small, structured jobs; give them a tight schema and validate everything. Agents get trustworthy when the application, not the model, owns the facts. And reading the SDK source beat guessing from the docs more than once.

## What's next for NYSUS

- Firebase Remote Config for model choice, ranking weights and diagnostic thresholds.
- On-device classification of the viewer's question, so simple ones never leave the device.
- A larger catalogue and evaluation set, and comparing sessions across days.
- Real player telemetry (for example from an HTML5 video element on licensed content) in place of the simulation.

## Built with

`react` `typescript` `vite` `tailwind-css` `firebase` `firebase-ai-logic` `gemini` `gemini-nano` `chrome-built-in-ai` `firebase-app-check` `firebase-authentication` `cloud-firestore` `firebase-hosting` `recharts` `zod` `vitest` `playwright`

## Submission checklist

- [ ] Hosted app tested in a fresh Incognito window ([DEPLOYMENT.md](DEPLOYMENT.md#test-the-hosted-app-from-a-fresh-browser-session))
- [ ] Repository public with licence ✓ (Apache 2.0)
- [ ] Video under 3 minutes, public or unlisted on YouTube
- [ ] Screenshots uploaded to the Devpost gallery (`docs/screenshots/`)
- [ ] All Devpost fields filled, then **Submit** before **30 Nov 2026, 22:00 GMT**

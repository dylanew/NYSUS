# Demo video script (under 3:00)

Follows spec section 15. About 390 words of voice-over, which is roughly 2:40 at a relaxed pace, leaving room for pauses while things load. Timings are targets; trim the voice-over rather than rush it.

## Before you record

- [ ] Use the **hosted site** (https://nysus-6411b.web.app), so the video shows what judges get.
- [ ] Desktop Chrome with Gemini Nano **already downloaded and warm**: enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, restart Chrome, open Home, click **Prepare on-device model**, wait for *On-device model ready*, then run one throwaway search so the model is loaded (the first on-device request took 25 s in testing).
- [ ] Start from a clean guest: account menu → **Delete my saved data** (click it twice to confirm), then reload.
- [ ] Close other tabs, hide bookmarks bar (Cmd+Shift+B), set the browser window to 1920×1080 or full screen, zoom 100% or 110%.
- [ ] Turn on Do Not Disturb.
- [ ] Do one full rehearsal. Live Gemini answers vary, so if a take's answer is weak, run it again.
- [ ] Record with **Cmd+Shift+5** → *Record Entire Screen* (or a selected window), Options → your microphone. Or record the screen silently and add the voice-over afterwards in iMovie, which is easier to get right.

## Script

### 0:00–0:20 · Introduction
**Screen:** Home page, slow scroll from the hero to *Featured*.

> Streaming apps answer one question: what should I watch? But the moment something starts buffering, you're on your own. NYSUS answers both questions: what to watch, and why it won't play properly. It's built on Firebase AI Logic's hybrid inference, with a Gemini agent that investigates real playback telemetry.

### 0:20–0:55 · Hybrid AI
**Screen:** Click **Load demo profile**. Go to **Discover**. Type *"Something like Interstellar, but darker and more suspenseful"* and search. Hover or zoom on the inference badge, then the extracted preferences.

> I'll load a demo profile, then ask for something like Interstellar, but darker and more suspenseful. Firebase AI Logic runs this on my device first, using Chrome's built-in Gemini Nano, and turns my sentence into structured preferences: science fiction, dark, suspenseful, space exploration. The badge comes straight from the SDK: this one really ran *on device*.

**Screen:** Toggle **Cloud only**, search again, show the badge change.

> Switch to cloud only, and the same request goes to Gemini in the cloud. That's what happens automatically on browsers without a local model, and NYSUS says so instead of pretending.

### 0:55–1:20 · Discovery
**Screen:** Point at the top recommendation's explanation. Click **Add to watchlist**. Briefly open the title page.

> The AI only extracts what I asked for. Ranking is plain, deterministic code over a curated catalogue, and every result says why it matched, using catalogue data, not model guesswork. I'll add this one to my watchlist and open it.

### 1:20–1:50 · Playback
**Screen:** **Player**. Select **Poor connection**, press play, click **Simulate 30 s** twice. Let the TV show buffering and the quality drop.

> The player is a simulation, deliberately. It models a real adaptive-bitrate player: a buffer, quality switches, stalls and errors. I'll choose a poor connection and skip ahead. Throughput falls below what the video needs, the buffer runs dry, and it stalls. Every event is logged with an id. There's also a live mode that measures my own connection.

### 1:50–2:35 · Agentic investigation
**Screen:** Click **Ask why it's buffering**. Let the tool rows appear one by one. Scroll the report card, then the answer, hovering a cited event id.

> Now I ask: why does my stream keep buffering? This is Gemini in the cloud with function calling. It decides which tools it needs: playback metrics, buffering analysis, then a diagnostic report. Each row is a real tool call the app validated and ran on this session. The numbers come from code, not the model. The answer separates what was observed from what's likely, cites the exact events, and if it ever quoted an id or a figure no tool returned, NYSUS would flag it in red.

### 2:35–3:00 · Conclusion
**Screen:** **Stream Health**: the charts and findings. End on the NYSUS wordmark or Home.

> Stream Health shows the same session as charts and rule-based findings, so you can check the assistant's work. On-device AI for quick, private understanding; a cloud agent for investigation; deterministic code for every number. NYSUS understands what you want to watch, and the experience of watching it.

## After recording

- Trim dead time while things load; keep the tool rows appearing in real time, since that's the point.
- Check the length is **under 3:00**.
- Upload to YouTube as **Public** or **Unlisted** (Devpost needs a public link), title *NYSUS: hybrid AI streaming companion · #BuildHybridAI*, and paste the link into Devpost.

## If something goes wrong on the day

| Problem | Fallback |
|---|---|
| On-device badge says cloud fallback | Gemini Nano isn't ready. Re-run *Prepare on-device model*, or record that segment with the cloud badge and say "on this machine the local model isn't ready, so it falls back and says so". |
| Assistant answer is slow or odd | Retake; or use **Connection interruption**, whose error event gives a very clear report. |
| App Check / AI error on the hosted site | Record against `npm run dev` locally with your debug token, and check [DEPLOYMENT.md](DEPLOYMENT.md) step 3 afterwards. |

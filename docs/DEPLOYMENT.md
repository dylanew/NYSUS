# Deploying NYSUS to Firebase Hosting

NYSUS is a static single-page app, so Firebase Hosting serves the files that `npm run build` writes to `dist/`. There is no server to run. The live site is:

- **https://nysus-6411b.web.app** (also https://nysus-6411b.firebaseapp.com)

These steps are written for macOS Terminal. Copy each grey block, paste it into Terminal, press Return, and wait for it to finish before the next one.

## What the repo already sets up

| File | What it does |
|---|---|
| `firebase.json` → `hosting` | Serves `dist/`, sends every path (`/player`, `/title/…`) to `index.html` so deep links work, caches the hashed files in `/assets/` for a year and `index.html` never, so a new deploy shows up at once. |
| `package.json` → `npm run deploy` | Checks `.env.local`, builds, and deploys Hosting only (never touches Firestore rules) to project `nysus-6411b`. |
| `scripts/check-deploy-env.mjs` | Stops the deploy if a Firebase value or the reCAPTCHA site key is missing, so you never publish a site that silently runs without AI. |
| `.env.production` | Blanks the App Check debug settings for production builds. Vite copies every `VITE_*` value into the public JavaScript, so a debug token left in `.env.local` would otherwise be readable by anyone, and would let them call Gemini as your app. `vite.config.ts` also refuses to build if a token gets in another way. |

## One-time setup

### 1. Open the project in Terminal

Type `cd ` (with a space after it), drag your NYSUS folder from Finder onto the Terminal window, then press Return. Then get the latest code and dependencies:

```bash
git checkout main
git pull
npm install
```

### 2. Check `.env.local`

The site is built from the same `.env.local` you use for local development. Show which values are filled in (this prints the names only, not the values):

```bash
grep -E '^VITE_[A-Z_]+=.+' .env.local | cut -d= -f1
```

You need at least these five in the list:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY
```

It's fine if `VITE_APPCHECK_DEBUG_TOKEN` is there too: production builds ignore it.

### 3. Let the reCAPTCHA key work on the hosted site

App Check uses a reCAPTCHA Enterprise key that only answers on the domains listed on it. Locally that's `localhost`; the hosted site needs its own two domains or every AI call fails with an App Check error.

1. Open https://console.cloud.google.com/security/recaptcha?project=nysus-6411b (sign in with the same Google account as Firebase).
2. Click the key whose ID matches `VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY` in `.env.local`.
3. Click **Edit key** (top of the page). Under **Domains**, click **Add a domain** and add `nysus-6411b.web.app`, then add `nysus-6411b.firebaseapp.com`. Keep `localhost`.
4. Click **Update key** (or **Save**) at the bottom.

If the page looks different: you're looking for the list of domains on that key. The search box at the top of Google Cloud console finds it if you type "reCAPTCHA".

### 4. Check sign-in is allowed on the hosted site

1. Open https://console.firebase.google.com/project/nysus-6411b/authentication/settings
2. Click **Authorized domains** (it may be a tab, or a row in the left-hand list on that page).
3. `nysus-6411b.web.app` and `nysus-6411b.firebaseapp.com` are normally there already. If either is missing, click **Add domain** and add it.

### 5. Log in to the Firebase CLI

You did this when you deployed the Firestore rules, so it will probably say you're already logged in:

```bash
npx -y firebase-tools login
```

## Deploy

Every time you want to publish the current code:

```bash
npm run deploy
```

It takes about a minute and ends with:

```
✔  Deploy complete!
Hosting URL: https://nysus-6411b.web.app
```

If it says **Cannot deploy: these values are missing from .env.local**, add the listed values (step 2) and run it again.
If it says **Refusing to build: VITE_APPCHECK_DEBUG…**, a debug token is set somewhere other than `.env.local`; run `unset VITE_APPCHECK_DEBUG VITE_APPCHECK_DEBUG_TOKEN` and try again.
If it asks you to log in, run step 5.

To deploy without the npm script, this is the same thing:

```bash
npm run build && npx -y firebase-tools deploy --only hosting --project nysus-6411b
```

### Firestore rules

The rules are already deployed. Redeploy them only if `firestore.rules` changes:

```bash
npx -y firebase-tools deploy --only firestore:rules --project nysus-6411b
```

### Undo a bad deploy

Open https://console.firebase.google.com/project/nysus-6411b/hosting, find the release history list, click the **⋮** menu on the previous release and choose **Roll back**.

## Test the hosted app from a fresh browser session

Spec Phase 6 asks for this, and it's what a judge will see. Use a **Chrome Incognito window** (File → New Incognito Window): no saved data, no debug token, no on-device model.

1. Open https://nysus-6411b.web.app. You start as a guest; no sign-in prompt.
2. **Home:** click **Load demo profile**. *Recommended for you* fills in.
3. **Discover:** type `Something like Interstellar, but darker and more suspenseful` and search. The badge should say *Processed using cloud AI* or *Local model unavailable — using cloud fallback* (Incognito has no on-device model). It must **not** say *AI unavailable — matched by keywords*; if it does, the reason under it says what failed (usually step 3 above).
4. Add a result to the watchlist, then reload the page: it's still there.
5. **Player:** choose **Poor connection**, press play, click **Simulate 30 s** a couple of times. Buffering shows on the TV.
6. Click **Ask why it's buffering**. The assistant shows tool rows (*Checking playback metrics…*, *Investigating buffering events…*), a diagnostic report card, and an answer citing event ids like `s1-e12`.
7. **Stream Health:** charts and findings for the same session.
8. Open the account menu, click **Continue with Google**, sign in. The watchlist stays.
9. Open the site on your phone too.

If step 3 or 6 fails with an App Check error, recheck step 3 above; key changes can take a few minutes to apply.

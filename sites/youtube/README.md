# OpenTube

An open-source video platform, rebuilt from scratch as plain HTML, CSS and JavaScript —
no framework, no bundler, no backend, no tracking.

It is part of the **Open Source Websites** collection: hand-built, dependency-free
recreations of familiar web products, using original code, copy and assets.

```
node dev-server.mjs              # builds the pages, serves on http://localhost:4321
./scripts/preview.sh         # same, but installs missing dev deps first
PORT=4400 ./scripts/preview.sh
```

`scripts/preview.sh` is the convenience entry point: it installs the dev
dependency when `node_modules` is missing, refuses to start a second server if
the port is already serving the app, then builds and serves.

---

## What is implemented

| Area | Details |
| --- | --- |
| Feed | Chip bar with nine categories, date-sorted grid, "Continue watching" row built from your own history |
| Player | Custom controls: play/pause, pointer-scrub with buffered range, volume, 0.5×–2× speed, transcript captions, theater mode, fullscreen, idle-hiding chrome |
| Chapters | Timestamped chapters inside the description, current chapter highlighted as the video plays |
| Keyboard | `k`/space play, `j`/`l` ±10 s, `←`/`→` ±5 s, `↑`/`↓` volume, `m` mute, `c` captions, `t` theater, `f` fullscreen, `/` search |
| Channels | Banner, avatar, Home / Videos / About tabs, subscribe, links and stats |
| Search | Title, description, tag and channel matching with highlighted terms, plus filter chips and channel results |
| Library | Watch history with resume positions, Watch later, liked videos and a subscription feed |
| Comments | Sort by top/newest, like counts, locally posted comments |
| Theming | Light and dark, follows the OS until you override it in the account menu |
| Accessibility | Skip link, landmarks, focus-visible rings, `aria-pressed`/`aria-selected` state, reduced-motion support, keyboard-operable player |
| Responsive | Five-column desktop grid down to a single column, collapsing sidebar → icon rail → drawer |

Everything a user does (subscriptions, likes, saved videos, history, theme) is stored in
`localStorage` under one key. There is no account system and no network calls.

## Live YouTube data (optional)

The site ships with a fictional dataset so it runs offline with no accounts, keys or
network calls. It can also run on **real YouTube data** through the official
[YouTube Data API v3](https://developers.google.com/youtube/v3), opened from the
account menu → **Live YouTube data…**.

What changes when live mode is on:

| Area | Offline demo | Live YouTube |
| --- | --- | --- |
| Home | Curated fictional feed | `chart=mostPopular` for the chosen region |
| Search | Local dataset matching | `search.list` + `videos.list`, plus channel results |
| Channels | Dataset entry | `channels.list` by id/handle/name, uploads playlist |
| Playback | Custom `<video>` player | Official YouTube embedded player (`youtube-nocookie.com`) |
| Comments | Local + seeded | `commentThreads` (best effort) |
| Chapters, captions, speed | Yes | No — those belong to the embed; use YouTube's own controls |

### Setting it up

1. In Google Cloud Console create a project and enable **YouTube Data API v3**.
2. Create an API key and restrict it to **HTTP referrers** for the host you serve
   this site from (add `http://localhost:4321/*` while developing).
3. Open the account menu → **Live YouTube data…**, paste the key, press **Save & test**.

The key is stored in `localStorage` under `opentube:youtube-key` and is only ever sent
to `googleapis.com`. It is client-side, so treat it as public: use referrer
restrictions and, if you deploy this, a key dedicated to the demo.

### Quota

The free allowance is 10,000 units/day. Trending and channel pages cost **1 unit**,
a search costs **100**, so budget roughly 100 searches a day. Responses are cached in
`sessionStorage` for 10 minutes, which also makes repeat navigation free. Quota and
key errors are surfaced in the UI with an explanation and a one-click fall back to
the offline dataset.

### Design notes for the integration

- `assets/youtube-api.js` is the whole client: URL building, normalisation to the same
  video/channel shape the offline dataset uses, caching, and `ApiError` with a
  machine-readable `reason`.
- `assets/live.js` owns the UI: the connector modal, live rendering for feed/search/
  channel/watch, and the embedded player. It decides *synchronously* whether a page is
  live-owned (`claims()`), so demo clips keep the custom player even with live mode on.
- Every failure path renders an explanation plus **Try again**, **API settings** and
  **Use the offline demo** — live mode can never leave a blank page.

### Verification note

The build sandbox has no network route to `googleapis.com` or `youtube.com`, so the
live path is covered by tests against a stubbed `fetch` (`tests/youtube-api.test.mjs`
and the live sections of `tests/ui.test.mjs`) rather than by hitting the real API.
Connecting a real key in a browser is the remaining manual step.

## Google account & watch history

`settings.html` connects the site to **your** YouTube account, and to nothing else.

| What | How | Scope |
| --- | --- | --- |
| Your channel, subscriptions, liked videos, playlists | Google Identity Services token flow, called from the browser | `youtube.readonly` |
| Watch history | **Google Takeout import** — the API does not expose it | n/a |

**Watch history is not available through the YouTube Data API.** No key and no OAuth scope can
read it; Google keeps it behind Takeout only. Settings → Watch history accepts
`watch-history.json` (or the HTML export), filters out ad views and non-video entries, and the
result appears in Library → History. This is a limit of Google's platform, not a shortcut here.

Sign-in uses the browser-only token flow, so there is **no client secret** to leak and no server
component: paste an OAuth client ID, add this origin under *Authorised JavaScript origins*, and
sign in. The access token is kept in `sessionStorage` for the tab and revoked on sign-out.

## No ads, no trackers

The site renders no advertising and loads no third-party analytics, fonts or CDNs. `vercel.json`
ships a Content-Security-Policy that permits only this origin plus `googleapis.com`,
`accounts.google.com` and the YouTube embed frame, so an injected ad script could not load even
if one were added. Settings has a live network audit that lists every third-party origin the page
actually contacted.

The one honest exception: ads YouTube plays **inside its own embedded player** cannot be removed
by this site — that is YouTube's player and its terms. Only YouTube Premium removes those.

## Deploying to Vercel

Live at **https://opentube-two.vercel.app** (project `opentube`, root directory `sites/youtube`).

The site is plain files, so nothing is compiled at the edge. `vercel.json` declares
`@vercel/static` builds for `**/*.html` and `assets/**`, maps `/` and the extension-less page
names to their files, and adds the security headers listed above:

- `@vercel/static` is used instead of framework detection on purpose. Vercel auto-detected a
  Node app from the sibling `package.json` and looked for a server entrypoint, which produced an
  empty deployment. Declaring the builds (and naming the local server `dev-server.mjs` rather
  than `server.mjs`) keeps the deployment purely static.
- Legacy `builds` supersede the project's Build Command, so the builders are ignored at deploy
  time. Run `npm run build` (or open `dev-server.mjs`, which rebuilds on start) before pushing.

```bash
cd sites/youtube
npm run build          # regenerate the 7 pages from src/
npx vercel --prod      # or let the git push deploy
```

For Google sign-in, add the deployment origin — `https://opentube-two.vercel.app` — to the OAuth
client's **Authorised JavaScript origins**, and add it to the API key's HTTP-referrer
restrictions. Without that, the key or the consent screen will reject browser requests from the
deployed site.

## Project layout

```
sites/youtube/
├── index.html · watch.html · channel.html · search.html · library.html · about.html
├── assets/
│   ├── styles.css        design tokens + all layout (light/dark)
│   ├── data.js           9 channels, 18 videos, comments (offline dataset)
│   ├── youtube-api.js    YouTube Data API v3 client + normalisation
│   ├── auth.js           Google sign-in (GIS token flow) + Takeout importer
│   ├── live.js           live mode: connector modal, live rendering, embed
│   ├── library-account.js  account-backed Library tabs
│   ├── settings.js       settings page controller
│   ├── app.js            router, rendering, player, comments
│   ├── avatars/          generated channel avatars (SVG)
│   ├── thumbs/           generated thumbnails (JPEG, 1280×720)
│   └── video/            generated ambient clips (MP4/AVC + AAC)
├── src/
│   ├── layout.html       document shell
│   ├── partials/         header, icon sprite, menus, footer
│   └── pages/            page bodies with a JSON meta header
├── scripts/
│   ├── preview.sh        deps + build + serve (idempotent)
│   ├── build-pages.mjs   src/ → static HTML
│   ├── build-media.sh    thumbnails + clips via ffmpeg
│   └── build-avatars.py  channel avatar SVGs
├── tests/
│   ├── ui.test.mjs       jsdom UI checks, incl. live + settings (101)
│   ├── youtube-api.test.mjs  API client against a stubbed fetch (59)
│   └── auth.test.mjs     sign-in lifecycle + Takeout parser (38)
├── package.json          start / build / test scripts
└── dev-server.mjs            static server with byte-range support
```

The generated `*.html` files at the root are committed, so the folder can be hosted
anywhere as-is. `src/` is the source of truth; run `node scripts/build-pages.mjs`
after editing a partial or page body.

## Media pipeline

All media is generated locally, so the repo ships nothing borrowed:

```bash
# clips need ffmpeg with libx264 and the `gradients` filter
FFMPEG=/path/to/ffmpeg ./scripts/build-media.sh

# avatars need nothing but Python 3
python3 scripts/build-avatars.py
```

`build-media.sh` normalises the source photographs to 1280×720, derives alternate
crops for secondary videos, and synthesises six ambient clips (a slow-moving
gradient plus a sine chord, faded in and out). Clip lengths are read from
`CLIP_LENGTH` in `assets/data.js`, so a card's duration badge always matches the file.

## Tests

```bash
npm install     # jsdom, devDependency only
npm test        # API client, auth, then jsdom UI suites (198 checks)
```

The suite (`tests/ui.test.mjs`) runs the real site in jsdom: it filters the feed,
subscribes, likes, toggles captions and theater mode, posts a comment, searches,
and reloads with seeded `localStorage` to check resume positions, saved videos and
theme restoration. Any uncaught script error fails the run — 57 checks in total.

## Design notes

- **No framework.** Rendering is template strings plus small DOM helpers in `app.js`
  (~1,300 lines including comments).
- **One dataset, every page.** The feed, channel pages, search, watch metadata and the
  "up next" rail all read from `assets/data.js`.
- **CSS custom properties for theming.** `data-theme="dark"` on `<html>` swaps the token
  set; there are no duplicated dark-mode rules.
- **Real media.** Every clip exists, so play, seek, buffered ranges and captions are
  genuinely exercised rather than mocked.

## Attribution and licence

MIT, like the rest of this repository.

OpenTube is an independent demonstration. It is **not affiliated with, endorsed by or
connected to YouTube or Google**, and it ships no YouTube trademarks, logos, code or
media. The name, mark, layout interpretation and all content are original; the demo
channels, videos, view counts and comments are fictional.

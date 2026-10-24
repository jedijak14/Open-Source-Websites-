# OpenTube

An open-source video platform, rebuilt from scratch as plain HTML, CSS and JavaScript —
no framework, no bundler, no backend, no tracking.

It is part of the **Open Source Websites** collection: hand-built, dependency-free
recreations of familiar web products, using original code, copy and assets.

```
node server.mjs          # builds the pages, serves on http://localhost:4321
```

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

## Project layout

```
sites/youtube/
├── index.html · watch.html · channel.html · search.html · library.html · about.html
├── assets/
│   ├── styles.css        design tokens + all layout (light/dark)
│   ├── data.js           9 channels, 18 videos, comments
│   ├── app.js            router, rendering, player, comments
│   ├── avatars/          generated channel avatars (SVG)
│   ├── thumbs/           generated thumbnails (JPEG, 1280×720)
│   └── video/            generated ambient clips (MP4/AVC + AAC)
├── src/
│   ├── layout.html       document shell
│   ├── partials/         header, icon sprite, menus, footer
│   └── pages/            page bodies with a JSON meta header
├── scripts/
│   ├── build-pages.mjs   src/ → static HTML
│   ├── build-media.sh    thumbnails + clips via ffmpeg
│   └── build-avatars.py  channel avatar SVGs
├── tests/ui.test.mjs     jsdom UI checks (57 assertions)
├── package.json          start / build / test scripts
└── server.mjs            static server with byte-range support
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
npm test        # boots the server, loads every page, drives the UI
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

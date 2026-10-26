# OpenTube for Android TV

A native Android TV / Fire TV client for OpenTube, written in Java with no third-party runtime
dependencies — no AndroidX, no Compose, no ExoPlayer, no analytics.

**APK:** [`dist/OpenTube-TV.apk`](dist/OpenTube-TV.apk) — built by GitHub Actions from this
directory on every change (see [`.github/workflows/opentube-tv.yml`](../../../.github/workflows/opentube-tv.yml)).
Debug-signed, so it installs directly; it is not on the Play Store.

```
adb connect <tv-ip>:5555
adb install -r sites/youtube/tv/dist/OpenTube-TV.apk
```

On a Fire TV / Google TV stick without ADB, use *Downloader* with the raw URL of the APK, or copy it
to a USB stick and open it with any file manager.

---

## The remote is the only input

Everything is reachable with five keys. Cards scale and highlight when focused, the shelf scrolls
itself as focus moves, and the player says what each key does on screen.

| Where | Key | Does |
| --- | --- | --- |
| Anywhere | D-pad | Move between rail, rows and cards |
| Anywhere | Centre | Open / activate |
| Anywhere | Back | Up one screen; from Home, leave |
| Player | Centre, ⏯ | Play / pause |
| Player | Left / Right | Seek 10 s |
| Player | Down | Captions on / off |
| Player | Up | Show the controls |
| Player | ⏭ | Next item in the queue |

The rail holds **Home**, **Music**, **Search**, **Library** and **Settings**. Leaving a screen and
coming back rebuilds it, so history and recommendations are never stale.

## What is in it

| Area | Behaviour |
| --- | --- |
| Home | Continue watching (resume points), a "Recommended for you" row ranked by the on-device taste model, Movies, every category, and the channel shelf |
| Movies | Free-with-ads titles play, with no ads anywhere in the stream. Everything else shows *"Sorry, movies are connected to your Google Account. This movie will become available as soon as you purchase it."* — and nothing pretends otherwise |
| Music | Its own layout: album shelf by channel, track row, and **Play all**, which queues the category so a track ending moves to the next |
| Player | Custom TV chrome, 10-second seeks, caption overlay rendered from the catalogue's own transcript lines, resume from history, auto-advance, and progress written back every pause/exit |
| Search | Live YouTube search when a key is configured. When requests are *limited*, the viewer gets one plain sentence and the on-device catalogue's matches — API error text is never shown |
| Library | This TV's watch history per account, the account's subscriptions (read-only), liked videos, and a summary of what the recommender has learned |
| Settings | YouTube API key, content server, TV OAuth client, sign-in / sync / sign out, caption default, reset of what the recommender learned |
| No ads | Nothing in the app serves or proxies advertising. YouTube-hosted videos are the single exception: those play in YouTube's own player, which shows YouTube's ads |

## Google sign-in on a television

TVs have no comfortable browser, and Google blocks OAuth inside a WebView, so the app uses Google's
**device ("limited input") flow**:

1. Settings → *Not connected* → the app asks Google for a code.
2. The screen shows a short code and `google.com/device`.
3. You finish on a phone or laptop. The app polls and signs itself in.

That flow needs a **TVs and Limited Input devices** OAuth client:

1. Google Cloud Console → *APIs & Services* → *Credentials* → *Create credentials* → *OAuth client ID*
   → *TVs and Limited Input devices*.
2. Enable **YouTube Data API v3** for the same project.
3. Either paste the client ID and secret into Settings on the TV, or bake them into the APK by
   setting the repository secrets `OPENTUBE_TV_CLIENT_ID` / `OPENTUBE_TV_CLIENT_SECRET` (the
   workflow passes them to Gradle; `OPENTUBE_YOUTUBE_API_KEY` bakes in a key too).

Nothing is stored anywhere but the TV: the refresh token lives in `SharedPreferences` and can be
removed with *Sign out*.

## Honest limits

- **Watch history is this app's own.** Google retired API access to a viewer's YouTube watch
  history in 2016, and no Android API exposes another app's history. So "history" here means what
  *this TV* played, kept per account, with resume points. Signing in does not import years of
  YouTube history; importing a Google Takeout export is supported on the website instead.
- **Subscriptions sync in one direction.** Rows come from your account and refresh on demand;
  subscribing or unsubscribing happens in the YouTube app, and the new channel appears here after
  a sync. There are no subscribe buttons in the TV app on purpose.
- **No like/dislike buttons.** They were removed everywhere in the TV UI.
- **YouTube playback carries YouTube's ads.** For YouTube-hosted videos the app embeds YouTube's
  player; ads live inside that surface and cannot be stripped. OpenTube's own catalogue has none.
- **Debug-signed build.** Fine for sideloading, not for distribution.

## Building it

CI is the supported path (it has an Android SDK):

```
Actions → OpenTube TV → Run workflow
```

Locally, with an Android SDK and JDK 17:

```
cd sites/youtube/tv
echo "sdk.dir=$ANDROID_SDK_ROOT" > local.properties
gradle :app:assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
```

Optionally bake credentials in:

```
gradle :app:assembleDebug -PopentubeClientId=… -PopentubeClientSecret=… -PopentubeApiKey=…
```

## Layout

```
tv/
  app/src/main/
    java/dev/opentube/tv/
      App.java            singletons: catalogue, prefs, taste, history, account
      MainActivity.java   shell: nav rail + screens
      HomeScreen.java     continue watching, recommendations, movies, shelves
      MusicScreen.java    album shelf, tracks, play all
      SearchScreen.java   live + catalogue search, quota-safe messaging
      LibraryScreen.java  history, subscriptions, liked, learned taste
      SettingsScreen.java key, OAuth client, sign-in/sync, captions, reset
      DetailActivity.java video / movie / channel details
      PlayerActivity.java the TV player: D-pad keys, captions, queue, resume
      WebPlayerActivity.java YouTube IFrame playback for live results
      ChannelActivity.java a channel's videos
      Account.java        device-code OAuth, profile, subscriptions, liked
      Api.java            YouTube Data API calls with translated errors
      Taste.java          the on-device recommender
      History.java        per-account watch history and resume points
      Catalog.java        the bundled catalogue (built from the website's data)
      Net.java, Ui.java, Prefs.java
    assets/               catalog.json, movies.json (generated)
    res/                  launcher icons, TV banner, dark theme
  art/                    logo source art
  tools/build-catalog.mjs regenerates the assets from sites/youtube/assets/data.js
```

Regenerate the catalogue after the website's content changes:

```
node sites/youtube/tv/tools/build-catalog.mjs
```

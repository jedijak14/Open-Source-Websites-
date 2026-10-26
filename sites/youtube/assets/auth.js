/**
 * Google account connection for OpenTube.
 *
 * Uses Google Identity Services' token flow, which is the only browser-only
 * sign-in that works from a static host (no server, no client secret):
 * the user's browser receives a short-lived OAuth access token and calls the
 * YouTube Data API directly with it.
 *
 * Scope: https://www.googleapis.com/auth/youtube.readonly — read-only access to
 * the signed-in account's channel, subscriptions, liked videos and playlists.
 *
 * What the API can and cannot give us, honestly:
 *   channel, subscriptions, liked videos, playlists  → yes
 *   watch history                                    → NO. Google does not
 *     expose watch history through the YouTube Data API at all. The only route
 *     is a Google Takeout export, which `importTakeout()` parses below.
 */
(function (global) {
  'use strict';

  const CLIENT_ID_KEY = 'opentube:google-client-id';
  const TOKEN_KEY = 'opentube:google-token';
  const HISTORY_KEY = 'opentube:takeout-history';
  const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
  const GIS_SRC = 'https://accounts.google.com/gsi/client';

  const state = {
    token: null,
    expiresAt: 0,
    profile: null,
    loading: false,
    error: null,
  };

  const listeners = new Set();

  /* ------------------------------------------------------------ helpers */

  const ls = () => safeStorage('localStorage');
  const ss = () => safeStorage('sessionStorage');

  function safeStorage(kind) {
    try {
      const store = global[kind];
      // touching the item proves access is allowed (Safari private mode etc.)
      store.setItem('__probe__', '1');
      store.removeItem('__probe__');
      return store;
    } catch (err) {
      return null;
    }
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        /* a listener must never break sign-in */
      }
    });
  }

  /** Config baked into the deployment (assets/config.js), if any. */
  function deploymentConfig() {
    return global.OPENTUBE_CONFIG || {};
  }

  /**
   * Resolution order: a client ID typed into Settings wins (it is the most
   * specific choice), then the one shipped by the deployment. That way a hosted
   * build can offer one-click sign-in with no setup in the browser.
   */
  function getClientId() {
    const store = ls();
    try {
      const stored = store && store.getItem(CLIENT_ID_KEY);
      if (stored) return stored;
    } catch (err) {
      /* storage blocked — fall through to the deployment value */
    }
    return String(deploymentConfig().googleClientId || '').trim();
  }

  /** 'local' | 'deployment' | 'none' — where the current client ID came from. */
  function clientSource() {
    const store = ls();
    try {
      if (store && store.getItem(CLIENT_ID_KEY)) return 'local';
    } catch (err) {
      /* ignore */
    }
    return deploymentConfig().googleClientId ? 'deployment' : 'none';
  }

  /** True when sign-in can run immediately, with nothing to configure. */
  function isConfigured() {
    return !!getClientId();
  }

  function setClientId(id) {
    const store = ls();
    if (!store) return false;
    try {
      if (id) store.setItem(CLIENT_ID_KEY, String(id).trim());
      else store.removeItem(CLIENT_ID_KEY);
      return true;
    } catch (err) {
      return false;
    }
  }

  function restoreToken() {
    const store = ss();
    if (!store) return false;
    try {
      const saved = JSON.parse(store.getItem(TOKEN_KEY) || 'null');
      if (saved && saved.token && saved.expiresAt > Date.now() + 30000) {
        state.token = saved.token;
        state.expiresAt = saved.expiresAt;
        if (global.OTYouTube) global.OTYouTube.setAccessToken(saved.token);
        return true;
      }
      store.removeItem(TOKEN_KEY);
    } catch (err) {
      /* ignore malformed cache */
    }
    return false;
  }

  function persistToken(token) {
    const store = ss();
    state.token = token;
    // Google access tokens last about an hour; treat 55 minutes as the limit
    state.expiresAt = Date.now() + 55 * 60 * 1000;
    if (global.OTYouTube) global.OTYouTube.setAccessToken(token);
    if (!store) return;
    try {
      store.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: state.expiresAt }));
    } catch (err) {
      /* token still usable in memory */
    }
  }

  function forgetToken() {
    state.token = null;
    state.expiresAt = 0;
    state.profile = null;
    if (global.OTYouTube) global.OTYouTube.setAccessToken('');
    const store = ss();
    try {
      store && store.removeItem(TOKEN_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function isSignedIn() {
    return !!(state.token && state.expiresAt > Date.now());
  }

  /* --------------------------------------------------------------- GIS */

  function loadGis() {
    if (global.google && global.google.accounts && global.google.accounts.oauth2) {
      return Promise.resolve(global.google.accounts.oauth2);
    }
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-gis]');
      const done = () => {
        if (global.google && global.google.accounts && global.google.accounts.oauth2) {
          resolve(global.google.accounts.oauth2);
        } else {
          reject(new Error('Google Identity Services loaded but is unavailable.'));
        }
      };
      if (existing) {
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => reject(new Error('Could not load Google Identity Services.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.gis = 'true';
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', () => reject(new Error(
        'Could not load Google Identity Services. Check your connection or an extension blocking accounts.google.com.'
      )), { once: true });
      document.head.appendChild(script);
    });
  }

  let warming = false;

  /**
   * Starts loading Google Identity Services ahead of the click that needs it, so
   * the consent window opens inside the user gesture instead of after an await.
   * Call it from pointer/focus intent — never on page load, because until
   * someone shows intent this page talks to no third-party origin at all.
   */
  function warm() {
    if (warming || isSignedIn() || !isConfigured()) return;
    warming = true;
    loadGis().catch(() => {
      warming = false;
    });
  }

  async function signIn() {
    const clientId = getClientId();
    if (!clientId) {
      const err = new Error(
        'Google sign-in is not configured for this build. Set OPENTUBE_GOOGLE_CLIENT_ID on the ' +
        'deployment, or paste an OAuth client ID under “Google account”.'
      );
      err.reason = 'missingClientId';
      throw err;
    }
    state.error = null;
    state.loading = true;
    emit();

    try {
      const oauth2 = await loadGis();
      const token = await new Promise((resolve, reject) => {
        let settled = false;
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          prompt: '',
          callback: (response) => {
            if (settled) return;
            settled = true;
            if (response && response.access_token) resolve(response.access_token);
            else reject(new Error(response && response.error_description
              ? response.error_description
              : 'Google did not return an access token.'));
          },
          error_callback: (response) => {
            if (settled) return;
            settled = true;
            const type = (response && response.type) || 'unknown';
            const messages = {
              popup_closed: 'Sign-in window closed before finishing.',
              popup_failed_to_open: 'The sign-in window was blocked. Allow pop-ups for this site.',
              access_denied: 'Access was denied. Sign in again to grant read-only YouTube access.',
            };
            reject(new Error(messages[type] || 'Sign-in failed (' + type + ').'));
          },
        });
        try {
          client.requestAccessToken({ prompt: '' });
        } catch (err) {
          settled = true;
          reject(new Error(
            'This origin is not authorised for that client ID. Add ' + location.origin +
            ' under “Authorised JavaScript origins” in Google Cloud Console.'
          ));
        }
      });

      persistToken(token);
      state.loading = false;
      emit();
      await refreshProfile();
      return state.profile;
    } catch (err) {
      state.loading = false;
      state.error = err.message;
      forgetToken();
      emit();
      throw err;
    }
  }

  function signOut() {
    if (global.OTRec) global.OTRec.useAccount(null);
    const token = state.token;
    forgetToken();
    emit();
    try {
      const oauth2 = global.google && global.google.accounts && global.google.accounts.oauth2;
      if (oauth2 && token) oauth2.revoke(token, () => {});
    } catch (err) {
      /* revocation is best effort */
    }
  }

  /* ----------------------------------------------------------- profile */

  async function refreshProfile() {
    const api = global.OTYouTube;
    if (!api || !isSignedIn()) return null;
    state.loading = true;
    emit();
    try {
      const profile = await api.myAccount();
      state.profile = profile;
      state.error = null;

      // The algorithm follows the account: its own profile bucket, seeded with
      // whatever this browser learned before signing in, then the account's
      // subscriptions and liked videos are folded in.
      const rec = global.OTRec;
      if (rec) {
        const key = (profile && profile.channel && profile.channel.channelId) || 'signed-in';
        rec.useAccount(key, { seedFromAnonymous: true });
        rec.mergeAccount(profile);
      }
      return profile;
    } catch (err) {
      state.error = err.message;
      if (err.status === 401) forgetToken();
      throw err;
    } finally {
      state.loading = false;
      emit();
    }
  }

  /* --------------------------------------------------- takeout history */

  /**
   * Parses a Google Takeout YouTube watch history export.
   * Accepts the JSON export (`watch-history.json`) and the HTML one
   * (`watch-history.html`). Entries that are actually ads are dropped.
   */
  function parseTakeout(raw, kind) {
    const text = String(raw || '');
    const entries = [];
    const pushed = new Set();

    const addEntry = (url, title, time, channel) => {
      const idMatch = /[?&]v=([\w-]{6,})/.exec(url || '');
      if (!idMatch) return;
      const videoId = idMatch[1];
      // Takeout is newest-first, so the first entry seen for a video is its most
      // recent watch; later repeats of the same video are dropped.
      if (pushed.has(videoId)) return;
      pushed.add(videoId);
      entries.push({
        videoId,
        title: clean(title),
        channel: clean(channel),
        time: time || '',
        url: 'https://www.youtube.com/watch?v=' + videoId,
      });
    };

    const clean = (value) => String(value || '')
      .replace(/^Watched\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const isAd = (item) => {
      const details = (item && item.details) || [];
      const products = (item && item.products) || [];
      return details.some((d) => /google ads/i.test(d.name || '')) ||
        products.some((p) => /google ads/i.test(p));
    };

    const looksJson = (kind === 'json') || /^\s*[\[{]/.test(text);
    if (looksJson) {
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error('That file is not valid JSON — pick watch-history.json from the Takeout archive.');
      }
      const items = Array.isArray(parsed) ? parsed : (parsed && parsed.items) || [];
      items.forEach((item) => {
        if (!item || isAd(item)) return;
        const channel = (item.subtitles && item.subtitles[0] && item.subtitles[0].name) || '';
        addEntry(item.titleUrl || '', item.title, item.time || '', channel);
      });
    } else {
      // HTML export: <a href="...watch?v=ID">Title</a> followed by a date
      const doc = new global.DOMParser().parseFromString(text, 'text/html');
      const links = Array.from(doc.querySelectorAll('a[href*="watch?v="]'));
      links.forEach((link) => {
        const cell = link.closest('div.content-cell') || link.parentElement;
        const time = cell ? (cell.textContent.match(/\d{4}-\d{2}-\d{2}[^)]*/) || [''])[0] : '';
        addEntry(link.getAttribute('href'), link.textContent, time.trim(), '');
      });
    }

    return entries;
  }

  function saveHistory(entries) {
    const store = ls();
    if (!store) return false;
    try {
      store.setItem(HISTORY_KEY, JSON.stringify({
        importedAt: new Date().toISOString(),
        entries: entries.slice(0, 2000),
      }));
      return true;
    } catch (err) {
      return false;
    }
  }

  function getHistory() {
    const store = ls();
    try {
      const saved = JSON.parse((store && store.getItem(HISTORY_KEY)) || 'null');
      return saved && Array.isArray(saved.entries) ? saved : { importedAt: null, entries: [] };
    } catch (err) {
      return { importedAt: null, entries: [] };
    }
  }

  function clearHistory() {
    try {
      ls()?.removeItem(HISTORY_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  async function importTakeout(file) {
    if (!file) throw new Error('Choose a file first.');
    if (file.size > 40 * 1024 * 1024) {
      throw new Error('That file is larger than 40 MB. Import the JSON export instead of the HTML one.');
    }
    const text = await file.text();
    const kind = /\.json$/i.test(file.name) ? 'json' : (/\.html?$/i.test(file.name) ? 'html' : 'auto');
    const entries = parseTakeout(text, kind);
    if (!entries.length) {
      throw new Error('No watched videos found in that file. Use watch-history.json or watch-history.html from a YouTube Takeout export.');
    }
    saveHistory(entries);
    if (global.OTRec) {
      global.OTRec.mergeTakeout(
        entries,
        (global.OT && global.OT.videos) || [],
        (global.OT && global.OT.channels) || {}
      );
    }
    emit();
    return { entries: entries.length, importedAt: new Date().toISOString() };
  }

  /* ------------------------------------------------------------- boot */

  let initialised = false;

  function init() {
    if (initialised) return;
    initialised = true;
    restoreToken();
    emit();
    if (isSignedIn()) {
      refreshProfile().catch(() => {});
    }
  }

  global.OTAuth = {
    SCOPE,
    init,
    signIn,
    signOut,
    isSignedIn,
    getClientId,
    setClientId,
    clientSource,
    isConfigured,
    warm,
    refreshProfile,
    get history() { return getHistory(); },
    importTakeout,
    parseTakeout,
    clearHistory,
    onChange,
    state,
    // exported for tests
    _internal: { persistToken, forgetToken, restoreToken, loadGis },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

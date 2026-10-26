/**
 * Settings page controller: API key, Google account, history import,
 * live-data preferences and the local data controls.
 *
 * All state lives in the browser. Nothing here talks to a server except Google's
 * own endpoints (and only when the user has supplied their own credentials).
 */
(function (global) {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const api = () => global.OTYouTube;
  const auth = () => global.OTAuth;

  const LIVE_KEY = 'opentube:live';

  function live() {
    try {
      return JSON.parse(global.localStorage.getItem(LIVE_KEY) || '{}');
    } catch (err) {
      return {};
    }
  }

  function setLive(patch) {
    const next = Object.assign({ enabled: false, region: 'US' }, live(), patch);
    try {
      global.localStorage.setItem(LIVE_KEY, JSON.stringify(next));
    } catch (err) {
      /* storage blocked */
    }
    return next;
  }

  function status(el, message, tone) {
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
    el.dataset.tone = tone || 'info';
  }

  function count(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  /* --------------------------------------------------------------- key */

  function initKey() {
    const input = byId('settings-key');
    const saveBtn = byId('settings-key-save');
    const clearBtn = byId('settings-key-clear');
    const out = byId('settings-key-status');
    if (!input) return;

    const stored = api() && api().getKey();
    if (stored) input.value = stored;

    saveBtn?.addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) {
        status(out, 'Paste a key first.', 'error');
        return;
      }
      api().setKey(key);
      status(out, 'Checking with a 1-unit request…', 'info');
      saveBtn.disabled = true;
      try {
        const result = await api().testConnection();
        setLive({ enabled: true });
        paintLive();
        status(out, 'Key works. Trending sample: “' + (result.sample || 'ok') + '”. Live data is on.', 'ok');
      } catch (err) {
        status(out, err.message || 'That key did not work.', 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });

    clearBtn?.addEventListener('click', () => {
      api().setKey('');
      input.value = '';
      setLive({ enabled: false });
      paintLive();
      status(out, 'Key removed. The offline demo dataset is active.', 'info');
    });
  }

  /* ----------------------------------------------------------- account */

  function paintAccount() {
    const signedIn = auth() && auth().isSignedIn();
    const profile = auth() && auth().state.profile;
    const channel = profile && profile.channel;

    byId('account-signed-out')?.toggleAttribute('hidden', signedIn);
    byId('account-signed-in')?.toggleAttribute('hidden', !signedIn);
    byId('account-refresh')?.toggleAttribute('hidden', !signedIn);
    byId('account-signin')?.toggleAttribute('hidden', signedIn);

    if (signedIn && channel) {
      const avatar = byId('account-avatar');
      avatar.src = channel.avatar || '';
      avatar.alt = channel.name + ' avatar';
      byId('account-name').textContent = channel.name;
      byId('account-meta').textContent =
        count(channel.subscribers) + ' subscribers · ' +
        profile.subscriptions.length + ' subscriptions · ' +
        profile.liked.length + ' liked videos';
    } else if (signedIn) {
      byId('account-meta').textContent = 'Signed in — loading account data…';
    }

    const toggle = byId('settings-live-toggle');
    if (toggle) {
      const ready = !!(api() && (api().hasKey() || (auth() && auth().isSignedIn())));
      toggle.disabled = !ready;
      toggle.setAttribute('aria-checked', String(!!live().enabled && ready));
    }
  }

  function initAccount() {
    const idInput = byId('settings-client-id');
    if (!idInput) return;
    if (auth()) idInput.value = auth().getClientId();
    const originEl = byId('client-origin');
    if (originEl) originEl.textContent = location.origin;

    const out = byId('settings-account-status');

    byId('settings-client-save')?.addEventListener('click', () => {
      const id = idInput.value.trim();
      if (auth().setClientId(id)) {
        status(out, id ? 'Client ID saved.' : 'Client ID cleared.', id ? 'ok' : 'info');
      } else {
        status(out, 'Could not save — browser storage is blocked.', 'error');
      }
    });

    byId('account-signin')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      status(out, 'Opening Google sign-in…', 'info');
      try {
        await auth().signIn();
        status(out, 'Connected. Subscriptions and liked videos are now in your library.', 'ok');
        paintAccount();
      } catch (err) {
        status(out, err.message || 'Sign-in failed.', 'error');
      } finally {
        btn.disabled = false;
        paintAccount();
      }
    });

    byId('account-signout')?.addEventListener('click', () => {
      auth().signOut();
      status(out, 'Signed out; the access token was revoked and cleared.', 'info');
      paintAccount();
    });

    byId('account-refresh')?.addEventListener('click', async () => {
      status(out, 'Refreshing account data…', 'info');
      try {
        await auth().refreshProfile();
        status(out, 'Account data refreshed.', 'ok');
      } catch (err) {
        status(out, err.message || 'Could not refresh.', 'error');
      }
      paintAccount();
    });

    auth().onChange(paintAccount);
    paintAccount();
  }

  /* ----------------------------------------------------------- history */

  function paintHistory() {
    const summary = byId('settings-history-summary');
    const clearBtn = byId('settings-history-clear');
    const imported = auth() && auth().history;
    const count = imported && imported.entries ? imported.entries.length : 0;
    if (clearBtn) clearBtn.hidden = !count;
    if (!summary) return;
    summary.textContent = count
      ? count.toLocaleString() + ' watched videos imported on ' +
        new Date(imported.importedAt).toLocaleDateString() +
        '. They appear in Library → History.'
      : 'Nothing imported yet.';
  }

  function initHistory() {
    const file = byId('settings-history-file');
    const out = byId('settings-history-status');
    if (!file) return;

    file.addEventListener('change', async () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      status(out, 'Reading ' + chosen.name + '…', 'info');
      try {
        const result = await auth().importTakeout(chosen);
        status(out, 'Imported ' + result.entries.toLocaleString() + ' watched videos.', 'ok');
        paintHistory();
      } catch (err) {
        status(out, err.message || 'That file could not be imported.', 'error');
      } finally {
        file.value = '';
      }
    });

    byId('settings-history-clear')?.addEventListener('click', () => {
      auth().clearHistory();
      status(out, 'Imported history removed.', 'info');
      paintHistory();
    });

    paintHistory();
  }

  /* -------------------------------------------------------------- live */

  function paintLive() {
    const toggle = byId('settings-live-toggle');
    const region = byId('settings-region');
    const themeBtn = byId('settings-theme');
    const state = live();

    if (toggle) {
      const ready = !!(api() && (api().hasKey() || (auth() && auth().isSignedIn())));
      toggle.disabled = !ready;
      toggle.setAttribute('aria-checked', String(!!state.enabled && ready));
    }
    if (region) region.value = state.region || 'US';
    if (themeBtn) {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      themeBtn.textContent = theme === 'dark' ? 'Dark' : 'Light';
    }
  }

  function initLive() {
    byId('settings-live-toggle')?.addEventListener('click', (e) => {
      const next = e.currentTarget.getAttribute('aria-checked') !== 'true';
      setLive({ enabled: next });
      paintLive();
      paintAccount();
    });

    byId('settings-region')?.addEventListener('change', (e) => {
      setLive({ region: e.currentTarget.value });
    });

    byId('settings-theme')?.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      global.OT.Store.set('theme', next);
      document.documentElement.dataset.theme = next;
      paintLive();
    });

    paintLive();
  }

  /* --------------------------------------------------------------- ads */

  function initAdsAudit() {
    const el = byId('ads-audit');
    if (!el) return;
    // Proves the claim rather than asserting it: list every third-party origin
    // the page has actually contacted.
    const origins = new Set();
    try {
      performance.getEntriesByType('resource').forEach((entry) => {
        try {
          const url = new URL(entry.name);
          if (url.origin !== location.origin) origins.add(url.origin);
        } catch (err) {
          /* ignore malformed entries */
        }
      });
    } catch (err) {
      /* Performance API unavailable */
    }
    const list = Array.from(origins).sort();
    el.textContent = list.length
      ? 'Network audit for this page load — third-party origins contacted: ' + list.join(', ') + '.'
      : 'Network audit for this page load — no third-party origins were contacted.';
  }

  /* -------------------------------------------------------------- data */

  function initData() {
    const out = byId('settings-data-status');

    byId('settings-clear-keys')?.addEventListener('click', () => {
      api().setKey('');
      auth().setClientId('');
      auth().signOut();
      const keyInput = byId('settings-key');
      const idInput = byId('settings-client-id');
      if (keyInput) keyInput.value = '';
      if (idInput) idInput.value = '';
      setLive({ enabled: false });
      paintLive();
      paintAccount();
      status(out, 'API key and client ID removed.', 'info');
    });

    byId('settings-clear-all')?.addEventListener('click', () => {
      try {
        global.localStorage.removeItem('opentube:v1');
        global.localStorage.removeItem('opentube:youtube-key');
        global.localStorage.removeItem('opentube:google-client-id');
        global.localStorage.removeItem('opentube:takeout-history');
        global.localStorage.removeItem(LIVE_KEY);
        global.sessionStorage.removeItem('opentube:google-token');
        global.sessionStorage.removeItem('opentube:youtube-cache');
      } catch (err) {
        /* storage blocked */
      }
      auth().signOut();
      status(out, 'Local OpenTube data cleared. Reloading…', 'ok');
      setTimeout(() => location.reload(), 700);
    });
  }

  function boot() {
    if (!api() || !auth()) return;
    auth().init();
    initKey();
    initAccount();
    initHistory();
    initLive();
    initData();
    // the audit needs the page's own resource timings, so read them after load
    setTimeout(initAdsAudit, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.OTSettings = { boot, paintAccount, paintHistory };
})(typeof globalThis !== 'undefined' ? globalThis : this);

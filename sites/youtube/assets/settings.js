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

  /** Page banner at the top of the viewport — visible without scrolling. */
  function banner(message, options) {
    if (global.OT && global.OT.notify) return global.OT.notify(message, options);
    return null;
  }

  function status(el, message, tone) {
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
    el.dataset.tone = tone || 'info';
  }

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
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
        banner('API key saved — live YouTube data is on. Sample: “' + (result.sample || 'ok') + '”.', {
          tone: 'ok',
          action: { href: 'index.html', label: 'Open the feed' },
        });
      } catch (err) {
        status(out, err.message || 'That key did not work.', 'error');
        banner(err.message || 'That API key did not work.', { tone: 'error' });
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
      banner('API key removed — back to the offline demo dataset.');
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
      if (channel.avatar) {
        avatar.hidden = false;
        avatar.src = channel.avatar;
        avatar.alt = channel.name + ' avatar';
        avatar.onerror = () => {
          avatar.hidden = true;
          const fallback = byId('account-initial');
          if (fallback) {
            fallback.hidden = false;
            fallback.textContent = String(channel.name || '?').charAt(0).toUpperCase();
          }
        };
      } else {
        avatar.hidden = true;
        const fallback = byId('account-initial');
        if (fallback) {
          fallback.hidden = false;
          fallback.textContent = String(channel.name || '?').charAt(0).toUpperCase();
        }
      }
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

    const hint = byId('account-hint');
    if (hint) {
      hint.textContent = auth().clientSource() === 'deployment'
        ? 'Sign-in is preconfigured — press “Sign in with Google”.'
        : (auth().isConfigured()
          ? 'Sign in to load your subscriptions and liked videos.'
          : 'Add an OAuth client ID below, then sign in.');
    }
  }

  function initAccount() {
    const idInput = byId('settings-client-id');
    if (!idInput) return;

    // A deployment can ship the client ID (assets/config.js), in which case the
    // paste-it-yourself panel is pointless noise — hide it, keep sign-in visible.
    const fromDeployment = auth().clientSource() === 'deployment';
    const manual = byId('client-manual');
    if (manual) manual.hidden = fromDeployment;
    byId('account-deployment')?.toggleAttribute('hidden', !fromDeployment);
    if (auth()) idInput.value = fromDeployment ? '' : auth().getClientId();
    const originEl = byId('client-origin');
    if (originEl) originEl.textContent = location.origin;

    const out = byId('settings-account-status');

    byId('settings-client-save')?.addEventListener('click', () => {
      const id = idInput.value.trim();
      if (auth().setClientId(id)) {
        status(out, id ? 'Client ID saved.' : 'Client ID cleared.', id ? 'ok' : 'info');
        banner(id ? 'Google client ID saved — sign-in is ready.' : 'Google client ID cleared.', {
          tone: id ? 'ok' : 'info',
        });
        paintAccount();
      } else {
        status(out, 'Could not save — browser storage is blocked.', 'error');
      }
    });

    // Show intent (hover/focus) → start loading Google's script, so the popup
    // opens from the click itself. Nothing loads before that.
    const signInBtn = byId('account-signin');
    if (signInBtn) {
      ['pointerenter', 'focusin'].forEach((evt) =>
        signInBtn.addEventListener(evt, () => auth().warm(), { once: true }));
    }

    byId('account-signin')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      status(out, 'Opening Google sign-in…', 'info');
      try {
        await auth().signIn();
        const name = auth().state.profile && auth().state.profile.channel
          ? auth().state.profile.channel.name
          : 'your channel';
        status(out, 'Connected. Subscriptions and liked videos are now in your library.', 'ok');
        paintAccount();
        paintAlgorithm();
        banner('Signed in as ' + name + '. Your subscriptions, liked videos and playlists are in Library.', {
          tone: 'ok',
          action: { href: 'library.html?tab=subs', label: 'Open Library' },
        });
      } catch (err) {
        status(out, err.message || 'Sign-in failed.', 'error');
        banner(err.message || 'Google sign-in failed.', { tone: 'error' });
      } finally {
        btn.disabled = false;
        paintAccount();
      }
    });

    byId('account-signout')?.addEventListener('click', () => {
      auth().signOut();
      status(out, 'Signed out; the access token was revoked and cleared.', 'info');
      paintAccount();
      banner('Signed out of Google — the access token was revoked.');
    });

    byId('account-refresh')?.addEventListener('click', async () => {
      status(out, 'Refreshing account data…', 'info');
      try {
        await auth().refreshProfile();
        const profile = auth().state.profile;
        const problems = profile && profile.errors
          ? Object.keys(profile.errors).filter((key) => profile.errors[key])
          : [];
        if (problems.length) {
          status(out, 'Refreshed, but ' + problems.join(' and ') + ' could not load: ' +
            profile.errors[problems[0]], 'error');
          banner('Account connected, but ' + problems.join(' and ') + ' did not load. ' +
            'Sign out and back in to re-grant read-only access.', { tone: 'error' });
        } else {
          status(out, 'Account data refreshed.', 'ok');
          banner('Account data refreshed.', { tone: 'ok' });
        }
        paintAlgorithm();
      } catch (err) {
        status(out, err.message || 'Could not refresh.', 'error');
        banner(err.message || 'Could not refresh account data.', { tone: 'error' });
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
        banner('Imported ' + result.entries.toLocaleString() + ' watched videos from Takeout.', {
          tone: 'ok',
          action: { href: 'library.html?tab=history', label: 'Open History' },
        });
      } catch (err) {
        status(out, err.message || 'That file could not be imported.', 'error');
        banner(err.message || 'That file could not be imported.', { tone: 'error' });
      } finally {
        file.value = '';
      }
    });

    byId('settings-history-clear')?.addEventListener('click', () => {
      auth().clearHistory();
      status(out, 'Imported history removed.', 'info');
      paintHistory();
      banner('Imported watch history removed from this browser.');
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
      banner(next
        ? 'Live YouTube data is on — the feed now uses the real API.'
        : 'Live YouTube data is off — showing the offline demo dataset.', {
        tone: next ? 'ok' : 'info',
        action: next ? { href: 'index.html', label: 'Open the feed' } : null,
      });
    });

    byId('settings-region')?.addEventListener('change', (e) => {
      setLive({ region: e.currentTarget.value });
      banner('Trending region set to ' + e.currentTarget.value + '.');
    });

    byId('settings-theme')?.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      global.OT.Store.set('theme', next);
      document.documentElement.dataset.theme = next;
      paintLive();
    });

    paintLive();
  }

  /* ------------------------------------------------------- algorithm */

  function rec() {
    return global.OTRec || null;
  }

  function paintAlgorithm() {
    const summary = byId('rec-summary');
    const lists = byId('rec-lists');
    const model = rec();
    if (!summary || !lists || !model) return;

    const data = model.top(5);
    const signedIn = auth() && auth().isSignedIn();
    const channel = signedIn && auth().state.profile && auth().state.profile.channel;

    if (!model.hasSignals()) {
      summary.innerHTML = '<strong>Nothing learned yet.</strong> Watch a video, like or save ' +
        'something, import your history, or sign in with Google — the feed switches from ' +
        'newest-first to “For you” as soon as it has something to go on.';
      lists.innerHTML = '';
      return;
    }

    const scopeLabel = signedIn && channel
      ? 'Follows the account <strong>' + esc(channel.name) + '</strong>'
      : 'Follows this browser (signed out)';

    summary.innerHTML =
      '<div class="rec-stats">' +
        '<span><strong>' + data.watched.toLocaleString() + '</strong> videos in the model</span>' +
        '<span><strong>' + Object.keys(model.get().channels).length + '</strong> channels</span>' +
        '<span>' + scopeLabel + '</span>' +
      '</div>' +
      '<div class="rec-sources">Signals — watched: ' + (data.sources.watch || 0) +
        ' · history import: ' + (data.sources.takeout || 0) +
        ' · account: ' + (data.sources.account || 0) +
        (data.updated ? ' · updated ' + new Date(data.updated).toLocaleString() : '') +
      '</div>';

    const column = (title, entries, empty) =>
      '<div class="rec-column"><h3>' + title + '</h3>' +
        (entries.length
          ? entries.map((entry) =>
              '<div class="rec-row"><span class="rec-row__key">' + esc(entry.key) + '</span>' +
                '<span class="rec-row__bar"><span style="width:' + Math.max(6, Math.round(entry.weight * 26)) + 'px"></span></span>' +
                '<span class="rec-row__n">' + entry.count + '</span></div>').join('')
          : '<p class="rec-empty">' + empty + '</p>') +
      '</div>';

    lists.innerHTML =
      column('Channels it thinks you like', data.channels, 'None yet.') +
      column('Categories', data.categories, 'None yet.') +
      column('Topics', data.tags, 'None yet.');
  }

  function initAlgorithm() {
    const model = rec();
    if (!model) return;

    byId('rec-reset')?.addEventListener('click', () => {
      model.reset();
      paintAlgorithm();
      banner('Recommendation history cleared — the feed is back to newest first.');
    });

    byId('rec-sync')?.addEventListener('click', async (e) => {
      const out = byId('settings-rec-status');
      const btn = e.currentTarget;
      if (!auth() || !auth().isSignedIn()) {
        status(out, 'Sign in with Google first — then the model can follow that account.', 'error');
        banner('Sign in with Google first, then press Sync.', { tone: 'error' });
        return;
      }
      btn.disabled = true;
      status(out, 'Reading your subscriptions and liked videos…', 'info');
      try {
        await auth().refreshProfile();
        paintAlgorithm();
        const profile = auth().state.profile;
        const subs = (profile && profile.subscriptions) || [];
        status(out, 'Synced ' + subs.length + ' subscriptions and ' +
          ((profile && profile.liked) || []).length + ' liked videos into the model.', 'ok');
        banner('Algorithm synced with your YouTube account — ' + subs.length + ' subscriptions folded in.', {
          tone: 'ok', action: { href: 'index.html', label: 'See the feed' },
        });
      } catch (err) {
        status(out, err.message || 'Could not sync.', 'error');
        banner(err.message || 'Could not sync with your account.', { tone: 'error' });
      } finally {
        btn.disabled = false;
      }
    });

    // Repaint whenever the model learns something while settings is open.
    model.onChange(paintAlgorithm);
    paintAlgorithm();
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
      banner('API key and client ID removed from this browser.');
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
      banner('Local OpenTube data cleared.', { tone: 'ok' });
      setTimeout(() => location.reload(), 900);
    });
  }

  function boot() {
    if (!api() || !auth()) return;
    auth().init();
    initKey();
    initAccount();
    initHistory();
    initLive();
    initAlgorithm();
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

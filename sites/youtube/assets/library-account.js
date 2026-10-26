/**
 * Renders the parts of the Library that come from a connected Google account
 * (subscriptions, liked videos) or from an imported Takeout watch history.
 *
 * app.js calls `handles(tab)` first; when it returns true this module owns the
 * tab, otherwise the offline demo library renders as usual.
 */
(function (global) {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const auth = () => global.OTAuth;

  function count(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function ago(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const days = Math.round((Date.now() - then) / 86400000);
    if (days < 1) return 'today';
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    const months = Math.round(days / 30);
    if (months < 12) return months + (months === 1 ? ' month ago' : ' months ago');
    const years = Math.round(months / 12);
    return years + (years === 1 ? ' year ago' : ' years ago');
  }

  /** First letter of a channel name, for when there is no picture. */
  function initial(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  /**
   * YouTube avatar URLs 404 more often than you would think (deleted channels,
   * privacy-blocked thumbnails). Rather than leaving a broken image, swap in an
   * initial once the load fails.
   */
  function wireAvatars(root) {
    if (!root) return;
    Array.from(root.querySelectorAll('img[data-avatar]')).forEach((img) => {
      img.addEventListener('error', () => {
        const name = img.getAttribute('data-name') || '?';
        const span = document.createElement('span');
        span.className = 'avatar-fallback';
        span.textContent = initial(name);
        span.setAttribute('aria-hidden', 'true');
        img.replaceWith(span);
      }, { once: true });
    });
  }

  function signedIn() {
    return !!(auth() && auth().isSignedIn());
  }

  function profile() {
    return (auth() && auth().state.profile) || null;
  }

  function takeout() {
    return (auth() && auth().history) || { entries: [], importedAt: null };
  }

  function handles(tab) {
    if (tab === 'history') return takeout().entries.length > 0;
    if (tab === 'subs' || tab === 'liked') return signedIn();
    return false;
  }

  function signInPrompt(what) {
    // When the deployment ships a client ID there is nothing to configure —
    // offer the sign-in itself instead of a trip to Settings.
    const ready = !!(auth() && auth().isConfigured && auth().isConfigured());
    return '<div class="empty-state">' + icon('user') +
      '<h2>Connect your Google account</h2>' +
      '<p>Sign in to load your ' + esc(what) + ' from YouTube. Access is read-only and the ' +
      'token never leaves this browser.</p>' +
      (ready
        ? '<button class="btn-pill btn-pill--solid" type="button" id="library-signin">Sign in with Google</button>'
        : '<a class="btn-pill btn-pill--solid" href="settings.html#account">Set up sign-in</a>') +
      '</div>';
  }

  /** Wire the prompt's sign-in button, then repaint the tab it belongs to. */
  function wireSignIn(tab) {
    const btn = byId('library-signin');
    if (!btn || !auth()) return;
    ['pointerenter', 'focusin'].forEach((evt) =>
      btn.addEventListener(evt, () => auth().warm(), { once: true }));
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Opening Google…';
      auth().signIn()
        .then(() => {
          if (global.OT && global.OT.notify) {
            global.OT.notify('Signed in — loading your YouTube account.', { tone: 'ok' });
          }
          render(tab);
        })
        .catch((err) => {
          btn.disabled = false;
          btn.textContent = 'Sign in with Google';
          if (global.OT && global.OT.notify) {
            global.OT.notify(err.message || 'Sign-in failed.', { tone: 'error' });
          }
        });
    });
  }

  function videoCard(v) {
    return '<article class="card">' +
      '<a class="card__thumb" href="watch.html?v=' + esc(v.id) + '">' +
        '<img src="' + esc(v.poster) + '" alt="" loading="lazy">' +
        (v.durationLabel ? '<span class="card__duration">' + esc(v.durationLabel) + '</span>' : '') +
      '</a>' +
      '<div class="card__body"><div class="card__text">' +
        '<a class="card__title" href="watch.html?v=' + esc(v.id) + '">' + esc(v.title) + '</a>' +
        '<div class="card__meta">' + esc(v.channelName) + '</div>' +
        '<div class="card__meta">' + count(v.views) + ' views · ' + esc(v.publishedLabel || '') + '</div>' +
      '</div></div></article>';
  }

  /**
   * A failed section is shown, not swallowed: an empty list looks like "it does
   * not sync", which is exactly the wrong thing to tell someone.
   */
  function problemNote(message) {
    const text = String(message || '');
    let hint = 'The account request failed. Press Refresh account data to try again.';
    if (/insufficient|permission|scope|forbidden|403/i.test(text)) {
      hint = 'The token did not include read-only YouTube access. Sign out, sign in again and accept ' +
        'the youtube.readonly permission.';
    } else if (/quota/i.test(text)) {
      hint = 'The daily YouTube Data API quota for this key is used up. It resets at midnight Pacific.';
    } else if (/401|unauthor|expired/i.test(text)) {
      hint = 'The access token expired. Sign in again.';
    }
    return '<div class="panel__note panel__note--warn" role="alert" style="margin-bottom:16px">' +
      icon('flag', 'icon--xs') + '<span><strong>Subscriptions could not load.</strong> ' +
      esc(hint) + (text ? ' <span class="panel__note-raw">(' + esc(text.slice(0, 140)) + ')</span>' : '') +
      '</span></div>';
  }

  function channelRow(c) {
    const picture = c.avatar
      ? '<img src="' + esc(c.avatar) + '" alt="" width="56" height="56" loading="lazy" data-avatar data-name="' + esc(c.name) + '">'
      : '<span class="avatar-fallback" aria-hidden="true">' + esc(initial(c.name)) + '</span>';
    return '<div class="account-channel">' +
      '<a href="channel.html?c=' + esc(c.id) + '">' + picture + '</a>' +
      '<div class="account-channel__text">' +
        '<a class="account-channel__name" href="channel.html?c=' + esc(c.id) + '">' + esc(c.name) + '</a>' +
        '<div class="account-channel__meta">' + esc(c.about || '').slice(0, 120) + '</div>' +
      '</div>' +
      '<a class="btn-pill" href="channel.html?c=' + esc(c.id) + '">Open</a>' +
    '</div>';
  }

  function historyRow(entry, index) {
    return '<div class="history-row">' +
      '<span class="history-row__date">' + esc(ago(entry.time)) + '</span>' +
      '<div class="history-row__text">' +
        '<a class="history-row__title" href="' + esc(entry.url) + '" target="_blank" rel="noopener">' +
          esc(entry.title || 'Untitled video') + '</a>' +
        '<div class="history-row__meta">' + esc(entry.channel || 'YouTube') +
          ' · imported #' + (index + 1) + '</div>' +
      '</div>' +
      '<a class="icon-btn" href="https://www.youtube.com/watch?v=' + esc(entry.videoId) +
        '" target="_blank" rel="noopener" aria-label="Open on YouTube" title="Open on YouTube">' +
        icon('chevron-right', 'icon--sm') + '</a>' +
    '</div>';
  }

  function render(tab) {
    const host = byId('library-body');
    const titleEl = byId('library-title');
    if (!host) return;
    if (!signedIn() && (tab === 'subs' || tab === 'liked')) {
      host.innerHTML = signInPrompt(tab === 'subs' ? 'subscriptions' : 'liked videos');
      wireSignIn(tab);
      return;
    }

    if (tab === 'subs') {
      const data = profile();
      if (titleEl) titleEl.textContent = 'Subscriptions';
      if (!data) {
        host.innerHTML = '<div class="empty-state">' + icon('clock') +
          '<h2>Loading your subscriptions…</h2><p>The account request is still in flight.</p></div>';
        return;
      }
      const subs = data.subscriptions || [];
      const failure = data.errors && data.errors.subscriptions;
      host.innerHTML =
        (failure ? problemNote(failure) : '') +
        '<div class="panel__note" style="margin-bottom:16px">' + icon('user', 'icon--xs') +
          ' ' + subs.length + (subs.length === 200 ? '+' : '') + ' subscriptions from <strong>' +
          esc(data.channel ? data.channel.name : 'your account') + '</strong> · read-only access</div>' +
        (subs.length
          ? '<div class="account-channel-list">' + subs.map(channelRow).join('') + '</div>'
          : signInPrompt('subscriptions'));
      wireAvatars(host);
      return;
    }

    if (tab === 'liked') {
      const data = profile();
      if (titleEl) titleEl.textContent = 'Liked videos';
      if (!data) {
        host.innerHTML = '<div class="empty-state">' + icon('clock') +
          '<h2>Loading your liked videos…</h2></div>';
        return;
      }
      const liked = data.liked || [];
      const failure = data.errors && data.errors.liked;
      host.innerHTML = (failure ? problemNote(failure) : '') +
        '<div class="video-grid">' +
        (liked.length
          ? liked.map(videoCard).join('')
          : '<div class="empty-state"><h2>No liked videos</h2><p>Nothing returned for this account.</p></div>') +
        '</div>';
      wireAvatars(host);
      return;
    }

    // history: imported Takeout entries
    const data = takeout();
    if (titleEl) titleEl.textContent = 'Watch history';
    if (!data.entries.length) {
      host.innerHTML = '<div class="empty-state">' + icon('history') +
        '<h2>No watch history imported</h2>' +
        '<p>Google does not expose watch history through its API. Export it with Google Takeout ' +
        'and import the file — takes about a minute.</p>' +
        '<a class="btn-pill btn-pill--solid" href="settings.html#history">Import watch history</a></div>';
      return;
    }
    const shown = data.entries.slice(0, 300);
    host.innerHTML =
      '<div class="panel__note" style="margin-bottom:16px">' + icon('history', 'icon--xs') +
        ' ' + data.entries.length.toLocaleString() + ' videos imported from Google Takeout on ' +
        new Date(data.importedAt).toLocaleDateString() +
        (data.entries.length > shown.length ? ' · showing the most recent ' + shown.length : '') +
        ' · <a href="settings.html#history">manage</a></div>' +
      shown.map(historyRow).join('');
  }

  global.OTLibraryAccount = { handles, render, signedIn };
})(typeof globalThis !== 'undefined' ? globalThis : this);

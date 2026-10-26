/**
 * Live YouTube mode for OpenTube.
 *
 * When enabled (and an API key is stored), the home feed, search results,
 * channel pages and the watch page are rendered from the real YouTube Data
 * API instead of the fictional dataset in assets/data.js. Playback switches to
 * the official embedded player, because YouTube's terms only allow playback
 * through their player — there is no media file to hand to <video>.
 *
 * With live mode off, nothing here runs and the site behaves exactly like the
 * offline demo. Every failure path falls back to a readable message rather
 * than an empty page.
 */
(function (global) {
  'use strict';

  const FLAG_STORAGE = 'opentube:live';
  const YT = () => global.OTYouTube;

  const state = {
    enabled: false,
    region: 'US',
    busy: false,
  };

  /* ------------------------------------------------------------ helpers */

  function count(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K';
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

  const byId = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const params = () => new URLSearchParams(location.search);

  /** Page banner (falls back to a toast when app.js has not loaded yet). */
  function notify(message, options) {
    if (global.OT && global.OT.notify) return global.OT.notify(message, options);
    return toast(message);
  }

  function toast(message, action) {
    if (global.OT && global.OT.toast) return global.OT.toast(message, action);
    const stack = byId('toasts');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + esc(message) + '</span>' +
      (action ? ' <a href="' + action.href + '">' + esc(action.label) + '</a>' : '');
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  /* ------------------------------------------------------------- config */

  function loadFlags() {
    try {
      const saved = JSON.parse(global.localStorage.getItem(FLAG_STORAGE) || '{}');
      state.enabled = !!saved.enabled;
      state.region = saved.region || 'US';
    } catch (err) {
      state.enabled = false;
      state.region = 'US';
    }
    return state;
  }

  function saveFlags() {
    try {
      global.localStorage.setItem(FLAG_STORAGE, JSON.stringify({
        enabled: state.enabled,
        region: state.region,
      }));
    } catch (err) {
      /* storage blocked: live mode simply will not persist */
    }
  }

  function isLive() {
    const api = YT();
    return !!(state.enabled && api && api.hasKey());
  }

  /* -------------------------------------------------------------- modal */

  function setStatus(message, tone) {
    const el = byId('live-status');
    if (!el) return;
    el.textContent = message || '';
    el.dataset.tone = tone || 'info';
    el.hidden = !message;
  }

  function paintModal() {
    const api = YT();
    const hasKey = !!(api && api.hasKey());
    const input = byId('live-key');
    if (input && !input.value && hasKey) input.value = api.getKey();
    const toggle = byId('live-toggle');
    if (toggle) {
      toggle.setAttribute('aria-checked', String(state.enabled && hasKey));
      toggle.disabled = !hasKey;
    }
    const clearBtn = byId('live-clear');
    if (clearBtn) clearBtn.hidden = !hasKey;
    const region = byId('live-region');
    if (region) region.value = state.region;
    byId('live-live-badge')?.toggleAttribute('hidden', !isLive());
  }

  function openModal() {
    const modal = byId('live-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    paintModal();
    setStatus('', 'info');
    byId('live-key')?.focus();
  }

  function closeModal() {
    const modal = byId('live-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  async function saveAndTest() {
    const api = YT();
    if (!api) return;
    const input = byId('live-key');
    const key = (input && input.value || '').trim();
    if (!key) {
      setStatus('Paste an API key first.', 'error');
      return;
    }
    api.setKey(key);
    setStatus('Checking the key…', 'info');
    const button = byId('live-save');
    if (button) button.disabled = true;
    try {
      const result = await api.testConnection();
      state.enabled = true;
      saveFlags();
      paintModal();
      setStatus('Key works. Trending sample: “' + (result.sample || 'ok') + '”. Live mode is on.', 'ok');
      toast('Live YouTube data enabled');
    } catch (err) {
      state.enabled = false;
      saveFlags();
      paintModal();
      setStatus(err.message || 'That key did not work.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function disconnect() {
    const api = YT();
    if (!api) return;
    api.setKey('');
    state.enabled = false;
    saveFlags();
    const input = byId('live-key');
    if (input) input.value = '';
    paintModal();
    setStatus('Key removed. The offline demo dataset is active again.', 'info');
    toast('Disconnected from YouTube');
  }

  function initModal() {
    const modal = byId('live-modal');
    if (!modal) return;

    byId('live-close')?.addEventListener('click', closeModal);
    byId('live-cancel')?.addEventListener('click', closeModal);
    byId('live-save')?.addEventListener('click', saveAndTest);
    byId('live-clear')?.addEventListener('click', disconnect);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    byId('live-toggle')?.addEventListener('click', (e) => {
      const api = YT();
      if (!api || !api.hasKey()) {
        setStatus('Add a key first.', 'error');
        return;
      }
      state.enabled = !state.enabled;
      saveFlags();
      paintModal();
      setStatus(state.enabled ? 'Live YouTube data is on.' : 'Live YouTube data is off.', 'info');
      notify(state.enabled
        ? 'Live YouTube data on — reloading with real results…'
        : 'Live YouTube data off — back to the offline demo dataset.', { tone: state.enabled ? 'ok' : 'info' });
      // The page body is rendered once per load, so a refresh is what actually
      // swaps the dataset; the banner above is already visible while it happens.
      setTimeout(() => location.reload(), 700);
    });

    byId('live-region')?.addEventListener('change', (e) => {
      state.region = e.currentTarget.value;
      saveFlags();
      setStatus('Trending region set to ' + state.region + '.', 'info');
      notify('Trending region set to ' + state.region + ' — reloading…');
      setTimeout(() => location.reload(), 700);
    });

    byId('live-key')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveAndTest();
      }
    });
  }

  /* ------------------------------------------------------------- chrome */

  /* ---------------------------------------------------------- rendering */

  function liveCard(v) {
    return '<article class="card">' +
      '<a class="card__thumb" href="watch.html?v=' + v.id + '">' +
        '<img src="' + esc(v.poster) + '" alt="" width="1280" height="720" loading="lazy" decoding="async">' +
        (v.durationLabel ? '<span class="card__duration">' + esc(v.durationLabel) + '</span>' : '') +
        '<span class="card__badge card__badge--yt">YouTube</span>' +
      '</a>' +
      '<div class="card__body">' +
        '<div class="card__text">' +
          '<a class="card__title" href="watch.html?v=' + v.id + '">' + esc(v.title) + '</a>' +
          '<div class="card__meta"><a href="channel.html?c=' + esc(v.channelSlug) + '">' + esc(v.channelName) + '</a></div>' +
          '<div class="card__meta">' + count(v.views) + ' views · ' + esc(v.publishedLabel) + '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function miniCard(v) {
    return '<a class="mini-card" href="watch.html?v=' + v.id + '">' +
      '<span class="mini-card__thumb"><img src="' + esc(v.poster) + '" alt="" loading="lazy">' +
        (v.durationLabel ? '<span class="card__duration">' + esc(v.durationLabel) + '</span>' : '') + '</span>' +
      '<span class="mini-card__body">' +
        '<span class="mini-card__title">' + esc(v.title) + '</span>' +
        '<span class="mini-card__meta">' + esc(v.channelName) + '</span>' +
        '<span class="mini-card__meta">' + count(v.views) + ' views · ' + esc(v.publishedLabel) + '</span>' +
      '</span></a>';
  }

  function errorPanel(err, retry) {
    const isQuota = err && (err.reason === 'quotaExceeded' || err.reason === 'dailyLimitExceeded');
    return '<div class="empty-state live-error">' + icon(isQuota ? 'clock' : 'compass') +
      '<h2>' + (isQuota ? 'Quota reached' : 'YouTube API error') + '</h2>' +
      '<p>' + esc((err && err.message) || 'The request failed.') + '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">' +
        (retry ? '<button class="btn-pill btn-pill--solid" type="button" id="live-retry">Try again</button>' : '') +
        '<button class="btn-pill" type="button" id="live-open-settings">API settings</button>' +
        '<a class="btn-pill" href="#" id="live-fallback">Use the offline demo</a>' +
      '</div></div>';
  }

  function wireErrorPanel(root, retry) {
    byId('live-retry', root)?.addEventListener('click', retry);
    byId('live-open-settings', root)?.addEventListener('click', openModal);
    byId('live-fallback', root)?.addEventListener('click', (e) => {
      e.preventDefault();
      state.enabled = false;
      saveFlags();
      location.reload();
    });
  }

  function skeletonGrid(n) {
    return Array.from({ length: n || 8 }, () =>
      '<div class="card"><div class="skeleton card__thumb" style="aspect-ratio:16/9"></div>' +
      '<div class="card__body"><div style="flex:1">' +
      '<div class="skeleton" style="height:14px;width:88%;margin-bottom:8px"></div>' +
      '<div class="skeleton" style="height:12px;width:52%"></div></div></div></div>').join('');
  }

  /* ------------------------------------------------------------ pages */

  async function homePage() {
    const grid = byId('feed-grid');
    if (!grid) return false;

    byId('hero')?.remove();
    byId('resume-section')?.remove();
    const chips = byId('chips');
    if (chips) {
      const regions = [['US', 'United States'], ['GB', 'United Kingdom'], ['DE', 'Germany'],
        ['JP', 'Japan'], ['KR', 'South Korea'], ['IN', 'India'], ['BR', 'Brazil'], ['AU', 'Australia']];
      chips.innerHTML = regions.map(([code, label]) =>
        '<button class="chip" type="button" data-region="' + code + '" aria-pressed="' +
        (code === state.region) + '">' + label + '</button>').join('');
      qsa('[data-region]', chips).forEach((btn) =>
        btn.addEventListener('click', () => {
          state.region = btn.dataset.region;
          saveFlags();
          qsa('[data-region]', chips).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          homePage();
        }));
    }

    const heading = byId('feed-heading');
    const countEl = byId('feed-count');
    if (heading) heading.textContent = 'Trending on YouTube';
    if (countEl) countEl.textContent = '';
    grid.innerHTML = skeletonGrid(8);

    try {
      const videos = await YT().popular({ regionCode: state.region, maxResults: 24 });
      grid.innerHTML = videos.length
        ? videos.map(liveCard).join('')
        : '<div class="empty-state"><h2>Nothing returned</h2><p>Trending is empty for that region.</p></div>';
      if (countEl) countEl.textContent = videos.length + ' videos · 1 quota unit';
    } catch (err) {
      grid.innerHTML = errorPanel(err, homePage);
      wireErrorPanel(grid, homePage);
    }
    return true;
  }

  async function searchPage() {
    const host = byId('results');
    if (!host) return false;
    const q = (params().get('q') || '').trim();
    const heading = byId('search-heading');
    const countEl = byId('search-count');
    const filters = byId('search-filters');
    if (filters) filters.innerHTML = '';

    if (!q) {
      if (heading) heading.textContent = 'Explore YouTube';
      if (countEl) countEl.textContent = 'Search costs 100 quota units per query.';
      host.innerHTML = skeletonGrid(8);
      try {
        const videos = await YT().popular({ regionCode: state.region, maxResults: 12 });
        host.innerHTML = videos.map(liveCard).join('');
      } catch (err) {
        host.innerHTML = errorPanel(err, searchPage);
        wireErrorPanel(host, searchPage);
      }
      return true;
    }

    if (heading) heading.textContent = 'Results for “' + q + '”';
    if (countEl) countEl.textContent = 'Searching YouTube…';
    host.innerHTML = skeletonGrid(4);

    try {
      const [videos, channels] = await Promise.all([
        YT().searchVideos(q, { maxResults: 20 }),
        YT().searchChannels(q, { maxResults: 3 }).catch(() => []),
      ]);
      if (countEl) countEl.textContent = videos.length + ' videos · ' + channels.length + ' channels · 200 quota units';
      host.innerHTML = videos.map((v) =>
        '<a class="result" href="watch.html?v=' + v.id + '">' +
          '<span class="result__thumb"><img src="' + esc(v.poster) + '" alt="" loading="lazy">' +
            (v.durationLabel ? '<span class="card__duration">' + esc(v.durationLabel) + '</span>' : '') + '</span>' +
          '<span class="result__body">' +
            '<span class="result__title">' + esc(v.title) + '</span>' +
            '<span class="result__meta">' + count(v.views) + ' views · ' + esc(v.publishedLabel) + '</span>' +
            '<span class="result__channel">' + esc(v.channelName) + '</span>' +
            '<span class="result__snippet">' + esc(v.description.slice(0, 220)) + '</span>' +
          '</span></a>').join('') +
        channels.map((c) =>
          '<a class="channel-result" href="channel.html?c=' + esc(c.id) + '">' +
            '<img src="' + esc(c.avatar) + '" alt="">' +
            '<div><h3>' + esc(c.name) + '</h3>' +
            '<p>' + esc(c.handle || c.channelId) + ' · ' + count(c.subscribers) + ' subscribers</p>' +
            '<p class="result__snippet">' + esc(c.about.slice(0, 180)) + '</p></div></a>').join('') ||
        '<div class="empty-state"><h2>No results</h2><p>Nothing matched that query.</p></div>';
    } catch (err) {
      host.innerHTML = errorPanel(err, searchPage);
      wireErrorPanel(host, searchPage);
    }
    return true;
  }

  async function channelPage() {
    const host = byId('channel-view');
    if (!host) return false;
    const raw = params().get('c') || '';
    const query = raw.startsWith('ytc:') ? raw.slice(4) : raw;

    host.innerHTML = '<div class="skeleton" style="height:180px;margin-top:16px"></div>' +
      '<div class="channel-head"><div class="skeleton" style="width:120px;height:120px;border-radius:50%;margin-top:-48px"></div>' +
      '<div class="channel-head__info"><div class="skeleton" style="height:28px;width:240px"></div></div></div>';

    try {
      const channel = await YT().resolveChannel(query);
      const [uploads] = await Promise.all([
        YT().channelUploads(channel.channelId, { maxResults: 24 }).catch(() => []),
      ]);
      document.title = channel.name + ' — OpenTube';
      const subscribed = (global.OT?.Store?.get('subs') || []).includes('ytc:' + channel.channelId);

      host.innerHTML =
        '<div class="channel-head">' +
          '<img class="channel-head__avatar" src="' + esc(channel.avatar) + '" alt="">' +
          '<div class="channel-head__info">' +
            '<h1 class="channel-head__name">' + esc(channel.name) + ' ' + icon('check-badge', 'icon--sm') + '</h1>' +
            '<div class="channel-head__stats">' +
              (channel.handle ? '<span>' + esc(channel.handle) + '</span><span class="dot"></span>' : '') +
              '<span>' + count(channel.subscribers) + ' subscribers</span>' +
              '<span class="dot"></span><span>' + count(channel.videoCount) + ' videos</span>' +
              '<span class="dot"></span><span>live from YouTube</span></div>' +
            '<p class="channel-head__about">' + esc(channel.about.slice(0, 320)) + '</p>' +
          '</div>' +
          '<div class="channel-actions">' +
            '<button class="btn-pill' + (subscribed ? '' : ' btn-pill--solid') + '" id="live-sub" type="button">' +
              (subscribed ? 'Subscribed' : 'Subscribe') + '</button>' +
            '<a class="btn-pill" href="https://www.youtube.com/channel/' + esc(channel.channelId) +
              '" target="_blank" rel="noopener">On YouTube</a>' +
          '</div>' +
        '</div>' +
        '<div class="section-head"><h2>Latest uploads</h2>' +
          '<span style="font-size:12px;color:var(--text-secondary)">3 quota units</span></div>' +
        '<div class="video-grid">' + (uploads.map(liveCard).join('') ||
          '<div class="empty-state"><h2>No uploads</h2><p>This channel has no public videos.</p></div>') + '</div>';

      byId('live-sub')?.addEventListener('click', (e) => {
        const store = global.OT?.Store;
        if (!store) return;
        const id = 'ytc:' + channel.channelId;
        const added = store.toggleInList('subs', id);
        e.currentTarget.textContent = added ? 'Subscribed' : 'Subscribe';
        e.currentTarget.classList.toggle('btn-pill--solid', !added);
        toast(added ? 'Subscribed to ' + channel.name : 'Unsubscribed');
      });
    } catch (err) {
      host.innerHTML = errorPanel(err, channelPage);
      wireErrorPanel(host, channelPage);
    }
    return true;
  }

  async function watchPage() {
    const id = (params().get('v') || '').replace(/^yt:/, '');
    const wrap = byId('player');
    if (!wrap || !id) return false;

    // 1) playback: official embedded player only
    wrap.innerHTML =
      '<iframe class="yt-embed" src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?rel=0&modestbranding=1&playsinline=1" title="YouTube video player" allow="accelerometer; ' +
      'autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
      'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
    wrap.classList.add('player-wrap--embed');

    // the custom chrome has no meaning for an embedded player
    qsa('.watch__actions .action').forEach((el) => {
      if (/Download/.test(el.textContent || '')) el.remove();
    });
    byId('speed-menu')?.remove();

    const titleEl = byId('watch-title');
    const subEl = byId('watch-sub');
    const upNext = byId('up-next');
    if (upNext) upNext.innerHTML = '<div class="skeleton" style="height:80px"></div>';

    try {
      const [video] = await YT().videosByIds([id]);
      if (!video) throw new YT.ApiError('That video is not available through the API.', { reason: 'videoNotFound' });

      document.title = video.title + ' — OpenTube';
      if (titleEl) titleEl.textContent = video.title;
      if (subEl) {
        subEl.innerHTML = '<strong>' + count(video.views) + ' views</strong>' +
          '<span class="dot"></span>' + esc(video.publishedLabel) +
          '<span class="dot"></span><span class="live-chip">YouTube</span>';
      }

      const likeBtn = byId('like-btn');
      if (likeBtn) {
        likeBtn.innerHTML = icon('like', 'icon--sm') + ' <span>' + count(video.likes) + '</span>';
        likeBtn.setAttribute('aria-label', 'Likes on YouTube');
      }
      byId('dislike-wrap')?.remove();
      byId('save-btn')?.remove();
      byId('download-btn')?.remove();

      const bar = byId('channel-bar');
      if (bar) {
        bar.innerHTML =
          '<div class="channel-bar__id">' +
            '<a class="channel-bar__name" href="channel.html?c=' + esc(video.channelSlug) + '">' +
              esc(video.channelName) + '</a>' +
            '<div class="channel-bar__sub">Channel id ' + esc(video.channelId) + '</div>' +
          '</div>' +
          '<div class="channel-bar__actions">' +
            '<a class="btn-pill" href="https://www.youtube.com/watch?v=' + esc(video.videoId) +
              '" target="_blank" rel="noopener">Watch on YouTube</a>' +
          '</div>';
      }

      const desc = byId('description');
      if (desc) {
        desc.classList.remove('is-collapsed');
        desc.innerHTML =
          '<div class="description__meta">' + count(video.views) + ' views · ' + esc(video.publishedLabel) + '</div>' +
          '<div class="description__text">' + esc(video.description.slice(0, 4000) || 'No description.') + '</div>' +
          (video.tags.length
            ? '<div class="description__tags">' + video.tags.map((t) =>
                '<a class="tag" href="search.html?q=' + encodeURIComponent(t) + '">#' + esc(t) + '</a>').join('') + '</div>'
            : '') +
          '<p class="live-note">' + icon('compass', 'icon--xs') +
          ' Playback uses the official YouTube embedded player; chapters, transcript captions and ' +
          'the custom controls apply to the offline demo clips only.</p>';
        byId('desc-toggle')?.remove();
      }

      const chapters = byId('chapters');
      if (chapters) chapters.remove();
      byId('cc-btn')?.remove();

      // 2) up next: trending, minus the video being watched
      try {
        const trending = await YT().popular({ regionCode: state.region, maxResults: 10 });
        if (upNext) {
          upNext.innerHTML = trending.filter((v) => v.videoId !== id).slice(0, 8).map(miniCard).join('');
        }
      } catch (err) {
        if (upNext) upNext.innerHTML = '<p style="font-size:13px;color:var(--text-secondary)">' +
          esc(err.message) + '</p>';
      }

      // 3) comments, best effort
      loadLiveComments(id);
    } catch (err) {
      if (titleEl) titleEl.textContent = 'Video unavailable';
      if (desc) desc.innerHTML = errorPanel(err, watchPage);
      if (desc) wireErrorPanel(desc, watchPage);
      if (upNext) upNext.innerHTML = '';
    }
    return true;
  }

  async function loadLiveComments(videoId) {
    const list = byId('comments-list');
    const countEl = byId('comment-count');
    if (!list) return;
    list.innerHTML = '<div class="skeleton" style="height:64px;margin-bottom:12px"></div>';

    const paint = async (order) => {
      try {
        const items = await YT().comments(videoId, { order, maxResults: 20 });
        if (countEl) countEl.textContent = items.length;
        list.innerHTML = items.length
          ? items.map((c) =>
              '<div class="comment">' +
                '<div class="comment__avatar" style="background:#1b1b1f;overflow:hidden">' +
                  (c.avatar ? '<img src="' + esc(c.avatar) + '" alt="" width="40" height="40">' : esc(c.user.slice(0, 1))) +
                '</div>' +
                '<div class="comment__body">' +
                  '<div class="comment__head"><b>' + esc(c.user) + '</b><span>' + esc(c.ago) + '</span></div>' +
                  '<p class="comment__text">' + esc(c.text) + '</p>' +
                  '<div class="comment__actions">' + icon('like', 'icon--xs') +
                    '<span>' + count(c.likes) + '</span></div>' +
                '</div></div>').join('')
          : '<p style="font-size:13px;color:var(--text-secondary)">No public comments.</p>';
      } catch (err) {
        list.innerHTML = '<p style="font-size:13px;color:var(--text-secondary)">' +
          esc(err.message) + '</p>';
      }
    };

    qsa('[data-sort]').forEach((btn) =>
      btn.addEventListener('click', () => {
        qsa('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        paint(btn.dataset.sort);
      }));
    byId('comment-form')?.remove();
    await paint('top');
  }

  /* ------------------------------------------------------------- public */

  /** True only for pages live mode actually owns — decided synchronously. */
  function claims(page) {
    if (!isLive()) return false;
    if (page === 'watch') return (params().get('v') || '').startsWith('yt:');
    return page === 'home' || page === 'search' || page === 'channel';
  }

  async function intercept(page) {
    if (!claims(page)) return false;
    if (page === 'home') return homePage();
    if (page === 'search') return searchPage();
    if (page === 'channel') return channelPage();
    if (page === 'watch') return watchPage();
    return false;
  }

  function init() {
    loadFlags();
    initModal();
    paintModal();
  }

  global.OTLive = {
    init,
    claims,
    intercept,
    open: openModal,
    close: closeModal,
    state,
    isLive,
    // exported for the tests
    _cards: { liveCard, miniCard, errorPanel },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

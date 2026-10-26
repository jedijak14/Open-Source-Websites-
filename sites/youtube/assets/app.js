/**
 * OpenTube — client application.
 *
 * One small vanilla-JS app that renders every page from assets/data.js:
 *   index.html    feed + category chips + continue-watching
 *   watch.html    custom player, chapters, transcript captions, comments
 *   channel.html  channel home / videos / about
 *   search.html   query results
 *   library.html  history, watch later and liked videos
 *
 * State lives in localStorage; there is no backend and no build step.
 */
(function () {
  'use strict';

  const D = window.OT_DATA;
  const byId = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------------------------------------------------------------- state */

  const KEY = 'opentube:v1';

  const defaults = {
    theme: null,
    sidebar: 'full',
    theater: false,
    autoplay: true,
    subs: [],
    likes: {},
    later: [],
    history: [],
  };

  const Store = {
    data: null,
    load() {
      try {
        this.data = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}'));
      } catch (err) {
        this.data = Object.assign({}, defaults);
      }
      return this.data;
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (err) {
        /* storage full or blocked — the app still works, it just forgets */
      }
    },
    get(key) { return this.data[key]; },
    set(key, value) {
      this.data[key] = value;
      this.save();
    },
    toggleInList(key, id) {
      const list = this.data[key].slice();
      const i = list.indexOf(id);
      if (i === -1) list.unshift(id); else list.splice(i, 1);
      this.data[key] = list;
      this.save();
      return i === -1;
    },
    has(key, id) { return this.data[key].includes(id); },
    remember(id, pos) {
      const h = this.data.history.filter((e) => e.id !== id);
      h.unshift({ id, pos: Math.max(0, Math.round(pos || 0)), at: Date.now() });
      this.data.history = h.slice(0, 40);
      this.save();
    },
    watched(id) {
      const e = this.data.history.find((x) => x.id === id);
      return e ? e.pos : 0;
    },
  };

  /* ---------------------------------------------------------------- utils */

  function count(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function ago(iso) {
    const then = new Date(iso + 'T12:00:00');
    const days = Math.max(1, Math.round((Date.now() - then.getTime()) / 86400000));
    if (days < 7) return days === 1 ? '1 day ago' : days + ' days ago';
    if (days < 30) {
      const w = Math.round(days / 7);
      return w + ' week' + (w > 1 ? 's' : '') + ' ago';
    }
    if (days < 365) {
      const m = Math.round(days / 30);
      return m + ' month' + (m > 1 ? 's' : '') + ' ago';
    }
    const y = Math.floor(days / 365);
    return y + ' year' + (y > 1 ? 's' : '') + ' ago';
  }

  function date(iso) {
    const d = new Date(iso + 'T12:00:00');
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function clock(secs) {
    secs = Math.max(0, Math.floor(secs || 0));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (v) => String(v).padStart(2, '0');
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function video(id) { return D.videos.find((v) => v.id === id); }
  function channel(slug) { return D.channels[slug]; }

  function params() { return new URLSearchParams(location.search); }

  function isTyping(target) {
    return !!(target && target.closest && target.closest('input, textarea, select, [contenteditable]'));
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- toast */

  function toast(message, action) {
    const stack = byId('toasts');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + esc(message) + '</span>' +
      (action ? '<a href="' + action.href + '">' + esc(action.label) + '</a>' : '');
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 220);
    }, action ? 5200 : 2600);
  }

  /* --------------------------------------------------------------- banner */

  /**
   * Page-level banner: appears at the top of the viewport the moment something
   * happens — saving a key, connecting an account, importing history — so the
   * feedback is visible without scrolling or reloading. Stacks, auto-dismisses,
   * and can carry one action link.
   */
  function notify(message, options) {
    const opts = options || {};
    let host = byId('banners');
    if (!host) {
      host = document.createElement('div');
      host.className = 'banner-host';
      host.id = 'banners';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'banner';
    el.dataset.tone = opts.tone || 'info';
    el.innerHTML =
      '<span class="banner__body">' + esc(message) + '</span>' +
      (opts.action
        ? '<a class="banner__action" href="' + esc(opts.action.href) + '">' + esc(opts.action.label) + '</a>'
        : '') +
      '<button type="button" class="banner__close" aria-label="Dismiss">' +
        '<svg class="icon icon--xs" aria-hidden="true"><use href="#i-close"></use></svg>' +
      '</button>';
    host.appendChild(el);

    let timer = 0;
    const dismiss = () => {
      if (timer) clearTimeout(timer);
      if (!el.isConnected) return;
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.banner__close').addEventListener('click', dismiss);
    const ttl = opts.timeout === 0 ? 0 : (opts.timeout || (opts.action ? 6000 : 4200));
    if (ttl) timer = setTimeout(dismiss, ttl);
    return el;
  }

  /* ---------------------------------------------------------------- cards */

  let previewTimer = null;

  function attachPreview(card, v) {
    if (reducedMotion) return;
    card.addEventListener('mouseenter', () => {
      previewTimer = setTimeout(() => {
        const thumb = qs('.card__thumb', card);
        if (!thumb || qs('video', thumb)) return;
        const vid = document.createElement('video');
        vid.src = v.src;
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.setAttribute('aria-hidden', 'true');
        thumb.appendChild(vid);
        vid.play().catch(() => vid.remove());
        vid.addEventListener('error', () => vid.remove(), { once: true });
      }, 900);
    });
    const clear = () => {
      clearTimeout(previewTimer);
      const vid = qs('video', card);
      if (vid) vid.remove();
    };
    card.addEventListener('mouseleave', clear);
    card.addEventListener('focusout', clear);
  }

  function card(v, opts) {
    opts = opts || {};
    const ch = channel(v.channel);
    const watched = Store.watched(v.id);
    const pct = Math.min(100, Math.round((watched / v.duration) * 100));
    const isSaved = Store.has('later', v.id);

    const el = document.createElement('article');
    el.className = 'card' + (pct > 2 && pct < 96 ? ' card--watched' : '');
    el.innerHTML =
      '<a class="card__thumb" href="watch.html?v=' + v.id + '" aria-label="' + esc(v.title) + '">' +
        '<img src="' + v.poster + '" alt="" width="1280" height="720" loading="lazy" decoding="async">' +
        '<span class="card__duration">' + v.durationLabel + '</span>' +
        (pct > 2 && pct < 96 ? '<span class="card__progress"><i style="width:' + pct + '%"></i></span>' : '') +

      '</a>' +
      '<div class="card__hover-actions">' +
        '<button type="button" data-later title="Watch later" aria-label="Watch later">' + icon(isSaved ? 'check' : 'clock', 'icon--xs') + '</button>' +
        '<button type="button" data-queue title="Add to queue" aria-label="Add to queue">' + icon('list', 'icon--xs') + '</button>' +
      '</div>' +
      '<div class="card__body">' +
        (opts.hideAvatar ? '' : '<a href="channel.html?c=' + v.channel + '" tabindex="-1"><img class="card__avatar" src="' + ch.avatar + '" alt="" width="36" height="36" loading="lazy"></a>') +
        '<div class="card__text">' +
          '<a class="card__title" href="watch.html?v=' + v.id + '">' + esc(v.title) + '</a>' +
          '<div class="card__meta"><a href="channel.html?c=' + v.channel + '">' + esc(ch.name) + '</a></div>' +
          '<div class="card__meta">' + count(v.views) + ' views<span class="dot"></span>' + ago(v.published) + '</div>' +
        '</div>' +
      '</div>';

    qs('[data-later]', el).addEventListener('click', (e) => {
      e.preventDefault();
      const added = Store.toggleInList('later', v.id);
      e.currentTarget.innerHTML = icon(added ? 'check' : 'clock', 'icon--xs');
      toast(added ? 'Saved to Watch later' : 'Removed from Watch later', added ? { label: 'View', href: 'library.html?tab=later' } : null);
    });
    qs('[data-queue]', el).addEventListener('click', (e) => {
      e.preventDefault();
      toast('Added to queue · ' + v.title);
    });
    attachPreview(el, v);
    return el;
  }

  function miniCard(v, opts) {
    opts = opts || {};
    const ch = channel(v.channel);
    return '<a class="mini-card" href="watch.html?v=' + v.id + '">' +
      '<span class="mini-card__thumb"><img src="' + v.poster + '" alt="" loading="lazy" width="1280" height="720">' +
        '<span class="card__duration">' + v.durationLabel + '</span></span>' +
      '<span class="mini-card__body">' +
        '<span class="mini-card__title">' + esc(v.title) + '</span>' +
        '<span class="mini-card__meta">' + esc(ch.name) + '</span>' +
        '<span class="mini-card__meta">' + count(v.views) + ' views · ' + ago(v.published) + '</span>' +
      '</span></a>';
  }

  /* ---------------------------------------------------------------- chrome */

  function applyTheme() {
    const stored = Store.get('theme');
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const theme = stored || (mql.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    const meta = qs('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0b0d' : '#ffffff');
  }

  function applySidebar() {
    const mode = window.innerWidth < 900 ? 'mini' : Store.get('sidebar');
    document.body.dataset.sidebar = mode;
  }

  function renderSidebar() {
    const host = byId('sidebar');
    if (!host) return;
    const subs = Store.get('subs').filter(videoChannelExists);
    const links = [
      ['home', 'Home', 'home', 'index.html'],
      ['explore', 'Explore', 'compass', 'search.html?q=&f=all'],
      ['subs', 'Subscriptions', 'subscriptions', 'library.html?tab=subs'],
    ];
    const you = [
      ['library', 'You', 'user', 'library.html'],
      ['history', 'History', 'history', 'library.html?tab=history'],
      ['later', 'Watch later', 'clock', 'library.html?tab=later'],
      ['liked', 'Liked videos', 'like', 'library.html?tab=liked'],
    ];

    const link = (key, label, ic, href) =>
      '<a class="side-link" href="' + href + '">' + icon(ic) +
      '<span class="side-link__label">' + label + '</span></a>';

    host.innerHTML =
      '<nav class="side-section" aria-label="Main">' +
        links.map((l) => link.apply(null, l)).join('') +
      '</nav>' +
      '<nav class="side-section" aria-label="You">' +
        you.map((l) => link.apply(null, l)).join('') +
      '</nav>' +
      '<nav class="side-section hide-rail" aria-label="Subscriptions">' +
        '<div class="side-section__title">Subscriptions</div>' +
        (subs.length
          ? subs.map((slug) => {
              const ch = channel(slug);
              return '<a class="side-link side-link--sub" href="channel.html?c=' + slug + '">' +
                '<img src="' + ch.avatar + '" alt="" width="24" height="24">' +
                '<span class="side-link__label">' + esc(ch.name) + '</span></a>';
            }).join('')
          : '<a class="side-link" href="search.html?q=&f=channels">' + icon('user') +
            '<span class="side-link__label">Find channels</span></a>') +
      '</nav>' +
      '<nav class="side-section hide-rail" aria-label="Explore">' +
        '<div class="side-section__title">Explore</div>' +
        D.categories.filter((c) => c !== 'All').slice(0, 6).map((c) =>
          '<a class="side-link" href="index.html?c=' + encodeURIComponent(c) + '">' +
          icon(catIcon(c)) + '<span class="side-link__label">' + c + '</span></a>').join('') +
      '</nav>' +
      '<div class="side-footer hide-rail">' +
        '<div class="side-footer__links">' +
          '<a href="about.html">About</a><a href="about.html#licence">License</a>' +
          '<a href="about.html#data">Demo data</a><a href="about.html#shortcuts">Keyboard shortcuts</a>' +
        '</div>' +
        '<div>OpenTube — an open-source video platform demo.<br>' +
        'No accounts, no tracking, no uploads.<br>All content is fictional.</div>' +
      '</div>';
  }

  function videoChannelExists(slug) { return !!D.channels[slug]; }

  function catIcon(c) {
    return {
      Programming: 'code', Music: 'music', Gaming: 'gamepad', Travel: 'globe',
      Science: 'flask', Food: 'food', Fitness: 'activity', Space: 'rocket',
    }[c] || 'compass';
  }

  function renderChips(host, active, onPick) {
    if (!host) return;
    const cats = D.categories;
    host.innerHTML = cats.map((c) =>
      '<button class="chip" type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === active) + '">' + esc(c) + '</button>'
    ).join('');
    qsa('[data-cat]', host).forEach((btn) => {
      btn.addEventListener('click', () => {
        qsa('.chip', host).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        onPick(btn.dataset.cat);
      });
    });
  }

  /* ---------------------------------------------------------------- menus */

  function closeMenus(except) {
    qsa('.menu.is-open').forEach((m) => {
      if (m !== except) m.classList.remove('is-open');
    });
  }

  function openMenu(menu, anchor) {
    if (!menu) return;
    closeMenus(menu);
    menu.classList.add('is-open');
    const r = anchor.getBoundingClientRect();
    const width = menu.offsetWidth || 240;
    let left = Math.min(r.right - width, window.innerWidth - width - 12);
    left = Math.max(12, left);
    let top = r.bottom + 8;
    if (top + menu.offsetHeight > window.innerHeight - 12) {
      top = Math.max(12, r.top - menu.offsetHeight - 8);
    }
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    const first = qs('button, a', menu);
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- header */

  function initHeader() {
    const menuBtn = byId('menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        if (window.innerWidth < 900) {
          document.body.classList.toggle('nav-open');
          menuBtn.setAttribute('aria-expanded', String(document.body.classList.contains('nav-open')));
        } else {
          const next = Store.get('sidebar') === 'mini' ? 'full' : 'mini';
          Store.set('sidebar', next);
          applySidebar();
        }
      });
    }

    const backdrop = byId('sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        document.body.classList.remove('nav-open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
      });
    }

    // search
    const form = byId('search-form');
    const input = byId('search-input');
    if (form && input) {
      const initial = params().get('q');
      if (initial && document.body.dataset.page === 'search') input.value = initial;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        location.href = 'search.html?q=' + encodeURIComponent(q);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') input.blur();
      });
    }

    const mobileToggle = byId('search-toggle');
    if (mobileToggle && input) {
      mobileToggle.addEventListener('click', () => {
        document.body.classList.toggle('search-open');
        if (document.body.classList.contains('search-open')) input.focus();
      });
    }

    // create menu
    const createBtn = byId('create-btn');
    const createMenu = byId('create-menu');
    if (createBtn && createMenu) {
      createBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu(createMenu, createBtn);
      });
      qsa('button', createMenu).forEach((b) =>
        b.addEventListener('click', () => {
          closeMenus();
          toast('Uploads are disabled in this demo');
        }));
    }

    // notifications
    const bellBtn = byId('bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => {
        bellBtn.querySelector('.dot-badge')?.remove();
        toast('No new notifications');
      });
    }

    // account menu
    const avatarBtn = byId('avatar-btn');
    const accountMenu = byId('account-menu');
    if (avatarBtn && accountMenu) {
      avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu(accountMenu, avatarBtn);
      });
      qsa('[data-action]', accountMenu).forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'theme') {
            const current = document.documentElement.dataset.theme;
            const next = current === 'dark' ? 'light' : 'dark';
            Store.set('theme', next);
            applyTheme();
            toast(next === 'dark' ? 'Dark theme on' : 'Light theme on');
          } else if (action === 'live') {
            closeMenus();
            window.OTLive ? window.OTLive.open() : toast('Live mode is unavailable');
          } else if (action === 'shortcuts') {
            toast('Press ? for the shortcut list');
          } else if (action === 'settings') {
            toast('Settings are local to this browser');
          } else {
            closeMenus();
          }
        });
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu') && !e.target.closest('[aria-haspopup]')) closeMenus();
      if (e.target.closest('a[href]')) document.body.classList.remove('nav-open');
    });

    // "/" focuses search, "?" shows shortcuts
    document.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        const i = byId('search-input');
        if (i) { i.focus(); i.select(); }
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        showShortcuts();
      }
    });

    // theme follows the OS until the user picks one
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!Store.get('theme')) applyTheme();
    });
    window.addEventListener('resize', () => {
      applySidebar();
      if (window.innerWidth >= 900) {
        document.body.classList.remove('nav-open');
      }
    });
  }

  function showShortcuts() {
    toast('Player: k or space play · j / l skip 10s · ← → 5s · m mute · c captions · t theater · f fullscreen');
  }

  /* ---------------------------------------------------------------- feed */

  function initHome() {
    const grid = byId('feed-grid');
    if (!grid) return;
    const chipHost = byId('chips');
    const catParam = params().get('c') || 'All';
    let active = D.categories.includes(catParam) ? catParam : 'All';

    const hero = byId('hero');
    const featured = video('v-abyss');
    if (hero && featured) {
      hero.innerHTML =
        '<img src="' + featured.poster + '" alt="" width="1280" height="720">' +
        '<div class="hero__content">' +
          '<span class="hero__eyebrow">Featured this week</span>' +
          '<h1 class="hero__title">' + esc(featured.title) + '</h1>' +
          '<p class="hero__meta">' + esc(channel(featured.channel).name) + ' · ' +
            count(featured.views) + ' views · ' + featured.durationLabel + '</p>' +
          '<div class="hero__actions">' +
            '<a class="btn-pill btn-pill--solid" href="watch.html?v=' + featured.id + '">' + icon('play', 'icon--sm') + ' Play</a>' +
            '<button class="btn-pill" type="button" id="hero-save">' + icon('clock', 'icon--sm') + ' Watch later</button>' +
          '</div>' +
        '</div>';
      hero.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        location.href = 'watch.html?v=' + featured.id;
      });
      hero.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          location.href = 'watch.html?v=' + featured.id;
        }
      });
      const heroSave = byId('hero-save');
      if (heroSave) heroSave.addEventListener('click', (e) => {
        e.stopPropagation();
        const added = Store.toggleInList('later', featured.id);
        toast(added ? 'Saved to Watch later' : 'Removed from Watch later');
      });
    }

    function paint() {
      grid.innerHTML = '';
      const list = D.videos
        .filter((v) => active === 'All' || v.category === active)
        .slice()
        .sort((a, b) => (a.published < b.published ? 1 : -1));
      if (!list.length) {
        grid.innerHTML = '<div class="empty-state">' + icon('compass') +
          '<h2>Nothing here yet</h2><p>No videos in “' + esc(active) + '”. Try another category.</p></div>';
        return;
      }
      list.forEach((v) => grid.appendChild(card(v)));
      const heading = byId('feed-heading');
      if (heading) heading.textContent = active === 'All' ? 'Recommended' : active;
      const sub = byId('feed-count');
      if (sub) sub.textContent = list.length + (list.length === 1 ? ' video' : ' videos');
    }

    renderChips(chipHost, active, (c) => {
      active = c;
      const url = new URL(location.href);
      if (c === 'All') url.searchParams.delete('c'); else url.searchParams.set('c', c);
      history.replaceState(null, '', url);
      paint();
    });
    paint();

    // continue watching
    const resumeHost = byId('resume-row');
    if (resumeHost) {
      const recent = Store.get('history')
        .map((h) => ({ v: video(h.id), pos: h.pos }))
        .filter((x) => x.v && x.pos > 3 && x.pos < x.v.duration - 3)
        .slice(0, 4);
      if (recent.length) {
        byId('resume-section')?.removeAttribute('hidden');
        recent.forEach(({ v, pos }) => {
          const el = card(v, { hideAvatar: true });
          el.classList.add('card--watched');
          const bar = qs('.card__progress', el);
          if (bar) qs('i', bar).style.width = Math.min(100, (pos / v.duration) * 100) + '%';
          resumeHost.appendChild(el);
        });
      }
    }
  }

  /* ---------------------------------------------------------------- player */

  function initWatch() {
    const id = params().get('v');
    const v = video(id) || D.videos[0];
    if (!v) return;
    const ch = channel(v.channel);

    document.title = v.title + ' — OpenTube';

    const titleEl = byId('watch-title');
    if (titleEl) titleEl.textContent = v.title;

    const sub = byId('watch-sub');
    if (sub) {
      sub.innerHTML =
        '<strong>' + count(v.views) + ' views</strong>' +
        '<span class="dot"></span>' + ago(v.published) +
        '<span class="dot"></span><span>' + v.category + '</span>';
    }

    const videoEl = byId('video');
    if (!videoEl) return;
    videoEl.src = v.src;
    videoEl.poster = v.poster;

    // ---- actions
    const likeBtn = byId('like-btn');
    const dislikeBtn = byId('dislike-btn');
    const dislikeWrap = byId('dislike-wrap');
    function paintLikes() {
      const state = Store.get('likes')[v.id] || 0;
      const likes = v.likes + (state === 1 ? 1 : 0);
      if (likeBtn) {
        likeBtn.setAttribute('aria-pressed', String(state === 1));
        likeBtn.setAttribute('aria-label', state === 1 ? 'Remove like' : 'Like');
        likeBtn.innerHTML = icon('like', 'icon--sm') + ' <span>' + count(likes) + '</span>';
      }
      if (dislikeBtn) {
        dislikeBtn.setAttribute('aria-pressed', String(state === -1));
        dislikeBtn.innerHTML = icon('dislike', 'icon--sm');
        dislikeBtn.setAttribute('aria-label', state === -1 ? 'Remove dislike' : 'Dislike');
      }
      if (dislikeWrap) dislikeWrap.style.display = state === 1 ? 'none' : 'contents';
    }
    function setLike(dir) {
      const likes = Object.assign({}, Store.get('likes'));
      const current = likes[v.id] || 0;
      if (current === dir) delete likes[v.id]; else likes[v.id] = dir;
      Store.set('likes', likes);
      paintLikes();
    }
    likeBtn?.addEventListener('click', () => setLike(1));
    dislikeBtn?.addEventListener('click', () => setLike(-1));
    paintLikes();

    const saveBtn = byId('save-btn');
    function paintSave() {
      if (!saveBtn) return;
      const saved = Store.has('later', v.id);
      saveBtn.setAttribute('aria-pressed', String(saved));
      saveBtn.innerHTML = icon(saved ? 'check' : 'clock', 'icon--sm') + ' <span>' + (saved ? 'Saved' : 'Save') + '</span>';
    }
    saveBtn?.addEventListener('click', () => {
      const added = Store.toggleInList('later', v.id);
      paintSave();
      toast(added ? 'Saved to Watch later' : 'Removed from Watch later',
        added ? { label: 'View', href: 'library.html?tab=later' } : null);
    });
    paintSave();

    byId('share-btn')?.addEventListener('click', async () => {
      const link = location.origin + location.pathname + '?v=' + v.id;
      try {
        await navigator.clipboard.writeText(link);
        toast('Link copied to clipboard');
      } catch (err) {
        toast('Copy this link: ' + link);
      }
    });

    byId('download-btn')?.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = v.src;
      a.download = v.id + '.mp4';
      a.click();
      toast('Downloading clip');
    });

    byId('more-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = byId('more-menu');
      openMenu(menu, byId('more-btn'));
    });
    qsa('[data-more-action]').forEach((b) =>
      b.addEventListener('click', () => {
        closeMenus();
        toast('“' + b.dataset.moreAction + '” is not part of this demo');
      }));

    // ---- channel bar
    const bar = byId('channel-bar');
    if (bar) {
      const subscribed = Store.has('subs', v.channel);
      bar.innerHTML =
        '<a href="channel.html?c=' + v.channel + '"><img class="channel-bar__avatar" src="' + ch.avatar + '" alt=""></a>' +
        '<div class="channel-bar__id">' +
          '<a class="channel-bar__name" href="channel.html?c=' + v.channel + '">' + esc(ch.name) +
            icon('check-badge', 'icon--xs') + '</a>' +
          '<div class="channel-bar__sub">' + count(ch.subscribers) + ' subscribers</div>' +
        '</div>' +
        '<div class="channel-bar__actions">' +
          '<button class="btn-pill' + (subscribed ? '' : ' btn-pill--solid') + '" id="sub-btn" type="button">' +
            (subscribed ? 'Subscribed' : 'Subscribe') + '</button>' +
        '</div>';
      byId('sub-btn').addEventListener('click', (e) => {
        const nowSubscribed = Store.toggleInList('subs', v.channel);
        e.currentTarget.textContent = nowSubscribed ? 'Subscribed' : 'Subscribe';
        e.currentTarget.classList.toggle('btn-pill--solid', !nowSubscribed);
        renderSidebar();
        toast(nowSubscribed ? 'Subscribed to ' + ch.name : 'Unsubscribed');
      });
    }

    // ---- description
    const desc = byId('description');
    if (desc) {
      desc.innerHTML =
        '<div class="description__meta">' + count(v.views) + ' views · ' + date(v.published) + '</div>' +
        '<div class="description__text">' + esc(v.desc) + '\n\nRecorded and edited by ' + esc(ch.name) + '.</div>' +
        '<div class="description__tags">' + v.tags.map((t) =>
          '<a class="tag" href="search.html?q=' + encodeURIComponent(t) + '">#' + esc(t) + '</a>').join('') + '</div>' +
        '<div class="chapters" id="chapters">' +
          v.chapters.map((c, i) =>
            '<button class="chapter" type="button" data-seek="' + c[0] + '">' +
            '<span class="chapter__time">' + clock(c[0]) + '</span><span>' + esc(c[1]) + '</span></button>').join('') +
        '</div>' +
        '<button class="description__toggle" type="button" id="desc-toggle">Show more</button>';
      desc.classList.add('is-collapsed');
      byId('desc-toggle').addEventListener('click', (e) => {
        const collapsed = desc.classList.toggle('is-collapsed');
        e.currentTarget.textContent = collapsed ? 'Show more' : 'Show less';
      });
      qsa('[data-seek]', desc).forEach((b) =>
        b.addEventListener('click', () => seekTo(Number(b.dataset.seek))));
    }

    // ---- aside
    const aside = byId('up-next');
    if (aside) {
      const rest = D.videos.filter((x) => x.id !== v.id);
      const same = rest.filter((x) => x.category === v.category);
      const other = rest.filter((x) => x.category !== v.category);
      aside.innerHTML = same.concat(other).slice(0, 10).map((x) => miniCard(x)).join('');
    }

    byId('autoplay-switch')?.addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
      e.currentTarget.setAttribute('aria-checked', String(on));
      Store.set('autoplay', on);
    });
    const autoplaySwitch = byId('autoplay-switch');
    if (autoplaySwitch) autoplaySwitch.setAttribute('aria-checked', String(Store.get('autoplay')));

    initPlayer(v);
    initComments(v);
  }

  /* -- player -------------------------------------------------------- */

  let playerApi = null;

  function initPlayer(v) {
    const wrap = byId('player');
    const media = byId('video');
    if (!wrap || !media) return;

    const playMain = byId('play-main');
    const bigBtn = byId('player-big');
    const playToggle = byId('play-toggle');
    const muteBtn = byId('mute-btn');
    const volume = byId('volume');
    const scrub = byId('scrub');
    const fill = byId('scrub-fill');
    const buffer = byId('scrub-buffer');
    const handle = byId('scrub-handle');
    const tip = byId('scrub-tip');
    const timeEl = byId('time');
    const ccBtn = byId('cc-btn');
    const captions = byId('captions');
    const speedBtn = byId('speed-btn');
    const speedMenu = byId('speed-menu');
    const theaterBtn = byId('theater-btn');
    const fsBtn = byId('fs-btn');

    let ccOn = false;
    let lastVolume = 1;

    const setPlaying = (playing) => {
      wrap.classList.toggle('is-playing', playing);
      if (playing) wrap.classList.add('is-started');
      if (playToggle) playToggle.innerHTML = icon(playing ? 'pause' : 'play');
      if (playToggle) playToggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      if (playMain) playMain.style.display = playing ? 'none' : '';
      if (bigBtn) bigBtn.style.display = 'none';
    };

    function flashBig(iconName) {
      if (!bigBtn) return;
      bigBtn.innerHTML = '<span>' + icon(iconName, 'icon--fill') + '</span>';
      bigBtn.classList.add('is-on');
      clearTimeout(flashBig.t);
      flashBig.t = setTimeout(() => bigBtn.classList.remove('is-on'), 500);
    }

    function toggle() {
      if (media.paused) {
        media.play().catch(() => toast('Tap play to start — the browser blocked autoplay'));
      } else {
        media.pause();
      }
    }

    function seekTo(sec) {
      if (!isFinite(media.duration)) return;
      media.currentTime = Math.min(Math.max(0, sec), media.duration - 0.1);
      updateTime();
    }

    function nudge(sec) {
      seekTo(media.currentTime + sec);
      flashBig(sec < 0 ? 'back' : 'forward');
    }

    function updateTime() {
      const d = media.duration || v.duration;
      const pct = d ? (media.currentTime / d) * 100 : 0;
      if (fill) fill.style.width = pct + '%';
      if (handle) handle.style.left = pct + '%';
      if (timeEl) timeEl.textContent = clock(media.currentTime) + ' / ' + clock(d);
      if (media.buffered.length && buffer) {
        const end = media.buffered.end(media.buffered.length - 1);
        buffer.style.width = Math.min(100, (end / d) * 100) + '%';
      }
      paintChapters();
      paintCaptions();
    }

    function paintChapters() {
      qsa('.chapter').forEach((btn) => {
        btn.classList.toggle('is-current', media.currentTime >= Number(btn.dataset.seek));
      });
    }

    function paintCaptions() {
      if (!ccOn || !captions) return;
      const t = media.currentTime;
      let cue = null;
      v.transcript.forEach((c, i) => {
        const next = v.transcript[i + 1];
        if (t >= c[0] && (!next || t < next[0])) cue = c;
      });
      if (cue) {
        captions.hidden = false;
        captions.textContent = cue[1];
      } else {
        captions.hidden = true;
      }
    }

    // events
    playToggle?.addEventListener('click', toggle);
    playMain?.addEventListener('click', toggle);
    qs('.player__hit', wrap)?.addEventListener('click', toggle);
    qs('.player__hit', wrap)?.addEventListener('dblclick', () => toggleFullscreen());

    media.addEventListener('play', () => setPlaying(true));
    media.addEventListener('pause', () => {
      setPlaying(false);
      Store.remember(v.id, media.currentTime);
    });
    media.addEventListener('timeupdate', updateTime);
    media.addEventListener('progress', updateTime);
    media.addEventListener('loadedmetadata', () => {
      updateTime();
      const pos = Store.watched(v.id);
      if (pos > 3 && pos < media.duration - 4) {
        media.currentTime = pos;
        toast('Resumed from ' + clock(pos));
      }
    });
    media.addEventListener('ended', () => {
      Store.remember(v.id, 0);
      if (Store.get('autoplay')) {
        const next = D.videos.filter((x) => x.id !== v.id && x.category === v.category)[0] ||
          D.videos.filter((x) => x.id !== v.id)[0];
        if (next) {
          toast('Up next: ' + next.title, { label: 'Play', href: 'watch.html?v=' + next.id });
        }
      }
    });
    media.addEventListener('error', () => {
      toast('This clip could not be loaded');
    });

    // save progress periodically
    setInterval(() => {
      if (!media.paused && media.currentTime > 2) Store.remember(v.id, media.currentTime);
    }, 5000);

    // scrub
    let dragging = false;
    const ratio = (e) => {
      const r = scrub.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      return Math.min(1, Math.max(0, x / r.width));
    };
    const preview = (e) => {
      if (!tip) return;
      const p = ratio(e);
      tip.textContent = clock(p * (media.duration || v.duration));
      tip.style.left = p * 100 + '%';
    };
    scrub?.addEventListener('pointerdown', (e) => {
      dragging = true;
      scrub.classList.add('is-dragging');
      scrub.setPointerCapture?.(e.pointerId);
      seekTo(ratio(e) * (media.duration || v.duration));
    });
    scrub?.addEventListener('pointermove', (e) => {
      preview(e);
      if (dragging) seekTo(ratio(e) * (media.duration || v.duration));
    });
    scrub?.addEventListener('pointerup', () => {
      dragging = false;
      scrub.classList.remove('is-dragging');
    });
    scrub?.addEventListener('pointerleave', () => {
      dragging = false;
      scrub.classList.remove('is-dragging');
    });

    // volume
    function paintVolume() {
      const muted = media.muted || media.volume === 0;
      if (muteBtn) muteBtn.innerHTML = icon(muted ? 'volume-mute' : 'volume');
      if (volume) volume.value = String(muted ? 0 : media.volume);
    }
    muteBtn?.addEventListener('click', () => {
      if (media.muted || media.volume === 0) {
        media.muted = false;
        media.volume = lastVolume || 1;
      } else {
        lastVolume = media.volume;
        media.muted = true;
      }
      paintVolume();
    });
    volume?.addEventListener('input', () => {
      media.muted = false;
      media.volume = Number(volume.value);
      lastVolume = media.volume;
      paintVolume();
    });
    media.volume = 1;
    paintVolume();

    // captions
    ccBtn?.addEventListener('click', () => {
      ccOn = !ccOn;
      ccBtn.setAttribute('aria-pressed', String(ccOn));
      ccBtn.classList.toggle('icon-btn--active', ccOn);
      if (!ccOn) captions.hidden = true;
      paintCaptions();
      toast(ccOn ? 'Captions on' : 'Captions off');
    });

    // speed
    speedBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      speedMenu.classList.toggle('is-open');
    });
    qsa('[data-speed]', speedMenu || document).forEach((b) =>
      b.addEventListener('click', () => {
        const rate = Number(b.dataset.speed);
        media.playbackRate = rate;
        qsa('[data-speed]', speedMenu).forEach((x) =>
          x.setAttribute('aria-checked', String(x === b)));
        speedMenu.classList.remove('is-open');
        toast(rate === 1 ? 'Normal speed' : rate + '× speed');
      }));

    // theater + fullscreen
    theaterBtn?.addEventListener('click', () => {
      const on = document.body.dataset.theater !== 'on';
      document.body.dataset.theater = on ? 'on' : 'off';
      Store.set('theater', on);
      theaterBtn.classList.toggle('icon-btn--active', on);
    });
    if (Store.get('theater')) {
      document.body.dataset.theater = 'on';
      theaterBtn?.classList.add('icon-btn--active');
    }

    function toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else wrap.requestFullscreen?.().catch(() => toast('Fullscreen is not available here'));
    }
    fsBtn?.addEventListener('click', toggleFullscreen);

    // idle hide
    let idleTimer = null;
    const wake = () => {
      wrap.classList.add('is-active');
      wrap.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!media.paused) {
          wrap.classList.remove('is-active');
          wrap.classList.add('is-idle');
        }
      }, 2600);
    };
    wrap.addEventListener('pointermove', wake);
    wrap.addEventListener('pointerdown', wake);
    wake();

    document.addEventListener('click', () => speedMenu?.classList.remove('is-open'));

    // keyboard
    document.addEventListener('keydown', (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'k' || e.key === ' ' || k === 'spacebar') { e.preventDefault(); toggle(); }
      else if (k === 'j') { e.preventDefault(); nudge(-10); }
      else if (k === 'l') { e.preventDefault(); nudge(10); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-5); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(5); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); media.volume = Math.min(1, media.volume + 0.1); media.muted = false; paintVolume(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); media.volume = Math.max(0, media.volume - 0.1); paintVolume(); }
      else if (k === 'm') { muteBtn?.click(); }
      else if (k === 'f') { toggleFullscreen(); }
      else if (k === 't') { theaterBtn?.click(); }
      else if (k === 'c') { ccBtn?.click(); }
    });

    playerApi = { media, toggle, seekTo };
  }

  /* -- comments ------------------------------------------------------ */

  function initComments(v) {
    const host = byId('comments-list');
    if (!host) return;
    const countEl = byId('comment-count');
    const custom = [];
    let sort = 'top';

    const avatarFor = (name) => {
      const colors = ['#2b5cff', '#8a2be2', '#e0452f', '#0e6b6b', '#b5652b', '#6f5cff'];
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
      return colors[h];
    };

    function baseComments() {
      const hand = D.comments[v.id] || [];
      const filler = D.genericComments.map((c, i) =>
        Object.assign({}, c, { likes: Math.max(4, c.likes - i * 7) }));
      return hand.concat(filler.slice(0, 2));
    }

    function render() {
      const all = custom.concat(baseComments());
      if (sort === 'new') all.reverse();
      countEl.textContent = all.length;
      host.innerHTML = all.map((c) =>
        '<div class="comment">' +
          '<div class="comment__avatar" style="background:' +
            (c.mine ? 'linear-gradient(135deg,#1f4fff,#7b2ff7)' : avatarFor(c.user)) + '">' +
            esc(c.user.slice(0, 1)) + '</div>' +
          '<div class="comment__body">' +
            '<div class="comment__head"><b>' + esc(c.handle || c.user) + '</b><span>' + esc(c.ago || 'just now') + '</span></div>' +
            '<p class="comment__text">' + esc(c.text) + '</p>' +
            '<div class="comment__actions">' +
              '<button type="button" data-like>' + icon('like', 'icon--xs') + '<span>' + count(c.likes || 0) + '</span></button>' +
              '<button type="button" aria-label="Dislike">' + icon('dislike', 'icon--xs') + '</button>' +
              '<button type="button" class="comment__reply">Reply</button>' +
            '</div>' +
          '</div>' +
        '</div>').join('');

      qsa('[data-like]', host).forEach((btn) =>
        btn.addEventListener('click', () => {
          const pressed = btn.getAttribute('aria-pressed') === 'true';
          btn.setAttribute('aria-pressed', String(!pressed));
          const span = qs('span', btn);
          const n = Number(span.textContent.replace(/[^\d.]/g, ''));
          span.textContent = count(pressed ? Math.max(0, n - 1) : n + 1);
        }));
    }

    qsa('[data-sort]').forEach((b) =>
      b.addEventListener('click', () => {
        sort = b.dataset.sort;
        qsa('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        render();
      }));

    byId('comment-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = byId('comment-input');
      const text = input.value.trim();
      if (!text) return;
      custom.unshift({ user: 'You', handle: '@you', text, likes: 0, ago: 'just now', mine: true });
      input.value = '';
      byId('comment-submit').disabled = true;
      render();
      toast('Comment posted');
    });

    const input = byId('comment-input');
    input?.addEventListener('input', () => {
      const btn = byId('comment-submit');
      if (btn) btn.disabled = !input.value.trim();
    });

    byId('comment-submit').disabled = true;
    render();
  }

  /* ---------------------------------------------------------------- channel */

  function initChannel() {
    const slug = params().get('c') || Object.keys(D.channels)[0];
    const ch = channel(slug);
    const host = byId('channel-view');
    if (!ch || !host) return;

    document.title = ch.name + ' — OpenTube';
    const vids = D.videos.filter((v) => v.channel === slug).sort((a, b) => (a.published < b.published ? 1 : -1));
    const totalViews = vids.reduce((n, v) => n + v.views, 0);
    const subscribed = Store.has('subs', slug);

    host.innerHTML =
      '<div class="channel-banner"></div>' +
      '<div class="channel-head">' +
        '<img class="channel-head__avatar" src="' + ch.avatar + '" alt="' + esc(ch.name) + '">' +
        '<div class="channel-head__info">' +
          '<h1 class="channel-head__name">' + esc(ch.name) + '</h1>' +
          '<div class="channel-head__stats"><span>' + esc(ch.handle) + '</span>' +
            '<span class="dot"></span><span>' + count(ch.subscribers) + ' subscribers</span>' +
            '<span class="dot"></span><span>' + vids.length + ' videos</span></div>' +
          '<p class="channel-head__about" id="ch-about">' + esc(ch.about) + ' <button class="channel-head__more" type="button" id="ch-more">...more</button></p>' +
        '</div>' +
        '<div class="channel-actions">' +
          '<button class="btn-pill' + (subscribed ? '' : ' btn-pill--solid') + '" id="ch-sub" type="button">' +
            (subscribed ? 'Subscribed' : 'Subscribe') + '</button>' +
          '<button class="btn-pill" id="ch-join" type="button">Join</button>' +
        '</div>' +
      '</div>' +
      '<div class="channel-tabs" role="tablist" aria-label="Channel sections">' +
        '<button class="channel-tab" role="tab" data-tab="home" aria-selected="true">Home</button>' +
        '<button class="channel-tab" role="tab" data-tab="videos" aria-selected="false">Videos</button>' +
        '<button class="channel-tab" role="tab" data-tab="about" aria-selected="false">About</button>' +
      '</div>' +
      '<div id="channel-tab-body"></div>';

    byId('ch-sub').addEventListener('click', (e) => {
      const nowSubscribed = Store.toggleInList('subs', slug);
      e.currentTarget.textContent = nowSubscribed ? 'Subscribed' : 'Subscribe';
      e.currentTarget.classList.toggle('btn-pill--solid', !nowSubscribed);
      renderSidebar();
      toast(nowSubscribed ? 'Subscribed to ' + ch.name : 'Unsubscribed');
    });
    byId('ch-join').addEventListener('click', () => toast('Memberships are not part of this demo'));
    byId('ch-more').addEventListener('click', (e) => {
      e.currentTarget.closest('.channel-head__about').classList.add('is-open');
      e.currentTarget.remove();
    });

    const body = byId('channel-tab-body');

    function tabHome() {
      body.innerHTML = '';
      const featured = vids[0];
      if (!featured) {
        body.innerHTML = '<div class="empty-state">' + icon('compass') +
          '<h2>No videos yet</h2><p>This channel has not published anything.</p></div>';
        return;
      }
      body.insertAdjacentHTML('beforeend',
        '<div class="section-head"><h2>Latest upload</h2></div>' +
        '<div class="video-grid video-grid--wide" id="ch-feature"></div>');
      qs('#ch-feature').appendChild(card(featured));

      const popular = vids.slice().sort((a, b) => b.views - a.views).slice(0, 4);
      body.insertAdjacentHTML('beforeend',
        '<div class="section-head"><h2>Popular videos</h2></div><div class="video-grid" id="ch-popular"></div>');
      popular.forEach((v) => qs('#ch-popular').appendChild(card(v)));
    }

    function tabVideos() {
      body.innerHTML = '<div class="video-grid" id="ch-all"></div>';
      vids.forEach((v) => qs('#ch-all').appendChild(card(v)));
      if (!vids.length) body.innerHTML = '<div class="empty-state"><h2>No videos</h2></div>';
    }

    function tabAbout() {
      body.innerHTML =
        '<div class="channel-about-grid">' +
          '<div><h3>About</h3><p>' + esc(ch.about) + '</p>' +
            '<div class="section-head"><h2>Links</h2></div>' +
            '<div class="chip-row">' + ch.links.map((l) =>
              '<span class="channel-pill">' + icon('link', 'icon--xs') + esc(l) + '</span>').join('') + '</div>' +
          '</div>' +
          '<div><h3>Stats</h3><dl>' +
            '<div><dt>Joined</dt><dd>' + date(ch.joined) + '</dd></div>' +
            '<div><dt>Location</dt><dd>' + esc(ch.country) + '</dd></div>' +
            '<div><dt>Subscribers</dt><dd>' + count(ch.subscribers) + '</dd></div>' +
            '<div><dt>Total views</dt><dd>' + count(totalViews) + '</dd></div>' +
          '</dl></div>' +
        '</div>';
    }

    const tabs = { home: tabHome, videos: tabVideos, about: tabAbout };
    qsa('.channel-tab').forEach((btn) =>
      btn.addEventListener('click', () => {
        qsa('.channel-tab').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        tabs[btn.dataset.tab]();
      }));

    const initialTab = location.hash.replace('#', '');
    if (tabs[initialTab]) {
      qsa('.channel-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === initialTab)));
      tabs[initialTab]();
    } else {
      tabHome();
    }
  }

  /* ---------------------------------------------------------------- search */

  function initSearch() {
    const q = (params().get('q') || '').trim();
    const host = byId('results');
    if (!host) return;
    const heading = byId('search-heading');
    const countEl = byId('search-count');
    const filters = byId('search-filters');

    if (!q) {
      if (heading) heading.textContent = 'Explore';
      if (countEl) countEl.textContent = 'Browse by topic or search for something specific.';
      if (filters) {
        filters.innerHTML = D.categories.filter((c) => c !== 'All').map((c) =>
          '<a class="chip" href="search.html?q=' + encodeURIComponent(c) + '">' + esc(c) + '</a>').join('');
      }
      D.videos.slice().sort((a, b) => b.views - a.views).slice(0, 8)
        .forEach((v) => host.appendChild(card(v)));
      return;
    }

    document.title = q + ' — OpenTube';
    const needle = q.toLowerCase();
    if (byId('search-input')) byId('search-input').value = q;

    const hits = D.videos.filter((v) => {
      const hay = [v.title, v.desc, v.category, channel(v.channel).name, v.tags.join(' ')]
        .join(' ').toLowerCase();
      return hay.includes(needle);
    });
    const chHits = Object.entries(D.channels)
      .filter(([, c]) => (c.name + ' ' + c.handle + ' ' + c.about).toLowerCase().includes(needle))
      .map(([slug, c]) => Object.assign({ slug }, c));

    if (heading) heading.textContent = 'Results for “' + q + '”';
    if (countEl) countEl.textContent = hits.length + ' videos · ' + chHits.length + ' channels';

    let activeFilter = 'all';
    const FILTERS = [['all', 'All'], ['videos', 'Videos'], ['channels', 'Channels'], ['recent', 'This year']];

    function paintFilters() {
      if (!filters) return;
      filters.innerHTML = FILTERS.map(([k, label]) =>
        '<button class="chip" type="button" data-filter="' + k + '" aria-pressed="' +
        (k === activeFilter) + '">' + label + '</button>').join('');
      qsa('[data-filter]', filters).forEach((b) =>
        b.addEventListener('click', () => {
          activeFilter = b.dataset.filter;
          paint();
        }));
    }

    function paint() {
      paintFilters();
      host.innerHTML = '';

      const mark = (text) => {
        const safe = esc(text);
        const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        return safe.replace(re, '<mark>$1</mark>');
      };

      let list = hits.slice();
      if (activeFilter === 'recent') list = list.filter((v) => new Date(v.published).getFullYear() >= 2026);
      list.sort((a, b) => b.views - a.views);

      if (activeFilter !== 'channels') {
        list.forEach((v) => {
          const ch = channel(v.channel);
          const row = document.createElement('a');
          row.className = 'result';
          row.href = 'watch.html?v=' + v.id;
          row.innerHTML =
            '<span class="result__thumb"><img src="' + v.poster + '" alt="" loading="lazy">' +
              '<span class="card__duration">' + v.durationLabel + '</span></span>' +
            '<span class="result__body">' +
              '<span class="result__title">' + mark(v.title) + '</span>' +
              '<span class="result__meta">' + count(v.views) + ' views<span class="dot"></span>' + ago(v.published) + '</span>' +
              '<span class="result__channel"><img src="' + ch.avatar + '" alt="">' + esc(ch.name) + '</span>' +
              '<span class="result__snippet">' + mark(v.desc) + '</span>' +
            '</span>';
          host.appendChild(row);
        });
      }

      if (activeFilter === 'all' || activeFilter === 'channels') {
        chHits.forEach((c) => {
          const el = document.createElement('a');
          el.className = 'channel-result';
          el.href = 'channel.html?c=' + c.slug;
          el.innerHTML =
            '<img src="' + c.avatar + '" alt="">' +
            '<div><h3>' + mark(c.name) + ' ' + icon('check-badge', 'icon--xs') + '</h3>' +
            '<p>' + esc(c.handle) + ' · ' + count(c.subscribers) + ' subscribers</p>' +
            '<p class="result__snippet">' + mark(c.about) + '</p></div>';
          host.appendChild(el);
        });
      }

      if (!host.querySelector('.result, .channel-result')) {
        host.insertAdjacentHTML('beforeend', '<div class="empty-state">' + icon('search') +
          '<h2>No results</h2><p>Try a different spelling, a broader term, or pick a category chip.</p></div>');
      }
    }

    paint();
  }

  /* ---------------------------------------------------------------- library */

  function initLibrary() {
    const host = byId('library-body');
    if (!host) return;
    const tab = params().get('tab') || 'history';
    qsa('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));

    // Account-backed tabs (subscriptions, liked, imported history) are owned by
    // library-account.js when the data exists; otherwise the demo renders them.
    const account = window.OTLibraryAccount;
    if (account && account.handles(tab)) {
      account.render(tab);
      // The profile arrives after the token; repaint in place rather than
      // making anyone reload the page to see their own subscriptions.
      if (window.OTAuth && window.OTAuth.onChange) {
        window.OTAuth.onChange(() => {
          if (account.handles(tab)) account.render(tab);
        });
      }
      return;
    }

    function rows(list, withDate) {
      if (!list.length) return '';
      return list.map((v) => {
        const meta = withDate ? '' : '';
        return '<div class="history-row">' +
          '<div class="mini-card-wrap" style="flex:1;min-width:0">' + miniCard(v) + '</div>' +
          meta +
          '<button class="icon-btn" type="button" data-remove="' + v.id + '" aria-label="Remove">' +
          icon('close', 'icon--sm') + '</button></div>';
      }).join('');
    }

    function paint() {
      let title = 'History';
      let html = '';
      if (tab === 'history') {
        const entries = Store.get('history').map((h) => ({ v: video(h.id), h })).filter((x) => x.v);
        title = 'Watch history';
        html = entries.length
          ? rows(entries.map((x) => x.v), true)
          : empty('history', 'No watch history yet', 'Videos you watch will show up here, with your position saved.');
      } else if (tab === 'later') {
        const list = Store.get('later').map(video).filter(Boolean);
        title = 'Watch later';
        html = list.length ? rows(list) : empty('clock', 'Nothing saved yet', 'Use the clock icon on any thumbnail to save a video for later.');
      } else if (tab === 'liked') {
        const likes = Store.get('likes');
        const list = Object.keys(likes).filter((id) => likes[id] === 1).map(video).filter(Boolean);
        title = 'Liked videos';
        html = list.length ? rows(list) : empty('like', 'No liked videos', 'Videos you like will be collected here.');
      } else if (tab === 'subs') {
        const list = Store.get('subs').filter(videoChannelExists);
        title = 'Subscriptions';

        html = list.length
          ? '<div class="chip-row">' + list.map((s) => {
              const c = channel(s);
              return '<a class="channel-pill" href="channel.html?c=' + s + '" style="height:44px;padding:0 16px">' +
                '<img src="' + c.avatar + '" alt="" width="28" height="28">' + esc(c.name) + '</a>';
            }).join('') + '</div><div class="section-head"><h2>Latest from your channels</h2></div><div class="video-grid" id="subs-grid"></div>'
          : empty('user', 'No subscriptions', 'Subscribe to a channel and their uploads will appear here.');
      }
      // The offline demo has its own subscriptions; make the real account
      // discoverable too instead of hiding the option behind settings.
      const connected = window.OTLibraryAccount && window.OTLibraryAccount.signedIn();
      if (tab === 'subs' && !connected) {
        const ready = window.OTAuth && window.OTAuth.isConfigured && window.OTAuth.isConfigured();
        html = '<div class="panel__note" style="margin-bottom:16px">' + icon('user', 'icon--xs') +
          ' Want the subscriptions from your YouTube account? ' +
          (ready
            ? '<button type="button" class="link-btn" id="library-connect">Connect Google</button>'
            : '<a href="settings.html#account">Connect Google</a>') +
          ' — read-only access, stored in this browser.</div>' + html;
      }

      byId('library-title').textContent = title;
      host.innerHTML = html;

      const connectBtn = byId('library-connect');
      if (connectBtn) {
        ['pointerenter', 'focusin'].forEach((evt) =>
          connectBtn.addEventListener(evt, () => window.OTAuth.warm(), { once: true }));
        connectBtn.addEventListener('click', () => {
          const account = window.OTLibraryAccount;
          connectBtn.disabled = true;
          connectBtn.textContent = 'Opening Google…';
          window.OTAuth.signIn()
            .then(() => {
              notify('Signed in — loading your YouTube subscriptions.', { tone: 'ok' });
              if (account && account.signedIn()) account.render(tab);
            })
            .catch((err) => {
              connectBtn.disabled = false;
              connectBtn.textContent = 'Connect Google';
              notify(err.message || 'Sign-in failed.', { tone: 'error' });
            });
        });
      }
      if (tab === 'subs' && Store.get('subs').length) {
        const grid = byId('subs-grid');
        D.videos.filter((v) => Store.has('subs', v.channel))
          .sort((a, b) => (a.published < b.published ? 1 : -1))
          .forEach((v) => grid.appendChild(card(v)));
      }
      qsa('[data-remove]', host).forEach((btn) =>
        btn.addEventListener('click', () => {
          const id = btn.dataset.remove;
          if (tab === 'history') {
            Store.set('history', Store.get('history').filter((h) => h.id !== id));
          } else if (tab === 'later') {
            Store.set('later', Store.get('later').filter((x) => x !== id));
          } else if (tab === 'liked') {
            const likes = Object.assign({}, Store.get('likes'));
            delete likes[id];
            Store.set('likes', likes);
          }
          paint();
          toast('Removed');
        }));
    }

    function empty(ic, heading, body) {
      return '<div class="empty-state">' + icon(ic) + '<h2>' + heading + '</h2><p>' + body + '</p>' +
        '<a class="btn-pill btn-pill--solid" href="index.html">Browse videos</a></div>';
    }

    paint();
  }

  /* ---------------------------------------------------------------- boot */

  function boot() {
    Store.load();
    applyTheme();
    applySidebar();
    renderSidebar();
    initHeader();
    document.body.dataset.theater = Store.get('theater') ? 'on' : 'off';

    const page = document.body.dataset.page;
    const done = () => {
      // Explicit readiness flag: window.OT exists as soon as this file is parsed,
      // which is before boot() has rendered anything.
      window.OT.ready = true;
      document.documentElement.dataset.booted = 'true';
    };

    // Live YouTube mode owns the feed/search/channel pages and live watch pages.
    const live = window.OTLive;
    if (live) {
      live.init();
      if (live.claims(page)) {
        live.intercept(page);
        done();
        return;
      }
    }

    if (page === 'home') initHome();
    if (page === 'watch') initWatch();
    if (page === 'channel') initChannel();
    if (page === 'search') initSearch();
    if (page === 'library') initLibrary();
    done();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // expose a small surface for debugging in the console
  window.OT = {
    Store,
    videos: D.videos,
    channels: D.channels,
    toast,
    notify,
    seek: (s) => playerApi && playerApi.seekTo(s),
    ready: false,
  };
})();

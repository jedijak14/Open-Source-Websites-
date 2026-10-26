/**
 * On-device recommendation model for OpenTube.
 *
 * The site cannot ask YouTube what you watch — the Data API does not expose
 * watch history — and it cannot write signals back to YouTube. So the model is
 * built here, in the browser, from what actually happens:
 *
 *   • what you watch and how much of it (completion, skips, re-watches)
 *   • likes, dislikes, saves and subscriptions
 *   • a Google Takeout watch-history import
 *   • the account you sign in with (subscriptions, liked videos)
 *
 * That profile is stored per account, so signing in with a YouTube account
 * brings its taste with it and signing out returns to the anonymous profile.
 * Nothing is uploaded anywhere; there is no server to upload it to.
 *
 * Exposes window.OTRec.
 */
(function (global) {
  'use strict';

  const STORE_PREFIX = 'opentube:rec:';
  const ANON = 'anon';
  const HALF_LIFE_DAYS = 30;
  const MAX_VIDEOS = 400;
  const MAX_KEYS = 80;

  let activeKey = ANON;
  let profile = null;
  const listeners = new Set();

  /* ------------------------------------------------------------ storage */

  function ls() {
    try {
      const store = global.localStorage;
      store.setItem('__probe__', '1');
      store.removeItem('__probe__');
      return store;
    } catch (err) {
      return null;
    }
  }

  function blank() {
    return {
      v: 1,
      updated: 0,
      channels: {},
      categories: {},
      tags: {},
      videos: {},
      sources: { watch: 0, takeout: 0, account: 0 },
    };
  }

  function sanitise(raw) {
    const base = blank();
    if (!raw || typeof raw !== 'object') return base;
    ['channels', 'categories', 'tags', 'videos'].forEach((section) => {
      base[section] = (raw[section] && typeof raw[section] === 'object') ? raw[section] : {};
    });
    base.updated = Number(raw.updated) || 0;
    base.sources = Object.assign(base.sources, raw.sources || {});
    return base;
  }

  function keyFor(accountKey) {
    return STORE_PREFIX + (accountKey || ANON);
  }

  function load(key) {
    const store = ls();
    if (!store) return blank();
    try {
      return sanitise(JSON.parse(store.getItem(keyFor(key)) || 'null'));
    } catch (err) {
      return blank();
    }
  }

  function save() {
    const store = ls();
    profile.updated = Date.now();
    if (!store) return false;
    try {
      store.setItem(keyFor(activeKey), JSON.stringify(profile));
      return true;
    } catch (err) {
      return false;
    }
  }

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn(profile);
      } catch (err) {
        /* a listener must never break recommendations */
      }
    });
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /* ------------------------------------------------------------ helpers */

  const daysSince = (ts) => Math.max(0, (Date.now() - (Number(ts) || Date.now())) / 86400000);

  /** Exponential decay so a channel from last week outranks one from last year. */
  function decay(ts) {
    return Math.pow(0.5, daysSince(ts) / HALF_LIFE_DAYS);
  }

  /** Squash an unbounded weight into [-1, 1] so one binge cannot dominate. */
  function squash(weight) {
    if (!Number.isFinite(weight)) return 0;
    return weight / (1 + Math.abs(weight));
  }

  function bump(section, key, amount, at) {
    if (!key) return;
    const current = profile[section][key] || { w: 0, n: 0, last: 0 };
    // Decay what is already there before adding, so stale taste fades instead
    // of accumulating forever.
    const carried = current.w * decay(current.last || at);
    profile[section][key] = {
      w: carried + amount,
      n: (current.n || 0) + (amount > 0 ? 1 : 0),
      last: at || Date.now(),
    };
  }

  function prune(section) {
    const entries = Object.entries(profile[section]);
    if (entries.length <= MAX_KEYS) return;
    entries
      .sort((a, b) => Math.abs(a[1].w) - Math.abs(b[1].w))
      .slice(0, entries.length - MAX_KEYS)
      .forEach(([key]) => { delete profile[section][key]; });
  }

  function pruneVideos() {
    const entries = Object.entries(profile.videos);
    if (entries.length <= MAX_VIDEOS) return;
    entries
      .sort((a, b) => (a[1].at || 0) - (b[1].at || 0))
      .slice(0, entries.length - MAX_VIDEOS)
      .forEach(([id]) => { delete profile.videos[id]; });
  }

  /* ------------------------------------------------------------ profile */

  function get() {
    if (!profile) profile = load(activeKey);
    return profile;
  }

  function hasSignals() {
    const p = get();
    return Object.keys(p.channels).length > 0 || Object.keys(p.categories).length > 0;
  }

  function signalCount() {
    const p = get();
    return Object.keys(p.videos).length +
      Object.keys(p.channels).length +
      Object.keys(p.categories).length;
  }

  /**
   * Switches the active profile. Used when someone signs in (their account gets
   * its own taste, seeded with whatever was learned anonymously) or out.
   */
  function useAccount(accountKey, options) {
    const next = accountKey || ANON;
    if (next === activeKey && profile) return profile;
    const previous = get();
    activeKey = next;
    profile = load(activeKey);
    const seed = options && options.seedFromAnonymous;

    if (seed && next !== ANON) {
      // First sign-in on this device: keep what the browser already learned.
      const anon = load(ANON);
      if (Object.keys(anon.channels).length || Object.keys(anon.categories).length) {
        mergeInto(profile, anon, 0.8);
        save();
      }
    } else if (next === ANON && options && options.retain === false) {
      profile = blank();
      save();
    }
    if (!profile.updated) profile.updated = previous.updated || Date.now();
    emit();
    return profile;
  }

  /** Adds one profile's weights into another (used for the anon → account seed). */
  function mergeInto(target, source, scale) {
    ['channels', 'categories', 'tags'].forEach((section) => {
      Object.entries(source[section] || {}).forEach(([key, value]) => {
        const current = target[section][key] || { w: 0, n: 0, last: 0 };
        target[section][key] = {
          w: current.w + value.w * (scale || 1) * decay(value.last),
          n: (current.n || 0) + (value.n || 0),
          last: Math.max(current.last || 0, value.last || 0),
        };
      });
    });
    Object.entries(source.videos || {}).forEach(([id, value]) => {
      if (!target.videos[id]) target.videos[id] = value;
    });
    target.sources.watch += (source.sources && source.sources.watch) || 0;
    target.sources.takeout += (source.sources && source.sources.takeout) || 0;
    target.sources.account += (source.sources && source.sources.account) || 0;
  }

  /* ------------------------------------------------------------ learning */

  const VIDEO_KEYS = ['id', 'channel', 'category', 'tags'];

  /**
   * Records one interaction. `video` is the catalogue entry (or a live-mode
   * stand-in with id/channelName/category/tags).
   */
  function record(type, video, extra) {
    if (!video) return get();
    const p = get();
    const at = Date.now();
    const opts = extra || {};
    const channel = video.channel || video.channelSlug || video.channelName || '';
    const category = video.category || '';
    const tags = Array.isArray(video.tags) ? video.tags : [];

    let amount = 0;
    switch (type) {
      case 'complete': amount = 1; break;
      case 'watch': {
        // Partial watches count in proportion; bailing out early is a (small)
        // negative signal rather than nothing at all.
        const fraction = Number(opts.fraction);
        if (!Number.isFinite(fraction)) amount = 0.5;
        else if (fraction >= 0.85) amount = 1;
        else if (fraction >= 0.25) amount = fraction;
        else amount = -0.3;
        break;
      }
      case 'skip': amount = -0.45; break;
      case 'like': amount = 0.7; break;
      case 'dislike': amount = -1; break;
      case 'save': amount = 0.4; break;
      case 'subscribe': amount = 0.9; break;
      case 'unsubscribe': amount = -0.6; break;
      default: amount = 0;
    }
    if (!amount) return p;

    bump('channels', channel, amount, at);
    bump('categories', category, amount * 0.55, at);
    tags.slice(0, 6).forEach((tag) => bump('tags', String(tag).toLowerCase(), amount * 0.4, at));

    const watched = Number(opts.watched) || 0;
    const duration = Number(opts.duration) || 0;
    const previous = p.videos[video.id] || { repeats: 0 };
    p.videos[video.id] = {
      pos: Math.round(watched),
      dur: Math.round(duration),
      completed: type === 'complete' || (duration > 0 && watched / duration >= 0.85),
      skipped: type === 'skip' || (duration > 0 && watched > 0 && watched / duration < 0.1),
      at,
      repeats: (previous.repeats || 0) + (type === 'watch' || type === 'complete' ? 1 : 0),
    };

    if (type === 'watch' || type === 'complete') p.sources.watch += 1;

    prune('channels');
    prune('categories');
    prune('tags');
    pruneVideos();
    save();
    emit();
    return p;
  }

  /**
   * Folds a Google Takeout export in. The export only carries channel *names*,
   * so callers pass the site's channel table (slug → {name, category}) to map
   * "Analog Autopsy" onto the slug the feed actually ranks by.
   */
  function mergeTakeout(entries, catalogue, channels) {
    const p = get();
    const at = Date.now();
    const byName = {};

    Object.entries(channels || {}).forEach(([slug, channel]) => {
      if (!channel || !channel.name) return;
      byName[String(channel.name).toLowerCase()] = {
        key: slug,
        name: channel.name,
        category: channel.category || '',
        tags: [],
      };
    });

    (catalogue || []).forEach((video) => {
      const name = String(video.channelName || video.channel || '').toLowerCase();
      if (!name || byName[name]) return;
      byName[name] = {
        key: video.channel || video.channelSlug || name,
        name: video.channelName || video.channel,
        category: video.category || '',
        tags: video.tags || [],
      };
    });

    let applied = 0;
    (entries || []).slice(0, 2000).forEach((entry, index) => {
      const when = entry.time ? Date.parse(entry.time) : NaN;
      // Takeout is newest-first; fall back to position for undated rows.
      const age = Number.isFinite(when) ? daysSince(when) : index / 4;
      const weight = 0.6 * Math.pow(0.5, age / 60);
      if (weight < 0.02) return;
      const match = byName[String(entry.channel || '').toLowerCase()];
      if (match) {
        bump('channels', match.key, weight, at);
        if (match.name && match.name !== match.key) bump('channels', match.name, weight * 0.5, at);
        if (match.category) bump('categories', match.category, weight * 0.55, at);
        (match.tags || []).slice(0, 4).forEach((tag) => bump('tags', String(tag).toLowerCase(), weight * 0.3, at));
        applied += 1;
      }
      if (entry.videoId) {
        const existing = p.videos[entry.videoId];
        p.videos[entry.videoId] = {
          pos: existing ? existing.pos : 0,
          dur: existing ? existing.dur : 0,
          completed: existing ? existing.completed : true,
          skipped: false,
          at: Number.isFinite(when) ? when : at - index * 3600000,
          repeats: ((existing && existing.repeats) || 0) + 1,
          imported: true,
        };
      }
    });
    p.sources.takeout += applied;
    prune('channels');
    prune('categories');
    pruneVideos();
    save();
    emit();
    return applied;
  }

  /**
   * Folds a signed-in YouTube account in: subscriptions are the strongest
   * statement of taste a read-only API can give us, liked videos next.
   */
  function mergeAccount(account) {
    if (!account) return 0;
    const p = get();
    const at = Date.now();
    let applied = 0;

    (account.subscriptions || []).forEach((sub) => {
      const key = sub.channelId || sub.id || sub.name;
      if (!key) return;
      // Strong, but not overwhelming: subscribing is deliberate, so it is
      // weighted above a single watch and below a like.
      bump('channels', key, 0.8, at);
      bump('channels', sub.name, 0.4, at);
      applied += 1;
    });

    (account.liked || []).forEach((video) => {
      const key = video.channelSlug || video.channel || video.channelName;
      if (key) bump('channels', key, 0.6, at);
      if (video.category) bump('categories', video.category, 0.35, at);
      (video.tags || []).slice(0, 4).forEach((tag) => bump('tags', String(tag).toLowerCase(), 0.25, at));
      if (video.videoId || video.id) {
        // Prefer the raw YouTube id so account signals line up with Takeout rows.
        const id = video.videoId || video.id;
        if (!p.videos[id]) {
          p.videos[id] = { pos: 0, dur: 0, completed: true, skipped: false, at, repeats: 1, imported: true };
        }
      }
      applied += 1;
    });

    p.sources.account += applied;
    prune('channels');
    prune('categories');
    save();
    emit();
    return applied;
  }

  /* ------------------------------------------------------------ ranking */

  function channelWeight(video) {
    const p = get();
    const keys = [video.channel, video.channelSlug, video.channelName].filter(Boolean);
    return keys.reduce((best, key) => {
      const entry = p.channels[key];
      if (!entry) return best;
      const value = entry.w * decay(entry.last);
      return Math.abs(value) > Math.abs(best) ? value : best;
    }, 0);
  }

  function categoryWeight(video) {
    const entry = get().categories[video.category];
    return entry ? entry.w * decay(entry.last) : 0;
  }

  function tagWeight(video) {
    const tags = Array.isArray(video.tags) ? video.tags.slice(0, 6) : [];
    if (!tags.length) return 0;
    const p = get();
    const total = tags.reduce((sum, tag) => {
      const entry = p.tags[String(tag).toLowerCase()];
      return sum + (entry ? entry.w * decay(entry.last) : 0);
    }, 0);
    return total / tags.length;
  }

  /** Stable per-day jitter: variety without the feed reshuffling on every paint. */
  function jitter(id) {
    const day = Math.floor(Date.now() / 86400000);
    let hash = 2166136261 ^ day;
    const text = String(id || '');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000) / 1000;
  }

  function freshness(video) {
    if (!video.published) return 0.3;
    const days = daysSince(Date.parse(video.published));
    if (!Number.isFinite(days)) return 0.3;
    return Math.exp(-days / 120);
  }

  function score(video) {
    const p = get();
    const seen = p.videos[video.id];
    const channel = squash(channelWeight(video));
    const category = squash(categoryWeight(video));
    const tags = squash(tagWeight(video));

    let value =
      channel * 0.50 +
      category * 0.24 +
      tags * 0.14 +
      freshness(video) * 0.12 +
      jitter(video.id) * 0.06;

    if (seen) {
      // Already watched: nudged down so fresh uploads get their turn, but not
      // so far that the channel you watch stops showing up at all.
      value -= seen.completed ? 0.22 : 0.08;
      if (seen.skipped) value -= 0.18;
      if ((seen.repeats || 0) > 1) value += 0.08;
    }
    return value;
  }

  /** Ranks a catalogue copy; never mutates the input order. */
  function rank(videos, options) {
    const opts = options || {};
    const scored = (videos || []).map((video) => ({ video, score: score(video) }));
    scored.sort((a, b) => (b.score - a.score) || String(a.video.id).localeCompare(String(b.video.id)));
    if (opts.withScores) return scored;
    return scored.map((entry) => entry.video);
  }

  /** A short, human explanation for why something is in the feed. */
  function reasonFor(video) {
    const p = get();
    const keys = [video.channel, video.channelSlug, video.channelName].filter(Boolean);
    const channelKey = keys.find((key) => p.channels[key]);
    if (channelKey && channelWeight(video) > 0) {
      const entry = p.channels[channelKey];
      const label = entry && entry.n > 1 ? 'you keep watching' : 'you watched';
      return 'Because ' + label + ' ' + (video.channelName || video.channel || channelKey);
    }
    if (categoryWeight(video) > 0 && video.category) return 'More ' + video.category + ' like your history';
    const tag = (video.tags || []).find((t) => p.tags[String(t).toLowerCase()]);
    if (tag) return 'Because you watch ' + tag + ' videos';
    if (p.videos[video.id]) return 'From your watch history';
    return '';
  }

  /** The strongest signals the model has, for the Settings page. */
  function top(limit) {
    const p = get();
    const n = limit || 5;
    const list = (filter) => Object.entries(filter)
      .map(([key, entry]) => ({ key, weight: entry.w * decay(entry.last || 0), count: entry.n || 0 }))
      .filter((entry) => entry.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, n);
    return {
      channels: list(p.channels),
      categories: list(p.categories),
      tags: list(p.tags),
      watched: Object.keys(p.videos).length,
      sources: p.sources,
      updated: p.updated,
      scope: activeKey,
    };
  }

  function reset() {
    profile = blank();
    save();
    emit();
    return profile;
  }

  global.OTRec = {
    get,
    hasSignals,
    signalCount,
    record,
    rank,
    score,
    reasonFor,
    mergeTakeout,
    mergeAccount,
    top,
    reset,
    onChange,
    useAccount,
    // exported for tests
    _internal: { decay, squash, blank, sanitise, keyFor, settings: { HALF_LIFE_DAYS, VIDEO_KEYS } },
    get scope() { return activeKey; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

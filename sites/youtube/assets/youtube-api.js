/**
 * YouTube Data API v3 client — no dependencies, no build step.
 *
 * Exposes window.OTYouTube. Every response is normalised into the same shape the
 * rest of the site already uses (see assets/data.js), so live data and the
 * offline demo dataset can be rendered by the same markup.
 *
 * Notes
 * - The API key is kept in localStorage and only ever sent to googleapis.com.
 * - GET responses are cached in sessionStorage for 10 minutes to save quota:
 *   `search.list` costs 100 units per call, everything else costs 1.
 * - Errors are surfaced as ApiError with a `reason` and a human message, so the
 *   UI can explain a quota or key problem instead of failing silently.
 */
(function (global) {
  'use strict';

  const BASE = 'https://www.googleapis.com/youtube/v3';
  const KEY_STORAGE = 'opentube:youtube-key';
  const CACHE_STORAGE = 'opentube:youtube-cache';
  const CACHE_TTL = 10 * 60 * 1000;
  const CACHE_MAX_ENTRIES = 60;

  class ApiError extends Error {
    constructor(message, info) {
      super(message);
      this.name = 'ApiError';
      info = info || {};
      this.status = info.status || 0;
      this.reason = info.reason || 'unknown';
      this.endpoint = info.endpoint || '';
    }
  }

  /* ------------------------------------------------------------ storage */

  function storage(kind) {
    try {
      return global[kind] || null;
    } catch (err) {
      return null;
    }
  }

  function getKey() {
    const ls = storage('localStorage');
    if (!ls) return '';
    try {
      return ls.getItem(KEY_STORAGE) || '';
    } catch (err) {
      return '';
    }
  }

  function setKey(key) {
    const ls = storage('localStorage');
    if (!ls) return false;
    try {
      if (key) ls.setItem(KEY_STORAGE, String(key).trim());
      else ls.removeItem(KEY_STORAGE);
      clearCache();
      return true;
    } catch (err) {
      return false;
    }
  }

  function hasKey() {
    return getKey().length > 0;
  }

  function clearCache() {
    const ss = storage('sessionStorage');
    try {
      ss && ss.removeItem(CACHE_STORAGE);
    } catch (err) {
      /* ignore */
    }
  }

  function readCache() {
    const ss = storage('sessionStorage');
    if (!ss) return {};
    try {
      return JSON.parse(ss.getItem(CACHE_STORAGE) || '{}');
    } catch (err) {
      return {};
    }
  }

  function cacheGet(url) {
    const hit = readCache()[url];
    if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
    return null;
  }

  function cacheSet(url, value) {
    const ss = storage('sessionStorage');
    if (!ss) return;
    try {
      const all = readCache();
      all[url] = { t: Date.now(), v: value };
      const urls = Object.keys(all);
      if (urls.length > CACHE_MAX_ENTRIES) {
        urls.sort((a, b) => all[a].t - all[b].t)
          .slice(0, urls.length - CACHE_MAX_ENTRIES)
          .forEach((u) => delete all[u]);
      }
      ss.setItem(CACHE_STORAGE, JSON.stringify(all));
    } catch (err) {
      /* quota or disabled storage — caching is best effort */
    }
  }

  /* ------------------------------------------------------------- errors */

  const REASONS = {
    quotaExceeded: 'The API quota for this key is used up. The free daily allowance is 10,000 units ' +
      'and a single search costs 100, so try again after midnight Pacific time.',
    dailyLimitExceeded: 'This key hit its daily quota. Try again after midnight Pacific time, or use another key.',
    keyInvalid: 'That API key was rejected. Check it was copied whole and that YouTube Data API v3 is enabled.',
    keyExpired: 'That API key has expired.',
    accessNotConfigured: 'YouTube Data API v3 is not enabled for this key’s project. Enable it in Google Cloud Console.',
    ipRefererBlocked: 'This key is restricted to other referrers. Add this site’s origin (or localhost) to the key’s HTTP referrer restrictions.',
    forbidden: 'This key is not allowed to make that request. Check its API and referrer restrictions.',
    badRequest: 'The request was rejected as invalid.',
    notFound: 'That video or channel is not available through the API.',
    videoNotFound: 'That video is not available through the API — it may be private, deleted or region-blocked.',
    commentsDisabled: 'Comments are turned off for this video.',
    network: 'Could not reach the YouTube API. Check your connection, or any extension blocking googleapis.com.',
    missingKey: 'Add a YouTube Data API v3 key to load live data.',
  };

  function friendlyError(body, status) {
    const err = body && body.error;
    const reason = (err && err.errors && err.errors[0] && err.errors[0].reason) || '';
    if (REASONS[reason]) return REASONS[reason];
    if (status === 401 || status === 403) return REASONS.forbidden;
    if (err && err.message) return err.message;
    return 'The YouTube API returned HTTP ' + status + '.';
  }

  /* ------------------------------------------------------------ request */

  function buildUrl(endpoint, params) {
    const url = new URL(BASE + '/' + endpoint);
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    url.searchParams.set('key', getKey());
    return url.toString();
  }

  async function request(endpoint, params) {
    if (!hasKey()) throw new ApiError(REASONS.missingKey, { reason: 'missingKey', endpoint });

    const url = buildUrl(endpoint, params);
    const cached = cacheGet(url);
    if (cached) return cached;

    const fetcher = global.fetch;
    if (typeof fetcher !== 'function') {
      throw new ApiError('This browser cannot make API requests (no fetch).', { reason: 'network', endpoint });
    }

    let response;
    try {
      response = await fetcher(url, { headers: { Accept: 'application/json' } });
    } catch (err) {
      throw new ApiError(REASONS.network, { reason: 'network', endpoint });
    }

    let body = null;
    try {
      body = await response.json();
    } catch (err) {
      body = null;
    }

    if (!response.ok) {
      const reason = body && body.error && body.error.errors && body.error.errors[0]
        ? body.error.errors[0].reason : 'http' + response.status;
      throw new ApiError(friendlyError(body, response.status), {
        status: response.status,
        reason,
        endpoint,
      });
    }

    cacheSet(url, body);
    return body;
  }

  /* ------------------------------------------------------------- helpers */

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

  function decodeEntities(text) {
    return String(text || '').replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
      if (ENTITIES[code]) return ENTITIES[code];
      if (ENTITIES[code.toLowerCase()]) return ENTITIES[code.toLowerCase()];
      if (code[0] === '#') {
        const num = code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
        if (Number.isFinite(num)) return String.fromCodePoint(num);
      }
      return match;
    });
  }

  /** PT1H2M3S (and the M/S-only forms) → seconds */
  function isoDurationToSeconds(value) {
    const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ''));
    if (!match) return 0;
    const [, d, h, m, s] = match;
    return (Number(d || 0) * 86400) + (Number(h || 0) * 3600) + (Number(m || 0) * 60) + Number(s || 0);
  }

  function clock(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (v) => String(v).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function relativeTime(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const days = Math.max(1, Math.round((Date.now() - then) / 86400000));
    if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
    if (days < 30) {
      const w = Math.round(days / 7);
      return `${w} week${w > 1 ? 's' : ''} ago`;
    }
    if (days < 365) {
      const m = Math.round(days / 30);
      return `${m} month${m > 1 ? 's' : ''} ago`;
    }
    const y = Math.floor(days / 365);
    return `${y} year${y > 1 ? 's' : ''} ago`;
  }

  function isoDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function pickThumb(thumbs, prefer) {
    const order = prefer || ['maxres', 'standard', 'high', 'medium', 'default'];
    for (const size of order) {
      if (thumbs && thumbs[size] && thumbs[size].url) return thumbs[size].url;
    }
    return '';
  }

  /* ------------------------------------------------------------ mapping */

  function mapVideo(item) {
    const snippet = item.snippet || {};
    const stats = item.statistics || {};
    const details = item.contentDetails || {};
    const seconds = isoDurationToSeconds(details.duration);
    const videoId = typeof item.id === 'string' ? item.id : item.id && item.id.videoId;
    if (!videoId) return null;

    return {
      kind: 'yt',
      id: 'yt:' + videoId,
      videoId,
      title: decodeEntities(snippet.title || 'Untitled'),
      description: decodeEntities(snippet.description || ''),
      published: snippet.publishedAt || '',
      publishedLabel: relativeTime(snippet.publishedAt),
      poster: pickThumb(snippet.thumbnails),
      duration: seconds,
      durationLabel: seconds ? clock(seconds) : '',
      views: Number(stats.viewCount || 0),
      likes: Number(stats.likeCount || 0),
      channelId: snippet.channelId || '',
      channelName: decodeEntities(snippet.channelTitle || ''),
      channelSlug: 'ytc:' + (snippet.channelId || ''),
      tags: (snippet.tags || []).slice(0, 6),
      category: 'Live',
      url: 'watch.html?v=yt:' + videoId,
      watchUrl: 'https://www.youtube.com/watch?v=' + videoId,
    };
  }

  function mapChannel(item) {
    const snippet = item.snippet || {};
    const stats = item.statistics || {};
    const content = item.contentDetails || {};
    return {
      kind: 'yt',
      id: 'ytc:' + item.id,
      channelId: item.id,
      name: decodeEntities(snippet.title || 'Unknown channel'),
      handle: snippet.customUrl ? (snippet.customUrl[0] === '@' ? snippet.customUrl : '@' + snippet.customUrl) : '',
      avatar: pickThumb(snippet.thumbnails, ['high', 'medium', 'default']),
      about: decodeEntities(snippet.description || ''),
      subscribers: Number(stats.subscriberCount || 0),
      videoCount: Number(stats.videoCount || 0),
      views: Number(stats.viewCount || 0),
      joined: snippet.publishedAt || '',
      country: snippet.country || '',
      uploads: content.relatedPlaylists && content.relatedPlaylists.uploads ? content.relatedPlaylists.uploads : '',
      url: 'channel.html?c=ytc:' + item.id,
    };
  }

  /* --------------------------------------------------------------- API */

  /** Cheapest possible call (1 unit) — used to validate a key. */
  async function testConnection() {
    const body = await request('videos', {
      part: 'snippet',
      chart: 'mostPopular',
      maxResults: 1,
      regionCode: 'US',
    });
    const first = (body.items || [])[0];
    return { ok: true, sample: first ? decodeEntities(first.snippet.title) : '' };
  }

  async function popular(options) {
    options = options || {};
    const body = await request('videos', {
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      maxResults: options.maxResults || 24,
      regionCode: options.regionCode || 'US',
      videoCategoryId: options.categoryId || '',
    });
    return (body.items || []).map(mapVideo).filter(Boolean);
  }

  async function videosByIds(ids) {
    const list = (ids || []).filter(Boolean).slice(0, 50);
    if (!list.length) return [];
    const body = await request('videos', {
      part: 'snippet,contentDetails,statistics',
      id: list.join(','),
      maxResults: 50,
    });
    const mapped = (body.items || []).map(mapVideo).filter(Boolean);
    // preserve the caller's ordering (search results arrive ranked)
    const order = new Map(list.map((id, i) => [id, i]));
    return mapped.sort((a, b) => (order.get(a.videoId) || 0) - (order.get(b.videoId) || 0));
  }

  async function searchVideos(query, options) {
    options = options || {};
    const body = await request('search', {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: options.maxResults || 20,
      order: options.order || 'relevance',
      safeSearch: 'moderate',
      videoEmbeddable: options.embeddable === false ? '' : 'true',
    });
    const ids = (body.items || [])
      .map((item) => item.id && item.id.videoId)
      .filter(Boolean);
    if (!ids.length) return [];
    return videosByIds(ids);
  }

  async function searchChannels(query, options) {
    options = options || {};
    const body = await request('search', {
      part: 'snippet',
      q: query,
      type: 'channel',
      maxResults: options.maxResults || 5,
      safeSearch: 'moderate',
    });
    const ids = (body.items || []).map((item) => item.id && item.id.channelId).filter(Boolean);
    if (!ids.length) return [];
    return channelsByIds(ids);
  }

  async function channelsByIds(ids) {
    const list = (ids || []).filter(Boolean).slice(0, 50);
    if (!list.length) return [];
    const body = await request('channels', {
      part: 'snippet,statistics,contentDetails',
      id: list.join(','),
      maxResults: 50,
    });
    return (body.items || []).map(mapChannel);
  }

  /**
   * Accepts a channel id (UC…), a handle (@name / name), or a channel URL.
   * forHandle is 1 unit; the search fallback costs 100, so it is only used
   * when the input is not already an id or handle.
   */
  async function resolveChannel(input) {
    const raw = String(input || '').trim();
    if (!raw) throw new ApiError('Give a channel id, handle or name.', { reason: 'badRequest' });

    const urlMatch = /youtube\.com\/(?:channel\/([\w-]+)|@([\w.-]+))/i.exec(raw);
    const idCandidate = urlMatch && urlMatch[1] ? urlMatch[1] : (/^UC[\w-]{20,}$/.test(raw) ? raw : '');
    const handleCandidate = urlMatch && urlMatch[2] ? '@' + urlMatch[2]
      : (/^@[\w.-]+$/.test(raw) ? raw : '');

    if (idCandidate) {
      const found = await channelsByIds([idCandidate]);
      if (found.length) return found[0];
    }
    if (handleCandidate) {
      try {
        const body = await request('channels', {
          part: 'snippet,statistics,contentDetails',
          forHandle: handleCandidate,
        });
        const first = (body.items || [])[0];
        if (first) return mapChannel(first);
      } catch (err) {
        // forHandle is unavailable on older keys — fall through to search
        if (err.reason === 'quotaExceeded' || err.reason === 'dailyLimitExceeded') throw err;
      }
    }
    const results = await searchChannels(raw, { maxResults: 1 });
    if (results.length) return results[0];
    throw new ApiError('No channel matched “' + raw + '”.', { reason: 'notFound' });
  }

  async function channelUploads(channelId, options) {
    options = options || {};
    const body = await request('channels', {
      part: 'contentDetails',
      id: channelId,
      maxResults: 1,
    });
    const channel = (body.items || [])[0];
    const uploads = channel && channel.contentDetails
      && channel.contentDetails.relatedPlaylists
      && channel.contentDetails.relatedPlaylists.uploads;
    if (!uploads) return [];

    const playlist = await request('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploads,
      maxResults: options.maxResults || 24,
    });
    const ids = (playlist.items || [])
      .map((item) => item.contentDetails && item.contentDetails.videoId)
      .filter(Boolean);
    if (!ids.length) return [];
    return videosByIds(ids);
  }

  async function comments(videoId, options) {
    options = options || {};
    const body = await request('commentThreads', {
      part: 'snippet',
      videoId,
      maxResults: options.maxResults || 20,
      order: options.order === 'new' ? 'time' : 'relevance',
      textFormat: 'plainText',
    });
    return (body.items || []).map((item) => {
      const top = (item.snippet && item.snippet.topLevelComment && item.snippet.topLevelComment.snippet) || {};
      return {
        user: decodeEntities(top.authorDisplayName || 'Someone'),
        handle: '@' + decodeEntities(top.authorDisplayName || 'someone').replace(/\s+/g, '').toLowerCase(),
        avatar: (top.authorProfileImageUrl || '').replace(/=s\d+[^/]*$/, '=s48-c'),
        text: decodeEntities(top.textDisplay || ''),
        likes: Number(top.likeCount || 0),
        ago: relativeTime(top.publishedAt),
      };
    });
  }

  global.OTYouTube = {
    ApiError,
    // configuration
    getKey,
    setKey,
    hasKey,
    clearCache,
    // endpoints
    testConnection,
    popular,
    videosByIds,
    searchVideos,
    searchChannels,
    channelsByIds,
    resolveChannel,
    channelUploads,
    comments,
    // helpers (exported so the tests can pin the edge cases)
    mapVideo,
    mapChannel,
    decodeEntities,
    isoDurationToSeconds,
    relativeTime,
    isoDate,
    clock,
    buildUrl,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

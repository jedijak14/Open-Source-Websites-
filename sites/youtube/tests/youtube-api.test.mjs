/**
 * Tests for assets/youtube-api.js (YouTube Data API v3 client).
 *
 * The sandbox has no route to googleapis.com, so these run against a stub
 * `fetch` that records every request. That lets us pin the parts that are easy
 * to get wrong without a network: URL construction, normalisation of the API
 * payload, quota/key error messages, request ordering and response caching.
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'assets', 'youtube-api.js'), 'utf8');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const dom = new JSDOM('<!doctype html><body></body>', {
  url: 'http://localhost:4321/',
  runScripts: 'outside-only',
});
const { window } = dom;
window.eval(source);
const API = window.OTYouTube;

/* ------------------------------------------------------------------ stub */

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function stubFetch(handler) {
  const calls = [];
  window.fetch = async (url) => {
    calls.push(url);
    return handler(new URL(url), calls.length);
  };
  return calls;
}

/* --------------------------------------------------------------- fixtures */

const VIDEO_A = {
  id: 'dQw4w9WgXcQ',
  snippet: {
    title: 'Coffee &amp; Code &#39;live&#39;',
    description: 'A demo description',
    channelId: 'UC12345678901234567890',
    channelTitle: 'Test Channel',
    publishedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    thumbnails: {
      medium: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mq.jpg' },
      maxres: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxres.jpg' },
    },
    tags: ['demo'],
  },
  contentDetails: { duration: 'PT4M13S' },
  statistics: { viewCount: '1234567', likeCount: '8901' },
};

const VIDEO_B = {
  id: 'abc123XYZ_-',
  snippet: {
    title: 'Second video',
    description: '',
    channelId: 'UC12345678901234567890',
    channelTitle: 'Test Channel',
    publishedAt: new Date(Date.now() - 400 * 86400000).toISOString(),
    thumbnails: { high: { url: 'https://i.ytimg.com/vi/abc/hq.jpg' } },
  },
  contentDetails: { duration: 'PT1H2M3S' },
  statistics: { viewCount: '42' },
};

const CHANNEL = {
  id: 'UC12345678901234567890',
  snippet: {
    title: 'Test Channel',
    description: 'About this channel',
    customUrl: '@testchannel',
    publishedAt: '2015-05-05T00:00:00Z',
    country: 'GB',
    thumbnails: { high: { url: 'https://yt3.ggpht.com/avatar=s800' } },
  },
  statistics: { subscriberCount: '1500000', videoCount: '321', viewCount: '99999999' },
  contentDetails: { relatedPlaylists: { uploads: 'UU12345678901234567890' } },
};

/* ----------------------------------------------------------------- tests */

API.setKey('TEST_KEY_123');

check('config: key stored', API.hasKey() && API.getKey() === 'TEST_KEY_123');

// -- pure helpers
check('duration: PT4M13S', API.isoDurationToSeconds('PT4M13S') === 253, String(API.isoDurationToSeconds('PT4M13S')));
check('duration: PT1H2M3S', API.isoDurationToSeconds('PT1H2M3S') === 3723);
check('duration: PT45S', API.isoDurationToSeconds('PT45S') === 45);
check('duration: PT2H', API.isoDurationToSeconds('PT2H') === 7200);
check('duration: garbage is 0', API.isoDurationToSeconds('nonsense') === 0);
check('clock: under an hour', API.clock(253) === '4:13', API.clock(253));
check('clock: over an hour', API.clock(3723) === '1:02:03', API.clock(3723));
check('entities: decoded', API.decodeEntities('Coffee &amp; Code &#39;live&#39;') === "Coffee & Code 'live'",
  API.decodeEntities('Coffee &amp; Code &#39;live&#39;'));
check('entities: numeric hex', API.decodeEntities('&#x41;') === 'A');
check('relative: weeks', /week/.test(API.relativeTime(new Date(Date.now() - 20 * 86400000).toISOString())));

// -- URL construction
const built = new URL(API.buildUrl('videos', { part: 'snippet', maxResults: 5, videoCategoryId: '' }));
check('url: endpoint', built.pathname === '/youtube/v3/videos', built.pathname);
check('url: key attached', built.searchParams.get('key') === 'TEST_KEY_123');
check('url: empty params dropped', !built.searchParams.has('videoCategoryId'));
check('url: numbers stringified', built.searchParams.get('maxResults') === '5');

// -- popular(): normalisation
{
  const calls = stubFetch(() => jsonResponse({ items: [VIDEO_A, VIDEO_B] }));
  const videos = await API.popular({ regionCode: 'GB', maxResults: 2 });
  const url = new URL(calls[0]);
  check('popular: requests chart=mostPopular', url.searchParams.get('chart') === 'mostPopular');
  check('popular: passes region', url.searchParams.get('regionCode') === 'GB');
  check('popular: asks for stats + duration', url.searchParams.get('part') === 'snippet,contentDetails,statistics');
  check('popular: maps both items', videos.length === 2);
  check('popular: decodes title', videos[0].title === "Coffee & Code 'live'", videos[0].title);
  check('popular: prefers maxres poster', /maxres\.jpg$/.test(videos[0].poster), videos[0].poster);
  check('popular: duration label', videos[0].durationLabel === '4:13', videos[0].durationLabel);
  check('popular: hour-long label', videos[1].durationLabel === '1:02:03', videos[1].durationLabel);
  check('popular: numeric views', videos[0].views === 1234567);
  check('popular: internal id prefixed', videos[0].id === 'yt:dQw4w9WgXcQ', videos[0].id);
  check('popular: channel slug', videos[0].channelSlug === 'ytc:UC12345678901234567890');
  check('popular: watch url', videos[0].url === 'watch.html?v=yt:dQw4w9WgXcQ');
  check('popular: published label', /days ago|week/.test(videos[0].publishedLabel), videos[0].publishedLabel);

  // -- caching: an identical call must not hit the network again
  const before = calls.length;
  await API.popular({ regionCode: 'GB', maxResults: 2 });
  check('cache: repeat call served locally', calls.length === before, `${calls.length - before} extra fetches`);
}

// -- searchVideos(): two-step hydration, order preserved
{
  const calls = stubFetch((url) => {
    if (url.pathname.endsWith('/search')) {
      return jsonResponse({ items: [
        { id: { videoId: 'abc123XYZ_-' } },
        { id: { videoId: 'dQw4w9WgXcQ' } },
      ] });
    }
    return jsonResponse({ items: [VIDEO_A, VIDEO_B] });
  });
  const videos = await API.searchVideos('coffee', { maxResults: 2 });
  const searchUrl = new URL(calls[0]);
  const detailUrl = new URL(calls[1]);
  check('search: hits search.list first', searchUrl.searchParams.get('type') === 'video');
  check('search: requests embeddable videos', searchUrl.searchParams.get('videoEmbeddable') === 'true');
  check('search: hydrates via videos.list', detailUrl.searchParams.get('id') === 'abc123XYZ_-,dQw4w9WgXcQ',
    detailUrl.searchParams.get('id'));
  check('search: keeps API ranking', videos.map((v) => v.videoId).join(',') === 'abc123XYZ_-,dQw4w9WgXcQ',
    videos.map((v) => v.videoId).join(','));
  check('search: two requests total', calls.length === 2);
}

// -- resolveChannel()
{
  const calls = stubFetch(() => jsonResponse({ items: [CHANNEL] }));
  const channel = await API.resolveChannel('UC12345678901234567890');
  check('channel: resolved by id', channel.channelId === 'UC12345678901234567890');
  check('channel: no search needed for ids', calls.length === 1, calls.length + ' calls');
  check('channel: handle normalised', channel.handle === '@testchannel', channel.handle);
  check('channel: subscribers numeric', channel.subscribers === 1500000);
  check('channel: uploads playlist', channel.uploads === 'UU12345678901234567890');
  check('channel: internal id', channel.id === 'ytc:UC12345678901234567890');
}

{
  const calls = stubFetch(() => jsonResponse({ items: [CHANNEL] }));
  await API.resolveChannel('@testchannel');
  check('channel: handle uses forHandle', new URL(calls[0]).searchParams.get('forHandle') === '@testchannel',
    new URL(calls[0]).searchParams.get('forHandle'));
}

{
  API.clearCache();
  const calls = stubFetch((url) => {
    if (url.pathname.endsWith('/channels')) return jsonResponse({ items: [CHANNEL] });
    return jsonResponse({ items: [{ id: { channelId: 'UC12345678901234567890' } }] });
  });
  const channel = await API.resolveChannel('some random name');
  check('channel: falls back to search', channel.channelId === 'UC12345678901234567890');
  check('channel: search fallback is 2 requests', calls.length === 2, calls.length + '');
  check('channel: fallback starts with search.list', new URL(calls[0]).pathname.endsWith('/search'),
    new URL(calls[0]).pathname);
}

{
  // documents the cache behaviour the previous test tripped over
  API.clearCache();
  const calls = stubFetch(() => jsonResponse({ items: [CHANNEL] }));
  await API.channelsByIds(['UC12345678901234567890']);
  await API.channelsByIds(['UC12345678901234567890']);
  check('cache: channels.list deduplicated', calls.length === 1, calls.length + ' fetches');
}

// -- channelUploads(): channel → playlist → videos
{
  const calls = stubFetch((url) => {
    if (url.pathname.endsWith('/channels')) return jsonResponse({ items: [CHANNEL] });
    if (url.pathname.endsWith('/playlistItems')) {
      return jsonResponse({ items: [
        { contentDetails: { videoId: 'dQw4w9WgXcQ' } },
        { contentDetails: { videoId: 'abc123XYZ_-' } },
      ] });
    }
    return jsonResponse({ items: [VIDEO_A, VIDEO_B] });
  });
  const uploads = await API.channelUploads('UC12345678901234567890', { maxResults: 2 });
  check('uploads: three requests', calls.length === 3, calls.length + '');
  check('uploads: uses the uploads playlist', new URL(calls[1]).searchParams.get('playlistId') === 'UU12345678901234567890');
  check('uploads: returns videos', uploads.length === 2);
}

// -- comments()
{
  stubFetch(() => jsonResponse({ items: [{
    snippet: { topLevelComment: { snippet: {
      authorDisplayName: 'Sam &amp; Co',
      authorProfileImageUrl: 'https://yt3.ggpht.com/x=s176-c-k-c0x00ffffff',
      textDisplay: 'Great <b>video</b>',
      likeCount: 12,
      publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    } } },
  }] }));
  const comments = await API.comments('dQw4w9WgXcQ');
  check('comments: decodes author', comments[0].user === 'Sam & Co', comments[0].user);
  check('comments: plain-text body kept', comments[0].text === 'Great <b>video</b>');
  check('comments: avatar downsized', comments[0].avatar === 'https://yt3.ggpht.com/x=s48-c', comments[0].avatar);
  check('comments: likes numeric', comments[0].likes === 12);
}

// -- error handling
{
  stubFetch(() => jsonResponse({ error: { errors: [{ reason: 'quotaExceeded' }], message: 'quota' } }, 403));
  let err = null;
  try {
    await API.searchVideos('expensive');
  } catch (e) {
    err = e;
  }
  check('error: quota reason captured', err && err.reason === 'quotaExceeded', err && err.reason);
  check('error: quota message is actionable', /quota/i.test(err && err.message), err && err.message);
  check('error: status captured', err && err.status === 403);
}

{
  stubFetch(() => jsonResponse({ error: { errors: [{ reason: 'keyInvalid' }] } }, 400));
  let err = null;
  try {
    await API.popular({});
  } catch (e) {
    err = e;
  }
  check('error: invalid key explained', /key/i.test(err && err.message), err && err.message);
}

{
  window.fetch = async () => { throw new Error('ENOTFOUND'); };
  let err = null;
  try {
    await API.testConnection();
  } catch (e) {
    err = e;
  }
  check('error: network failure is friendly', err && err.reason === 'network' && /reach/i.test(err.message),
    err && err.message);
}

{
  API.setKey('');
  let err = null;
  try {
    await API.popular({});
  } catch (e) {
    err = e;
  }
  check('error: missing key reported', err && err.reason === 'missingKey', err && err.reason);
  check('config: clearing key empties it', !API.hasKey());
}

/* ---------------------------------------------------------------- report */

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  → ' + r.detail : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;

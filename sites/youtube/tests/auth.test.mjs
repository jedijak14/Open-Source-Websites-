/**
 * Tests for assets/auth.js — Google sign-in plumbing and the Takeout importer.
 *
 * Google Identity Services is stubbed (the sandbox cannot reach
 * accounts.google.com), which lets us exercise the token lifecycle, the
 * actionable error messages and the two Takeout file formats.
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authSource = await readFile(path.join(root, 'assets', 'auth.js'), 'utf8');
const apiSource = await readFile(path.join(root, 'assets', 'youtube-api.js'), 'utf8');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

function makeWindow() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://opentube.example/',
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.eval(apiSource);
  window.eval(authSource);
  return window;
}

const window = makeWindow();
const AUTH = window.OTAuth;

/* ---------------------------------------------------------- client id */

check('client: absent by default', AUTH.getClientId() === '' && !AUTH.isSignedIn());
AUTH.setClientId('  123-abc.apps.googleusercontent.com  ');
check('client: id trimmed and stored', AUTH.getClientId() === '123-abc.apps.googleusercontent.com',
  AUTH.getClientId());

/* -------------------------------------------------- sign-in guard rails */

{
  let err = null;
  const fresh = makeWindow();
  try {
    await fresh.OTAuth.signIn();
  } catch (e) {
    err = e;
  }
  check('signin: requires a client id first', err && err.reason === 'missingClientId', err && err.reason);
  check('signin: message points at settings', /client id/i.test(err && err.message), err && err.message);
}

/* ------------------------------------------------------- happy path */

{
  const w = makeWindow();
  w.OTAuth.setClientId('client-1.apps.googleusercontent.com');
  let requestedScope = '';
  // stub GIS + the account endpoints
  w.google = {
    accounts: {
      oauth2: {
        initTokenClient(config) {
          requestedScope = config.scope;
          return {
            requestAccessToken() {
              setTimeout(() => config.callback({ access_token: 'ya29.TEST' }), 0);
            },
          };
        },
        revoke(token, cb) { w.__revoked = token; cb && cb(); },
      },
    },
  };
  w.OTYouTube.setKey('k');
  const calls = [];
  w.fetch = async (url, init) => {
    calls.push({ url: String(url), auth: init && init.headers && init.headers.Authorization });
    if (String(url).includes('/channels')) {
      return { ok: true, status: 200, json: async () => ({ items: [{
        id: 'UCme', snippet: { title: 'My Channel', customUrl: '@me', thumbnails: { high: { url: 'a.jpg' } } },
        statistics: { subscriberCount: '12', videoCount: '3' },
        contentDetails: {},
      }] }) };
    }
    if (String(url).includes('/subscriptions')) {
      return { ok: true, status: 200, json: async () => ({ items: [
        { snippet: { title: 'Sub One', resourceId: { channelId: 'UCsub1' }, thumbnails: { high: { url: 's1.jpg' } } } },
      ] }) };
    }
    if (String(url).includes('myRating=like')) {
      return { ok: true, status: 200, json: async () => ({ items: [{
        id: 'vid1', snippet: { title: 'Liked vid', channelId: 'UCsub1', channelTitle: 'Sub One',
          publishedAt: new Date().toISOString(), thumbnails: { high: { url: 'l.jpg' } } },
        contentDetails: { duration: 'PT2M' }, statistics: { viewCount: '5', likeCount: '1' },
      }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  };

  const profile = await w.OTAuth.signIn();
  check('signin: requests the readonly YouTube scope',
    requestedScope === 'https://www.googleapis.com/auth/youtube.readonly', requestedScope);
  check('signin: signed in after callback', w.OTAuth.isSignedIn());
  check('signin: profile loaded', profile && profile.channel && profile.channel.name === 'My Channel',
    profile && profile.channel && profile.channel.name);
  check('signin: subscriptions fetched', profile.subscriptions.length === 1 &&
    profile.subscriptions[0].name === 'Sub One', JSON.stringify(profile.subscriptions));
  check('signin: liked videos fetched', profile.liked.length === 1 &&
    profile.liked[0].title === 'Liked vid');
  check('signin: requests carry the bearer token',
    calls.every((c) => c.auth === 'Bearer ya29.TEST'), JSON.stringify(calls.map((c) => c.auth)));
  check('signin: token persisted for reloads',
    !!w.sessionStorage.getItem('opentube:google-token'));

  const before = w.OTAuth.state.profile;
  w.OTAuth.signOut();
  check('signout: state cleared', !w.OTAuth.isSignedIn() && w.OTAuth.state.profile === null);
  check('signout: api token cleared', !w.OTYouTube.hasAccessToken());
  check('signout: token revoked with Google', w.__revoked === 'ya29.TEST', w.__revoked);
  check('signout: storage cleared', !w.sessionStorage.getItem('opentube:google-token'));
  check('signout: previous profile existed', !!before);
}

/* ------------------------------------------------------ denied / blocked */

{
  const w = makeWindow();
  w.OTAuth.setClientId('client-2.apps.googleusercontent.com');
  const types = ['popup_closed', 'popup_failed_to_open', 'access_denied'];
  for (const type of types) {
    w.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({
      requestAccessToken: () => setTimeout(() => cfg.error_callback({ type }), 0),
    }) } } };
    let err = null;
    try {
      await w.OTAuth.signIn();
    } catch (e) {
      err = e;
    }
    check('signin: explains ' + type, err && err.message && err.message.length > 10, err && err.message);
    check('signin: stays signed out after ' + type, !w.OTAuth.isSignedIn());
  }
}

/* ------------------------------------------------------------ takeout */

const JSON_EXPORT = JSON.stringify([
  {
    header: 'YouTube',
    title: 'Watched Building a compiler from scratch',
    titleUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    subtitles: [{ name: 'nullbyte', url: 'https://www.youtube.com/channel/UC1' }],
    time: '2026-09-01T18:04:05.123Z',
    products: ['YouTube'],
    activityControls: ['YouTube watch history'],
  },
  {
    header: 'YouTube',
    title: 'Watched an advertisement',
    titleUrl: 'https://www.youtube.com/watch?v=adadadadada',
    time: '2026-09-01T18:10:00.000Z',
    products: ['YouTube'],
    details: [{ name: 'From Google Ads' }],
  },
  {
    header: 'YouTube',
    title: 'Watched A deleted video',
    titleUrl: 'https://www.youtube.com/watch?v=deleted12345',
    time: '2026-08-30T09:00:00.000Z',
    subtitles: [{ name: 'Someone' }],
    products: ['YouTube'],
  },
  {
    header: 'YouTube',
    title: 'Watched Building a compiler from scratch',
    titleUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    time: '2026-08-20T09:00:00.000Z',
    subtitles: [{ name: 'nullbyte' }],
    products: ['YouTube'],
  },
  { header: 'YouTube', title: 'Searched for keyboards', products: ['YouTube'] },
]);

{
  const parsed = AUTH.parseTakeout(JSON_EXPORT, 'json');
  check('takeout: reads watched videos', parsed.length === 2, parsed.length + ' entries');
  check('takeout: strips the "Watched " prefix', parsed[0].title === 'Building a compiler from scratch',
    parsed[0].title);
  check('takeout: extracts the video id', parsed[0].videoId === 'aaaaaaaaaaa', parsed[0].videoId);
  check('takeout: keeps the channel', parsed[0].channel === 'nullbyte');
  check('takeout: keeps the timestamp', parsed[0].time === '2026-09-01T18:04:05.123Z');
  check('takeout: filters Google Ads entries',
    !parsed.some((e) => e.videoId === 'adadadadada'), JSON.stringify(parsed.map((e) => e.videoId)));
  check('takeout: drops searches without a video', !parsed.some((e) => /keyboard/.test(e.title)));
  check('takeout: deduplicates the same watch', parsed.filter((e) => e.videoId === 'aaaaaaaaaaa').length === 1);
}

const HTML_EXPORT = `<!doctype html><html><body>
<div class="outer-cell mdl-cell--12-col">
  <div class="content-cell mdl-cell--12-col">
    <a href="https://www.youtube.com/watch?v=bbbbbbbbbbb">Watched A quiet walking tour</a>
    <br>Sep 2, 2026, 8:15:00 PM UTC
  </div>
</div>
<div class="outer-cell mdl-cell--12-col">
  <div class="content-cell mdl-cell--12-col">
    <a href="https://www.youtube.com/watch?v=ccccccccccc">Watched Synth restoration</a>
    <br>Sep 1, 2026, 7:00:00 PM UTC
  </div>
</div>
</body></html>`;

{
  const parsed = AUTH.parseTakeout(HTML_EXPORT, 'html');
  check('takeout html: finds both entries', parsed.length === 2, parsed.length + '');
  check('takeout html: ids and titles', parsed[0].videoId === 'bbbbbbbbbbb' &&
    parsed[0].title === 'A quiet walking tour', parsed[0] && parsed[0].title);
}

{
  let err = null;
  try {
    AUTH.parseTakeout('{not json', 'json');
  } catch (e) {
    err = e;
  }
  check('takeout: malformed JSON explained', err && /watch-history\.json/.test(err.message), err && err.message);
}

/* ------------------------------------------------------------- import */

{
  const w = makeWindow();
  const file = {
    name: 'watch-history.json',
    size: JSON_EXPORT.length,
    text: async () => JSON_EXPORT,
  };
  const result = await w.OTAuth.importTakeout(file);
  check('import: reports the entry count', result.entries === 2, String(result.entries));
  check('import: history persisted', w.OTAuth.history.entries.length === 2);
  check('import: records an import time', !!w.OTAuth.history.importedAt);

  let err = null;
  try {
    await w.OTAuth.importTakeout({ name: 'notes.json', size: 10, text: async () => '{"foo":1}' });
  } catch (e) {
    err = e;
  }
  check('import: empty export explained', err && /watch-history/.test(err.message), err && err.message);

  w.OTAuth.clearHistory();
  check('import: clear removes history', w.OTAuth.history.entries.length === 0);
}

/* ------------------------------------------------------------- report */

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  → ' + r.detail : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;

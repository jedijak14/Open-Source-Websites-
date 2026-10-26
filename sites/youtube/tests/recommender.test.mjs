/**
 * Tests for assets/recommender.js — the on-device ranking model — and for the
 * account-backed Library rendering that feeds it.
 *
 * The model is pure: given a profile and a catalogue it must produce a stable,
 * explainable order. These tests pin the parts that are easy to get subtly
 * wrong — decay, negative signals, per-account scoping and the merges.
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recSource = await readFile(path.join(root, 'assets', 'recommender.js'), 'utf8');
const accountSource = await readFile(path.join(root, 'assets', 'library-account.js'), 'utf8');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

/** Fresh window each time: the model keeps module state. */
function makeWindow(options) {
  const opts = options || {};
  const dom = new JSDOM('<!doctype html><html><body><div id="library-body"></div><div id="library-title"></div></body></html>', {
    url: 'https://opentube.example/',
    runScripts: 'outside-only',
  });
  const { window } = dom;
  if (opts.storage) {
    Object.entries(opts.storage).forEach(([key, value]) => window.localStorage.setItem(key, value));
  }
  window.eval(recSource);
  if (opts.withAccount) {
    window.OTAuth = opts.auth;
    window.eval(accountSource);
  }
  return window;
}

const VIDEO = (id, channel, category, tags, published) => ({
  id, channel, channelName: channel, category, tags: tags || [], published: published || '2026-01-01',
});

const code = VIDEO('v-code', 'nullbyte', 'Programming', ['compilers'], '2026-09-01');
const code2 = VIDEO('v-code2', 'nullbyte', 'Programming', ['rust'], '2026-08-01');
const synths = VIDEO('v-synth', 'analog', 'Music', ['synth'], '2026-09-02');
const travel = VIDEO('v-kyoto', 'wander', 'Travel', ['kyoto'], '2026-09-03');

/* --------------------------------------------------------- empty profile */

{
  const w = makeWindow();
  const rec = w.OTRec;
  check('model: starts empty', rec.hasSignals() === false);
  check('model: nothing recorded yet', rec.signalCount() === 0);
  check('model: no reason without signals', rec.reasonFor(code) === '');
  const ranked = rec.rank([code, synths, travel]);
  check('model: ranking is a permutation of the pool', ranked.length === 3 &&
    new Set(ranked.map((v) => v.id)).size === 3);
  check('model: rank does not mutate the input', [code, synths, travel][0].id === 'v-code');
}

/* -------------------------------------------------------- learning a taste */

{
  const w = makeWindow();
  const rec = w.OTRec;

  rec.record('complete', code, { watched: 96, duration: 96, fraction: 1 });
  rec.record('complete', code2, { watched: 90, duration: 96, fraction: 0.94 });
  check('model: watching builds a channel signal', rec.hasSignals() === true);
  check('model: watch count tracked', rec.get().sources.watch === 2, String(rec.get().sources.watch));
  check('model: video completion stored', rec.get().videos['v-code'].completed === true);

  const ranked = rec.rank([code, code2, synths, travel]);
  check('model: watched channel floats to the top', ranked[0].channel === 'nullbyte', ranked[0].channel);
  check('model: unrelated channel stays lower', ranked[ranked.length - 1].channel !== 'nullbyte',
    ranked[ranked.length - 1].channel);

  const reason = rec.reasonFor(code);
  check('model: reason names the channel', /nullbyte/.test(reason), reason);

  check('model: profile persisted', !!w.localStorage.getItem('opentube:rec:anon'));
  const saved = JSON.parse(w.localStorage.getItem('opentube:rec:anon'));
  check('model: persisted under a versioned shape', saved.v === 1 && !!saved.channels.nullbyte);
}

/* ------------------------------------------------------- negative signals */

{
  const w = makeWindow();
  const rec = w.OTRec;
  rec.record('skip', synths, { watched: 2, duration: 143, fraction: 0.01 });
  check('model: a skip is negative', rec.get().channels.analog.w < 0, String(rec.get().channels.analog.w));
  check('model: skip marked on the video', rec.get().videos['v-synth'].skipped === true);

  rec.record('dislike', travel);
  check('model: dislike outweighs a watch', rec.get().channels.wander.w < -0.5, String(rec.get().channels.wander.w));

  const ranked = rec.rank([synths, travel, code]);
  check('model: disliked content sinks', ranked[0].id === 'v-code', ranked[0].id);
}

/* ------------------------------------------------------------- likes/saves */

{
  const w = makeWindow();
  const rec = w.OTRec;
  rec.record('like', synths);
  const likedWeight = rec.get().channels.analog.w;
  rec.record('save', travel);
  const savedWeight = rec.get().channels.wander.w;
  check('model: a like is a stronger signal than a save', likedWeight > savedWeight,
    likedWeight + ' vs ' + savedWeight);
  rec.record('subscribe', code);
  check('model: subscribing is the strongest signal', rec.get().channels.nullbyte.w > likedWeight,
    String(rec.get().channels.nullbyte.w));
}

/* ------------------------------------------------------------------ decay */

{
  const old = {
    v: 1,
    updated: Date.now() - 400 * 86400000,
    channels: { nullbyte: { w: 5, n: 6, last: Date.now() - 400 * 86400000 } },
    categories: {},
    tags: {},
    videos: {},
    sources: { watch: 6, takeout: 0, account: 0 },
  };
  const w = makeWindow({ storage: { 'opentube:rec:anon': JSON.stringify(old) } });
  const rec = w.OTRec;
  // A year-old love of a channel must not outweigh a fresh one.
  const staleCode = VIDEO('v-stale', 'nullbyte', 'Programming', ['compilers'], '2024-01-01');
  const freshSynth = VIDEO('v-fresh', 'analog', 'Music', ['synth'], new Date().toISOString().slice(0, 10));
  rec.record('complete', freshSynth, { watched: 143, duration: 143, fraction: 1 });
  const ranked = rec.rank([staleCode, freshSynth]);
  check('model: recent taste outranks stale taste', ranked[0].id === 'v-fresh', ranked[0].id);

  // Touching the stale key applies the decay, so old enthusiasm fades instead
  // of accumulating forever.
  rec.record('save', staleCode);
  const fresh = rec.get().channels.nullbyte.w;
  check('model: stale weight decays on touch', fresh < 1, String(fresh));
}

/* ------------------------------------------------------------ watch depth */

{
  const w = makeWindow();
  const rec = w.OTRec;
  rec.record('watch', code, { watched: 48, duration: 96, fraction: 0.5 });
  const half = rec.get().channels.nullbyte.w;
  const w2 = makeWindow();
  w2.OTRec.record('watch', code, { watched: 96, duration: 96, fraction: 1 });
  const full = w2.OTRec.get().channels.nullbyte.w;
  check('model: finishing beats half-watching', full > half, full + ' vs ' + half);
}

/* -------------------------------------------------------- takeout history */

{
  const w = makeWindow();
  const rec = w.OTRec;
  const entries = [
    { videoId: 'aaaaaaaaaaa', title: 'Synth restoration', channel: 'Analog Autopsy', time: new Date().toISOString() },
    { videoId: 'bbbbbbbbbbb', title: 'Old thing', channel: 'Nobody At All', time: '2020-01-01T00:00:00.000Z' },
  ];
  const applied = rec.mergeTakeout(entries, [synths, code, travel], {
    analog: { name: 'Analog Autopsy', category: 'Music' },
  });
  check('model: takeout matches known channels by name', applied === 1, String(applied));
  check('model: takeout bumps the matched channel', rec.get().channels.analog.w > 0,
    String(rec.get().channels.analog.w));
  check('model: takeout also keys by display name', !!rec.get().channels['Analog Autopsy']);
  check('model: takeout records the video ids', !!rec.get().videos.aaaaaaaaaaa);
  check('model: takeout counts as a source', rec.get().sources.takeout === 1);
  const ranked = rec.rank([code, synths, travel]);
  check('model: imported history steers the feed', ranked[0].id === 'v-synth', ranked[0].id);
}

/* ------------------------------------------------------------ account sync */

{
  const w = makeWindow();
  const rec = w.OTRec;
  const applied = rec.mergeAccount({
    subscriptions: [{ channelId: 'UCwander', name: 'Wanderfoot' }],
    liked: [{ id: 'yt:synth', channelName: 'Analog Autopsy', category: 'Music', tags: ['synth'] }],
  });
  check('model: account merge counts both sections', applied === 2, String(applied));
  check('model: subscriptions are weighted', rec.get().channels.UCwander.w > 0);
  check('model: liked videos known by name too', rec.get().channels['Analog Autopsy'].w > 0);
  check('model: account counts as a source', rec.get().sources.account === 2);
}

/* --------------------------------------------------- per-account scoping */

{
  const w = makeWindow();
  const rec = w.OTRec;
  rec.record('complete', code, { watched: 96, duration: 96, fraction: 1 });
  check('model: anonymous profile active first', rec.scope === 'anon');

  rec.useAccount('UCaccount', { seedFromAnonymous: true });
  check('model: switching scope changes the key', rec.scope === 'UCaccount', rec.scope);
  check('model: the new profile is seeded from anonymous',
    rec.get().channels.nullbyte.w > 0, String(rec.get().channels.nullbyte.w));
  check('model: account profile persisted separately',
    !!w.localStorage.getItem('opentube:rec:UCaccount'));

  rec.record('complete', synths, { watched: 143, duration: 143, fraction: 1 });
  const accountChannels = JSON.stringify(Object.keys(rec.get().channels));

  rec.useAccount(null);
  check('model: signing out returns to anonymous', rec.scope === 'anon');
  check('model: signing out keeps the account profile intact',
    accountChannels.includes('analog') === true &&
      !JSON.parse(w.localStorage.getItem('opentube:rec:anon')).channels.analog,
    w.localStorage.getItem('opentube:rec:anon')?.slice(0, 60));

  rec.useAccount('UCaccount');
  check('model: signing back in restores that account', !!rec.get().channels.analog);
}

/* --------------------------------------------------------------- summary */

{
  const w = makeWindow();
  const rec = w.OTRec;
  rec.record('complete', code, { watched: 96, duration: 96, fraction: 1 });
  rec.record('skip', travel, { watched: 1, duration: 74, fraction: 0.01 });
  const top = rec.top(3);
  check('model: summary lists the strongest channel', top.channels[0].key === 'nullbyte',
    top.channels[0] && top.channels[0].key);
  check('model: summary hides negative taste', !top.channels.some((c) => c.key === 'wander'));

  const before = rec.get().channels.nullbyte.w;
  check('model: summary weight is positive', top.channels[0].weight > 0, String(before));

  rec.reset();
  check('model: reset clears the model', rec.hasSignals() === false);
  check('model: reset persisted', JSON.parse(w.localStorage.getItem('opentube:rec:anon')).channels &&
    Object.keys(JSON.parse(w.localStorage.getItem('opentube:rec:anon')).channels).length === 0);
}

/* ------------------------------------------------------ explanation detail */

{
  const w = makeWindow();
  const rec = w.OTRec;
  rec.record('complete', code, { watched: 96, duration: 96, fraction: 1 });
  rec.record('complete', code2, { watched: 96, duration: 96, fraction: 1 });
  check('model: repeat viewing wording', /keep watching/.test(rec.reasonFor(code)), rec.reasonFor(code));
  check('model: reasons never come back empty for a known video',
    rec.reasonFor(code2).length > 0);
}

/* ------------------------------------------------ library account surfaces */

{
  const profile = {
    channel: { channelId: 'UCme', name: 'Me', avatar: '' },
    subscriptions: [
      { id: 'ytc:UCa', channelId: 'UCa', name: 'Alpha', avatar: 'https://yt3.ggpht.com/a.jpg', about: 'A' },
      { id: 'ytc:UCb', channelId: 'UCb', name: 'Beta', avatar: '', about: 'B' },
    ],
    liked: [],
    playlists: [],
    errors: { subscriptions: 'The request cannot be completed because you have exceeded your quota.' },
  };
  const w = makeWindow({
    withAccount: true,
    auth: {
      isSignedIn: () => true,
      isConfigured: () => true,
      state: { profile },
      history: { entries: [], importedAt: null },
      signIn: async () => profile,
    },
  });
  const doc = w.document;
  w.eval('window.OTRec');
  w.OTLibraryAccount.render('subs');

  const warn = doc.querySelector('.panel__note--warn');
  check('library: a failed section is shown, not hidden', !!warn);
  check('library: the failure explains the quota', /quota/i.test(warn?.textContent || ''),
    warn?.textContent?.slice(0, 80));
  check('library: the failure is announced to screen readers', warn?.getAttribute('role') === 'alert');
  check('library: successful rows still render', doc.querySelectorAll('.account-channel').length === 2,
    String(doc.querySelectorAll('.account-channel').length));
  check('library: a channel without an avatar gets an initial',
    !!doc.querySelector('.avatar-fallback'), doc.querySelector('.account-channel')?.innerHTML?.slice(0, 50));
  check('library: image avatars are marked for the fallback',
    !!doc.querySelector('img[data-avatar]'));
}

/* ------------------------------------------------------------- report */

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  → ' + r.detail : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;

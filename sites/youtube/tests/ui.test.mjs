/**
 * Browser-level smoke tests for OpenTube.
 *
 * Boots the real static server on a scratch port, loads every page in jsdom with
 * scripts enabled, then drives the UI: category filtering, subscribing, liking,
 * captions, theater mode, posting a comment, searching, and restoring saved state
 * from localStorage. Any uncaught script error fails the run.
 *
 *   npm install && npm test        (devDependency: jsdom)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.TEST_PORT || 4399);
const BASE = `http://127.0.0.1:${PORT}/`;

const SEED = {
  subs: ['abyss'],
  later: ['v-lofi'],
  likes: { 'v-abyss': 1 },
  history: [{ id: 'v-abyss', pos: 60, at: Date.now() }],
  theme: 'dark',
  sidebar: 'full',
  theater: false,
  autoplay: true,
};

const results = [];
let server;

function polyfills(window) {
  window.matchMedia = window.matchMedia || ((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  }));
  window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () {};
  window.HTMLMediaElement.prototype.load = function () {};
  window.HTMLElement.prototype.requestFullscreen = function () { return Promise.resolve(); };
  window.scrollTo = () => {};
}

async function load(page, seed) {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
  vc.on('error', (...args) => errors.push('console.error: ' + args.join(' ')));
  const dom = await JSDOM.fromURL(BASE + page, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      polyfills(window);
      if (seed) window.localStorage.setItem('opentube:v1', JSON.stringify(seed));
    },
  });
  // app.js assigns window.OT only after boot() has finished rendering, so this
  // is a reliable "page is ready" signal — no fixed sleeps to race against.
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && !dom.window.OT) {
    await new Promise((r) => setTimeout(r, 25));
  }
  if (!dom.window.OT) {
    errors.push('boot timeout: window.OT was never assigned');
  }
  return { dom, doc: dom.window.document, win: dom.window, errors };
}

async function settle(predicate, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (predicate()) return true;
    } catch (err) { /* predicate ran against a half-rendered DOM; retry */ }
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
}

async function run() {
  // ------------------------------------------------------------------ home
  {
    const { doc, win, errors } = await load('index.html');
    const cards = doc.querySelectorAll('#feed-grid .card').length;
    check('home: feed renders 18 cards', cards === 18, cards + ' cards');
    check('home: 9 category chips', doc.querySelectorAll('#chips .chip').length === 9);
    check('home: hero shows the featured title', /4,000 meters/.test(doc.querySelector('.hero__title')?.textContent || ''));
    check('home: durations rendered', (doc.querySelector('.card__duration')?.textContent || '').includes(':'));
    check('home: no script errors', errors.length === 0, errors.join(' | '));

    const music = [...doc.querySelectorAll('#chips .chip')].find((b) => b.textContent === 'Music');
    music.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await settle(() => doc.querySelectorAll('#feed-grid .card').length === 3);
    check('home: Music filter shows 3 cards', doc.querySelectorAll('#feed-grid .card').length === 3,
      doc.querySelectorAll('#feed-grid .card').length + '');
    check('home: heading follows the filter', doc.querySelector('#feed-heading')?.textContent === 'Music');
    win.close();
  }

  // ----------------------------------------------------------------- watch
  {
    const { win, doc, errors } = await load('watch.html?v=v-abyss');
    check('watch: title set', doc.querySelector('#watch-title')?.textContent.includes('4,000 meters'));
    check('watch: video source wired', /indigo\.mp4/.test(doc.querySelector('#video')?.getAttribute('src') || ''));
    check('watch: 3 chapters', doc.querySelectorAll('#chapters .chapter').length === 3);
    check('watch: up next has 10 items', doc.querySelectorAll('#up-next .mini-card').length === 10);
    check('watch: comments populated', doc.querySelectorAll('#comments-list .comment').length >= 5);
    check('watch: like button shows a count', /\d/.test(doc.querySelector('#like-btn')?.textContent || ''));
    check('watch: document title includes the video', win.document.title.includes('4,000 meters'));

    doc.querySelector('#sub-btn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    check('watch: subscribe flips the button', doc.querySelector('#sub-btn').textContent.trim() === 'Subscribed');
    check('watch: subscription appears in the sidebar',
      (doc.querySelector('#sidebar')?.textContent || '').includes('Abyssal Field Notes'));
    check('watch: toast shown', doc.querySelectorAll('#toasts .toast').length >= 1);

    doc.querySelector('#like-btn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    check('watch: like sets aria-pressed', doc.querySelector('#like-btn').getAttribute('aria-pressed') === 'true');
    doc.querySelector('#cc-btn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    check('watch: captions toggle pressed', doc.querySelector('#cc-btn').getAttribute('aria-pressed') === 'true');
    doc.querySelector('#theater-btn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    check('watch: theater mode toggles body', doc.body.dataset.theater === 'on');
    doc.querySelector('[data-speed="1.5"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    check('watch: playback speed selected', doc.querySelector('[data-speed="1.5"]').getAttribute('aria-checked') === 'true');

    const input = doc.querySelector('#comment-input');
    input.value = 'Test comment from the harness';
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    check('watch: comment submit enables on input', doc.querySelector('#comment-submit').disabled === false);
    doc.querySelector('#comment-form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 60));
    check('watch: posted comment rendered',
      doc.querySelector('#comments-list').textContent.includes('Test comment from the harness'));
    check('watch: no script errors', errors.length === 0, errors.join(' | '));
    win.close();
  }

  // --------------------------------------------------------------- channel
  {
    const { win, doc, errors } = await load('channel.html?c=analog');
    check('channel: name rendered', doc.querySelector('.channel-head__name')?.textContent === 'Analog Autopsy');
    check('channel: latest + popular cards', doc.querySelectorAll('#channel-tab-body .card').length === 3);

    [...doc.querySelectorAll('.channel-tab')].find((t) => t.dataset.tab === 'about')
      .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    check('channel: about tab shows stats',
      (doc.querySelector('#channel-tab-body')?.textContent || '').includes('Germany'));

    [...doc.querySelectorAll('.channel-tab')].find((t) => t.dataset.tab === 'videos')
      .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    check('channel: videos tab lists both uploads', doc.querySelectorAll('#ch-all .card').length === 2);
    check('channel: no script errors', errors.length === 0, errors.join(' | '));
    win.close();
  }

  // ---------------------------------------------------------------- search
  {
    const { win, doc, errors } = await load('search.html?q=synth');
    check('search: heading echoes the query', (doc.querySelector('#search-heading')?.textContent || '').includes('synth'));
    check('search: results found', doc.querySelectorAll('#results .result').length >= 2);
    check('search: matches highlighted', !!doc.querySelector('#results mark'));
    check('search: four filter chips', doc.querySelectorAll('#search-filters [data-filter]').length === 4);
    doc.querySelector('[data-filter="channels"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    check('search: channels-only hides videos', doc.querySelectorAll('#results .result').length === 0);
    check('search: no script errors', errors.length === 0, errors.join(' | '));
    win.close();
  }

  {
    const { win, doc } = await load('search.html?q=abyss');
    const href = doc.querySelector('.channel-result')?.getAttribute('href') || '';
    check('search: channel result links by slug', href === 'channel.html?c=abyss', href);
    win.close();
  }

  // --------------------------------------------------------------- library
  {
    const { win, doc, errors } = await load('library.html?tab=history');
    check('library: empty history state', !!doc.querySelector('#library-body .empty-state'));
    check('library: four tabs', doc.querySelectorAll('[data-tab]').length === 4);
    check('library: no script errors', errors.length === 0, errors.join(' | '));
    win.close();
  }

  // ----------------------------------------------------------------- about
  {
    const { win, doc, errors } = await load('about.html');
    check('about: licence section exists', !!doc.querySelector('#licence'));
    check('about: no script errors', errors.length === 0, errors.join(' | '));
    win.close();
  }

  // ---------------------------------------------------------- saved state
  {
    const { win, doc, errors } = await load('index.html', SEED);
    check('state: dark theme restored', doc.documentElement.dataset.theme === 'dark');
    check('state: continue watching row visible', !doc.querySelector('#resume-section').hidden);
    check('state: resume row has the in-progress video', doc.querySelectorAll('#resume-row .card').length === 1);
    check('state: progress bar painted on the resume card', !!doc.querySelector('#resume-row .card__progress i'));
    check('state: subscription listed in the sidebar',
      (doc.querySelector('#sidebar')?.textContent || '').includes('Abyssal Field Notes'));
    check('state: no script errors', errors.length === 0, errors.join(' | '));
    win.close();
  }

  {
    const { win, doc, errors } = await load('library.html?tab=later', SEED);
    check('state: watch later lists the saved video', doc.querySelectorAll('#library-body .history-row').length === 1);
    check('state: library title reflects the tab', doc.querySelector('#library-title').textContent === 'Watch later');
    check('state: active tab pressed', doc.querySelector('[data-tab="later"]').getAttribute('aria-pressed') === 'true');
    check('state: no script errors', errors.length === 0, errors.join(' | '));
    win.close();
  }

  {
    const { win, doc } = await load('watch.html?v=v-abyss', SEED);
    check('state: stored like is pressed', doc.querySelector('#like-btn').getAttribute('aria-pressed') === 'true');
    check('state: dislike hidden while liked', doc.querySelector('#dislike-wrap').style.display === 'none');
    win.close();
  }

  {
    const { win, doc } = await load('watch.html?v=v-lofi', SEED);
    check('state: saved video button says Saved', doc.querySelector('#save-btn').textContent.includes('Saved'));
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 't', bubbles: true }));
    check('keys: t enters theater mode', doc.body.dataset.theater === 'on');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    check('keys: / focuses the search box', doc.activeElement?.id === 'search-input');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    check('keys: c toggles captions', doc.querySelector('#cc-btn').getAttribute('aria-pressed') === 'true');
    win.close();
  }

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  → ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

async function startServer() {
  server = spawn(process.execPath, ['server.mjs', String(PORT)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start in time')), 20000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('OpenTube →')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on('data', (chunk) => {
      if (/EADDRINUSE|build failed/i.test(String(chunk))) {
        clearTimeout(timer);
        reject(new Error(String(chunk)));
      }
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('server exited with code ' + code));
    });
  });
}

await startServer();
try {
  await run();
} finally {
  server.kill('SIGTERM');
}

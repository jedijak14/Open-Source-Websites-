#!/usr/bin/env node
/**
 * Emits a Vercel Build Output (.vercel/output) for this static site.
 *
 * Why: with a Node-style project Vercel's framework detection picked
 * `dev-server.mjs` as the app entrypoint and deployed a serverless function
 * instead of the static site. A valid Build Output takes precedence over
 * framework detection, so the deployment is deterministic: plain files plus
 * the headers we want.
 *
 *   node scripts/build-vercel.mjs
 */
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.vercel', 'output');
const staticDir = path.join(out, 'static');

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://i.ytimg.com https://img.youtube.com https://yt3.ggpht.com https://yt3.googleusercontent.com",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  "worker-src 'self'",
].join('; ');

async function collect() {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(entry.name);
  }
  return files;
}

async function main() {
  await rm(path.join(root, '.vercel'), { recursive: true, force: true });
  await mkdir(staticDir, { recursive: true });

  // only the things a browser needs are published
  const html = await collect();
  for (const file of html) {
    await cp(path.join(root, file), path.join(staticDir, file));
  }
  for (const dir of ['assets']) {
    await cp(path.join(root, dir), path.join(staticDir, dir), { recursive: true });
  }

  const config = {
    version: 3,
    cleanUrls: true,
    trailingSlash: false,
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'interest-cohort=(), browsing-topics=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      {
        source: '/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/(.*).html',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ],
  };

  await writeFile(path.join(out, 'config.json'), JSON.stringify(config, null, 2));

  console.log(`Vercel output ready: ${html.length} pages + assets/ → .vercel/output/static`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

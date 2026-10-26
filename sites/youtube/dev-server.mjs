#!/usr/bin/env node
/**
 * Tiny static server for the OpenTube demo.
 *
 * - rebuilds the HTML pages from src/ on boot (skip with SKIP_BUILD=1)
 * - serves this folder with correct MIME types
 * - supports HTTP byte ranges, which is what makes <video> seeking work
 * - binds 0.0.0.0 so it can be opened from another device or a preview proxy
 *
 * Usage: node dev-server.mjs [port]
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function build() {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(root, 'scripts', 'build-pages.mjs')], (err, stdout) => {
      if (err) {
        console.error('page build failed:\n', err.stdout || '', err.message);
        process.exitCode = 1;
      } else {
        process.stdout.write(stdout);
      }
      resolve();
    });
  });
}

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(root, clean);
  if (!file.startsWith(root)) return null;

  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      file = path.join(file, 'index.html');
      return { file, info: await stat(file) };
    }
    return { file, info };
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }

  const found = await resolveFile(req.url || '/');
  if (!found) {
    const notFound = await resolveFile('/404.html');
    const body = notFound ? createReadStream(notFound.file) : 'Not found';
    res.writeHead(404, { 'Content-Type': notFound ? 'text/html; charset=utf-8' : 'text/plain' });
    body.pipe(res);
    return;
  }

  const { file, info } = found;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const isHtml = type.startsWith('text/html');
  const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return;
  }

  const headers = {
    'Content-Type': type,
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; " +
      "frame-ancestors 'self' https://*.e2b.app; form-action 'self'; " +
      "script-src 'self' 'unsafe-inline' https://accounts.google.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https://i.ytimg.com https://img.youtube.com https://yt3.ggpht.com " +
      'https://yt3.googleusercontent.com; media-src \'self\'; font-src \'self\'; ' +
      "connect-src 'self' https://www.googleapis.com https://accounts.google.com; " +
      'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Accept-Ranges': 'bytes',
    ETag: etag,
    'Last-Modified': info.mtime.toUTCString(),
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  };

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      res.end();
      return;
    }
    let start = match[1] === '' ? null : Number(match[1]);
    let end = match[2] === '' ? null : Number(match[2]);
    if (start === null && end === null) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      res.end();
      return;
    }
    if (start === null) {
      start = Math.max(0, info.size - end);
      end = info.size - 1;
    } else {
      end = end === null ? info.size - 1 : Math.min(end, info.size - 1);
    }
    if (start > end || start >= info.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${info.size}`,
      'Content-Length': end - start + 1,
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { ...headers, 'Content-Length': info.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
});

await (process.env.SKIP_BUILD === '1' ? Promise.resolve() : build());

server.listen(port, '0.0.0.0', () => {
  console.log(`\nOpenTube → http://localhost:${port}/\n`);
});

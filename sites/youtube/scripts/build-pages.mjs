#!/usr/bin/env node
/**
 * Assembles the static pages in sites/youtube/ from src/layout.html,
 * src/partials/* and src/pages/*.
 *
 * Each page starts with a single meta comment:
 *   <!--meta {"title":"...","description":"...","page":"home"}-->
 * Everything after it is the page body, which replaces {{content}}.
 *
 * Run with: node scripts/build-pages.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'src');

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function partial(name) {
  return readFile(path.join(src, 'partials', `${name}.html`), 'utf8');
}

function applyIncludes(html, partials) {
  return html.replace(/<!--\s*include:\s*([\w-]+)\s*-->/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
    return partials[name];
  });
}

function stripMeta(source) {
  const match = source.match(/^\s*<!--meta\s*([\s\S]*?)-->\s*/);
  if (!match) throw new Error('Page is missing its <!--meta {...}--> block');
  return { meta: JSON.parse(match[1]), body: source.slice(match[0].length) };
}

async function main() {
  const layout = await readFile(path.join(src, 'layout.html'), 'utf8');
  const partials = {};
  for (const file of await readdir(path.join(src, 'partials'))) {
    if (file.endsWith('.html')) partials[path.basename(file, '.html')] = await partial(path.basename(file, '.html'));
  }
  for (const key of Object.keys(partials)) partials[key] = applyIncludes(partials[key], partials);

  const pages = (await readdir(path.join(src, 'pages'))).filter((f) => f.endsWith('.html'));
  let built = 0;

  for (const file of pages) {
    const source = await readFile(path.join(src, 'pages', file), 'utf8');
    const { meta, body } = stripMeta(source);
    const html = applyIncludes(layout, partials)
      .replaceAll('{{title}}', escapeHtml(meta.title || 'OpenTube'))
      .replaceAll('{{description}}', escapeHtml(meta.description || ''))
      .replaceAll('{{page}}', escapeHtml(meta.page || ''))
      .replace('{{content}}', applyIncludes(body, partials));

    await writeFile(path.join(root, file), html, 'utf8');
    built += 1;
    console.log(`  built ${file}`);
  }

  console.log(`\n${built} pages written to ${path.relative(process.cwd(), root) || '.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

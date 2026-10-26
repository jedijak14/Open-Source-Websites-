#!/usr/bin/env node
/**
 * Builds the catalogue the Android TV app ships with, from the website's own
 * data file. The TV app has no build-time JavaScript, so the demo content has
 * to arrive as plain JSON.
 *
 *   node tv/tools/build-catalog.mjs
 *
 * Writes app/src/main/assets/catalog.json (videos, channels, categories and the
 * subtitle lines used by the captions renderer) plus app/src/main/assets/movies.json.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..');
const outDir = join(site, 'tv', 'app', 'src', 'main', 'assets');

const window = {};
new Function('window', await readFile(join(site, 'assets', 'data.js'), 'utf8'))(window);
const data = window.OT_DATA;

const channels = Object.entries(data.channels).map(([slug, channel]) => ({
  slug,
  name: channel.name,
  handle: channel.handle,
  avatar: channel.avatar,
  subscribers: channel.subscribers,
  about: channel.about,
}));

const videos = data.videos.map((video) => ({
  id: video.id,
  title: video.title,
  channel: video.channel,
  channelName: (data.channels[video.channel] || {}).name || video.channel,
  category: video.category,
  tags: video.tags || [],
  views: video.views,
  likes: video.likes,
  published: video.published,
  duration: video.duration,
  durationLabel: video.durationLabel,
  poster: video.poster,
  clip: `assets/video/${video.clip}.mp4`,
  desc: video.desc,
  chapters: video.chapters || [],
  captions: (video.transcript || []).map(([time, text]) => ({ time, text })),
}));

const catalogue = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  base: 'https://opentube-two.vercel.app/',
  categories: data.categories,
  channels,
  videos,
};

/**
 * The movie shelf. Everything here is original OpenTube content: the "free with
 * ads" titles use the site's demo clips, the rest exist only as metadata so the
 * purchase message can be shown honestly.
 */
const movies = [
  {
    id: 'm-signal',
    title: 'The Signal From Room 12',
    channel: 'analog',
    channelName: 'Analog Autopsy',
    year: 2024,
    runtime: '1h 48m',
    rating: 'PG-13',
    poster: 'assets/thumbs/deep-sea.jpg',
    price: 'rent 3.99',
    kind: 'movie',
    freeWithAds: false,
    desc: 'A repair technician starts receiving transmissions from a room that was demolished in 1974.',
  },
  {
    id: 'm-street',
    title: 'Streetlight Hours',
    channel: 'wander',
    channelName: 'Wander Lines',
    year: 2023,
    runtime: '1h 32m',
    rating: 'PG',
    poster: 'assets/thumbs/kyoto-dusk.jpg',
    price: 'rent 2.99',
    kind: 'movie',
    freeWithAds: false,
    desc: 'Two strangers walk the same route through a city that keeps rearranging itself overnight.',
  },
  {
    id: 'm-amber',
    title: 'Amber Frequency',
    channel: 'analog',
    channelName: 'Analog Autopsy',
    year: 2022,
    runtime: '58m',
    rating: 'G',
    poster: 'assets/thumbs/synth-restore.jpg',
    price: 'free with ads',
    kind: 'movie',
    freeWithAds: true,
    clip: 'assets/video/amber.mp4',
    desc: 'A restoration bench, one stubborn capacitor and ninety minutes of tape hiss. Free to watch.',
  },
  {
    id: 'm-teal',
    title: 'Teal Hours',
    channel: 'wander',
    channelName: 'Wander Lines',
    year: 2025,
    runtime: '1h 04m',
    rating: 'G',
    poster: 'assets/thumbs/lofi-room.jpg',
    price: 'free with ads',
    kind: 'movie',
    freeWithAds: true,
    clip: 'assets/video/teal.mp4',
    desc: 'A slow, wordless walk through a harbour town at the hour when everything turns the same colour.',
  },
];

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'catalog.json'), JSON.stringify(catalogue));
await writeFile(join(outDir, 'movies.json'), JSON.stringify({ version: 1, movies }, null, 2));

const captions = videos.reduce((sum, video) => sum + video.captions.length, 0);
console.log(
  `catalog.json: ${videos.length} videos, ${channels.length} channels, ${captions} caption lines`
);
console.log(`movies.json: ${movies.length} titles (${movies.filter((m) => m.freeWithAds).length} free)`);

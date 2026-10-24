# Open Source Websites

Hand-built, dependency-free recreations of familiar websites — original code, original copy,
original assets. Each entry is a self-contained static site you can read end to end, run locally
and host anywhere.

The point is not to copy a product, it is to show how much of one you can build with plain HTML,
CSS and JavaScript when you are not reaching for a framework or an SDK.

## Sites

| Site | What it is | Stack | Run |
| --- | --- | --- | --- |
| **[OpenTube](sites/youtube/)** | A video platform: feed, channels, search, library, comments and a custom player with chapters, captions and keyboard shortcuts | Static HTML/CSS/JS, Node static server, ffmpeg-generated media | `cd sites/youtube && node server.mjs` |

## Conventions

Every site in `sites/` follows the same shape:

- **No build step required to view it.** Open the folder with any static server (or the bundled one).
- **Source and output are separated.** Templates live in `src/`, generated pages sit next to them so
  the folder can also be dropped straight onto static hosting.
- **No third-party runtime dependencies.** No frameworks, no npm packages at runtime, no trackers,
  no external fonts or CDNs. Media is generated locally and committed with the site.
- **Original assets.** Layouts are interpretations of familiar patterns; trademarks, logos, brand
  names and media belonging to the original products are not used.
- **Accessible by default.** Keyboard operation, visible focus, landmarks, live regions, reduced
  motion and light/dark themes are part of each build, not an afterthought.

## Repository layout

```
sites/
  youtube/            OpenTube (see sites/youtube/README.md)
    assets/           styles, app logic, dataset, thumbnails, clips
    src/              layout, partials, page bodies
    scripts/          page/build/media tooling
    server.mjs        static server with byte-range support
```

## License

MIT — see [LICENSE](LICENSE).

Each site documents its own attribution notes. All of them are independent demonstrations and are
not affiliated with or endorsed by the products whose patterns they explore; any people, channels,
posts or metrics in the demo content are fictional.

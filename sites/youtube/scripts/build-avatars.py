#!/usr/bin/env python3
"""Generates the channel avatar SVGs (no external image tooling needed).

Each channel gets a deterministic gradient disc with its monogram, in the same
spirit as the placeholder avatars a real video site falls back to.
"""
from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "avatars"

CHANNELS = {
    "nullbyte": ("NB", "#1f4fff", "#7b2ff7"),
    "analog": ("AA", "#ff8a00", "#ffc46b"),
    "wander": ("WF", "#0e6b6b", "#39d0c0"),
    "abyss": ("AB", "#0a3a7a", "#2ad4ff"),
    "crumb": ("CC", "#b5652b", "#ffc46b"),
    "lowlight": ("LR", "#6f5cff", "#c86bff"),
    "stride": ("SL", "#e0452f", "#ff9a3c"),
    "pixel": ("PA", "#8a2a8a", "#ff5c8a"),
    "orbit": ("OW", "#1e2b7a", "#5cc8ff"),
}

TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="{name}">
  <defs>
    <linearGradient id="g" x1="12%" y1="0%" x2="88%" y2="100%">
      <stop offset="0%" stop-color="{a}"/>
      <stop offset="100%" stop-color="{b}"/>
    </linearGradient>
    <radialGradient id="h" cx="30%" cy="22%" r="72%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".34"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="80" cy="80" r="80" fill="url(#g)"/>
  <circle cx="80" cy="80" r="80" fill="url(#h)"/>
  <text x="80" y="80" fill="#fff" font-family="Roboto, Arial, Helvetica, sans-serif"
        font-size="58" font-weight="700" letter-spacing="1"
        text-anchor="middle" dominant-baseline="central">{mono}</text>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, (mono, a, b) in CHANNELS.items():
        (OUT / f"{slug}.svg").write_text(
            TEMPLATE.format(mono=mono, a=a, b=b, name=slug), encoding="utf-8"
        )
    print(f"wrote {len(CHANNELS)} avatars to {OUT}")


if __name__ == "__main__":
    main()

# Stellar Voyage — Open Source Space Game

A fully client-side, first-person space flight game built with **Three.js** (r164). Every asset — cockpit, ship, planet, atmosphere, animals, PBR textures, and music — is generated procedurally in the browser. No external models, textures, or audio files are required.

## Features

- **Cockpit (first-person)** — pilot's seat with PBR metal panels, overhead switch panel (FLOOD / GEAR / SHADE / COMS / AUX), dashboard screens, throttle, and a sealed "FIRE LOCKER" door, all inspired by the reference cockpit imagery.
- **Ship (third-person)** — flyable starship with fuselage, cockpit bubble, wings, nacelles, aft engines, and landing gear. Engine glow pulses with throttle.
- **Cinematic camera** — smooth orbital camera around the ship.
- **First-person on foot** — exit the ship and explore the planet surface (TAB / T).
- **Warp drive** — charge the warp core in the cockpit (hold SPACE), engage (E), then a hyperspeed star-stretch + tunnel cutscene delivers you to a new planet.
- **Procedural planet** — PBR surface (color/normal/roughness), atmosphere shell, craters, and a landing pad.
- **Unique animals** — three creature types (floater, grazer, skitter) with simple wander AI on the surface.
- **Menu system** — Start New Game, Continue, Load Game, Credits. Progress autosaves to localStorage.
- **Procedural audio** — ambient space score and SFX synthesized with the Web Audio API (no audio files).
- **HUD** — warp charge meter, speed, camera mode, system status.

## Controls (in-game)

| Key | Action |
|-----|--------|
| W / S | Throttle up / down |
| A / D | Roll left / right |
| Q / E | Yaw left / right *(E also engages warp when charged / interacts)* |
| R / F | Pitch up / down |
| Mouse | Look around (click to lock pointer) |
| C | Cycle camera: Cockpit → Third Person → Cinematic |
| SPACE | Charge warp drive (hold) |
| T | First-person on foot (when landed) |
| TAB | Exit / re-enter ship |
| Escape | Unlock mouse / return to menu |

## Credits

- **Game Design & Code:** Arena Agent (Open-Source-Websites-)
- **Engine:** Three.js r164
- **Audio:** Procedural Web Audio synthesis
- **Textures & Models:** Procedurally generated PBR assets
- **Inspiration:** Reference cockpit & warp comparison imagery

## Running

Open `index.html` in a modern browser, or serve the folder with any static server (e.g. `python3 -m http.server 8080`). Click the canvas to start audio and capture the pointer.

This is free and unencumbered software released into the public domain (see `LICENSE`).

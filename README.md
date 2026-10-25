# Stellar Voyage — Open Source 3D Space Exploration Game

A 3D WebGL space flight and planetary exploration game built with **Three.js (r164)**, featuring online 3D `.glb` / `.obj` spacecraft and outpost models, public-domain/CC-BY space soundtracks, Kenney CC0 landing/steam/thruster sound effects, a walkable 3-bay starship interior, multi-shot cinematic cutscenes, and billowing volumetric landing steam clouds.

## Key Features

- **Online 3D Spaceship Models (`GLTFLoader` & `OBJLoader`)** — Fly and switch between 4 loaded 3D starship hulls (`H` key or **🚀 Ship Hull** button):
  1. **Starfighter MK-I** (`SpaceFighter01.obj` + 512px Livery + NASA Orbiter dorsal bridge)
  2. **NASA Space Shuttle Orbiter OV-105** (`shuttle_orbiter.glb`)
  3. **Vanguard Deep-Space Cruiser** (`spaceship.glb`)
  4. **Heavy Shuttle Stack MK-IV** (`space_shuttle_hd.glb`)
- **Volumetric 3D Landing & Takeoff Steam System** — 85 billowing 3D cloud sprites and 4 high-pressure lateral steam relief valves erupt radially across the landing pad during VTOL descent, touchdown shockwave, pad cooling, and vertical liftoff.
- **Public Space Music & Kenney CC0 Sci-Fi Audio** — 5 space soundtracks (*Scott Buckley — Shadows And Dust*, *Space Voyage*, *Deep Orbit*, *Launch Belt*, *Project Utopia*) and 12 real `.ogg` sci-fi sound effects (looping turbine engine, high-pressure steam hiss, steam vent burst, touchdown thud, hydraulic gear, warp jump, metallic deck footsteps) processed through a Web Audio convolver reverb and dynamics compressor.
- **Walkable 3-Bay Starship Interior (`I`)** — Unstrap from the pilot seat at any time and walk through the Forward Flight Bridge, Science & Astrogation Bay (with rotating 3D Holo-Table), and Aft Quantum Reactor & Airlock.
- **Cinematic Cutscenes** — Multi-shot Quantum Warp Jump (`SPACE`), Animated Planetary Landing with Hydraulic Gear & Billowing Steam (`L`), Vertical Liftoff (`L`), and Opening Orbital Launch.
- **Multi-Planet Biomes, NASA Outpost & Animated Fauna** — 5 star systems with NASA planetary surface maps, orbiting International Space Station (`iss.glb`), Lunar Lander (`lunar_lander.glb`), Habitat Base (`habitat_base.glb`), EVA Astronaut (`astronaut.glb`), alien biome creatures, and animated glTF wildlife (`fox.glb`, `flamingo.glb`, `parrot.glb`, `stork.glb`).

## Controls

| Key | Action |
|-----|--------|
| **W / S** | Throttle up / down (Flight) or Walk forward / back (Ship Deck / Planet) |
| **A / D** | Yaw left / right (Flight) or Strafe left / right (Walk) |
| **R / F** | Pitch up / down |
| **Q / E** | Roll left / right (**E** also interacts with Pilot Seat, Holo-Table & Airlock) |
| **I** | Toggle **Walk Around Inside Ship** (3-Bay Interior Deck) |
| **L** | Trigger **Animated Planetary Landing (with Steam)** / **Takeoff Cutscene** |
| **TAB / T** | Disembark / Walk on Planet Surface |
| **H** | Cycle **Online 3D Spaceship Hull Model** |
| **C** | Cycle Flight Camera: Cockpit → Third Person → Cinematic |
| **SPACE** | Hold to charge & engage **Quantum Warp Cutscene** |
| **ENTER** | Skip active cutscene / Interact |
| **ESC** | Pause Menu |

## Credits

- **Game Design & Code:** Arena Agent (`Open-Source-Websites-`)
- **3D Engine & Post-FX:** Three.js r164 + PMREM RoomEnvironment IBL + UnrealBloomPass HDR
- **3D Models:** NASA 3D Resources (`shuttle_orbiter.glb`, `iss.glb`, `lunar_lander.glb`, `habitat_base.glb`, `astronaut.glb`), Jerome Etienne (`SpaceFighter01`), Liz Reddington (`spaceship.glb`), Khronos / Three.js (`fox.glb`, `flamingo.glb`, `parrot.glb`, `stork.glb`)
- **Music & Sound Effects:** Scott Buckley (*Shadows And Dust*, CC-BY 4.0), Kenney Sci-Fi Sounds (CC0), Three.js Audio

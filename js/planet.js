/**
 * Stellar Voyage — Procedural Planet, Biomes, & Alien Fauna
 * North Pole landing pad is at local (0, radius, 0).
 * When planet is placed at world (0, -radius, 0), the landing pad is at world (0, 0, 0).
 */

import * as THREE from "three";
import { makePlanetTextures } from "./textures.js";

export const SYSTEMS = [
  {
    name: "KEPLER-442b",
    biome: "VERDANT XENO-PLAINS",
    base: [0.16, 0.38, 0.28],
    accent: [0.28, 0.58, 0.42],
    atmosHex: 0x38bdf8,
    ringHex: null,
    faunaColors: [0x34d399, 0xfbbf24, 0xa78bfa, 0x38bdf8]
  },
  {
    name: "LYRA-9 PRIME",
    biome: "CRIMSON CANYONLANDS",
    base: [0.48, 0.22, 0.14],
    accent: [0.72, 0.36, 0.18],
    atmosHex: 0xf97316,
    ringHex: 0xfdba74,
    faunaColors: [0xfca5a5, 0xfde047, 0x22d3ee, 0xc084fc]
  },
  {
    name: "AETHER-7",
    biome: "BIOLUMINESCENT TUNDRA",
    base: [0.18, 0.28, 0.48],
    accent: [0.35, 0.56, 0.82],
    atmosHex: 0x818cf8,
    ringHex: 0x38bdf8,
    faunaColors: [0x22d3ee, 0xe879f9, 0x6ee7b7, 0x93c5fd]
  },
  {
    name: "SOLARIS-V",
    biome: "GOLDEN SULFUR SAVANNA",
    base: [0.46, 0.38, 0.14],
    accent: [0.68, 0.58, 0.22],
    atmosHex: 0xfacc15,
    ringHex: null,
    faunaColors: [0xa3e635, 0xf472b6, 0x38bdf8, 0xfbbf24]
  },
  {
    name: "CYGNUS-X3",
    biome: "OBSIDIAN CRYSTAL SPIRES",
    base: [0.22, 0.16, 0.32],
    accent: [0.45, 0.24, 0.62],
    atmosHex: 0xc084fc,
    ringHex: 0xe879f9,
    faunaColors: [0xf43f5e, 0x2dd4bf, 0xc084fc, 0xfacc15]
  }
];

export const getSurfaceY = (radius, x, z) => {
  const r2 = radius * radius;
  const d2 = x * x + z * z;
  if (d2 >= r2 * 0.95) return radius * 0.2;
  return Math.sqrt(r2 - d2);
};

export const buildPlanet = (radius = 85, systemIndex = 0) => {
  const sys = SYSTEMS[systemIndex % SYSTEMS.length];
  const planet = new THREE.Group();
  planet.name = "planet";
  planet.radius = radius;
  planet.systemIndex = systemIndex % SYSTEMS.length;
  planet.systemInfo = sys;

  const pTex = makePlanetTextures(systemIndex + 1, sys.base, sys.accent);

  // ---------- Main Planetary Sphere ----------
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 72, 72),
    new THREE.MeshStandardMaterial({
      map: pTex.color,
      normalMap: pTex.normal,
      roughnessMap: pTex.rough,
      roughness: 0.72,
      metalness: 0.12
    })
  );
  surface.receiveShadow = true;
  planet.add(surface);

  // ---------- Atmosphere Glow Halo ----------
  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.045, 48, 48),
    new THREE.MeshBasicMaterial({
      color: sys.atmosHex,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  planet.add(atmos);

  // ---------- Optional Planetary Ring System ----------
  if (sys.ringHex) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.35, radius * 1.95, 64),
      new THREE.MeshBasicMaterial({
        color: sys.ringHex,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = Math.PI / 2.4;
    ring.rotation.y = 0.3;
    planet.add(ring);
  }

  // ---------- North Pole Landing Pad at local (0, radius, 0) ----------
  const pad = new THREE.Group();
  pad.position.set(0, radius, 0);

  const padBase = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 6.2, 0.25, 32),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 })
  );
  pad.add(padBase);

  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(3.8, 4.4, 32),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.15;
  pad.add(padRing);

  const padCenter = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.45, 24),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  padCenter.rotation.x = -Math.PI / 2;
  padCenter.position.y = 0.15;
  pad.add(padCenter);

  // 4 glowing landing beacon pillars around the pad
  for (let b = 0; b < 4; b++) {
    const ang = (b / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.cos(ang) * 5.0;
    const bz = Math.sin(ang) * 5.0;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
    );
    post.position.set(bx, 0.6, bz);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    bulb.position.set(bx, 1.25, bz);
    pad.add(post, bulb);
  }

  planet.add(pad);
  planet.pad = pad;

  // ---------- Alien Crystalline Spires & Boulders around the Landing Zone ----------
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sys.base[0] * 0.85, sys.base[1] * 0.85, sys.base[2] * 0.85),
    roughness: 0.85,
    metalness: 0.15
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: sys.atmosHex,
    emissive: sys.atmosHex,
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.5
  });

  for (let i = 0; i < 48; i++) {
    const dist = 10 + Math.random() * 48;
    const ang = Math.random() * Math.PI * 2;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    const ry = getSurfaceY(radius, rx, rz);

    if (i % 3 === 0) {
      // Glowing alien crystal spire
      const h = 1.4 + Math.random() * 3.2;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.45 + Math.random() * 0.4, h, 6), crystalMat);
      spire.position.set(rx, ry + h * 0.4, rz);
      spire.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
      planet.add(spire);
    } else {
      // Alien boulder / mesa rock
      const s = 0.8 + Math.random() * 2.2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
      rock.position.set(rx, ry + s * 0.35, rz);
      rock.scale.set(1.2, 0.65, 1.0);
      rock.rotation.y = Math.random() * Math.PI;
      planet.add(rock);
    }
  }

  // ---------- Animals Container ----------
  planet.animals = [];
  planet.animalRoot = new THREE.Group();
  planet.add(planet.animalRoot);

  return planet;
};

export const spawnAnimals = (planet, count = 28) => {
  const { animalRoot, radius, systemInfo } = planet;
  const types = ["grazer", "floater", "skitter", "hopper"];
  const palette = systemInfo ? systemInfo.faunaColors : [0x6ee7b7, 0xfbbf24, 0xc084fc, 0x38bdf8];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const col = palette[i % palette.length];
    const animal = buildAnimal(type, col);

    // Spawn in a ring 9m to 44m around the North Pole landing pad so player sees them immediately!
    const dist = 9 + Math.random() * 35;
    const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const y = getSurfaceY(radius, x, z);

    const floatOffset = type === "floater" ? 2.4 + Math.random() * 2.2 : 0;
    animal.position.set(x, y + floatOffset, z);

    const dirAngle = Math.random() * Math.PI * 2;
    animal.rotation.y = dirAngle;

    animal.userData = {
      type,
      speed: type === "skitter" ? 3.2 : type === "hopper" ? 2.6 : 1.65,
      heading: dirAngle,
      turnRate: (Math.random() - 0.5) * 0.8,
      timer: Math.random() * 10,
      floatOffset,
      floating: type === "floater"
    };

    animalRoot.add(animal);
    planet.animals.push(animal);
  }
  return planet.animals;
};

const buildAnimal = (type, colorHex) => {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    metalness: 0.18,
    roughness: 0.55
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.4,
    roughness: 0.5
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const limbs = [];

  if (type === "floater") {
    // Bioluminescent Sky-Jellyfish
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 12), bodyMat);
    bell.scale.set(1, 0.55, 1);
    bell.position.y = 0.6;
    g.add(bell);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), glowMat);
    core.position.y = 0.45;
    g.add(core);

    for (let t = 0; t < 6; t++) {
      const a = (t / 6) * Math.PI * 2;
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.012, 1.35, 8), glowMat);
      tent.position.set(Math.cos(a) * 0.42, -0.15, Math.sin(a) * 0.42);
      limbs.push(tent);
      g.add(tent);
    }
  } else if (type === "grazer") {
    // Tall Long-Necked Alien Strider Megafauna
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.95, 6, 12), bodyMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.y = 0.95;
    g.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.1, 10), bodyMat);
    neck.position.set(0, 1.55, 0.58);
    neck.rotation.x = 0.35;
    g.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), bodyMat);
    head.scale.set(0.85, 0.75, 1.35);
    head.position.set(0, 2.02, 0.82);
    g.add(head);

    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.45), glowMat);
    crest.position.set(0, 2.22, 0.72);
    g.add(crest);

    for (const sx of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
      eye.position.set(sx, 2.06, 1.05);
      g.add(eye);
    }

    // 4 articulated legs
    const legCoords = [
      [-0.38, 0.45],
      [0.38, 0.45],
      [-0.38, -0.45],
      [0.38, -0.45]
    ];
    legCoords.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.95, 8), darkMat);
      leg.position.set(lx, 0.48, lz);
      limbs.push(leg);
      g.add(leg);
    });
  } else if (type === "skitter") {
    // Crystal-Backed Multi-Legged Scuttler
    const carapace = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), bodyMat);
    carapace.scale.set(1.15, 0.52, 1.35);
    carapace.position.y = 0.42;
    g.add(carapace);

    // Dorsal crystal spikes
    for (let c = -1; c <= 1; c++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.48, 5), glowMat);
      spike.position.set(0, 0.78, c * 0.28);
      spike.rotation.x = -0.2;
      g.add(spike);
    }

    for (const sx of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
      eye.position.set(sx, 0.48, 0.72);
      g.add(eye);
    }

    for (const sx of [-0.52, 0.52]) {
      for (const sz of [-0.35, 0, 0.35]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.55, 6), darkMat);
        leg.position.set(sx, 0.24, sz);
        leg.rotation.z = sx > 0 ? -0.55 : 0.55;
        limbs.push(leg);
        g.add(leg);
      }
    }
  } else {
    // Hopper — Bipedal Crest-Raptor / Bounder
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 6, 10), bodyMat);
    body.rotation.x = Math.PI / 3;
    body.position.y = 0.78;
    g.add(body);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 8), glowMat);
    tail.rotation.x = -Math.PI / 2.2;
    tail.position.set(0, 0.72, -0.68);
    g.add(tail);

    for (const sx of [-0.26, 0.26]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.72, 8), darkMat);
      leg.position.set(sx, 0.36, 0);
      limbs.push(leg);
      g.add(leg);
    }
  }

  g.userData.limbs = limbs;
  return g;
};

export const updateAnimals = (planet, dt) => {
  if (!planet || !planet.animals) return;
  const radius = planet.radius || 85;

  for (const a of planet.animals) {
    const ud = a.userData;
    ud.timer += dt;

    // Gentle wandering around the polar biome (stay between 8m and 46m from landing pad)
    ud.heading += ud.turnRate * dt;
    const vx = Math.sin(ud.heading) * ud.speed;
    const vz = Math.cos(ud.heading) * ud.speed;

    a.position.x += vx * dt;
    a.position.z += vz * dt;

    const distFromPad = Math.hypot(a.position.x, a.position.z);
    if (distFromPad > 46) {
      // Steer back toward the landing zone
      ud.heading = Math.atan2(-a.position.x, -a.position.z) + (Math.random() - 0.5) * 0.5;
    } else if (distFromPad < 7.5) {
      // Keep off the center of the landing pad
      ud.heading = Math.atan2(a.position.x, a.position.z) + (Math.random() - 0.5) * 0.4;
    }

    if (Math.random() < 0.015) {
      ud.turnRate = (Math.random() - 0.5) * 1.1;
    }

    // Snap accurately to curved planet surface height
    const surfY = getSurfaceY(radius, a.position.x, a.position.z);
    if (ud.floating) {
      a.position.y = surfY + ud.floatOffset + Math.sin(ud.timer * 2.2) * 0.45;
    } else if (ud.type === "hopper") {
      const hop = Math.abs(Math.sin(ud.timer * 4.5)) * 0.45;
      a.position.y = surfY + hop;
    } else {
      a.position.y = surfY;
    }

    a.rotation.y = ud.heading;

    // Animate limbs / tentacles
    const limbs = ud.limbs || [];
    for (let i = 0; i < limbs.length; i++) {
      const phase = ud.timer * 6 + i * 1.4;
      limbs[i].rotation.x = Math.sin(phase) * 0.35;
    }
  }
};

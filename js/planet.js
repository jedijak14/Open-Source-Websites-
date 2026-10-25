/**
 * Stellar Voyage — Planet, NASA Surface Textures, Online 3D Outpost & Fauna
 * North Pole landing pad is at local (0, radius, 0).
 * When planet is placed at world (0, -radius, 0), the landing pad is at world (0, 0, 0).
 */

import * as THREE from "three";
import { makePlanetTextures } from "./textures.js";
import { sharedGLTFLoader, sharedTexLoader } from "./ship.js";

export const SYSTEMS = [
  {
    name: "KEPLER-442b",
    biome: "VERDANT XENO-PLAINS",
    textureUrl: "./assets/textures/earth.jpg",
    tintHex: 0x99f6e4,
    base: [0.16, 0.38, 0.28],
    accent: [0.28, 0.58, 0.42],
    atmosHex: 0x38bdf8,
    ringHex: null,
    faunaColors: [0x34d399, 0xfbbf24, 0xa78bfa, 0x38bdf8]
  },
  {
    name: "LYRA-9 PRIME",
    biome: "CRIMSON CANYONLANDS",
    textureUrl: "./assets/textures/mars.jpg",
    tintHex: 0xfdba74,
    base: [0.48, 0.22, 0.14],
    accent: [0.72, 0.36, 0.18],
    atmosHex: 0xf97316,
    ringHex: 0xfdba74,
    faunaColors: [0xfca5a5, 0xfde047, 0x22d3ee, 0xc084fc]
  },
  {
    name: "AETHER-7",
    biome: "BIOLUMINESCENT TUNDRA",
    textureUrl: "./assets/textures/neptune.jpg",
    tintHex: 0xa5f3fc,
    base: [0.18, 0.28, 0.48],
    accent: [0.35, 0.56, 0.82],
    atmosHex: 0x818cf8,
    ringHex: 0x38bdf8,
    faunaColors: [0x22d3ee, 0xe879f9, 0x6ee7b7, 0x93c5fd]
  },
  {
    name: "SOLARIS-V",
    biome: "GOLDEN SULFUR SAVANNA",
    textureUrl: "./assets/textures/jupiter.jpg",
    tintHex: 0xfef08a,
    base: [0.46, 0.38, 0.14],
    accent: [0.68, 0.58, 0.22],
    atmosHex: 0xfacc15,
    ringHex: null,
    faunaColors: [0xa3e635, 0xf472b6, 0x38bdf8, 0xfbbf24]
  },
  {
    name: "CYGNUS-X3",
    biome: "OBSIDIAN CRYSTAL SPIRES",
    textureUrl: "./assets/textures/europa.jpg",
    tintHex: 0xe9d5ff,
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

function createPadSteamTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(240, 249, 255, 0.55)");
  grad.addColorStop(0.5, "rgba(186, 230, 253, 0.25)");
  grad.addColorStop(1, "rgba(186, 230, 253, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function fitModelToHeight(obj, targetHeight = 3.0) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetHeight / maxDim;

  const wrapper = new THREE.Group();
  obj.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  obj.scale.setScalar(scale);
  wrapper.add(obj);
  return wrapper;
}

export const buildPlanet = (radius = 85, systemIndex = 0) => {
  const sys = SYSTEMS[systemIndex % SYSTEMS.length];
  const planet = new THREE.Group();
  planet.name = "planet";
  planet.radius = radius;
  planet.systemIndex = systemIndex % SYSTEMS.length;
  planet.systemInfo = sys;

  const pTex = makePlanetTextures(systemIndex + 1, sys.base, sys.accent);

  // ---------- Main Planetary Sphere (Procedural + NASA Planetary Texture) ----------
  const surfaceMat = new THREE.MeshStandardMaterial({
    map: pTex.color,
    normalMap: pTex.normal,
    roughnessMap: pTex.rough,
    roughness: 0.72,
    metalness: 0.12
  });

  if (sys.textureUrl) {
    sharedTexLoader.load(
      sys.textureUrl,
      (nasaTex) => {
        nasaTex.colorSpace = THREE.SRGBColorSpace;
        nasaTex.wrapS = THREE.RepeatWrapping;
        nasaTex.wrapT = THREE.RepeatWrapping;
        surfaceMat.map = nasaTex;
        surfaceMat.color.setHex(sys.tintHex || 0xffffff);
        surfaceMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );
  }

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 72, 72),
    surfaceMat
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

  // 4 glowing landing beacon pillars + perimeter steam pipes around the pad
  const padSteamTex = createPadSteamTexture();
  planet.padSteamPuffs = [];

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

    // Ambient pad steam puffs rising from perimeter coolant grates
    for (let s = 0; s < 4; s++) {
      const sMat = new THREE.SpriteMaterial({
        map: padSteamTex,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      const sp = new THREE.Sprite(sMat);
      sp.position.set(bx * 0.88, 0.25 + s * 0.45, bz * 0.88);
      sp.scale.setScalar(1.2 + s * 0.4);
      pad.add(sp);
      planet.padSteamPuffs.push({
        sprite: sp,
        baseX: bx * 0.88,
        baseZ: bz * 0.88,
        phase: b * 1.5 + s * 0.65
      });
    }
  }

  planet.add(pad);
  planet.pad = pad;

  // ---------- Online 3D NASA Outpost Models & Orbital ISS ----------
  // 1. NASA Apollo Lunar Module (.glb) parked near the landing pad
  sharedGLTFLoader.load(
    "./assets/models/lunar_lander.glb",
    (gltf) => {
      const lander = fitModelToHeight(gltf.scene, 4.4);
      const lx = 10.2;
      const lz = -6.4;
      lander.position.set(lx, getSurfaceY(radius, lx, lz) - 0.1, lz);
      lander.rotation.y = -0.6;
      planet.add(lander);
    },
    undefined,
    () => {}
  );

  // 2. NASA Planetary Habitat Base (.glb)
  sharedGLTFLoader.load(
    "./assets/models/habitat_base.glb",
    (gltf) => {
      const hab = fitModelToHeight(gltf.scene, 5.2);
      const hx = -11.5;
      const hz = -7.8;
      hab.position.set(hx, getSurfaceY(radius, hx, hz) - 0.15, hz);
      hab.rotation.y = 0.75;
      planet.add(hab);
    },
    undefined,
    () => {}
  );

  // 3. NASA EVA Astronaut (.glb) near the landing pad
  sharedGLTFLoader.load(
    "./assets/models/astronaut.glb",
    (gltf) => {
      const astro = fitModelToHeight(gltf.scene, 1.85);
      const ax = 5.4;
      const az = 3.6;
      astro.position.set(ax, getSurfaceY(radius, ax, az), az);
      astro.rotation.y = -2.2;
      planet.add(astro);
    },
    undefined,
    () => {}
  );

  // 4. NASA International Space Station (.glb) in low planetary orbit
  sharedGLTFLoader.load(
    "./assets/models/iss.glb",
    (gltf) => {
      const iss = fitModelToHeight(gltf.scene, 18.0);
      iss.position.set(22, radius + 34, -36);
      iss.rotation.set(0.18, 0.6, -0.12);
      planet.add(iss);
      planet.issOrbitModel = iss;
    },
    undefined,
    () => {}
  );

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
    const dist = 12 + Math.random() * 48;
    const ang = Math.random() * Math.PI * 2;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    const ry = getSurfaceY(radius, rx, rz);

    if (i % 3 === 0) {
      const h = 1.4 + Math.random() * 3.2;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.45 + Math.random() * 0.4, h, 6), crystalMat);
      spire.position.set(rx, ry + h * 0.4, rz);
      spire.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
      planet.add(spire);
    } else {
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
  planet.glbMixers = [];
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

  // Also load real animated Khronos/Three.js 3D GLB wildlife (Fox, Flamingo, Parrot, Stork)
  const glbWildlife = [
    { url: "./assets/models/fox.glb", scale: 0.022, flying: false, speed: 3.1, count: 3 },
    { url: "./assets/models/flamingo.glb", scale: 0.022, flying: true, speed: 4.5, count: 2 },
    { url: "./assets/models/parrot.glb", scale: 0.024, flying: true, speed: 4.8, count: 2 },
    { url: "./assets/models/stork.glb", scale: 0.022, flying: true, speed: 4.2, count: 2 }
  ];

  glbWildlife.forEach((spec) => {
    sharedGLTFLoader.load(
      spec.url,
      (gltf) => {
        for (let c = 0; c < spec.count; c++) {
          // Use first instance directly or clone for simple rigid/mesh hierarchy
          const wrapper = new THREE.Group();
          const modelInstance = c === 0 ? gltf.scene : gltf.scene.clone(true);
          modelInstance.scale.setScalar(spec.scale);
          wrapper.add(modelInstance);

          if (c === 0 && gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(modelInstance);
            const clip = gltf.animations[gltf.animations.length - 1];
            const action = mixer.clipAction(clip);
            action.play();
            planet.glbMixers.push(mixer);
          }

          const dist = 10 + Math.random() * 26;
          const ang = Math.random() * Math.PI * 2;
          const x = Math.cos(ang) * dist;
          const z = Math.sin(ang) * dist;
          const floatOffset = spec.flying ? 3.8 + Math.random() * 2.5 : 0;
          const y = getSurfaceY(radius, x, z) + floatOffset;

          wrapper.position.set(x, y, z);
          const heading = Math.random() * Math.PI * 2;
          wrapper.rotation.y = heading;

          wrapper.userData = {
            type: spec.flying ? "floater" : "hopper",
            speed: spec.speed,
            heading,
            turnRate: (Math.random() - 0.5) * 0.7,
            timer: Math.random() * 10,
            floatOffset,
            floating: spec.flying,
            limbs: []
          };

          animalRoot.add(wrapper);
          planet.animals.push(wrapper);
        }
      },
      undefined,
      () => {}
    );
  });

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
    const carapace = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), bodyMat);
    carapace.scale.set(1.15, 0.52, 1.35);
    carapace.position.y = 0.42;
    g.add(carapace);

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
  if (!planet) return;
  const radius = planet.radius || 85;

  // Update GLB skeletal animation mixers
  if (planet.glbMixers) {
    for (const m of planet.glbMixers) {
      m.update(dt);
    }
  }

  // Animate landing pad perimeter steam puffs
  if (planet.padSteamPuffs) {
    for (const p of planet.padSteamPuffs) {
      p.phase += dt * 0.9;
      const cycle = p.phase % 2.2;
      const norm = cycle / 2.2;
      p.sprite.position.y = 0.2 + norm * 2.4;
      p.sprite.position.x = p.baseX + Math.sin(p.phase * 2.1) * 0.35;
      p.sprite.position.z = p.baseZ + Math.cos(p.phase * 1.9) * 0.35;
      p.sprite.scale.setScalar(0.95 + norm * 2.2);
      p.sprite.material.opacity = Math.sin(norm * Math.PI) * 0.38;
    }
  }

  // Gently orbit the ISS above the planet
  if (planet.issOrbitModel) {
    planet.issOrbitModel.rotation.y += dt * 0.08;
  }

  if (!planet.animals) return;
  for (const a of planet.animals) {
    const ud = a.userData;
    ud.timer += dt;

    ud.heading += ud.turnRate * dt;
    const vx = Math.sin(ud.heading) * ud.speed;
    const vz = Math.cos(ud.heading) * ud.speed;

    a.position.x += vx * dt;
    a.position.z += vz * dt;

    const distFromPad = Math.hypot(a.position.x, a.position.z);
    if (distFromPad > 46) {
      ud.heading = Math.atan2(-a.position.x, -a.position.z) + (Math.random() - 0.5) * 0.5;
    } else if (distFromPad < 7.5) {
      ud.heading = Math.atan2(a.position.x, a.position.z) + (Math.random() - 0.5) * 0.4;
    }

    if (Math.random() < 0.015) {
      ud.turnRate = (Math.random() - 0.5) * 1.1;
    }

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

    const limbs = ud.limbs || [];
    for (let i = 0; i < limbs.length; i++) {
      const phase = ud.timer * 6 + i * 1.4;
      limbs[i].rotation.x = Math.sin(phase) * 0.35;
    }
  }
};

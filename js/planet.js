/**
 * Stellar Voyage — Colossal Planet, Physical Rayleigh/Mie Atmosphere Shader,
 * Volumetric Rotating Cloud Layer, NASA Surface Maps, Outpost & Fauna
 * North Pole landing pad is at local (0, radius, 0).
 * When planet is placed at world (0, -radius, 0), the landing pad is at world (0, 0, 0).
 */

import * as THREE from "three";
import { makePlanetTextures } from "./textures.js";
import { sharedGLTFLoader, sharedTexLoader } from "./ship.js";

export const PLANET_RADIUS = 680;

export const SYSTEMS = [
  {
    name: "KEPLER-442b",
    biome: "VERDANT XENO-PLAINS",
    textureUrl: "./assets/textures/earth.jpg",
    tintHex: 0xa7f3d0,
    base: [0.16, 0.38, 0.28],
    accent: [0.28, 0.58, 0.42],
    atmosHex: 0x38bdf8,
    horizonHex: 0x7dd3fc,
    sunsetHex: 0xf97316,
    cloudColor: 0xf0f9ff,
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
    horizonHex: 0xfdba74,
    sunsetHex: 0xef4444,
    cloudColor: 0xffedd5,
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
    atmosHex: 0x60a5fa,
    horizonHex: 0xa5f3fc,
    sunsetHex: 0xc084fc,
    cloudColor: 0xe0f2fe,
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
    horizonHex: 0xfef08a,
    sunsetHex: 0xf59e0b,
    cloudColor: 0xfef9c3,
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
    horizonHex: 0xe9d5ff,
    sunsetHex: 0xf43f5e,
    cloudColor: 0xf3e8ff,
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

// High-detail procedural weather & cyclone cloud map for the atmospheric cloud deck
function createPlanetaryCloudTexture(seed = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 256);

  let s = seed * 4999 + 17;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // Soft zonal cloud bands + swirling storm cells
  for (let i = 0; i < 240; i++) {
    const x = rand() * 512;
    const y = rand() * 256;
    const rx = 18 + rand() * 68;
    const ry = 5 + rand() * 18;
    const alpha = 0.08 + rand() * 0.22;

    const grad = ctx.createRadialGradient(x, y, 1, x, y, rx);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.55, `rgba(240, 249, 255, ${alpha * 0.55})`);
    grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.0, ry / rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

// Custom GLSL ShaderMaterial for Physical Rayleigh/Mie Atmospheric Scattering
function createAtmosphereShaderMaterial(sys, isOuterHalo = false) {
  const dayCol = new THREE.Color(sys.atmosHex);
  const horizonCol = new THREE.Color(sys.horizonHex || sys.atmosHex);
  const sunsetCol = new THREE.Color(sys.sunsetHex || 0xf97316);

  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.55, 0.72, 0.42).normalize() },
      uDayColor: { value: dayCol },
      uHorizonColor: { value: horizonCol },
      uSunsetColor: { value: sunsetCol },
      uOuter: { value: isOuterHalo ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uDayColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunsetColor;
      uniform float uOuter;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 n = normalize(vWorldNormal);

        // Sun illumination & terminator wrap
        float sunDot = dot(n, uSunDir);
        float dayFactor = smoothstep(-0.35, 0.55, sunDot);
        float twilight = smoothstep(-0.4, 0.1, sunDot) * (1.0 - smoothstep(0.05, 0.55, sunDot));

        // Optical depth / Fresnel limb scattering
        float ndotv = abs(dot(n, viewDir));
        float fresnel = pow(clamp(1.0 - ndotv, 0.0, 1.0), uOuter > 0.5 ? 2.4 : 1.75);

        vec3 baseAtmos = mix(uDayColor, uHorizonColor, fresnel * 0.75);
        vec3 finalColor = mix(baseAtmos, uSunsetColor, twilight * 0.68);

        // Bright atmospheric rim visible both from orbit and from the surface horizon
        float alpha = fresnel * (0.22 + 0.78 * dayFactor) * (uOuter > 0.5 ? 0.85 : 0.62);
        gl_FragColor = vec4(finalColor * (1.15 + fresnel * 0.6), clamp(alpha, 0.0, 0.92));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: isOuterHalo ? THREE.BackSide : THREE.FrontSide
  });
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

export const buildPlanet = (radius = PLANET_RADIUS, systemIndex = 0) => {
  const sys = SYSTEMS[systemIndex % SYSTEMS.length];
  const planet = new THREE.Group();
  planet.name = "planet";
  planet.radius = radius;
  planet.systemIndex = systemIndex % SYSTEMS.length;
  planet.systemInfo = sys;

  const pTex = makePlanetTextures(systemIndex + 1, sys.base, sys.accent);

  // ==========================================================================
  // 1. COLOSSAL MAIN PLANETARY SPHERE (High-Seg Geometry + NASA Surface Map)
  // ==========================================================================
  const surfaceMat = new THREE.MeshStandardMaterial({
    map: pTex.color,
    normalMap: pTex.normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: pTex.rough,
    roughness: 0.76,
    metalness: 0.08
  });

  if (sys.textureUrl) {
    sharedTexLoader.load(
      sys.textureUrl,
      (nasaTex) => {
        nasaTex.colorSpace = THREE.SRGBColorSpace;
        nasaTex.wrapS = THREE.RepeatWrapping;
        nasaTex.wrapT = THREE.RepeatWrapping;
        nasaTex.repeat.set(3, 2);
        surfaceMat.map = nasaTex;
        surfaceMat.color.setHex(sys.tintHex || 0xffffff);
        surfaceMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );
  }

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 112, 112),
    surfaceMat
  );
  surface.receiveShadow = true;
  planet.add(surface);

  // ==========================================================================
  // 2. MULTI-LAYER PHYSICAL ATMOSPHERE & VOLUMETRIC CLOUD DECK
  // ==========================================================================
  // Layer 2A: Rotating Volumetric Cloud Deck Sphere (at 1.014 * radius, ~9.5m above surface)
  const cloudTex = createPlanetaryCloudTexture(systemIndex + 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudTex,
    color: sys.cloudColor || 0xffffff,
    transparent: true,
    opacity: 0.48,
    roughness: 0.9,
    metalness: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.022, 80, 80),
    cloudMat
  );
  planet.add(cloudMesh);
  planet.cloudMesh = cloudMesh;

  // Layer 2B: Inner Rayleigh Atmospheric Scattering Shell (FrontSide)
  const innerAtmosMat = createAtmosphereShaderMaterial(sys, false);
  const innerAtmos = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.036, 80, 80),
    innerAtmosMat
  );
  planet.add(innerAtmos);

  // Layer 2C: Outer Mie/Rayleigh Atmospheric Corona Halo (BackSide)
  const outerAtmosMat = createAtmosphereShaderMaterial(sys, true);
  const outerAtmos = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.072, 80, 80),
    outerAtmosMat
  );
  planet.add(outerAtmos);

  // Layer 2D: Inner Surface Sky Dome (visible when flying inside the atmosphere or walking on the surface)
  const skyDomeMat = new THREE.ShaderMaterial({
    uniforms: {
      uSkyColor: { value: new THREE.Color(sys.atmosHex) },
      uHorizonColor: { value: new THREE.Color(sys.horizonHex || sys.atmosHex) }
    },
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSkyColor;
      uniform vec3 uHorizonColor;
      varying vec3 vLocalPos;
      void main() {
        // Near North Pole (vLocalPos.y ~ 1.0 is zenith, lower y is horizon)
        float horizonBand = 1.0 - smoothstep(0.82, 0.998, vLocalPos.y);
        vec3 col = mix(uSkyColor * 0.45, uHorizonColor, horizonBand);
        float alpha = smoothstep(0.65, 0.96, vLocalPos.y) * (0.28 + horizonBand * 0.46);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false
  });
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.06, 64, 64),
    skyDomeMat
  );
  planet.add(skyDome);
  planet.skyDome = skyDome;

  // ==========================================================================
  // 3. PLANETARY RING SYSTEM (Scaled for Colossal Planet)
  // ==========================================================================
  if (sys.ringHex) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.32, radius * 1.92, 96),
      new THREE.MeshBasicMaterial({
        color: sys.ringHex,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2.35;
    ring.rotation.y = 0.28;
    planet.add(ring);
  }

  // ==========================================================================
  // 4. NORTH POLE STARPORT LANDING PAD AT LOCAL (0, radius, 0)
  // ==========================================================================
  const pad = new THREE.Group();
  pad.position.set(0, radius, 0);

  const padBase = new THREE.Mesh(
    new THREE.CylinderGeometry(6.8, 7.8, 0.3, 40),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.34 })
  );
  pad.add(padBase);

  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(4.6, 5.3, 40),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.17;
  pad.add(padRing);

  const padCenter = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.85, 32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  padCenter.rotation.x = -Math.PI / 2;
  padCenter.position.y = 0.17;
  pad.add(padCenter);

  // 4 glowing landing beacon pillars + perimeter steam pipes around the pad
  const padSteamTex = createPadSteamTexture();
  planet.padSteamPuffs = [];

  for (let b = 0; b < 4; b++) {
    const ang = (b / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.cos(ang) * 6.0;
    const bz = Math.sin(ang) * 6.0;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 1.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.28 })
    );
    post.position.set(bx, 0.68, bz);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    bulb.position.set(bx, 1.4, bz);
    pad.add(post, bulb);

    for (let s = 0; s < 4; s++) {
      const sMat = new THREE.SpriteMaterial({
        map: padSteamTex,
        transparent: true,
        opacity: 0.38,
        depthWrite: false
      });
      const sp = new THREE.Sprite(sMat);
      sp.position.set(bx * 0.88, 0.25 + s * 0.45, bz * 0.88);
      sp.scale.setScalar(1.3 + s * 0.45);
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

  // ==========================================================================
  // 5. ONLINE 3D NASA OUTPOST MODELS & ORBITAL ISS
  // ==========================================================================
  sharedGLTFLoader.load(
    "./assets/models/lunar_lander.glb",
    (gltf) => {
      const lander = fitModelToHeight(gltf.scene, 4.8);
      const lx = 12.5;
      const lz = -8.0;
      lander.position.set(lx, getSurfaceY(radius, lx, lz) - 0.08, lz);
      lander.rotation.y = -0.6;
      planet.add(lander);
    },
    undefined,
    () => {}
  );

  sharedGLTFLoader.load(
    "./assets/models/habitat_base.glb",
    (gltf) => {
      const hab = fitModelToHeight(gltf.scene, 5.8);
      const hx = -14.0;
      const hz = -9.5;
      hab.position.set(hx, getSurfaceY(radius, hx, hz) - 0.1, hz);
      hab.rotation.y = 0.75;
      planet.add(hab);
    },
    undefined,
    () => {}
  );

  sharedGLTFLoader.load(
    "./assets/models/astronaut.glb",
    (gltf) => {
      const astro = fitModelToHeight(gltf.scene, 1.9);
      const ax = 6.6;
      const az = 4.5;
      astro.position.set(ax, getSurfaceY(radius, ax, az), az);
      astro.rotation.y = -2.2;
      planet.add(astro);
    },
    undefined,
    () => {}
  );

  sharedGLTFLoader.load(
    "./assets/models/iss.glb",
    (gltf) => {
      const iss = fitModelToHeight(gltf.scene, 28.0);
      iss.position.set(36, radius + 68, -62);
      iss.rotation.set(0.18, 0.6, -0.12);
      planet.add(iss);
      planet.issOrbitModel = iss;
    },
    undefined,
    () => {}
  );

  // ==========================================================================
  // 6. VAST PLANETARY LANDSCAPE (Mountains, Crystalline Spires & Boulders)
  // ==========================================================================
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sys.base[0] * 0.85, sys.base[1] * 0.85, sys.base[2] * 0.85),
    roughness: 0.85,
    metalness: 0.15
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: sys.atmosHex,
    emissive: sys.atmosHex,
    emissiveIntensity: 0.38,
    roughness: 0.2,
    metalness: 0.5
  });

  // Near & mid-range spires and boulders (14m to 130m)
  for (let i = 0; i < 110; i++) {
    const dist = 14 + Math.random() * 115;
    const ang = Math.random() * Math.PI * 2;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    const ry = getSurfaceY(radius, rx, rz);

    if (i % 3 === 0) {
      const h = 1.8 + Math.random() * 5.2;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.55 + Math.random() * 0.7, h, 6),
        crystalMat
      );
      spire.position.set(rx, ry + h * 0.42, rz);
      spire.rotation.set(
        (Math.random() - 0.5) * 0.22,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.22
      );
      planet.add(spire);
    } else {
      const s = 1.0 + Math.random() * 3.4;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
      rock.position.set(rx, ry + s * 0.35, rz);
      rock.scale.set(1.3, 0.68, 1.05);
      rock.rotation.y = Math.random() * Math.PI;
      planet.add(rock);
    }
  }

  // Distant colossal mountain peaks along the horizon ring (140m to 260m)
  for (let m = 0; m < 36; m++) {
    const dist = 135 + Math.random() * 120;
    const ang = (m / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const mx = Math.cos(ang) * dist;
    const mz = Math.sin(ang) * dist;
    const my = getSurfaceY(radius, mx, mz);
    const mh = 14 + Math.random() * 28;
    const mw = 12 + Math.random() * 18;

    const peak = new THREE.Mesh(new THREE.ConeGeometry(mw, mh, 7), rockMat);
    peak.position.set(mx, my + mh * 0.38, mz);
    peak.rotation.y = Math.random() * Math.PI;
    planet.add(peak);
  }

  // ---------- Animals Container ----------
  planet.animals = [];
  planet.glbMixers = [];
  planet.animalRoot = new THREE.Group();
  planet.add(planet.animalRoot);

  return planet;
};

export const spawnAnimals = (planet, count = 34) => {
  const { animalRoot, radius, systemInfo } = planet;
  const types = ["grazer", "floater", "skitter", "hopper"];
  const palette = systemInfo ? systemInfo.faunaColors : [0x6ee7b7, 0xfbbf24, 0xc084fc, 0x38bdf8];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const col = palette[i % palette.length];
    const animal = buildAnimal(type, col);

    const dist = 10 + Math.random() * 58;
    const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const y = getSurfaceY(radius, x, z);

    const floatOffset = type === "floater" ? 2.6 + Math.random() * 2.8 : 0;
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

          const dist = 11 + Math.random() * 40;
          const ang = Math.random() * Math.PI * 2;
          const x = Math.cos(ang) * dist;
          const z = Math.sin(ang) * dist;
          const floatOffset = spec.flying ? 4.0 + Math.random() * 3.0 : 0;
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
  const radius = planet.radius || PLANET_RADIUS;

  // Slowly rotate the planetary cloud deck
  if (planet.cloudMesh) {
    planet.cloudMesh.rotation.y += dt * 0.008;
  }

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
    if (distFromPad > 72) {
      ud.heading = Math.atan2(-a.position.x, -a.position.z) + (Math.random() - 0.5) * 0.5;
    } else if (distFromPad < 8.5) {
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

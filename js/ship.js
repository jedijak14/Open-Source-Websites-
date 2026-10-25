// ============================================================================
// STELLAR VOYAGE — Online 3D Spaceship Loader & Volumetric Landing Steam System
// Loads real online 3D models (.glb / .obj) via GLTFLoader & OBJLoader:
//   1. ./assets/models/SpaceFighter01.obj + F01_512.jpg (Textured Space Fighter)
//   2. ./assets/models/shuttle_orbiter.glb (NASA Space Shuttle Orbiter GLB)
//   3. ./assets/models/spaceship.glb (Sci-Fi Deep-Space Cruiser GLB)
//   4. ./assets/models/space_shuttle_hd.glb (High-Detail Shuttle GLB)
// Includes animated hydraulic tricycle landing gear, aft boarding ramp,
// rotating quantum ring, twin ion plumes, and a 85-puff 3D landing steam system.
// ============================================================================

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { Textures } from "./textures.js?v=7";

// Shared 3D loaders with local Draco WASM decoder
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./vendor/three/examples/jsm/libs/draco/gltf/");
export const sharedGLTFLoader = new GLTFLoader();
sharedGLTFLoader.setDRACOLoader(dracoLoader);
export const sharedOBJLoader = new OBJLoader();
export const sharedTexLoader = new THREE.TextureLoader();

export const SHIP_MODEL_NAMES = [
  "STARFIGHTER MK-I (ONLINE OBJ + ORBITER GLB)",
  "NASA ORBITER OV-105 (ONLINE GLB)",
  "VANGUARD CRUISER (ONLINE GLB)",
  "HEAVY SHUTTLE MK-IV (ONLINE GLB)"
];

// Multi-lobed volumetric soft cloud puff texture for landing & takeoff steam
function createSteamCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 128, 128);
  const lobes = [
    { x: 64, y: 64, r: 58, a: 0.58 },
    { x: 46, y: 56, r: 38, a: 0.36 },
    { x: 82, y: 58, r: 36, a: 0.36 },
    { x: 58, y: 78, r: 36, a: 0.34 },
    { x: 70, y: 48, r: 34, a: 0.32 }
  ];

  lobes.forEach((l) => {
    const grad = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
    grad.addColorStop(0.0, `rgba(248, 252, 255, ${l.a})`);
    grad.addColorStop(0.38, `rgba(220, 238, 252, ${l.a * 0.72})`);
    grad.addColorStop(0.72, `rgba(180, 212, 240, ${l.a * 0.28})`);
    grad.addColorStop(1.0, "rgba(160, 200, 235, 0.0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function normalizeAndCenterModel(object3d, targetLength = 7.4) {
  object3d.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetLength / maxDim;

  const wrapper = new THREE.Group();
  object3d.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  object3d.scale.setScalar(scale);
  wrapper.add(object3d);
  return wrapper;
}

export const buildShip = () => {
  const ship = new THREE.Group();
  ship.name = "ship";

  const hullMat = new THREE.MeshPhysicalMaterial({
    map: Textures.three.metalColor,
    normalMap: Textures.three.metalNormal,
    roughnessMap: Textures.three.metalRough,
    color: 0xdbeafe,
    metalness: 0.85,
    roughness: 0.26,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18
  });

  const darkAlloy = new THREE.MeshStandardMaterial({
    map: Textures.three.metalColor,
    normalMap: Textures.three.metalNormal,
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.36
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.96,
    roughness: 0.14
  });

  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  // ==========================================================================
  // 1. ONLINE 3D SPACESHIP HULLS (GLTFLoader & OBJLoader)
  // ==========================================================================
  const onlineHullRoot = new THREE.Group();
  ship.add(onlineHullRoot);

  // Instant sleek fallback frame while async GLB/OBJ models finish loading (~50ms)
  const fallbackFrame = new THREE.Group();
  const fbSpine = new THREE.Mesh(new THREE.ConeGeometry(0.95, 6.2, 16), hullMat);
  fbSpine.rotation.x = -Math.PI / 2;
  const fbWings = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 2.2), hullMat);
  fbWings.position.set(0, -0.06, 0.8);
  fallbackFrame.add(fbSpine, fbWings);
  onlineHullRoot.add(fallbackFrame);

  const hullVariants = [
    new THREE.Group(), // 0: Starfighter MK-I (Textured OBJ + NASA Orbiter GLB composite)
    new THREE.Group(), // 1: NASA Space Shuttle Orbiter (.glb)
    new THREE.Group(), // 2: Vanguard Deep-Space Cruiser (.glb)
    new THREE.Group()  // 3: Heavy Shuttle Stack (.glb)
  ];
  hullVariants.forEach((v, idx) => {
    v.visible = idx === 0;
    onlineHullRoot.add(v);
  });
  ship.hullVariants = hullVariants;
  ship.currentModelIndex = 0;

  // Load 1: Textured SpaceFighter01.obj + F01_512.jpg
  const fighterTex = sharedTexLoader.load("./assets/models/F01_512.jpg");
  fighterTex.colorSpace = THREE.SRGBColorSpace;

  sharedOBJLoader.load(
    "./assets/models/SpaceFighter01.obj",
    (obj) => {
      const fighterMat = new THREE.MeshPhysicalMaterial({
        map: fighterTex,
        normalMap: Textures.three.metalNormal,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.3,
        metalness: 0.76,
        clearcoat: 0.55
      });
      obj.traverse((child) => {
        if (child.isMesh) {
          child.material = fighterMat;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      const rotGroup = new THREE.Group();
      obj.rotation.y = Math.PI; // Nose at -Z
      rotGroup.add(obj);
      const norm = normalizeAndCenterModel(rotGroup, 7.6);
      norm.position.set(0, 0.08, 0.15);
      hullVariants[0].add(norm);
      fallbackFrame.visible = false;
    },
    undefined,
    () => {}
  );

  // Load 2: Official NASA Space Shuttle Orbiter (.glb)
  sharedGLTFLoader.load(
    "./assets/models/shuttle_orbiter.glb",
    (gltf) => {
      const scene = gltf.scene;
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material = child.material.clone();
            child.material.normalMap = Textures.three.metalNormal;
            child.material.normalScale = new THREE.Vector2(0.35, 0.35);
            child.material.metalness = 0.55;
            child.material.roughness = 0.34;
          }
        }
      });
      const rotGroup = new THREE.Group();
      scene.rotation.y = -Math.PI / 2; // Nose at -Z
      rotGroup.add(scene);
      const norm = normalizeAndCenterModel(rotGroup, 7.8);
      norm.position.set(0, 0.22, -0.1);
      hullVariants[1].add(norm);

      // Mount sleek dorsal orbiter fuselage onto Variant 0 for hybrid command bridge
      const dorsalClone = norm.clone(true);
      dorsalClone.scale.set(0.82, 0.78, 0.88);
      dorsalClone.position.set(0, 0.25, -0.15);
      hullVariants[0].add(dorsalClone);
      fallbackFrame.visible = false;
    },
    undefined,
    () => {}
  );

  // Load 3: Sci-Fi Deep-Space Cruiser (.glb)
  sharedGLTFLoader.load(
    "./assets/models/spaceship.glb",
    (gltf) => {
      const scene = gltf.scene;
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material = child.material.clone();
            child.material.normalMap = Textures.three.metalNormal;
            child.material.normalScale = new THREE.Vector2(0.5, 0.5);
            child.material.metalness = 0.75;
            child.material.roughness = 0.28;
          }
        }
      });
      const rotGroup = new THREE.Group();
      scene.rotation.y = Math.PI; // Nose at -Z
      rotGroup.add(scene);
      const norm = normalizeAndCenterModel(rotGroup, 7.8);
      norm.position.set(0, 0.14, 0.0);
      hullVariants[2].add(norm);
      fallbackFrame.visible = false;
    },
    undefined,
    () => {}
  );

  // Load 4: High-Detail Space Shuttle (.glb)
  sharedGLTFLoader.load(
    "./assets/models/space_shuttle_hd.glb",
    (gltf) => {
      const scene = gltf.scene;
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material = child.material.clone();
            child.material.metalness = 0.58;
            child.material.roughness = 0.34;
          }
        }
      });
      const rotGroup = new THREE.Group();
      scene.rotation.x = -Math.PI / 2;
      rotGroup.add(scene);
      const norm = normalizeAndCenterModel(rotGroup, 7.8);
      norm.position.set(0, 0.2, 0.0);
      hullVariants[3].add(norm);
    },
    undefined,
    () => {}
  );

  // ==========================================================================
  // 2. ROTATING QUANTUM HYPERDRIVE RING & TWIN ION THRUSTERS
  // ==========================================================================
  const quantumRing = new THREE.Group();
  const ringTorus = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.075, 14, 48), darkAlloy);
  const ringGlow = new THREE.Mesh(
    new THREE.TorusGeometry(1.66, 0.032, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  quantumRing.add(ringTorus, ringGlow);
  quantumRing.position.set(0, 0.08, 1.45);
  ship.add(quantumRing);
  ship.__quantumRing = quantumRing;

  const thrusters = [];
  for (const side of [-1, 1]) {
    const nacelle = new THREE.Group();
    nacelle.position.set(side * 1.32, -0.05, 1.65);

    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.4, 20), darkAlloy);
    pod.rotation.x = Math.PI / 2;
    nacelle.add(pod);

    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.36, 0.48, 20, 1, true),
      chromeMat
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 1.32;
    nacelle.add(nozzle);

    const plumeGroup = new THREE.Group();
    plumeGroup.position.set(0, 0, 1.55);

    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const outerCone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.6, 20, 1, true), outerMat);
    outerCone.rotation.x = Math.PI / 2;
    outerCone.position.z = 1.25;

    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const innerCone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 16), innerMat);
    innerCone.rotation.x = Math.PI / 2;
    innerCone.position.z = 0.8;

    plumeGroup.add(outerCone, innerCone);
    plumeGroup.userData = { outer: outerCone, inner: innerCone };
    nacelle.add(plumeGroup);
    thrusters.push(plumeGroup);

    ship.add(nacelle);
  }
  ship.userData.thrusters = thrusters;

  const engineLight = new THREE.PointLight(0x38bdf8, 2.8, 18);
  engineLight.position.set(0, 0, 3.8);
  ship.add(engineLight);
  ship.__engineLight = engineLight;

  // ==========================================================================
  // 3. ANIMATED HYDRAULIC TRICYCLE LANDING GEAR
  // ==========================================================================
  const gearStruts = [];
  const gearCoords = [
    [0, -0.35, -1.85],   // Nose gear
    [-1.45, -0.35, 1.15], // Left main gear
    [1.45, -0.35, 1.15]   // Right main gear
  ];

  gearCoords.forEach(([gx, gy, gz]) => {
    const pivot = new THREE.Group();
    pivot.position.set(gx, gy, gz);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 10), darkAlloy);
    upper.position.y = -0.32;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.58, 10), chromeMat);
    lower.position.y = -0.72;
    const footPad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.62), darkAlloy);
    footPad.position.set(0, -1.04, 0.04);
    const padLight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.06), cyanGlow);
    padLight.position.set(0, -1.0, -0.24);

    pivot.add(upper, lower, footPad, padLight);
    ship.add(pivot);
    gearStruts.push(pivot);
  });

  // ==========================================================================
  // 4. ANIMATED AFT BOARDING RAMP & BELLY VTOL RETRO-THRUSTERS
  // ==========================================================================
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, -0.32, 2.35);

  const rampSlab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 1.65), darkAlloy);
  rampSlab.position.set(0, 0, 0.82);
  rampPivot.add(rampSlab);

  for (const rx of [-0.4, 0.4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 1.52), cyanGlow);
    strip.position.set(rx, 0.04, 0.82);
    rampPivot.add(strip);
  }
  ship.add(rampPivot);

  const retroCones = [];
  [
    [0, -0.38, -1.5],
    [-1.25, -0.38, 0.9],
    [1.25, -0.38, 0.9],
    [0, -0.38, 1.75]
  ].forEach(([rx, ry, rz]) => {
    const rMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const rCone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.55, 14), rMat);
    rCone.rotation.x = Math.PI;
    rCone.position.set(rx, ry - 0.72, rz);
    rCone.visible = false;
    ship.add(rCone);
    retroCones.push(rCone);
  });

  const bellyLight = new THREE.PointLight(0x7dd3fc, 0, 15);
  bellyLight.position.set(0, -1.1, 0);
  ship.add(bellyLight);

  // ==========================================================================
  // 5. VOLUMETRIC 3D LANDING & TAKEOFF STEAM / VAPOR CLOUD SYSTEM
  // 85 billowing cloud sprites + 4 high-pressure lateral steam relief vents
  // ==========================================================================
  const steamGroup = new THREE.Group();
  ship.add(steamGroup);

  const steamTex = createSteamCloudTexture();
  const steamParticles = [];
  const STEAM_COUNT = 85;

  const emitterOffsets = [
    new THREE.Vector3(0, -0.52, -1.45),    // Forward VTOL & nose gear steam valve
    new THREE.Vector3(-1.35, -0.52, 0.95), // Port main gear hydraulic steam vent
    new THREE.Vector3(1.35, -0.52, 0.95),  // Starboard main gear hydraulic steam vent
    new THREE.Vector3(-1.32, -0.3, 2.55),  // Port aft thruster pad wash
    new THREE.Vector3(1.32, -0.3, 2.55),   // Starboard aft thruster pad wash
    new THREE.Vector3(0, -0.48, 2.1)       // Aft boarding ramp pneumatic exhaust
  ];

  for (let i = 0; i < STEAM_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex,
      color: 0xeaf6ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    steamGroup.add(sprite);

    steamParticles.push({
      sprite,
      mat,
      age: Math.random() * 2.2,
      maxLife: 1.4 + Math.random() * 1.4,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      startScale: 1.0 + Math.random() * 0.75,
      endScale: 4.2 + Math.random() * 3.8,
      rotSpeed: (Math.random() - 0.5) * 1.8,
      emitterIdx: i % emitterOffsets.length,
      active: false
    });
  }

  // 4 High-Pressure Lateral Steam Relief Jets on the fuselage sides
  const sideSteamVents = [];
  [
    [-1.05, -0.22, -0.65, -1],
    [1.05, -0.22, -0.65, 1],
    [-1.4, -0.22, 1.35, -1],
    [1.4, -0.22, 1.35, 1]
  ].forEach(([vx, vy, vz, dirX]) => {
    const ventMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const ventCone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 12, 1, true), ventMat);
    ventCone.rotation.z = dirX * (Math.PI / 2 - 0.22);
    ventCone.position.set(vx + dirX * 1.05, vy - 0.22, vz);
    ventCone.visible = false;
    ship.add(ventCone);
    sideSteamVents.push({ mesh: ventCone, mat: ventMat });
  });

  const steamLight = new THREE.PointLight(0xdbeafe, 0.0, 24);
  steamLight.position.set(0, -0.9, 0.3);
  ship.add(steamLight);

  ship.steamIntensity = 0.0;
  ship.gearProgress = 0.0;
  ship.rampProgress = 0.0;
  ship.retroIntensity = 0.0;

  // ==========================================================================
  // 6. CONTROLLER METHODS ON `ship`
  // ==========================================================================
  ship.setGearProgress = (p) => {
    const clamped = THREE.MathUtils.clamp(p, 0, 1);
    ship.gearProgress = clamped;
    gearStruts.forEach((strut, i) => {
      strut.visible = clamped > 0.02;
      const fold = (1 - clamped) * 1.35;
      if (i === 0) strut.rotation.x = -fold;
      else if (i === 1) strut.rotation.z = -fold;
      else strut.rotation.z = fold;
      strut.scale.set(1, Math.max(0.05, clamped), 1);
    });
  };

  ship.setRampProgress = (p) => {
    const clamped = THREE.MathUtils.clamp(p, 0, 1);
    ship.rampProgress = clamped;
    rampPivot.visible = clamped > 0.02;
    rampPivot.rotation.x = THREE.MathUtils.lerp(-1.1, 0.36, clamped);
  };

  ship.setRetroIntensity = (p) => {
    const clamped = THREE.MathUtils.clamp(p, 0, 1);
    ship.retroIntensity = clamped;
    bellyLight.intensity = clamped * 4.5;
    retroCones.forEach((cone, idx) => {
      cone.visible = clamped > 0.02;
      const flicker = 0.8 + Math.sin(performance.now() * 0.035 + idx) * 0.2;
      cone.material.opacity = clamped * 0.82 * flicker;
      cone.scale.set(1, Math.max(0.05, clamped * flicker), 1);
    });
  };

  ship.setSteamIntensity = (p) => {
    ship.steamIntensity = THREE.MathUtils.clamp(p, 0, 1);
  };

  // Erupt a 360-degree radial shockwave of dense white steam clouds across the landing pad!
  ship.triggerSteamBurst = () => {
    ship.steamIntensity = 1.0;
    const groundY = -1.28;
    steamParticles.forEach((p, idx) => {
      const angle = (idx / steamParticles.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radialSpeed = 3.2 + Math.random() * 5.8;
      const dist = 0.7 + Math.random() * 1.6;

      p.pos.set(
        Math.cos(angle) * dist,
        groundY + Math.random() * 0.35,
        Math.sin(angle) * dist
      );
      p.vel.set(
        Math.cos(angle) * radialSpeed,
        0.5 + Math.random() * 1.4,
        Math.sin(angle) * radialSpeed
      );
      p.age = Math.random() * 0.22;
      p.maxLife = 1.8 + Math.random() * 1.5;
      p.startScale = 1.4 + Math.random() * 0.9;
      p.endScale = 5.2 + Math.random() * 4.0;
      p.active = true;
      p.sprite.visible = true;
    });
  };

  function respawnSteamParticle(p) {
    const emitter = emitterOffsets[p.emitterIdx];
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.24 + Math.random() * 0.45;
    const intensity = Math.max(0.18, ship.steamIntensity);

    p.pos.set(
      emitter.x + Math.cos(angle) * spread,
      emitter.y - Math.random() * 0.18,
      emitter.z + Math.sin(angle) * spread
    );

    const outDirX =
      emitter.x !== 0
        ? Math.sign(emitter.x) * (1.6 + Math.random() * 3.0)
        : Math.cos(angle) * (1.8 + Math.random() * 2.8);
    const outDirZ =
      emitter.z > 1.2
        ? 1.9 + Math.random() * 3.4
        : Math.sin(angle) * (1.8 + Math.random() * 2.8);

    p.vel.set(
      outDirX * (0.45 + intensity * 0.85),
      -(2.0 + intensity * 2.8) + Math.random() * 0.5,
      outDirZ * (0.45 + intensity * 0.85)
    );

    p.age = 0;
    p.maxLife = 1.35 + Math.random() * 1.35;
    p.startScale = (0.85 + Math.random() * 0.7) * (0.65 + intensity * 0.55);
    p.endScale = (3.6 + Math.random() * 4.0) * (0.7 + intensity * 0.65);
    p.active = true;
    p.sprite.visible = true;
  }

  ship.updateSteam = (dt, time = performance.now() * 0.001) => {
    const steamInt = THREE.MathUtils.clamp(ship.steamIntensity || 0, 0, 1);
    steamLight.intensity = steamInt * 3.8 * (0.85 + Math.sin(time * 18) * 0.15);

    sideSteamVents.forEach((v, idx) => {
      const burstWave = Math.max(0, Math.sin(time * 7.5 + idx * 1.6));
      const vAlpha = steamInt * 0.48 * (0.45 + 0.55 * burstWave);
      v.mat.opacity = vAlpha;
      v.mesh.visible = vAlpha > 0.02;
      const sLen = 0.65 + steamInt * 0.8 * burstWave;
      v.mesh.scale.set(0.75 + 0.35 * burstWave, sLen, 0.75 + 0.35 * burstWave);
    });

    const groundPlaneY = -1.32;

    steamParticles.forEach((p) => {
      if (!p.active) {
        if (steamInt > 0.03) {
          respawnSteamParticle(p);
        } else {
          p.sprite.visible = false;
          return;
        }
      }

      p.age += dt;
      if (p.age >= p.maxLife) {
        if (steamInt > 0.03) {
          respawnSteamParticle(p);
        } else {
          p.active = false;
          p.sprite.visible = false;
          return;
        }
      }

      const lifeRatio = p.age / p.maxLife;
      p.pos.addScaledVector(p.vel, dt);

      if (p.pos.y < groundPlaneY) {
        p.pos.y = groundPlaneY + Math.random() * 0.08;
        const horizLen = Math.hypot(p.pos.x, p.pos.z) || 0.01;
        const pushOut = 2.6 + steamInt * 4.5;
        p.vel.x += (p.pos.x / horizLen) * pushOut * dt * 4.5;
        p.vel.z += (p.pos.z / horizLen) * pushOut * dt * 4.5;
        p.vel.y = 0.38 + Math.random() * 0.7;
      } else {
        p.vel.y += 0.58 * dt;
        p.vel.x *= Math.pow(0.52, dt);
        p.vel.z *= Math.pow(0.52, dt);
      }

      p.pos.x += Math.sin(time * 2.8 + p.emitterIdx) * 0.38 * dt;
      p.pos.z += Math.cos(time * 2.4 + p.emitterIdx) * 0.38 * dt;

      p.sprite.position.copy(p.pos);

      const curScale = THREE.MathUtils.lerp(p.startScale, p.endScale, Math.pow(lifeRatio, 0.7));
      p.sprite.scale.set(curScale, curScale * 0.8, curScale);
      p.mat.rotation += p.rotSpeed * dt;

      const fadeIn = Math.min(1.0, lifeRatio * 4.5);
      const fadeOut = Math.pow(1.0 - lifeRatio, 1.45);
      const baseOpacity = Math.max(0.32, steamInt * 0.72);
      p.mat.opacity = fadeIn * fadeOut * baseOpacity;
    });
  };

  ship.cycleHullModel = (nextIndex = null) => {
    ship.currentModelIndex =
      nextIndex !== null
        ? nextIndex % hullVariants.length
        : (ship.currentModelIndex + 1) % hullVariants.length;
    hullVariants.forEach((g, idx) => {
      g.visible = idx === ship.currentModelIndex;
    });
    return SHIP_MODEL_NAMES[ship.currentModelIndex];
  };

  // Initialize stowed gear & closed ramp
  ship.setGearProgress(0);
  ship.setRampProgress(0);
  ship.setRetroIntensity(0);
  ship.setSteamIntensity(0);

  return ship;
};

export const buildSpaceship = buildShip;

export function cycleShipModel(ship, nextIndex = null) {
  if (ship && ship.cycleHullModel) return ship.cycleHullModel(nextIndex);
  return "";
}

export function triggerLandingSteamBurst(ship) {
  if (ship && ship.triggerSteamBurst) ship.triggerSteamBurst();
}

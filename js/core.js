/**
 * Stellar Voyage — Core 3D Engine
 * Features:
 * - Three.js r164 + PMREM RoomEnvironment IBL + UnrealBloomPass HDR Post-Processing
 * - Colossal Planets (R = 680) with Physical Rayleigh/Mie Atmosphere Shader,
 *   Rotating Volumetric Cloud Deck, and Dynamic Atmospheric Sky Entry
 * - Online 3D Spaceship & Outpost Models (.glb / .obj) + Volumetric Landing Steam
 * - Walkable 3-Bay Starship Interior (CAM.SHIP_INTERIOR) with interactive stations
 * - Full Cutscenes: Launch Intro, Multi-Shot Quantum Warp, Hydraulic Landing & Liftoff
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import Audio from "./audio.js";
import { UI } from "./ui.js";
import { buildCockpit } from "./cockpit.js";
import { buildShip } from "./ship.js";
import {
  PLANET_RADIUS,
  SYSTEMS,
  buildPlanet,
  spawnAnimals,
  updateAnimals,
  getSurfaceY
} from "./planet.js";
import { WarpCutscene, FlightCutscene } from "./warp.js";

// ---------------- Constants & State ----------------
const STATE = {
  MENU: "MENU",
  PLAYING: "PLAYING",
  WARP: "WARP",
  CUTSCENE: "CUTSCENE",
  CREDITS: "CREDITS"
};
let state = STATE.MENU;

const CAM = {
  COCKPIT: "COCKPIT",
  SHIP_INTERIOR: "SHIP WALK",
  THIRD: "THIRD PERSON",
  CINEMATIC: "CINEMATIC",
  FOOT: "PLANET WALK"
};

// ---------------- Three.js & Post-Processing Setup ----------------
const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const spaceBgColor = new THREE.Color(0x02040a);
const atmosBgColor = new THREE.Color(0x0f2942);
const blendedSkyColor = new THREE.Color(0x02040a);

const scene = new THREE.Scene();
scene.background = blendedSkyColor;
scene.fog = new THREE.FogExp2(0x02040a, 0.00012);

// Real-time Image-Based Lighting (IBL) for metallic clearcoat PBR reflections
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(
  54,
  window.innerWidth / window.innerHeight,
  0.1,
  14000
);

// HDR Bloom Post-Processing Pipeline
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.52, // strength
  0.4,  // radius
  0.8   // threshold
);
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// ---------------- Scene Lighting ----------------
const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfffbeb, 1.75);
sun.position.set(850, 1150, 620);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ambient = new THREE.AmbientLight(0x334155, 0.68);
scene.add(ambient);

// ---------------- Deep Space Starfield ----------------
const starCount = 3200;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
const starCol = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 2400 + Math.random() * 3200;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);

  const tint = 0.72 + Math.random() * 0.28;
  starCol[i * 3] = tint;
  starCol[i * 3 + 1] = tint;
  starCol[i * 3 + 2] = 1.0;
}
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
const starMat = new THREE.PointsMaterial({
  size: 2.2,
  vertexColors: true,
  transparent: true,
  opacity: 0.92
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ---------------- Entities ----------------
const ship = buildShip();
scene.add(ship);

const cockpit = buildCockpit();
scene.add(cockpit);

let currentSystemIndex = 0;
let planet = null;

const loadPlanetSystem = (sysIdx) => {
  if (planet) {
    scene.remove(planet);
  }
  currentSystemIndex = sysIdx % SYSTEMS.length;
  planet = buildPlanet(PLANET_RADIUS, currentSystemIndex);
  planet.position.set(0, -PLANET_RADIUS, 0); // North Pole Landing Pad is at world (0, 0, 0)
  spawnAnimals(planet, 34);
  scene.add(planet);

  const sys = SYSTEMS[currentSystemIndex];
  UI.setSystem(sys.name);
  UI.setBiome(sys.biome);
};

loadPlanetSystem(0);

// ---------------- Ship, Interior Walk & Planet Foot State ----------------
const shipState = {
  pos: new THREE.Vector3(0, 58, 210),
  vel: new THREE.Vector3(),
  speed: 0,
  maxSpeed: 1.15,
  thrust: 0,
  landed: false,
  yaw: 0,
  pitch: 0, // Level horizon — zero downward drift!
  roll: 0,
  forward: new THREE.Vector3(0, 0, -1),
  up: new THREE.Vector3(0, 1, 0),
  right: new THREE.Vector3(1, 0, 0)
};

// Local coordinates inside the 3-Bay Walkable Ship Interior (z = -0.5 to +8.8, x = -1.55 to +1.55)
const shipWalkState = {
  pos: new THREE.Vector3(0, 0, 1.5),
  yaw: Math.PI, // Initially facing aft toward the Holo-Table & Hyperdrive Reactor Core
  pitch: 0,
  walkTime: 0,
  lastStepPhase: 0
};

// World coordinates on the Planet Surface around the North Pole Landing Pad
const footState = {
  pos: new THREE.Vector3(0, 1.8, 10.5),
  yaw: 0, // Facing the parked starship & roaming alien animals
  pitch: 0,
  walkTime: 0,
  lastStepPhase: 0
};

const cockpitLook = { yaw: 0, pitch: 0 };

// Warp & Cutscene State
let warpCharge = 0;
const warpChargeRate = 52;
let warpReady = false;
let warpAutoTimer = 0;
let warpSfx = null;
let activeCutscene = null;

// Camera Mode
let camMode = CAM.COCKPIT;
let cinematicT = 0;
let menuOrbitT = 0;

// ---------------- Drift-Free Mouse & Keyboard Input ----------------
// Avoids Chromium iframe requestPointerLock() downward movementY warp bug by
// using clean clientX/clientY drag deltas when holding Left or Right mouse button.
const keys = {};
const mouse = { dx: 0, dy: 0 };
let isDraggingMouse = false;
let lastMouseX = null;
let lastMouseY = null;

const euler = new THREE.Euler(0, 0, 0, "YXZ");
const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
const qShip = new THREE.Quaternion();
const qLook = new THREE.Quaternion();
const qFinal = new THREE.Quaternion();

// ---------------- Save / Load ----------------
const SAVE_KEY = "stellarvoyage_save_v3";

const loadGame = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : { warps: 0, systemIndex: 0 };
  } catch (e) {
    return { warps: 0, systemIndex: 0 };
  }
};

const saveGame = () => {
  const prev = loadGame();
  const data = {
    pos: shipState.pos.toArray(),
    yaw: shipState.yaw,
    pitch: shipState.pitch,
    landed: shipState.landed,
    camMode,
    systemIndex: currentSystemIndex,
    warps: (prev.warps || 0) + 1
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {}
  UI.updateSaveState(true);
};

UI.updateSaveState(loadGame().warps > 0);

// ---------------- Audio Init ----------------
const startAudio = () => {
  Audio.start();
  Audio.startMusic();
};
canvas.addEventListener("mousedown", startAudio, { once: true });
canvas.addEventListener("touchstart", startAudio, { once: true });

// ---------------- Mouse Drag Look Listeners (Zero Drift) ----------------
canvas.addEventListener("mousedown", (e) => {
  if (state !== STATE.PLAYING) return;
  isDraggingMouse = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener("mouseup", () => {
  isDraggingMouse = false;
  lastMouseX = null;
  lastMouseY = null;
});

window.addEventListener("blur", () => {
  isDraggingMouse = false;
  lastMouseX = null;
  lastMouseY = null;
  mouse.dx = 0;
  mouse.dy = 0;
});

window.addEventListener("mousemove", (e) => {
  if (!isDraggingMouse || state !== STATE.PLAYING) return;
  if (lastMouseX !== null && lastMouseY !== null) {
    const rawDx = e.clientX - lastMouseX;
    const rawDy = e.clientY - lastMouseY;
    // Clamp per-event delta to prevent any browser jump spikes
    mouse.dx += Math.max(-42, Math.min(42, rawDx));
    mouse.dy += Math.max(-42, Math.min(42, rawDy));
  }
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------- Visibility & Camera Mode Switching ----------------
const syncVisibility = () => {
  if (state === STATE.MENU || state === STATE.CREDITS) {
    ship.visible = true;
    cockpit.visible = false;
    return;
  }
  if (state === STATE.WARP || state === STATE.CUTSCENE) {
    return; // Cutscene director controls ship/cockpit visibility per shot
  }
  if (camMode === CAM.COCKPIT || camMode === CAM.SHIP_INTERIOR) {
    cockpit.visible = true;
    ship.visible = false;
  } else {
    cockpit.visible = false;
    ship.visible = true;
  }
};

const setCam = (mode) => {
  camMode = mode;
  cockpitLook.yaw = 0;
  cockpitLook.pitch = 0;
  mouse.dx = 0;
  mouse.dy = 0;
  UI.setInteractPrompt(null);
  syncVisibility();
  UI.setCam(mode);
  Audio.sfx.switch();

  if (mode === CAM.SHIP_INTERIOR) {
    UI.setFlightState(shipState.landed ? "SHIP DECK (LANDED)" : "SHIP DECK (IN ORBIT)");
    UI.setHelp(
      "<b>WASD</b>: Walk Inside Ship &bull; <b>Drag Mouse / Q&amp;E</b>: Look &bull; <b>E</b>: Use Station (Seat / Holo-Table / Airlock) &bull; <b>I</b>: Sit"
    );
  } else if (mode === CAM.FOOT) {
    UI.setFlightState("PLANET SURFACE");
    UI.setHelp(
      "<b>WASD</b>: Walk Among Alien Animals &bull; <b>Drag Mouse / Q&amp;E</b>: Look &bull; <b>E</b> (near ramp): Board Ship &bull; <b>L</b>: Liftoff"
    );
  } else {
    UI.setFlightState(shipState.landed ? "LANDED ON PAD" : "IN ORBIT");
    UI.setHelp(
      "<b>WASD / Arrows / Drag Mouse</b>: Fly &amp; Steer &bull; <b>I</b>: Walk in Ship &bull; <b>L</b>: Land/Liftoff &bull; <b>H</b>: Ship Hull &bull; <b>SPACE</b>: Warp"
    );
  }
};

const toggleShipInteriorWalk = () => {
  if (state !== STATE.PLAYING) return;
  if (camMode === CAM.SHIP_INTERIOR) {
    setCam(CAM.COCKPIT);
  } else {
    shipWalkState.pos.set(0, 0, 1.35);
    shipWalkState.yaw = Math.PI;
    shipWalkState.pitch = 0;
    setCam(CAM.SHIP_INTERIOR);
  }
};

const cycleCam = () => {
  const order = [CAM.COCKPIT, CAM.THIRD, CAM.CINEMATIC];
  const i = order.indexOf(camMode);
  if (i === -1) {
    setCam(CAM.COCKPIT);
  } else {
    setCam(order[(i + 1) % order.length]);
  }
};

// ---------------- Animated Landing & Takeoff Cutscenes ----------------
const startLandingCutscene = (goOutOnFoot = false) => {
  if (state !== STATE.PLAYING) return;
  if (activeCutscene) activeCutscene.dispose();

  state = STATE.CUTSCENE;
  UI.setInteractPrompt(null);
  const sys = SYSTEMS[currentSystemIndex];
  UI.showWarp(`LANDING ON ${sys.name}`, "DESCENDING THROUGH ATMOSPHERE // LOCKING PAD BEACON");

  activeCutscene = new FlightCutscene(
    "LANDING",
    scene,
    camera,
    ship,
    cockpit,
    () => {
      activeCutscene = null;
      shipState.landed = true;
      shipState.pos.set(0, 1.45, 0);
      shipState.yaw = 0;
      shipState.pitch = 0;
      shipState.roll = 0;
      shipState.speed = 0;
      shipState.thrust = 0;
      ship.setGearProgress(1);
      ship.setRampProgress(1);
      updateShipTransform();

      state = STATE.PLAYING;
      UI.hideWarp();

      if (goOutOnFoot) {
        footState.pos.set(0, 1.8, 9.5);
        footState.yaw = 0;
        footState.pitch = 0;
        setCam(CAM.FOOT);
      } else {
        setCam(CAM.THIRD);
      }
      saveGame();
    },
    (subText) => UI.setWarpSubtext(subText)
  );
};

const startTakeoffCutscene = () => {
  if (state !== STATE.PLAYING) return;
  if (activeCutscene) activeCutscene.dispose();

  state = STATE.CUTSCENE;
  UI.setInteractPrompt(null);
  const sys = SYSTEMS[currentSystemIndex];
  UI.showWarp(`LAUNCHING FROM ${sys.name}`, "SEALING AFT AIRLOCK // VTOL LIFTOFF");

  activeCutscene = new FlightCutscene(
    "TAKEOFF",
    scene,
    camera,
    ship,
    cockpit,
    () => {
      activeCutscene = null;
      shipState.landed = false;
      shipState.pos.set(0, 58, 195);
      shipState.yaw = 0;
      shipState.pitch = 0;
      shipState.roll = 0;
      shipState.speed = 0.25;
      shipState.thrust = 0.35;
      ship.setGearProgress(0);
      ship.setRampProgress(0);
      updateShipTransform();

      state = STATE.PLAYING;
      UI.hideWarp();
      setCam(CAM.COCKPIT);
      saveGame();
    },
    (subText) => UI.setWarpSubtext(subText)
  );
};

const toggleLandOrTakeoff = () => {
  if (state !== STATE.PLAYING) return;
  if (shipState.landed) {
    startTakeoffCutscene();
  } else {
    startLandingCutscene(false);
  }
};

const togglePlanetSurfaceWalk = () => {
  if (state !== STATE.PLAYING) return;
  if (!shipState.landed) {
    startLandingCutscene(true);
  } else if (camMode === CAM.FOOT) {
    shipWalkState.pos.set(0, 0, 7.8);
    shipWalkState.yaw = 0;
    shipWalkState.pitch = 0;
    Audio.sfx.hydraulics();
    setCam(CAM.SHIP_INTERIOR);
  } else {
    footState.pos.set(0, 1.8, 9.5);
    footState.yaw = 0;
    footState.pitch = 0;
    Audio.sfx.hydraulics();
    setCam(CAM.FOOT);
  }
};

// ---------------- Quantum Warp Cutscene ----------------
const engageWarp = () => {
  if (state === STATE.WARP || state === STATE.CUTSCENE) return;
  if (warpSfx) {
    try {
      warpSfx.stop();
    } catch (e) {}
    warpSfx = null;
  }
  if (activeCutscene) {
    activeCutscene.dispose();
    activeCutscene = null;
  }

  shipState.landed = false;
  ship.setGearProgress(0);
  ship.setRampProgress(0);

  warpCharge = 0;
  warpReady = false;
  warpAutoTimer = 0;
  UI.setWarpMeter(100);
  UI.setWarpStatus("QUANTUM FOLD ENGAGED!");
  UI.setInteractPrompt(null);

  const nextSysIndex = (currentSystemIndex + 1) % SYSTEMS.length;
  const nextSys = SYSTEMS[nextSysIndex];

  Audio.stopMusic();
  Audio.sfx.warpEngage();

  state = STATE.WARP;
  UI.showWarp(`WARPING TO ${nextSys.name}`, `DESTINATION BIOME: ${nextSys.biome}`);

  activeCutscene = new WarpCutscene(
    scene,
    camera,
    ship,
    cockpit,
    () => {
      activeCutscene = null;
      loadPlanetSystem(nextSysIndex);

      shipState.landed = false;
      shipState.pos.set(0, 58, 210);
      shipState.vel.set(0, 0, 0);
      shipState.speed = 0;
      shipState.thrust = 0;
      shipState.yaw = 0;
      shipState.pitch = 0;
      shipState.roll = 0;
      cockpitLook.yaw = 0;
      cockpitLook.pitch = 0;
      updateShipTransform();

      state = STATE.PLAYING;
      UI.hideWarp();
      UI.setWarpMeter(0);
      UI.setWarpStatus(`ARRIVED: ${nextSys.name} — PRESS L TO LAND`);
      if (camMode === CAM.FOOT) {
        setCam(CAM.COCKPIT);
      } else {
        syncVisibility();
      }
      Audio.startMusic(nextSysIndex);
      Audio.sfx.arrive();
      saveGame();
    },
    (subText) => UI.setWarpSubtext(subText)
  );
  activeCutscene.start();
};

const cycleOnlineShipHull = () => {
  if (state !== STATE.PLAYING) return;
  const hullName = ship.cycleHullModel ? ship.cycleHullModel() : "";
  Audio.sfx.switch();
  if (camMode === CAM.COCKPIT || camMode === CAM.SHIP_INTERIOR) {
    setCam(CAM.THIRD);
  }
  if (hullName) {
    UI.setWarpStatus(`ACTIVE HULL: ${hullName}`);
  }
};

const chargeWarp = (dt) => {
  if (keys["Space"]) {
    const wasZero = warpCharge === 0;
    warpCharge = Math.min(100, warpCharge + warpChargeRate * dt);
    UI.setWarpMeter(warpCharge);

    if (wasZero) {
      warpSfx = Audio.sfx.warpCharge();
    }

    if (warpCharge < 100) {
      UI.setWarpStatus(`CHARGING HYPERDRIVE CORE... ${Math.round(warpCharge)}%`);
    } else {
      if (!warpReady) {
        warpReady = true;
        UI.setWarpStatus("CHARGED — ENGAGING QUANTUM WARP!");
        Audio.sfx.switch();
      }
      warpAutoTimer += dt;
      if (warpAutoTimer >= 0.2) {
        engageWarp();
      }
    }
  } else {
    warpAutoTimer = 0;
    if (warpCharge > 0 && !warpReady) {
      warpCharge = Math.max(0, warpCharge - 25 * dt);
      UI.setWarpMeter(warpCharge);
      if (warpCharge === 0) {
        UI.setWarpStatus("HOLD SPACE TO CHARGE WARP");
        if (warpSfx) {
          try {
            warpSfx.stop();
          } catch (e) {}
          warpSfx = null;
        }
      }
    }
  }
};

// ---------------- Contextual Interactions (Ship Interior & Ramp) ----------------
const interact = () => {
  if (warpReady || warpCharge >= 95) {
    engageWarp();
    return;
  }

  if (camMode === CAM.SHIP_INTERIOR) {
    const z = shipWalkState.pos.z;
    if (z < 1.1) {
      setCam(CAM.COCKPIT);
      return;
    }
    if (z >= 1.6 && z <= 4.8) {
      warpCharge = 100;
      warpReady = true;
      engageWarp();
      return;
    }
    if (z > 6.4) {
      togglePlanetSurfaceWalk();
      return;
    }
  }

  if (camMode === CAM.FOOT) {
    const distToRamp = Math.hypot(footState.pos.x, footState.pos.z - 3.5);
    if (distToRamp < 5.0) {
      shipWalkState.pos.set(0, 0, 7.8);
      shipWalkState.yaw = 0;
      shipWalkState.pitch = 0;
      Audio.sfx.hydraulics();
      setCam(CAM.SHIP_INTERIOR);
      return;
    }
  }

  if (camMode === CAM.COCKPIT) {
    const sws = cockpit.__switches || [];
    if (sws.length) {
      const idx = Math.floor(Math.random() * sws.length);
      sws[idx].userData.toggle();
    }
  }
};

// ---------------- Input Listeners ----------------
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "Escape") {
    isDraggingMouse = false;
    if (state === STATE.PLAYING) {
      UI.showMenu();
      state = STATE.MENU;
      Audio.updateEngineHum(0, false);
      syncVisibility();
    } else if (state === STATE.CREDITS) {
      UI.hideCredits();
      UI.showMenu();
      state = STATE.MENU;
    }
    return;
  }

  if ((state === STATE.CUTSCENE || state === STATE.WARP) && e.code === "Enter") {
    if (activeCutscene) {
      activeCutscene.finish();
    }
    return;
  }

  if (state === STATE.PLAYING) {
    if (e.code === "KeyI") toggleShipInteriorWalk();
    if (e.code === "KeyL") toggleLandOrTakeoff();
    if (e.code === "KeyC") cycleCam();
    if (e.code === "KeyH") cycleOnlineShipHull();
    if (e.code === "Tab" || e.code === "KeyT") {
      e.preventDefault();
      togglePlanetSurfaceWalk();
    }
    if (e.code === "KeyE" || e.code === "Enter") {
      interact();
    }
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- Transform Helpers ----------------
const updateShipVectors = () => {
  euler.set(shipState.pitch, shipState.yaw, shipState.roll, "YXZ");
  shipState.forward.set(0, 0, -1).applyEuler(euler).normalize();
  shipState.up.set(0, 1, 0).applyEuler(euler).normalize();
  shipState.right.set(1, 0, 0).applyEuler(euler).normalize();
};

const updateShipTransform = () => {
  euler.set(shipState.pitch, shipState.yaw, shipState.roll, "YXZ");
  ship.position.copy(shipState.pos);
  ship.quaternion.setFromEuler(euler);
  ship.updateMatrixWorld();

  cockpit.position.copy(shipState.pos);
  cockpit.quaternion.setFromEuler(euler);
  cockpit.updateMatrixWorld();
};

// ---------------- Dynamic Atmospheric Sky & Fog Transition ----------------
const updateAtmosphericEnvironment = (viewerWorldPos) => {
  const sys = SYSTEMS[currentSystemIndex];
  const distCenter = Math.hypot(
    viewerWorldPos.x,
    viewerWorldPos.y + PLANET_RADIUS,
    viewerWorldPos.z
  );
  const altitude = Math.max(0, distCenter - PLANET_RADIUS);

  // Within 110m of the planet surface, transition from deep space into atmospheric sky scatter!
  const atmosDepth = THREE.MathUtils.clamp(1.0 - altitude / 110.0, 0.0, 1.0);
  const smoothAtmos = atmosDepth * atmosDepth * (3 - 2 * atmosDepth);

  atmosBgColor.setHex(sys.atmosHex || 0x38bdf8).multiplyScalar(0.28);
  blendedSkyColor.copy(spaceBgColor).lerp(atmosBgColor, smoothAtmos);
  scene.fog.color.copy(blendedSkyColor);
  scene.fog.density = THREE.MathUtils.lerp(0.00009, 0.0018, smoothAtmos);

  hemi.color.setHex(sys.horizonHex || sys.atmosHex || 0x7dd3fc);
  hemi.intensity = THREE.MathUtils.lerp(0.85, 1.35, smoothAtmos);
  starMat.opacity = THREE.MathUtils.lerp(0.95, 0.25, smoothAtmos);
};

// ---------------- Menu & HUD Button Wiring ----------------
const startNewOrSavedGame = (useSaved = false) => {
  startAudio();
  if (useSaved) {
    const sv = loadGame();
    if (typeof sv.systemIndex === "number") {
      loadPlanetSystem(sv.systemIndex);
    }
    if (sv.pos && sv.pos.length === 3) {
      shipState.pos.fromArray(sv.pos);
    }
    shipState.yaw = sv.yaw || 0;
    shipState.pitch = sv.pitch || 0;
    shipState.landed = !!sv.landed;
    ship.setGearProgress(shipState.landed ? 1 : 0);
    ship.setRampProgress(shipState.landed ? 1 : 0);
    updateShipTransform();
    UI.hideMenu();
    UI.showHUD();
    state = STATE.PLAYING;
    setCam(CAM.COCKPIT);
  } else {
    loadPlanetSystem(0);
    shipState.landed = false;
    UI.hideMenu();
    state = STATE.CUTSCENE;
    UI.showWarp("STELLAR VOYAGE // AEGIS VANGUARD", "INITIALIZING QUANTUM CORVETTE SYSTEMS");

    activeCutscene = new FlightCutscene(
      "LAUNCH",
      scene,
      camera,
      ship,
      cockpit,
      () => {
        activeCutscene = null;
        shipState.pos.set(0, 58, 210);
        shipState.yaw = 0;
        shipState.pitch = 0;
        shipState.roll = 0;
        shipState.speed = 0;
        shipState.thrust = 0;
        cockpitLook.yaw = 0;
        cockpitLook.pitch = 0;
        updateShipTransform();

        state = STATE.PLAYING;
        UI.hideWarp();
        setCam(CAM.COCKPIT);
        saveGame();
      },
      (subText) => UI.setWarpSubtext(subText)
    );
  }
};

UI.on("start", () => startNewOrSavedGame(false));
UI.on("continue", () => startNewOrSavedGame(true));
UI.on("load", () => startNewOrSavedGame(true));
UI.on("credits", () => {
  state = STATE.CREDITS;
  UI.showCredits();
});
UI.on("back", () => {
  state = STATE.MENU;
  UI.hideCredits();
  UI.showMenu();
});

// HUD Quick-Action Buttons
UI.on("hudWarp", () => {
  if (state === STATE.PLAYING) {
    warpCharge = 100;
    warpReady = true;
    engageWarp();
  }
});
UI.on("hudLand", () => toggleLandOrTakeoff());
UI.on("hudShipWalk", () => toggleShipInteriorWalk());
UI.on("hudFoot", () => togglePlanetSurfaceWalk());
UI.on("hudHull", () => cycleOnlineShipHull());
UI.on("hudCam", () => {
  if (state === STATE.PLAYING) cycleCam();
});
UI.on("hudMenu", () => {
  isDraggingMouse = false;
  state = STATE.MENU;
  Audio.updateEngineHum(0, false);
  UI.showMenu();
  syncVisibility();
});

// ---------------- Main Game Loop ----------------
let last = performance.now();

const update = (now) => {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // Animate planetary cloud deck, fauna & ship interior holograms/reactor core
  updateAnimals(planet, dt);
  if (cockpit.updateInterior) {
    cockpit.updateInterior(dt, warpCharge);
  }
  if (state === STATE.PLAYING) {
    if (shipState.landed) {
      ship.setSteamIntensity(0.42 + Math.sin(now * 0.0022) * 0.12);
    } else {
      const distPad = Math.hypot(shipState.pos.x, shipState.pos.z);
      if (shipState.pos.y < 16 && distPad < 28) {
        const altFactor = Math.max(0, 1 - shipState.pos.y / 16);
        const padFactor = Math.max(0, 1 - distPad / 28);
        ship.setSteamIntensity(altFactor * padFactor * 0.85);
      } else {
        ship.setSteamIntensity(0);
      }
    }
    if (ship.updateSteam) {
      ship.updateSteam(dt, now * 0.001);
    }
  }

  // ---------- MENU / CREDITS ATTRACT SCENE ----------
  if (state === STATE.MENU || state === STATE.CREDITS) {
    menuOrbitT += dt * 0.25;
    shipState.pos.set(0, 56, 205);
    shipState.yaw = Math.sin(menuOrbitT * 0.5) * 0.14;
    shipState.pitch = 0;
    shipState.roll = Math.cos(menuOrbitT * 0.5) * 0.07;
    if (ship.__quantumRing) ship.__quantumRing.rotation.z += dt * 1.5;
    updateShipTransform();
    syncVisibility();
    updateAtmosphericEnvironment(shipState.pos);

    camera.position.set(
      shipState.pos.x + Math.sin(menuOrbitT) * 14.0,
      shipState.pos.y + 3.6,
      shipState.pos.z + Math.cos(menuOrbitT) * 14.0
    );
    camera.lookAt(shipState.pos);
    composer.render();
    requestAnimationFrame(update);
    return;
  }

  // ---------- ACTIVE CUTSCENE (WARP / LANDING / TAKEOFF / LAUNCH) ----------
  if (state === STATE.WARP || state === STATE.CUTSCENE) {
    if (activeCutscene) {
      activeCutscene.update(dt);
    }
    updateAtmosphericEnvironment(camera.position);
    composer.render();
    requestAnimationFrame(update);
    return;
  }

  // ---------- PLAYING ----------
  chargeWarp(dt);

  const lookSens = 0.0032;

  // =========================================================================
  // MODE A: WALKING AROUND INSIDE THE STARSHIP (CAM.SHIP_INTERIOR)
  // =========================================================================
  if (camMode === CAM.SHIP_INTERIOR) {
    Audio.updateEngineHum(0.15, true);

    shipWalkState.yaw -= mouse.dx * lookSens;
    shipWalkState.pitch = Math.max(-1.1, Math.min(1.1, shipWalkState.pitch - mouse.dy * lookSens));
    mouse.dx = 0;
    mouse.dy = 0;

    const keyTurn =
      (keys["KeyQ"] || keys["ArrowLeft"] ? 1 : 0) -
      (keys["KeyE"] || keys["ArrowRight"] ? 1 : 0);
    const keyPitch =
      (keys["KeyR"] ? 1 : 0) - (keys["KeyF"] ? 1 : 0);
    shipWalkState.yaw += keyTurn * 1.8 * dt;
    shipWalkState.pitch = Math.max(-1.1, Math.min(1.1, shipWalkState.pitch + keyPitch * 1.2 * dt));

    const fwd = new THREE.Vector3(-Math.sin(shipWalkState.yaw), 0, -Math.cos(shipWalkState.yaw));
    const rgt = new THREE.Vector3(Math.cos(shipWalkState.yaw), 0, -Math.sin(shipWalkState.yaw));

    const move = new THREE.Vector3();
    if (keys["KeyW"] || keys["ArrowUp"]) move.add(fwd);
    if (keys["KeyS"] || keys["ArrowDown"]) move.sub(fwd);
    if (keys["KeyD"]) move.add(rgt);
    if (keys["KeyA"]) move.sub(rgt);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(4.2 * dt);
      shipWalkState.pos.add(move);
      shipWalkState.walkTime += dt * 10;

      const stepPhase = Math.floor(shipWalkState.walkTime / Math.PI);
      if (stepPhase !== shipWalkState.lastStepPhase) {
        shipWalkState.lastStepPhase = stepPhase;
        Audio.sfx.footstep(true);
      }
    }

    shipWalkState.pos.x = Math.max(-1.48, Math.min(1.48, shipWalkState.pos.x));
    shipWalkState.pos.z = Math.max(-0.45, Math.min(8.85, shipWalkState.pos.z));

    for (const [obsZ, rad] of [[3.2, 0.78], [7.2, 0.88]]) {
      const dx = shipWalkState.pos.x;
      const dz = shipWalkState.pos.z - obsZ;
      const d = Math.hypot(dx, dz);
      if (d < rad && d > 0.001) {
        shipWalkState.pos.x = (dx / d) * rad;
        shipWalkState.pos.z = obsZ + (dz / d) * rad;
      }
    }

    const headBob = move.lengthSq() > 0 ? Math.sin(shipWalkState.walkTime) * 0.045 : 0;
    shipWalkState.pos.y = 0.05 + headBob;

    const z = shipWalkState.pos.z;
    if (z < 1.1) {
      UI.setInteractPrompt("[E] SIT IN PILOT SEAT (HELM CONTROL)");
    } else if (z >= 1.6 && z <= 4.8) {
      UI.setInteractPrompt("[E] ASTROGATION HOLO-TABLE — ENGAGE QUANTUM WARP");
    } else if (z > 6.4) {
      UI.setInteractPrompt(
        shipState.landed
          ? "[E] OPEN AFT AIRLOCK — STEP OUT ONTO PLANET SURFACE"
          : "[E] LAND ON PLANET & STEP OUT AFT AIRLOCK"
      );
    } else {
      UI.setInteractPrompt(null);
    }

    updateShipTransform();
    const worldEye = shipWalkState.pos.clone().applyMatrix4(cockpit.matrixWorld);
    camera.position.copy(worldEye);
    updateAtmosphericEnvironment(worldEye);

    qShip.copy(cockpit.quaternion);
    lookEuler.set(shipWalkState.pitch, shipWalkState.yaw, 0, "YXZ");
    qLook.setFromEuler(lookEuler);
    qFinal.multiplyQuaternions(qShip, qLook);
    camera.quaternion.copy(qFinal);

    UI.setSpeed(move.lengthSq() > 0 ? 4 : 0);
  }
  // =========================================================================
  // MODE B: WALKING ON THE PLANET SURFACE (CAM.FOOT)
  // =========================================================================
  else if (camMode === CAM.FOOT) {
    Audio.updateEngineHum(0, false);

    footState.yaw -= mouse.dx * lookSens;
    footState.pitch = Math.max(-1.1, Math.min(1.1, footState.pitch - mouse.dy * lookSens));
    mouse.dx = 0;
    mouse.dy = 0;

    const keyTurn =
      (keys["KeyQ"] || keys["ArrowLeft"] ? 1 : 0) -
      (keys["KeyE"] || keys["ArrowRight"] ? 1 : 0);
    const keyPitch =
      (keys["KeyR"] ? 1 : 0) - (keys["KeyF"] ? 1 : 0);
    footState.yaw += keyTurn * 1.8 * dt;
    footState.pitch = Math.max(-1.1, Math.min(1.1, footState.pitch + keyPitch * 1.2 * dt));

    const fwd = new THREE.Vector3(-Math.sin(footState.yaw), 0, -Math.cos(footState.yaw));
    const rgt = new THREE.Vector3(Math.cos(footState.yaw), 0, -Math.sin(footState.yaw));

    const move = new THREE.Vector3();
    if (keys["KeyW"] || keys["ArrowUp"]) move.add(fwd);
    if (keys["KeyS"] || keys["ArrowDown"]) move.sub(fwd);
    if (keys["KeyD"]) move.add(rgt);
    if (keys["KeyA"]) move.sub(rgt);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(8.5 * dt);
      footState.pos.add(move);
      footState.walkTime += dt * 9.5;

      const stepPhase = Math.floor(footState.walkTime / Math.PI);
      if (stepPhase !== footState.lastStepPhase) {
        footState.lastStepPhase = stepPhase;
        Audio.sfx.footstep(false);
      }
    }

    const dist = Math.hypot(footState.pos.x, footState.pos.z);
    if (dist > 110) {
      footState.pos.x *= 110 / dist;
      footState.pos.z *= 110 / dist;
    }

    const distToRamp = Math.hypot(footState.pos.x, footState.pos.z - 3.5);
    if (distToRamp < 5.0) {
      UI.setInteractPrompt("[E] WALK UP BOARDING RAMP INTO SHIP INTERIOR");
    } else {
      UI.setInteractPrompt(null);
    }

    const groundWorldY =
      getSurfaceY(PLANET_RADIUS, footState.pos.x, footState.pos.z) - PLANET_RADIUS;
    const bob = move.lengthSq() > 0 ? Math.sin(footState.walkTime) * 0.075 : 0;
    footState.pos.y = groundWorldY + 1.75 + bob;

    camera.position.copy(footState.pos);
    updateAtmosphericEnvironment(footState.pos);
    lookEuler.set(footState.pitch, footState.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(lookEuler);

    UI.setSpeed(move.lengthSq() > 0 ? 8 : 0);
  }
  // =========================================================================
  // MODE C: STARSHIP FLIGHT (COCKPIT / THIRD PERSON / CINEMATIC)
  // =========================================================================
  else {
    UI.setInteractPrompt(null);

    const throttleInput =
      (keys["KeyW"] || keys["ArrowUp"] ? 1 : 0) -
      (keys["KeyS"] || keys["ArrowDown"] ? 1 : 0);
    const yawInput =
      (keys["KeyA"] || keys["ArrowLeft"] ? 1 : 0) -
      (keys["KeyD"] || keys["ArrowRight"] ? 1 : 0);
    const rollInput = (keys["KeyQ"] ? 1 : 0) - (keys["KeyE"] ? 1 : 0);
    const pitchInput = (keys["KeyR"] ? 1 : 0) - (keys["KeyF"] ? 1 : 0);

    // Apply drag-mouse look or ship steering with zero drift when mouse is still
    if (isDraggingMouse && (mouse.dx !== 0 || mouse.dy !== 0)) {
      if (camMode === CAM.COCKPIT) {
        shipState.yaw -= mouse.dx * lookSens * 0.85;
        shipState.pitch = Math.max(
          -1.05,
          Math.min(1.05, shipState.pitch - mouse.dy * lookSens * 0.85)
        );
      } else {
        shipState.yaw -= mouse.dx * lookSens;
        shipState.pitch = Math.max(
          -1.05,
          Math.min(1.05, shipState.pitch - mouse.dy * lookSens)
        );
      }
    }
    mouse.dx = 0;
    mouse.dy = 0;

    if (throttleInput > 0) {
      if (shipState.landed) {
        shipState.landed = false;
        ship.setGearProgress(0);
        ship.setRampProgress(0);
        UI.setFlightState("IN FLIGHT");
      }
      shipState.thrust = Math.min(1, shipState.thrust + 1.2 * dt);
    } else if (throttleInput < 0) {
      shipState.thrust = Math.max(0, shipState.thrust - 1.6 * dt);
    } else {
      shipState.thrust *= 0.985;
    }

    Audio.updateEngineHum(shipState.thrust, !shipState.landed);

    if (!shipState.landed) {
      shipState.yaw += yawInput * 1.35 * dt;
      shipState.pitch = Math.max(
        -1.15,
        Math.min(1.15, shipState.pitch + pitchInput * 1.1 * dt)
      );
      shipState.roll = THREE.MathUtils.lerp(
        shipState.roll,
        -yawInput * 0.48 + rollInput * 0.7,
        5 * dt
      );

      const targetSpeed = shipState.thrust * shipState.maxSpeed;
      shipState.speed = THREE.MathUtils.lerp(shipState.speed, targetSpeed, 4 * dt);

      updateShipVectors();
      shipState.pos.addScaledVector(shipState.forward, shipState.speed * 60 * dt);

      const dx = shipState.pos.x;
      const dy = shipState.pos.y + PLANET_RADIUS;
      const dz = shipState.pos.z;
      const distFromPlanetCenter = Math.hypot(dx, dy, dz);
      const minAlt = PLANET_RADIUS + 1.8;
      if (distFromPlanetCenter < minAlt) {
        const scale = minAlt / Math.max(0.001, distFromPlanetCenter);
        shipState.pos.x = dx * scale;
        shipState.pos.y = dy * scale - PLANET_RADIUS;
        shipState.pos.z = dz * scale;
      }
    } else {
      shipState.speed = 0;
      shipState.thrust = 0;
    }

    if (ship.__quantumRing) {
      ship.__quantumRing.rotation.z +=
        dt * (1.2 + shipState.thrust * 4.5 + (warpCharge / 100) * 8);
    }

    updateShipTransform();
    updateAtmosphericEnvironment(shipState.pos);

    if (cockpit.__throttle) {
      cockpit.__throttle.rotation.x = -0.25 - shipState.thrust * 0.55;
    }
    if (cockpit.__stick) {
      cockpit.__stick.rotation.z = -shipState.roll * 0.5;
      cockpit.__stick.rotation.x = shipState.pitch * 0.4;
    }

    const thrusters = ship.userData.thrusters || [];
    const pulse = 0.55 + shipState.thrust * 0.85 + Math.sin(now * 0.028) * 0.1;
    for (const tGroup of thrusters) {
      if (tGroup.userData && tGroup.userData.outer) {
        tGroup.userData.outer.material.opacity = Math.min(1, pulse * 0.85);
        tGroup.userData.inner.material.opacity = Math.min(1, pulse);
      }
      tGroup.scale.set(1, 1, 0.55 + shipState.thrust * 1.45);
    }
    if (ship.__engineLight) {
      ship.__engineLight.intensity = 1.4 + shipState.thrust * 4.0;
    }

    if (camMode === CAM.COCKPIT) {
      camera.position.copy(shipState.pos);
      qShip.copy(ship.quaternion);
      lookEuler.set(cockpitLook.pitch, cockpitLook.yaw, 0, "YXZ");
      qLook.setFromEuler(lookEuler);
      qFinal.multiplyQuaternions(qShip, qLook);
      camera.quaternion.copy(qFinal);
    } else if (camMode === CAM.THIRD) {
      updateShipVectors();
      const camPos = shipState.pos
        .clone()
        .addScaledVector(shipState.forward, -13.5)
        .addScaledVector(shipState.up, 3.8);
      camera.position.copy(camPos);
      const lookTarget = shipState.pos.clone().addScaledVector(shipState.forward, 15);
      camera.lookAt(lookTarget);
    } else if (camMode === CAM.CINEMATIC) {
      cinematicT += dt * 0.38;
      const radius = 15.5;
      camera.position.set(
        shipState.pos.x + Math.sin(cinematicT) * radius,
        shipState.pos.y + 4.2 + Math.cos(cinematicT * 0.7) * 2.4,
        shipState.pos.z + Math.cos(cinematicT) * radius
      );
      camera.lookAt(shipState.pos);
    }

    UI.setSpeed(shipState.speed * 1450);
  }

  composer.render();
  requestAnimationFrame(update);
};

requestAnimationFrame(update);

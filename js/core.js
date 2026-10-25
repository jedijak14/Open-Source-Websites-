/**
 * Stellar Voyage — Core 3D Engine & Physics Simulation
 * Features:
 * - Three.js r164 + PMREM RoomEnvironment IBL + UnrealBloomPass HDR Post-Processing
 * - Colossal Worlds (R = 1800) with 3D Sculpted Continents, Mountains, & Ocean Basins
 * - Real 4-Wave Gerstner Ocean Shader & Archimedes Water Buoyancy / Swimming Physics
 * - Walkable 3-Bay Starship Interior with Interactive Captain's Bed (Sleep & Solar Cycle)
 * - 6-DOF Newtonian/Aerodynamic Flight Physics, G-Force Telemetry & Full Visor HUD
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import Audio from "./audio.js?v=8";
import { UI } from "./ui.js?v=8";
import { buildCockpit } from "./cockpit.js?v=8";
import { buildShip } from "./ship.js?v=8";
import {
  PLANET_RADIUS,
  SYSTEMS,
  buildPlanet,
  spawnAnimals,
  updateAnimals,
  getSurfaceY,
  getWaterSurfaceWorldY,
  spawnWaterRipple
} from "./planet.js?v=8";
import { WarpCutscene, FlightCutscene } from "./warp.js?v=8";

// ---------------- Constants & State ----------------
const STATE = {
  MENU: "MENU",
  SETTINGS: "SETTINGS",
  PLAYING: "PLAYING",
  SLEEPING: "SLEEPING",
  WARP: "WARP",
  CUTSCENE: "CUTSCENE",
  CREDITS: "CREDITS"
};
let state = STATE.MENU;
let prevStateBeforeSettings = STATE.MENU;

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
renderer.toneMappingExposure = 1.05;

const spaceBgColor = new THREE.Color(0x02040a);
const atmosBgColor = new THREE.Color(0x0f2942);
const underwaterBgColor = new THREE.Color(0x042f4b);
const blendedSkyColor = new THREE.Color(0x02040a);

const scene = new THREE.Scene();
scene.background = blendedSkyColor;
scene.fog = new THREE.FogExp2(0x02040a, 0.00012);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(
  54,
  window.innerWidth / window.innerHeight,
  0.1,
  18000
);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.22,
  0.35,
  0.93
);
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// ---------------- Scene Lighting & Solar Cycle ----------------
const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x060b18, 0.14);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.65);
sun.position.set(-1450, 880, 2150);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ambient = new THREE.AmbientLight(0x1e293b, 0.08);
scene.add(ambient);

// Planetary Solar Clock (0..24 hours, advances continuously and jumps +8h when sleeping in bed!)
let solarHours = 13.5;

const updateSolarCycle = (dt) => {
  solarHours = (solarHours + dt * 0.015) % 24;
  UI.setSolarTime(solarHours);

  // Convert solarHours (at 13.5h, sun shines from upper-left-front (-0.52, 0.34, 0.78)
  // creating the exact right-side crescent terminator shadow from NASA orbital imagery!)
  const phase = ((solarHours - 13.5) / 24.0) * Math.PI * 2.0;
  const baseAzimuth = -0.58 + phase;
  const sx = Math.sin(baseAzimuth) * 2400;
  const sy = 950 + Math.sin(phase) * 550;
  const sz = Math.cos(baseAzimuth) * 2400;
  sun.position.set(sx, sy, sz);

  const sunDir = sun.position.clone().normalize();
  if (planet && planet.outerAtmosMat) {
    planet.outerAtmosMat.uniforms.uSunDir.value.copy(sunDir);
  }
};

// ---------------- Deep Space Starfield ----------------
const starCount = 3600;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
const starCol = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 4200 + Math.random() * 5500;
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
  size: 2.5,
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
  planet.position.set(0, -PLANET_RADIUS, 0); // North Pole Starport Plateau is at world (0, +2.2, 0)
  spawnAnimals(planet, 42);
  scene.add(planet);

  const sys = SYSTEMS[currentSystemIndex];
  UI.setSystem(sys.name);
  UI.setBiome(sys.biome);
  UI.setGravity(sys.gravity || 1.0);
  UI.setAtmos(sys.atmosPressure || "101 kPa O₂/N₂");
};

loadPlanetSystem(0);

const ORBIT_SHIP_POS = new THREE.Vector3(0, -1800, 4280);

// ---------------- Physics States (Ship, Interior Walk & Planet/Water Walk) ----------------
const shipState = {
  pos: ORBIT_SHIP_POS.clone(),
  vel: new THREE.Vector3(),
  speed: 0,
  maxSpeed: 1.85,
  thrust: 0,
  gForce: 1.0,
  landed: false,
  floatingOnWater: false,
  yaw: 0,
  pitch: 0,
  roll: 0,
  angularVel: new THREE.Vector3(),
  forward: new THREE.Vector3(0, 0, -1),
  up: new THREE.Vector3(0, 1, 0),
  right: new THREE.Vector3(1, 0, 0)
};

// Local coordinates inside the 3-Bay Walkable Ship Interior (z = -0.5 to +8.8, x = -1.55 to +1.55)
const shipWalkState = {
  pos: new THREE.Vector3(0, 0, 1.5),
  vel: new THREE.Vector3(),
  yaw: Math.PI, // Facing aft toward Holo-Table, Captain's Bed & Reactor Core
  pitch: 0,
  walkTime: 0,
  lastStepPhase: 0,
  grounded: true
};

// World coordinates on the Planet Surface / Ocean around the Starport & Beach
const footState = {
  pos: new THREE.Vector3(0, 4.0, 10.5),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  walkTime: 0,
  lastStepPhase: 0,
  grounded: true,
  inWater: false,
  submergedHead: false,
  waterSplashCooldown: 0
};

let crewStamina = 100;
const cockpitLook = { yaw: 0, pitch: 0 };

// Sleep Sequence State (Captain's Quarters Bed)
const sleepState = {
  timer: 0,
  duration: 3.6,
  startPos: new THREE.Vector3(),
  startYaw: 0,
  startPitch: 0
};

// Warp & Cutscene State
let warpCharge = 0;
const warpChargeRate = 52;
let warpReady = false;
let warpAutoTimer = 0;
let warpSfx = null;
let activeCutscene = null;
let spaceHoldTime = 0;

// Camera Mode
let camMode = CAM.COCKPIT;
let cinematicT = 0;
let menuOrbitT = 0;

// ---------------- Drift-Free Mouse & Keyboard Input ----------------
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
const SAVE_KEY = "stellarvoyage_save_v5";

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
    solarHours,
    stamina: crewStamina,
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
    mouse.dx += Math.max(-42, Math.min(42, rawDx));
    mouse.dy += Math.max(-42, Math.min(42, rawDy));
  }
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------- Visibility & Camera Mode Switching ----------------
const syncVisibility = () => {
  if (state === STATE.MENU || state === STATE.CREDITS || state === STATE.SETTINGS) {
    ship.visible = true;
    cockpit.visible = false;
    return;
  }
  if (state === STATE.WARP || state === STATE.CUTSCENE) {
    return;
  }
  if (camMode === CAM.COCKPIT || camMode === CAM.SHIP_INTERIOR || state === STATE.SLEEPING) {
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
  if (mode !== CAM.FOOT) {
    UI.setUnderwater(false);
  }
  syncVisibility();
  UI.setCam(mode);
  Audio.sfx.switch();

  if (mode === CAM.SHIP_INTERIOR) {
    UI.setFlightState(shipState.landed ? "SHIP DECK (LANDED)" : "SHIP DECK (IN ORBIT)");
  } else if (mode === CAM.FOOT) {
    UI.setFlightState("PLANET & OCEAN");
  } else {
    UI.setFlightState(shipState.landed ? "LANDED ON PAD" : "IN ORBIT");
  }
};

const toggleShipInteriorWalk = () => {
  if (state !== STATE.PLAYING) return;
  if (camMode === CAM.SHIP_INTERIOR) {
    setCam(CAM.COCKPIT);
  } else {
    shipWalkState.pos.set(0, 0, 1.35);
    shipWalkState.vel.set(0, 0, 0);
    shipWalkState.yaw = Math.PI;
    shipWalkState.pitch = 0;
    setCam(CAM.SHIP_INTERIOR);
  }
};

// ---------------- CAPTAIN'S QUARTERS BED SLEEP SEQUENCE ----------------
const startSleepInBed = () => {
  if (state !== STATE.PLAYING) return;

  // Ensure we are inside the walkable ship interior
  if (camMode !== CAM.SHIP_INTERIOR) {
    setCam(CAM.SHIP_INTERIOR);
  }

  state = STATE.SLEEPING;
  sleepState.timer = 0;
  sleepState.startPos.copy(shipWalkState.pos);
  sleepState.startYaw = shipWalkState.yaw;
  sleepState.startPitch = shipWalkState.pitch;

  UI.setInteractPrompt(null);
  UI.setFlightState("SLEEPING IN QUARTERS");
  Audio.sfx.sleep();
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
      shipState.pos.set(0, 3.65, 0); // Coastal Starport Plateau (+2.2m + 1.45m gear)
      shipState.vel.set(0, 0, 0);
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
        footState.pos.set(0, 4.0, 9.5);
        footState.vel.set(0, 0, 0);
        footState.yaw = Math.PI; // Facing the coastal pier & sparkling ocean bay!
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
  UI.setUnderwater(false);
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
      shipState.pos.copy(ORBIT_SHIP_POS);
      shipState.vel.set(0, 0, -12);
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
    UI.setUnderwater(false);
    shipWalkState.pos.set(0, 0, 7.8);
    shipWalkState.vel.set(0, 0, 0);
    shipWalkState.yaw = 0;
    shipWalkState.pitch = 0;
    Audio.sfx.hydraulics();
    setCam(CAM.SHIP_INTERIOR);
  } else {
    footState.pos.set(0, 4.0, 9.5);
    footState.vel.set(0, 0, 0);
    footState.yaw = Math.PI; // Facing the coastal pier & ocean bay (+Z)
    footState.pitch = 0;
    Audio.sfx.hydraulics();
    setCam(CAM.FOOT);
  }
};

// ---------------- Quantum Warp Cutscene ----------------
const engageWarp = () => {
  if (state === STATE.WARP || state === STATE.CUTSCENE || state === STATE.SLEEPING) return;
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

  UI.setUnderwater(false);
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
      shipState.pos.copy(ORBIT_SHIP_POS);
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
      UI.setWarpStatus(`ARRIVED AT ${nextSys.name}`);
      if (camMode === CAM.FOOT) {
        setCam(CAM.THIRD);
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
  const hullName = ship.cycleHullModel ? ship.cycleHullModel() : "";
  Audio.sfx.switch();
  if (state === STATE.PLAYING && (camMode === CAM.COCKPIT || camMode === CAM.SHIP_INTERIOR)) {
    setCam(CAM.THIRD);
  }
  if (hullName) {
    UI.setWarpStatus(`ACTIVE HULL: ${hullName}`);
  }
};

const chargeWarp = (dt) => {
  // On foot / swimming, tapping Space jumps/swims; holding Space > 0.45s charges warp
  if (keys["Space"]) {
    spaceHoldTime += dt;
    if (camMode === CAM.FOOT && spaceHoldTime < 0.45) {
      return;
    }

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
    spaceHoldTime = 0;
    warpAutoTimer = 0;
    if (warpCharge > 0 && !warpReady) {
      warpCharge = Math.max(0, warpCharge - 25 * dt);
      UI.setWarpMeter(warpCharge);
      if (warpCharge === 0) {
        UI.setWarpStatus("HYPERDRIVE CORE STANDBY");
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

// ---------------- Contextual Interactions (Seat, Bed, Holo-Table, Airlock, Ramp) ----------------
const interact = () => {
  if (warpReady || warpCharge >= 95) {
    engageWarp();
    return;
  }

  if (camMode === CAM.SHIP_INTERIOR) {
    const x = shipWalkState.pos.x;
    const z = shipWalkState.pos.z;

    if (z < 1.1) {
      setCam(CAM.COCKPIT);
      return;
    }
    // Captain's Quarters Bed on Port Side (z = 3.5 to 5.8, x > 0.1)
    if (z >= 3.5 && z <= 5.85 && x > 0.05) {
      startSleepInBed();
      return;
    }
    // Center Holographic Astrogation Table (z = 1.6 to 4.6)
    if (z >= 1.6 && z <= 4.6) {
      warpCharge = 100;
      warpReady = true;
      engageWarp();
      return;
    }
    // Aft Airlock
    if (z > 6.2) {
      togglePlanetSurfaceWalk();
      return;
    }
  }

  if (camMode === CAM.FOOT) {
    const distToRamp = Math.hypot(footState.pos.x, footState.pos.z - 3.5);
    if (distToRamp < 6.0) {
      UI.setUnderwater(false);
      shipWalkState.pos.set(0, 0, 7.8);
      shipWalkState.vel.set(0, 0, 0);
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
  const wasPressed = !!keys[e.code];
  keys[e.code] = true;

  if (e.code === "Escape") {
    isDraggingMouse = false;
    if (state === STATE.PLAYING) {
      UI.showMenu();
      state = STATE.MENU;
      Audio.updateEngineHum(0, false);
      syncVisibility();
    } else if (state === STATE.SETTINGS) {
      UI.hideSettings();
      if (prevStateBeforeSettings === STATE.PLAYING) {
        UI.showHUD();
        state = STATE.PLAYING;
        syncVisibility();
      } else {
        UI.showMenu();
        state = STATE.MENU;
      }
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
    if (e.code === "KeyB") startSleepInBed();
    if (e.code === "KeyL") toggleLandOrTakeoff();
    if (e.code === "KeyC") cycleCam();
    if (e.code === "KeyH") cycleOnlineShipHull();
    if (e.code === "KeyP") cyclePlanetSystem();
    if (e.code === "Tab" || e.code === "KeyT") {
      e.preventDefault();
      togglePlanetSurfaceWalk();
    }
    if (e.code === "KeyE" || e.code === "Enter") {
      interact();
    }
    // Real Physics Jump / Swim-Up Impulse when pressing Space on foot or inside ship!
    if (e.code === "Space" && !wasPressed) {
      if (camMode === CAM.FOOT) {
        if (footState.inWater) {
          footState.vel.y = 5.4;
          Audio.sfx.splash(0.6);
          spawnWaterRipple(planet, footState.pos.x, footState.pos.z, 3.8);
        } else if (footState.grounded) {
          footState.vel.y = 6.2;
          footState.grounded = false;
          Audio.sfx.footstep(false);
        }
      } else if (camMode === CAM.SHIP_INTERIOR && shipWalkState.grounded) {
        shipWalkState.vel.y = 3.8;
        shipWalkState.grounded = false;
        Audio.sfx.footstep(true);
      }
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

// ---------------- Dynamic Atmospheric Sky, Fog & Underwater Transition ----------------
const updateAtmosphericEnvironment = (viewerWorldPos, isUnderwater = false) => {
  const sys = SYSTEMS[currentSystemIndex];
  const distCenter = Math.hypot(
    viewerWorldPos.x,
    viewerWorldPos.y + PLANET_RADIUS,
    viewerWorldPos.z
  );
  const altitude = Math.max(-20, distCenter - PLANET_RADIUS);

  if (isUnderwater) {
    underwaterBgColor.setHex(sys.waterDeepHex || 0x0369a1).multiplyScalar(0.55);
    blendedSkyColor.copy(underwaterBgColor);
    scene.fog.color.copy(underwaterBgColor);
    scene.fog.density = 0.022;
    hemi.color.setHex(sys.waterShallowHex || 0x22d3ee);
    hemi.intensity = 1.1;
    starMat.opacity = 0.0;
    return altitude;
  }

  const atmosDepth = THREE.MathUtils.clamp(1.0 - altitude / 140.0, 0.0, 1.0);
  const smoothAtmos = atmosDepth * atmosDepth * (3 - 2 * atmosDepth);

  // Modulate atmospheric brightness by solar time (day vs twilight/night)
  const sunElev = Math.sin(((solarHours - 6.0) / 24.0) * Math.PI * 2.0);
  const daylight = THREE.MathUtils.clamp(0.35 + sunElev * 0.65, 0.14, 1.0);

  atmosBgColor.setHex(sys.atmosHex || 0x38bdf8).multiplyScalar(0.32 * daylight);
  blendedSkyColor.copy(spaceBgColor).lerp(atmosBgColor, smoothAtmos);
  scene.fog.color.copy(blendedSkyColor);
  scene.fog.density = THREE.MathUtils.lerp(0.00004, 0.0014, smoothAtmos);

  const inCabin = camMode === CAM.SHIP_INTERIOR || camMode === CAM.COCKPIT;
  hemi.color.setHex(sys.horizonHex || sys.atmosHex || 0x7dd3fc);
  hemi.intensity = inCabin
    ? 0.55
    : THREE.MathUtils.lerp(0.11, 1.35 * daylight, smoothAtmos);
  ambient.intensity = inCabin
    ? 0.45
    : THREE.MathUtils.lerp(0.05, 0.55 * daylight, smoothAtmos);
  starMat.opacity = THREE.MathUtils.lerp(0.95, 0.22, smoothAtmos * daylight);

  return altitude;
};

const cyclePlanetSystem = () => {
  const nextIdx = (currentSystemIndex + 1) % SYSTEMS.length;
  loadPlanetSystem(nextIdx);
  if (!shipState.landed && camMode !== CAM.FOOT) {
    shipState.pos.copy(ORBIT_SHIP_POS);
    shipState.vel.set(0, 0, 0);
    shipState.yaw = 0;
    shipState.pitch = 0;
    shipState.roll = 0;
    updateShipTransform();
  }
  const sys = SYSTEMS[nextIdx];
  UI.setWarpStatus(`ACTIVE PLANET: ${sys.name} (${sys.biome})`);
  Audio.sfx.arrive();
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
    if (typeof sv.solarHours === "number") solarHours = sv.solarHours;
    if (typeof sv.stamina === "number") crewStamina = sv.stamina;
    shipState.yaw = sv.yaw || 0;
    shipState.pitch = sv.pitch || 0;
    shipState.landed = !!sv.landed;
    ship.setGearProgress(shipState.landed ? 1 : 0);
    ship.setRampProgress(shipState.landed ? 1 : 0);
    updateShipTransform();
    UI.hideMenu();
    UI.showHUD();
    state = STATE.PLAYING;
    setCam(CAM.THIRD);
  } else {
    loadPlanetSystem(currentSystemIndex);
    shipState.landed = false;
    crewStamina = 100;
    UI.setStamina(100);
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
        shipState.pos.copy(ORBIT_SHIP_POS);
        shipState.vel.set(0, 0, 0);
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
        setCam(CAM.THIRD);
        saveGame();
      },
      (subText) => UI.setWarpSubtext(subText)
    );
  }
};

UI.on("start", () => startNewOrSavedGame(false));
UI.on("continue", () => startNewOrSavedGame(true));
UI.on("load", () => startNewOrSavedGame(true));
UI.on("planet", () => cyclePlanetSystem());
UI.on("settings", () => {
  isDraggingMouse = false;
  if (state !== STATE.SETTINGS) {
    prevStateBeforeSettings = state === STATE.PLAYING ? STATE.PLAYING : STATE.MENU;
  }
  state = STATE.SETTINGS;
  Audio.updateEngineHum(0, false);
  UI.showSettings("general");
  syncVisibility();
});
UI.on("closeSettings", () => {
  UI.hideSettings();
  if (prevStateBeforeSettings === STATE.PLAYING) {
    state = STATE.PLAYING;
    UI.showHUD();
    syncVisibility();
  } else {
    state = STATE.MENU;
    UI.showMenu();
    syncVisibility();
  }
});
UI.on("credits", () => {
  state = STATE.CREDITS;
  UI.showCredits();
});
UI.on("back", () => {
  state = STATE.MENU;
  UI.hideCredits();
  UI.showMenu();
});

UI.on("hudWarp", () => {
  if (state === STATE.PLAYING) {
    warpCharge = 100;
    warpReady = true;
    engageWarp();
  }
});
UI.on("hudLand", () => toggleLandOrTakeoff());
UI.on("hudShipWalk", () => toggleShipInteriorWalk());
UI.on("hudSleep", () => startSleepInBed());
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
  const timeSec = now * 0.001;

  updateSolarCycle(dt);

  // Show the North Pole Surface & Ocean Exploration Zone when descending/landed/walking,
  // and hide it in deep orbital space so the planet globe silhouette is a pure, flawless sphere!
  if (planet && planet.surfaceDetailGroup) {
    const inSurfaceCutscene =
      state === STATE.CUTSCENE &&
      activeCutscene &&
      (activeCutscene.mode === "LANDING" || activeCutscene.mode === "TAKEOFF");
    const nearNorthPole =
      shipState.pos.y > -550 && Math.hypot(shipState.pos.x, shipState.pos.z) < 950;
    planet.surfaceDetailGroup.visible =
      inSurfaceCutscene ||
      shipState.landed ||
      camMode === CAM.FOOT ||
      (state === STATE.PLAYING && nearNorthPole);
  }

  updateAnimals(planet, dt, timeSec);

  if (cockpit.updateInterior) {
    cockpit.updateInterior(dt, warpCharge);
  }

  if (state === STATE.PLAYING || state === STATE.SLEEPING) {
    if (shipState.landed) {
      ship.setSteamIntensity(0.42 + Math.sin(now * 0.0022) * 0.12);
    } else {
      const distPad = Math.hypot(shipState.pos.x, shipState.pos.z);
      if (shipState.pos.y > -20 && shipState.pos.y < 18 && distPad < 30) {
        const altFactor = Math.max(0, 1 - shipState.pos.y / 18);
        const padFactor = Math.max(0, 1 - distPad / 30);
        ship.setSteamIntensity(altFactor * padFactor * 0.85);
      } else {
        ship.setSteamIntensity(0);
      }
    }
    if (ship.updateSteam) {
      ship.updateSteam(dt, timeSec);
    }
  }

  // ---------- MENU / CREDITS / SETTINGS ATTRACT SCENE ----------
  if (state === STATE.MENU || state === STATE.CREDITS || state === STATE.SETTINGS) {
    if (state === STATE.SETTINGS && prevStateBeforeSettings === STATE.PLAYING) {
      composer.render();
      requestAnimationFrame(update);
      return;
    }
    menuOrbitT += dt * 0.25;
    shipState.pos.set(0, -1804.2, 4280);
    shipState.yaw = Math.sin(menuOrbitT * 0.5) * 0.12;
    shipState.pitch = 0;
    shipState.roll = Math.cos(menuOrbitT * 0.5) * 0.06;
    if (ship.__quantumRing) ship.__quantumRing.rotation.z += dt * 1.5;
    updateShipTransform();
    syncVisibility();
    updateAtmosphericEnvironment(shipState.pos, false);

    // Frame the colossal full-screen planet globe (R=1800 at (0,-1800,0)) dead-center!
    camera.position.set(
      Math.sin(menuOrbitT * 0.6) * 3.2,
      -1800,
      4294
    );
    camera.lookAt(0, -1800, 0);
    composer.render();
    requestAnimationFrame(update);
    return;
  }

  // ---------- CAPTAIN'S BED SLEEP SEQUENCE ----------
  if (state === STATE.SLEEPING) {
    sleepState.timer += dt;
    const t = sleepState.timer;
    const p = Math.min(1.0, t / sleepState.duration);

    // Advance planetary solar clock (+8 hours over the sleep duration) & restore stamina
    solarHours = (solarHours + (8.0 / sleepState.duration) * dt) % 24;
    crewStamina = Math.min(100, crewStamina + 45 * dt);
    UI.setStamina(crewStamina);

    // Smoothly move camera onto the Captain's Bed pillow at local (1.18, -0.35, 4.15)
    const bedPillowPos = new THREE.Vector3(1.18, -0.32, 4.15);
    const lieFactor =
      t < 0.9
        ? t / 0.9
        : t > sleepState.duration - 0.8
        ? Math.max(0, (sleepState.duration - t) / 0.8)
        : 1.0;
    const smoothLie = lieFactor * lieFactor * (3 - 2 * lieFactor);

    const curLocalPos = new THREE.Vector3().lerpVectors(
      sleepState.startPos,
      bedPillowPos,
      smoothLie
    );
    updateShipTransform();
    const worldEye = curLocalPos.clone().applyMatrix4(cockpit.matrixWorld);
    camera.position.copy(worldEye);

    qShip.copy(cockpit.quaternion);
    lookEuler.set(
      THREE.MathUtils.lerp(sleepState.startPitch, 0.58, smoothLie),
      THREE.MathUtils.lerp(sleepState.startYaw, Math.PI * 0.5, smoothLie),
      THREE.MathUtils.lerp(0, 0.12, smoothLie),
      "YXZ"
    );
    qLook.setFromEuler(lookEuler);
    qFinal.multiplyQuaternions(qShip, qLook);
    camera.quaternion.copy(qFinal);

    if (t > 0.65 && t < sleepState.duration - 0.45) {
      const barPct = ((t - 0.65) / (sleepState.duration - 1.1)) * 100;
      UI.showSleep(
        "CAPTAIN'S QUARTERS // CIRCADIAN SLEEP CYCLE",
        `RESTORING STAMINA (${Math.round(crewStamina)}%) & ADVANCING SOLAR TIME...`,
        barPct
      );
    } else {
      UI.hideSleep();
    }

    if (t >= sleepState.duration) {
      UI.hideSleep();
      crewStamina = 100;
      UI.setStamina(100);
      shipWalkState.pos.set(0.32, 0.05, 4.65);
      shipWalkState.vel.set(0, 0, 0);
      shipWalkState.yaw = -Math.PI * 0.5; // Facing the Captain's Bed
      shipWalkState.pitch = 0;
      state = STATE.PLAYING;
      UI.setFlightState(shipState.landed ? "SHIP DECK (LANDED)" : "SHIP DECK (IN ORBIT)");
      UI.setWarpStatus("SLEEP COMPLETE // STAMINA 100% & SOLAR TIME +8H");
      Audio.sfx.arrive();
      saveGame();
    }

    composer.render();
    requestAnimationFrame(update);
    return;
  }

  // ---------- ACTIVE CUTSCENE (WARP / LANDING / TAKEOFF / LAUNCH) ----------
  if (state === STATE.WARP || state === STATE.CUTSCENE) {
    if (activeCutscene) {
      activeCutscene.update(dt);
    }
    updateAtmosphericEnvironment(camera.position, false);
    composer.render();
    requestAnimationFrame(update);
    return;
  }

  // ---------- PLAYING ----------
  chargeWarp(dt);

  const lookSens = 0.0032;
  const sys = SYSTEMS[currentSystemIndex];
  const planetGravity = (sys.gravity || 1.0) * 9.8;
  const isSprinting = !!(keys["ShiftLeft"] || keys["ShiftRight"]);

  // =========================================================================
  // MODE A: WALKING AROUND INSIDE THE STARSHIP (CAM.SHIP_INTERIOR)
  // =========================================================================
  if (camMode === CAM.SHIP_INTERIOR) {
    Audio.updateEngineHum(0.15, true);

    shipWalkState.yaw -= mouse.dx * lookSens;
    shipWalkState.pitch = Math.max(
      -1.1,
      Math.min(1.1, shipWalkState.pitch - mouse.dy * lookSens)
    );
    mouse.dx = 0;
    mouse.dy = 0;

    const keyTurn =
      (keys["KeyQ"] || keys["ArrowLeft"] ? 1 : 0) -
      (keys["KeyE"] || keys["ArrowRight"] ? 1 : 0);
    const keyPitch = (keys["KeyR"] ? 1 : 0) - (keys["KeyF"] ? 1 : 0);
    shipWalkState.yaw += keyTurn * 1.8 * dt;
    shipWalkState.pitch = Math.max(
      -1.1,
      Math.min(1.1, shipWalkState.pitch + keyPitch * 1.2 * dt)
    );

    const fwd = new THREE.Vector3(
      -Math.sin(shipWalkState.yaw),
      0,
      -Math.cos(shipWalkState.yaw)
    );
    const rgt = new THREE.Vector3(
      Math.cos(shipWalkState.yaw),
      0,
      -Math.sin(shipWalkState.yaw)
    );

    const move = new THREE.Vector3();
    if (keys["KeyW"] || keys["ArrowUp"]) move.add(fwd);
    if (keys["KeyS"] || keys["ArrowDown"]) move.sub(fwd);
    if (keys["KeyD"]) move.add(rgt);
    if (keys["KeyA"]) move.sub(rgt);

    const targetWalkSpeed = isSprinting && crewStamina > 5 ? 6.2 : 4.2;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(targetWalkSpeed);
      shipWalkState.vel.x = THREE.MathUtils.lerp(shipWalkState.vel.x, move.x, 12 * dt);
      shipWalkState.vel.z = THREE.MathUtils.lerp(shipWalkState.vel.z, move.z, 12 * dt);
      shipWalkState.walkTime += dt * (isSprinting ? 13 : 10);

      if (isSprinting) {
        crewStamina = Math.max(0, crewStamina - 8 * dt);
      } else {
        crewStamina = Math.min(100, crewStamina + 5 * dt);
      }

      const stepPhase = Math.floor(shipWalkState.walkTime / Math.PI);
      if (stepPhase !== shipWalkState.lastStepPhase && shipWalkState.grounded) {
        shipWalkState.lastStepPhase = stepPhase;
        Audio.sfx.footstep(true);
      }
    } else {
      shipWalkState.vel.x *= Math.pow(0.001, dt);
      shipWalkState.vel.z *= Math.pow(0.001, dt);
      crewStamina = Math.min(100, crewStamina + 7 * dt);
    }

    // Artificial 1.0G ship deck vertical physics
    shipWalkState.vel.y -= 9.8 * dt;
    shipWalkState.pos.addScaledVector(shipWalkState.vel, dt);
    if (shipWalkState.pos.y <= 0.05) {
      shipWalkState.pos.y = 0.05;
      shipWalkState.vel.y = 0;
      shipWalkState.grounded = true;
    }

    // Constrain to the 3-Bay Starship Deck Bounds
    shipWalkState.pos.x = Math.max(-1.45, Math.min(1.45, shipWalkState.pos.x));
    shipWalkState.pos.z = Math.max(-0.45, Math.min(8.85, shipWalkState.pos.z));

    // Avoid walking through Captain's Bed frame (x > 0.72, z = 3.65..5.65)
    if (
      shipWalkState.pos.z > 3.58 &&
      shipWalkState.pos.z < 5.72 &&
      shipWalkState.pos.x > 0.68
    ) {
      shipWalkState.pos.x = 0.68;
    }

    // Avoid walking straight through the central Holo-Table (z=3.2) or Reactor Core (z=7.2)
    for (const [obsZ, rad] of [
      [3.2, 0.78],
      [7.2, 0.88]
    ]) {
      const dx = shipWalkState.pos.x;
      const dz = shipWalkState.pos.z - obsZ;
      const d = Math.hypot(dx, dz);
      if (d < rad && d > 0.001) {
        shipWalkState.pos.x = (dx / d) * rad;
        shipWalkState.pos.z = obsZ + (dz / d) * rad;
      }
    }

    const headBob =
      move.lengthSq() > 0 && shipWalkState.grounded
        ? Math.sin(shipWalkState.walkTime) * 0.042
        : 0;

    // Contextual Station Prompts (Pilot Seat / Captain's Bed / Holo-Table / Airlock)
    const x = shipWalkState.pos.x;
    const z = shipWalkState.pos.z;
    if (z < 1.1) {
      UI.setInteractPrompt("PILOT SEAT // HELM CONTROL STATION");
    } else if (z >= 3.5 && z <= 5.85 && x > 0.05) {
      UI.setInteractPrompt(
        "CAPTAIN'S QUARTERS BED // RESTORE STAMINA & ADVANCE SOLAR CYCLE"
      );
    } else if (z >= 1.6 && z <= 4.6) {
      UI.setInteractPrompt("ASTROGATION HOLO-TABLE // QUANTUM WARP NAVIGATION");
    } else if (z > 6.2) {
      UI.setInteractPrompt(
        shipState.landed
          ? "AFT AIRLOCK // PLANET SURFACE & OCEAN BEACH"
          : "AFT AIRLOCK // SURFACE LANDING & EVA"
      );
    } else {
      UI.setInteractPrompt(null);
    }

    updateShipTransform();
    const eyeLocal = shipWalkState.pos.clone();
    eyeLocal.y += headBob;
    const worldEye = eyeLocal.applyMatrix4(cockpit.matrixWorld);
    camera.position.copy(worldEye);
    const alt = updateAtmosphericEnvironment(worldEye, false);

    qShip.copy(cockpit.quaternion);
    lookEuler.set(shipWalkState.pitch, shipWalkState.yaw, 0, "YXZ");
    qLook.setFromEuler(lookEuler);
    qFinal.multiplyQuaternions(qShip, qLook);
    camera.quaternion.copy(qFinal);

    UI.setStamina(crewStamina);
    UI.setHeading(shipState.yaw + shipWalkState.yaw);
    UI.setAltitude(alt, 1.0, false);
    UI.setSpeed(Math.hypot(shipWalkState.vel.x, shipWalkState.vel.z), "m/s");
  }
  // =========================================================================
  // MODE B: PLANET SURFACE WALKING & ARCHIMEDES OCEAN SWIMMING PHYSICS (CAM.FOOT)
  // =========================================================================
  else if (camMode === CAM.FOOT) {
    Audio.updateEngineHum(0, false);

    footState.yaw -= mouse.dx * lookSens;
    footState.pitch = Math.max(
      -1.18,
      Math.min(1.18, footState.pitch - mouse.dy * lookSens)
    );
    mouse.dx = 0;
    mouse.dy = 0;

    const keyTurn =
      (keys["KeyQ"] || keys["ArrowLeft"] ? 1 : 0) -
      (keys["KeyE"] || keys["ArrowRight"] ? 1 : 0);
    const keyPitch = (keys["KeyR"] ? 1 : 0) - (keys["KeyF"] ? 1 : 0);
    footState.yaw += keyTurn * 1.8 * dt;
    footState.pitch = Math.max(
      -1.18,
      Math.min(1.18, footState.pitch + keyPitch * 1.2 * dt)
    );

    const fwd = new THREE.Vector3(-Math.sin(footState.yaw), 0, -Math.cos(footState.yaw));
    const rgt = new THREE.Vector3(Math.cos(footState.yaw), 0, -Math.sin(footState.yaw));

    const move = new THREE.Vector3();
    if (keys["KeyW"] || keys["ArrowUp"]) move.add(fwd);
    if (keys["KeyS"] || keys["ArrowDown"]) move.sub(fwd);
    if (keys["KeyD"]) move.add(rgt);
    if (keys["KeyA"]) move.sub(rgt);

    // Query exact 3D Terrain Ground Height & 4-Wave Gerstner Ocean Surface Height
    const groundWorldY =
      getSurfaceY(PLANET_RADIUS, footState.pos.x, footState.pos.z, currentSystemIndex) -
      PLANET_RADIUS;
    const waterWorldY = getWaterSurfaceWorldY(
      PLANET_RADIUS,
      footState.pos.x,
      footState.pos.z,
      timeSec,
      currentSystemIndex
    );

    const feetY = footState.pos.y - 1.75;
    const submersion = waterWorldY - feetY; // > 0 means standing/swimming in water!
    const wasInWater = footState.inWater;
    footState.inWater = submersion > 0.35;
    footState.waterSplashCooldown = Math.max(0, footState.waterSplashCooldown - dt);

    if (footState.inWater && !wasInWater && footState.waterSplashCooldown <= 0) {
      Audio.sfx.splash(0.85);
      spawnWaterRipple(planet, footState.pos.x, footState.pos.z, 5.2);
      footState.waterSplashCooldown = 0.45;
    }

    const canSprint = isSprinting && crewStamina > 4;
    const targetSpeed = footState.inWater
      ? canSprint
        ? 9.2
        : 6.2
      : canSprint
      ? 14.0
      : 8.5;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(targetSpeed);
      const accel = footState.inWater ? 5.5 : footState.grounded ? 11.0 : 4.0;
      footState.vel.x = THREE.MathUtils.lerp(footState.vel.x, move.x, accel * dt);
      footState.vel.z = THREE.MathUtils.lerp(footState.vel.z, move.z, accel * dt);
      footState.walkTime += dt * (canSprint ? 13.0 : 9.2);

      if (canSprint) {
        crewStamina = Math.max(0, crewStamina - 10 * dt);
      } else {
        crewStamina = Math.min(100, crewStamina + 4 * dt);
      }

      // Dive or ascend along pitch angle when swimming in deeper water
      if (footState.inWater && submersion > 1.0 && (keys["KeyW"] || keys["ArrowUp"])) {
        footState.vel.y += Math.sin(footState.pitch) * 14.0 * dt;
      }

      const stepPhase = Math.floor(footState.walkTime / Math.PI);
      if (stepPhase !== footState.lastStepPhase) {
        footState.lastStepPhase = stepPhase;
        if (footState.inWater) {
          Audio.sfx.splash(0.42);
          spawnWaterRipple(planet, footState.pos.x, footState.pos.z, 3.6);
        } else if (footState.grounded) {
          Audio.sfx.footstep(false);
        }
      }
    } else {
      const damping = footState.inWater ? 0.04 : 0.002;
      footState.vel.x *= Math.pow(damping, dt);
      footState.vel.z *= Math.pow(damping, dt);
      crewStamina = Math.min(100, crewStamina + 8 * dt);
    }

    // Vertical Physics: Gravity vs Archimedes Hydrodynamic Buoyancy!
    if (footState.inWater) {
      // Float smoothly on the Gerstner ocean waves at chest level (eye ~ waterWorldY + 0.65m)
      const targetFloatEyeY = waterWorldY + 0.65;
      const buoyancyError = targetFloatEyeY - footState.pos.y;
      footState.vel.y += (buoyancyError * 14.5 - footState.vel.y * 4.2) * dt;
      UI.setFlightState("OCEAN SWIMMING");
    } else {
      footState.vel.y -= planetGravity * dt;
      UI.setFlightState(footState.grounded ? "PLANET SURFACE" : "LOW-G AIRBORNE");
    }

    footState.pos.addScaledVector(footState.vel, dt);

    // Vast 480m radius exploration zone (nearly 1 km across!)
    const dist = Math.hypot(footState.pos.x, footState.pos.z);
    if (dist > 460) {
      footState.pos.x *= 460 / dist;
      footState.pos.z *= 460 / dist;
    }

    // Terrain Floor Collision
    const newGroundY =
      getSurfaceY(PLANET_RADIUS, footState.pos.x, footState.pos.z, currentSystemIndex) -
      PLANET_RADIUS;
    const minEyeY = newGroundY + 1.75;
    if (footState.pos.y <= minEyeY) {
      footState.pos.y = minEyeY;
      if (footState.vel.y < 0) footState.vel.y = 0;
      footState.grounded = true;
    } else {
      footState.grounded = false;
    }

    const headBob =
      move.lengthSq() > 0 && footState.grounded && !footState.inWater
        ? Math.sin(footState.walkTime) * 0.07
        : 0;

    const isHeadSubmerged = footState.pos.y + headBob < waterWorldY + 0.08;
    UI.setUnderwater(isHeadSubmerged || footState.inWater);

    const distToRamp = Math.hypot(footState.pos.x, footState.pos.z - 3.5);
    if (distToRamp < 6.0) {
      UI.setInteractPrompt("STARSHIP BOARDING RAMP // RETURN TO SHIP INTERIOR");
    } else if (footState.inWater) {
      UI.setInteractPrompt("🌊 OCEAN HYDRO-BUOYANCY // PLANETARY SEA");
    } else {
      UI.setInteractPrompt(null);
    }

    camera.position.set(footState.pos.x, footState.pos.y + headBob, footState.pos.z);
    updateAtmosphericEnvironment(camera.position, isHeadSubmerged);
    lookEuler.set(footState.pitch, footState.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(lookEuler);

    const horizSpeed = Math.hypot(footState.vel.x, footState.vel.z, footState.vel.y);
    UI.setSpeed(horizSpeed, "m/s");
    UI.setStamina(crewStamina);
    UI.setHeading(footState.yaw);
    UI.setAltitude(
      footState.inWater ? -(waterWorldY - (footState.pos.y - 1.4)) : footState.pos.y,
      sys.gravity || 1.0,
      footState.inWater
    );
  }
  // =========================================================================
  // MODE C: 6-DOF STARSHIP FLIGHT & OCEAN WATER BUOYANCY PHYSICS
  // =========================================================================
  else {
    UI.setInteractPrompt(null);
    UI.setUnderwater(false);

    const throttleInput =
      (keys["KeyW"] || keys["ArrowUp"] ? 1 : 0) -
      (keys["KeyS"] || keys["ArrowDown"] ? 1 : 0);
    const yawInput =
      (keys["KeyA"] || keys["ArrowLeft"] ? 1 : 0) -
      (keys["KeyD"] || keys["ArrowRight"] ? 1 : 0);
    const rollInput = (keys["KeyQ"] ? 1 : 0) - (keys["KeyE"] ? 1 : 0);
    const pitchInput = (keys["KeyR"] ? 1 : 0) - (keys["KeyF"] ? 1 : 0);

    if (isDraggingMouse && (mouse.dx !== 0 || mouse.dy !== 0)) {
      const factor = camMode === CAM.COCKPIT ? 0.85 : 1.0;
      shipState.yaw -= mouse.dx * lookSens * factor;
      shipState.pitch = Math.max(
        -1.05,
        Math.min(1.05, shipState.pitch - mouse.dy * lookSens * factor)
      );
    }
    mouse.dx = 0;
    mouse.dy = 0;

    const boostMultiplier = isSprinting && crewStamina > 5 ? 1.85 : 1.0;
    if (isSprinting && shipState.thrust > 0.1) {
      crewStamina = Math.max(0, crewStamina - 6 * dt);
    } else {
      crewStamina = Math.min(100, crewStamina + 8 * dt);
    }

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
      shipState.thrust *= 0.99;
    }

    Audio.updateEngineHum(shipState.thrust * boostMultiplier, !shipState.landed);

    if (!shipState.landed) {
      // Smooth angular velocity & aerodynamic banking
      shipState.yaw += yawInput * 1.35 * dt;
      shipState.pitch = Math.max(
        -1.15,
        Math.min(1.15, shipState.pitch + pitchInput * 1.1 * dt)
      );
      shipState.roll = THREE.MathUtils.lerp(
        shipState.roll,
        -yawInput * 0.52 + rollInput * 0.72,
        5 * dt
      );

      const prevSpeed = shipState.speed;
      const targetSpeed = shipState.thrust * shipState.maxSpeed * boostMultiplier;
      shipState.speed = THREE.MathUtils.lerp(shipState.speed, targetSpeed, 3.8 * dt);

      updateShipVectors();

      // Integrate 3D Newtonian + Aerodynamic Velocity Vector
      const desiredVel = shipState.forward
        .clone()
        .multiplyScalar(shipState.speed * 115);
      shipState.vel.lerp(desiredVel, 4.2 * dt);

      const inNorthPoleZone =
        shipState.pos.y > -450 && Math.hypot(shipState.pos.x, shipState.pos.z) < 650;

      // Subtle Planetary Gravity Pull when hovering at low speed near the landing zone
      if (inNorthPoleZone && shipState.pos.y < 95 && shipState.thrust < 0.15) {
        shipState.vel.y -= planetGravity * 0.22 * dt;
      }

      shipState.pos.addScaledVector(shipState.vel, dt);

      // Dynamic G-Force calculation from linear acceleration + banking turn load
      const accelG = (Math.abs(shipState.speed - prevSpeed) / Math.max(0.008, dt)) * 1.8;
      const turnG = Math.abs(shipState.roll) * 1.45;
      shipState.gForce = THREE.MathUtils.lerp(
        shipState.gForce,
        (sys.gravity || 1.0) + accelG + turnG + (boostMultiplier > 1 ? 1.2 : 0),
        6 * dt
      );

      if (inNorthPoleZone) {
        // Check North Pole Terrain & Ocean Surface Collision / Hydro-Buoyancy!
        const terrainFloorY =
          getSurfaceY(PLANET_RADIUS, shipState.pos.x, shipState.pos.z, currentSystemIndex) -
          PLANET_RADIUS +
          1.65;
        const oceanSurfaceY =
          getWaterSurfaceWorldY(
            PLANET_RADIUS,
            shipState.pos.x,
            shipState.pos.z,
            timeSec,
            currentSystemIndex
          ) + 1.35;

        if (sys.hasWater && oceanSurfaceY > terrainFloorY && shipState.pos.y < oceanSurfaceY) {
          shipState.pos.y = THREE.MathUtils.lerp(shipState.pos.y, oceanSurfaceY, 8 * dt);
          shipState.vel.y = Math.max(0, shipState.vel.y);
          shipState.pitch = THREE.MathUtils.lerp(shipState.pitch, 0.04, 4 * dt);
          ship.setSteamIntensity(0.65);
          if (Math.random() < 0.25) {
            spawnWaterRipple(planet, shipState.pos.x, shipState.pos.z, 7.5);
          }
          UI.setFlightState("OCEAN HYDRO-SKIM");
        } else if (shipState.pos.y < terrainFloorY) {
          shipState.pos.y = terrainFloorY;
          shipState.vel.y = Math.max(0, shipState.vel.y);
          UI.setFlightState("LOW ALTITUDE");
        } else {
          UI.setFlightState(shipState.pos.y < 120 ? "ATMOSPHERIC FLIGHT" : "ORBITAL FLIGHT");
        }
      } else {
        // 3D Spherical Planetary Boundary Check in Orbital Space
        const dx = shipState.pos.x;
        const dy = shipState.pos.y + PLANET_RADIUS;
        const dz = shipState.pos.z;
        const distCenter = Math.hypot(dx, dy, dz);
        const minOrbitRad = PLANET_RADIUS + 18.0;
        if (distCenter < minOrbitRad && distCenter > 0.001) {
          const s = minOrbitRad / distCenter;
          shipState.pos.set(dx * s, dy * s - PLANET_RADIUS, dz * s);
          UI.setFlightState("UPPER ATMOSPHERE SKIM");
        } else {
          UI.setFlightState(distCenter < PLANET_RADIUS + 180 ? "ATMOSPHERIC FLIGHT" : "ORBITAL SPACE");
        }
      }
    } else {
      shipState.speed = 0;
      shipState.thrust = 0;
      shipState.vel.set(0, 0, 0);
      shipState.gForce = sys.gravity || 1.0;
    }

    if (ship.__quantumRing) {
      ship.__quantumRing.rotation.z +=
        dt * (1.2 + shipState.thrust * 4.5 + (warpCharge / 100) * 8);
    }

    updateShipTransform();
    const alt = updateAtmosphericEnvironment(shipState.pos, false);

    if (cockpit.__throttle) {
      cockpit.__throttle.rotation.x = -0.25 - shipState.thrust * 0.55;
    }
    if (cockpit.__stick) {
      cockpit.__stick.rotation.z = -shipState.roll * 0.5;
      cockpit.__stick.rotation.x = shipState.pitch * 0.4;
    }

    const thrusters = ship.userData.thrusters || [];
    const pulse =
      0.55 + shipState.thrust * 0.85 * boostMultiplier + Math.sin(now * 0.028) * 0.1;
    for (const tGroup of thrusters) {
      if (tGroup.userData && tGroup.userData.outer) {
        tGroup.userData.outer.material.opacity = Math.min(1, pulse * 0.85);
        tGroup.userData.inner.material.opacity = Math.min(1, pulse);
      }
      tGroup.scale.set(1, 1, 0.55 + shipState.thrust * 1.45 * boostMultiplier);
    }
    if (ship.__engineLight) {
      ship.__engineLight.intensity = 1.4 + shipState.thrust * 4.0 * boostMultiplier;
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

    UI.setSpeed(shipState.speed * 1450, "km/s");
    UI.setStamina(crewStamina);
    UI.setHeading(shipState.yaw);
    UI.setAltitude(alt, shipState.gForce, false);
  }

  composer.render();
  requestAnimationFrame(update);
};

requestAnimationFrame(update);

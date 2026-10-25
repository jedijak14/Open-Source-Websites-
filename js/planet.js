/**
 * Stellar Voyage — Colossal Photorealistic Planets (R = 1800) & JavaScript Ocean Physics
 * Features:
 * - Pure JavaScript + Three.js PBR Planetary Globe Generator (zero fragile raw shader dependencies)
 * - Immediate JS Canvas 2D Continental/Bathymetry/Cloud synthesis on Frame 1 +
 *   automatic JavaScript pixel-compositing of 4K NASA satellite maps (earth_day_4096.jpg,
 *   earth_specular_2048.jpg, earth_clouds_1024.png) for all 5 planets
 * - Full-Screen Orbital Scale (R = 1800) with swirling cyclone clouds, cloud shadows,
 *   Rayleigh blue atmospheric limb, and crisp right-side day/night terminator
 * - JavaScript-Driven 3D Gerstner Ocean Mesh + Archimedes Water Buoyancy, Ripples & Marine Fauna
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { makePlanetTextures, Textures } from "./textures.js?v=8";

export const PLANET_RADIUS = 1800;

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./vendor/three/examples/jsm/libs/draco/gltf/");
gltfLoader.setDRACOLoader(dracoLoader);

export const SYSTEMS = [
  {
    name: "KEPLER-442b",
    biome: "SAPPHIRE OCEAN & ROSE CONTINENTS",
    seed: 1.1,
    hasWater: true,
    waterLevel: -0.35,
    gravity: 1.0,
    atmosPressure: "104 kPa O₂/N₂",
    uvShiftX: 0.0,
    uvShiftY: 0.0,
    flipX: false,
    oceanDeepRGB: [52, 84, 178],
    oceanShallowRGB: [88, 132, 216],
    landLowRGB: [112, 128, 118],
    landMidRGB: [168, 128, 138],
    landHighRGB: [204, 168, 176],
    atmosTintRGB: [118, 162, 248],
    waterDeepHex: 0x1d4ed8,
    waterShallowHex: 0x38bdf8,
    palette: {
      c1: [30, 64, 175],
      c2: [16, 185, 129],
      c3: [180, 130, 140],
      c4: [217, 119, 6]
    },
    atmosHex: 0x6898f8,
    horizonHex: 0x93c5fd,
    ringHex: null,
    animalStyle: "quadruped",
    gltfAnimals: [
      { file: "assets/models/fox.glb", scale: 0.022, yOffset: 0, grounded: true },
      { file: "assets/models/flamingo.glb", scale: 0.018, yOffset: 2.8, grounded: false }
    ],
    animalColors: { body: 0xfde047, accent: 0x06b6d4, eye: 0xef4444 }
  },
  {
    name: "GLIESE-667Cc",
    biome: "CRIMSON CONTINENTS & COBALT SEAS",
    seed: 2.7,
    hasWater: true,
    waterLevel: -0.45,
    gravity: 1.18,
    atmosPressure: "132 kPa CO₂/Ar",
    uvShiftX: 0.36,
    uvShiftY: 0.12,
    flipX: true,
    oceanDeepRGB: [42, 68, 156],
    oceanShallowRGB: [78, 118, 204],
    landLowRGB: [148, 92, 82],
    landMidRGB: [192, 122, 102],
    landHighRGB: [224, 168, 146],
    atmosTintRGB: [132, 156, 242],
    waterDeepHex: 0x1e3a8a,
    waterShallowHex: 0x3b82f6,
    palette: {
      c1: [127, 29, 29],
      c2: [185, 28, 28],
      c3: [234, 88, 12],
      c4: [68, 64, 60]
    },
    atmosHex: 0x7c96f4,
    horizonHex: 0xfda4af,
    ringHex: null,
    animalStyle: "arachnid",
    gltfAnimals: [
      { file: "assets/models/stork.glb", scale: 0.02, yOffset: 3.1, grounded: false },
      { file: "assets/models/fox.glb", scale: 0.024, yOffset: 0, grounded: true }
    ],
    animalColors: { body: 0x27272a, accent: 0xf97316, eye: 0xfacc15 }
  },
  {
    name: "TRAPPIST-1e",
    biome: "CERULEAN ARCHIPELAGO & JADE HIGHLANDS",
    seed: 4.3,
    hasWater: true,
    waterLevel: -0.25,
    gravity: 0.92,
    atmosPressure: "96 kPa N₂/O₂",
    uvShiftX: 0.62,
    uvShiftY: -0.15,
    flipX: false,
    oceanDeepRGB: [40, 92, 186],
    oceanShallowRGB: [76, 148, 226],
    landLowRGB: [78, 134, 114],
    landMidRGB: [146, 142, 128],
    landHighRGB: [206, 188, 176],
    atmosTintRGB: [110, 174, 250],
    waterDeepHex: 0x0369a1,
    waterShallowHex: 0x06b6d4,
    palette: {
      c1: [30, 58, 138],
      c2: [56, 189, 248],
      c3: [125, 211, 252],
      c4: [224, 242, 254]
    },
    atmosHex: 0x56a8f8,
    horizonHex: 0xbae6fd,
    ringHex: null,
    animalStyle: "strider",
    gltfAnimals: [
      { file: "assets/models/parrot.glb", scale: 0.022, yOffset: 2.6, grounded: false },
      { file: "assets/models/fox.glb", scale: 0.021, yOffset: 0, grounded: true }
    ],
    animalColors: { body: 0xe0f2fe, accent: 0x38bdf8, eye: 0x3b82f6 }
  },
  {
    name: "TOI-700 d",
    biome: "ULTRAMARINE PELAGIC & CORAL CONTINENTS",
    seed: 6.1,
    hasWater: true,
    waterLevel: -0.28,
    gravity: 0.86,
    atmosPressure: "118 kPa O₂/Ne",
    uvShiftX: 0.24,
    uvShiftY: 0.28,
    flipX: true,
    oceanDeepRGB: [48, 76, 176],
    oceanShallowRGB: [92, 126, 218],
    landLowRGB: [124, 116, 148],
    landMidRGB: [182, 136, 158],
    landHighRGB: [218, 182, 196],
    atmosTintRGB: [128, 158, 250],
    waterDeepHex: 0x1e3a8a,
    waterShallowHex: 0x0ea5e9,
    palette: {
      c1: [59, 7, 100],
      c2: [126, 34, 206],
      c3: [16, 185, 129],
      c4: [244, 114, 182]
    },
    atmosHex: 0x7292fc,
    horizonHex: 0xddd6fe,
    ringHex: null,
    animalStyle: "floater",
    gltfAnimals: [
      { file: "assets/models/parrot.glb", scale: 0.024, yOffset: 3.0, grounded: false },
      { file: "assets/models/flamingo.glb", scale: 0.02, yOffset: 2.5, grounded: false }
    ],
    animalColors: { body: 0xc084fc, accent: 0x34d399, eye: 0xf472b6 }
  },
  {
    name: "LHS-1140 b",
    biome: "CRYO-SAPPHIRE OCEAN & GLACIAL CONTINENTS",
    seed: 8.4,
    hasWater: true,
    waterLevel: -0.32,
    gravity: 1.32,
    atmosPressure: "148 kPa N₂/CH₄",
    uvShiftX: 0.52,
    uvShiftY: -0.22,
    flipX: false,
    oceanDeepRGB: [44, 82, 174],
    oceanShallowRGB: [88, 144, 224],
    landLowRGB: [138, 154, 174],
    landMidRGB: [186, 196, 212],
    landHighRGB: [232, 238, 248],
    atmosTintRGB: [124, 172, 252],
    waterDeepHex: 0x0f172a,
    waterShallowHex: 0x0284c7,
    palette: {
      c1: [69, 26, 3],
      c2: [180, 83, 9],
      c3: [245, 158, 11],
      c4: [253, 224, 71]
    },
    atmosHex: 0x68a8fc,
    horizonHex: 0xe0f2fe,
    ringHex: null,
    animalStyle: "beetle",
    gltfAnimals: [
      { file: "assets/models/stork.glb", scale: 0.022, yOffset: 2.8, grounded: false },
      { file: "assets/models/fox.glb", scale: 0.025, yOffset: 0, grounded: true }
    ],
    animalColors: { body: 0x78350f, accent: 0xfbbf24, eye: 0x38bdf8 }
  }
];

// ============================================================================
// 1. PURE JAVASCRIPT PHOTOREALISTIC GLOBE & CLOUD CANVAS COMPOSITOR
// ============================================================================
const jsNoise2D = (x, y, seed = 1.0) => {
  const n =
    Math.sin(x * 1.7 + seed) * Math.cos(y * 1.7 - seed) * 0.5 +
    Math.sin(x * 3.9 - y * 2.8 + seed * 1.7) * 0.25 +
    Math.cos(x * 8.3 + y * 7.1 - seed * 2.3) * 0.125 +
    Math.sin(x * 17.1 - y * 15.3 + seed * 3.1) * 0.0625;
  return n * 0.5 + 0.5;
};

const createJavaScriptPlanetGlobeMaps = (sys) => {
  const W = 1024;
  const H = 512;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = W;
  colorCanvas.height = H;
  const colorCtx = colorCanvas.getContext("2d");

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = W;
  roughCanvas.height = H;
  const roughCtx = roughCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bumpCtx = bumpCanvas.getContext("2d");

  // Step 1: Immediate JavaScript Procedural Synthesis (so Frame 1 is 100% textured!)
  const colorImg = colorCtx.createImageData(W, H);
  const roughImg = roughCtx.createImageData(W, H);
  const bumpImg = bumpCtx.createImageData(W, H);
  const cData = colorImg.data;
  const rData = roughImg.data;
  const bData = bumpImg.data;

  for (let y = 0; y < H; y++) {
    const v = y / H;
    const lat = (v - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const lon = u * Math.PI * 2;

      const nx = Math.cos(lon) * cosLat * 2.2;
      const ny = Math.sin(lat) * 2.2;
      const nz = Math.sin(lon) * cosLat * 2.2;

      const cont = jsNoise2D(nx + ny * 0.6, nz - ny * 0.4, sys.seed);
      const detail = jsNoise2D(nx * 3.4, nz * 3.4 + ny * 2.1, sys.seed * 2.1);
      const elev = cont * 0.72 + detail * 0.28;

      const idx = (y * W + x) * 4;
      if (elev < 0.54) {
        // Ocean with bathymetric shelf ridges
        const shelf = Math.max(0, Math.min(1, (elev - 0.34) / 0.2));
        cData[idx] = Math.round(sys.oceanDeepRGB[0] * (1 - shelf) + sys.oceanShallowRGB[0] * shelf);
        cData[idx + 1] = Math.round(sys.oceanDeepRGB[1] * (1 - shelf) + sys.oceanShallowRGB[1] * shelf);
        cData[idx + 2] = Math.round(sys.oceanDeepRGB[2] * (1 - shelf) + sys.oceanShallowRGB[2] * shelf);
        cData[idx + 3] = 255;

        rData[idx] = rData[idx + 1] = rData[idx + 2] = 175;
        rData[idx + 3] = 255;
        bData[idx] = bData[idx + 1] = bData[idx + 2] = 110;
        bData[idx + 3] = 255;
      } else {
        // Continent with rose/ochre highlands and olive lowlands
        const hNorm = Math.min(1, (elev - 0.54) / 0.32);
        const lowToMid = Math.min(1, hNorm * 1.6);
        const midToHigh = Math.max(0, (hNorm - 0.5) * 2.0);
        let r = sys.landLowRGB[0] * (1 - lowToMid) + sys.landMidRGB[0] * lowToMid;
        let g = sys.landLowRGB[1] * (1 - lowToMid) + sys.landMidRGB[1] * lowToMid;
        let b = sys.landLowRGB[2] * (1 - lowToMid) + sys.landMidRGB[2] * lowToMid;

        r = r * (1 - midToHigh) + sys.landHighRGB[0] * midToHigh;
        g = g * (1 - midToHigh) + sys.landHighRGB[1] * midToHigh;
        b = b * (1 - midToHigh) + sys.landHighRGB[2] * midToHigh;

        cData[idx] = Math.round(r);
        cData[idx + 1] = Math.round(g);
        cData[idx + 2] = Math.round(b);
        cData[idx + 3] = 255;

        rData[idx] = rData[idx + 1] = rData[idx + 2] = 215;
        rData[idx + 3] = 255;
        const bumpVal = Math.min(255, Math.round(128 + hNorm * 120));
        bData[idx] = bData[idx + 1] = bData[idx + 2] = bumpVal;
        bData[idx + 3] = 255;
      }
    }
  }

  colorCtx.putImageData(colorImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping;

  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;

  // Step 2: JavaScript Asynchronous 4K NASA Satellite Map Compositor
  // Blends real NASA continental geography & bathymetry into the canvas texture!
  const dayImgEl = new Image();
  const specImgEl = new Image();
  let loadedCount = 0;

  const onBothLoaded = () => {
    loadedCount++;
    if (loadedCount < 2) return;
    try {
      const tmpDay = document.createElement("canvas");
      tmpDay.width = W;
      tmpDay.height = H;
      const dCtx = tmpDay.getContext("2d");
      dCtx.drawImage(dayImgEl, 0, 0, W, H);
      const dayPixels = dCtx.getImageData(0, 0, W, H).data;

      const tmpSpec = document.createElement("canvas");
      tmpSpec.width = W;
      tmpSpec.height = H;
      const sCtx = tmpSpec.getContext("2d");
      sCtx.drawImage(specImgEl, 0, 0, W, H);
      const specPixels = sCtx.getImageData(0, 0, W, H).data;

      const shiftX = Math.floor(((sys.uvShiftX || 0) % 1) * W + W) % W;
      const shiftY = Math.floor(((sys.uvShiftY || 0) % 1) * H + H) % H;

      for (let y = 0; y < H; y++) {
        const sy = (y + shiftY) % H;
        for (let x = 0; x < W; x++) {
          const sx = sys.flipX ? (W - 1 - ((x + shiftX) % W)) : (x + shiftX) % W;
          const srcIdx = (sy * W + sx) * 4;
          const dstIdx = (y * W + x) * 4;

          const dr = dayPixels[srcIdx];
          const dg = dayPixels[srcIdx + 1];
          const db = dayPixels[srcIdx + 2];
          const isOcean = specPixels[srcIdx] > 95; // NASA specular mask: white = ocean, black = land

          if (isOcean) {
            // Bathymetry from NASA blue channel + procedural ridges
            const bathy = Math.min(1, Math.max(0, (db - 40) / 135));
            const shelf = bathy * 0.72 + (bData[dstIdx] / 255) * 0.28;
            const r = sys.oceanDeepRGB[0] * (1 - shelf) + sys.oceanShallowRGB[0] * shelf;
            const g = sys.oceanDeepRGB[1] * (1 - shelf) + sys.oceanShallowRGB[1] * shelf;
            const b = sys.oceanDeepRGB[2] * (1 - shelf) + sys.oceanShallowRGB[2] * shelf;

            // Blend subtle Rayleigh atmospheric tint like NASA orbital photography
            cData[dstIdx] = Math.round(r * 0.84 + sys.atmosTintRGB[0] * 0.16);
            cData[dstIdx + 1] = Math.round(g * 0.84 + sys.atmosTintRGB[1] * 0.16);
            cData[dstIdx + 2] = Math.round(b * 0.84 + sys.atmosTintRGB[2] * 0.16);
            cData[dstIdx + 3] = 255;

            rData[dstIdx] = rData[dstIdx + 1] = rData[dstIdx + 2] = 175;
            bData[dstIdx] = bData[dstIdx + 1] = bData[dstIdx + 2] = Math.round(100 + shelf * 30);
          } else {
            // Landmass: blend NASA continental relief with planet's rose/ochre/sage palette
            const desertFactor = Math.min(1, Math.max(0, (dr - dg * 0.65) / 110));
            const luma = (dr * 0.35 + dg * 0.45 + db * 0.2) / 255;

            let lr = sys.landLowRGB[0] * (1 - desertFactor) + sys.landMidRGB[0] * desertFactor;
            let lg = sys.landLowRGB[1] * (1 - desertFactor) + sys.landMidRGB[1] * desertFactor;
            let lb = sys.landLowRGB[2] * (1 - desertFactor) + sys.landMidRGB[2] * desertFactor;

            // Highlight mountain cordilleras & plateaus
            const highMix = Math.max(0, (luma - 0.45) * 1.4);
            lr = lr * (1 - highMix) + sys.landHighRGB[0] * highMix;
            lg = lg * (1 - highMix) + sys.landHighRGB[1] * highMix;
            lb = lb * (1 - highMix) + sys.landHighRGB[2] * highMix;

            // Blend 35% raw NASA satellite color + 18% Rayleigh aerial perspective haze
            lr = lr * 0.65 + dr * 0.35;
            lg = lg * 0.65 + dg * 0.35;
            lb = lb * 0.65 + db * 0.35;

            cData[dstIdx] = Math.round(lr * 0.82 + sys.atmosTintRGB[0] * 0.18);
            cData[dstIdx + 1] = Math.round(lg * 0.82 + sys.atmosTintRGB[1] * 0.18);
            cData[dstIdx + 2] = Math.round(lb * 0.82 + sys.atmosTintRGB[2] * 0.18);
            cData[dstIdx + 3] = 255;

            rData[dstIdx] = rData[dstIdx + 1] = rData[dstIdx + 2] = 210;
            const elevBump = Math.min(255, Math.round(128 + luma * 125));
            bData[dstIdx] = bData[dstIdx + 1] = bData[dstIdx + 2] = elevBump;
          }
        }
      }

      colorCtx.putImageData(colorImg, 0, 0);
      roughCtx.putImageData(roughImg, 0, 0);
      bumpCtx.putImageData(bumpImg, 0, 0);
      colorTex.needsUpdate = true;
      roughTex.needsUpdate = true;
      bumpTex.needsUpdate = true;
    } catch (e) {}
  };

  dayImgEl.onload = onBothLoaded;
  specImgEl.onload = onBothLoaded;
  dayImgEl.src = "assets/textures/earth_day_4096.jpg";
  specImgEl.src = "assets/textures/earth_specular_2048.jpg";

  return { colorTex, roughTex, bumpTex };
};

const createJavaScriptCloudTexture = (seed = 1.0) => {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const lat = (v - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const lon = u * Math.PI * 2;
      const swirl = Math.sin(lon * 3.0 + lat * 4.0 + seed) * 0.35;
      const n1 = jsNoise2D(Math.cos(lon + swirl) * cosLat * 3.2, Math.sin(lat) * 3.2, seed + 3.7);
      const n2 = jsNoise2D(Math.sin(lon - swirl) * cosLat * 7.5, Math.cos(lat) * 7.5, seed + 8.1);
      const c = Math.max(0, (n1 * 0.68 + n2 * 0.32 - 0.48) * 2.35);
      const alpha = Math.min(255, Math.round(c * 245));
      const idx = (y * W + x) * 4;
      d[idx] = 250;
      d[idx + 1] = 252;
      d[idx + 2] = 255;
      d[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

  // Enhance with real NASA 1024px swirling cyclone cloud map once loaded
  const cloudImgEl = new Image();
  cloudImgEl.onload = () => {
    try {
      const tmp = document.createElement("canvas");
      tmp.width = W;
      tmp.height = H;
      const tCtx = tmp.getContext("2d");
      tCtx.drawImage(cloudImgEl, 0, 0, W, H);
      const src = tCtx.getImageData(0, 0, W, H).data;
      const shiftX = Math.floor((seed * 173) % W);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const sx = (x + shiftX) % W;
          const sIdx = (y * W + sx) * 4;
          const dIdx = (y * W + x) * 4;
          const nasaCloud = src[sIdx + 3];
          d[dIdx] = 248;
          d[dIdx + 1] = 251;
          d[dIdx + 2] = 255;
          d[dIdx + 3] = Math.min(235, Math.round(nasaCloud * 0.92));
        }
      }
      ctx.putImageData(img, 0, 0);
      tex.needsUpdate = true;
    } catch (e) {}
  };
  cloudImgEl.src = "assets/textures/earth_clouds_1024.png";

  return tex;
};

// ============================================================================
// 2. SCULPTED 3D TERRAIN & JAVASCRIPT GERSTNER OCEAN FOR SURFACE EXPLORATION
// ============================================================================
export const getTerrainOffset = (x, z, sysIdx = 0) => {
  const sys = SYSTEMS[sysIdx % SYSTEMS.length];
  const distFromPad = Math.hypot(x, z);

  const padFlat = Math.min(1.0, Math.max(0.0, (distFromPad - 22.0) / 18.0));
  const smoothPad = padFlat * padFlat * (3.0 - 2.0 * padFlat);

  const bayFactor = Math.max(0.0, Math.min(1.0, (z - 16.0) / 55.0));
  const bayDepth = -6.8 * bayFactor * Math.sin(Math.min(Math.PI * 0.5, bayFactor * 1.4));

  const northFactor = Math.max(0.0, Math.min(1.0, (-z - 26.0) / 85.0));
  const mtnWaves =
    Math.sin(x * 0.028 + sys.seed) * Math.cos(z * 0.028 - sys.seed) * 16.0 +
    Math.sin(x * 0.065 - z * 0.045) * 7.5 +
    Math.cos(x * 0.14 + z * 0.12) * 2.4;
  const mountainHeight = northFactor * (10.0 + Math.max(0.0, mtnWaves));

  const continentRoll =
    Math.sin(x * 0.018 + sys.seed * 1.3) * Math.cos(z * 0.018) * 5.2 +
    Math.sin((x + z) * 0.042 + sys.seed) * 2.2 +
    Math.cos(x * 0.11 - z * 0.09) * 0.65;

  const rawHeight = continentRoll + bayDepth + mountainHeight;
  return THREE.MathUtils.lerp(2.2, rawHeight, smoothPad);
};

export const getSurfaceY = (radius, x, z, sysIdx = 0) => {
  const distSq = x * x + z * z;
  const sphereY = Math.sqrt(Math.max(1, radius * radius - distSq));
  return sphereY + getTerrainOffset(x, z, sysIdx);
};

export const getWaterSurfaceWorldY = (radius, x, z, time = 0, sysIdx = 0) => {
  const sys = SYSTEMS[sysIdx % SYSTEMS.length];
  if (!sys.hasWater) return -99999;

  const distSq = x * x + z * z;
  const sphereDrop = radius - Math.sqrt(Math.max(1, radius * radius - distSq));
  const baseWaterY = sys.waterLevel - sphereDrop;

  const w1 = Math.sin(x * 0.14 + z * 0.06 + time * 2.1) * 0.28;
  const w2 = Math.cos(x * 0.08 - z * 0.16 + time * 1.65) * 0.22;
  const w3 = Math.sin((x + z) * 0.25 - time * 2.8) * 0.11;
  const w4 = Math.cos(x * 0.38 - z * 0.31 + time * 3.4) * 0.06;

  return baseWaterY + w1 + w2 + w3 + w4;
};

// ============================================================================
// 3. BUILD COLOSSAL PLANET + CLOUDS + ATMOSPHERE + SURFACE/OCEAN ZONE
// ============================================================================
export const buildPlanet = (radius = PLANET_RADIUS, systemIndex = 0) => {
  const sys = SYSTEMS[systemIndex % SYSTEMS.length];
  const group = new THREE.Group();
  group.userData.system = sys;
  group.userData.systemIndex = systemIndex;
  group.userData.radius = radius;

  // 1. Primary Colossal Spherical Globe (R = 1800) with JavaScript-Synthesized + 4K NASA PBR Maps
  const globeMaps = createJavaScriptPlanetGlobeMaps(sys);
  const geo = new THREE.SphereGeometry(radius, 96, 96);
  const globeMat = new THREE.MeshStandardMaterial({
    map: globeMaps.colorTex,
    roughnessMap: globeMaps.roughTex,
    bumpMap: globeMaps.bumpTex,
    bumpScale: 3.5,
    roughness: 0.72,
    metalness: 0.06,
    envMapIntensity: 0.02
  });
  const planetMesh = new THREE.Mesh(geo, globeMat);
  planetMesh.receiveShadow = true;
  group.add(planetMesh);
  group.planetMesh = planetMesh;

  // 2. Swirling White Cyclone Cloud Sphere + Cloud Shadow Layer (pure Three.js PBR)
  const cloudTex = createJavaScriptCloudTexture(sys.seed);

  const cloudShadowGeo = new THREE.SphereGeometry(radius * 1.002, 72, 72);
  const cloudShadowMat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    color: 0x091326,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });
  const cloudShadowMesh = new THREE.Mesh(cloudShadowGeo, cloudShadowMat);
  cloudShadowMesh.rotation.y = 0.004;
  group.add(cloudShadowMesh);
  group.cloudShadowMesh = cloudShadowMesh;

  const cloudGeo = new THREE.SphereGeometry(radius * 1.007, 84, 84);
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.92,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.02,
    depthWrite: false
  });
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  group.add(cloudMesh);
  group.cloudMesh = cloudMesh;

  // 3. Crisp Rayleigh Atmospheric Limb Halo (hugs the globe edge tightly like NASA photos)
  const outerAtmosGeo = new THREE.SphereGeometry(radius * 1.02, 72, 72);
  const outerAtmosMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(sys.atmosHex) },
      uSunDir: { value: new THREE.Vector3(-0.52, 0.34, 0.78).normalize() }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      void main() {
        float rim = pow(clamp(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.8);
        float daySide = smoothstep(-0.22, 0.35, dot(vWorldNormal, normalize(uSunDir)));
        vec3 col = uColor * (0.15 + 0.85 * daySide);
        gl_FragColor = vec4(col, rim * 0.75 * (0.2 + 0.8 * daySide));
      }
    `
  });
  const outerAtmos = new THREE.Mesh(outerAtmosGeo, outerAtmosMat);
  group.add(outerAtmos);
  group.outerAtmosMat = outerAtmosMat;

  // 4. Orbiting 3D Moon in Deep Space
  const moonPivot = new THREE.Group();
  const moonGeo = new THREE.SphereGeometry(95, 40, 40);
  const moonMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.92,
    metalness: 0.05
  });
  texLoader.load(
    "assets/textures/moon_1024.jpg",
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      moonMat.map = t;
      moonMat.needsUpdate = true;
    },
    undefined,
    () => {}
  );
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(-2850, 950, -1400);
  moonPivot.add(moonMesh);
  group.add(moonPivot);
  group.moonPivot = moonPivot;

  // 5. Surface & Ocean Exploration Detail Group at the North Pole Landing Zone (0, +R, 0)
  const surfaceDetailGroup = new THREE.Group();
  surfaceDetailGroup.visible = false;
  group.add(surfaceDetailGroup);
  group.surfaceDetailGroup = surfaceDetailGroup;

  const pTex = makePlanetTextures(sys.seed, sys.palette);
  const capSize = 900;
  const capSegs = 120;
  const capGeo = new THREE.PlaneGeometry(capSize, capSize, capSegs, capSegs);
  capGeo.rotateX(-Math.PI / 2);

  const posAttr = capGeo.attributes.position;
  const colArray = new Float32Array(posAttr.count * 3);
  const cSand = new THREE.Color(0xd6c79c);
  const cLow = new THREE.Color(...sys.palette.c2.map((v) => v / 255));
  const cHigh = new THREE.Color(...sys.palette.c3.map((v) => v / 255));
  const cPeak = new THREE.Color(0xf1f5f9);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const hOffset = getTerrainOffset(vx, vz, systemIndex);
    const py = getSurfaceY(radius, vx, vz, systemIndex);
    posAttr.setY(i, py);

    if (hOffset < 0.8) {
      tmpCol.copy(cSand);
    } else if (hOffset < 7.5) {
      tmpCol.copy(cLow).lerp(cHigh, (hOffset - 0.8) / 6.7);
    } else {
      tmpCol.copy(cHigh).lerp(cPeak, Math.min(1, (hOffset - 7.5) / 10.0));
    }
    colArray[i * 3] = tmpCol.r;
    colArray[i * 3 + 1] = tmpCol.g;
    colArray[i * 3 + 2] = tmpCol.b;
  }
  capGeo.setAttribute("color", new THREE.BufferAttribute(colArray, 3));
  capGeo.computeVertexNormals();

  const capMat = new THREE.MeshStandardMaterial({
    map: pTex.map,
    bumpMap: pTex.bump,
    bumpScale: 1.5,
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.08
  });
  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.receiveShadow = true;
  surfaceDetailGroup.add(capMesh);

  // 6. JavaScript-Animated 3D Gerstner Ocean Mesh + Ripples + Floating Buoys
  if (sys.hasWater) {
    const oceanSegs = 72;
    const oceanGeo = new THREE.PlaneGeometry(capSize, capSize, oceanSegs, oceanSegs);
    oceanGeo.rotateX(-Math.PI / 2);

    // Store base (x, z) coordinates for fast JavaScript wave displacement each frame
    const oPos = oceanGeo.attributes.position;
    const baseXZ = new Float32Array(oPos.count * 2);
    for (let i = 0; i < oPos.count; i++) {
      const ox = oPos.getX(i);
      const oz = oPos.getZ(i);
      baseXZ[i * 2] = ox;
      baseXZ[i * 2 + 1] = oz;
      oPos.setY(i, radius + getWaterSurfaceWorldY(radius, ox, oz, 0, systemIndex));
    }
    oceanGeo.computeVertexNormals();

    const oceanMat = new THREE.MeshStandardMaterial({
      color: sys.waterShallowHex,
      emissive: sys.waterDeepHex,
      emissiveIntensity: 0.25,
      roughness: 0.14,
      metalness: 0.65,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    surfaceDetailGroup.add(oceanMesh);
    group.oceanMesh = oceanMesh;
    group.oceanBaseXZ = baseXZ;

    const ripples = [];
    const rippleGeo = new THREE.RingGeometry(0.35, 0.58, 32);
    rippleGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const rMesh = new THREE.Mesh(rippleGeo, rMat);
      rMesh.visible = false;
      surfaceDetailGroup.add(rMesh);
      ripples.push({ mesh: rMesh, mat: rMat, active: false, age: 0, maxAge: 1.8, x: 0, z: 0 });
    }
    group.waterRipples = ripples;

    const floatingBuoys = [];
    const buoyCoords = [
      [-18, 42],
      [22, 48],
      [0, 68],
      [-36, 75],
      [38, 72]
    ];
    for (const [bx, bz] of buoyCoords) {
      const buoy = new THREE.Group();
      const floatRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.28, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.4 })
      );
      floatRing.rotation.x = Math.PI / 2;
      buoy.add(floatRing);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, 2.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 })
      );
      mast.position.y = 1.1;
      buoy.add(mast);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      beacon.position.y = 2.3;
      buoy.add(beacon);

      buoy.position.set(bx, radius + sys.waterLevel, bz);
      surfaceDetailGroup.add(buoy);
      floatingBuoys.push({ group: buoy, x: bx, z: bz });
    }
    group.floatingBuoys = floatingBuoys;
  }

  // 7. Starport Landing Pad & Coastal Pier leading into the Ocean
  buildLandingPadOutpost(surfaceDetailGroup, radius, sys, systemIndex);

  return group;
};

export const spawnWaterRipple = (planet, x, z, maxScale = 4.5) => {
  if (!planet || !planet.waterRipples) return;
  const ripples = planet.waterRipples;
  let slot = ripples.find((r) => !r.active);
  if (!slot) slot = ripples[0];

  slot.active = true;
  slot.age = 0;
  slot.maxAge = 1.6;
  slot.maxScale = maxScale;
  slot.x = x;
  slot.z = z;
  slot.mesh.visible = true;
  slot.mesh.scale.set(0.2, 0.2, 0.2);
};

// ============================================================================
// 4. COASTAL STARPORT PAD, WALKWAY PIER TO OCEAN & NASA OUTPOST
// ============================================================================
const buildLandingPadOutpost = (parentGroup, radius, sys, sysIdx) => {
  const outpost = new THREE.Group();
  const padSurfaceY = getSurfaceY(radius, 0, 0, sysIdx);
  outpost.position.set(0, padSurfaceY, 0);

  const metalTex = Textures.metalPlate();

  const baseMat = new THREE.MeshStandardMaterial({
    map: metalTex,
    color: 0x334155,
    metalness: 0.78,
    roughness: 0.34
  });
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 12.2, 0.6, 12), baseMat);
  baseDisc.position.y = 0.05;
  baseDisc.receiveShadow = true;
  outpost.add(baseDisc);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const padRing = new THREE.Mesh(new THREE.RingGeometry(7.2, 7.6, 48), ringMat);
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.37;
  outpost.add(padRing);

  const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const innerRing = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.1, 36), innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.37;
  outpost.add(innerRing);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bx = Math.cos(a) * 9.5;
    const bz = Math.sin(a) * 9.5;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.3, 10), baseMat);
    post.position.set(bx, 0.7, bz);
    outpost.add(post);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x22d3ee : 0xf97316 })
    );
    bulb.position.set(bx, 1.45, bz);
    outpost.add(bulb);
  }

  if (sys.hasWater) {
    const pierGroup = new THREE.Group();
    const deckMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      color: 0x475569,
      metalness: 0.65,
      roughness: 0.4
    });
    const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    for (let s = 0; s < 10; s++) {
      const zPos = 11.5 + s * 2.4;
      const yDrop = -s * 0.25;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 2.3), deckMat);
      plank.position.set(0, yDrop, zPos);
      pierGroup.add(plank);

      for (const side of [-1.5, 1.5]) {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.5, 8), deckMat);
        piling.position.set(side, yDrop - 1.2, zPos);
        pierGroup.add(piling);

        const railLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.2), railMat);
        railLight.position.set(side, yDrop + 0.55, zPos);
        pierGroup.add(railLight);
      }
    }
    outpost.add(pierGroup);
  }

  gltfLoader.load(
    "assets/models/lunar_lander.glb",
    (gltf) => {
      const lander = gltf.scene;
      const box = new THREE.Box3().setFromObject(lander);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = 6.5 / Math.max(size.x, size.y, size.z, 0.001);
      lander.scale.setScalar(s);
      const b2 = new THREE.Box3().setFromObject(lander);
      const c2 = new THREE.Vector3();
      b2.getCenter(c2);
      lander.position.set(
        -19 - c2.x,
        getTerrainOffset(-19, -12, sysIdx) - 2.2 - b2.min.y,
        -12 - c2.z
      );
      outpost.add(lander);
    },
    undefined,
    () => {}
  );

  gltfLoader.load(
    "assets/models/habitat_base.glb",
    (gltf) => {
      const hab = gltf.scene;
      const box = new THREE.Box3().setFromObject(hab);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = 13.0 / Math.max(size.x, size.y, size.z, 0.001);
      hab.scale.setScalar(s);
      const b2 = new THREE.Box3().setFromObject(hab);
      const c2 = new THREE.Vector3();
      b2.getCenter(c2);
      hab.position.set(
        22 - c2.x,
        getTerrainOffset(22, -16, sysIdx) - 2.2 - b2.min.y,
        -16 - c2.z
      );
      outpost.add(hab);
    },
    undefined,
    () => {}
  );

  gltfLoader.load(
    "assets/models/astronaut.glb",
    (gltf) => {
      const astro = gltf.scene;
      const box = new THREE.Box3().setFromObject(astro);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = 2.1 / Math.max(size.x, size.y, size.z, 0.001);
      astro.scale.setScalar(s);
      const b2 = new THREE.Box3().setFromObject(astro);
      const c2 = new THREE.Vector3();
      b2.getCenter(c2);
      astro.position.set(-7.5 - c2.x, 0.35 - b2.min.y, 6.2 - c2.z);
      astro.rotation.y = Math.PI * 0.25;
      outpost.add(astro);
    },
    undefined,
    () => {}
  );

  gltfLoader.load(
    "assets/models/iss.glb",
    (gltf) => {
      const iss = gltf.scene;
      const box = new THREE.Box3().setFromObject(iss);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = 26.0 / Math.max(size.x, size.y, size.z, 0.001);
      iss.scale.setScalar(s);
      iss.position.set(42, 48, -68);
      outpost.add(iss);
      parentGroup.issModel = iss;
    },
    undefined,
    () => {}
  );

  parentGroup.add(outpost);
  parentGroup.outpost = outpost;
};

// ============================================================================
// 5. LAND & AQUATIC FAUNA + JAVASCRIPT OCEAN VERTEX ANIMATION
// ============================================================================
const buildBiomeCreature = (style, colors) => {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colors.body,
    roughness: 0.45,
    metalness: 0.2
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: colors.accent,
    roughness: 0.3,
    metalness: 0.4,
    emissive: colors.accent,
    emissiveIntensity: 0.35
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: colors.eye });
  const legs = [];

  if (style === "swimmer") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), bodyMat);
    body.scale.set(1.3, 0.32, 1.8);
    root.add(body);

    const wingGeo = new THREE.ConeGeometry(0.85, 1.4, 4);
    wingGeo.rotateZ(Math.PI / 2);
    const leftWing = new THREE.Mesh(wingGeo, accentMat);
    leftWing.position.set(-0.65, 0, 0);
    const rightWing = new THREE.Mesh(wingGeo, accentMat);
    rightWing.rotation.z = -Math.PI;
    rightWing.position.set(0.65, 0, 0);
    root.add(leftWing, rightWing);
    legs.push(leftWing, rightWing);
  } else {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 1.05), bodyMat);
    torso.position.y = 0.55;
    root.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.46), bodyMat);
    head.position.set(0, 0.85, 0.55);
    root.add(head);

    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.85), accentMat);
    crest.position.set(0, 0.82, 0);
    root.add(crest);

    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
      eye.position.set(s * 0.16, 0.9, 0.76);
      root.add(eye);
    }

    const legGeo = new THREE.BoxGeometry(0.12, 0.48, 0.12);
    for (const [lx, lz] of [
      [-0.22, 0.35],
      [0.22, 0.35],
      [-0.22, -0.35],
      [0.22, -0.35]
    ]) {
      const leg = new THREE.Mesh(legGeo, accentMat);
      leg.position.set(lx, 0.24, lz);
      root.add(leg);
      legs.push(leg);
    }
  }

  root.userData.legs = legs;
  root.userData.style = style;
  return root;
};

export const spawnAnimals = (planet, count = 38) => {
  const sys = planet.userData.system || SYSTEMS[0];
  const sysIdx = planet.userData.systemIndex || 0;
  const radius = planet.userData.radius || PLANET_RADIUS;
  const targetParent = planet.surfaceDetailGroup || planet;
  const group = new THREE.Group();
  const animals = [];

  for (let i = 0; i < count; i++) {
    const isAquatic = sys.hasWater && i < 12;
    const mesh = buildBiomeCreature(isAquatic ? "swimmer" : sys.animalStyle, sys.animalColors);

    let r = 16 + Math.random() * 140;
    let theta = Math.random() * Math.PI * 2;
    if (isAquatic) {
      r = 28 + Math.random() * 95;
      theta = Math.PI * 0.2 + Math.random() * Math.PI * 0.6;
    }

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const groundY = getSurfaceY(radius, x, z, sysIdx);
    mesh.position.set(x, groundY, z);

    const scale = 0.8 + Math.random() * 0.65;
    mesh.scale.setScalar(scale);
    group.add(mesh);

    animals.push({
      type: isAquatic ? "swimmer" : "procedural",
      mesh,
      r,
      theta,
      speed: (0.04 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1),
      bobOffset: Math.random() * Math.PI * 2
    });
  }

  (sys.gltfAnimals || []).forEach((spec) => {
    gltfLoader.load(
      spec.file,
      (gltf) => {
        for (let k = 0; k < 6; k++) {
          const clone = SkeletonUtils.clone(gltf.scene);
          clone.scale.setScalar(spec.scale);

          let mixer = null;
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(clone);
            const action = mixer.clipAction(gltf.animations[0]);
            action.timeScale = 0.85 + Math.random() * 0.35;
            action.play();
          }

          const r = 18 + Math.random() * 95;
          const theta = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
          const x = Math.cos(theta) * r;
          const z = Math.sin(theta) * r;
          const y = getSurfaceY(radius, x, z, sysIdx) + spec.yOffset;
          clone.position.set(x, y, z);
          group.add(clone);

          animals.push({
            type: "gltf",
            mesh: clone,
            mixer,
            grounded: spec.grounded,
            yOffset: spec.yOffset,
            r,
            theta,
            speed: (0.06 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1),
            bobOffset: Math.random() * Math.PI * 2
          });
        }
      },
      undefined,
      () => {}
    );
  });

  targetParent.add(group);
  planet.animals = animals;
};

export const updateAnimals = (planet, dt, time = 0) => {
  if (!planet) return;
  const radius = planet.userData.radius || PLANET_RADIUS;
  const sysIdx = planet.userData.systemIndex || 0;

  // Slowly rotate the swirling cloud deck & planet globe in JavaScript
  if (planet.cloudMesh) {
    planet.cloudMesh.rotation.y += dt * 0.0085;
  }
  if (planet.cloudShadowMesh) {
    planet.cloudShadowMesh.rotation.y += dt * 0.0085;
  }
  if (planet.planetMesh) {
    planet.planetMesh.rotation.y += dt * 0.0032;
  }
  if (planet.moonPivot) {
    planet.moonPivot.rotation.y += dt * 0.012;
  }
  if (planet.surfaceDetailGroup && planet.surfaceDetailGroup.issModel) {
    planet.surfaceDetailGroup.issModel.rotation.y += dt * 0.08;
  }

  if (planet.surfaceDetailGroup && !planet.surfaceDetailGroup.visible) {
    return;
  }

  // JavaScript-Driven 3D Gerstner Ocean Vertex Animation
  if (planet.oceanMesh && planet.oceanBaseXZ) {
    const posAttr = planet.oceanMesh.geometry.attributes.position;
    const baseXZ = planet.oceanBaseXZ;
    for (let i = 0; i < posAttr.count; i++) {
      const bx = baseXZ[i * 2];
      const bz = baseXZ[i * 2 + 1];
      const wy = getWaterSurfaceWorldY(radius, bx, bz, time, sysIdx);
      posAttr.setY(i, radius + wy);
    }
    posAttr.needsUpdate = true;
  }

  if (planet.waterRipples) {
    for (const r of planet.waterRipples) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const p = r.age / r.maxAge;
      const s = 0.25 + p * (r.maxScale || 4.5);
      r.mesh.scale.set(s, s, s);
      const wy = getWaterSurfaceWorldY(radius, r.x, r.z, time, sysIdx);
      r.mesh.position.set(r.x, radius + wy + 0.06, r.z);
      r.mat.opacity = (1.0 - p) * 0.58;
    }
  }

  if (planet.floatingBuoys) {
    for (const b of planet.floatingBuoys) {
      const wy = getWaterSurfaceWorldY(radius, b.x, b.z, time, sysIdx);
      b.group.position.y = radius + wy;
      b.group.rotation.z = Math.sin(time * 2.2 + b.x) * 0.14;
      b.group.rotation.x = Math.cos(time * 1.9 + b.z) * 0.12;
    }
  }

  if (!planet.animals) return;
  for (const a of planet.animals) {
    a.theta += a.speed * dt;
    const x = Math.cos(a.theta) * a.r;
    const z = Math.sin(a.theta) * a.r;
    const groundY = getSurfaceY(radius, x, z, sysIdx);

    if (a.type === "swimmer") {
      const waterY = radius + getWaterSurfaceWorldY(radius, x, z, time, sysIdx);
      const swimY = Math.max(groundY + 0.4, waterY - 0.35 + Math.sin(time * 2.6 + a.bobOffset) * 0.25);
      a.mesh.position.set(x, swimY, z);
      const legs = a.mesh.userData.legs || [];
      for (let i = 0; i < legs.length; i++) {
        legs[i].rotation.z = (i === 0 ? 1 : -1) * Math.sin(time * 5.5 + a.bobOffset) * 0.38;
      }
    } else if (a.type === "gltf") {
      if (a.mixer) a.mixer.update(dt);
      const flyBob = a.grounded ? 0 : Math.sin(time * 3.0 + a.bobOffset) * 0.65;
      a.mesh.position.set(x, groundY + a.yOffset + flyBob, z);
    } else {
      const walkCycle = time * 8.0 + a.bobOffset;
      const bounce = Math.abs(Math.sin(walkCycle)) * 0.08;
      a.mesh.position.set(x, groundY + bounce, z);
      const legs = a.mesh.userData.legs || [];
      for (let i = 0; i < legs.length; i++) {
        legs[i].rotation.x = Math.sin(walkCycle + (i % 2 === 0 ? 0 : Math.PI)) * 0.45;
      }
    }

    const dirX = -Math.sin(a.theta) * Math.sign(a.speed);
    const dirZ = Math.cos(a.theta) * Math.sign(a.speed);
    a.mesh.rotation.y = Math.atan2(dirX, dirZ);
  }
};

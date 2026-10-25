/**
 * Stellar Voyage — Photorealistic Colossal Planets (R = 1800) & Gerstner Ocean Physics
 * Features:
 * - Full-Screen Orbital Scale (R = 1800, viewed from orbital vantage so every planet
 *   looms as a massive photorealistic globe filling ~88% of the viewport like NASA imagery)
 * - Custom GLSL 4K NASA Planetary Globe Shader (earth_day_4096.jpg, earth_atmos_2048.jpg,
 *   earth_normal_2048.jpg, earth_specular_2048.jpg, earth_clouds_1024.png) with:
 *   - Deep cobalt/sapphire oceans with continental shelf bathymetry & sun specular sheen
 *   - Multi-toned photorealistic continents (rose-terracotta plateaus, olive lowlands, mountain normal relief)
 *   - Swirling white cyclone cloud systems casting real cloud shadows onto the ocean below
 *   - Internal Rayleigh aerial perspective haze + crisp atmospheric limb glow + smooth right-side day/night terminator
 * - Seamless Surface & Ocean Exploration Zone at the Starport Landing Site with:
 *   - 4-Wave Gerstner Ocean Shader, Archimedes Water Buoyancy, Ripples, Floating Buoys & Marine Fauna
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/draco/DRACOLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { makePlanetTextures, Textures } from "./textures.js";

export const PLANET_RADIUS = 1800;

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./vendor/three/examples/jsm/libs/draco/gltf/");
gltfLoader.setDRACOLoader(dracoLoader);

// Load high-resolution 4K NASA planetary textures once and share across systems
const sharedPlanetMaps = (() => {
  const loadTex = (url, srgb = true) => {
    const t = texLoader.load(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  return {
    day4k: loadTex("assets/textures/earth_day_4096.jpg", true),
    atmos2k: loadTex("assets/textures/earth_atmos_2048.jpg", true),
    normal2k: loadTex("assets/textures/earth_normal_2048.jpg", false),
    specular2k: loadTex("assets/textures/earth_specular_2048.jpg", false),
    clouds1k: loadTex("assets/textures/earth_clouds_1024.png", true),
    moon1k: loadTex("assets/textures/moon_1024.jpg", true),
    mars: loadTex("assets/textures/mars.jpg", true),
    europa: loadTex("assets/textures/europa.jpg", true)
  };
})();

export const SYSTEMS = [
  {
    name: "KEPLER-442b",
    biome: "SAPPHIRE OCEAN & ROSE CONTINENTS",
    seed: 1.1,
    hasWater: true,
    waterLevel: -0.35,
    gravity: 1.0,
    atmosPressure: "104 kPa O₂/N₂",
    uvOffset: [0.0, 0.0],
    uvScale: [1.0, 1.0],
    oceanDeep: [0.19, 0.31, 0.69],
    oceanShallow: [0.31, 0.48, 0.82],
    landLow: [0.42, 0.49, 0.45],
    landHigh: [0.68, 0.51, 0.56],
    atmosColor: [0.46, 0.64, 0.98],
    cloudOpacity: 0.88,
    waterDeepHex: 0x0369a1,
    waterShallowHex: 0x06b6d4,
    palette: {
      c1: [14, 116, 144],
      c2: [16, 185, 129],
      c3: [6, 95, 70],
      c4: [217, 119, 6]
    },
    atmosHex: 0x5b8def,
    horizonHex: 0x8bb4f8,
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
    biome: "CRIMSON SUPER-CONTINENTS & BASALT SEAS",
    seed: 2.7,
    hasWater: true,
    waterLevel: -0.45,
    gravity: 1.18,
    atmosPressure: "132 kPa CO₂/Ar",
    uvOffset: [0.37, 0.14],
    uvScale: [1.15, 1.05],
    oceanDeep: [0.14, 0.22, 0.52],
    oceanShallow: [0.25, 0.39, 0.68],
    landLow: [0.62, 0.36, 0.28],
    landHigh: [0.82, 0.52, 0.38],
    atmosColor: [0.58, 0.62, 0.94],
    cloudOpacity: 0.78,
    waterDeepHex: 0x1e1b4b,
    waterShallowHex: 0x4338ca,
    palette: {
      c1: [127, 29, 29],
      c2: [185, 28, 28],
      c3: [234, 88, 12],
      c4: [68, 64, 60]
    },
    atmosHex: 0x7c83ec,
    horizonHex: 0xfda4af,
    ringHex: 0xfb923c,
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
    uvOffset: [0.64, -0.18],
    uvScale: [1.2, 1.1],
    oceanDeep: [0.13, 0.35, 0.72],
    oceanShallow: [0.24, 0.58, 0.86],
    landLow: [0.28, 0.54, 0.44],
    landHigh: [0.64, 0.56, 0.48],
    atmosColor: [0.42, 0.7, 0.98],
    cloudOpacity: 0.9,
    waterDeepHex: 0x0c4a6e,
    waterShallowHex: 0x0284c7,
    palette: {
      c1: [30, 58, 138],
      c2: [56, 189, 248],
      c3: [125, 211, 252],
      c4: [224, 242, 254]
    },
    atmosHex: 0x38bdf8,
    horizonHex: 0xbae6fd,
    ringHex: 0x7dd3fc,
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
    uvOffset: [0.22, 0.42],
    uvScale: [0.95, 1.05],
    oceanDeep: [0.18, 0.27, 0.68],
    oceanShallow: [0.34, 0.46, 0.85],
    landLow: [0.48, 0.44, 0.58],
    landHigh: [0.74, 0.54, 0.62],
    atmosColor: [0.52, 0.62, 0.99],
    cloudOpacity: 0.86,
    waterDeepHex: 0x1e3a8a,
    waterShallowHex: 0x0ea5e9,
    palette: {
      c1: [59, 7, 100],
      c2: [126, 34, 206],
      c3: [16, 185, 129],
      c4: [244, 114, 182]
    },
    atmosHex: 0x6b8afd,
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
    uvOffset: [0.51, -0.33],
    uvScale: [1.1, 0.95],
    oceanDeep: [0.16, 0.3, 0.66],
    oceanShallow: [0.32, 0.56, 0.86],
    landLow: [0.58, 0.66, 0.75],
    landHigh: [0.85, 0.88, 0.94],
    atmosColor: [0.48, 0.68, 0.99],
    cloudOpacity: 0.92,
    waterDeepHex: 0x0f172a,
    waterShallowHex: 0x0284c7,
    palette: {
      c1: [69, 26, 3],
      c2: [180, 83, 9],
      c3: [245, 158, 11],
      c4: [253, 224, 71]
    },
    atmosHex: 0x60a5fa,
    horizonHex: 0xfef08a,
    ringHex: 0x93c5fd,
    animalStyle: "beetle",
    gltfAnimals: [
      { file: "assets/models/stork.glb", scale: 0.022, yOffset: 2.8, grounded: false },
      { file: "assets/models/fox.glb", scale: 0.025, yOffset: 0, grounded: true }
    ],
    animalColors: { body: 0x78350f, accent: 0xfbbf24, eye: 0x38bdf8 }
  }
];

// ============================================================================
// 1. PHOTOREALISTIC 4K NASA + GLSL PLANETARY GLOBE SHADER
// ============================================================================
const createPlanetGlobeMaterial = (sys) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayTex: { value: sharedPlanetMaps.day4k },
      uAtmosTex: { value: sharedPlanetMaps.atmos2k },
      uNormalTex: { value: sharedPlanetMaps.normal2k },
      uSpecTex: { value: sharedPlanetMaps.specular2k },
      uCloudTex: { value: sharedPlanetMaps.clouds1k },
      uSunDir: { value: new THREE.Vector3(-0.52, 0.34, 0.78).normalize() },
      uTime: { value: 0 },
      uUvOffset: { value: new THREE.Vector2(sys.uvOffset[0], sys.uvOffset[1]) },
      uUvScale: { value: new THREE.Vector2(sys.uvScale[0], sys.uvScale[1]) },
      uOceanDeep: { value: new THREE.Color(...sys.oceanDeep) },
      uOceanShallow: { value: new THREE.Color(...sys.oceanShallow) },
      uLandLow: { value: new THREE.Color(...sys.landLow) },
      uLandHigh: { value: new THREE.Color(...sys.landHigh) },
      uAtmosColor: { value: new THREE.Color(...sys.atmosColor) },
      uCloudOpacity: { value: sys.cloudOpacity }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewPos;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPos = viewMatrix * worldPos;
        vViewPos = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uDayTex;
      uniform sampler2D uAtmosTex;
      uniform sampler2D uNormalTex;
      uniform sampler2D uSpecTex;
      uniform sampler2D uCloudTex;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform vec2 uUvOffset;
      uniform vec2 uUvScale;
      uniform vec3 uOceanDeep;
      uniform vec3 uOceanShallow;
      uniform vec3 uLandLow;
      uniform vec3 uLandHigh;
      uniform vec3 uAtmosColor;
      uniform float uCloudOpacity;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewPos;

      // Fast procedural hash & FBM for bathymetry and fine cloud swirls
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.07;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Planet-specific UV transform so each world has distinct continent shapes
        vec2 pUv = vUv * uUvScale + uUvOffset;

        vec3 daySample = texture2D(uDayTex, pUv).rgb;
        vec3 atmosSample = texture2D(uAtmosTex, pUv).rgb;
        vec3 normSample = texture2D(uNormalTex, pUv).rgb * 2.0 - 1.0;
        float specMask = texture2D(uSpecTex, pUv).r;

        // Perturb normal slightly with continental mountain normal map
        vec3 bumpN = normalize(N + vec3(normSample.x, normSample.y, 0.0) * 0.22);

        // Bathymetry & continental shelf variation in oceans
        float bathy = fbm(pUv * 18.0);
        float shelf = smoothstep(0.18, 0.65, (1.0 - specMask) * 0.6 + bathy * 0.55);
        vec3 oceanCol = mix(uOceanDeep, uOceanShallow, shelf);
        // Blend subtle real satellite ocean structure
        oceanCol = mix(oceanCol, atmosSample * vec3(0.75, 0.88, 1.25), 0.25);

        // Photorealistic Continental Color Grading (rose/terracotta plateaus + sage lowlands)
        float landElev = clamp(dot(daySample, vec3(0.38, 0.42, 0.2)) * 1.45, 0.0, 1.0);
        float desertMask = smoothstep(0.28, 0.72, daySample.r - daySample.b * 0.45 + bathy * 0.25);
        vec3 landCol = mix(uLandLow, uLandHigh, desertMask);
        landCol = mix(landCol, daySample * 1.15, 0.42);
        // Coastal shallow turquoise reef transition
        float coastLine = smoothstep(0.35, 0.65, specMask);
        vec3 surfaceAlbedo = mix(landCol, oceanCol, coastLine);

        // Swirling Cloud Layer (dual-sampled NASA cloud cyclone map + drift)
        vec2 cloudUv1 = pUv + vec2(uTime * 0.0018, 0.0);
        vec2 cloudUv2 = pUv * 1.65 - vec2(uTime * 0.0011, uTime * 0.0005);
        float c1 = texture2D(uCloudTex, cloudUv1).r;
        float c2 = texture2D(uCloudTex, cloudUv2).r;
        float cloudDetail = fbm(cloudUv1 * 24.0);
        float cloudAlpha = clamp((c1 * 0.82 + c2 * 0.34 * cloudDetail) * uCloudOpacity, 0.0, 0.96);

        // Cloud shadow cast slightly offset onto ocean/continents below
        vec2 shadowUv = cloudUv1 - vec2(0.0035, -0.0025);
        float cShadow = texture2D(uCloudTex, shadowUv).r;
        surfaceAlbedo *= (1.0 - cShadow * 0.32);

        // Smooth Day/Night Terminator Lighting (matches NASA orbital photography)
        float nDotL = dot(bumpN, L);
        float smoothLight = smoothstep(-0.16, 0.28, nDotL);
        float diffuse = clamp((nDotL + 0.12) / 1.12, 0.0, 1.0) * smoothLight;

        // Subtle warm twilight band right along the terminator
        float terminatorBand = smoothstep(-0.18, 0.02, nDotL) * (1.0 - smoothstep(0.02, 0.26, nDotL));
        vec3 twilightTint = vec3(0.75, 0.42, 0.36) * terminatorBand * 0.18;

        // Soft broad ocean sun specular sheen (like atmospheric scatter on ocean waves)
        vec3 H = normalize(L + V);
        float spec = pow(max(0.0, dot(bumpN, H)), 28.0) * coastLine * (1.0 - cloudAlpha * 0.85);
        vec3 specCol = mix(uAtmosColor, vec3(0.88, 0.94, 1.0), 0.6) * spec * 0.26 * smoothLight;

        // Combine sunlit surface + clouds
        vec3 litSurface = surfaceAlbedo * (0.015 + diffuse * 0.985) + specCol + twilightTint;
        float cloudLight = smoothstep(-0.14, 0.25, dot(N, L)) * (0.18 + 0.82 * clamp(dot(N, L) + 0.15, 0.0, 1.0));
        vec3 cloudCol = mix(uAtmosColor * 0.82, vec3(0.98, 0.99, 1.0), 0.86) * cloudLight;
        vec3 composite = mix(litSurface, cloudCol, cloudAlpha);

        // Internal Rayleigh Aerial Perspective (gives the whole globe that iconic blue atmospheric veil!)
        float viewAngle = 1.0 - max(0.0, dot(N, V));
        float rayleighHaze = pow(viewAngle, 1.75) * 0.62 + 0.08;
        float sunSideAtmos = smoothstep(-0.22, 0.28, dot(N, L));
        composite = mix(composite, uAtmosColor * (0.42 + 0.58 * sunSideAtmos), rayleighHaze * sunSideAtmos);

        // Crisp limb brightening at the very edge of the sunlit hemisphere
        float rim = pow(viewAngle, 4.2) * smoothstep(-0.15, 0.35, dot(N, L));
        composite += uAtmosColor * rim * 0.45;

        gl_FragColor = vec4(composite, 1.0);
      }
    `
  });
};

// ============================================================================
// 2. SCULPTED 3D TERRAIN & ARCHIMEDES GERSTNER OCEAN FOR SURFACE EXPLORATION
// ============================================================================
export const getTerrainOffset = (x, z, sysIdx = 0) => {
  const sys = SYSTEMS[sysIdx % SYSTEMS.length];
  const distFromPad = Math.hypot(x, z);

  // Coastal Starport Plateau around (0, 0) (radius 0..24m sits at +2.2m)
  const padFlat = Math.min(1.0, Math.max(0.0, (distFromPad - 22.0) / 18.0));
  const smoothPad = padFlat * padFlat * (3.0 - 2.0 * padFlat);

  // South (+Z > 22m) slopes down into the sparkling Ocean Bay!
  const bayFactor = Math.max(0.0, Math.min(1.0, (z - 16.0) / 55.0));
  const bayDepth = -6.8 * bayFactor * Math.sin(Math.min(Math.PI * 0.5, bayFactor * 1.4));

  // North (-Z < -26m) rises into dramatic Mountain Peaks & Ridges
  const northFactor = Math.max(0.0, Math.min(1.0, (-z - 26.0) / 85.0));
  const mtnWaves =
    Math.sin(x * 0.028 + sys.seed) * Math.cos(z * 0.028 - sys.seed) * 16.0 +
    Math.sin(x * 0.065 - z * 0.045) * 7.5 +
    Math.cos(x * 0.14 + z * 0.12) * 2.4;
  const mountainHeight = northFactor * (10.0 + Math.max(0.0, mtnWaves));

  // General continental rolling hills & island archipelagos in the ocean bay
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

const createOceanShaderMaterial = (sys) => {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: PLANET_RADIUS },
      uWaterLevel: { value: sys.waterLevel },
      uDeepColor: { value: new THREE.Color(sys.waterDeepHex) },
      uShallowColor: { value: new THREE.Color(sys.waterShallowHex) },
      uSkyColor: { value: new THREE.Color(sys.horizonHex) },
      uSunDir: { value: new THREE.Vector3(-0.52, 0.34, 0.78).normalize() }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uRadius;
      uniform float uWaterLevel;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveHeight;

      void main() {
        vec3 pos = position;
        float x = pos.x;
        float z = pos.z;

        float distSq = x * x + z * z;
        float sphereDrop = uRadius - sqrt(max(1.0, uRadius * uRadius - distSq));

        float p1 = x * 0.14 + z * 0.06 + uTime * 2.1;
        float p2 = x * 0.08 - z * 0.16 + uTime * 1.65;
        float p3 = (x + z) * 0.25 - uTime * 2.8;
        float p4 = x * 0.38 - z * 0.31 + uTime * 3.4;

        float w1 = sin(p1) * 0.28;
        float w2 = cos(p2) * 0.22;
        float w3 = sin(p3) * 0.11;
        float w4 = cos(p4) * 0.06;

        pos.x -= cos(p1) * 0.14 + sin(p2) * 0.08;
        pos.z -= cos(p1) * 0.06 - sin(p2) * 0.14;

        float waveH = w1 + w2 + w3 + w4;
        pos.y = uWaterLevel - sphereDrop + waveH;
        vWaveHeight = waveH;

        float dHx = cos(p1) * 0.14 * 0.28 - sin(p2) * 0.08 * 0.22 + cos(p3) * 0.25 * 0.11 - sin(p4) * 0.38 * 0.06;
        float dHz = cos(p1) * 0.06 * 0.28 + sin(p2) * 0.16 * 0.22 + cos(p3) * 0.25 * 0.11 + sin(p4) * 0.31 * 0.06;
        vec3 localNormal = normalize(vec3(-dHx, 1.0, -dHz));

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPosition.xyz;
        vNormal = normalize(mat3(modelMatrix) * localNormal);

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSkyColor;
      uniform vec3 uSunDir;
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveHeight;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.2);
        float crest = clamp((vWaveHeight + 0.35) * 1.15, 0.0, 1.0);
        vec3 waterCol = mix(uDeepColor, uShallowColor, crest * 0.72 + 0.18);
        waterCol = mix(waterCol, uSkyColor, fresnel * 0.58);

        vec3 H = normalize(L + V);
        float spec = pow(max(0.0, dot(N, H)), 96.0);
        float shimmer = sin(vWorldPos.x * 1.9 + uTime * 4.2) * cos(vWorldPos.z * 1.9 - uTime * 3.7);
        float foam = smoothstep(0.26, 0.54, vWaveHeight + shimmer * 0.08);
        waterCol = mix(waterCol, vec3(0.92, 0.98, 1.0), foam * 0.52);
        waterCol += vec3(1.0, 0.97, 0.9) * spec * 1.35;

        gl_FragColor = vec4(waterCol, 0.84);
      }
    `
  });
};

// ============================================================================
// 3. BUILD COLOSSAL PLANET + ATMOSPHERE + ORBITING MOON + SURFACE/OCEAN ZONE
// ============================================================================
export const buildPlanet = (radius = PLANET_RADIUS, systemIndex = 0) => {
  const sys = SYSTEMS[systemIndex % SYSTEMS.length];
  const group = new THREE.Group();
  group.userData.system = sys;
  group.userData.systemIndex = systemIndex;
  group.userData.radius = radius;

  // 1. Primary Colossal Spherical Globe (R = 1800) with 4K NASA + GLSL Shader
  const geo = new THREE.SphereGeometry(radius, 128, 128);
  const globeMat = createPlanetGlobeMaterial(sys);
  const planetMesh = new THREE.Mesh(geo, globeMat);
  planetMesh.receiveShadow = true;
  group.add(planetMesh);
  group.globeMat = globeMat;

  // 2. Crisp Rayleigh Atmospheric Limb Halo (hugs the globe edge tightly like NASA photos)
  const outerAtmosGeo = new THREE.SphereGeometry(radius * 1.022, 96, 96);
  const outerAtmosMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(...sys.atmosColor) },
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
        gl_FragColor = vec4(col, rim * 0.78 * (0.2 + 0.8 * daySide));
      }
    `
  });
  const outerAtmos = new THREE.Mesh(outerAtmosGeo, outerAtmosMat);
  group.add(outerAtmos);
  group.outerAtmosMat = outerAtmosMat;

  // 3. Orbiting 3D Moon in Deep Space (with real NASA moon_1024.jpg texture)
  const moonPivot = new THREE.Group();
  const moonGeo = new THREE.SphereGeometry(95, 48, 48);
  const moonMat = new THREE.MeshStandardMaterial({
    map: sharedPlanetMaps.moon1k,
    roughness: 0.92,
    metalness: 0.05
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(-2850, 950, -1400);
  moonPivot.add(moonMesh);
  group.add(moonPivot);
  group.moonPivot = moonPivot;

  // 4. Surface & Ocean Exploration Detail Group at the North Pole Landing Zone (0, +R, 0)
  // Automatically shown when descending/landed/exploring on foot, and hidden in deep orbit
  // so the planet silhouette in space is a 100% pure, flawless sphere!
  const surfaceDetailGroup = new THREE.Group();
  group.add(surfaceDetailGroup);
  group.surfaceDetailGroup = surfaceDetailGroup;

  const pTex = makePlanetTextures(sys.seed, sys.palette);
  const capSize = 950;
  const capSegs = 150;
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

  // 5. Real Animated 4-Wave Gerstner Ocean Mesh + Ripples + Floating Buoys
  if (sys.hasWater) {
    const oceanGeo = new THREE.PlaneGeometry(capSize, capSize, 140, 140);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = createOceanShaderMaterial(sys);
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = radius;
    surfaceDetailGroup.add(oceanMesh);
    group.oceanMesh = oceanMesh;
    group.oceanMat = oceanMat;

    // Expanding 3D Water Ripple Rings Pool
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

    // Floating Hydro-Research Buoys bobbing on the ocean waves
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

  // 6. Starport Landing Pad & Coastal Pier leading into the Ocean
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

  // Coastal Walkway Pier leading South (+Z = 11m to +Z = 34m) into the Ocean Bay
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

  // Real Online 3D Outpost Models
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
// 5. LAND & AQUATIC FAUNA
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

  if (planet.globeMat) {
    planet.globeMat.uniforms.uTime.value = time;
  }
  if (planet.oceanMat) {
    planet.oceanMat.uniforms.uTime.value = time;
  }
  if (planet.moonPivot) {
    planet.moonPivot.rotation.y += dt * 0.012;
  }
  if (planet.surfaceDetailGroup && planet.surfaceDetailGroup.issModel) {
    planet.surfaceDetailGroup.issModel.rotation.y += dt * 0.08;
  }

  // Only update local surface ripples, buoys & animals when surfaceDetailGroup is visible
  if (planet.surfaceDetailGroup && !planet.surfaceDetailGroup.visible) {
    return;
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

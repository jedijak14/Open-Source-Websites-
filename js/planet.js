/**
 * Stellar Voyage — Colossal World (R = 1800), Multi-Octave 3D Terrain,
 * Gerstner Wave Ocean Shader & Water Physics, Physical Rayleigh/Mie Atmosphere,
 * Volumetric Cloud Deck, Orbiting Moon, NASA Outpost & Land/Marine Fauna
 */

import * as THREE from "three";
import { makePlanetTextures } from "./textures.js";
import { sharedGLTFLoader, sharedTexLoader } from "./ship.js";

export const PLANET_RADIUS = 1800;

let activeSystemIndex = 0;

export const SYSTEMS = [
  {
    name: "KEPLER-442b",
    biome: "ARCHIPELAGO OCEAN WORLD",
    textureUrl: "./assets/textures/earth.jpg",
    tintHex: 0xa7f3d0,
    base: [0.14, 0.42, 0.32],
    accent: [0.28, 0.64, 0.48],
    atmosHex: 0x38bdf8,
    horizonHex: 0x7dd3fc,
    sunsetHex: 0xf97316,
    cloudColor: 0xf0f9ff,
    ringHex: null,
    hasWater: true,
    waterDeepHex: 0x0369a1,
    waterShallowHex: 0x06b6d4,
    waterFoamHex: 0xe0f2fe,
    waveAmp: 1.0,
    gravity: 1.0,
    atmosPressure: "104 kPa O₂/N₂",
    faunaColors: [0x34d399, 0xfbbf24, 0xa78bfa, 0x38bdf8]
  },
  {
    name: "POSEIDON-9",
    biome: "PELAGIC SUPER-OCEAN & ATOLLS",
    textureUrl: "./assets/textures/neptune.jpg",
    tintHex: 0x67e8f9,
    base: [0.12, 0.34, 0.52],
    accent: [0.22, 0.68, 0.78],
    atmosHex: 0x0ea5e9,
    horizonHex: 0x67e8f9,
    sunsetHex: 0xf43f5e,
    cloudColor: 0xe0f2fe,
    ringHex: 0x38bdf8,
    hasWater: true,
    waterDeepHex: 0x0c4a6e,
    waterShallowHex: 0x22d3ee,
    waterFoamHex: 0xf0f9ff,
    waveAmp: 1.35,
    gravity: 0.92,
    atmosPressure: "138 kPa H₂O/N₂",
    faunaColors: [0x22d3ee, 0xfde047, 0x34d399, 0xc084fc]
  },
  {
    name: "LYRA-9 PRIME",
    biome: "CRIMSON CANYON & OASIS SEAS",
    textureUrl: "./assets/textures/mars.jpg",
    tintHex: 0xfdba74,
    base: [0.48, 0.22, 0.14],
    accent: [0.72, 0.36, 0.18],
    atmosHex: 0xf97316,
    horizonHex: 0xfdba74,
    sunsetHex: 0xef4444,
    cloudColor: 0xffedd5,
    ringHex: 0xfdba74,
    hasWater: true,
    waterDeepHex: 0x0f766e,
    waterShallowHex: 0x2dd4bf,
    waterFoamHex: 0xccfbf1,
    waveAmp: 0.75,
    gravity: 0.78,
    atmosPressure: "82 kPa CO₂/Ar",
    faunaColors: [0xfca5a5, 0xfde047, 0x22d3ee, 0xc084fc]
  },
  {
    name: "SOLARIS-V",
    biome: "GOLDEN SULFUR SAVANNA & LAGOONS",
    textureUrl: "./assets/textures/jupiter.jpg",
    tintHex: 0xfef08a,
    base: [0.46, 0.38, 0.14],
    accent: [0.68, 0.58, 0.22],
    atmosHex: 0xfacc15,
    horizonHex: 0xfef08a,
    sunsetHex: 0xf59e0b,
    cloudColor: 0xfef9c3,
    ringHex: null,
    hasWater: true,
    waterDeepHex: 0x0e7490,
    waterShallowHex: 0x38bdf8,
    waterFoamHex: 0xfef9c3,
    waveAmp: 0.85,
    gravity: 1.12,
    atmosPressure: "118 kPa N₂/SO₂",
    faunaColors: [0xa3e635, 0xf472b6, 0x38bdf8, 0xfbbf24]
  },
  {
    name: "CYGNUS-X3",
    biome: "BIOLUMINESCENT CRYO-OCEAN SPIRES",
    textureUrl: "./assets/textures/europa.jpg",
    tintHex: 0xe9d5ff,
    base: [0.22, 0.16, 0.32],
    accent: [0.45, 0.24, 0.62],
    atmosHex: 0xc084fc,
    horizonHex: 0xe9d5ff,
    sunsetHex: 0xf43f5e,
    cloudColor: 0xf3e8ff,
    ringHex: 0xe879f9,
    hasWater: true,
    waterDeepHex: 0x311068,
    waterShallowHex: 0xa855f7,
    waterFoamHex: 0xf3e8ff,
    waveAmp: 1.15,
    gravity: 0.68,
    atmosPressure: "94 kPa Ar/O₂",
    faunaColors: [0xf43f5e, 0x2dd4bf, 0xc084fc, 0xfacc15]
  }
];

// ============================================================================
// CONTINUOUS 3D TERRAIN HEIGHT & OCEAN BATHYMETRY FUNCTION
// ============================================================================
export const getTerrainOffset = (x, z, sysIdx = activeSystemIndex) => {
  const dist = Math.hypot(x, z);

  // 1. Starport Landing Pad Plateau (dist <= 13m): flat +2.2m coastal overlook
  if (dist <= 11.5) {
    return 2.2;
  }

  // Smooth transition blend from plateau edge (11.5m to 22m)
  const plateauBlend = THREE.MathUtils.clamp((dist - 11.5) / 10.5, 0.0, 1.0);
  const smoothBlend = plateauBlend * plateauBlend * (3.0 - 2.0 * plateauBlend);

  const seed = (sysIdx + 1) * 1.37;

  // Multi-octave procedural continents, ocean basins, beaches, and mountain ridges
  const macroContinent =
    Math.sin(x * 0.011 + seed) * Math.cos(z * 0.011 - seed * 0.7) * 9.5 +
    Math.sin((x + z) * 0.0065 + seed) * 7.0;

  // Carve a sweeping Ocean Bay & Beach starting right in front of the boarding ramp (z > 15m)!
  const bayAngle = Math.atan2(x, z); // 0 is +Z ( directly off the aft boarding ramp!)
  const inFrontBay = Math.exp(-Math.pow(bayAngle * 1.15, 2)) * Math.exp(-Math.pow((dist - 68) / 58, 2));
  const oceanBayCarve = -inFrontBay * 11.5;

  // Mid-scale rolling hills & coastal dunes
  const hills =
    Math.sin(x * 0.038 + 1.2) * Math.cos(z * 0.034 + 0.8) * 3.2 +
    Math.sin(x * 0.085 - z * 0.072) * 1.25;

  // High-elevation mountain peaks further out (dist > 95m)
  const mountainRing = THREE.MathUtils.clamp((dist - 95.0) / 120.0, 0.0, 1.0);
  const mountains =
    mountainRing *
    Math.pow(Math.max(0, Math.sin(x * 0.022 + seed) * Math.cos(z * 0.022 - seed)), 1.6) *
    34.0;

  // Poseidon-9 is a deeper super-ocean world with coral atolls
  const superOceanBias = sysIdx % SYSTEMS.length === 1 ? -2.6 : -0.6;

  const naturalHeight = macroContinent + oceanBayCarve + hills + mountains + superOceanBias;
  return THREE.MathUtils.lerp(2.2, naturalHeight, smoothBlend);
};

export const getSurfaceY = (radius = PLANET_RADIUS, x = 0, z = 0, sysIdx = activeSystemIndex) => {
  const r2 = radius * radius;
  const d2 = x * x + z * z;
  const sphereY = d2 >= r2 * 0.95 ? radius * 0.2 : Math.sqrt(r2 - d2);
  return sphereY + getTerrainOffset(x, z, sysIdx);
};

// ============================================================================
// REAL-TIME 4-WAVE GERSTNER OCEAN SURFACE HEIGHT (CPU <-> GPU SYNCHRONIZED)
// ============================================================================
export const getWaterSurfaceWorldY = (
  radius = PLANET_RADIUS,
  x = 0,
  z = 0,
  time = performance.now() * 0.001,
  sysIdx = activeSystemIndex
) => {
  const sys = SYSTEMS[sysIdx % SYSTEMS.length];
  if (!sys.hasWater) return -99999;

  const r2 = radius * radius;
  const d2 = x * x + z * z;
  const sphereBaseY = d2 >= r2 * 0.95 ? radius * 0.2 : Math.sqrt(r2 - d2);
  const amp = sys.waveAmp || 1.0;

  // 4-Wave Gerstner Ocean Swell matching the GPU vertex shader
  const w1 = Math.sin(x * 0.18 + z * 0.12 + time * 1.65) * 0.38 * amp;
  const w2 = Math.cos(x * 0.11 - z * 0.22 + time * 1.25) * 0.24 * amp;
  const w3 = Math.sin((x + z) * 0.34 - time * 2.3) * 0.12 * amp;
  const w4 = Math.cos(x * 0.55 + z * 0.48 + time * 3.1) * 0.06 * amp;

  return sphereBaseY - radius + (w1 + w2 + w3 + w4);
};

function createOceanShaderMaterial(sys, radius) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: radius },
      uWaveAmp: { value: sys.waveAmp || 1.0 },
      uDeepColor: { value: new THREE.Color(sys.waterDeepHex || 0x0369a1) },
      uShallowColor: { value: new THREE.Color(sys.waterShallowHex || 0x06b6d4) },
      uFoamColor: { value: new THREE.Color(sys.waterFoamHex || 0xe0f2fe) },
      uSunDir: { value: new THREE.Vector3(0.55, 0.72, 0.42).normalize() }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uWaveAmp;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveHeight;

      void main() {
        vec3 pos = position;
        float x = pos.x;
        float z = pos.z;

        // 4-Wave Gerstner Swell + Cross-Chop
        float w1 = sin(x * 0.18 + z * 0.12 + uTime * 1.65) * 0.38 * uWaveAmp;
        float w2 = cos(x * 0.11 - z * 0.22 + uTime * 1.25) * 0.24 * uWaveAmp;
        float w3 = sin((x + z) * 0.34 - uTime * 2.3) * 0.12 * uWaveAmp;
        float w4 = cos(x * 0.55 + z * 0.48 + uTime * 3.1) * 0.06 * uWaveAmp;
        float h = w1 + w2 + w3 + w4;

        // Horizontal Gerstner orbital trochoid pinch
        pos.x -= cos(x * 0.18 + z * 0.12 + uTime * 1.65) * 0.18 * uWaveAmp;
        pos.z -= sin(x * 0.11 - z * 0.22 + uTime * 1.25) * 0.18 * uWaveAmp;
        pos.y += h;

        // Analytic wave normal for crisp sun specular glints
        float dHx =
          0.18 * cos(x * 0.18 + z * 0.12 + uTime * 1.65) * 0.38 * uWaveAmp -
          0.11 * sin(x * 0.11 - z * 0.22 + uTime * 1.25) * 0.24 * uWaveAmp +
          0.34 * cos((x + z) * 0.34 - uTime * 2.3) * 0.12 * uWaveAmp;
        float dHz =
          0.12 * cos(x * 0.18 + z * 0.12 + uTime * 1.65) * 0.38 * uWaveAmp +
          0.22 * sin(x * 0.11 - z * 0.22 + uTime * 1.25) * 0.24 * uWaveAmp +
          0.34 * cos((x + z) * 0.34 - uTime * 2.3) * 0.12 * uWaveAmp;

        vec3 localNormal = normalize(vec3(-dHx, 1.0, -dHz));
        vNormal = normalize(mat3(modelMatrix) * localNormal);

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPosition.xyz;
        vWaveHeight = h;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveHeight;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);

        // Fresnel sky reflection & shallow-to-deep subsurface scatter
        float fresnel = pow(clamp(1.0 - max(0.0, dot(viewDir, n)), 0.0, 1.0), 2.8);
        float crestFactor = smoothstep(-0.25, 0.55, vWaveHeight);

        vec3 waterCol = mix(uDeepColor, uShallowColor, crestFactor * 0.72 + fresnel * 0.45);

        // Animated cellular foam lace on wave crests
        float foamPattern = sin(vWorldPos.x * 1.4 + uTime * 2.1) * cos(vWorldPos.z * 1.4 - uTime * 1.8);
        float foamMask = smoothstep(0.32, 0.68, vWaveHeight + foamPattern * 0.18);
        waterCol = mix(waterCol, uFoamColor, foamMask * 0.55);

        // Sun specular glint
        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(0.0, dot(n, halfVec)), 96.0);
        vec3 finalCol = waterCol + vec3(1.0, 0.97, 0.88) * spec * 1.35 + uFoamColor * fresnel * 0.28;

        gl_FragColor = vec4(finalCol, 0.86);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true
  });
}

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

  for (let i = 0; i < 250; i++) {
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
  tex.repeat.set(3, 2);
  return tex;
}

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

        float sunDot = dot(n, uSunDir);
        float dayFactor = smoothstep(-0.35, 0.55, sunDot);
        float twilight = smoothstep(-0.4, 0.1, sunDot) * (1.0 - smoothstep(0.05, 0.55, sunDot));

        float ndotv = abs(dot(n, viewDir));
        float fresnel = pow(clamp(1.0 - ndotv, 0.0, 1.0), uOuter > 0.5 ? 2.4 : 1.75);

        vec3 baseAtmos = mix(uDayColor, uHorizonColor, fresnel * 0.75);
        vec3 finalColor = mix(baseAtmos, uSunsetColor, twilight * 0.68);

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
  activeSystemIndex = systemIndex % SYSTEMS.length;
  const sys = SYSTEMS[activeSystemIndex];
  const planet = new THREE.Group();
  planet.name = "planet";
  planet.radius = radius;
  planet.systemIndex = activeSystemIndex;
  planet.systemInfo = sys;

  const pTex = makePlanetTextures(systemIndex + 1, sys.base, sys.accent);

  // ==========================================================================
  // 1. COLOSSAL MAIN PLANETARY SPHERE + 3D SCULPTED CONTINENTAL TERRAIN CAP
  // ==========================================================================
  const surfaceMat = new THREE.MeshStandardMaterial({
    map: pTex.color,
    normalMap: pTex.normal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: pTex.rough,
    roughness: 0.74,
    metalness: 0.08
  });

  if (sys.textureUrl) {
    sharedTexLoader.load(
      sys.textureUrl,
      (nasaTex) => {
        nasaTex.colorSpace = THREE.SRGBColorSpace;
        nasaTex.wrapS = THREE.RepeatWrapping;
        nasaTex.wrapT = THREE.RepeatWrapping;
        nasaTex.repeat.set(4, 2);
        surfaceMat.map = nasaTex;
        surfaceMat.color.setHex(sys.tintHex || 0xffffff);
        surfaceMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );
  }

  // Global Planetary Sphere (slightly recessed by -4m so the sculpted 3D terrain cap & ocean basins sit cleanly)
  const globalSphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius - 4.0, 96, 96),
    surfaceMat
  );
  globalSphere.receiveShadow = true;
  planet.add(globalSphere);

  // High-Resolution 1,000m x 1,000m Sculpted 3D Polar Continent & Ocean Basin Mesh
  const terrainSize = 1000;
  const terrainSegs = 180;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
  terrainGeo.rotateX(-Math.PI / 2);

  const tPos = terrainGeo.attributes.position;
  const tColors = new Float32Array(tPos.count * 3);
  const sandColor = new THREE.Color(0xd6c394);
  const grassColor = new THREE.Color(sys.tintHex || 0x86efac);
  const rockColor = new THREE.Color(sys.base[0], sys.base[1], sys.base[2]);
  const snowColor = new THREE.Color(0xf1f5f9);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const vx = tPos.getX(i);
    const vz = tPos.getZ(i);
    const vy = getSurfaceY(radius, vx, vz, activeSystemIndex);
    tPos.setY(i, vy);

    const hOffset = getTerrainOffset(vx, vz, activeSystemIndex);
    if (hOffset < 0.9) {
      // Sandy beach & ocean seabed
      tmpCol.copy(sandColor).multiplyScalar(hOffset < 0 ? 0.72 : 1.0);
    } else if (hOffset < 9.5) {
      tmpCol.copy(grassColor);
    } else if (hOffset < 22.0) {
      tmpCol.copy(rockColor);
    } else {
      tmpCol.copy(snowColor);
    }
    tColors[i * 3] = tmpCol.r;
    tColors[i * 3 + 1] = tmpCol.g;
    tColors[i * 3 + 2] = tmpCol.b;
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(tColors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: pTex.color,
    normalMap: pTex.normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: pTex.rough,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.08
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  planet.add(terrainMesh);

  // ==========================================================================
  // 2. REAL ANIMATED 3D GERSTNER WAVE OCEAN & WATER PHYSICS LAYER
  // ==========================================================================
  if (sys.hasWater) {
    const oceanSize = 980;
    const oceanSegs = 160;
    const oceanGeo = new THREE.PlaneGeometry(oceanSize, oceanSize, oceanSegs, oceanSegs);
    oceanGeo.rotateX(-Math.PI / 2);

    const oPos = oceanGeo.attributes.position;
    for (let i = 0; i < oPos.count; i++) {
      const ox = oPos.getX(i);
      const oz = oPos.getZ(i);
      const r2 = radius * radius;
      const d2 = ox * ox + oz * oz;
      const sphereY = d2 >= r2 * 0.95 ? radius * 0.2 : Math.sqrt(r2 - d2);
      oPos.setY(i, sphereY);
    }
    oceanGeo.computeVertexNormals();

    const oceanMat = createOceanShaderMaterial(sys, radius);
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    planet.add(oceanMesh);
    planet.oceanMesh = oceanMesh;
    planet.oceanMat = oceanMat;

    // Interactive Water Ripple Rings Pool (spawned when wading, swimming, or hovering over water)
    planet.waterRipples = [];
    const rippleGeo = new THREE.RingGeometry(0.35, 0.52, 32);
    rippleGeo.rotateX(-Math.PI / 2);
    for (let r = 0; r < 18; r++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: sys.waterFoamHex || 0xe0f2fe,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const rMesh = new THREE.Mesh(rippleGeo, rMat);
      rMesh.visible = false;
      planet.add(rMesh);
      planet.waterRipples.push({
        mesh: rMesh,
        mat: rMat,
        active: false,
        age: 0,
        maxLife: 1.5,
        x: 0,
        z: 0,
        maxScale: 4.5
      });
    }
  }

  // ==========================================================================
  // 3. MULTI-LAYER PHYSICAL ATMOSPHERE, CLOUD DECK & ORBITING MOON
  // ==========================================================================
  const cloudTex = createPlanetaryCloudTexture(systemIndex + 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudTex,
    color: sys.cloudColor || 0xffffff,
    transparent: true,
    opacity: 0.46,
    roughness: 0.9,
    metalness: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.022, 88, 88),
    cloudMat
  );
  planet.add(cloudMesh);
  planet.cloudMesh = cloudMesh;

  const innerAtmosMat = createAtmosphereShaderMaterial(sys, false);
  const innerAtmos = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.036, 88, 88),
    innerAtmosMat
  );
  planet.add(innerAtmos);
  planet.innerAtmosMat = innerAtmosMat;

  const outerAtmosMat = createAtmosphereShaderMaterial(sys, true);
  const outerAtmos = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.072, 88, 88),
    outerAtmosMat
  );
  planet.add(outerAtmos);
  planet.outerAtmosMat = outerAtmosMat;

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
        float horizonBand = 1.0 - smoothstep(0.82, 0.998, vLocalPos.y);
        vec3 col = mix(uSkyColor * 0.48, uHorizonColor, horizonBand);
        float alpha = smoothstep(0.65, 0.96, vLocalPos.y) * (0.32 + horizonBand * 0.48);
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

  // Orbiting 3D Planetary Moon in the Sky!
  const moonPivot = new THREE.Group();
  moonPivot.position.set(0, radius, 0);
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(68, 40, 40),
    new THREE.MeshStandardMaterial({
      map: pTex.color,
      normalMap: pTex.normal,
      roughness: 0.88,
      metalness: 0.05,
      color: 0xe2e8f0
    })
  );
  moonMesh.position.set(-520, 460, -820);
  moonPivot.add(moonMesh);
  planet.add(moonPivot);
  planet.moonPivot = moonPivot;

  // ==========================================================================
  // 4. PLANETARY RING SYSTEM
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
  // 5. NORTH POLE STARPORT LANDING PAD AT LOCAL (0, radius + 2.2, 0)
  // ==========================================================================
  const padY = getSurfaceY(radius, 0, 0, activeSystemIndex);
  const pad = new THREE.Group();
  pad.position.set(0, padY, 0);

  const padBase = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 8.4, 0.35, 40),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.34 })
  );
  pad.add(padBase);

  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(4.8, 5.5, 40),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.19;
  pad.add(padRing);

  const padCenter = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.85, 32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  padCenter.rotation.x = -Math.PI / 2;
  padCenter.position.y = 0.19;
  pad.add(padCenter);

  // Coastal Pier / Boardwalk leading from the Landing Pad (+Z) toward the Ocean Beach!
  const pierGroup = new THREE.Group();
  const pierWalkway = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.16, 18.0),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.45 })
  );
  pierWalkway.position.set(0, -0.65, 16.0);
  pierWalkway.rotation.x = 0.08;
  pierGroup.add(pierWalkway);
  pad.add(pierGroup);

  const padSteamTex = createPadSteamTexture();
  planet.padSteamPuffs = [];

  for (let b = 0; b < 4; b++) {
    const ang = (b / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.cos(ang) * 6.2;
    const bz = Math.sin(ang) * 6.2;
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
  // 6. ONLINE 3D NASA OUTPOST MODELS, FLOATING OCEAN BUOYS & ORBITAL ISS
  // ==========================================================================
  sharedGLTFLoader.load(
    "./assets/models/lunar_lander.glb",
    (gltf) => {
      const lander = fitModelToHeight(gltf.scene, 4.8);
      const lx = 9.5;
      const lz = -6.0;
      lander.position.set(lx, getSurfaceY(radius, lx, lz, activeSystemIndex) - 0.05, lz);
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
      const hx = -9.8;
      const hz = -6.5;
      hab.position.set(hx, getSurfaceY(radius, hx, hz, activeSystemIndex) - 0.08, hz);
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
      const ax = 5.6;
      const az = 4.2;
      astro.position.set(ax, getSurfaceY(radius, ax, az, activeSystemIndex), az);
      astro.rotation.y = -2.2;
      planet.add(astro);
    },
    undefined,
    () => {}
  );

  sharedGLTFLoader.load(
    "./assets/models/iss.glb",
    (gltf) => {
      const iss = fitModelToHeight(gltf.scene, 32.0);
      iss.position.set(42, radius + 95, -78);
      iss.rotation.set(0.18, 0.6, -0.12);
      planet.add(iss);
      planet.issOrbitModel = iss;
    },
    undefined,
    () => {}
  );

  // Floating Hydro-Research Buoys in the Ocean Bay that bob with the Gerstner waves!
  planet.floatingBuoys = [];
  if (sys.hasWater) {
    const buoyCoords = [
      [0, 38],
      [-18, 52],
      [22, 48],
      [-8, 78],
      [28, 82]
    ];
    buoyCoords.forEach(([bx, bz]) => {
      const buoy = new THREE.Group();
      const floatRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.85, 0.24, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.3 })
      );
      floatRing.rotation.x = Math.PI / 2;
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.16, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 })
      );
      mast.position.y = 1.1;
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      beacon.position.y = 2.3;
      buoy.add(floatRing, mast, beacon);
      buoy.position.set(bx, radius, bz);
      planet.add(buoy);
      planet.floatingBuoys.push({ group: buoy, x: bx, z: bz });
    });
  }

  // ==========================================================================
  // 7. VAST PLANETARY LANDSCAPE (Spires, Trees, Boulders & Horizon Mountains)
  // ==========================================================================
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sys.base[0] * 0.85, sys.base[1] * 0.85, sys.base[2] * 0.85),
    roughness: 0.85,
    metalness: 0.15
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: sys.atmosHex,
    emissive: sys.atmosHex,
    emissiveIntensity: 0.42,
    roughness: 0.2,
    metalness: 0.5
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: sys.faunaColors[0],
    emissive: sys.faunaColors[0],
    emissiveIntensity: 0.18,
    roughness: 0.55
  });

  for (let i = 0; i < 180; i++) {
    const dist = 18 + Math.random() * 340;
    const ang = Math.random() * Math.PI * 2;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    const hOffset = getTerrainOffset(rx, rz, activeSystemIndex);

    // Don't place land trees in the middle of the deep ocean bay, place coral/spires instead
    const ry = getSurfaceY(radius, rx, rz, activeSystemIndex);

    if (i % 4 === 0) {
      const h = 2.2 + Math.random() * 6.5;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.6 + Math.random() * 0.85, h, 6),
        crystalMat
      );
      spire.position.set(rx, ry + h * 0.42, rz);
      spire.rotation.set(
        (Math.random() - 0.5) * 0.22,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.22
      );
      planet.add(spire);
    } else if (i % 4 === 1 && hOffset > 0.8) {
      // Alien bioluminescent canopy tree on dry land
      const tree = new THREE.Group();
      const trunkH = 2.4 + Math.random() * 2.5;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.34, trunkH, 8),
        rockMat
      );
      trunk.position.y = trunkH * 0.5;
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(1.3 + Math.random() * 1.1, 12, 10),
        foliageMat
      );
      crown.scale.set(1.2, 0.65, 1.2);
      crown.position.y = trunkH + 0.4;
      tree.add(trunk, crown);
      tree.position.set(rx, ry, rz);
      planet.add(tree);
    } else {
      const s = 1.1 + Math.random() * 3.8;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), rockMat);
      rock.position.set(rx, ry + s * 0.35, rz);
      rock.scale.set(1.3, 0.68, 1.05);
      rock.rotation.y = Math.random() * Math.PI;
      planet.add(rock);
    }
  }

  // Colossal Mountain Ranges along the outer perimeter (180m to 450m)
  for (let m = 0; m < 48; m++) {
    const dist = 180 + Math.random() * 260;
    const ang = (m / 48) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
    // Leave an open ocean channel directly South (+Z)
    if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < 0.38 && dist < 260) continue;

    const mx = Math.cos(ang) * dist;
    const mz = Math.sin(ang) * dist;
    const my = getSurfaceY(radius, mx, mz, activeSystemIndex);
    const mh = 22 + Math.random() * 44;
    const mw = 16 + Math.random() * 26;

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

// Spawn an expanding 3D water ripple ring at (x, z) on the ocean surface
export const spawnWaterRipple = (planet, x, z, maxScale = 4.2) => {
  if (!planet || !planet.waterRipples) return;
  const r = planet.waterRipples.find((item) => !item.active);
  if (!r) return;

  r.active = true;
  r.age = 0;
  r.maxLife = 1.2 + Math.random() * 0.6;
  r.x = x;
  r.z = z;
  r.maxScale = maxScale;
  r.mesh.visible = true;
  r.mesh.scale.setScalar(0.4);
};

export const spawnAnimals = (planet, count = 42) => {
  const { animalRoot, radius, systemInfo, systemIndex } = planet;
  const types = ["grazer", "floater", "skitter", "hopper", "swimmer"];
  const palette = systemInfo ? systemInfo.faunaColors : [0x6ee7b7, 0xfbbf24, 0xc084fc, 0x38bdf8];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const col = palette[i % palette.length];
    const animal = buildAnimal(type, col);

    let x = 0;
    let z = 0;
    if (type === "swimmer") {
      // Spawn aquatic manta-creatures in the Ocean Bay (+Z from landing pad)
      x = (Math.random() - 0.5) * 75;
      z = 26 + Math.random() * 85;
    } else {
      const dist = 14 + Math.random() * 110;
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      x = Math.cos(ang) * dist;
      z = Math.sin(ang) * dist;
    }

    const y = getSurfaceY(radius, x, z, systemIndex);
    const floatOffset = type === "floater" ? 3.2 + Math.random() * 3.5 : 0;
    animal.position.set(x, y + floatOffset, z);

    const dirAngle = Math.random() * Math.PI * 2;
    animal.rotation.y = dirAngle;

    animal.userData = {
      type,
      speed:
        type === "swimmer"
          ? 3.6
          : type === "skitter"
          ? 3.2
          : type === "hopper"
          ? 2.6
          : 1.75,
      heading: dirAngle,
      turnRate: (Math.random() - 0.5) * 0.8,
      timer: Math.random() * 10,
      floatOffset,
      floating: type === "floater",
      swimming: type === "swimmer"
    };

    animalRoot.add(animal);
    planet.animals.push(animal);
  }

  const glbWildlife = [
    { url: "./assets/models/fox.glb", scale: 0.022, flying: false, speed: 3.2, count: 3 },
    { url: "./assets/models/flamingo.glb", scale: 0.022, flying: true, speed: 4.8, count: 3 },
    { url: "./assets/models/parrot.glb", scale: 0.024, flying: true, speed: 5.0, count: 3 },
    { url: "./assets/models/stork.glb", scale: 0.022, flying: true, speed: 4.5, count: 3 }
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

          const dist = 14 + Math.random() * 75;
          const ang = Math.random() * Math.PI * 2;
          const x = Math.cos(ang) * dist;
          const z = Math.sin(ang) * dist;
          const floatOffset = spec.flying ? 4.5 + Math.random() * 3.5 : 0;
          const y = getSurfaceY(radius, x, z, systemIndex) + floatOffset;

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
    roughness: 0.48
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.4,
    roughness: 0.5
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const limbs = [];

  if (type === "swimmer") {
    // Aquatic Bioluminescent Manta-Ray / Pelagic Glider
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), bodyMat);
    body.scale.set(1.3, 0.28, 1.6);
    g.add(body);

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.95), bodyMat);
      wing.position.set(side * 0.75, 0, 0);
      limbs.push(wing);
      g.add(wing);
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.3, 8), glowMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0, -1.15);
    g.add(tail);
  } else if (type === "floater") {
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

export const updateAnimals = (planet, dt, time = performance.now() * 0.001) => {
  if (!planet) return;
  const radius = planet.radius || PLANET_RADIUS;
  const sysIdx = planet.systemIndex || 0;

  // Update Gerstner Ocean Shader Uniforms & Floating Buoys
  if (planet.oceanMat) {
    planet.oceanMat.uniforms.uTime.value = time;
  }

  if (planet.floatingBuoys) {
    for (const b of planet.floatingBuoys) {
      const waveWorldY = getWaterSurfaceWorldY(radius, b.x, b.z, time, sysIdx);
      b.group.position.y = waveWorldY + radius;
      b.group.rotation.z = Math.sin(time * 2.1 + b.x * 0.2) * 0.14;
      b.group.rotation.x = Math.cos(time * 1.8 + b.z * 0.2) * 0.14;
    }
  }

  // Update expanding 3D Water Ripple Rings
  if (planet.waterRipples) {
    for (const r of planet.waterRipples) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.maxLife) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const p = r.age / r.maxLife;
      const waveWorldY = getWaterSurfaceWorldY(radius, r.x, r.z, time, sysIdx);
      r.mesh.position.set(r.x, waveWorldY + radius + 0.06, r.z);
      r.mesh.scale.setScalar(0.5 + p * r.maxScale);
      r.mat.opacity = (1.0 - p) * 0.65;
    }
  }

  if (planet.cloudMesh) {
    planet.cloudMesh.rotation.y += dt * 0.006;
  }

  if (planet.moonPivot) {
    planet.moonPivot.rotation.y += dt * 0.015;
  }

  if (planet.glbMixers) {
    for (const m of planet.glbMixers) {
      m.update(dt);
    }
  }

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
    if (distFromPad > 150) {
      ud.heading = Math.atan2(-a.position.x, -a.position.z) + (Math.random() - 0.5) * 0.5;
    } else if (distFromPad < 9.5) {
      ud.heading = Math.atan2(a.position.x, a.position.z) + (Math.random() - 0.5) * 0.4;
    }

    if (Math.random() < 0.015) {
      ud.turnRate = (Math.random() - 0.5) * 1.1;
    }

    const surfY = getSurfaceY(radius, a.position.x, a.position.z, sysIdx);
    const waveY = getWaterSurfaceWorldY(radius, a.position.x, a.position.z, time, sysIdx) + radius;

    if (ud.swimming) {
      a.position.y = Math.max(surfY + 0.4, waveY - 0.15 + Math.sin(ud.timer * 3.2) * 0.25);
    } else if (ud.floating) {
      a.position.y = Math.max(surfY, waveY) + ud.floatOffset + Math.sin(ud.timer * 2.2) * 0.45;
    } else if (ud.type === "hopper") {
      const hop = Math.abs(Math.sin(ud.timer * 4.5)) * 0.45;
      a.position.y = Math.max(surfY, waveY - 0.3) + hop;
    } else {
      a.position.y = Math.max(surfY, waveY - 0.4);
    }

    a.rotation.y = ud.heading;

    const limbs = ud.limbs || [];
    for (let i = 0; i < limbs.length; i++) {
      const phase = ud.timer * 6 + i * 1.4;
      if (ud.swimming) {
        limbs[i].rotation.z = Math.sin(phase) * 0.38;
      } else {
        limbs[i].rotation.x = Math.sin(phase) * 0.35;
      }
    }
  }
};

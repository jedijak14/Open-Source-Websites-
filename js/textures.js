/**
 * Stellar Voyage — Procedural PBR Texture Generation
 * Creates normal / roughness / metalness / color maps via Canvas, then
 * uploads them to Three.js DataTextures. No external image files needed.
 */

import * as THREE from "three";

const size = 256;
const canvas = document.createElement("canvas");
canvas.width = size;
canvas.height = size;
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const toDataTexture = (pixels, format = THREE.RGBAFormat) => {
  const tex = new THREE.DataTexture(pixels, size, size, format);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

const clear = () => { ctx.clearRect(0, 0, size, size); };

// Seeded pseudo-random
const rng = (() => {
  let seed = 12345;
  return {
    set: (s) => { seed = s; },
    float: () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    },
    range: (a, b) => a + rng.float() * (b - a),
    int: (a, b) => Math.floor(rng.range(a, b))
  };
})();

// Fill with noise scaled 0..1
const noise = (x, y) => {
  // simple value noise
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const r = (a, b) => {
    const n = (a * 16807 + b * 63641) % 2147483647;
    return (n - 1) / 2147483646;
  };
  const a = r(ix, iy), b = r(ix + 1, iy), c = r(ix, iy + 1), d = r(ix + 1, iy + 1);
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

const drawRect = (x, y, w, h, r, g, b, a = 1) => {
  ctx.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
  ctx.fillRect(x, y, w, h);
};

const drawLine = (x1, y1, x2, y2, r, g, b, a = 1, width = 1) => {
  ctx.strokeStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

const getPixels = () => ctx.getImageData(0, 0, size, size).data;

// ---------- Individual texture generators ----------

const makeColor = (fillFn) => {
  clear();
  fillFn(ctx, size);
  return getPixels();
};

const makeNormal = (fillFn) => {
  // normal map stored as RGB (x,y,z) -> (r,g,b) with z dominant
  clear();
  fillFn(ctx, size);
  const raw = getPixels();
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size * 4; i += 4) {
    const r = raw[i] / 255;
    const g = raw[i + 1] / 255;
    const b = raw[i + 2] / 255;
    // compute normal from height-ish color: use r,g as slope, z = sqrt(1-r^2-g^2)
    let nx = r * 2 - 1;
    let ny = g * 2 - 1;
    const len = Math.sqrt(nx * nx + ny * ny);
    let nz = len > 1 ? 0 : Math.sqrt(Math.max(0, 1 - len * len));
    out[i] = (nx * 0.5 + 0.5) * 255;
    out[i + 1] = (ny * 0.5 + 0.5) * 255;
    out[i + 2] = nz * 255;
    out[i + 3] = 255;
  }
  return out;
};

const makeScalar = (fillFn, invert = false) => {
  clear();
  fillFn(ctx, size);
  const raw = getPixels();
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size * 4; i += 4) {
    let v = (raw[i] + raw[i + 1] + raw[i + 2]) / 3 / 255;
    if (invert) v = 1 - v;
    const cv = Math.round(v * 255);
    out[i] = cv; out[i + 1] = cv; out[i + 2] = cv; out[i + 3] = 255;
  }
  return out;
};

// ---------------- Metal (cockpit / ship) ----------------
const metalColor = () => makeColor((c, s) => {
  drawRect(0, 0, s, s, 0.32, 0.34, 0.38);
  // panel rivets / scuffs
  for (let i = 0; i < 120; i++) {
    const x = rng.int(0, s), y = rng.int(0, s);
    const w = rng.range(2, 7), h = rng.range(2, 6);
    drawRect(x, y, w, h, 0.22, 0.24, 0.26, 0.6);
  }
  // grime edges
  for (let i = 0; i < 40; i++) {
    const x = rng.range(0, s), y = rng.range(0, s);
    drawRect(x, y, rng.range(4, 18), rng.range(1, 3), 0.18, 0.2, 0.22, 0.35);
  }
});

const metalNormal = () => makeNormal((c, s) => {
  drawRect(0, 0, s, s, 0.5, 0.5, 0.95); // flat normal base
  for (let i = 0; i < 60; i++) {
    const x = rng.int(0, s), y = rng.int(0, s);
    drawRect(x, y, rng.range(6, 14), rng.range(6, 14), 0.52, 0.5, 1, 0.5);
  }
});

const metalRough = () => makeScalar((c, s) => {
  drawRect(0, 0, s, s, 0.55, 0.55, 0.55);
  for (let i = 0; i < 30; i++) {
    drawRect(rng.int(0, s), rng.int(0, s), rng.range(3, 12), rng.range(1, 4), 0.75, 0.75, 0.75);
  }
}, true);

// ---------------- Red painted surface (fire locker) ----------------
const redColor = () => makeColor((c, s) => {
  drawRect(0, 0, s, s, 0.55, 0.06, 0.06);
  for (let i = 0; i < 50; i++) {
    drawRect(rng.int(0, s), rng.int(0, s), rng.range(4, 16), rng.range(1, 3), 0.4, 0.04, 0.04, 0.6);
  }
  drawRect(s * 0.1, s * 0.12, s * 0.3, s * 0.07, 0.25, 0.2, 0.2, 0.5);
});
const redNormal = () => makeNormal((c, s) => {
  drawRect(0, 0, s, s, 0.5, 0.5, 1);
  for (let i = 0; i < 30; i++) {
    drawRect(rng.int(0, s), rng.int(0, s), rng.range(10, 30), rng.range(2, 6), 0.53, 0.52, 0.9, 0.5);
  }
});
const redRough = () => makeScalar((c, s) => {
  drawRect(0, 0, s, s, 0.5, 0.5, 0.5);
}, true);

// ---------------- Glowing blue (warp core / displays) ----------------
const glowColor = () => makeColor((c, s) => {
  const grad = c.createRadialGradient(s / 2, s / 2, s * 0.15, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(0, 200, 255, 1)");
  grad.addColorStop(1, "rgba(0, 60, 120, 1)");
  c.fillStyle = grad;
  c.fillRect(0, 0, s, s);
});
const glowNormal = () => makeNormal((c, s) => {
  drawRect(0, 0, s, s, 0.5, 0.5, 1);
});
const glowRough = () => makeScalar((c, s) => {
  drawRect(0, 0, s, s, 0.25, 0.25, 0.25);
}, true);

// ---------------- Planet surface (desert / alien) ----------------
const planetColor = () => makeColor((c, s) => {
  drawRect(0, 0, s, s, 0.42, 0.35, 0.28);
  for (let i = 0; i < 80; i++) {
    const x = rng.int(0, s), y = rng.int(0, s);
    drawRect(x, y, rng.range(8, 40), rng.range(3, 12), 0.55, 0.42, 0.32, 0.5);
  }
  for (let i = 0; i < 20; i++) {
    drawRect(rng.int(0, s), rng.int(0, s), rng.range(15, 60), rng.range(1, 3), 0.3, 0.22, 0.16, 0.5);
  }
});
const planetNormal = () => makeNormal((c, s) => {
  drawRect(0, 0, s, s, 0.5, 0.5, 1);
  for (let i = 0; i < 40; i++) {
    const x = rng.int(0, s), y = rng.int(0, s);
    drawRect(x, y, rng.range(12, 50), rng.range(6, 18), 0.55, 0.53, 0.9, 0.6);
  }
});
const planetRough = () => makeScalar((c, s) => {
  drawRect(0, 0, s, s, 0.7, 0.7, 0.7);
}, true);

// ---------------- Planet atmosphere (thin translucent shell color) ----------------
const atmosColor = () => makeColor((c, s) => {
  const grad = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(30, 130, 200, 0.35)");
  grad.addColorStop(0.5, "rgba(60, 100, 180, 0.18)");
  grad.addColorStop(1, "rgba(10, 20, 60, 0)");
  c.fillStyle = grad;
  c.fillRect(0, 0, s, s);
});

// ---------------- Nebula / space backdrop (for skybox tint) ----------------
const starColor = () => makeColor((c, s) => {
  drawRect(0, 0, s, s, 0.02, 0.02, 0.05);
  for (let i = 0; i < 400; i++) {
    const x = rng.int(0, s), y = rng.int(0, s);
    const br = rng.range(0.7, 1);
    c.fillStyle = `rgba(${br * 255},${br * 240},${br * 220},${rng.range(0.4, 1)})`;
    c.fillRect(x, y, 1, 1);
  }
});

export const makePlanetTextures = (seed = 1, base = [0.22, 0.42, 0.34], accent = [0.42, 0.65, 0.48]) => {
  rng.set(seed * 7919 + 101);
  const colPixels = makeColor((c, s) => {
    drawRect(0, 0, s, s, base[0], base[1], base[2]);
    for (let i = 0; i < 110; i++) {
      const x = rng.int(0, s), y = rng.int(0, s);
      drawRect(x, y, rng.range(10, 48), rng.range(4, 16), accent[0], accent[1], accent[2], 0.55);
    }
    for (let i = 0; i < 35; i++) {
      drawRect(rng.int(0, s), rng.int(0, s), rng.range(18, 70), rng.range(2, 5), base[0] * 0.65, base[1] * 0.65, base[2] * 0.65, 0.5);
    }
  });
  const normPixels = makeNormal((c, s) => {
    drawRect(0, 0, s, s, 0.5, 0.5, 1);
    for (let i = 0; i < 55; i++) {
      const x = rng.int(0, s), y = rng.int(0, s);
      drawRect(x, y, rng.range(10, 45), rng.range(6, 20), 0.56, 0.54, 0.9, 0.65);
    }
  });
  const roughPixels = makeScalar((c, s) => {
    drawRect(0, 0, s, s, 0.68, 0.68, 0.68);
    for (let i = 0; i < 40; i++) {
      drawRect(rng.int(0, s), rng.int(0, s), rng.range(8, 30), rng.range(4, 12), 0.45, 0.45, 0.45, 0.6);
    }
  }, true);
  return {
    color: toDataTexture(colPixels),
    normal: toDataTexture(normPixels),
    rough: toDataTexture(roughPixels)
  };
};

export const Textures = {
  size,
  metal: { color: metalColor(), normal: metalNormal(), roughness: metalRough() },
  red: { color: redColor(), normal: redNormal(), roughness: redRough() },
  glow: { color: glowColor(), normal: glowNormal(), roughness: glowRough() },
  planet: { color: planetColor(), normal: planetNormal(), roughness: planetRough() },
  atmos: atmosColor(),
  stars: starColor(),
  toDataTexture,
  // pre-built Three textures
  three: {
    metalColor: toDataTexture(metalColor()),
    metalNormal: toDataTexture(metalNormal()),
    metalRough: toDataTexture(metalRough()),
    redColor: toDataTexture(redColor()),
    redNormal: toDataTexture(redNormal()),
    redRough: toDataTexture(redRough()),
    glowColor: toDataTexture(glowColor()),
    planetColor: toDataTexture(planetColor()),
    planetNormal: toDataTexture(planetNormal()),
    planetRough: toDataTexture(planetRough()),
    atmosColor: toDataTexture(atmosColor()),
    starColor: toDataTexture(starColor())
  }
};

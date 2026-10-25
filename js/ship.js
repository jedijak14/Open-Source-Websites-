/**
 * Stellar Voyage — High-Detail Corvette Starship Model ("AEGIS VANGUARD")
 * Built with MeshPhysicalMaterial (clearcoat + PBR normal/roughness maps),
 * articulated retractable hydraulic landing gear, deployable aft boarding ramp,
 * spinning quantum hyperdrive ring, VTOL retro-thrusters, and nav beacons.
 */

import * as THREE from "three";
import { Textures } from "./textures.js";

export const buildShip = () => {
  const ship = new THREE.Group();
  ship.name = "ship";

  // High-grade PBR Physical Materials
  const hullLight = new THREE.MeshPhysicalMaterial({
    map: Textures.three.metalColor,
    normalMap: Textures.three.metalNormal,
    roughnessMap: Textures.three.metalRough,
    color: 0xdbeafe,
    metalness: 0.82,
    roughness: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18
  });

  const hullDark = new THREE.MeshPhysicalMaterial({
    map: Textures.three.metalColor,
    normalMap: Textures.three.metalNormal,
    roughnessMap: Textures.three.metalRough,
    color: 0x1e293b,
    metalness: 0.88,
    roughness: 0.34,
    clearcoat: 0.45
  });

  const hullAccent = new THREE.MeshPhysicalMaterial({
    map: Textures.three.redColor,
    normalMap: Textures.three.redNormal,
    roughnessMap: Textures.three.redRough,
    color: 0xdc2626,
    metalness: 0.45,
    roughness: 0.32,
    clearcoat: 0.8
  });

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 0.7
  });

  const canopyGlass = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    metalness: 0.15,
    roughness: 0.05,
    transmission: 0.55,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0
  });

  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const violetGlow = new THREE.MeshBasicMaterial({ color: 0x818cf8 });

  const thrusters = [];
  const retroPlumes = [];

  const makePlume = (rTop, rBot, len, col = 0x22d3ee) => {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(rTop, len, 18),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      })
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.z = len * 0.45;

    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(rTop * 0.55, len * 0.7, 14),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending
      })
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.z = len * 0.32;

    g.add(outer, inner);
    g.userData = { outer, inner };
    thrusters.push(g);
    return g;
  };

  // Hull root group (allows suspension bounce during landing touchdown)
  const bodyRoot = new THREE.Group();
  ship.add(bodyRoot);

  // ---------- 1. Sculpted Main Fuselage & Armored Chines ----------
  const coreHull = new THREE.Mesh(new THREE.CapsuleGeometry(1.18, 4.2, 12, 28), hullLight);
  coreHull.rotation.x = Math.PI / 2;
  coreHull.scale.set(1.22, 0.92, 1.0);
  coreHull.castShadow = true;
  coreHull.receiveShadow = true;
  bodyRoot.add(coreHull);

  // Forward tapered nose & sensor radome (-Z)
  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(1.18, 2.8, 28), hullLight);
  noseCone.rotation.x = -Math.PI / 2;
  noseCone.position.set(0, -0.06, -3.95);
  noseCone.scale.set(1.18, 0.82, 1.0);
  bodyRoot.add(noseCone);

  const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.95, 24), hullDark);
  noseTip.rotation.x = -Math.PI / 2;
  noseTip.position.set(0, -0.06, -5.25);
  bodyRoot.add(noseTip);

  // Side armored chine strakes running along the fuselage
  for (const sx of [-1, 1]) {
    const chine = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 5.4), hullDark);
    chine.position.set(sx * 1.28, -0.1, -0.35);
    chine.rotation.y = sx * -0.06;
    bodyRoot.add(chine);

    const chineGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 4.4), cyanGlow);
    chineGlow.position.set(sx * 1.52, -0.1, -0.35);
    chineGlow.rotation.y = sx * -0.06;
    bodyRoot.add(chineGlow);
  }

  // Dorsal armored spine & squadron livery
  const dorsalSpine = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.46, 4.6), hullAccent);
  dorsalSpine.position.set(0, 0.82, 0.35);
  bodyRoot.add(dorsalSpine);

  // Dorsal radiator vents
  for (let v = 0; v < 5; v++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.28), hullDark);
    vent.position.set(0, 1.05, -0.8 + v * 0.65);
    vent.rotation.x = 0.25;
    bodyRoot.add(vent);
  }

  // ---------- 2. Panoramic Command Bridge Canopy ----------
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.96, 28, 20), canopyGlass);
  canopy.position.set(0, 0.56, -1.65);
  canopy.scale.set(0.95, 0.68, 1.85);
  bodyRoot.add(canopy);

  // Canopy metallic frame ribs
  for (let r = -1; r <= 1; r++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.035, 10, 24, Math.PI), hullDark);
    rib.position.set(0, 0.42, -1.65 + r * 0.65);
    rib.scale.set(0.98, 0.72, 1.0);
    bodyRoot.add(rib);
  }

  // ---------- 3. Spinning Quantum Hyperdrive Ring Collar ----------
  const quantumRing = new THREE.Group();
  quantumRing.position.set(0, 0.15, 1.05);
  const qTorus = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.09, 14, 48), hullDark);
  const qGlowTorus = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.045, 10, 48), violetGlow);
  quantumRing.add(qTorus, qGlowTorus);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2;
    const node = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.38), goldMat);
    node.position.set(Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0);
    node.rotation.z = a;
    quantumRing.add(node);
  }
  bodyRoot.add(quantumRing);
  ship.__quantumRing = quantumRing;

  // ---------- 4. Swept Delta Wings, Nacelles & Nav Beacons ----------
  for (const sx of [-1, 1]) {
    const wingG = new THREE.Group();

    // Primary delta airfoil
    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 2.45), hullLight);
    mainWing.position.set(sx * 2.55, -0.06, 0.55);
    mainWing.rotation.y = sx * -0.28;
    mainWing.castShadow = true;
    wingG.add(mainWing);

    // Leading-edge dark armor slat
    const leadingEdge = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.18, 0.34), hullDark);
    leadingEdge.position.set(sx * 2.52, -0.06, -0.52);
    leadingEdge.rotation.y = sx * -0.28;
    wingG.add(leadingEdge);

    // Red & Gold squadron stripes
    const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 0.48), hullAccent);
    wingStripe.position.set(sx * 2.55, -0.05, 0.45);
    wingG.add(wingStripe);

    // Angled twin tail fins
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.45, 1.65), hullDark);
    tailFin.position.set(sx * 1.75, 0.68, 1.65);
    tailFin.rotation.z = sx * -0.26;
    wingG.add(tailFin);

    const finGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.08), cyanGlow);
    finGlow.position.set(sx * 1.82, 0.72, 2.35);
    finGlow.rotation.z = sx * -0.26;
    wingG.add(finGlow);

    // Heavy Wingtip Warp Nacelle
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 3.1, 20), hullDark);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(sx * 3.15, -0.24, 0.75);
    wingG.add(nacelle);

    // Glowing intake bussard collector (-Z)
    const intake = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), cyanGlow);
    intake.position.set(sx * 3.15, -0.24, -0.78);
    intake.scale.set(1, 1, 0.45);
    wingG.add(intake);

    // Nacelle plasma plume (+Z)
    const nacPlume = makePlume(0.28, 0.04, 1.8, 0x38bdf8);
    nacPlume.position.set(sx * 3.15, -0.24, 2.3);
    wingG.add(nacPlume);

    // Wingtip Navigation Strobe (Port = Red, Starboard = Emerald)
    const strobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xef4444 : 0x10b981 })
    );
    strobe.position.set(sx * 4.55, -0.05, 1.15);
    wingG.add(strobe);

    bodyRoot.add(wingG);
  }

  // ---------- 5. Triple Aft Vector-Thrust Ion Engines (+Z) ----------
  for (let i = -1; i <= 1; i++) {
    const outerBell = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 1.1, 20), hullDark);
    outerBell.rotation.x = Math.PI / 2;
    outerBell.position.set(i * 0.86, -0.04, 2.65);
    bodyRoot.add(outerBell);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 10, 20), cyanGlow);
    innerRing.position.set(i * 0.86, -0.04, 3.18);
    bodyRoot.add(innerRing);

    const mainPlume = makePlume(0.38, 0.06, 2.4, 0x22d3ee);
    mainPlume.position.set(i * 0.86, -0.04, 3.2);
    bodyRoot.add(mainPlume);
  }

  const engineLight = new THREE.PointLight(0x22d3ee, 2.6, 24);
  engineLight.position.set(0, 0, 4.2);
  bodyRoot.add(engineLight);
  ship.__engineLight = engineLight;

  // ---------- 6. VTOL Belly Retro-Thrusters (active during Landing & Takeoff!) ----------
  const retroCoords = [
    [-1.4, -0.55, -1.2],
    [1.4, -0.55, -1.2],
    [-1.6, -0.55, 1.4],
    [1.6, -0.55, 1.4]
  ];
  retroCoords.forEach(([rx, ry, rz]) => {
    const rCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 1.35, 14),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      })
    );
    rCone.rotation.x = Math.PI; // points straight down (-Y)
    rCone.position.set(rx, ry - 0.65, rz);
    bodyRoot.add(rCone);
    retroPlumes.push(rCone);
  });

  // ---------- 7. Animated Retractable Hydraulic Landing Gear ----------
  const gearStruts = [];
  const addAnimatedStrut = (x, z, isFront = false) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.55, z);

    const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.72, 10), hullDark);
    upperLeg.position.y = -0.35;

    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 10), goldMat);
    piston.position.y = -0.68;

    const footPad = new THREE.Mesh(
      new THREE.BoxGeometry(isFront ? 0.58 : 0.68, 0.12, isFront ? 0.82 : 0.98),
      hullDark
    );
    footPad.position.y = -0.92;

    pivot.add(upperLeg, piston, footPad);
    ship.add(pivot);
    gearStruts.push({ pivot, isFront, side: Math.sign(x) });
  };
  addAnimatedStrut(-1.55, 1.15, false);
  addAnimatedStrut(1.55, 1.15, false);
  addAnimatedStrut(0, -2.35, true);

  // ---------- 8. Animated Aft Hydraulic Boarding Ramp ----------
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, -0.68, 2.25);

  const rampSlab = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.09, 2.1), hullDark);
  rampSlab.position.set(0, 0, 1.05);

  for (const sx of [-0.58, 0.58]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.95), cyanGlow);
    rail.position.set(sx, 0.06, 1.05);
    rampSlab.add(rail);
  }
  rampPivot.add(rampSlab);
  bodyRoot.add(rampPivot);

  // ---------- Animation Controller Methods ----------
  // progress: 0 = retracted in flight, 1 = fully deployed for landing
  ship.setGearProgress = (p) => {
    const t = Math.max(0, Math.min(1, p));
    gearStruts.forEach((g) => {
      g.pivot.visible = t > 0.02;
      const foldAngle = (1 - t) * (Math.PI * 0.48);
      if (g.isFront) {
        g.pivot.rotation.x = -foldAngle;
      } else {
        g.pivot.rotation.z = g.side * foldAngle;
      }
      g.pivot.scale.y = 0.25 + 0.75 * t;
    });
  };

  // progress: 0 = closed, 1 = lowered to landing pad
  ship.setRampProgress = (p) => {
    const t = Math.max(0, Math.min(1, p));
    rampPivot.visible = t > 0.02;
    rampPivot.rotation.x = t * 0.42; // tilts down toward ground (+Z / -Y)
  };

  // v: 0..1 intensity of vertical VTOL retro-thrusters
  ship.setRetroThrust = (v) => {
    const val = Math.max(0, Math.min(1, v));
    retroPlumes.forEach((rp) => {
      rp.material.opacity = val * 0.85;
      rp.scale.y = 0.4 + val * 1.1;
    });
  };

  ship.setSuspensionBounce = (offsetY) => {
    bodyRoot.position.y = offsetY;
  };

  // Initialize gear & ramp retracted
  ship.setGearProgress(0);
  ship.setRampProgress(0);
  ship.setRetroThrust(0);

  ship.userData = {
    thrust: 0,
    thrusters
  };

  return ship;
};
